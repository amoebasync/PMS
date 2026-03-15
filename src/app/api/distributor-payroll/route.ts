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
        distributor: { select: { id: true, staffId: true, name: true } },
        items: { orderBy: { date: 'asc' } },
      },
      orderBy: [{ periodStart: 'desc' }, { distributorId: 'asc' }],
    });

    // 各レコードの期間内の経費を日別に取得して付加
    const recordsWithExpenses = await Promise.all(
      records.map(async (record) => {
        const expenses = await prisma.distributorExpense.findMany({
          where: {
            distributorId: record.distributorId,
            date: { gte: record.periodStart, lte: record.periodEnd },
            status: { in: ['APPROVED', 'PENDING'] },
          },
          select: { date: true, amount: true, description: true, status: true },
          orderBy: { date: 'asc' },
        });
        return { ...record, expenses };
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
