import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/complaint-types
// 管理者: クレーム種別マスタ一覧
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const types = await prisma.complaintType.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { complaints: true } } },
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error('ComplaintType Fetch Error:', error);
    return NextResponse.json({ error: 'クレーム種別の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/complaint-types
// 管理者: クレーム種別を作成
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
      return NextResponse.json({ error: 'クレーム種別名は必須です' }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const type = await tx.complaintType.create({
        data: {
          name: body.name,
          penaltyScore: body.penaltyScore !== undefined ? Number(body.penaltyScore) : 10,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : 100,
          isActive: body.isActive !== false,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'ComplaintType',
        targetId: type.id,
        afterData: type as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `クレーム種別「${type.name}」を作成`,
        tx,
      });

      return type;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('ComplaintType Create Error:', error);
    return NextResponse.json({ error: 'クレーム種別の作成に失敗しました' }, { status: 500 });
  }
}

// PUT /api/complaint-types?id=X
// 管理者: クレーム種別を更新
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

    const beforeData = await prisma.complaintType.findUnique({ where: { id } });
    if (!beforeData) {
      return NextResponse.json({ error: 'クレーム種別が見つかりません' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const type = await tx.complaintType.update({
        where: { id },
        data: {
          name: body.name ?? beforeData.name,
          penaltyScore: body.penaltyScore !== undefined ? Number(body.penaltyScore) : beforeData.penaltyScore,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : beforeData.sortOrder,
          isActive: body.isActive !== undefined ? body.isActive : beforeData.isActive,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'ComplaintType',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: type as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `クレーム種別「${type.name}」を更新`,
        tx,
      });

      return type;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('ComplaintType Update Error:', error);
    return NextResponse.json({ error: 'クレーム種別の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/complaint-types?id=X
// 管理者: クレーム種別を削除
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

    const beforeData = await prisma.complaintType.findUnique({
      where: { id },
      include: { _count: { select: { complaints: true } } },
    });
    if (!beforeData) {
      return NextResponse.json({ error: 'クレーム種別が見つかりません' }, { status: 404 });
    }

    if (beforeData._count.complaints > 0) {
      return NextResponse.json(
        { error: `このクレーム種別は${beforeData._count.complaints}件のクレームに紐付いているため削除できません` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.complaintType.delete({ where: { id } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'ComplaintType',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `クレーム種別「${beforeData.name}」を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ComplaintType Delete Error:', error);
    return NextResponse.json({ error: 'クレーム種別の削除に失敗しました' }, { status: 500 });
  }
}
