import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const dataToUpdate: any = {};
    if (body.redirectUrl !== undefined) dataToUpdate.redirectUrl = body.redirectUrl;
    if (body.memo !== undefined) dataToUpdate.memo = body.memo || null;
    // ★ 追加: 有効/無効ステータスの更新
    if (body.isActive !== undefined) dataToUpdate.isActive = body.isActive;
    if (body.notifyOnScan !== undefined) dataToUpdate.notifyOnScan = body.notifyOnScan;
    if (body.notificationEmails !== undefined) dataToUpdate.notificationEmails = body.notificationEmails || null;

    const updatedQr = await prisma.qrCode.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });
    return NextResponse.json(updatedQr);
  } catch (error) {
    console.error('Update QR Error:', error);
    return NextResponse.json({ error: 'Failed to update QR code' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.qrCode.delete({
      where: { id: parseInt(id) }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete QR Error:', error);
    return NextResponse.json({ error: 'Failed to delete QR code' }, { status: 500 });
  }
}