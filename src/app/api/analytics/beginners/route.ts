import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * GET /api/analytics/beginners?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 新人分析: 期間中に加入した配布員の配布履歴
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  // 期間中に加入した配布員を取得
  const distributors = await prisma.flyerDistributor.findMany({
    where: {
      joinDate: {
        gte: new Date(`${from}T00:00:00+09:00`),
        lte: new Date(`${to}T23:59:59+09:00`),
      },
    },
    select: {
      id: true,
      staffId: true,
      name: true,
      joinDate: true,
      leaveDate: true,
      branchId: true,
      branch: { select: { nameJa: true } },
    },
    orderBy: { joinDate: 'asc' },
  });

  if (distributors.length === 0) {
    return NextResponse.json({ distributors: [], stats: { total: 0, active: 0, left: 0, avgAttendance: 0, retentionRate: 0 } });
  }

  const distributorIds = distributors.map(d => d.id);

  // 全スケジュールを取得（配布員ごとに日付順）
  const schedules = await prisma.distributionSchedule.findMany({
    where: {
      distributorId: { in: distributorIds },
      status: 'COMPLETED',
    },
    select: {
      id: true,
      distributorId: true,
      date: true,
      areaId: true,
      area: {
        select: {
          chome_name: true,
          town_name: true,
          prefecture: { select: { name: true } },
          city: { select: { name: true } },
        },
      },
      items: {
        select: { plannedCount: true },
        orderBy: { slotIndex: 'asc' },
      },
    },
    orderBy: [{ distributorId: 'asc' }, { date: 'asc' }],
  });

  // 配布員ごとに「回目」を計算（同日の複数スケジュールは1回としてカウント）
  const schedulesByDistributor = new Map<number, typeof schedules>();
  for (const s of schedules) {
    if (!s.distributorId) continue;
    const list = schedulesByDistributor.get(s.distributorId) || [];
    list.push(s);
    schedulesByDistributor.set(s.distributorId, list);
  }

  const result = distributors.map(d => {
    const distSchedules = schedulesByDistributor.get(d.id) || [];

    // 日付ごとにグループ化して「回目」を計算
    const dateGrouped = new Map<string, typeof distSchedules>();
    for (const s of distSchedules) {
      if (!s.date) continue;
      const dateStr = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      const list = dateGrouped.get(dateStr) || [];
      list.push(s);
      dateGrouped.set(dateStr, list);
    }

    // 日付順にソートして回目を割り当て
    const sortedDates = [...dateGrouped.keys()].sort();
    const attendances = sortedDates.map((dateStr, idx) => {
      const daySchedules = dateGrouped.get(dateStr)!;

      // その日のスケジュールごとに種類数とメイン枚数を計算し、平均を取る
      const perSchedule = daySchedules.map(s => ({
        types: s.items.length,
        maxCount: s.items.reduce((max, item) => Math.max(max, item.plannedCount || 0), 0),
      }));
      const itemCount = Math.round(perSchedule.reduce((s, p) => s + p.types, 0) / perSchedule.length);
      const maxPlanned = Math.round(perSchedule.reduce((s, p) => s + p.maxCount, 0) / perSchedule.length);

      // エリア名（最初のスケジュールのエリア）
      const firstSchedule = daySchedules[0];
      const area = firstSchedule.area;
      const areaName = area
        ? `${area.city?.name || ''}${area.chome_name || area.town_name}`
        : '-';

      return {
        round: idx + 1,
        date: dateStr,
        types: itemCount,
        mainCount: maxPlanned,
        areaName,
      };
    });

    const isActive = !d.leaveDate;

    return {
      id: d.id,
      staffId: d.staffId,
      name: d.name,
      joinDate: d.joinDate,
      branch: d.branch?.nameJa || '-',
      isActive,
      attendanceCount: sortedDates.length,
      attendances,
    };
  });

  const total = result.length;
  const active = result.filter(r => r.isActive).length;
  const avgAttendance = total > 0 ? result.reduce((s, r) => s + r.attendanceCount, 0) / total : 0;

  return NextResponse.json({
    distributors: result,
    stats: {
      total,
      active,
      left: total - active,
      avgAttendance: Math.round(avgAttendance * 100) / 100,
      retentionRate: total > 0 ? Math.round((active / total) * 10000) / 100 : 0,
    },
  });
}
