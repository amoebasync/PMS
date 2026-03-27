import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET /api/schedules/[id]/trajectory/past-area
// 同エリアの過去の配布GPS軌跡を取得（比較用）
// Query params:
//   limit: 取得する過去セッション数（デフォルト: 3, 最大: 5）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session');
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { id } = await params;
    const scheduleId = parseInt(id);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: '不正なスケジュールID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '3'), 5);

    // 現在のスケジュール情報を取得
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, areaId: true, date: true, distributorId: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }

    if (!schedule.areaId) {
      return NextResponse.json({ error: 'エリアが設定されていません' }, { status: 400 });
    }

    // 同エリアの過去の完了済みスケジュール（GPSデータ付き）を取得
    // まずGPSポイントが存在するセッションを持つスケジュールを検索
    const pastSchedules = await prisma.distributionSchedule.findMany({
      where: {
        areaId: schedule.areaId,
        id: { not: scheduleId },
        date: { lt: schedule.date },
        session: {
          gpsPoints: { some: {} },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        id: true,
        date: true,
        status: true,
        distributor: { select: { id: true, name: true, staffId: true } },
        session: {
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            totalDistance: true,
            gpsPoints: {
              orderBy: { timestamp: 'asc' },
              select: { latitude: true, longitude: true, timestamp: true },
            },
          },
        },
      },
    });

    const results = pastSchedules
      .filter(ps => ps.session && ps.session.gpsPoints.length > 0)
      .map(ps => ({
        scheduleId: ps.id,
        date: ps.date,
        status: ps.status,
        distributorName: ps.distributor?.name || '-',
        distributorStaffId: ps.distributor?.staffId || '-',
        totalDistance: ps.session?.totalDistance || 0,
        startedAt: ps.session?.startedAt || null,
        finishedAt: ps.session?.finishedAt || null,
        gpsPointCount: ps.session?.gpsPoints.length || 0,
        gpsPoints: (ps.session?.gpsPoints || []).map(p => ({
          lat: p.latitude,
          lng: p.longitude,
          timestamp: p.timestamp.toISOString(),
        })),
      }));

    return NextResponse.json({
      areaId: schedule.areaId,
      currentScheduleId: scheduleId,
      pastTrajectories: results,
    });
  } catch (error) {
    console.error('Past area trajectory error:', error);
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 });
  }
}
