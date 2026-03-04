import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { createGoogleMeetEvent, isGoogleMeetConfigured, deleteGoogleCalendarEvent } from '@/lib/google-meet';

// POST /api/applicants/[id]/reschedule
// 管理者: 面接日程を変更（旧スロット解放 → 新スロット予約）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const applicantId = parseInt(id);
    const body = await request.json();
    const { newSlotId } = body;

    if (!newSlotId) {
      return NextResponse.json({ error: '新しいスロットIDが必要です' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 応募者+現在のスロットを取得
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { interviewSlot: true, jobCategory: true },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    const oldSlotId = applicant.interviewSlot?.id;
    const oldCalendarEventId = applicant.interviewSlot?.calendarEventId;

    // 新スロットの確認
    const newSlot = await prisma.interviewSlot.findUnique({
      where: { id: Number(newSlotId) },
      include: {
        interviewer: { select: { email: true } },
        interviewSlotMaster: true,
      },
    });

    if (!newSlot) {
      return NextResponse.json({ error: '指定されたスロットが見つかりません' }, { status: 404 });
    }

    if (newSlot.isBooked) {
      return NextResponse.json({ error: 'このスロットは既に予約されています' }, { status: 409 });
    }

    if (new Date(newSlot.startTime) <= new Date()) {
      return NextResponse.json({ error: '過去のスロットは選択できません' }, { status: 400 });
    }

    // ミーティングURL決定（マスタのmeetingTypeに応じて分岐）
    const slotMaster = newSlot.interviewSlotMaster;
    let meetUrl = newSlot.meetUrl;
    let calendarEventId: string | null = null;

    if (slotMaster?.meetingType === 'ZOOM') {
      // Zoom: マスタに設定された固定URLを使用、Google Calendar操作はスキップ
      meetUrl = slotMaster.zoomUrl || null;
    } else if (!meetUrl && isGoogleMeetConfigured()) {
      // Google Meet: 既存ロジック
      const jobName = applicant.jobCategory?.nameJa || '面接';
      const meetTitle = `【ティラミス】${applicant.name}様 ${jobName} 面接`;
      const meetDescription = `応募者: ${applicant.name}\nメール: ${applicant.email}\n職種: ${jobName}`;

      const meetResult = await createGoogleMeetEvent(
        meetTitle,
        meetDescription,
        newSlot.startTime,
        newSlot.endTime,
        applicant.email,
        newSlot.interviewer?.email || undefined
      );
      meetUrl = meetResult.meetUrl;
      calendarEventId = meetResult.eventId;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 旧スロット解放（存在する場合）
      if (oldSlotId) {
        await tx.interviewSlot.update({
          where: { id: oldSlotId },
          data: {
            isBooked: false,
            applicantId: null,
          },
        });
      }

      // 新スロット予約
      await tx.interviewSlot.update({
        where: { id: Number(newSlotId) },
        data: {
          isBooked: true,
          applicantId: applicantId,
          meetUrl: meetUrl || newSlot.meetUrl,
          calendarEventId: calendarEventId || undefined,
        },
      });

      // 監査ログ
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'InterviewSlot',
        targetId: Number(newSlotId),
        ipAddress: ip,
        description: `応募者「${applicant.name}」の面接を日程変更（旧スロットID: ${oldSlotId || 'なし'} → 新スロットID: ${newSlotId}）`,
        tx,
      });

      // 更新後の応募者を返す
      return tx.applicant.findUnique({
        where: { id: applicantId },
        include: {
          jobCategory: true,
          country: true,
          visaType: true,
          interviewSlot: true,
          recruitingMedia: true,
        },
      });
    });

    // 旧 Google Calendar イベントを削除（トランザクション外で非同期実行、Zoom時はスキップ）
    if (oldCalendarEventId && slotMaster?.meetingType !== 'ZOOM') {
      deleteGoogleCalendarEvent(oldCalendarEventId).catch(() => {});
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Reschedule Error:', error);
    return NextResponse.json({ error: '日程変更に失敗しました' }, { status: 500 });
  }
}
