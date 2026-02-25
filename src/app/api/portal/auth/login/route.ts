import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyPassword, hashPassword } from '@/lib/password';


export async function POST(request: Request) {
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
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが間違っています。' }, { status: 401 });
    }

    const { verified, needsUpgrade } = await verifyPassword(password, contact.passwordHash ?? '');
    if (!verified) {
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

    return NextResponse.json({ success: true, user: { name: `${contact.lastName} ${contact.firstName}`, company: contact.customer.name } });

  } catch (error) {
    console.error('Portal Login API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}