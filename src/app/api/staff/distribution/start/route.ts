import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { notificationEmitter } from '@/lib/notification-emitter';

// POST /api/staff/distribution/start — 配布セッション開始
// scheduleId は任意 — なければスケジュール未紐付けの孤児セッションを作成
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { scheduleId, latitude, longitude, timestamp } = body;

    const deviceTimestamp = timestamp ? new Date(timestamp) : new Date();
    const hasValidCoords = latitude && longitude && !(latitude === 0 && longitude === 0);

    // ── scheduleId がある場合: 従来のスケジュール紐付きセッション ──
    if (scheduleId) {
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
        const existingSession = await prisma.distributionSession.findUnique({
          where: { scheduleId },
        });
        if (existingSession) {
          const lastProgress = await prisma.progressEvent.findFirst({
            where: { sessionId: existingSession.id },
            orderBy: { mailboxCount: 'desc' },
            select: { mailboxCount: true },
          });
          return NextResponse.json({
            sessionId: existingSession.id,
            alreadyStarted: true,
            currentMailboxCount: lastProgress?.mailboxCount ?? 0,
          });
        }
      }

      if (schedule.status === 'COMPLETED') {
        return NextResponse.json({ error: 'このスケジュールは既に完了しています' }, { status: 400 });
      }

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

        if (hasValidCoords) {
          await tx.gpsPoint.create({
            data: {
              sessionId: newSession.id,
              latitude,
              longitude,
              timestamp: deviceTimestamp,
            },
          });
        }

        return newSession;
      });

      // 通知作成
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
        notificationEmitter.emit({ type: 'DISTRIBUTION_START' });
      } catch (e) {
        console.error('通知作成エラー:', e);
      }

      return NextResponse.json({ sessionId: session.id });
    }

    // ── scheduleId なし: 孤児セッション作成 ──
    // 同じ配布員の未終了孤児セッションがあればそれを返す
    const existingOrphan = await prisma.distributionSession.findFirst({
      where: {
        distributorId: distributor.id,
        scheduleId: null,
        finishedAt: null,
      },
    });
    if (existingOrphan) {
      return NextResponse.json({
        sessionId: existingOrphan.id,
        alreadyStarted: true,
        currentMailboxCount: 0,
      });
    }

    const session = await prisma.distributionSession.create({
      data: {
        distributorId: distributor.id,
        startedAt: deviceTimestamp,
        // scheduleId は null（孤児セッション）
      },
    });

    if (hasValidCoords) {
      await prisma.gpsPoint.create({
        data: {
          sessionId: session.id,
          latitude,
          longitude,
          timestamp: deviceTimestamp,
        },
      });
    }

    // 通知
    try {
      await prisma.adminNotification.create({
        data: {
          type: 'DISTRIBUTION_START',
          title: `${distributor.name}さんが配布を開始しました`,
          message: 'スケジュール未紐付け',
          distributorId: distributor.id,
        },
      });
      notificationEmitter.emit({ type: 'DISTRIBUTION_START' });
    } catch (e) {
      console.error('通知作成エラー:', e);
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Distribution Start Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
