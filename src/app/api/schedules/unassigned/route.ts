import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const orderDistAreas = await prisma.orderDistributionArea.findMany({
      include: {
        area: { include: { city: true, prefecture: true } },
        orderDistribution: {
          include: { 
            order: { include: { customer: true } }, // ★ 顧客情報を追加
            flyer: { include: { size: true } }      // ★ サイズ情報を追加
          }
        }
      }
    });

    const scheduledItems = await prisma.distributionItem.findMany({
      include: { schedule: true }
    });

    const assignedSet = new Set(
      scheduledItems.map(item => `${item.orderId}_${item.flyerId}_${item.schedule?.areaId}`)
    );

    const unassigned = orderDistAreas.filter(oda => {
      const od = oda.orderDistribution;
      if (!od) return false;
      const key = `${od.orderId}_${od.flyerId}_${oda.areaId}`;
      return !assignedSet.has(key);
    });

    return NextResponse.json(unassigned);
  } catch (error) {
    console.error('Fetch Unassigned Error:', error);
    return NextResponse.json({ error: 'Failed to fetch unassigned items' }, { status: 500 });
  }
}