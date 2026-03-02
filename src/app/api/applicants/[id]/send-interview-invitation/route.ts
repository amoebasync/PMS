import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sendInterviewInvitationEmail } from '@/lib/mailer';
import crypto from 'crypto';

// POST /api/applicants/[id]/send-interview-invitation
// 管理者: 面接日程調整リンクをメールで送信する
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const applicant = await prisma.applicant.findUnique({
      where: { id: Number(id) },
      include: {
        jobCategory: { select: { nameJa: true, nameEn: true } },
        interviewSlot: { select: { id: true } },
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    if (applicant.interviewSlot) {
      return NextResponse.json({ error: 'すでに面接スロットが予約されています' }, { status: 409 });
    }

    // managementToken がなければ生成して保存
    let token = applicant.managementToken;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await prisma.applicant.update({
        where: { id: applicant.id },
        data: { managementToken: token },
      });
    }

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
    console.error('Send Interview Invitation Error:', error);
    return NextResponse.json({ error: '招待メールの送信に失敗しました' }, { status: 500 });
  }
}
