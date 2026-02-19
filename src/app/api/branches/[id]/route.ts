import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseIntSafe = (n: any) => n ? parseInt(n, 10) : null;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: {
        nameJa: body.nameJa,
        nameEn: body.nameEn,
        address: body.address,
        googleMapUrl: body.googleMapUrl,
        openingTime: body.openingTime,
        closedDays: body.closedDays,
        manager1Id: parseIntSafe(body.manager1Id),
        manager2Id: parseIntSafe(body.manager2Id),
        manager3Id: parseIntSafe(body.manager3Id),
        manager4Id: parseIntSafe(body.manager4Id),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Branch Error:', error);
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.branch.delete({
      where: { id: parseInt(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Branch Error:', error);
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 });
  }
}