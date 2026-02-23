import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const addresses = await prisma.customerDeliveryAddress.findMany({
      where: { customerId: contact.customerId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      addresses,
      myDefaultDeliveryAddressId: contact.defaultDeliveryAddressId,
    });
  } catch (error) {
    console.error('DeliveryAddresses GET error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const body = await request.json();
    const { label, organizationName, recipientName, postalCode, address, addressBuilding, phone } = body;

    if (!label?.trim()) {
      return NextResponse.json({ error: 'ラベル名は必須です' }, { status: 400 });
    }

    const created = await prisma.customerDeliveryAddress.create({
      data: {
        customerId: contact.customerId,
        label: label.trim(),
        organizationName: organizationName?.trim() || null,
        recipientName: recipientName?.trim() || null,
        postalCode: postalCode?.trim() || null,
        address: address?.trim() || null,
        addressBuilding: addressBuilding?.trim() || null,
        phone: phone?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, address: created });
  } catch (error) {
    console.error('DeliveryAddresses POST error:', error);
    return NextResponse.json({ error: '作成中にエラーが発生しました' }, { status: 500 });
  }
}
