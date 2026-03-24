import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET /api/schedules/[id]/trajectory — 軌跡ビューア用データ取得
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

    // スケジュール + セッション + 関連データを一括取得
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        distributor: { select: { id: true, name: true, staffId: true } },
        area: true,
        items: { orderBy: { slotIndex: 'asc' } },
        session: {
          include: {
            gpsPoints: { orderBy: { timestamp: 'asc' } },
            progressEvents: { orderBy: { timestamp: 'asc' } },
            skipEvents: {
              orderBy: { timestamp: 'asc' },
              include: {
                prohibitedProperty: {
                  select: { id: true, address: true, buildingName: true },
                },
              },
            },
            pauseEvents: { orderBy: { pausedAt: 'asc' } },
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }

    if (!schedule.session) {
      return NextResponse.json({ error: '配布セッションがまだ開始されていません' }, { status: 404 });
    }

    // エリア内の禁止物件（PMS DBのみ）
    let prohibitedProperties: any[] = [];
    if (schedule.areaId) {
      const dbProps = await prisma.prohibitedProperty.findMany({
        where: {
          areaId: schedule.areaId,
          isActive: true,
        },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          address: true,
          buildingName: true,
          roomNumber: true,
          residentName: true,
          reasonDetail: true,
          severity: true,
          boundaryGeojson: true,
          prohibitedReason: { select: { name: true } },
        },
      });
      prohibitedProperties = dbProps.map(p => ({
        ...p,
        reasonName: p.prohibitedReason?.name || null,
        prohibitedReason: undefined,
      }));
    }

    const sess = schedule.session;

    return NextResponse.json({
      session: {
        id: sess.id,
        startedAt: sess.startedAt,
        finishedAt: sess.finishedAt,
        totalSteps: sess.totalSteps,
        totalDistance: sess.totalDistance,
        totalCalories: sess.totalCalories,
        incompleteReason: sess.incompleteReason,
        incompleteNote: sess.incompleteNote,
      },
      gpsPoints: sess.gpsPoints.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        accuracy: p.accuracy,
        timestamp: p.timestamp,
        steps: p.steps,
        distance: p.distance,
        calories: p.calories,
      })),
      progressEvents: sess.progressEvents.map((e) => ({
        id: e.id,
        mailboxCount: e.mailboxCount,
        lat: e.latitude,
        lng: e.longitude,
        timestamp: e.timestamp,
      })),
      skipEvents: sess.skipEvents.map((e) => ({
        id: e.id,
        lat: e.latitude,
        lng: e.longitude,
        prohibitedPropertyId: e.prohibitedPropertyId,
        prohibitedProperty: e.prohibitedProperty,
        reason: e.reason,
        timestamp: e.timestamp,
      })),
      pauseEvents: sess.pauseEvents.map((e) => ({
        id: e.id,
        pausedAt: e.pausedAt,
        resumedAt: e.resumedAt,
      })),
      area: schedule.area
        ? {
            boundaryGeojson: schedule.area.boundary_geojson,
            townName: schedule.area.town_name,
            chomeName: schedule.area.chome_name,
          }
        : null,
      prohibitedProperties,
      schedule: {
        id: schedule.id,
        date: schedule.date,
        status: schedule.status,
        distributorName: schedule.distributor?.name || '',
        distributorStaffId: schedule.distributor?.staffId || '',
        items: schedule.items.map((item) => ({
          id: item.id,
          flyerName: item.flyerName,
          plannedCount: item.plannedCount,
          actualCount: item.actualCount,
        })),
        checkGps: schedule.checkGps,
        checkGpsResult: schedule.checkGpsResult,
        checkGpsComment: schedule.checkGpsComment,
      },
    });
  } catch (error) {
    console.error('Trajectory Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
