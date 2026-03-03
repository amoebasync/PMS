import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/alert-categories
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const categories = await prisma.alertCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { alerts: true } } },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('AlertCategory Fetch Error:', error);
    return NextResponse.json({ error: 'アラートカテゴリの取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/alert-categories
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    if (!body.name) {
      return NextResponse.json({ error: 'カテゴリ名は必須です' }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const cat = await tx.alertCategory.create({
        data: {
          name: body.name,
          icon: body.icon || null,
          colorCls: body.colorCls || null,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : 100,
          isActive: body.isActive !== false,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'AlertCategory',
        targetId: cat.id,
        afterData: cat as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `アラートカテゴリ「${cat.name}」を作成`,
        tx,
      });

      return cat;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('AlertCategory Create Error:', error);
    return NextResponse.json({ error: 'アラートカテゴリの作成に失敗しました' }, { status: 500 });
  }
}

// PUT /api/alert-categories?id=X
export async function PUT(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.alertCategory.findUnique({ where: { id } });
    if (!beforeData) {
      return NextResponse.json({ error: 'アラートカテゴリが見つかりません' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cat = await tx.alertCategory.update({
        where: { id },
        data: {
          name: body.name ?? beforeData.name,
          icon: body.icon !== undefined ? body.icon : beforeData.icon,
          colorCls: body.colorCls !== undefined ? body.colorCls : beforeData.colorCls,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : beforeData.sortOrder,
          isActive: body.isActive !== undefined ? body.isActive : beforeData.isActive,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'AlertCategory',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: cat as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `アラートカテゴリ「${cat.name}」を更新`,
        tx,
      });

      return cat;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('AlertCategory Update Error:', error);
    return NextResponse.json({ error: 'アラートカテゴリの更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/alert-categories?id=X
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.alertCategory.findUnique({
      where: { id },
      include: { _count: { select: { alerts: true } } },
    });
    if (!beforeData) {
      return NextResponse.json({ error: 'アラートカテゴリが見つかりません' }, { status: 404 });
    }

    if (beforeData._count.alerts > 0) {
      return NextResponse.json(
        { error: `このカテゴリは${beforeData._count.alerts}件のアラートに紐付いているため削除できません` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.alertCategory.delete({ where: { id } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'AlertCategory',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `アラートカテゴリ「${beforeData.name}」を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AlertCategory Delete Error:', error);
    return NextResponse.json({ error: 'アラートカテゴリの削除に失敗しました' }, { status: 500 });
  }
}
