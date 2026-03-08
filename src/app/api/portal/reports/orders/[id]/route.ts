import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const customerId = contact.customerId;
    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    // 自社発注かチェック
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        distributions: {
          select: { plannedCount: true, flyer: { select: { name: true } } },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // DistributionItems（エリア・日付情報付き）
    const distItems = await prisma.distributionItem.findMany({
      where: {
        customerId,
        orderId,
        plannedCount: { gt: 1 },
      },
      select: {
        plannedCount: true,
        actualCount: true,
        schedule: {
          select: {
            date: true,
            areaId: true,
            area: {
              select: {
                id: true,
                chome_name: true,
                town_name: true,
                prefecture: { select: { name: true } },
                city: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // エリア別集計
    const areaMap: Record<number, {
      areaId: number;
      areaName: string;
      plannedCount: number;
      actualCount: number;
      schedulesCount: number;
      lastDistributed: Date | null;
      scheduleIds: Set<number>;
    }> = {};

    // 日別集計
    const dailyMap: Record<string, number> = {};

    const totalPlanned = order.distributions.reduce((sum, d) => sum + (d.plannedCount ?? 0), 0);
    let totalActual = 0;

    for (const item of distItems) {
      const areaId = item.schedule.areaId;
      const area = item.schedule.area;
      const actual = item.actualCount ?? 0;
      const planned = item.plannedCount ?? 0;

      totalActual += actual;

      if (areaId && area) {
        if (!areaMap[areaId]) {
          const areaName = `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`;
          areaMap[areaId] = {
            areaId,
            areaName,
            plannedCount: 0,
            actualCount: 0,
            schedulesCount: 0,
            lastDistributed: null,
            scheduleIds: new Set(),
          };
        }
        areaMap[areaId].plannedCount += planned;
        areaMap[areaId].actualCount += actual;
        areaMap[areaId].schedulesCount++;
        if (item.schedule.date) {
          const d = item.schedule.date;
          if (!areaMap[areaId].lastDistributed || d > areaMap[areaId].lastDistributed!) {
            areaMap[areaId].lastDistributed = d;
          }
        }
      }

      // 日別集計
      if (item.schedule.date && actual > 0) {
        const dateStr = item.schedule.date.toISOString().split('T')[0];
        dailyMap[dateStr] = (dailyMap[dateStr] ?? 0) + actual;
      }
    }

    const rate = totalPlanned > 0
      ? Math.min(100, Math.round((totalActual / totalPlanned) * 1000) / 10)
      : 0;

    const flyerNames = order.distributions
      .map((d) => d.flyer?.name)
      .filter(Boolean)
      .join('、');

    const areaBreakdown = Object.values(areaMap)
      .map(({ scheduleIds, ...a }) => ({
        ...a,
        distributionRate: a.plannedCount > 0
          ? Math.min(100, Math.round((a.actualCount / a.plannedCount) * 1000) / 10)
          : 0,
      }))
      .sort((a, b) => b.actualCount - a.actualCount);

    const dailyProgress = Object.entries(dailyMap)
      .map(([date, actualCount]) => ({ date, actualCount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      order: {
        orderId: order.id,
        orderNo: order.orderNo,
        title: order.title ?? flyerNames ?? '（名称なし）',
        orderDate: order.orderDate,
        totalPlanned,
        totalActual,
        distributionRate: rate,
      },
      areaBreakdown,
      dailyProgress,
    });
  } catch (error) {
    console.error('Portal Reports Order Detail Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
