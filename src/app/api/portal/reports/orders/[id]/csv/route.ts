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
      select: { id: true, orderNo: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // DistributionItems取得
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
      areaName: string;
      plannedCount: number;
      actualCount: number;
      lastDistributed: Date | null;
    }> = {};

    for (const item of distItems) {
      const areaId = item.schedule.areaId;
      const area = item.schedule.area;
      if (!areaId || !area) continue;

      if (!areaMap[areaId]) {
        const areaName = `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`;
        areaMap[areaId] = {
          areaName,
          plannedCount: 0,
          actualCount: 0,
          lastDistributed: null,
        };
      }
      areaMap[areaId].plannedCount += item.plannedCount ?? 0;
      areaMap[areaId].actualCount += item.actualCount ?? 0;
      if (item.schedule.date) {
        const d = item.schedule.date;
        if (!areaMap[areaId].lastDistributed || d > areaMap[areaId].lastDistributed!) {
          areaMap[areaId].lastDistributed = d;
        }
      }
    }

    // CSV生成（BOM付き）
    const BOM = '\uFEFF';
    const header = 'エリア名,予定枚数,実績枚数,配布率(%),最終配布日';
    const rows = Object.values(areaMap)
      .sort((a, b) => b.actualCount - a.actualCount)
      .map((a) => {
        const rate = a.plannedCount > 0
          ? Math.min(100, Math.round((a.actualCount / a.plannedCount) * 1000) / 10)
          : 0;
        const lastDate = a.lastDistributed
          ? a.lastDistributed.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
          : '';
        return `"${a.areaName}",${a.plannedCount},${a.actualCount},${rate},${lastDate}`;
      });

    const csv = BOM + [header, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="distribution-report-${order.orderNo}.csv"`,
      },
    });
  } catch (error) {
    console.error('Portal Reports CSV Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
