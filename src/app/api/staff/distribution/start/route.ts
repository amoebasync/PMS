import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST /api/staff/distribution/start — 配布セッション開始
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { scheduleId, latitude, longitude, timestamp } = body;

    if (!scheduleId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'scheduleId, latitude, longitude は必須です' }, { status: 400 });
    }

    // スケジュールの所有権・状態チェック
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      include: { items: true, area: true, distributor: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }

    if (schedule.distributorId !== distributor.id) {
      return NextResponse.json({ error: 'このスケジュールの担当者ではありません' }, { status: 403 });
    }

    if (schedule.status === 'DISTRIBUTING') {
      // 既にセッション開始済み → 既存セッションを返す
      const existingSession = await prisma.distributionSession.findUnique({
        where: { scheduleId },
      });
      if (existingSession) {
        return NextResponse.json({ sessionId: existingSession.id, alreadyStarted: true });
      }
    }

    if (schedule.status === 'COMPLETED') {
      return NextResponse.json({ error: 'このスケジュールは既に完了しています' }, { status: 400 });
    }

    const deviceTimestamp = timestamp ? new Date(timestamp) : new Date();

    // トランザクション: セッション作成 + スケジュールステータス更新 + 初回GPS
    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.distributionSession.create({
        data: {
          scheduleId,
          distributorId: distributor.id,
          startedAt: deviceTimestamp,
        },
      });

      await tx.distributionSchedule.update({
        where: { id: scheduleId },
        data: { status: 'DISTRIBUTING' },
      });

      // 初回GPSポイント
      await tx.gpsPoint.create({
        data: {
          sessionId: newSession.id,
          latitude,
          longitude,
          timestamp: deviceTimestamp,
        },
      });

      return newSession;
    });

    // 通知作成（トランザクション外 — 通知失敗でメイン処理を止めない）
    const areaName = schedule.area
      ? `${schedule.area.town_name || ''}${schedule.area.chome_name || ''}`
      : '';
    const flyerCount = schedule.items.length;

    try {
      await prisma.adminNotification.create({
        data: {
          type: 'DISTRIBUTION_START',
          title: `${distributor.name}さんが配布を開始しました`,
          message: areaName ? `${areaName} / チラシ${flyerCount}種` : `チラシ${flyerCount}種`,
          scheduleId,
          distributorId: distributor.id,
        },
      });
    } catch (e) {
      console.error('通知作成エラー:', e);
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Distribution Start Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
