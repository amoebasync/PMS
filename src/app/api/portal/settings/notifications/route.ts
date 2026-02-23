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

    const customer = await prisma.customer.findUnique({
      where: { id: contact.customerId },
      select: { wantsNewsletter: true },
    });

    return NextResponse.json({
      wantsNewsletter: customer?.wantsNewsletter ?? true,
      notifyOrderStatus: contact.notifyOrderStatus,
      notifyQrScan: contact.notifyQrScan,
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
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

    const body = await request.json();
    const { wantsNewsletter, notifyOrderStatus, notifyQrScan } = body;

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: contact.customerId },
        data: { wantsNewsletter: !!wantsNewsletter },
      }),
      prisma.customerContact.update({
        where: { id: contactId },
        data: {
          notifyOrderStatus: !!notifyOrderStatus,
          notifyQrScan: !!notifyQrScan,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notifications PUT error:', error);
    return NextResponse.json({ error: '保存中にエラーが発生しました' }, { status: 500 });
  }
}
