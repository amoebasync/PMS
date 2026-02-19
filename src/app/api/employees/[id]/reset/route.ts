import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    // 1. ランダムなパスワードを生成 (8文字)
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2);

    // 2. ハッシュ化
    const hash = crypto.createHash('sha256').update(newPassword).digest('hex');

    // 3. DB更新
    await prisma.employee.update({
      where: { id: employeeId },
      data: { passwordHash: hash },
    });

    // 4. 新しいパスワードをレスポンスで返す（画面表示用）
    // ※セキュリティ上、ここでしか表示しません
    return NextResponse.json({ newPassword });

  } catch (error) {
    console.error('Reset Password Error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}