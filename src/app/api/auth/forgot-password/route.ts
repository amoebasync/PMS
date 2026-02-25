import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/mailer';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, birthday } = body;

    if (!email || !birthday) {
      return NextResponse.json({ error: 'メールアドレスと生年月日を入力してください' }, { status: 400 });
    }

    // birthday は "YYYY-MM-DD" 形式で受け取る
    const birthdayDate = new Date(birthday);
    if (isNaN(birthdayDate.getTime())) {
      return NextResponse.json({ error: '生年月日の形式が正しくありません' }, { status: 400 });
    }

    // ユーザー情報を取得（存在確認）
    const employee = await prisma.employee.findFirst({
      where: { email, isActive: true },
    });

    // セキュリティ: ユーザーが存在しない・生年月日が一致しない場合も同じレスポンスを返す（ユーザー列挙防止）
    if (employee && employee.birthday) {
      const storedBirthday = employee.birthday;
      const inputBirthday = birthdayDate;

      const sameDate =
        storedBirthday.getFullYear() === inputBirthday.getFullYear() &&
        storedBirthday.getMonth() === inputBirthday.getMonth() &&
        storedBirthday.getDate() === inputBirthday.getDate();

      if (sameDate) {
        // 既存トークンを削除してから新規作成
        await prisma.passwordResetToken.deleteMany({
          where: { employeeId: employee.id },
        });

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

        await prisma.passwordResetToken.create({
          data: {
            token,
            employeeId: employee.id,
            expiresAt,
          },
        });

        const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
        const resetUrl = `${siteUrl}/reset-password?token=${token}`;

        await sendPasswordResetEmail(
          employee.email,
          employee.lastNameJa,
          employee.firstNameJa,
          resetUrl,
        );
      }
    }

    // 常に成功レスポンスを返す（ユーザー列挙防止）
    return NextResponse.json({
      success: true,
      message: '登録されているメールアドレスに、パスワードリセットの案内を送信しました。',
    });
  } catch (error) {
    console.error('Forgot Password API Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
