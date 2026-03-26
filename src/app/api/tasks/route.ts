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
  template: { select: { id: true, title: true } },
  assignees: {
    include: {
      employee: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, nameJa: true } },
    },
  },
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
  const distributorId = searchParams.get('distributorId');
  const category = searchParams.get('category');
  const myTasks = searchParams.get('myTasks');

  const where: any = {};
  if (status === 'NOT_DONE') {
    where.status = { not: 'DONE' };
  } else if (status) {
    where.status = status;
  }
  if (assigneeId) where.assigneeId = parseInt(assigneeId);
  if (customerId) where.customerId = parseInt(customerId);
  if (distributorId) where.distributorId = parseInt(distributorId);
  if (category) where.categoryId = parseInt(category);

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

  // マイタスクフィルタ: ログインユーザーの個人・所属部署・所属支店を基にフィルタ
  if (myTasks === 'true') {
    const employee = await prisma.employee.findFirst({
      where: { id: parseInt(sessionId), isActive: true },
      select: { id: true, departmentId: true, branchId: true },
    });

    if (employee) {
      const orConditions: any[] = [
        { assigneeId: employee.id },
        { assignees: { some: { employeeId: employee.id } } },
      ];
      if (employee.departmentId) {
        orConditions.push({ assignees: { some: { departmentId: employee.departmentId } } });
      }
      if (employee.branchId) {
        orConditions.push({ assignees: { some: { branchId: employee.branchId } } });
      }
      where.OR = orConditions;
    }
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
  const {
    title, description, dueDate, priority, status,
    customerId, distributorId, assigneeId,
    category, branchId, scheduleId, assignees,
    complaintId,
  } = body;

  if (!title || !dueDate) {
    return NextResponse.json({ error: 'title and dueDate are required' }, { status: 400 });
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
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
        categoryId: category ? parseInt(category) : null,
        branchId: branchId ? parseInt(branchId) : null,
        scheduleId: scheduleId ? parseInt(scheduleId) : null,
        complaintId: complaintId ? parseInt(complaintId) : null,
      },
    });

    // 複数担当者の登録
    if (Array.isArray(assignees) && assignees.length > 0) {
      await tx.taskAssignee.createMany({
        data: assignees.map((a: any) => ({
          taskId: created.id,
          employeeId: a.type === 'employee' ? a.id : null,
          departmentId: a.type === 'department' ? a.id : null,
          branchId: a.type === 'branch' ? a.id : null,
        })),
      });
    }

    return tx.task.findUnique({
      where: { id: created.id },
      include: taskInclude,
    });
  });

  return NextResponse.json(task, { status: 201 });
}
