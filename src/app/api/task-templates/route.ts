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

      return created;
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Task Template Create Error:', error);
    return NextResponse.json({ error: 'テンプレートの作成に失敗しました' }, { status: 500 });
  }
}
