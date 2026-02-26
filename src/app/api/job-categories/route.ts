import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/job-categories
// 管理者: 全職種一覧
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const categories = await prisma.jobCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { applicants: true } } },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Job Categories Fetch Error:', error);
    return NextResponse.json({ error: '職種の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/job-categories
// 管理者: 職種を作成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    if (!body.nameJa) {
      return NextResponse.json({ error: '職種名（日本語）は必須です' }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const category = await tx.jobCategory.create({
        data: {
          nameJa: body.nameJa,
          nameEn: body.nameEn || null,
          isActive: body.isActive !== false,
          sortOrder: body.sortOrder || 100,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'JobCategory',
        targetId: category.id,
        afterData: category as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `職種「${category.nameJa}」を作成`,
        tx,
      });

      return category;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('Job Category Create Error:', error);
    return NextResponse.json({ error: '職種の作成に失敗しました' }, { status: 500 });
  }
}
