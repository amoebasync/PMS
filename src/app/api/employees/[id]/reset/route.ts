import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { birthday: true },
    });

    if (!employee) {
      return NextResponse.json({ error: '社員が見つかりません' }, { status: 404 });
    }

    if (!employee.birthday) {
      return NextResponse.json(
        { error: '生年月日が未登録のためリセットできません。先に生年月日を登録してください。' },
        { status: 400 }
      );
    }

    const y = employee.birthday.getFullYear();
    const m = String(employee.birthday.getMonth() + 1).padStart(2, '0');
    const d = String(employee.birthday.getDate()).padStart(2, '0');
    const rawPassword = `${y}${m}${d}`;
    const hash = await hashPassword(rawPassword);

    await prisma.employee.update({
      where: { id: employeeId },
      data: { passwordHash: hash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return NextResponse.json({ error: 'リセットに失敗しました' }, { status: 500 });
  }
}
