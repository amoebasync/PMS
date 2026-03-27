import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { fetchAreaHistory, fetchStaffGps } from '@/lib/posting-system';

/** Haversine distance (meters) */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** GPS点列から総距離を算出 */
function calcTotalDistance(points: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return d;
}

// GET /api/schedules/[id]/trajectory/past-area
// 同エリアの過去の配布GPS軌跡を取得（比較用）
// ステップ:
//   1. PMS の同エリア過去スケジュールを検索（GPS付き）
//   2. Posting System の GetAreaHistory で同エリア過去配布を検索
//   3. 両方をマージし、日付の重複を除去して返す
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10);

    // 現在のスケジュール + エリア情報を取得
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true, areaId: true, date: true, distributorId: true,
        area: { select: { address_code: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }
    if (!schedule.areaId) {
      return NextResponse.json({ error: 'エリアが設定されていません' }, { status: 400 });
    }

    const currentDateStr = new Date(schedule.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });

    // ─── 1. PMS: 同エリア過去スケジュール（GPSデータ付き） ───
    const pmsSchedules = await prisma.distributionSchedule.findMany({
      where: {
        areaId: schedule.areaId,
        id: { not: scheduleId },
        date: { lt: schedule.date },
        distributorId: { not: null },
        session: { gpsPoints: { some: {} } },
      },
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        id: true, date: true, status: true,
        distributor: { select: { id: true, name: true, staffId: true } },
        session: {
          select: {
            id: true, startedAt: true, finishedAt: true, totalDistance: true,
            gpsPoints: {
              orderBy: { timestamp: 'asc' },
              select: { latitude: true, longitude: true, timestamp: true },
            },
          },
        },
      },
    });

    // PMS結果をマップ（dateStr → result）
    const resultMap = new Map<string, any>();

    for (const ps of pmsSchedules) {
      const gps = ps.session!.gpsPoints;
      const dateStr = new Date(ps.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      resultMap.set(dateStr, {
        scheduleId: ps.id,
        date: ps.date,
        status: ps.status,
        source: 'pms',
        distributorName: ps.distributor?.name || '-',
        distributorStaffId: ps.distributor?.staffId || '-',
        totalDistance: ps.session?.totalDistance || calcTotalDistance(gps.map(p => ({ lat: p.latitude, lng: p.longitude }))),
        startedAt: ps.session?.startedAt,
        finishedAt: ps.session?.finishedAt,
        gpsPointCount: gps.length,
        gpsPoints: gps.map(p => ({ lat: p.latitude, lng: p.longitude, timestamp: p.timestamp.toISOString() })),
      });
    }

    // ─── 2. PS: GetAreaHistory で同エリア過去配布を検索 ───
    const addressCode = schedule.area?.address_code;
    if (addressCode) {
      try {
        const psHistory = await fetchAreaHistory(addressCode, 20);
        // PMS に既にある日付と、当日を除外して、GPS取得
        const psOnlyRecords = psHistory.filter(h =>
          h.conditionDate !== currentDateStr && !resultMap.has(h.conditionDate)
        );

        // GPS取得は直列で最大 limit 件まで
        let psCount = 0;
        for (const rec of psOnlyRecords) {
          if (resultMap.size >= limit) break;
          if (psCount >= limit) break;
          const gps = await fetchStaffGps(rec.manageCode, rec.conditionDate, { maxPoints: 5000 });
          if (gps.length === 0) continue;
          resultMap.set(rec.conditionDate, {
            scheduleId: null,
            date: `${rec.conditionDate}T00:00:00+09:00`,
            status: 'COMPLETED',
            source: 'ps',
            distributorName: rec.staffName || '-',
            distributorStaffId: rec.manageCode || '-',
            totalDistance: calcTotalDistance(gps),
            startedAt: gps[0].timestamp,
            finishedAt: gps[gps.length - 1].timestamp,
            gpsPointCount: gps.length,
            gpsPoints: gps,
          });
          psCount++;
        }
      } catch (e) {
        console.error('PS area history fetch error:', e);
      }
    }

    // ─── 3. マージして日付降順でソート ───
    const results = [...resultMap.values()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

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
