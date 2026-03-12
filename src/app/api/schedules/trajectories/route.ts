import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET /api/schedules/trajectories?date=YYYY-MM-DD&maxPoints=300
// 指定日の全配布員のGPS軌跡を一括取得（サンプリング付き）
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session');
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date パラメータが必要です' }, { status: 400 });
    }

    const maxPoints = parseInt(searchParams.get('maxPoints') || '300');

    // 指定日のスケジュール（セッションあり）を取得
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        date: new Date(date),
        session: { isNot: null },
      },
      include: {
        distributor: { select: { id: true, name: true, staffId: true } },
        area: {
          select: {
            id: true,
            boundary_geojson: true,
            town_name: true,
            chome_name: true,
            prefecture: { select: { name: true } },
            city: { select: { name: true } },
          },
        },
        items: { orderBy: { slotIndex: 'asc' } },
        session: {
          include: {
            progressEvents: { orderBy: { timestamp: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 各スケジュールのGPSポイントをサンプリングして取得
    const distributors = await Promise.all(
      schedules.map(async (schedule) => {
        const sess = schedule.session!;

        // GPSポイント総数を取得
        const totalCount = await prisma.gpsPoint.count({
          where: { sessionId: sess.id },
        });

        let gpsPoints: { lat: number; lng: number; timestamp: Date }[] = [];

        if (totalCount <= maxPoints) {
          // 全ポイント取得
          const points = await prisma.gpsPoint.findMany({
            where: { sessionId: sess.id },
            orderBy: { timestamp: 'asc' },
            select: { latitude: true, longitude: true, timestamp: true },
          });
          gpsPoints = points.map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
            timestamp: p.timestamp,
          }));
        } else {
          // サンプリング: 最初・最後を含む等間隔サンプリング
          const allPoints = await prisma.gpsPoint.findMany({
            where: { sessionId: sess.id },
            orderBy: { timestamp: 'asc' },
            select: { latitude: true, longitude: true, timestamp: true },
          });
          const step = Math.max(1, Math.floor(allPoints.length / maxPoints));
          const sampled: typeof allPoints = [];
          for (let i = 0; i < allPoints.length; i++) {
            if (i === 0 || i === allPoints.length - 1 || i % step === 0) {
              sampled.push(allPoints[i]);
            }
          }
          gpsPoints = sampled.map((p) => ({
            lat: p.latitude,
            lng: p.longitude,
            timestamp: p.timestamp,
          }));
        }

        const lastProgress = sess.progressEvents[sess.progressEvents.length - 1];

        return {
          scheduleId: schedule.id,
          distributorId: schedule.distributor?.id || 0,
          distributorName: schedule.distributor?.name || '',
          distributorStaffId: schedule.distributor?.staffId || '',
          status: schedule.status,
          area: schedule.area
            ? {
                boundaryGeojson: schedule.area.boundary_geojson,
                townName: schedule.area.town_name,
                chomeName: schedule.area.chome_name,
                prefName: schedule.area.prefecture?.name || '',
                cityName: schedule.area.city?.name || '',
              }
            : null,
          session: {
            id: sess.id,
            startedAt: sess.startedAt,
            finishedAt: sess.finishedAt,
            totalDistance: sess.totalDistance,
            totalSteps: sess.totalSteps,
          },
          gpsPoints,
          progressEvents: sess.progressEvents.map((e) => ({
            mailboxCount: e.mailboxCount,
            lat: e.latitude,
            lng: e.longitude,
            timestamp: e.timestamp,
          })),
          lastMailboxCount: lastProgress?.mailboxCount || 0,
          items: schedule.items
            .filter((item) => item.flyerName)
            .map((item) => ({
              flyerName: item.flyerName,
              plannedCount: item.plannedCount,
              actualCount: item.actualCount,
            })),
        };
      })
    );

    return NextResponse.json({ distributors });
  } catch (error) {
    console.error('Trajectories Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
