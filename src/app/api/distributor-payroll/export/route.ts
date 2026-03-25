import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import ExcelJS from 'exceljs';

/**
 * GET /api/distributor-payroll/export?weekStart=YYYY-MM-DD
 * 指定週の給与データをExcelファイルとしてダウンロード
 * エクセルフォーマット: スタッフコード順に横並び、日別報酬+交通費+合計
 */
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const weekStartStr = searchParams.get('weekStart');
    if (!weekStartStr) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 });
    }

    const periodStart = new Date(weekStartStr);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);

    // Fetch all payroll records for this week
    const records = await prisma.distributorPayrollRecord.findMany({
      where: { periodStart },
      include: {
        distributor: { select: { id: true, staffId: true, name: true, rate1Type: true, rate2Type: true, rate3Type: true, rate4Type: true, rate5Type: true, rate6Type: true, transportationFee: true, transportationFee1Type: true, ratePlan: true } },
        items: { orderBy: { date: 'asc' } },
      },
    });

    // Filter to records with grossPay > 0, sorted by staffId
    const sorted = records
      .filter(r => r.grossPay > 0)
      .sort((a, b) => a.distributor.staffId.localeCompare(b.distributor.staffId));

    // Fetch expenses per distributor for this period
    const expensesByDist = new Map<number, { date: string; amount: number }[]>();
    if (sorted.length > 0) {
      const distIds = sorted.map(r => r.distributor.id);
      const expenses = await prisma.distributorExpense.findMany({
        where: {
          distributorId: { in: distIds },
          date: { gte: periodStart, lte: periodEnd },
          status: { in: ['APPROVED', 'PENDING'] },
        },
        select: { distributorId: true, date: true, amount: true },
      });
      for (const e of expenses) {
        const dateKey = e.date.toISOString().split('T')[0];
        if (!expensesByDist.has(e.distributorId)) expensesByDist.set(e.distributorId, []);
        expensesByDist.get(e.distributorId)!.push({ date: dateKey, amount: e.amount });
      }
    }

    // Build week days
    const weekDays: string[] = [];
    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(periodStart);
      d.setDate(d.getDate() + i);
      weekDays.push(d.toISOString().split('T')[0]);
    }

    const formatDate = (ds: string) => {
      const d = new Date(ds);
      return `${d.getMonth() + 1}/${d.getDate()}（${dayLabels[d.getDay()]}）`;
    };

    // Week label
    const wsDate = new Date(weekStartStr);
    const weDate = new Date(wsDate);
    weDate.setDate(weDate.getDate() + 6);
    const weekLabel = `${wsDate.getMonth() + 1}/${wsDate.getDate()}（${dayLabels[wsDate.getDay()]}）〜 ${weDate.getMonth() + 1}/${weDate.getDate()}（${dayLabels[weDate.getDay()]}）`;

    // ========== Generate Excel ==========
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('給与データ');

    const dataStartCol = 2; // Column B
    const staffCount = sorted.length;

    // Helper: column letter
    const colNum = (idx: number) => dataStartCol + idx; // 0-based staff index → 1-based col

    // ── Styles ──
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    const labelFont: Partial<ExcelJS.Font> = { bold: true, size: 9 };
    const dataFont: Partial<ExcelJS.Font> = { size: 9 };
    const subtotalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    const totalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // Column A width
    ws.getColumn(1).width = 16;

    let row = 1;

    // ── Title ──
    ws.getCell(row, 1).value = '配布員給与';
    ws.getCell(row, 1).font = { bold: true, size: 14 };
    ws.getCell(row, 2).value = weekLabel;
    ws.getCell(row, 2).font = { size: 11, color: { argb: 'FF6B7280' } };
    row += 2;

    // ── Row: スタッフコード ──
    const codeRow = row;
    ws.getCell(row, 1).value = 'スタッフコード';
    ws.getCell(row, 1).font = labelFont;
    for (let i = 0; i < staffCount; i++) {
      const cell = ws.getCell(row, colNum(i));
      cell.value = sorted[i].distributor.staffId;
      cell.font = { bold: true, size: 9 };
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      ws.getColumn(colNum(i)).width = 14;
    }
    row++;

    // ── Row: 名前 ──
    ws.getCell(row, 1).value = '名前';
    ws.getCell(row, 1).font = labelFont;
    for (let i = 0; i < staffCount; i++) {
      const cell = ws.getCell(row, colNum(i));
      cell.value = sorted[i].distributor.name;
      cell.font = { bold: true, size: 9 };
      cell.border = thinBorder;
    }
    row++;

    // ── Row: レートプラン ──
    ws.getCell(row, 1).value = 'レートプラン';
    ws.getCell(row, 1).font = labelFont;
    for (let i = 0; i < staffCount; i++) {
      ws.getCell(row, colNum(i)).value = sorted[i].distributor.ratePlan || '';
      ws.getCell(row, colNum(i)).font = dataFont;
      ws.getCell(row, colNum(i)).border = thinBorder;
    }
    row++;

    // ── Rows: Rate 1-6 ──
    const rateLabels = ['1種', '2種', '3種', '4種', '5種', '6種'];
    const rateKeys = ['rate1Type', 'rate2Type', 'rate3Type', 'rate4Type', 'rate5Type', 'rate6Type'] as const;
    for (let r = 0; r < 6; r++) {
      ws.getCell(row, 1).value = rateLabels[r];
      ws.getCell(row, 1).font = labelFont;
      for (let i = 0; i < staffCount; i++) {
        const val = sorted[i].distributor[rateKeys[r]];
        const cell = ws.getCell(row, colNum(i));
        cell.value = val != null ? val : '';
        cell.font = dataFont;
        cell.numFmt = '0.00';
        cell.border = thinBorder;
      }
      row++;
    }

    // ── Row: 交通費上限 ──
    ws.getCell(row, 1).value = '交通費上限';
    ws.getCell(row, 1).font = labelFont;
    for (let i = 0; i < staffCount; i++) {
      const fee = sorted[i].distributor.transportationFee;
      ws.getCell(row, colNum(i)).value = fee === 'FULL' ? '全額支給' : fee ? `${fee}円まで` : '';
      ws.getCell(row, colNum(i)).font = dataFont;
      ws.getCell(row, colNum(i)).border = thinBorder;
    }
    row++;

    // ── Row: ステータス ──
    ws.getCell(row, 1).value = 'ステータス';
    ws.getCell(row, 1).font = labelFont;
    const statusLabels: Record<string, string> = { DRAFT: '下書き', CONFIRMED: '確定済', PAID: '支払済' };
    for (let i = 0; i < staffCount; i++) {
      ws.getCell(row, colNum(i)).value = statusLabels[sorted[i].status] || sorted[i].status;
      ws.getCell(row, colNum(i)).font = dataFont;
      ws.getCell(row, colNum(i)).border = thinBorder;
    }
    row += 2;

    // ── Daily rows ──
    const dailyStartRow = row;
    for (let d = 0; d < 7; d++) {
      const dateStr = weekDays[d];
      const dateLabel = formatDate(dateStr);
      ws.getCell(row, 1).value = dateLabel;
      const dayOfWeek = new Date(dateStr).getDay();
      ws.getCell(row, 1).font = {
        bold: true, size: 9,
        color: { argb: dayOfWeek === 0 ? 'FFDC2626' : dayOfWeek === 6 ? 'FF2563EB' : 'FF374151' },
      };

      for (let i = 0; i < staffCount; i++) {
        const record = sorted[i];
        const dayEarned = record.items
          .filter(it => it.date.toISOString().split('T')[0] === dateStr)
          .reduce((s, it) => s + it.earnedAmount, 0);
        const cell = ws.getCell(row, colNum(i));
        cell.value = dayEarned || '';
        cell.font = dataFont;
        cell.numFmt = '#,##0';
        cell.border = thinBorder;
        if (dayEarned > 0) {
          cell.font = { size: 9, color: { argb: 'FF4338CA' } };
        }
      }
      row++;
    }

    // ── 配布報酬 小計 ──
    ws.getCell(row, 1).value = '配布報酬 小計';
    ws.getCell(row, 1).font = { bold: true, size: 9 };
    for (let i = 0; i < staffCount; i++) {
      const cell = ws.getCell(row, colNum(i));
      cell.value = sorted[i].schedulePay;
      cell.font = { bold: true, size: 9, color: { argb: 'FF4338CA' } };
      cell.numFmt = '#,##0';
      cell.fill = subtotalFill;
      cell.border = thinBorder;
    }
    row++;

    // ── 交通費 ──
    ws.getCell(row, 1).value = '交通費（経費）';
    ws.getCell(row, 1).font = { bold: true, size: 9 };
    for (let i = 0; i < staffCount; i++) {
      const cell = ws.getCell(row, colNum(i));
      cell.value = sorted[i].expensePay;
      cell.font = { bold: true, size: 9, color: { argb: 'FF059669' } };
      cell.numFmt = '#,##0';
      cell.fill = subtotalFill;
      cell.border = thinBorder;
    }
    row++;

    // ── Blank rows for manual entries (罰金, 備品代, etc.) ──
    const deductionLabels = ['罰金', '備品代', '前借', '振込手数料', '寮費', '調整金'];
    for (const label of deductionLabels) {
      ws.getCell(row, 1).value = label;
      ws.getCell(row, 1).font = { size: 9, color: { argb: 'FF9CA3AF' } };
      for (let i = 0; i < staffCount; i++) {
        ws.getCell(row, colNum(i)).border = thinBorder;
        ws.getCell(row, colNum(i)).numFmt = '#,##0';
      }
      row++;
    }

    // ── 合計 ──
    ws.getCell(row, 1).value = '合計';
    ws.getCell(row, 1).font = { bold: true, size: 10 };
    for (let i = 0; i < staffCount; i++) {
      const cell = ws.getCell(row, colNum(i));
      cell.value = sorted[i].grossPay;
      cell.font = { bold: true, size: 10 };
      cell.numFmt = '#,##0';
      cell.fill = totalFill;
      cell.border = thinBorder;
    }
    row++;

    // ── Freeze panes: freeze column A and header rows ──
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: dailyStartRow - 1 }];

    // Generate buffer
    const buffer = await wb.xlsx.writeBuffer();

    // Return as downloadable file
    const fileName = `給与_${weekStartStr}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err) {
    console.error('Payroll Export Error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
