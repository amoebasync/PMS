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

    // このcustomerのQRコードIDを取得
    const qrCodes = await prisma.qrCode.findMany({
      where: {
        OR: [
          { customerId },
          { flyer: { customerId } },
        ],
      },
      select: { id: true },
    });
    const qrCodeIds = qrCodes.map((q) => q.id);

    // 30日前
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // KPIを並列取得
    const [totalScans, uniqueVisitors, recentScans, activeOrders, totalPlanned, totalActual] =
      await Promise.all([
        // 累計スキャン数
        prisma.qrScanLog.count({
          where: { qrCodeId: { in: qrCodeIds } },
        }),
        // ユニーク訪問者数
        prisma.qrScanLog.findMany({
          where: {
            qrCodeId: { in: qrCodeIds },
            visitorId: { not: null },
          },
          select: { visitorId: true },
          distinct: ['visitorId'],
        }),
        // 直近30日のスキャン数
        prisma.qrScanLog.count({
          where: {
            qrCodeId: { in: qrCodeIds },
            scannedAt: { gte: thirtyDaysAgo },
          },
        }),
        // 進行中の発注数
        prisma.order.count({
          where: {
            customerId,
            status: {
              notIn: ['COMPLETED', 'CANCELED', 'DRAFT'],
            },
          },
        }),
        // 総配布予定枚数
        prisma.orderDistribution.aggregate({
          where: { order: { customerId } },
          _sum: { plannedCount: true },
        }),
        // 総配布実績枚数 (distributionItemsから)
        prisma.distributionItem.aggregate({
          where: { customerId },
          _sum: { actualCount: true },
        }),
      ]);

    return NextResponse.json({
      totalScans,
      uniqueVisitors: uniqueVisitors.length,
      recentScans,
      activeOrders,
      totalPlanned: totalPlanned._sum.plannedCount ?? 0,
      totalActual: totalActual._sum.actualCount ?? 0,
    });
  } catch (error) {
    console.error('Analytics Summary Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
