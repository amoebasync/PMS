import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

/**
 * Posting System から GPS データを取得して PMS セッションに保存する
 * セッションにGPSポイントがない場合のみ実行（PS Fallback → PMS 取り込み）
 */
async function importPsGpsToSession(sessionId: number, staffId: string, scheduleDate: Date): Promise<number> {
  if (!PS_API_URL) return 0;

  const targetDate = scheduleDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (PS_API_KEY) headers['X-API-Key'] = PS_API_KEY;

  try {
    const psRes = await fetch(`${PS_API_URL}/GetStaffGPS.php`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ STAFF_ID: staffId, TARGET_DATE: targetDate }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!psRes.ok) return 0;

    const psBody = await psRes.text();
    const parsed = JSON.parse(psBody);
    const rows: any[] = Array.isArray(parsed) ? parsed : (parsed.data || []);

    const gpsPoints = rows
      .filter((r: any) => {
        const lat = parseFloat(r.LATITUDE || '0');
        const lng = parseFloat(r.LONGITUDE || '0');
        return lat !== 0 && lng !== 0;
      })
      .map((r: any) => {
        const terminalTime = (r.TERMINAL_TIME || '').trim();
        const isoTimestamp = terminalTime
          ? `${targetDate}T${terminalTime}+09:00`
          : new Date().toISOString();
        return {
          sessionId,
          latitude: parseFloat(r.LATITUDE),
          longitude: parseFloat(r.LONGITUDE),
          timestamp: new Date(isoTimestamp),
        };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (gpsPoints.length === 0) return 0;

    // 一括挿入
    await prisma.gpsPoint.createMany({ data: gpsPoints });

    // セッションの totalDistance を GPS から概算更新
    let totalDistance = 0;
    for (let i = 1; i < gpsPoints.length; i++) {
      totalDistance += haversine(
        gpsPoints[i - 1].latitude, gpsPoints[i - 1].longitude,
        gpsPoints[i].latitude, gpsPoints[i].longitude,
      );
    }
    if (totalDistance > 0) {
      await prisma.distributionSession.update({
        where: { id: sessionId },
        data: { totalDistance },
      });
    }

    return gpsPoints.length;
  } catch (e) {
    console.error('PS GPS import error:', e);
    return 0;
  }
}

/** Haversine distance in meters */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

    let sess = schedule.session;

    // GPSポイントが0件の場合、Posting System から取り込みを試行
    if (sess.gpsPoints.length === 0 && schedule.distributor?.staffId) {
      const imported = await importPsGpsToSession(
        sess.id,
        schedule.distributor.staffId,
        schedule.date,
      );
      if (imported > 0) {
        // 取り込んだデータを再取得
        const updatedSession = await prisma.distributionSession.findUnique({
          where: { id: sess.id },
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
        });
        if (updatedSession) sess = updatedSession;
      }
    }

    // エリア内の禁止物件（PMS DBのみ、顧客コードでフィルタ）
    let prohibitedProperties: any[] = [];
    if (schedule.areaId) {
      // スケジュールのチラシに紐づく外部顧客コードを収集
      const itemCustomerCodes = [...new Set(
        schedule.items
          .map(i => i.externalCustomerCode)
          .filter((c): c is string => !!c && c.trim() !== '')
      )];

      const dbProps = await prisma.prohibitedProperty.findMany({
        where: {
          areaId: schedule.areaId,
          isActive: true,
          // 全顧客禁止（externalCustomerCode = null/空）OR このスケジュールの顧客に該当
          OR: [
            { externalCustomerCode: null },
            { externalCustomerCode: '' },
            ...(itemCustomerCodes.length > 0 ? [{ externalCustomerCode: { in: itemCustomerCodes } }] : []),
          ],
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
