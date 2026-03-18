import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyPassword, hashPassword, matchesBirthdayPassword, birthdayToYYYYMMDD } from '@/lib/password';
import { writeAuditLog, getIpAddress } from '@/lib/audit';


export async function POST(request: Request) {
  const ip = getIpAddress(request);
  const ua = request.headers.get('user-agent');

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 });
    }

    const distributor = await prisma.flyerDistributor.findFirst({
      where: { email },
    });

    if (!distributor) {
      await writeAuditLog({
        actorType: 'STAFF',
        action: 'LOGIN_FAILURE',
        targetModel: 'FlyerDistributor',
        description: `スタッフログイン失敗: email="${email}"（ユーザー不存在）`,
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが間違っています。' }, { status: 401 });
    }

    let { verified, needsUpgrade } = await verifyPassword(password, distributor.passwordHash ?? '');

    // 初期パスワード（誕生日）の場合、ゼロ省略入力を許容する
    // 例: 19931101 を 1993111 と入力してもログイン可能
    if (!verified && distributor.isPasswordTemp && distributor.birthday) {
      if (matchesBirthdayPassword(password, distributor.birthday)) {
        // 正規のYYYYMMDDで検証し直す
        const canonical = birthdayToYYYYMMDD(distributor.birthday);
        const retryResult = await verifyPassword(canonical, distributor.passwordHash ?? '');
        verified = retryResult.verified;
        needsUpgrade = retryResult.needsUpgrade;
      }
    }

    if (!verified) {
      await writeAuditLog({
        actorType: 'STAFF',
        actorId: distributor.id,
        actorName: distributor.name,
        action: 'LOGIN_FAILURE',
        targetModel: 'FlyerDistributor',
        targetId: distributor.id,
        description: `スタッフログイン失敗: パスワード不一致 (${distributor.name})`,
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが間違っています。' }, { status: 401 });
    }

    if (needsUpgrade) {
      // ゼロ省略入力の場合も正規のYYYYMMDDでbcryptにアップグレード
      const canonicalPassword = (distributor.isPasswordTemp && distributor.birthday)
        ? birthdayToYYYYMMDD(distributor.birthday)
        : password;
      const newHash = await hashPassword(canonicalPassword);
      await prisma.flyerDistributor.update({ where: { id: distributor.id }, data: { passwordHash: newHash } });
    }

    const cookieStore = await cookies();
    cookieStore.set('pms_distributor_session', distributor.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30日間有効
    });

    await writeAuditLog({
      actorType: 'STAFF',
      actorId: distributor.id,
      actorName: distributor.name,
      action: 'LOGIN_SUCCESS',
      targetModel: 'FlyerDistributor',
      targetId: distributor.id,
      description: `スタッフログイン成功: ${distributor.name}`,
      ipAddress: ip,
      userAgent: ua,
    });

    return NextResponse.json({
      success: true,
      isPasswordTemp: distributor.isPasswordTemp,
      hasSeenOnboarding: distributor.hasSeenOnboarding,
      language: distributor.language || 'ja',
      user: { name: distributor.name, staffId: distributor.staffId, phone: distributor.phone },
    });
  } catch (error) {
    console.error('Distributor Login API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
