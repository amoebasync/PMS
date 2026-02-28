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

// GET /api/task-templates/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const template = await prisma.taskTemplate.findUnique({
      where: { id: Number(id) },
      include: templateInclude,
    });

    if (!template) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Task Template Fetch Error:', error);
    return NextResponse.json({ error: 'テンプレートの取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/task-templates/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.taskTemplate.findUnique({ where: { id: Number(id) } });
    if (!beforeData) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
    }

    const template = await prisma.$transaction(async (tx) => {
      const updated = await tx.taskTemplate.update({
        where: { id: Number(id) },
        data: {
          title: body.title,
          description: body.description ?? null,
          categoryId: body.categoryId ? Number(body.categoryId) : null,
          priority: body.priority || 'MEDIUM',
          completionRule: body.completionRule || 'SHARED',
          customerId: body.customerId ? Number(body.customerId) : null,
          distributorId: body.distributorId ? Number(body.distributorId) : null,
          branchId: body.branchId ? Number(body.branchId) : null,
          scheduleId: body.scheduleId ? Number(body.scheduleId) : null,
          recurrenceType: body.recurrenceType || 'ONCE',
          recurrenceValue: body.recurrenceValue ?? null,
          dueTime: body.dueTime || null,
          targetEmployeeIds: body.targetEmployeeIds ?? null,
          targetDepartmentIds: body.targetDepartmentIds ?? null,
          targetBranchIds: body.targetBranchIds ?? null,
          isActive: body.isActive !== false,
        },
        include: templateInclude,
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'TaskTemplate',
        targetId: updated.id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: updated as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `定期タスクテンプレート「${updated.title}」を更新`,
        tx,
      });

      return updated;
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Task Template Update Error:', error);
    return NextResponse.json({ error: 'テンプレートの更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/task-templates/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.taskTemplate.findUnique({ where: { id: Number(id) } });
    if (!beforeData) {
      return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.taskTemplate.delete({ where: { id: Number(id) } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'TaskTemplate',
        targetId: Number(id),
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `定期タスクテンプレート「${beforeData.title}」を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Task Template Delete Error:', error);
    return NextResponse.json({ error: 'テンプレートの削除に失敗しました' }, { status: 500 });
  }
}
