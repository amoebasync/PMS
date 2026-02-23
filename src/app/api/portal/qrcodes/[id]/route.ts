import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

// ログイン中の顧客がそのQRコードの所有者であることを確認する
async function verifyQrOwnership(qrId: number, contactId: number): Promise<boolean> {
  const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
  if (!contact) return false;
  const qr = await prisma.qrCode.findFirst({
    where: {
      id: qrId,
      flyer: { customerId: contact.customerId },
    },
  });
  return !!qr;
}

// PUT: QRコードの更新（転送先URL・メモ・有効/無効の切り替え）
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const { id } = await params;
    const qrId = parseInt(id);

    const isOwner = await verifyQrOwnership(qrId, contactId);
    if (!isOwner) {
      return NextResponse.json({ error: 'このQRコードへのアクセス権限がありません' }, { status: 403 });
    }

    const body = await request.json();
    const dataToUpdate: any = {};
    if (body.redirectUrl !== undefined) dataToUpdate.redirectUrl = body.redirectUrl;
    if (body.memo !== undefined) dataToUpdate.memo = body.memo || null;
    if (body.isActive !== undefined) dataToUpdate.isActive = body.isActive;

    const updated = await prisma.qrCode.update({
      where: { id: qrId },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Portal QR PUT Error:', error);
    return NextResponse.json({ error: 'QRコードの更新に失敗しました' }, { status: 500 });
  }
}

// DELETE: QRコードの削除
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const { id } = await params;
    const qrId = parseInt(id);

    const isOwner = await verifyQrOwnership(qrId, contactId);
    if (!isOwner) {
      return NextResponse.json({ error: 'このQRコードへのアクセス権限がありません' }, { status: 403 });
    }

    await prisma.qrCode.delete({ where: { id: qrId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Portal QR DELETE Error:', error);
    return NextResponse.json({ error: 'QRコードの削除に失敗しました' }, { status: 500 });
  }
}
