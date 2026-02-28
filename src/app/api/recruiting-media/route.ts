import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/recruiting-media
// 管理者: 求人媒体一覧
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const media = await prisma.recruitingMedia.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { applicants: true } } },
    });

    return NextResponse.json(media);
  } catch (error) {
    console.error('Recruiting Media Fetch Error:', error);
    return NextResponse.json({ error: '求人媒体の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/recruiting-media
// 管理者: 求人媒体を作成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    if (!body.nameJa || !body.code) {
      return NextResponse.json({ error: '媒体名（日本語）とコードは必須です' }, { status: 400 });
    }

    const code = body.code.toLowerCase().trim();

    // コード重複チェック
    const existing = await prisma.recruitingMedia.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: 'このコードは既に使用されています' }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const media = await tx.recruitingMedia.create({
        data: {
          nameJa: body.nameJa,
          nameEn: body.nameEn || null,
          code,
          isActive: body.isActive !== false,
          sortOrder: body.sortOrder ? Number(body.sortOrder) : 100,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'RecruitingMedia',
        targetId: media.id,
        afterData: media as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `求人媒体「${media.nameJa}」(${media.code})を作成`,
        tx,
      });

      return media;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Recruiting Media Create Error:', error);
    return NextResponse.json({ error: '求人媒体の作成に失敗しました' }, { status: 500 });
  }
}

// PUT /api/recruiting-media?id=X
// 管理者: 求人媒体を更新
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

    const beforeData = await prisma.recruitingMedia.findUnique({ where: { id } });
    if (!beforeData) {
      return NextResponse.json({ error: '求人媒体が見つかりません' }, { status: 404 });
    }

    const code = body.code ? body.code.toLowerCase().trim() : beforeData.code;

    // コード重複チェック（自分以外）
    if (code !== beforeData.code) {
      const dup = await prisma.recruitingMedia.findUnique({ where: { code } });
      if (dup) {
        return NextResponse.json({ error: 'このコードは既に使用されています' }, { status: 409 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const media = await tx.recruitingMedia.update({
        where: { id },
        data: {
          nameJa: body.nameJa ?? beforeData.nameJa,
          nameEn: body.nameEn !== undefined ? (body.nameEn || null) : beforeData.nameEn,
          code,
          isActive: body.isActive !== undefined ? body.isActive : beforeData.isActive,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : beforeData.sortOrder,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'RecruitingMedia',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: media as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `求人媒体「${media.nameJa}」(${media.code})を更新`,
        tx,
      });

      return media;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Recruiting Media Update Error:', error);
    return NextResponse.json({ error: '求人媒体の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/recruiting-media?id=X
// 管理者: 求人媒体を削除
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

    const beforeData = await prisma.recruitingMedia.findUnique({
      where: { id },
      include: { _count: { select: { applicants: true } } },
    });
    if (!beforeData) {
      return NextResponse.json({ error: '求人媒体が見つかりません' }, { status: 404 });
    }

    if (beforeData._count.applicants > 0) {
      return NextResponse.json(
        { error: `この求人媒体は${beforeData._count.applicants}件の応募者に紐付いているため削除できません` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.recruitingMedia.delete({ where: { id } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'RecruitingMedia',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `求人媒体「${beforeData.nameJa}」(${beforeData.code})を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recruiting Media Delete Error:', error);
    return NextResponse.json({ error: '求人媒体の削除に失敗しました' }, { status: 500 });
  }
}
