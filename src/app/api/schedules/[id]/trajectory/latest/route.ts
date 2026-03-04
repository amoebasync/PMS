import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET /api/schedules/[id]/trajectory/latest — リアルタイム最新座標
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

    const distSession = await prisma.distributionSession.findUnique({
      where: { scheduleId },
      select: {
        id: true,
        finishedAt: true,
        totalSteps: true,
        totalDistance: true,
        totalCalories: true,
      },
    });

    if (!distSession) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    // 最新GPS座標・最新進捗・GPS総数を1クエリで取得
    const [result] = await prisma.$queryRaw<Array<{
      lat: number | null;
      lng: number | null;
      gps_timestamp: Date | null;
      mailbox_count: number | null;
      progress_timestamp: Date | null;
      total_points: bigint;
    }>>`
      SELECT
        gp.latitude AS lat,
        gp.longitude AS lng,
        gp.timestamp AS gps_timestamp,
        pe.mailbox_count,
        pe.timestamp AS progress_timestamp,
        COALESCE(cnt.total, 0) AS total_points
      FROM (SELECT 1) AS dummy
      LEFT JOIN (
        SELECT latitude, longitude, timestamp
        FROM gps_points
        WHERE session_id = ${distSession.id}
        ORDER BY timestamp DESC
        LIMIT 1
      ) gp ON 1=1
      LEFT JOIN (
        SELECT mailbox_count, timestamp
        FROM progress_events
        WHERE session_id = ${distSession.id}
        ORDER BY timestamp DESC
        LIMIT 1
      ) pe ON 1=1
      LEFT JOIN (
        SELECT COUNT(*) AS total
        FROM gps_points
        WHERE session_id = ${distSession.id}
      ) cnt ON 1=1
    `;

    return NextResponse.json({
      sessionId: distSession.id,
      isActive: distSession.finishedAt === null,
      latestPoint: result.lat != null
        ? {
            lat: Number(result.lat),
            lng: Number(result.lng),
            timestamp: result.gps_timestamp,
          }
        : null,
      latestProgress: result.mailbox_count != null
        ? { mailboxCount: Number(result.mailbox_count) }
        : null,
      totalPointCount: Number(result.total_points),
      totalSteps: distSession.totalSteps,
      totalDistance: distSession.totalDistance,
      totalCalories: distSession.totalCalories,
    });
  } catch (error) {
    console.error('Trajectory Latest Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
