import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { PayrollStatementPDF } from '@/lib/pdf/payroll-statement-template';
import type { PayrollStatementData, PayrollStatementRow } from '@/lib/pdf/payroll-statement-template';
import type { CompanyInfo } from '@/lib/pdf/types';
import { getPresignedUrl, getS3Url } from '@/lib/s3';

export const runtime = 'nodejs';

// GET /api/distributor-payroll/statement?distributorId=X&year=YYYY&month=MM
// month が指定されなければ年間、指定されれば月間
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const distributorId = parseInt(searchParams.get('distributorId') || '0');
    const year = parseInt(searchParams.get('year') || '0');
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    if (!distributorId || !year) {
      return NextResponse.json({ error: 'distributorId, year は必須' }, { status: 400 });
    }

    // 配布員情報（紐付け社員も取得）
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
      select: { id: true, staffId: true, name: true, linkedEmployeeId: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    // 会社設定
    const companySetting = await prisma.companySetting.findFirst({ orderBy: { id: 'asc' } });
    const company: CompanyInfo = {
      companyName: companySetting?.companyName || '会社名未設定',
      companyNameKana: companySetting?.companyNameKana,
      postalCode: companySetting?.postalCode,
      address: companySetting?.address,
      phone: companySetting?.phone,
      fax: companySetting?.fax,
      email: companySetting?.email,
      invoiceRegistrationNumber: companySetting?.invoiceRegistrationNumber,
      bankName: companySetting?.bankName,
      bankBranch: companySetting?.bankBranch,
      bankAccountType: companySetting?.bankAccountType,
      bankAccountNumber: companySetting?.bankAccountNumber,
      bankAccountHolder: companySetting?.bankAccountHolder,
      representativeName: companySetting?.representativeName,
      sealImageUrl: companySetting?.sealImageUrl,
    };

    // 印鑑画像をS3署名付きURLに変換（@react-pdf/renderer が読めるように）
    if (company.sealImageUrl) {
      try {
        let s3Key = '';
        const sealUrl = company.sealImageUrl;
        if (sealUrl.startsWith('/api/s3-proxy?key=')) {
          s3Key = decodeURIComponent(sealUrl.replace('/api/s3-proxy?key=', ''));
        }
        if (s3Key) {
          // 署名付きURLを生成して@react-pdf/rendererが直接フェッチできるようにする
          company.sealImageUrl = await getPresignedUrl(s3Key, 300);
        }
      } catch (err) {
        console.error('Seal image URL resolve error:', err);
        company.sealImageUrl = null;
      }
    }

    // 期間の決定
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    if (month) {
      // 月間
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0); // 月末
      periodLabel = `${year}年${month}月`;
    } else {
      // 年間
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 11, 31);
      periodLabel = `${year}年度（${year}年1月〜12月）`;
    }

    // 給与レコード取得
    const records = await prisma.distributorPayrollRecord.findMany({
      where: {
        distributorId,
        periodStart: { gte: periodStart, lte: periodEnd },
      },
      include: {
        items: { orderBy: { date: 'asc' } },
      },
      orderBy: { periodStart: 'asc' },
    });

    // 経費取得
    const expenses = await prisma.distributorExpense.findMany({
      where: {
        distributorId,
        date: { gte: periodStart, lte: periodEnd },
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: { date: true, amount: true },
      orderBy: { date: 'asc' },
    });

    // 経費を日別マップに
    const expenseByDate = new Map<string, number>();
    for (const exp of expenses) {
      const key = exp.date.toISOString().slice(0, 10);
      expenseByDate.set(key, (expenseByDate.get(key) || 0) + exp.amount);
    }

    let rows: PayrollStatementRow[];
    let totalSchedulePay = 0;
    let totalExpensePay = 0;

    if (month) {
      // 月間: 日別明細
      const dayMap = new Map<string, { schedulePay: number; expensePay: number; descriptions: string[] }>();

      for (const record of records) {
        for (const item of record.items) {
          const dateStr = item.date.toISOString().slice(0, 10);
          const entry = dayMap.get(dateStr) || { schedulePay: 0, expensePay: 0, descriptions: [] };
          entry.schedulePay += item.earnedAmount;
          entry.descriptions.push(`${item.flyerTypeCount}種×¥${item.unitPrice.toFixed(1)} ${item.actualCount}投`);
          dayMap.set(dateStr, entry);
        }
      }

      // 経費を追加
      for (const [dateStr, amount] of expenseByDate) {
        const entry = dayMap.get(dateStr) || { schedulePay: 0, expensePay: 0, descriptions: [] };
        entry.expensePay += amount;
        dayMap.set(dateStr, entry);
      }

      // 日付順にソート
      const sortedDates = [...dayMap.keys()].sort();
      const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
      rows = sortedDates.map(dateStr => {
        const entry = dayMap.get(dateStr)!;
        const d = new Date(dateStr + 'T00:00:00');
        const gross = entry.schedulePay + entry.expensePay;
        totalSchedulePay += entry.schedulePay;
        totalExpensePay += entry.expensePay;
        return {
          label: `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`,
          description: entry.descriptions.join(' / ') || '交通費のみ',
          schedulePay: entry.schedulePay,
          expensePay: entry.expensePay,
          grossPay: gross,
        };
      });
    } else {
      // 年間: 月別サマリー
      const monthMap = new Map<number, { schedulePay: number; expensePay: number; count: number }>();
      for (let m = 1; m <= 12; m++) {
        monthMap.set(m, { schedulePay: 0, expensePay: 0, count: 0 });
      }

      for (const record of records) {
        const m = record.periodStart.getMonth() + 1;
        const entry = monthMap.get(m)!;
        entry.schedulePay += record.schedulePay;
        entry.count++;
      }

      for (const [dateStr, amount] of expenseByDate) {
        const m = parseInt(dateStr.slice(5, 7));
        const entry = monthMap.get(m)!;
        entry.expensePay += amount;
      }

      rows = [];
      for (let m = 1; m <= 12; m++) {
        const entry = monthMap.get(m)!;
        const gross = entry.schedulePay + entry.expensePay;
        if (gross === 0) continue; // 空月はスキップ
        totalSchedulePay += entry.schedulePay;
        totalExpensePay += entry.expensePay;
        rows.push({
          label: `${m}月`,
          description: entry.count > 0 ? `${entry.count}週分` : '',
          schedulePay: entry.schedulePay,
          expensePay: entry.expensePay,
          grossPay: gross,
        });
      }
    }

    // 紐付け社員の給与データを合算
    let totalEmployeePay = 0;
    if (distributor.linkedEmployeeId) {
      const linkedEmp = await prisma.employee.findUnique({
        where: { id: distributor.linkedEmployeeId },
        select: { employmentType: true },
      });
      const empPayLabel = linkedEmp?.employmentType === 'OUTSOURCE' ? '業務委託報酬' : '社員報酬';

      const empRecords = await prisma.payrollRecord.findMany({
        where: {
          employeeId: distributor.linkedEmployeeId,
          periodStart: { gte: periodStart },
          periodEnd: { lte: periodEnd },
        },
        orderBy: { periodStart: 'asc' },
      });

      if (month) {
        for (const rec of empRecords) {
          if (rec.grossPay === 0) continue;
          const dateStr = rec.periodStart.toISOString().slice(0, 10);
          const endStr = rec.periodEnd.toISOString().slice(0, 10);
          const d = new Date(dateStr + 'T00:00:00');
          const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
          const label = rec.paymentCycle === 'MONTHLY'
            ? `${d.getMonth() + 1}/${d.getDate()}〜`
            : `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`;
          const desc = rec.paymentCycle === 'MONTHLY'
            ? `${empPayLabel}（${d.getMonth() + 1}/${d.getDate()}〜${new Date(endStr + 'T00:00:00').getMonth() + 1}/${new Date(endStr + 'T00:00:00').getDate()}）`
            : empPayLabel;
          totalEmployeePay += rec.grossPay;
          rows.push({ label, description: desc, schedulePay: rec.grossPay, expensePay: 0, grossPay: rec.grossPay });
        }
      } else {
        const empMonthMap = new Map<number, number>();
        for (const rec of empRecords) {
          if (rec.grossPay === 0) continue;
          const m = rec.periodStart.getMonth() + 1;
          empMonthMap.set(m, (empMonthMap.get(m) || 0) + rec.grossPay);
        }
        for (const [m, pay] of empMonthMap) {
          totalEmployeePay += pay;
          const existing = rows.find(r => r.label === `${m}月`);
          if (existing) {
            existing.schedulePay += pay;
            existing.grossPay += pay;
          } else {
            rows.push({ label: `${m}月`, description: empPayLabel, schedulePay: pay, expensePay: 0, grossPay: pay });
          }
        }
        rows.sort((a, b) => (parseInt(a.label) || 99) - (parseInt(b.label) || 99));
      }
      totalSchedulePay += totalEmployeePay;
    }

    const totalGrossPay = totalSchedulePay + totalExpensePay;

    const statementData: PayrollStatementData = {
      distributorName: distributor.name,
      distributorStaffId: distributor.staffId,
      periodLabel,
      issuedAt: new Date(),
      rows,
      totalSchedulePay,
      totalExpensePay,
      totalGrossPay,
    };

    const element = React.createElement(PayrollStatementPDF, { company, data: statementData });
    const stream = await renderToStream(element as any);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    const fileName = month
      ? `支払明細書_${distributor.staffId}_${year}年${month}月.pdf`
      : `支払明細書_${distributor.staffId}_${year}年度.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('Payroll statement error:', err);
    return NextResponse.json({ error: 'PDF生成に失敗しました' }, { status: 500 });
  }
}
