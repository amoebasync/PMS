import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// Helper: compute earnings for a set of schedules
function computeEarnings(
  schedules: any[],
  rates: (number | null)[]
) {
  let totalEarnings = 0;
  const details = [];

  for (const schedule of schedules) {
    const validItems = schedule.items.filter(
      (item: any) => item.actualCount !== null && item.actualCount > 0
    );
    if (validItems.length === 0) continue;

    const flyerTypeCount = Math.min(validItems.length, 6);
    const baseRate = rates[flyerTypeCount] ?? 0;
    const areaUnitPrice = schedule.areaUnitPrice ?? 0;
    const sizeUnitPrice = schedule.sizeUnitPrice ?? 0;
    const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice;
    const actualCount = Math.max(...validItems.map((i: any) => i.actualCount ?? 0));
    const earnedAmount = Math.floor(unitPrice * actualCount);

    totalEarnings += earnedAmount;
    details.push({
      scheduleId: schedule.id,
      date: schedule.date.toISOString().split('T')[0],
      areaName: schedule.area
        ? (schedule.area.chome_name || schedule.area.town_name || '')
        : '',
      areaNameEn: schedule.area?.name_en || '',
      prefectureName: schedule.area?.prefecture?.name || '',
      prefectureNameEn: schedule.area?.prefecture?.name_en || '',
      cityName: schedule.area?.city?.name || '',
      cityNameEn: schedule.area?.city?.name_en || '',
      flyerTypeCount,
      baseRate,
      areaUnitPrice,
      sizeUnitPrice,
      unitPrice,
      actualCount,
      earnedAmount,
    });
  }

  return { totalEarnings, details };
}

// GET /api/staff/distribution/earnings?date=YYYY-MM-DD&mode=daily|weekly
export async function GET(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const mode = searchParams.get('mode') || 'daily';

    const targetDate = dateStr ? new Date(dateStr) : new Date();

    const rates: (number | null)[] = [
      null,
      distributor.rate1Type,
      distributor.rate2Type,
      distributor.rate3Type,
      distributor.rate4Type,
      distributor.rate5Type,
      distributor.rate6Type,
    ];

    if (mode === 'weekly') {
      // Find Sunday of the week containing targetDate
      const dayOfWeek = targetDate.getDay(); // 0=Sunday
      const weekStart = new Date(targetDate);
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const schedules = await prisma.distributionSchedule.findMany({
        where: {
          distributorId: distributor.id,
          date: { gte: weekStart, lte: weekEnd },
          status: 'COMPLETED',
        },
        include: { items: true, area: { include: { prefecture: true, city: true } } },
        orderBy: { date: 'asc' },
      });

      const { totalEarnings, details } = computeEarnings(schedules, rates);

      // Group by date
      const dayMap: Record<string, { totalEarnings: number; schedules: any[] }> = {};
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + d);
        const key = day.toISOString().split('T')[0];
        dayMap[key] = { totalEarnings: 0, schedules: [] };
      }

      for (const detail of details) {
        const key = detail.date;
        if (dayMap[key]) {
          dayMap[key].totalEarnings += detail.earnedAmount;
          dayMap[key].schedules.push(detail);
        }
      }

      const days = Object.entries(dayMap).map(([date, data]) => ({
        date,
        dayOfWeek: new Date(date + 'T00:00:00').getDay(),
        totalEarnings: data.totalEarnings,
        schedules: data.schedules,
      }));

      return NextResponse.json({
        mode: 'weekly',
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        totalEarnings,
        days,
      });
    }

    // Daily mode (default)
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        distributorId: distributor.id,
        date: { gte: dayStart, lte: dayEnd },
        status: 'COMPLETED',
      },
      include: { items: true, area: { include: { prefecture: true, city: true } } },
    });

    const { totalEarnings, details } = computeEarnings(schedules, rates);

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
