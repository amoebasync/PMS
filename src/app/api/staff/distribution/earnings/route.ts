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

    const areaUnitPrice = schedule.areaUnitPrice ?? 0;
    const sizeUnitPrice = schedule.sizeUnitPrice ?? 0;

    // ティア制計算
    const counts = validItems.map((i: any) => i.actualCount ?? 0).sort((a: number, b: number) => a - b);
    let earnedAmount = 0;
    let prev = 0;
    for (let ci = 0; ci < counts.length; ci++) {
      const band = counts[ci] - prev;
      if (band > 0) {
        const typesInBand = Math.min(counts.length - ci, 6);
        const tierRate = rates[typesInBand] ?? 0;
        earnedAmount += band * (tierRate + areaUnitPrice + sizeUnitPrice);
      }
      prev = counts[ci];
    }
    earnedAmount = Math.floor(earnedAmount);

    const flyerTypeCount = Math.min(validItems.length, 6);
    const baseRate = rates[flyerTypeCount] ?? 0;
    const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice;
    const actualCount = Math.max(...counts);

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

      // 交通費（承認済み経費）
      let expensePay = 0;
      try {
        const expenses = await prisma.distributorExpense.findMany({
          where: {
            distributorId: distributor.id,
            date: { gte: weekStart, lte: weekEnd },
            status: { in: ['APPROVED', 'PENDING'] },
          },
          select: { date: true, totalAmount: true },
        });

        const feeSetting = distributor.transportationFee || '1000';
        const fee1TypeSetting = (distributor as any).transportationFee1Type || '500';
        const isFull = feeSetting === 'FULL';
        const personalCap = isFull ? Infinity : parseInt(feeSetting) || 1000;
        const personal1TypeCap = fee1TypeSetting === 'FULL' ? Infinity : parseInt(fee1TypeSetting) || 500;

        // 日別スケジュール種別数
        const dayFlyerCounts: Record<string, number> = {};
        for (const s of schedules) {
          const dateKey = s.date.toISOString().split('T')[0];
          const count = s.items.filter((i: any) => i.actualCount && i.actualCount > 0).length;
          dayFlyerCounts[dateKey] = Math.max(dayFlyerCounts[dateKey] || 0, count);
        }

        for (const exp of expenses) {
          const dateKey = exp.date.toISOString().split('T')[0];
          const flyerCount = dayFlyerCounts[dateKey] || 0;
          const dailyCap = flyerCount <= 1 ? personal1TypeCap : personalCap;
          expensePay += Math.min(exp.totalAmount, dailyCap);
        }
      } catch { /* ignore expense errors */ }

      // 研修手当
      let trainingPay = 0;
      if (distributor.joinDate) {
        const joinDateStr = new Date(distributor.joinDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        const startStr = weekStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        const endStr = weekEnd.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        if (joinDateStr >= startStr && joinDateStr <= endStr) {
          trainingPay = parseInt(distributor.trainingAllowance || '1000') || 1000;
        }
      }

      const grossEarnings = totalEarnings + expensePay + trainingPay;

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
        totalEarnings: grossEarnings,
        schedulePay: totalEarnings,
        expensePay,
        trainingPay,
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
