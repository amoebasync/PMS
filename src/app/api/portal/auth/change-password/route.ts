import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { verifyPassword, hashPassword } from '@/lib/password';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    if (isNaN(contactId)) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) {
      return NextResponse.json({ error: '担当者が見つかりません' }, { status: 404 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: '全ての項目を入力してください' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: '新しいパスワードが一致しません' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json({ error: 'パスワードに大文字を含めてください' }, { status: 400 });
    }
    if (!/[a-z]/.test(newPassword)) {
      return NextResponse.json({ error: 'パスワードに小文字を含めてください' }, { status: 400 });
    }
    if (!/[\d\W_]/.test(newPassword)) {
      return NextResponse.json({ error: 'パスワードに数字または記号を含めてください' }, { status: 400 });
    }

    const { verified } = await verifyPassword(currentPassword, contact.passwordHash ?? '');
    if (!verified) {
      return NextResponse.json({ error: '現在のパスワードが正しくありません' }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.customerContact.update({
      where: { id: contactId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
