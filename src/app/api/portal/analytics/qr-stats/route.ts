import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';


export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const customerId = contact.customerId;

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const since = new Date();
    since.setDate(since.getDate() - days);

    // このcustomerのQRコード（チラシ経由 or 直接）
    const qrCodes = await prisma.qrCode.findMany({
      where: {
        OR: [
          { customerId },
          { flyer: { customerId } },
        ],
      },
      include: {
        flyer: { select: { name: true } },
      },
    });
    const qrCodeIds = qrCodes.map((q) => q.id);

    if (qrCodeIds.length === 0) {
      return NextResponse.json({ daily: [], deviceBreakdown: [], flyerBreakdown: [] });
    }

    // 全スキャンログを取得（期間絞り）
    const scanLogs = await prisma.qrScanLog.findMany({
      where: {
        qrCodeId: { in: qrCodeIds },
        scannedAt: { gte: since },
      },
      select: {
        qrCodeId: true,
        scannedAt: true,
        deviceType: true,
      },
    });

    // 日別集計
    const dailyMap: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    for (const log of scanLogs) {
      const key = new Date(log.scannedAt).toISOString().slice(0, 10);
      if (key in dailyMap) dailyMap[key]++;
    }
    const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // デバイス別集計
    const deviceMap: Record<string, number> = {};
    for (const log of scanLogs) {
      const device = log.deviceType || '不明';
      deviceMap[device] = (deviceMap[device] ?? 0) + 1;
    }
    const deviceBreakdown = Object.entries(deviceMap).map(([name, value]) => ({ name, value }));

    // QRコード→チラシ名マップ
    const qrToFlyer: Record<number, string> = {};
    for (const qr of qrCodes) {
      qrToFlyer[qr.id] = qr.flyer?.name ?? qr.id.toString();
    }

    // チラシ別集計（全期間ログを使う）
    const allLogs = await prisma.qrScanLog.findMany({
      where: { qrCodeId: { in: qrCodeIds } },
      select: { qrCodeId: true },
    });
    const flyerMap: Record<string, number> = {};
    for (const log of allLogs) {
      const name = qrToFlyer[log.qrCodeId] ?? '不明';
      flyerMap[name] = (flyerMap[name] ?? 0) + 1;
    }
    const flyerBreakdown = Object.entries(flyerMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({ daily, deviceBreakdown, flyerBreakdown });
  } catch (error) {
    console.error('Analytics QR Stats Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
