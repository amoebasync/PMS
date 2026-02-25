import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { hashPassword } from '@/lib/password';


export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 });
    }

    const hash = await hashPassword(password);

    await prisma.flyerDistributor.update({
      where: { id: distributor.id },
      data: {
        passwordHash: hash,
        isPasswordTemp: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change Password Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
