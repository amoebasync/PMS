import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';


export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const expenses = await prisma.distributorExpense.findMany({
      where: { distributorId: distributor.id },
      orderBy: { date: 'desc' },
      take: 50,
    });

    // カレンダー用: 直近2ヶ月のスケジュール日と請求済み日
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const [scheduleDates, expenseDates] = await Promise.all([
      prisma.distributionSchedule.findMany({
        where: { distributorId: distributor.id, date: { gte: twoMonthsAgo }, status: { not: 'CANCELLED' } },
        select: { date: true },
      }),
      prisma.distributorExpense.findMany({
        where: { distributorId: distributor.id, date: { gte: twoMonthsAgo } },
        select: { date: true, status: true },
      }),
    ]);

    const scheduleSet = [...new Set(scheduleDates.map(s => s.date?.toISOString().split('T')[0]).filter(Boolean))];
    const expenseMap: Record<string, string> = {};
    for (const e of expenseDates) {
      const d = e.date?.toISOString().split('T')[0];
      if (d) expenseMap[d] = e.status;
    }

    return NextResponse.json({ expenses, calendarData: { scheduleDates: scheduleSet, expenseMap } });
  } catch (error) {
    console.error('Distributor Expenses GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { date, amount, description } = await request.json();

    if (!date || !amount || !description) {
      return NextResponse.json({ error: '日付・金額・内容をすべて入力してください' }, { status: 400 });
    }

    const amt = parseInt(amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: '金額は1円以上の整数を入力してください' }, { status: 400 });
    }

    const expense = await prisma.distributorExpense.create({
      data: {
        distributorId: distributor.id,
        date: new Date(date),
        amount: amt,
        description,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error('Distributor Expenses POST Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
