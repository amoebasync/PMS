import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { sendEmployeeWelcomeEmail } from '@/lib/mailer';

const prisma = new PrismaClient();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const empId = parseInt(id);
    if (isNaN(empId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
    });
    if (!employee) {
      return NextResponse.json({ error: '社員が見つかりません' }, { status: 404 });
    }

    // 初期パスワード = 生年月日 (YYYYMMDD)。未設定の場合は今日の日付
    const birthdayStr = employee.birthday
      ? new Date(employee.birthday).toISOString().slice(0, 10).replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const hash = crypto.createHash('sha256').update(birthdayStr).digest('hex');

    // パスワードをリセットし、初回変更フラグを立てる
    await prisma.employee.update({
      where: { id: empId },
      data: {
        passwordHash: hash,
        mustChangePassword: true,
      },
    });

    const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
    await sendEmployeeWelcomeEmail(
      employee.email,
      employee.lastNameJa,
      employee.firstNameJa,
      employee.employeeCode ?? '',
      birthdayStr,
      `${siteUrl}/login`,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send welcome email error:', error);
    return NextResponse.json({ error: 'メールの送信に失敗しました' }, { status: 500 });
  }
}
