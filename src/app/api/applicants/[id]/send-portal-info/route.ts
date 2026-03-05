import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { sendDistributorWelcomeEmail } from '@/lib/mailer';

// POST /api/applicants/[id]/send-portal-info
// 管理者: 配布員登録済みの応募者に配布員ポータル案内メールを再送信
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

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    // 配布員レコードを取得
    const distributor = await prisma.flyerDistributor.findFirst({
      where: { email: applicant.email },
      select: { id: true, staffId: true },
    });

    if (!distributor) {
      return NextResponse.json({ error: '配布員として登録されていません' }, { status: 400 });
    }

    if (!applicant.birthday) {
      return NextResponse.json({ error: '応募者の生年月日が登録されていません' }, { status: 400 });
    }

    const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
    const loginUrl = `${siteUrl}/staff/login`;
    const birthday = applicant.birthday;
    const birthdayPassword = `${birthday.getFullYear()}${String(birthday.getMonth() + 1).padStart(2, '0')}${String(birthday.getDate()).padStart(2, '0')}`;

    await sendDistributorWelcomeEmail(
      applicant.email,
      applicant.name,
      applicant.language || 'ja',
      distributor.staffId,
      birthdayPassword,
      loginUrl,
    );

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'CREATE',
      targetModel: 'Applicant',
      targetId: applicantId,
      description: `配布員ポータル案内メールを送信（${applicant.name} / ${applicant.email}）`,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send Portal Info Error:', error);
    return NextResponse.json({ error: 'ポータル案内メールの送信に失敗しました' }, { status: 500 });
  }
}
