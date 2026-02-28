import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// GET /api/staff/distribution/earnings?date=YYYY-MM-DD — 当日報酬表示
export async function GET(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const rates: (number | null)[] = [
      null,
      distributor.rate1Type,
      distributor.rate2Type,
      distributor.rate3Type,
      distributor.rate4Type,
      distributor.rate5Type,
      distributor.rate6Type,
    ];

    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        distributorId: distributor.id,
        date: { gte: dayStart, lte: dayEnd },
        status: 'COMPLETED',
      },
      include: { items: true, area: true },
    });

    let totalEarnings = 0;
    const details = [];

    for (const schedule of schedules) {
      const validItems = schedule.items.filter(
        (item) => item.actualCount !== null && item.actualCount > 0
      );
      if (validItems.length === 0) continue;

      const flyerTypeCount = Math.min(validItems.length, 6);
      const baseRate = rates[flyerTypeCount] ?? 0;
      const areaUnitPrice = schedule.areaUnitPrice ?? 0;
      const sizeUnitPrice = schedule.sizeUnitPrice ?? 0;
      const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice;
      const actualCount = Math.max(...validItems.map((i) => i.actualCount ?? 0));
      const earnedAmount = Math.floor(unitPrice * actualCount);

      totalEarnings += earnedAmount;
      details.push({
        scheduleId: schedule.id,
        areaName: schedule.area
          ? `${schedule.area.town_name || ''}${schedule.area.chome_name || ''}`
          : '',
        flyerTypeCount,
        baseRate,
        areaUnitPrice,
        sizeUnitPrice,
        unitPrice,
        actualCount,
        earnedAmount,
      });
    }

    return NextResponse.json({
      date: dateStr || targetDate.toISOString().split('T')[0],
      totalEarnings,
      schedules: details,
    });
  } catch (error) {
    console.error('Earnings Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
