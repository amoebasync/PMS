import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { createGoogleMeetEvent, isGoogleMeetConfigured, deleteGoogleCalendarEvent } from '@/lib/google-meet';
import { isSlotAvailable, bookSlotForApplicant, unbookSlotForApplicant } from '@/lib/interview-slot-helpers';
import { sendApplicantConfirmationEmail } from '@/lib/mailer';

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
      include: {
        interviewSlot: true,
        interviewSlotApplicants: {
          include: { interviewSlot: true },
          take: 1,
        },
        jobCategory: true,
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    const linkedSlot = applicant.interviewSlotApplicants[0]?.interviewSlot || applicant.interviewSlot;
    const oldSlotId = linkedSlot?.id;
    const oldCalendarEventId = linkedSlot?.calendarEventId;

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

    const newSlotAvailable = await isSlotAvailable(prisma, newSlot.id);
    if (!newSlotAvailable) {
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
      // 旧スロット解放（存在する場合、中間テーブル + レガシー）
      if (oldSlotId) {
        await unbookSlotForApplicant(tx, oldSlotId, applicantId);
      }

      // 新スロット予約（中間テーブル + レガシー）
      await bookSlotForApplicant(tx, Number(newSlotId), applicantId, meetUrl || newSlot.meetUrl, calendarEventId);

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

    // 面接日程変更の確認メールを送信
    const lang = applicant.language || 'ja';
    const isEn = lang === 'en';
    const finalMeetUrl = meetUrl || newSlot.meetUrl;
    const interviewDate = new Date(newSlot.startTime).toLocaleDateString(
      isEn ? 'en-US' : 'ja-JP',
      { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Tokyo' }
    );
    const interviewTime = `${new Date(newSlot.startTime).toLocaleTimeString(
      isEn ? 'en-US' : 'ja-JP',
      { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }
    )} - ${new Date(newSlot.endTime).toLocaleTimeString(
      isEn ? 'en-US' : 'ja-JP',
      { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }
    )}`;
    const jobName = isEn
      ? (applicant.jobCategory?.nameEn || applicant.jobCategory?.nameJa || '')
      : (applicant.jobCategory?.nameJa || '');

    sendApplicantConfirmationEmail(
      applicant.email,
      applicant.name,
      lang,
      interviewDate,
      interviewTime,
      finalMeetUrl,
      jobName,
      applicant.managementToken,
      (slotMaster?.meetingType as string) || 'GOOGLE_MEET',
      slotMaster?.zoomMeetingNumber,
      slotMaster?.zoomPassword,
    ).catch((err) => console.error('Reschedule confirmation email failed:', err));

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Reschedule Error:', error);
    return NextResponse.json({ error: '日程変更に失敗しました' }, { status: 500 });
  }
}
