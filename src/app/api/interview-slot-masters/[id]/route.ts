import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/interview-slot-masters/[id]
// 管理者: 面接スロットマスタ詳細（defaultInterviewSlots含む）
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const master = await prisma.interviewSlotMaster.findUnique({
      where: { id },
      include: {
        jobCategories: {
          select: { id: true, nameJa: true, nameEn: true },
        },
        defaultInterviewSlots: {
          include: {
            interviewer: {
              select: { id: true, lastNameJa: true, firstNameJa: true, email: true },
            },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
        _count: {
          select: { interviewSlots: true },
        },
      },
    });

    if (!master) {
      return NextResponse.json({ error: '面接スロットマスタが見つかりません' }, { status: 404 });
    }

    return NextResponse.json(master);
  } catch (error) {
    console.error('InterviewSlotMaster Detail Error:', error);
    return NextResponse.json({ error: '面接スロットマスタの取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/interview-slot-masters/[id]
// 管理者: 面接スロットマスタを更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // beforeData取得（トランザクション前）
    const beforeData = await prisma.interviewSlotMaster.findUnique({
      where: { id },
      include: {
        jobCategories: {
          select: { id: true, nameJa: true, nameEn: true },
        },
      },
    });
    if (!beforeData) {
      return NextResponse.json({ error: '面接スロットマスタが見つかりません' }, { status: 404 });
    }

    // jobCategoryIds のバリデーション（指定された場合）
    const jobCategoryIds: number[] | undefined = body.jobCategoryIds;
    if (jobCategoryIds !== undefined && jobCategoryIds.length > 0) {
      const alreadyAssigned = await prisma.jobCategory.findMany({
        where: {
          id: { in: jobCategoryIds },
          interviewSlotMasterId: { not: null },
          NOT: { interviewSlotMasterId: id },
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

    const updated = await prisma.$transaction(async (tx) => {
      // マスタ本体を更新
      await tx.interviewSlotMaster.update({
        where: { id },
        data: {
          name: body.name ?? beforeData.name,
          meetingType: body.meetingType ?? beforeData.meetingType,
          zoomUrl: body.zoomUrl !== undefined ? (body.zoomUrl || null) : beforeData.zoomUrl,
          zoomMeetingNumber: body.zoomMeetingNumber !== undefined ? (body.zoomMeetingNumber || null) : beforeData.zoomMeetingNumber,
          zoomPassword: body.zoomPassword !== undefined ? (body.zoomPassword || null) : beforeData.zoomPassword,
          isActive: body.isActive !== undefined ? body.isActive : beforeData.isActive,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : beforeData.sortOrder,
        },
      });

      // 職種の紐付け更新（指定された場合のみ）
      if (jobCategoryIds !== undefined) {
        // 旧い紐付けを解除
        await tx.jobCategory.updateMany({
          where: { interviewSlotMasterId: id },
          data: { interviewSlotMasterId: null },
        });

        // 新しい紐付けを設定
        if (jobCategoryIds.length > 0) {
          await tx.jobCategory.updateMany({
            where: { id: { in: jobCategoryIds } },
            data: { interviewSlotMasterId: id },
          });
        }
      }

      // 更新結果をリレーション付きで取得
      const result = await tx.interviewSlotMaster.findUnique({
        where: { id },
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
        action: 'UPDATE',
        targetModel: 'InterviewSlotMaster',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `面接スロットマスタ「${result?.name || beforeData.name}」を更新`,
        tx,
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('InterviewSlotMaster Update Error:', error);
    return NextResponse.json({ error: '面接スロットマスタの更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/interview-slot-masters/[id]
// 管理者: 面接スロットマスタを削除
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // beforeData取得（トランザクション前）
    const beforeData = await prisma.interviewSlotMaster.findUnique({
      where: { id },
      include: {
        jobCategories: {
          select: { id: true, nameJa: true, nameEn: true },
        },
        _count: {
          select: { interviewSlots: true, defaultInterviewSlots: true },
        },
      },
    });
    if (!beforeData) {
      return NextResponse.json({ error: '面接スロットマスタが見つかりません' }, { status: 404 });
    }

    // 予約済みスロットがある場合は削除不可
    const bookedCount = await prisma.interviewSlot.count({
      where: {
        interviewSlotMasterId: id,
        isBooked: true,
      },
    });
    if (bookedCount > 0) {
      return NextResponse.json(
        { error: `このマスタには${bookedCount}件の予約済みスロットがあるため削除できません` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 職種の紐付けを解除
      await tx.jobCategory.updateMany({
        where: { interviewSlotMasterId: id },
        data: { interviewSlotMasterId: null },
      });

      // デフォルトスロット設定を削除（onDelete: Cascadeだが明示的に削除）
      await tx.defaultInterviewSlot.deleteMany({
        where: { interviewSlotMasterId: id },
      });

      // 未予約のスロットの紐付けを解除
      await tx.interviewSlot.updateMany({
        where: {
          interviewSlotMasterId: id,
          isBooked: false,
        },
        data: { interviewSlotMasterId: null },
      });

      // マスタ本体を削除
      await tx.interviewSlotMaster.delete({ where: { id } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'InterviewSlotMaster',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `面接スロットマスタ「${beforeData.name}」を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('InterviewSlotMaster Delete Error:', error);
    return NextResponse.json({ error: '面接スロットマスタの削除に失敗しました' }, { status: 500 });
  }
}
