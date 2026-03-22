import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { PayrollStatementPDF } from '@/lib/pdf/payroll-statement-template';
import type { PayrollStatementData, PayrollStatementRow } from '@/lib/pdf/payroll-statement-template';
import type { CompanyInfo } from '@/lib/pdf/types';
import { getPresignedUrl } from '@/lib/s3';

export const runtime = 'nodejs';

// GET /api/payroll/statement?employeeId=X&year=YYYY&month=MM
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const employeeId = parseInt(searchParams.get('employeeId') || '0');
    const year = parseInt(searchParams.get('year') || '0');
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    if (!employeeId || !year) {
      return NextResponse.json({ error: 'employeeId, year は必須' }, { status: 400 });
    }

    // 社員情報
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true, employeeCode: true, lastNameJa: true, firstNameJa: true,
        employmentType: true,
        linkedDistributor: { select: { id: true, staffId: true, name: true } },
      },
    });
    if (!employee) {
      return NextResponse.json({ error: '社員が見つかりません' }, { status: 404 });
    }

    const empName = `${employee.lastNameJa} ${employee.firstNameJa}`;
    const empCode = employee.employeeCode || `EMP${employee.id}`;

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

    // 印鑑画像をS3署名付きURLに変換
    if (company.sealImageUrl) {
      try {
        let s3Key = '';
        const sealUrl = company.sealImageUrl;
        if (sealUrl.startsWith('/api/s3-proxy?key=')) {
          s3Key = decodeURIComponent(sealUrl.replace('/api/s3-proxy?key=', ''));
        }
        if (s3Key) {
          company.sealImageUrl = await getPresignedUrl(s3Key, 300);
        }
      } catch (err) {
        console.error('Seal image URL resolve error:', err);
        company.sealImageUrl = null;
      }
    }

    // 期間
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    if (month) {
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0);
      periodLabel = `${year}年${month}月`;
    } else {
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 11, 31);
      periodLabel = `${year}年度（${year}年1月〜12月）`;
    }

    const rows: PayrollStatementRow[] = [];
    let totalSchedulePay = 0;
    let totalExpensePay = 0;
    const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
    const payLabel = employee.employmentType === 'OUTSOURCE' ? '業務委託報酬' : '社員報酬';

    // ── 社員 PayrollRecord ──
    const empRecords = await prisma.payrollRecord.findMany({
      where: {
        employeeId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      orderBy: { periodStart: 'asc' },
    });

    if (month) {
      for (const rec of empRecords) {
        if (rec.grossPay === 0) continue;
        const d = new Date(rec.periodStart.toISOString().slice(0, 10) + 'T00:00:00');
        const dEnd = new Date(rec.periodEnd.toISOString().slice(0, 10) + 'T00:00:00');
        const label = rec.paymentCycle === 'MONTHLY'
          ? `${d.getMonth() + 1}/${d.getDate()}〜`
          : `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`;
        const desc = rec.paymentCycle === 'MONTHLY'
          ? `${payLabel}（${d.getMonth() + 1}/${d.getDate()}〜${dEnd.getMonth() + 1}/${dEnd.getDate()}）`
          : payLabel;
        totalSchedulePay += rec.grossPay;
        rows.push({ label, description: desc, schedulePay: rec.grossPay, expensePay: 0, grossPay: rec.grossPay });
      }
    } else {
      // 年間: 月別
      const monthMap = new Map<number, number>();
      for (const rec of empRecords) {
        if (rec.grossPay === 0) continue;
        const m = rec.periodStart.getMonth() + 1;
        monthMap.set(m, (monthMap.get(m) || 0) + rec.grossPay);
      }
      for (const [m, pay] of monthMap) {
        totalSchedulePay += pay;
        rows.push({ label: `${m}月`, description: payLabel, schedulePay: pay, expensePay: 0, grossPay: pay });
      }
    }

    // ── 紐付け配布員データ ──
    if (employee.linkedDistributor) {
      const distId = employee.linkedDistributor.id;

      const distRecords = await prisma.distributorPayrollRecord.findMany({
        where: {
          distributorId: distId,
          periodStart: { gte: periodStart, lte: periodEnd },
        },
        include: { items: { orderBy: { date: 'asc' } } },
        orderBy: { periodStart: 'asc' },
      });

      const distExpenses = await prisma.distributorExpense.findMany({
        where: {
          distributorId: distId,
          date: { gte: periodStart, lte: periodEnd },
          status: { in: ['APPROVED', 'PENDING'] },
        },
        select: { date: true, amount: true },
        orderBy: { date: 'asc' },
      });

      const expenseByDate = new Map<string, number>();
      for (const exp of distExpenses) {
        const key = exp.date.toISOString().slice(0, 10);
        expenseByDate.set(key, (expenseByDate.get(key) || 0) + exp.amount);
      }

      if (month) {
        // 月間: 日別
        const dayMap = new Map<string, { schedulePay: number; expensePay: number; descriptions: string[] }>();
        for (const record of distRecords) {
          for (const item of record.items) {
            const dateStr = item.date.toISOString().slice(0, 10);
            const entry = dayMap.get(dateStr) || { schedulePay: 0, expensePay: 0, descriptions: [] };
            entry.schedulePay += item.earnedAmount;
            entry.descriptions.push(`${item.flyerTypeCount}種×¥${item.unitPrice.toFixed(1)} ${item.actualCount}投`);
            dayMap.set(dateStr, entry);
          }
        }
        for (const [dateStr, amount] of expenseByDate) {
          const entry = dayMap.get(dateStr) || { schedulePay: 0, expensePay: 0, descriptions: [] };
          entry.expensePay += amount;
          dayMap.set(dateStr, entry);
        }

        const sortedDates = [...dayMap.keys()].sort();
        for (const dateStr of sortedDates) {
          const entry = dayMap.get(dateStr)!;
          const d = new Date(dateStr + 'T00:00:00');
          totalSchedulePay += entry.schedulePay;
          totalExpensePay += entry.expensePay;
          rows.push({
            label: `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`,
            description: entry.descriptions.join(' / ') || '交通費のみ',
            schedulePay: entry.schedulePay,
            expensePay: entry.expensePay,
            grossPay: entry.schedulePay + entry.expensePay,
          });
        }
      } else {
        // 年間: 月別
        const distMonthMap = new Map<number, { schedulePay: number; expensePay: number; count: number }>();
        for (const record of distRecords) {
          const m = record.periodStart.getMonth() + 1;
          const entry = distMonthMap.get(m) || { schedulePay: 0, expensePay: 0, count: 0 };
          entry.schedulePay += record.schedulePay;
          entry.count++;
          distMonthMap.set(m, entry);
        }
        for (const [dateStr, amount] of expenseByDate) {
          const m = parseInt(dateStr.slice(5, 7));
          const entry = distMonthMap.get(m) || { schedulePay: 0, expensePay: 0, count: 0 };
          entry.expensePay += amount;
          distMonthMap.set(m, entry);
        }
        for (const [m, entry] of distMonthMap) {
          totalSchedulePay += entry.schedulePay;
          totalExpensePay += entry.expensePay;
          const existing = rows.find(r => r.label === `${m}月`);
          if (existing) {
            existing.schedulePay += entry.schedulePay;
            existing.expensePay += entry.expensePay;
            existing.grossPay += entry.schedulePay + entry.expensePay;
            if (existing.description && !existing.description.includes('配布')) {
              existing.description += ` + 配布${entry.count}週分`;
            }
          } else {
            rows.push({
              label: `${m}月`,
              description: `配布${entry.count}週分`,
              schedulePay: entry.schedulePay,
              expensePay: entry.expensePay,
              grossPay: entry.schedulePay + entry.expensePay,
            });
          }
        }
      }
    }

    // 日付順にソート（月間の場合）
    if (month) {
      rows.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      rows.sort((a, b) => (parseInt(a.label) || 99) - (parseInt(b.label) || 99));
    }

    const totalGrossPay = totalSchedulePay + totalExpensePay;

    const statementData: PayrollStatementData = {
      distributorName: empName,
      distributorStaffId: empCode,
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
      ? `支払明細書_${empCode}_${year}年${month}月.pdf`
      : `支払明細書_${empCode}_${year}年度.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('Employee payroll statement error:', err);
    return NextResponse.json({ error: 'PDF生成に失敗しました' }, { status: 500 });
  }
}
