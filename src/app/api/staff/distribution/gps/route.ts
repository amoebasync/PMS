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
    const { sessionId, latitude, longitude, accuracy, timestamp, steps, distance, calories, needsItems } = body;

    if (!sessionId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'sessionId, latitude, longitude は必須です' }, { status: 400 });
    }

    // セッション所有権チェック（scheduleId も取得して紐付け検知）
    const session = await prisma.distributionSession.findFirst({
      where: {
        id: sessionId,
        distributorId: distributor.id,
        finishedAt: null,
      },
      select: { id: true, scheduleId: true },
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

    // アプリがitemsを要求 & スケジュール紐付け済みの場合のみitemsを返す
    // （孤立セッションが手動紐付けされた場合にアプリ側でpmsItemIdを更新するため）
    if (needsItems && session.scheduleId) {
      const items = await prisma.distributionItem.findMany({
        where: { scheduleId: session.scheduleId },
        select: { id: true, slotIndex: true, flyerName: true, flyerCode: true, plannedCount: true, customerId: true },
        orderBy: { slotIndex: 'asc' },
      });
      return NextResponse.json({ ok: true, scheduleId: session.scheduleId, items });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('GPS Point Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
