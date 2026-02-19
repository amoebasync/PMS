import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const parseDate = (d: any) => d ? new Date(d) : null;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await prisma.flyer.update({
      where: { id: parseInt(id) },
      data: {
        name: body.name,
        flyerCode: body.flyerCode || null,
        bundleCount: body.bundleCount ? parseInt(body.bundleCount, 10) : null,
        customerId: parseInt(body.customerId),
        industryId: parseInt(body.industryId),
        sizeId: parseInt(body.sizeId),
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        foldStatus: body.foldStatus,
        remarks: body.remarks || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Flyer Error:', error);
    return NextResponse.json({ error: 'Failed to update flyer' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.flyer.delete({
      where: { id: parseInt(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Flyer Error:', error);
    return NextResponse.json({ error: 'Failed to delete flyer' }, { status: 500 });
  }
}