import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';


// GET /api/staff/schedules?year=YYYY&month=MM
// スタッフ自身のスケジュール一覧を取得（配布アイテム含む）
export async function GET(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        distributorId: distributor.id,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        items: {
          orderBy: { slotIndex: 'asc' },
        },
        area: true,
        city: true,
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Staff Schedules GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
