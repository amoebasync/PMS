import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';


// GET: ログイン顧客の全QRコード取得
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const customerId = contact.customerId;
    const { searchParams } = new URL(request.url);
    const unlinkedOnly = searchParams.get('unlinked') === 'true';

    const whereClause: any = {
      OR: [
        { flyer: { customerId } },
        { customerId, flyerId: null },
      ],
    };

    if (unlinkedOnly) {
      whereClause.flyerId = null;
      whereClause.customerId = customerId;
      delete whereClause.OR;
    }

    const qrCodes = await prisma.qrCode.findMany({
      where: whereClause,
      include: {
        flyer: { select: { id: true, name: true, flyerCode: true } },
        scanLogs: {
          select: { id: true, visitorId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // スキャン統計を集計
    const qrCodesWithStats = qrCodes.map(qr => ({
      ...qr,
      totalScans: qr.scanLogs.length,
      uniqueScans: new Set(qr.scanLogs.map(l => l.visitorId).filter(Boolean)).size,
      scanLogs: undefined,
    }));

    return NextResponse.json({ qrCodes: qrCodesWithStats });
  } catch (error) {
    console.error('Portal QR GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch QR codes' }, { status: 500 });
  }
}

// POST: スタンドアロンQRコードの作成 (flyerId なし)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const customerId = contact.customerId;
    const body = await request.json();

    const { redirectUrl, memo } = body;
    if (!redirectUrl) {
      return NextResponse.json({ error: 'redirectUrl is required' }, { status: 400 });
    }

    // ユニークなエイリアスを生成
    const alias = `qr-${customerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const qrCode = await prisma.qrCode.create({
      data: {
        alias,
        redirectUrl,
        memo: memo || null,
        customerId,
        flyerId: null,
        isActive: true,
      },
    });

    return NextResponse.json(qrCode);
  } catch (error) {
    console.error('Portal QR POST Error:', error);
    return NextResponse.json({ error: 'Failed to create QR code' }, { status: 500 });
  }
}
