import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/prohibited-reasons
// 管理者: 禁止理由マスタ一覧
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const reasons = await prisma.prohibitedReason.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { prohibitedProperties: true } } },
    });

    return NextResponse.json(reasons);
  } catch (error) {
    console.error('ProhibitedReason Fetch Error:', error);
    return NextResponse.json({ error: '禁止理由の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/prohibited-reasons
// 管理者: 禁止理由を作成
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
      return NextResponse.json({ error: '禁止理由名は必須です' }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const reason = await tx.prohibitedReason.create({
        data: {
          name: body.name,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : 100,
          isActive: body.isActive !== false,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'ProhibitedReason',
        targetId: reason.id,
        afterData: reason as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `禁止理由「${reason.name}」を作成`,
        tx,
      });

      return reason;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('ProhibitedReason Create Error:', error);
    return NextResponse.json({ error: '禁止理由の作成に失敗しました' }, { status: 500 });
  }
}

// PUT /api/prohibited-reasons?id=X
// 管理者: 禁止理由を更新
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

    const beforeData = await prisma.prohibitedReason.findUnique({ where: { id } });
    if (!beforeData) {
      return NextResponse.json({ error: '禁止理由が見つかりません' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reason = await tx.prohibitedReason.update({
        where: { id },
        data: {
          name: body.name ?? beforeData.name,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : beforeData.sortOrder,
          isActive: body.isActive !== undefined ? body.isActive : beforeData.isActive,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'ProhibitedReason',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: reason as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `禁止理由「${reason.name}」を更新`,
        tx,
      });

      return reason;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('ProhibitedReason Update Error:', error);
    return NextResponse.json({ error: '禁止理由の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/prohibited-reasons?id=X
// 管理者: 禁止理由を削除
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

    const beforeData = await prisma.prohibitedReason.findUnique({
      where: { id },
      include: { _count: { select: { prohibitedProperties: true } } },
    });
    if (!beforeData) {
      return NextResponse.json({ error: '禁止理由が見つかりません' }, { status: 404 });
    }

    if (beforeData._count.prohibitedProperties > 0) {
      return NextResponse.json(
        { error: `この禁止理由は${beforeData._count.prohibitedProperties}件の禁止物件に紐付いているため削除できません` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.prohibitedReason.delete({ where: { id } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'ProhibitedReason',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `禁止理由「${beforeData.name}」を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ProhibitedReason Delete Error:', error);
    return NextResponse.json({ error: '禁止理由の削除に失敗しました' }, { status: 500 });
  }
}
