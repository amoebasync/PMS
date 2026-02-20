import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const qrcodes = await prisma.qrCode.findMany({
      where: { flyerId: parseInt(id) },
      include: {
        _count: {
          select: { scanLogs: true } // トータルのスキャン数
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // ★ 各QRコードのユニークカウント（visitorIdの種類数）を計算して追加
    const enhancedQrCodes = await Promise.all(
      qrcodes.map(async (qr) => {
        const uniqueVisitors = await prisma.qrScanLog.groupBy({
          by: ['visitorId'],
          where: {
            qrCodeId: qr.id,
            visitorId: { not: null }
          }
        });
        
        return {
          ...qr,
          uniqueScans: uniqueVisitors.length // 重複を排除した人数
        };
      })
    );

    return NextResponse.json(enhancedQrCodes);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch QR codes' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.qrCode.findUnique({
      where: { alias: body.alias }
    });
    if (existing) {
      return NextResponse.json({ error: 'このエイリアスは既に使用されています。別の文字列を指定してください。' }, { status: 400 });
    }

    const newQr = await prisma.qrCode.create({
      data: {
        flyerId: parseInt(id),
        alias: body.alias,
        redirectUrl: body.redirectUrl,
        memo: body.memo || null,
        notifyOnScan: body.notifyOnScan || false,
        notificationEmails: body.notificationEmails || null,
      }
    });
    return NextResponse.json(newQr);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create QR code' }, { status: 500 });
  }
}