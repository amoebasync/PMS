import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '一時保存',
  PLANNING: '提案中',
  PENDING_PAYMENT: '入金待ち',
  PENDING_SUBMISSION: '入稿待ち',
  PENDING_REVIEW: '審査待ち',
  ADJUSTING: '調整中',
  CONFIRMED: '受注確定',
  IN_PROGRESS: '作業中',
  COMPLETED: '完了',
  CANCELED: 'キャンセル',
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const customerId = contact.customerId;

    // 配布対象の発注のみ取得（CONFIRMED / IN_PROGRESS / COMPLETED）
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      include: {
        distributions: {
          select: { plannedCount: true, flyer: { select: { name: true } } },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    // 各発注のDistributionItemを一括取得
    const orderIds = orders.map((o) => o.id);
    const distItems = await prisma.distributionItem.findMany({
      where: {
        customerId,
        orderId: { in: orderIds },
        plannedCount: { gt: 1 },
      },
      select: {
        orderId: true,
        actualCount: true,
        scheduleId: true,
      },
    });

    // orderId → 実績集計
    const actualMap: Record<number, { actual: number; scheduleIds: Set<number>; lastDate: Date | null }> = {};
    for (const item of distItems) {
      if (!item.orderId) continue;
      if (!actualMap[item.orderId]) {
        actualMap[item.orderId] = { actual: 0, scheduleIds: new Set(), lastDate: null };
      }
      actualMap[item.orderId].actual += item.actualCount ?? 0;
      actualMap[item.orderId].scheduleIds.add(item.scheduleId);
    }

    // スケジュールの最終配布日を取得
    const allScheduleIds = [...new Set(distItems.map((i) => i.scheduleId))];
    let scheduleDateMap: Record<number, Date | null> = {};
    if (allScheduleIds.length > 0) {
      const schedules = await prisma.distributionSchedule.findMany({
        where: { id: { in: allScheduleIds } },
        select: { id: true, date: true },
      });
      scheduleDateMap = Object.fromEntries(schedules.map((s) => [s.id, s.date]));
    }

    // 各orderの最終配布日を算出
    for (const orderId of Object.keys(actualMap)) {
      const entry = actualMap[parseInt(orderId)];
      for (const sid of entry.scheduleIds) {
        const d = scheduleDateMap[sid];
        if (d && (!entry.lastDate || d > entry.lastDate)) {
          entry.lastDate = d;
        }
      }
    }

    // エリア数を取得するためにareaIdを集計
    const areaCountMap: Record<number, Set<number>> = {};
    const distItemsWithArea = await prisma.distributionItem.findMany({
      where: {
        customerId,
        orderId: { in: orderIds },
        plannedCount: { gt: 1 },
      },
      select: {
        orderId: true,
        schedule: { select: { areaId: true } },
      },
    });
    for (const item of distItemsWithArea) {
      if (!item.orderId || !item.schedule.areaId) continue;
      if (!areaCountMap[item.orderId]) areaCountMap[item.orderId] = new Set();
      areaCountMap[item.orderId].add(item.schedule.areaId);
    }

    let totalPlanned = 0;
    let totalActual = 0;

    const result = orders.map((order) => {
      const planned = order.distributions.reduce((sum, d) => sum + (d.plannedCount ?? 0), 0);
      const data = actualMap[order.id];
      const actual = data?.actual ?? 0;
      const rate = planned > 0 ? Math.min(100, Math.round((actual / planned) * 1000) / 10) : 0;

      totalPlanned += planned;
      totalActual += actual;

      const flyerNames = order.distributions
        .map((d) => d.flyer?.name)
        .filter(Boolean)
        .join('、');

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        title: order.title ?? flyerNames ?? '（名称なし）',
        orderDate: order.orderDate,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status] ?? order.status,
        totalPlanned: planned,
        totalActual: actual,
        distributionRate: rate,
        areaCount: areaCountMap[order.id]?.size ?? 0,
        lastDistributed: data?.lastDate ?? null,
      };
    });

    const avgRate = totalPlanned > 0
      ? Math.min(100, Math.round((totalActual / totalPlanned) * 1000) / 10)
      : 0;

    return NextResponse.json({
      kpi: {
        totalOrders: orders.length,
        totalPlanned,
        totalActual,
        avgDistributionRate: avgRate,
      },
      orders: result,
    });
  } catch (error) {
    console.error('Portal Reports Orders Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
