import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

const templateInclude = {
  customer: { select: { id: true, name: true } },
  distributor: { select: { id: true, name: true, staffId: true } },
  taskCategory: { select: { id: true, name: true, code: true, icon: true, colorCls: true } },
  branch: { select: { id: true, nameJa: true } },
  schedule: { select: { id: true, jobNumber: true } },
};

// GET /api/task-templates
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (category) where.categoryId = parseInt(category);
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const templates = await prisma.taskTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: templateInclude,
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Task Templates Fetch Error:', error);
    return NextResponse.json({ error: 'テンプレートの取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/task-templates
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    if (!body.title) {
      return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 });
    }

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.taskTemplate.create({
        data: {
          title: body.title,
          description: body.description || null,
          categoryId: body.categoryId ? Number(body.categoryId) : null,
          priority: body.priority || 'MEDIUM',
          completionRule: body.completionRule || 'SHARED',
          customerId: body.customerId ? Number(body.customerId) : null,
          distributorId: body.distributorId ? Number(body.distributorId) : null,
          branchId: body.branchId ? Number(body.branchId) : null,
          scheduleId: body.scheduleId ? Number(body.scheduleId) : null,
          recurrenceType: body.recurrenceType || 'ONCE',
          recurrenceValue: body.recurrenceValue || null,
          dueTime: body.dueTime || null,
          targetEmployeeIds: body.targetEmployeeIds || null,
          targetDepartmentIds: body.targetDepartmentIds || null,
          targetBranchIds: body.targetBranchIds || null,
          isActive: body.isActive !== false,
        },
        include: templateInclude,
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'TaskTemplate',
        targetId: created.id,
        afterData: created as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `定期タスクテンプレート「${created.title}」を作成`,
        tx,
      });

      // 初回タスクを即時生成
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(today);
      if (created.dueTime) {
        const [h, m] = created.dueTime.split(':').map(Number);
        dueDate.setHours(h, m, 0, 0);
      }

      const employeeIds = (created.targetEmployeeIds as number[]) || [];
      const departmentIds = (created.targetDepartmentIds as number[]) || [];
      const branchIds = (created.targetBranchIds as number[]) || [];

      if (created.completionRule === 'INDIVIDUAL') {
        // INDIVIDUAL: 対象社員を展開して個別タスク作成
        const targetEmployees = new Set<number>(employeeIds);
        if (departmentIds.length > 0) {
          const deptEmps = await tx.employee.findMany({
            where: { departmentId: { in: departmentIds }, isActive: true },
            select: { id: true },
          });
          deptEmps.forEach(e => targetEmployees.add(e.id));
        }
        if (branchIds.length > 0) {
          const branchEmps = await tx.employee.findMany({
            where: { branchId: { in: branchIds }, isActive: true },
            select: { id: true },
          });
          branchEmps.forEach(e => targetEmployees.add(e.id));
        }
        for (const empId of targetEmployees) {
          await tx.task.create({
            data: {
              title: created.title,
              description: created.description,
              dueDate,
              priority: created.priority,
              status: 'PENDING',
              categoryId: created.categoryId,
              customerId: created.customerId,
              distributorId: created.distributorId,
              branchId: created.branchId,
              scheduleId: created.scheduleId,
              templateId: created.id,
              assigneeId: empId,
            },
          });
        }
      } else {
        // SHARED: 1つのタスク + 複数担当者
        const task = await tx.task.create({
          data: {
            title: created.title,
            description: created.description,
            dueDate,
            priority: created.priority,
            status: 'PENDING',
            categoryId: created.categoryId,
            customerId: created.customerId,
            distributorId: created.distributorId,
            branchId: created.branchId,
            scheduleId: created.scheduleId,
            templateId: created.id,
            assigneeId: employeeIds.length === 1 ? employeeIds[0] : null,
          },
        });
        const assigneeData = [
          ...employeeIds.map(eid => ({ taskId: task.id, employeeId: eid, departmentId: null, branchId: null })),
          ...departmentIds.map(did => ({ taskId: task.id, employeeId: null, departmentId: did, branchId: null })),
          ...branchIds.map(bid => ({ taskId: task.id, employeeId: null, departmentId: null, branchId: bid })),
        ];
        if (assigneeData.length > 0) {
          await tx.taskAssignee.createMany({ data: assigneeData });
        }
      }

      // lastGeneratedAt を更新
      await tx.taskTemplate.update({
        where: { id: created.id },
        data: { lastGeneratedAt: new Date() },
      });

      return created;
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Task Template Create Error:', error);
    return NextResponse.json({ error: 'テンプレートの作成に失敗しました' }, { status: 500 });
  }
}
