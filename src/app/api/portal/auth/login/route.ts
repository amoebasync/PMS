import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    const contact = await prisma.customerContact.findFirst({
      where: {
        email: email,
        passwordHash: hash,
      },
      include: {
        customer: true // 紐づく企業情報も取得
      }
    });

    if (!contact || contact.customer.status === 'INVALID') {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが間違っています。' }, { status: 401 });
    }

    // 最終ログイン日時を更新 (awaitせずに裏で実行)
    prisma.customerContact.update({
      where: { id: contact.id },
      data: { lastLoginAt: new Date() }
    }).catch(console.error);

    // クライアント専用のCookieを発行
    const cookieStore = await cookies();
    cookieStore.set('pms_portal_session', contact.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30日間有効
    });

    return NextResponse.json({ success: true, user: { name: contact.name, company: contact.customer.name } });

  } catch (error) {
    console.error('Portal Login API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}