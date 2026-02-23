import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentContactId = parseInt((session.user as any).id);
    const currentContact = await prisma.customerContact.findUnique({ where: { id: currentContactId } });
    if (!currentContact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    // 権限チェック: 主担当のみ編集可能
    if (!currentContact.isPrimary) {
      return NextResponse.json({ error: '担当者の編集は主担当のみ可能です' }, { status: 403 });
    }

    const { id } = await params;
    const targetId = parseInt(id);
    const target = await prisma.customerContact.findUnique({ where: { id: targetId } });
    if (!target || target.customerId !== currentContact.customerId) {
      return NextResponse.json({ error: '対象の担当者が見つかりません' }, { status: 404 });
    }

    const body = await request.json();
    const { lastName, firstName, lastNameKana, firstNameKana, department, position, email, mobilePhone, directLine, isPrimary, isBillingContact, defaultDeliveryAddressId } = body;

    if (!lastName?.trim() || !firstName?.trim()) {
      return NextResponse.json({ error: '姓と名は必須です' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
    }

    // Check email uniqueness (excluding self)
    const existing = await prisma.customerContact.findFirst({
      where: { email: email.trim(), id: { not: targetId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に使用されています' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      lastNameKana: lastNameKana?.trim() || null,
      firstNameKana: firstNameKana?.trim() || null,
      department: department?.trim() || null,
      position: position?.trim() || null,
      email: email.trim(),
      mobilePhone: mobilePhone?.trim() || null,
      directLine: directLine?.trim() || null,
      isBillingContact: !!isBillingContact,
    };

    // デフォルト納品先住所の更新
    if (defaultDeliveryAddressId !== undefined) {
      updateData.defaultDeliveryAddressId = defaultDeliveryAddressId ? parseInt(defaultDeliveryAddressId) : null;
    }

    // If setting as primary, clear other primaries in transaction
    if (isPrimary && !target.isPrimary) {
      await prisma.$transaction([
        prisma.customerContact.updateMany({
          where: { customerId: currentContact.customerId, isPrimary: true },
          data: { isPrimary: false },
        }),
        prisma.customerContact.update({
          where: { id: targetId },
          data: { ...updateData, isPrimary: true },
        }),
      ]);
    } else {
      await prisma.customerContact.update({
        where: { id: targetId },
        data: { ...updateData, isPrimary: isPrimary ?? target.isPrimary },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact PUT error:', error);
    return NextResponse.json({ error: '更新中にエラーが発生しました' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentContactId = parseInt((session.user as any).id);
    const currentContact = await prisma.customerContact.findUnique({ where: { id: currentContactId } });
    if (!currentContact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    // 権限チェック: 主担当のみ削除可能
    if (!currentContact.isPrimary) {
      return NextResponse.json({ error: '担当者の削除は主担当のみ可能です' }, { status: 403 });
    }

    const { id } = await params;
    const targetId = parseInt(id);

    // Cannot delete self
    if (targetId === currentContactId) {
      return NextResponse.json({ error: '自分自身を削除することはできません' }, { status: 400 });
    }

    const target = await prisma.customerContact.findUnique({ where: { id: targetId } });
    if (!target || target.customerId !== currentContact.customerId) {
      return NextResponse.json({ error: '対象の担当者が見つかりません' }, { status: 404 });
    }

    // Cannot delete if last remaining contact
    const count = await prisma.customerContact.count({ where: { customerId: currentContact.customerId } });
    if (count <= 1) {
      return NextResponse.json({ error: '最後の担当者を削除することはできません' }, { status: 400 });
    }

    await prisma.customerContact.delete({ where: { id: targetId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact DELETE error:', error);
    return NextResponse.json({ error: '削除中にエラーが発生しました' }, { status: 500 });
  }
}
