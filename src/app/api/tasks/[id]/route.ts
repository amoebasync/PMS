import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

const taskInclude = {
  customer: { select: { id: true, name: true } },
  distributor: { select: { id: true, name: true, staffId: true } },
  assignee: { select: { id: true, lastNameJa: true, firstNameJa: true } },
  createdBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id);
  if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json();
  const { title, description, dueDate, priority, status, customerId, distributorId, assigneeId } = body;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: description ?? null,
      dueDate: new Date(dueDate),
      priority,
      status,
      customerId: customerId ? parseInt(customerId) : null,
      distributorId: distributorId ? parseInt(distributorId) : null,
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
    },
    include: taskInclude,
  });

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id);
  if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json();
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status: body.status },
  });

  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id);
  if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await prisma.task.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
