import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { sendDistributorWelcomeEmail } from '@/lib/mailer';

// POST /api/distributors/[id]/send-portal-info
// 管理者: 配布員にポータル案内メールを送信
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const distributorId = parseInt(id);
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
      select: { id: true, staffId: true, name: true, email: true, birthday: true, language: true },
    });

    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    if (!distributor.email) {
      return NextResponse.json({ error: 'メールアドレスが登録されていません' }, { status: 400 });
    }

    if (!distributor.birthday) {
      return NextResponse.json({ error: '生年月日が登録されていません' }, { status: 400 });
    }

    const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
    const loginUrl = `${siteUrl}/staff/login`;
    const birthday = distributor.birthday;
    const birthdayPassword = `${birthday.getFullYear()}${String(birthday.getMonth() + 1).padStart(2, '0')}${String(birthday.getDate()).padStart(2, '0')}`;

    await sendDistributorWelcomeEmail(
      distributor.email,
      distributor.name,
      distributor.language || 'ja',
      distributor.staffId,
      birthdayPassword,
      loginUrl,
    );

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'CREATE',
      targetModel: 'FlyerDistributor',
      targetId: distributorId,
      description: `配布員ポータル案内メールを送信（${distributor.name} / ${distributor.email}）`,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send Portal Info Error:', error);
    return NextResponse.json({ error: 'ポータル案内メールの送信に失敗しました' }, { status: 500 });
  }
}
