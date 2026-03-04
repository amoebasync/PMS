import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { updateGoogleCalendarAttendees } from '@/lib/google-meet';

// PATCH /api/interview-slots/[id]
// 管理者: スロットの担当者を変更
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
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.interviewSlot.findUnique({
      where: { id: slotId },
      include: { applicant: { select: { email: true } } },
    });
    if (!beforeData) {
      return NextResponse.json({ error: 'スロットが見つかりません' }, { status: 404 });
    }

    const interviewerId = body.interviewerId != null ? Number(body.interviewerId) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.interviewSlot.update({
        where: { id: slotId },
        data: { interviewerId },
        include: {
          interviewer: { select: { id: true, lastNameJa: true, firstNameJa: true, email: true } },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'InterviewSlot',
        targetId: slotId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `面接スロットの担当者を変更（${result.interviewer ? `${result.interviewer.lastNameJa} ${result.interviewer.firstNameJa}` : '未設定'}）`,
        tx,
      });

      return result;
    });

    // Google Calendar イベントの参加者を更新（calendarEventId がある場合のみ）
    if (beforeData.calendarEventId) {
      updateGoogleCalendarAttendees(
        beforeData.calendarEventId,
        beforeData.applicant?.email,
        updated.interviewer?.email
      ).catch((err) => console.error('Calendar attendee update failed:', err));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Interview Slot Update Error:', error);
    return NextResponse.json({ error: 'スロットの更新に失敗しました' }, { status: 500 });
  }
}

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

    const bookingCount = await prisma.interviewSlotApplicant.count({ where: { interviewSlotId: slotId } });
    if (bookingCount > 0 || slot.isBooked) {
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
