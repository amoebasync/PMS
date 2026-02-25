import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password, confirmPassword } = body;

    if (!token || !password || !confirmPassword) {
      return NextResponse.json({ error: 'すべての項目を入力してください' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'パスワードが一致しません' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 });
    }

    // トークンを検索
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { employee: true },
    });

    if (!resetToken) {
      return NextResponse.json({ error: 'このリンクは無効です' }, { status: 400 });
    }

    if (resetToken.usedAt) {
      return NextResponse.json({ error: 'このリンクはすでに使用済みです' }, { status: 400 });
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json({ error: 'このリンクは有効期限切れです。再度パスワードリセットをリクエストしてください' }, { status: 400 });
    }

    if (!resetToken.employee.isActive) {
      return NextResponse.json({ error: 'このアカウントは無効です' }, { status: 400 });
    }

    const newHash = crypto.createHash('sha256').update(password).digest('hex');

    // トランザクションでパスワード更新とトークン使用済みマークを同時に行う
    await prisma.$transaction([
      prisma.employee.update({
        where: { id: resetToken.employeeId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset Password API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

// トークンの有効性確認（GETリクエスト）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'トークンが指定されていません' }, { status: 400 });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json({ valid: false, error: 'このリンクは無効です' });
    }

    if (resetToken.usedAt) {
      return NextResponse.json({ valid: false, error: 'このリンクはすでに使用済みです' });
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json({ valid: false, error: 'このリンクは有効期限切れです' });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Reset Password Token Check Error:', error);
    return NextResponse.json({ valid: false, error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
