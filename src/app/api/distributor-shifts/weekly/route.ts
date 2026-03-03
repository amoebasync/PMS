import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const branchId = searchParams.get('branchId');

    // 開始日（デフォルト: 今日）
    const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00.000Z') : new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    // 7日間の日付配列
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);

    // 有効な配布員を取得（退社日がないか、まだ退社していない）
    const distributorWhere: any = {
      OR: [
        { leaveDate: null },
        { leaveDate: { gt: new Date() } },
      ],
    };
    if (branchId) {
      distributorWhere.branchId = parseInt(branchId);
    }

    const distributors = await prisma.flyerDistributor.findMany({
      where: distributorWhere,
      select: {
        id: true,
        name: true,
        staffId: true,
        branch: { select: { id: true, nameJa: true } },
      },
      orderBy: [{ branch: { nameJa: 'asc' } }, { name: 'asc' }],
    });

    const distributorIds = distributors.map(d => d.id);

    // 期間内のシフト（WORKINGのみ）
    const shiftsInRange = await prisma.distributorShift.findMany({
      where: {
        distributorId: { in: distributorIds },
        status: 'WORKING',
        date: { gte: startDate, lt: endDate },
      },
      select: { id: true, distributorId: true, date: true, note: true },
    });

    // 各配布員の開始日より前のWORKING出勤回数
    const priorCounts = await prisma.distributorShift.groupBy({
      by: ['distributorId'],
      where: {
        distributorId: { in: distributorIds },
        status: 'WORKING',
        date: { lt: startDate },
      },
      _count: { id: true },
    });

    const priorCountMap: Record<number, number> = {};
    for (const pc of priorCounts) {
      priorCountMap[pc.distributorId] = pc._count.id;
    }

    // シフトを配布員ID×日付でマッピング
    const shiftMap: Record<number, Record<string, { id: number; note: string | null }>> = {};
    for (const s of shiftsInRange) {
      const dateKey = s.date.toISOString().split('T')[0];
      if (!shiftMap[s.distributorId]) shiftMap[s.distributorId] = {};
      shiftMap[s.distributorId][dateKey] = { id: s.id, note: s.note };
    }

    // レスポンス構築
    const result = distributors.map(d => {
      let runningCount = priorCountMap[d.id] || 0;
      const shifts: Record<string, { id: number; count: number; note: string | null } | null> = {};

      for (const dateKey of dates) {
        const shift = shiftMap[d.id]?.[dateKey];
        if (shift) {
          runningCount++;
          shifts[dateKey] = { id: shift.id, count: runningCount, note: shift.note };
        } else {
          shifts[dateKey] = null;
        }
      }

      return {
        id: d.id,
        name: d.name,
        staffId: d.staffId,
        branch: d.branch,
        shifts,
      };
    });

    return NextResponse.json({ dates, distributors: result });
  } catch (error) {
    console.error('DistributorShift Weekly Error:', error);
    return NextResponse.json({ error: '週間シフトの取得に失敗しました' }, { status: 500 });
  }
}
