import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// DELETE /api/interview-slots/[id]
// 管理者: 空きスロットを削除
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
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const slot = await prisma.interviewSlot.findUnique({ where: { id: slotId } });
    if (!slot) {
      return NextResponse.json({ error: 'スロットが見つかりません' }, { status: 404 });
    }

    if (slot.isBooked) {
      return NextResponse.json(
        { error: '予約済みのスロットは削除できません' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.interviewSlot.delete({ where: { id: slotId } });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'InterviewSlot',
        targetId: slotId,
        beforeData: slot as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `面接スロットを削除（${new Date(slot.startTime).toLocaleString('ja-JP')}）`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Interview Slot Delete Error:', error);
    return NextResponse.json({ error: 'スロットの削除に失敗しました' }, { status: 500 });
  }
}
