import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyPassword, hashPassword } from '@/lib/password';
import { writeAuditLog, getIpAddress } from '@/lib/audit';


export async function POST(request: Request) {
  const ip = getIpAddress(request);
  const ua = request.headers.get('user-agent');

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 });
    }

    const contact = await prisma.customerContact.findFirst({
      where: { email },
      include: { customer: true },
    });

    if (!contact || contact.customer.status === 'INVALID') {
      await writeAuditLog({
        actorType: 'PORTAL_USER',
        action: 'LOGIN_FAILURE',
        targetModel: 'CustomerContact',
        description: `ポータルログイン失敗: email="${email}"（ユーザー不存在またはアカウント無効）`,
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが間違っています。' }, { status: 401 });
    }

    const { verified, needsUpgrade } = await verifyPassword(password, contact.passwordHash ?? '');
    if (!verified) {
      await writeAuditLog({
        actorType: 'PORTAL_USER',
        actorId: contact.id,
        actorName: `${contact.lastName} ${contact.firstName}`,
        action: 'LOGIN_FAILURE',
        targetModel: 'CustomerContact',
        targetId: contact.id,
        description: `ポータルログイン失敗: パスワード不一致 (${contact.customer.name})`,
        ipAddress: ip,
        userAgent: ua,
      });
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが間違っています。' }, { status: 401 });
    }

    // SHA-256ハッシュの場合はbcryptに自動アップグレード + 最終ログイン日時更新
    const updateData: Record<string, unknown> = { lastLoginAt: new Date() };
    if (needsUpgrade) {
      updateData.passwordHash = await hashPassword(password);
    }
    prisma.customerContact.update({ where: { id: contact.id }, data: updateData }).catch(console.error);

    // クライアント専用のCookieを発行
    const cookieStore = await cookies();
    cookieStore.set('pms_portal_session', contact.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30日間有効
    });

    await writeAuditLog({
      actorType: 'PORTAL_USER',
      actorId: contact.id,
      actorName: `${contact.lastName} ${contact.firstName}`,
      action: 'LOGIN_SUCCESS',
      targetModel: 'CustomerContact',
      targetId: contact.id,
      description: `ポータルログイン成功: ${contact.customer.name}`,
      ipAddress: ip,
      userAgent: ua,
    });

    return NextResponse.json({ success: true, user: { name: `${contact.lastName} ${contact.firstName}`, company: contact.customer.name } });

  } catch (error) {
    console.error('Portal Login API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}