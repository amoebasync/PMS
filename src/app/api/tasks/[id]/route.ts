import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


const taskInclude = {
  customer: { select: { id: true, name: true } },
  distributor: { select: { id: true, name: true, staffId: true } },
  assignee: { select: { id: true, lastNameJa: true, firstNameJa: true } },
  createdBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
  taskCategory: { select: { id: true, name: true, code: true, icon: true, colorCls: true } },
  branch: { select: { id: true, nameJa: true } },
  schedule: { select: { id: true, jobNumber: true } },
  assignees: {
    include: {
      employee: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, nameJa: true } },
    },
  },
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id);
  if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json();
  const {
    title, description, dueDate, priority, status,
    customerId, distributorId, assigneeId,
    category, branchId, scheduleId, assignees,
  } = body;

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
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
        categoryId: category ? parseInt(category) : null,
        branchId: branchId ? parseInt(branchId) : null,
        scheduleId: scheduleId ? parseInt(scheduleId) : null,
      },
    });

    // 担当者の更新（差し替え）
    if (Array.isArray(assignees)) {
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      if (assignees.length > 0) {
        await tx.taskAssignee.createMany({
          data: assignees.map((a: any) => ({
            taskId,
            employeeId: a.type === 'employee' ? a.id : null,
            departmentId: a.type === 'department' ? a.id : null,
            branchId: a.type === 'branch' ? a.id : null,
          })),
        });
      }
    }

    return tx.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });
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
