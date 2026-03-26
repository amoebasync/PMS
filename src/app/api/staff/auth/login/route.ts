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

    // --- 1. 配布員として検索 ---
    let distributor = await prisma.flyerDistributor.findFirst({
      where: { email },
    });

    let isEmployeeLogin = false;

    if (distributor) {
      // 配布員のパスワード検証
      let { verified, needsUpgrade } = await verifyPassword(password, distributor.passwordHash ?? '');

      // 初期パスワード（誕生日）の場合、ゼロ省略入力を許容する
      if (!verified && distributor.isPasswordTemp && distributor.birthday) {
        if (matchesBirthdayPassword(password, distributor.birthday)) {
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
        const canonicalPassword = (distributor.isPasswordTemp && distributor.birthday)
          ? birthdayToYYYYMMDD(distributor.birthday)
          : password;
        const newHash = await hashPassword(canonicalPassword);
        await prisma.flyerDistributor.update({ where: { id: distributor.id }, data: { passwordHash: newHash } });
      }
    } else {
      // --- 2. 社員として検索（スタッフポータルへの社員ログイン） ---
      const employee = await prisma.employee.findFirst({
        where: { email, isActive: true },
        include: { linkedDistributor: { select: { id: true } } },
      });

      if (!employee || !employee.passwordHash) {
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

      const { verified: empVerified } = await verifyPassword(password, employee.passwordHash);
      if (!empVerified) {
        await writeAuditLog({
          actorType: 'STAFF',
          action: 'LOGIN_FAILURE',
          targetModel: 'Employee',
          targetId: employee.id,
          description: `スタッフポータル社員ログイン失敗: パスワード不一致 (${employee.lastNameJa} ${employee.firstNameJa})`,
          ipAddress: ip,
          userAgent: ua,
        });
        return NextResponse.json({ error: 'メールアドレスまたはパスワードが間違っています。' }, { status: 401 });
      }

      // 紐付け配布員があればそのID、なければテスト太郎（ID: 389）
      const distributorId = employee.linkedDistributor?.id || 389;
      distributor = await prisma.flyerDistributor.findUnique({ where: { id: distributorId } });

      if (!distributor) {
        return NextResponse.json({ error: 'テスト用配布員アカウントが見つかりません' }, { status: 500 });
      }
      isEmployeeLogin = true;
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
      description: isEmployeeLogin
        ? `社員→スタッフポータルログイン成功: ${distributor.name} (社員アカウント経由)`
        : `スタッフログイン成功: ${distributor.name}`,
      ipAddress: ip,
      userAgent: ua,
    });

    return NextResponse.json({
      success: true,
      isPasswordTemp: isEmployeeLogin ? false : distributor.isPasswordTemp,
      hasSeenOnboarding: isEmployeeLogin ? true : distributor.hasSeenOnboarding,
      language: distributor.language || 'ja',
      user: { name: distributor.name, staffId: distributor.staffId, phone: distributor.phone },
    });
  } catch (error) {
    console.error('Distributor Login API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
