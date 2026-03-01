import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

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
