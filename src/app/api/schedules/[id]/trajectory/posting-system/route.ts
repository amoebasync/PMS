import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

// GET /api/schedules/[id]/trajectory/posting-system
// Posting System から GPS データを取得するフォールバック API
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

    // スケジュール + 配布員 + エリア情報を取得
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        distributor: { select: { id: true, name: true, staffId: true } },
        area: true,
        items: { orderBy: { slotIndex: 'asc' } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }

    const staffId = schedule.distributor?.staffId;
    if (!staffId) {
      return NextResponse.json({ error: '配布員のスタッフIDが設定されていません' }, { status: 400 });
    }

    // スケジュールの日付を YYYY-MM-DD 形式に
    const scheduleDate = new Date(schedule.date);
    const targetDate = scheduleDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }); // YYYY-MM-DD

    if (!PS_API_URL) {
      return NextResponse.json({ error: 'POSTING_SYSTEM_API_URL が設定されていません' }, { status: 500 });
    }

    // Posting System API を呼び出し
    const psUrl = `${PS_API_URL}/GetStaffGPS.php`;
    const body = new URLSearchParams({
      STAFF_ID: staffId,
      TARGET_DATE: targetDate,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (PS_API_KEY) {
      headers['X-API-Key'] = PS_API_KEY;
    }

    const psRes = await fetch(psUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!psRes.ok) {
      return NextResponse.json(
        { error: `Posting System API エラー: ${psRes.status}` },
        { status: 502 }
      );
    }

    const psBody = await psRes.text();
    let rows: any[] = [];
    try {
      const parsed = JSON.parse(psBody);
      rows = Array.isArray(parsed) ? parsed : (parsed.data || []);
    } catch {
      return NextResponse.json({ error: 'Posting System レスポンスの解析に失敗しました' }, { status: 502 });
    }

    // GPS ポイントを PMS の TrajectoryViewer が期待する形式に変換
    // TERMINAL_TIME: "HH:MM:SS" 形式（時刻のみ）→ targetDate と結合して ISO 8601 (JST)
    const gpsPoints = rows
      .filter((r: any) => {
        const lat = parseFloat(r.LATITUDE || '0');
        const lng = parseFloat(r.LONGITUDE || '0');
        return lat !== 0 && lng !== 0;
      })
      .map((r: any) => {
        const terminalTime = (r.TERMINAL_TIME || '').trim();
        // "07:30:09" → "2026-03-22T07:30:09+09:00"
        const isoTimestamp = terminalTime
          ? `${targetDate}T${terminalTime}+09:00`
          : new Date().toISOString();

        return {
          latitude: parseFloat(r.LATITUDE),
          longitude: parseFloat(r.LONGITUDE),
          timestamp: isoTimestamp,
        };
      })
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // サンプリング（1000ポイント以上の場合は間引く）
    let sampledPoints = gpsPoints;
    if (gpsPoints.length > 1000) {
      const step = Math.ceil(gpsPoints.length / 1000);
      sampledPoints = gpsPoints.filter((_: any, i: number) => i % step === 0 || i === gpsPoints.length - 1);
    }

    return NextResponse.json({
      source: 'posting-system',
      gpsPoints: sampledPoints.map((p: any) => ({
        lat: p.latitude,
        lng: p.longitude,
        accuracy: null,
        timestamp: p.timestamp,
        steps: null,
        distance: null,
        calories: null,
      })),
      area: schedule.area
        ? {
            boundaryGeojson: schedule.area.boundary_geojson,
            townName: schedule.area.town_name,
            chomeName: schedule.area.chome_name,
          }
        : null,
      prohibitedProperties: [],
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
      },
    });
  } catch (error) {
    console.error('Posting System Trajectory Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
