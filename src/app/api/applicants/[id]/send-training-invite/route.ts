import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sendTrainingInviteEmail } from '@/lib/mailer';

// POST /api/applicants/[id]/send-training-invite
// 管理者: 応募者に研修日程選択メールを送信
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const applicantId = parseInt(id);

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { jobCategory: true },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    if (!applicant.email) {
      return NextResponse.json({ error: 'メールアドレスが設定されていません' }, { status: 400 });
    }

    if (!applicant.managementToken) {
      return NextResponse.json({ error: '管理トークンが設定されていません' }, { status: 400 });
    }

    const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
    const bookingUrl = `${siteUrl}/training-booking?token=${applicant.managementToken}`;
    const jobName = applicant.jobCategory?.nameJa || applicant.jobCategory?.nameEn || '';

    await sendTrainingInviteEmail(
      applicant.email,
      applicant.name,
      applicant.language || 'ja',
      bookingUrl,
      jobName,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send Training Invite Error:', error);
    return NextResponse.json({ error: '研修案内メールの送信に失敗しました' }, { status: 500 });
  }
}
