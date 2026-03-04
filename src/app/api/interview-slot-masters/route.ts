import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/interview-slot-masters
// 管理者: 面接スロットマスタ一覧
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const masters = await prisma.interviewSlotMaster.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        jobCategories: {
          select: { id: true, nameJa: true, nameEn: true },
        },
        _count: {
          select: { interviewSlots: true },
        },
      },
    });

    return NextResponse.json(masters);
  } catch (error) {
    console.error('InterviewSlotMaster Fetch Error:', error);
    return NextResponse.json({ error: '面接スロットマスタの取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/interview-slot-masters
// 管理者: 面接スロットマスタを作成
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
      return NextResponse.json({ error: 'マスタ名は必須です' }, { status: 400 });
    }

    const jobCategoryIds: number[] = body.jobCategoryIds || [];

    // 各職種が他のマスタに紐付いていないかチェック
    if (jobCategoryIds.length > 0) {
      const alreadyAssigned = await prisma.jobCategory.findMany({
        where: {
          id: { in: jobCategoryIds },
          interviewSlotMasterId: { not: null },
        },
        select: { id: true, nameJa: true, interviewSlotMasterId: true },
      });

      if (alreadyAssigned.length > 0) {
        const names = alreadyAssigned.map((jc) => jc.nameJa).join(', ');
        return NextResponse.json(
          { error: `以下の職種は既に他のマスタに割り当てられています: ${names}` },
          { status: 400 }
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const master = await tx.interviewSlotMaster.create({
        data: {
          name: body.name,
          meetingType: body.meetingType || 'GOOGLE_MEET',
          zoomUrl: body.zoomUrl || null,
          zoomMeetingNumber: body.zoomMeetingNumber || null,
          zoomPassword: body.zoomPassword || null,
          isActive: body.isActive !== false,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : 100,
        },
      });

      // 職種を紐付け
      if (jobCategoryIds.length > 0) {
        await tx.jobCategory.updateMany({
          where: { id: { in: jobCategoryIds } },
          data: { interviewSlotMasterId: master.id },
        });
      }

      // 作成結果をリレーション付きで取得
      const result = await tx.interviewSlotMaster.findUnique({
        where: { id: master.id },
        include: {
          jobCategories: {
            select: { id: true, nameJa: true, nameEn: true },
          },
          _count: {
            select: { interviewSlots: true },
          },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'InterviewSlotMaster',
        targetId: master.id,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `面接スロットマスタ「${master.name}」を作成`,
        tx,
      });

      return result;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('InterviewSlotMaster Create Error:', error);
    return NextResponse.json({ error: '面接スロットマスタの作成に失敗しました' }, { status: 500 });
  }
}
