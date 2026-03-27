import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

/** Posting System から GPS データを取得 */
async function fetchPsGps(staffId: string, dateStr: string): Promise<{ lat: number; lng: number; timestamp: string }[]> {
  if (!PS_API_URL) return [];
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (PS_API_KEY) headers['X-API-Key'] = PS_API_KEY;
    const res = await fetch(`${PS_API_URL}/GetStaffGPS.php`, {
      method: 'POST',
      headers,
      body: new URLSearchParams({ STAFF_ID: staffId, TARGET_DATE: dateStr }).toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const parsed = JSON.parse(await res.text());
    const rows: any[] = Array.isArray(parsed) ? parsed : (parsed.data || []);
    return rows
      .filter((r: any) => parseFloat(r.LATITUDE || '0') !== 0 && parseFloat(r.LONGITUDE || '0') !== 0)
      .map((r: any) => {
        const terminalTime = (r.TERMINAL_TIME || '').trim();
        const ts = terminalTime ? `${dateStr}T${terminalTime}+09:00` : new Date().toISOString();
        return { lat: parseFloat(r.LATITUDE), lng: parseFloat(r.LONGITUDE), timestamp: new Date(ts).toISOString() };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch {
    return [];
  }
}

// GET /api/schedules/[id]/trajectory/past-area
// 同エリアの過去の配布GPS軌跡を取得（比較用）
// PMS GPS → なければ Posting System から取得
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

    // 同エリアの過去のスケジュールを取得（セッション有無問わず）
    const pastSchedules = await prisma.distributionSchedule.findMany({
      where: {
        areaId: schedule.areaId,
        id: { not: scheduleId },
        date: { lt: schedule.date },
        distributorId: { not: null },
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

    // PMS GPS がなければ Posting System から取得
    const results = [];
    for (const ps of pastSchedules) {
      const pmsGps = ps.session?.gpsPoints || [];
      let gpsPoints: { lat: number; lng: number; timestamp: string }[];
      let source: 'pms' | 'ps';

      if (pmsGps.length > 0) {
        gpsPoints = pmsGps.map(p => ({
          lat: p.latitude,
          lng: p.longitude,
          timestamp: p.timestamp.toISOString(),
        }));
        source = 'pms';
      } else {
        // Posting System フォールバック
        const staffId = ps.distributor?.staffId;
        if (!staffId) continue;
        const dateStr = new Date(ps.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
        gpsPoints = await fetchPsGps(staffId, dateStr);
        source = 'ps';
        if (gpsPoints.length === 0) continue; // GPS データがどこにもない場合はスキップ
      }

      // 距離計算
      let totalDistance = ps.session?.totalDistance || 0;
      if (totalDistance === 0 && gpsPoints.length > 1) {
        for (let i = 1; i < gpsPoints.length; i++) {
          const R = 6371000;
          const dLat = ((gpsPoints[i].lat - gpsPoints[i - 1].lat) * Math.PI) / 180;
          const dLng = ((gpsPoints[i].lng - gpsPoints[i - 1].lng) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((gpsPoints[i - 1].lat * Math.PI) / 180) * Math.cos((gpsPoints[i].lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
      }

      results.push({
        scheduleId: ps.id,
        date: ps.date,
        status: ps.status,
        source,
        distributorName: ps.distributor?.name || '-',
        distributorStaffId: ps.distributor?.staffId || '-',
        totalDistance,
        startedAt: ps.session?.startedAt || (gpsPoints.length > 0 ? gpsPoints[0].timestamp : null),
        finishedAt: ps.session?.finishedAt || (gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1].timestamp : null),
        gpsPointCount: gpsPoints.length,
        gpsPoints,
      });
    }

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
