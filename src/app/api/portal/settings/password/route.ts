import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import crypto from 'crypto';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId }, select: { passwordHash: true } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json({ hasPassword: !!contact.passwordHash });
  } catch (error) {
    console.error('Password GET error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '現在のパスワードと新しいパスワードを入力してください' }, { status: 400 });
    }

    // Validate new password: 8+ chars, uppercase, lowercase, digit or symbol
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

    // Verify current password
    const currentHash = crypto.createHash('sha256').update(currentPassword).digest('hex');
    if (contact.passwordHash !== currentHash) {
      return NextResponse.json({ error: '現在のパスワードが正しくありません' }, { status: 400 });
    }

    // Update password
    const newHash = crypto.createHash('sha256').update(newPassword).digest('hex');
    await prisma.customerContact.update({
      where: { id: contactId },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'パスワード変更中にエラーが発生しました' }, { status: 500 });
  }
}
