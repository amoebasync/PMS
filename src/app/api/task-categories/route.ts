import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo } from '@/lib/audit';

// GET /api/task-categories — タスク種類一覧
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }
  try {
    const categories = await prisma.taskCategoryMaster.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Task Categories GET Error:', error);
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/task-categories — タスク種類作成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, code, icon, colorCls, sortOrder } = body;
    if (!name || !code) {
      return NextResponse.json({ error: '名前とコードは必須です' }, { status: 400 });
    }
    const existing = await prisma.taskCategoryMaster.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: 'このコードは既に使用されています' }, { status: 409 });
    }
    const category = await prisma.taskCategoryMaster.create({
      data: {
        name,
        code: code.toUpperCase(),
        icon: icon || null,
        colorCls: colorCls || null,
        sortOrder: sortOrder ?? 100,
      },
    });
    const { actorId, actorName } = await getAdminActorInfo();
    await writeAuditLog({
      actorType: 'EMPLOYEE', actorId, actorName,
      action: 'CREATE', targetModel: 'TaskCategoryMaster', targetId: category.id,
      description: `タスク種類「${name}」を作成`,
      afterData: category,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Task Categories POST Error:', error);
    return NextResponse.json({ error: '作成に失敗しました' }, { status: 500 });
  }
}

// PUT /api/task-categories — タスク種類更新
export async function PUT(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { id, name, code, icon, colorCls, sortOrder, isActive } = body;
    if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

    const before = await prisma.taskCategoryMaster.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

    const category = await prisma.taskCategoryMaster.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(icon !== undefined && { icon }),
        ...(colorCls !== undefined && { colorCls }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    const { actorId, actorName } = await getAdminActorInfo();
    await writeAuditLog({
      actorType: 'EMPLOYEE', actorId, actorName,
      action: 'UPDATE', targetModel: 'TaskCategoryMaster', targetId: id,
      description: `タスク種類「${category.name}」を更新`,
      beforeData: before, afterData: category,
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error('Task Categories PUT Error:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/task-categories?id=X — タスク種類削除
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'IDは必須です' }, { status: 400 });

    // 使用中チェック
    const taskCount = await prisma.task.count({ where: { categoryId: id } });
    const tmplCount = await prisma.taskTemplate.count({ where: { categoryId: id } });
    if (taskCount > 0 || tmplCount > 0) {
      return NextResponse.json({
        error: `このタスク種類は使用中です（タスク${taskCount}件、テンプレート${tmplCount}件）`,
      }, { status: 409 });
    }

    const before = await prisma.taskCategoryMaster.findUnique({ where: { id } });
    await prisma.taskCategoryMaster.delete({ where: { id } });

    const { actorId, actorName } = await getAdminActorInfo();
    await writeAuditLog({
      actorType: 'EMPLOYEE', actorId, actorName,
      action: 'DELETE', targetModel: 'TaskCategoryMaster', targetId: id,
      description: `タスク種類「${before?.name}」を削除`,
      beforeData: before,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Task Categories DELETE Error:', error);
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
  }
}
