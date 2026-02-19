import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, password } = body;

    if (!accountId || !password) {
      return NextResponse.json({ error: 'IDとパスワードを入力してください' }, { status: 400 });
    }

    // 1. 入力されたパスワードを同じ方式(SHA-256)でハッシュ化
    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // 2. データベースから社員を検索 (社員コード or メールアドレス どちらでもログイン可)
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { employeeCode: accountId },
          { email: accountId }
        ],
        passwordHash: hash, // ハッシュ化したパスワードが一致するか
        isActive: true      // 退職済(false)のアカウントは弾く
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'IDまたはパスワードが間違っています。' }, { status: 401 });
    }

    // 3. 認証成功: Cookieにセッション情報を保存 (Next.js 15+ の書き方)
    const cookieStore = await cookies();
    cookieStore.set('pms_session', employee.id.toString(), {
      httpOnly: true, // JavaScriptからのアクセスを禁止（セキュリティ対策）
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7日間有効
    });

    return NextResponse.json({ success: true, user: { name: employee.lastNameJa } });

  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}