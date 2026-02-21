import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const orderDistAreas = await prisma.orderDistributionArea.findMany({
      where: {
        orderDistribution: {
          order: {
            // ★ 修正: 発注が「確定」または「作業中」の案件のみを抽出する
            status: { in: ['CONFIRMED', 'IN_PROGRESS'] }
          }
        }
      },
      include: {
        area: { include: { city: true, prefecture: true } },
        orderDistribution: {
          include: { 
            order: { include: { customer: true } }, 
            flyer: { include: { size: true } }      
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