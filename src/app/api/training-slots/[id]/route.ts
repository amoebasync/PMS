import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// PATCH /api/training-slots/[id]
// 管理者: 研修スロット更新（定員・場所・メモ）
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const slotId = parseInt(id);
    const body = await request.json();
    const { capacity, location, note } = body;

    const beforeData = await prisma.trainingSlot.findUnique({ where: { id: slotId } });
    if (!beforeData) {
      return NextResponse.json({ error: 'スロットが見つかりません' }, { status: 404 });
    }

    if (capacity !== undefined && (Number(capacity) < 1 || Number(capacity) > 100)) {
      return NextResponse.json({ error: '定員は1〜100の範囲で指定してください' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.trainingSlot.update({
        where: { id: slotId },
        data: {
          ...(capacity !== undefined && { capacity: Number(capacity) }),
          ...(location !== undefined && { location: location || null }),
          ...(note !== undefined && { note: note || null }),
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'TrainingSlot',
        targetId: slotId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        description: `研修スロットを更新（定員: ${capacity ?? beforeData.capacity}）`,
        ipAddress: ip,
        tx,
      });

      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Training Slot Update Error:', error);
    return NextResponse.json({ error: 'スロットの更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/training-slots/[id]
// 管理者: 研修スロット削除
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
    const slotId = parseInt(id);

    // 削除前データ取得
    const beforeData = await prisma.trainingSlot.findUnique({
      where: { id: slotId },
      include: { _count: { select: { applicants: true } } },
    });

    if (!beforeData) {
      return NextResponse.json({ error: 'スロットが見つかりません' }, { status: 404 });
    }

    // applicantsが紐付いている場合は削除不可
    if (beforeData._count.applicants > 0) {
      return NextResponse.json(
        { error: `このスロットには${beforeData._count.applicants}名の応募者が紐付いているため削除できません` },
        { status: 400 }
      );
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    await prisma.$transaction(async (tx) => {
      await tx.trainingSlot.delete({ where: { id: slotId } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'TrainingSlot',
        targetId: slotId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        description: `研修スロットを削除（${beforeData.startTime.toISOString()}）`,
        ipAddress: ip,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Training Slot Delete Error:', error);
    return NextResponse.json({ error: 'スロットの削除に失敗しました' }, { status: 500 });
  }
}
