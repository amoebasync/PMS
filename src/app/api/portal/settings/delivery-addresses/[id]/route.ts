import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const { id } = await params;
    const targetId = parseInt(id);
    const target = await prisma.customerDeliveryAddress.findUnique({ where: { id: targetId } });
    if (!target || target.customerId !== contact.customerId) {
      return NextResponse.json({ error: '対象の納品先住所が見つかりません' }, { status: 404 });
    }

    const body = await request.json();
    const { label, organizationName, recipientName, postalCode, address, addressBuilding, phone, setAsMyDefault } = body;

    if (!label?.trim()) {
      return NextResponse.json({ error: 'ラベル名は必須です' }, { status: 400 });
    }

    await prisma.customerDeliveryAddress.update({
      where: { id: targetId },
      data: {
        label: label.trim(),
        organizationName: organizationName?.trim() || null,
        recipientName: recipientName?.trim() || null,
        postalCode: postalCode?.trim() || null,
        address: address?.trim() || null,
        addressBuilding: addressBuilding?.trim() || null,
        phone: phone?.trim() || null,
      },
    });

    // 自分のデフォルト納品先として設定
    if (setAsMyDefault) {
      await prisma.customerContact.update({
        where: { id: contactId },
        data: { defaultDeliveryAddressId: targetId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DeliveryAddress PUT error:', error);
    return NextResponse.json({ error: '更新中にエラーが発生しました' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const { id } = await params;
    const targetId = parseInt(id);
    const target = await prisma.customerDeliveryAddress.findUnique({ where: { id: targetId } });
    if (!target || target.customerId !== contact.customerId) {
      return NextResponse.json({ error: '対象の納品先住所が見つかりません' }, { status: 404 });
    }

    // 参照中のContactのdefaultDeliveryAddressIdをnullに
    await prisma.customerContact.updateMany({
      where: { defaultDeliveryAddressId: targetId },
      data: { defaultDeliveryAddressId: null },
    });

    await prisma.customerDeliveryAddress.delete({ where: { id: targetId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DeliveryAddress DELETE error:', error);
    return NextResponse.json({ error: '削除中にエラーが発生しました' }, { status: 500 });
  }
}
