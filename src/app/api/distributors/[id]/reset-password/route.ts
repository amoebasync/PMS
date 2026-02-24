import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function buildPasswordFromBirthday(birthday: Date): string {
  const y = birthday.getFullYear();
  const m = String(birthday.getMonth() + 1).padStart(2, '0');
  const d = String(birthday.getDate()).padStart(2, '0');
  return crypto.createHash('sha256').update(`${y}${m}${d}`).digest('hex');
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: parseInt(id) },
      select: { birthday: true },
    });

    if (!distributor) {
      return NextResponse.json({ error: 'スタッフが見つかりません' }, { status: 404 });
    }

    if (!distributor.birthday) {
      return NextResponse.json(
        { error: '生年月日が未登録のためリセットできません。先に生年月日を登録してください。' },
        { status: 400 }
      );
    }

    const passwordHash = buildPasswordFromBirthday(distributor.birthday);

    await prisma.flyerDistributor.update({
      where: { id: parseInt(id) },
      data: { passwordHash, isPasswordTemp: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return NextResponse.json({ error: 'リセットに失敗しました' }, { status: 500 });
  }
}
