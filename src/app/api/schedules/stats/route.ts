import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const distributions = await prisma.orderDistribution.findMany();
    const items = await prisma.distributionItem.findMany();

    const stats: Record<string, any> = {};

    distributions.forEach(od => {
      // 受注IDとチラシIDの組み合わせで集計
      const key = `${od.orderId}_${od.flyerId}`;
      const relatedItems = items.filter(i => i.orderId === od.orderId && i.flyerId === od.flyerId);
      const totalAssigned = relatedItems.reduce((sum, i) => sum + (i.plannedCount || 0), 0);
      
      stats[key] = {
        totalPlanned: od.plannedCount,
        totalAssigned,
        remaining: od.plannedCount - totalAssigned,
        isOver: totalAssigned > od.plannedCount
      };
    });

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}