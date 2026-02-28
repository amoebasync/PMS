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

    // 最新のGPSポイント
    const latestPoint = await prisma.gpsPoint.findFirst({
      where: { sessionId: distSession.id },
      orderBy: { timestamp: 'desc' },
      select: {
        latitude: true,
        longitude: true,
        timestamp: true,
        steps: true,
        distance: true,
        calories: true,
      },
    });

    // 最新の進捗
    const latestProgress = await prisma.progressEvent.findFirst({
      where: { sessionId: distSession.id },
      orderBy: { timestamp: 'desc' },
      select: { mailboxCount: true, timestamp: true },
    });

    // GPSポイント総数
    const totalPointCount = await prisma.gpsPoint.count({
      where: { sessionId: distSession.id },
    });

    return NextResponse.json({
      sessionId: distSession.id,
      isActive: distSession.finishedAt === null,
      latestPoint: latestPoint
        ? {
            lat: latestPoint.latitude,
            lng: latestPoint.longitude,
            timestamp: latestPoint.timestamp,
          }
        : null,
      latestProgress: latestProgress
        ? { mailboxCount: latestProgress.mailboxCount }
        : null,
      totalPointCount,
      totalSteps: distSession.totalSteps,
      totalDistance: distSession.totalDistance,
      totalCalories: distSession.totalCalories,
    });
  } catch (error) {
    console.error('Trajectory Latest Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
