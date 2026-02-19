import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.partner.update({
      where: { id: parseInt(id, 10) },
      data: {
        name: body.name,
        partnerTypeId: parseInt(body.partnerTypeId, 10), // ★ IDとして保存
        contactInfo: body.contactInfo || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Partner Error:', error);
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.partner.delete({
      where: { id: parseInt(id, 10) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Partner Error:', error);
    return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 });
  }
}