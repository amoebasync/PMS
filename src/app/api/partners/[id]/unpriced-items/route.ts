import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * GET /api/partners/[id]/unpriced-items
 * パートナーの受注に紐づくDistributionItemで billingUnitPrice が null のものを取得
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const partnerId = parseInt(id);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    // パートナーの受注IDを取得
    const orders = await prisma.order.findMany({
      where: { partnerId, orderSource: 'PARTNER_IMPORT' },
      select: { id: true, orderNo: true, title: true, orderDate: true },
    });

    if (orders.length === 0) {
      return NextResponse.json({ items: [], orders: [] });
    }

    const orderIds = orders.map(o => o.id);

    // DistributionItem を取得（orderIdがパートナー受注に紐づくもの）
    const items = await prisma.distributionItem.findMany({
      where: {
        orderId: { in: orderIds },
      },
      select: {
        id: true,
        flyerName: true,
        flyerCode: true,
        plannedCount: true,
        actualCount: true,
        billingUnitPrice: true,
        orderId: true,
        scheduleId: true,
        schedule: {
          select: {
            date: true,
            branch: { select: { nameJa: true } },
            distributor: { select: { name: true, staffId: true } },
          },
        },
        customer: {
          select: { customerCode: true },
        },
      },
      orderBy: [{ schedule: { date: 'desc' } }, { flyerName: 'asc' }],
    });

    return NextResponse.json({ items, orders });
  } catch (error) {
    console.error('GET /api/partners/[id]/unpriced-items error:', error);
    return NextResponse.json({ error: 'Failed to fetch unpriced items' }, { status: 500 });
  }
}
