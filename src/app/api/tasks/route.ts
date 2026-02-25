import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


const taskInclude = {
  customer: { select: { id: true, name: true } },
  distributor: { select: { id: true, name: true, staffId: true } },
  assignee: { select: { id: true, lastNameJa: true, firstNameJa: true } },
  createdBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
};

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const assigneeId = searchParams.get('assigneeId');
  const dueDate = searchParams.get('dueDate');
  const customerId = searchParams.get('customerId');

  const where: any = {};
  if (status) where.status = status;
  if (assigneeId) where.assigneeId = parseInt(assigneeId);
  if (customerId) where.customerId = parseInt(customerId);
  if (dueDate === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.dueDate = { gte: today, lt: tomorrow };
  } else if (dueDate === 'overdue') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.dueDate = { lt: today };
    where.status = { in: ['PENDING', 'IN_PROGRESS'] };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    include: taskInclude,
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { title, description, dueDate, priority, status, customerId, distributorId, assigneeId } = body;

  if (!title || !dueDate) {
    return NextResponse.json({ error: 'title and dueDate are required' }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      dueDate: new Date(dueDate),
      priority: priority || 'MEDIUM',
      status: status || 'PENDING',
      customerId: customerId ? parseInt(customerId) : null,
      distributorId: distributorId ? parseInt(distributorId) : null,
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
      createdById: parseInt(sessionId),
    },
    include: taskInclude,
  });

  return NextResponse.json(task, { status: 201 });
}
