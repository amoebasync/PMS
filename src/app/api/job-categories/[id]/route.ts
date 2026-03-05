import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// PUT /api/job-categories/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  const { id } = await params;
  const categoryId = Number(id);
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    if (!body.nameJa?.trim()) {
      return NextResponse.json({ error: '職種名（日本語）は必須です' }, { status: 400 });
    }

    const before = await prisma.jobCategory.findUnique({ where: { id: categoryId } });
    if (!before) {
      return NextResponse.json({ error: '職種が見つかりません' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const category = await tx.jobCategory.update({
        where: { id: categoryId },
        data: {
          nameJa: body.nameJa.trim(),
          nameEn: body.nameEn?.trim() || null,
          isActive: body.isActive !== undefined ? body.isActive : before.isActive,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'JobCategory',
        targetId: category.id,
        beforeData: before as unknown as Record<string, unknown>,
        afterData: category as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `職種「${category.nameJa}」を更新`,
        tx,
      });

      return category;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Job Category Update Error:', error);
    return NextResponse.json({ error: '職種の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/job-categories/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  const { id } = await params;
  const categoryId = Number(id);
  if (isNaN(categoryId)) {
    return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
  }

  try {
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const before = await prisma.jobCategory.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { applicants: true } } },
    });
    if (!before) {
      return NextResponse.json({ error: '職種が見つかりません' }, { status: 404 });
    }

    if (before._count.applicants > 0) {
      return NextResponse.json(
        { error: `この職種には${before._count.applicants}名の応募者が紐付いているため削除できません` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.jobCategory.delete({ where: { id: categoryId } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'JobCategory',
        targetId: categoryId,
        beforeData: before as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `職種「${before.nameJa}」を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Job Category Delete Error:', error);
    return NextResponse.json({ error: '職種の削除に失敗しました' }, { status: 500 });
  }
}
