import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: '未ログインです' }, { status: 401 });
    }

    const employeeId = parseInt(sessionId);
    const { newPassword, confirmPassword } = await request.json();

    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: '新しいパスワードを入力してください' }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'パスワードが一致しません' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'パスワードは8文字以上で設定してください' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(newPassword).digest('hex');

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        passwordHash: hash,
        mustChangePassword: false,
      },
    });

    // 強制変更フラグ Cookie を削除
    cookieStore.delete('pms_force_pw_change');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change Password Error:', error);
    return NextResponse.json({ error: 'パスワードの変更に失敗しました' }, { status: 500 });
  }
}
