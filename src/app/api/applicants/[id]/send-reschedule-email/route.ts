import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { deleteGoogleCalendarEvent } from '@/lib/google-meet';
import { unbookSlotForApplicant } from '@/lib/interview-slot-helpers';
import { sendInterviewInvitationEmail } from '@/lib/mailer';
import crypto from 'crypto';

// POST /api/applicants/[id]/send-reschedule-email
// 管理者: 面接スロットを解放し、応募者に新しい日程を選べるリンクをメールで送信
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
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 応募者+スロット取得
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: {
        interviewSlot: true,
        interviewSlotApplicants: {
          include: { interviewSlot: true },
          take: 1,
        },
        jobCategory: { select: { nameJa: true, nameEn: true } },
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    const linkedSlot = applicant.interviewSlotApplicants[0]?.interviewSlot || applicant.interviewSlot;
    if (!linkedSlot) {
      return NextResponse.json({ error: '面接スロットが紐付いていません' }, { status: 400 });
    }

    const slotId = linkedSlot.id;
    const oldCalendarEventId = linkedSlot.calendarEventId;

    // managementToken がなければ生成
    let token = applicant.managementToken;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
    }

    await prisma.$transaction(async (tx) => {
      // スロット解放（中間テーブル + レガシー）
      await unbookSlotForApplicant(tx, slotId, applicantId);

      // managementToken を保存（flowStatus は INTERVIEW_WAITING のまま維持）
      await tx.applicant.update({
        where: { id: applicantId },
        data: { managementToken: token },
      });

      // 監査ログ
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'Applicant',
        targetId: applicantId,
        ipAddress: ip,
        description: `応募者「${applicant.name}」の面接スロットを解放し、日程変更メールを送信（スロットID: ${slotId}）`,
        tx,
      });
    });

    // Google Calendar イベントを削除（トランザクション外で非同期実行）
    if (oldCalendarEventId) {
      deleteGoogleCalendarEvent(oldCalendarEventId).catch(() => {});
    }

    // 面接予約リンク付きメールを送信
    const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
    const bookingUrl = `${siteUrl}/interview-booking?token=${token}`;
    const lang = applicant.language || 'ja';
    const jobName = lang === 'en'
      ? (applicant.jobCategory?.nameEn || applicant.jobCategory?.nameJa || '')
      : (applicant.jobCategory?.nameJa || '');

    await sendInterviewInvitationEmail(
      applicant.email,
      applicant.name,
      lang,
      bookingUrl,
      jobName,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send Reschedule Email Error:', error);
    return NextResponse.json({ error: '日程変更メールの送信に失敗しました' }, { status: 500 });
  }
}
