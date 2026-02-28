import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST /api/staff/distribution/gps — GPS座標受信（⚡高頻度・最軽量設計）
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, latitude, longitude, accuracy, timestamp, steps, distance, calories } = body;

    if (!sessionId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'sessionId, latitude, longitude は必須です' }, { status: 400 });
    }

    // セッション所有権チェック（軽量クエリ）
    const session = await prisma.distributionSession.findFirst({
      where: {
        id: sessionId,
        distributorId: distributor.id,
        finishedAt: null,
      },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'アクティブなセッションが見つかりません' }, { status: 404 });
    }

    const deviceTimestamp = timestamp ? new Date(timestamp) : new Date();

    // GPSポイント挿入（トランザクション不要・監査ログ不要）
    await prisma.gpsPoint.create({
      data: {
        sessionId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        timestamp: deviceTimestamp,
        steps: steps ?? null,
        distance: distance ?? null,
        calories: calories ?? null,
      },
    });

    // フィットネスデータがある場合はセッションの総計を更新
    if (steps != null || distance != null || calories != null) {
      const updateData: Record<string, number> = {};
      if (steps != null) updateData.totalSteps = steps;
      if (distance != null) updateData.totalDistance = distance;
      if (calories != null) updateData.totalCalories = calories;

      await prisma.distributionSession.update({
        where: { id: sessionId },
        data: updateData,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('GPS Point Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
