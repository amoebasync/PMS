import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

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

    // 直近の発注（完了・キャンセル除く全件 + 最近完了した10件）
    const orders = await prisma.order.findMany({
      where: { customerId },
      include: {
        distributions: {
          include: {
            flyer: { select: { name: true } },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
      take: 20,
    });

    // distributionItemsの実績をまとめて取得
    const orderIds = orders.map((o) => o.id);
    const distItems = await prisma.distributionItem.findMany({
      where: {
        orderId: { in: orderIds },
      },
      select: {
        orderId: true,
        actualCount: true,
      },
    });

    // orderId → actualCount合計マップ
    const actualMap: Record<number, number> = {};
    for (const item of distItems) {
      if (item.orderId) {
        actualMap[item.orderId] = (actualMap[item.orderId] ?? 0) + (item.actualCount ?? 0);
      }
    }

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

    const result = orders.map((order) => {
      const planned = order.distributions.reduce((sum, d) => sum + (d.plannedCount ?? 0), 0);
      const actual = actualMap[order.id] ?? 0;
      const progressPct = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;

      const flyerNames = order.distributions
        .map((d) => d.flyer?.name)
        .filter(Boolean)
        .join('、');

      return {
        id: order.id,
        orderNo: order.orderNo,
        title: order.title ?? flyerNames ?? '（名称なし）',
        status: order.status,
        statusLabel: STATUS_LABEL[order.status] ?? order.status,
        orderDate: order.orderDate,
        planned,
        actual,
        progressPct,
      };
    });

    return NextResponse.json({ orders: result });
  } catch (error) {
    console.error('Analytics Progress Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
