import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST /api/staff/distribution/finish — 配布終了
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const {
      sessionId,
      items,
      incompleteReason,
      incompleteNote,
      totalSteps,
      totalDistance,
      totalCalories,
      timestamp,
    } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId は必須です' }, { status: 400 });
    }

    // セッション所有権チェック
    const session = await prisma.distributionSession.findFirst({
      where: {
        id: sessionId,
        distributorId: distributor.id,
        finishedAt: null,
      },
      include: {
        schedule: {
          include: {
            items: true,
            area: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'アクティブなセッションが見つかりません' }, { status: 404 });
    }

    const deviceTimestamp = timestamp ? new Date(timestamp) : new Date();

    // トランザクション: セッション終了 + 実績枚数更新 + スケジュールステータス更新
    await prisma.$transaction(async (tx) => {
      // 1. 各チラシの実績枚数を更新
      if (Array.isArray(items) && session.schedule) {
        for (const item of items) {
          if (!item.itemId || item.actualCount == null) continue;
          // itemId が本スケジュールに属するか検証
          const scheduleItem = session.schedule.items.find((si) => si.id === item.itemId);
          if (scheduleItem) {
            await tx.distributionItem.update({
              where: { id: item.itemId },
              data: { actualCount: item.actualCount },
            });
          }
        }
      }

      // 2. セッション終了
      await tx.distributionSession.update({
        where: { id: sessionId },
        data: {
          finishedAt: deviceTimestamp,
          totalSteps: totalSteps ?? session.totalSteps,
          totalDistance: totalDistance ?? session.totalDistance,
          totalCalories: totalCalories ?? session.totalCalories,
          incompleteReason: incompleteReason || null,
          incompleteNote: incompleteNote || null,
        },
      });

      // 3. スケジュールステータスを COMPLETED に（スケジュールが存在する場合のみ）
      if (session.scheduleId) {
        await tx.distributionSchedule.update({
          where: { id: session.scheduleId },
          data: { status: 'COMPLETED' },
        });
      }
    });

    // 通知作成（トランザクション外）
    const areaName = session.schedule?.area
      ? `${session.schedule.area.town_name || ''}${session.schedule.area.chome_name || ''}`
      : '';

    // 実績枚数サマリ
    const totalActual = Array.isArray(items)
      ? Math.max(...items.map((i: { actualCount?: number }) => i.actualCount ?? 0), 0)
      : 0;

    const reasonText = incompleteReason
      ? ` (${incompleteReason === 'AREA_DONE' ? 'エリア終了' : incompleteReason === 'GIVE_UP' ? 'ギブアップ' : 'その他'})`
      : '';

    try {
      await prisma.adminNotification.create({
        data: {
          type: 'DISTRIBUTION_FINISH',
          title: `${distributor.name}さんが配布を完了しました`,
          message: `${areaName} / ${totalActual.toLocaleString()}ポスト${reasonText}`,
          scheduleId: session.scheduleId || undefined,
          distributorId: distributor.id,
        },
      });
    } catch (e) {
      console.error('通知作成エラー:', e);
    }

    // 報酬計算
    const earnings = await calculateDailyEarnings(distributor.id, session.schedule?.date || new Date());

    return NextResponse.json({ ok: true, earnings });
  } catch (error) {
    console.error('Distribution Finish Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// 当日報酬計算（distributor-payroll/generate と同じロジック）
async function calculateDailyEarnings(distributorId: number, date: Date) {
  const distributor = await prisma.flyerDistributor.findUnique({
    where: { id: distributorId },
  });
  if (!distributor) return null;

  const rates: (number | null)[] = [
    null,
    distributor.rate1Type,
    distributor.rate2Type,
    distributor.rate3Type,
    distributor.rate4Type,
    distributor.rate5Type,
    distributor.rate6Type,
  ];

  // 当日のスケジュール
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const schedules = await prisma.distributionSchedule.findMany({
    where: {
      distributorId,
      date: { gte: dayStart, lte: dayEnd },
      status: 'COMPLETED',
    },
    include: { items: true, area: true },
  });

  let totalEarnings = 0;
  const details = [];

  for (const schedule of schedules) {
    const validItems = schedule.items.filter(
      (item) => item.actualCount !== null && item.actualCount > 0
    );
    if (validItems.length === 0) continue;

    const flyerTypeCount = Math.min(validItems.length, 6);
    const baseRate = rates[flyerTypeCount] ?? 0;
    const areaUnitPrice = schedule.areaUnitPrice ?? 0;
    const sizeUnitPrice = schedule.sizeUnitPrice ?? 0;
    const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice;
    const actualCount = Math.max(...validItems.map((i) => i.actualCount ?? 0));
    const earnedAmount = Math.floor(unitPrice * actualCount);

    totalEarnings += earnedAmount;
    details.push({
      scheduleId: schedule.id,
      areaName: schedule.area
        ? (schedule.area.chome_name || schedule.area.town_name || '')
        : '',
      areaNameEn: schedule.area?.name_en || '',
      flyerTypeCount,
      unitPrice,
      actualCount,
      earnedAmount,
    });
  }

  return { totalEarnings, details };
}
