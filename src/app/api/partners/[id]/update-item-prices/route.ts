import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * POST /api/partners/[id]/update-item-prices
 * body: { updates: [{ itemId: number, billingUnitPrice: number }] }
 * DistributionItem の billingUnitPrice を一括更新
 */
export async function POST(
  request: Request,
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

    const body = await request.json();
    const updates: { itemId: number; billingUnitPrice: number | null }[] = body.updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
    }

    // パートナーの受注IDを取得（セキュリティ確認）
    const orderIds = (await prisma.order.findMany({
      where: { partnerId, orderSource: 'PARTNER_IMPORT' },
      select: { id: true },
    })).map(o => o.id);

    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'No orders found for this partner' }, { status: 404 });
    }

    // 一括更新
    let updatedCount = 0;
    const BATCH = 50;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (u) => {
          const result = await prisma.distributionItem.updateMany({
            where: {
              id: u.itemId,
              orderId: { in: orderIds },
            },
            data: {
              billingUnitPrice: u.billingUnitPrice,
            },
          });
          updatedCount += result.count;
        })
      );
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('POST /api/partners/[id]/update-item-prices error:', error);
    return NextResponse.json({ error: 'Failed to update prices' }, { status: 500 });
  }
}
