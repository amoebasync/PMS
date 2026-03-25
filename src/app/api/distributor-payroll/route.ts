import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';


// GET /api/distributor-payroll?distributorId=X&year=YYYY&month=MM
// または ?weekStart=YYYY-MM-DD
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const distributorId = searchParams.get('distributorId');
    const weekStart = searchParams.get('weekStart'); // ISO date (Sunday)
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const where: any = {};

    if (distributorId) {
      where.distributorId = parseInt(distributorId);
    }

    if (weekStart) {
      where.periodStart = new Date(weekStart);
    } else if (year && month) {
      const y = parseInt(year);
      const m = parseInt(month);
      where.periodStart = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0),
      };
    }

    const records = await prisma.distributorPayrollRecord.findMany({
      where,
      include: {
        distributor: { select: { id: true, staffId: true, name: true, transportationFee: true, transportationFee1Type: true } },
        items: { orderBy: { date: 'asc' } },
      },
      orderBy: [{ periodStart: 'desc' }, { distributorId: 'asc' }],
    });

    // 各レコードの期間内の経費を日別に取得して付加（キャップ適用）
    const recordsWithExpenses = await Promise.all(
      records.map(async (record) => {
        const expenses = await prisma.distributorExpense.findMany({
          where: {
            distributorId: record.distributorId,
            date: { gte: record.periodStart, lte: record.periodEnd },
            status: { in: ['APPROVED', 'PENDING'] },
          },
          select: { id: true, date: true, amount: true, description: true, status: true },
          orderBy: { date: 'asc' },
        });

        // 交通費キャップ計算
        const feeSetting = record.distributor.transportationFee || '1000';
        const fee1TypeSetting = record.distributor.transportationFee1Type || '500';
        const isFull = feeSetting === 'FULL';
        const personalCap = isFull ? Infinity : parseInt(feeSetting) || 1000;
        const personal1TypeCap = fee1TypeSetting === 'FULL' ? Infinity : parseInt(fee1TypeSetting) || 500;

        // 期間内のスケジュールから日別の種別数を取得
        const schedules = await prisma.distributionSchedule.findMany({
          where: {
            distributorId: record.distributorId,
            date: { gte: record.periodStart, lte: record.periodEnd },
          },
          include: { items: { select: { actualCount: true } } },
        });
        const scheduleFlyerCounts: Record<string, number> = {};
        for (const schedule of schedules) {
          const dateKey = schedule.date!.toISOString().split('T')[0];
          const itemCount = schedule.items.filter(i => i.actualCount !== null && i.actualCount > 0).length;
          scheduleFlyerCounts[dateKey] = Math.max(scheduleFlyerCounts[dateKey] || 0, itemCount);
        }

        // 日別にキャップ適用した金額を返す
        const cappedExpenses = expenses.map(e => {
          const dateKey = e.date.toISOString().split('T')[0];
          if (isFull) return e;
          const flyerCount = scheduleFlyerCounts[dateKey] || 0;
          const dailyCap = flyerCount === 1
            ? Math.min(personalCap, personal1TypeCap)
            : personalCap;
          return { ...e, amount: Math.min(e.amount, dailyCap) };
        });

        return { ...record, expenses: cappedExpenses };
      })
    );

    return NextResponse.json({ records: recordsWithExpenses });
  } catch (error) {
    console.error('Payroll GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// DELETE /api/distributor-payroll?year=YYYY&month=MM
// 指定年月のインポート済みデータを一括削除
export async function DELETE(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'year と month は必須です' }, { status: 400 });
    }

    const y = parseInt(year);
    const m = parseInt(month);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0);

    // 該当期間のレコードを検索
    const records = await prisma.distributorPayrollRecord.findMany({
      where: {
        periodStart: { gte: from, lte: to },
      },
      select: { id: true },
    });

    if (records.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const ids = records.map(r => r.id);

    // 明細行を先に削除してからレコードを削除
    await prisma.$transaction([
      prisma.distributorPayrollItem.deleteMany({ where: { payrollId: { in: ids } } }),
      prisma.distributorPayrollRecord.deleteMany({ where: { id: { in: ids } } }),
    ]);

    return NextResponse.json({ deleted: records.length });
  } catch (error) {
    console.error('Payroll DELETE Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
