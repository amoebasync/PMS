import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';


// ログイン中の顧客がそのチラシの所有者であることを確認する
async function verifyFlyerOwnership(flyerId: number, contactId: number): Promise<boolean> {
  const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
  if (!contact) return false;
  const flyer = await prisma.flyer.findFirst({
    where: { id: flyerId, customerId: contact.customerId }
  });
  return !!flyer;
}

// GET: 指定チラシのQRコード一覧取得
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const { id } = await params;
    const flyerId = parseInt(id);

    const isOwner = await verifyFlyerOwnership(flyerId, contactId);
    if (!isOwner) {
      return NextResponse.json({ error: 'このチラシへのアクセス権限がありません' }, { status: 403 });
    }

    const qrcodes = await prisma.qrCode.findMany({
      where: { flyerId },
      include: { _count: { select: { scanLogs: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // ユニーク訪問者数を計算して付加する
    const enhanced = await Promise.all(
      qrcodes.map(async (qr) => {
        const uniqueVisitors = await prisma.qrScanLog.groupBy({
          by: ['visitorId'],
          where: { qrCodeId: qr.id, visitorId: { not: null } },
        });
        return { ...qr, uniqueScans: uniqueVisitors.length };
      })
    );

    return NextResponse.json(enhanced);
  } catch (error) {
    console.error('Portal QR GET Error:', error);
    return NextResponse.json({ error: 'QRコードの取得に失敗しました' }, { status: 500 });
  }
}

// POST: 新規QRコードを作成する
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const { id } = await params;
    const flyerId = parseInt(id);

    const isOwner = await verifyFlyerOwnership(flyerId, contactId);
    if (!isOwner) {
      return NextResponse.json({ error: 'このチラシへのアクセス権限がありません' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.alias || !body.redirectUrl) {
      return NextResponse.json({ error: 'エイリアスと転送先URLは必須です' }, { status: 400 });
    }

    // エイリアスの重複チェック
    const existing = await prisma.qrCode.findUnique({ where: { alias: body.alias } });
    if (existing) {
      return NextResponse.json(
        { error: 'このエイリアスは既に使用されています。別の文字列を指定してください。' },
        { status: 400 }
      );
    }

    const newQr = await prisma.qrCode.create({
      data: {
        flyerId,
        alias: body.alias,
        redirectUrl: body.redirectUrl,
        memo: body.memo || null,
        notifyOnScan: false,
        notificationEmails: null,
      },
    });

    return NextResponse.json(newQr, { status: 201 });
  } catch (error) {
    console.error('Portal QR POST Error:', error);
    return NextResponse.json({ error: 'QRコードの作成に失敗しました' }, { status: 500 });
  }
}
