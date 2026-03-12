import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

type DailyEarning = {
  date: string; // ISO date
  amount: number;
};

type WeekData = {
  periodStart: string; // ISO date (Sunday)
  periodEnd: string;   // ISO date (Saturday)
  dailyEarnings: DailyEarning[];
  schedulePay: number;
  expensePay: number;
  grossPay: number;
  deductions: Record<string, number>;
};

type ImportRecord = {
  staffId: string;
  weeks: WeekData[];
};

// POST /api/distributor-payroll/import
export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { records } = (await request.json()) as { records: ImportRecord[] };
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'records は必須です' }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { staffId: string; week?: string; message: string }[] = [];

    for (const rec of records) {
      // staffId で配布員を検索
      const distributor = await prisma.flyerDistributor.findFirst({
        where: { staffId: rec.staffId },
        select: { id: true },
      });

      if (!distributor) {
        skipped += rec.weeks.length;
        errors.push({ staffId: rec.staffId, message: '配布員が見つかりません' });
        continue;
      }

      for (const week of rec.weeks) {
        try {
          const periodStart = new Date(week.periodStart);
          periodStart.setHours(0, 0, 0, 0);
          const periodEnd = new Date(week.periodEnd);
          periodEnd.setHours(0, 0, 0, 0);

          // paymentDate = periodEnd + 6日（翌週金曜）
          const paymentDate = new Date(periodEnd);
          paymentDate.setDate(paymentDate.getDate() + 6);

          // 控除情報を note に JSON で保存
          const noteObj = Object.keys(week.deductions).length > 0 ? week.deductions : null;
          const note = noteObj ? JSON.stringify(noteObj) : null;

          await prisma.$transaction(async (tx) => {
            // 既存レコード確認
            const existing = await tx.distributorPayrollRecord.findUnique({
              where: {
                distributorId_periodStart: {
                  distributorId: distributor.id,
                  periodStart,
                },
              },
            });

            let payrollRecord;
            if (existing) {
              // 既存の明細行を削除して再生成
              await tx.distributorPayrollItem.deleteMany({ where: { payrollId: existing.id } });
              payrollRecord = await tx.distributorPayrollRecord.update({
                where: { id: existing.id },
                data: {
                  periodEnd,
                  paymentDate,
                  schedulePay: week.schedulePay,
                  expensePay: week.expensePay,
                  grossPay: week.grossPay,
                  status: 'DRAFT',
                  note,
                },
              });
              updated++;
            } else {
              payrollRecord = await tx.distributorPayrollRecord.create({
                data: {
                  distributorId: distributor.id,
                  periodStart,
                  periodEnd,
                  paymentDate,
                  schedulePay: week.schedulePay,
                  expensePay: week.expensePay,
                  grossPay: week.grossPay,
                  status: 'DRAFT',
                  note,
                },
              });
              imported++;
            }

            // 日別明細行を作成
            const items = week.dailyEarnings
              .filter((d) => d.amount !== 0)
              .map((d) => ({
                payrollId: payrollRecord.id,
                date: new Date(d.date),
                scheduleId: null,
                flyerTypeCount: 0,
                baseRate: 0,
                areaUnitPrice: 0,
                sizeUnitPrice: 0,
                unitPrice: 0,
                actualCount: 0,
                earnedAmount: d.amount,
              }));

            if (items.length > 0) {
              await tx.distributorPayrollItem.createMany({ data: items });
            }
          });
        } catch (err: any) {
          errors.push({
            staffId: rec.staffId,
            week: week.periodStart,
            message: err.message || 'インポートエラー',
          });
        }
      }
    }

    return NextResponse.json({ imported, updated, skipped, errors });
  } catch (error) {
    console.error('Payroll Import Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
