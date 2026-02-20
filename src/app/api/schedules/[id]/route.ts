import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: any = {};
    if (body.remarks !== undefined) data.remarks = body.remarks;
    if (body.branchId !== undefined) data.branchId = body.branchId ? parseInt(body.branchId) : null;
    if (body.distributorId !== undefined) data.distributorId = body.distributorId ? parseInt(body.distributorId) : null;
    if (body.status !== undefined) data.status = body.status;
    if (body.date !== undefined) data.date = new Date(body.date);

    const updatedSchedule = await prisma.distributionSchedule.update({
      where: { id: parseInt(id) },
      data
    });
    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error('Failed to update schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.distributionSchedule.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}