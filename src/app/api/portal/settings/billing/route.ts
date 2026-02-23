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
      select: {
        invoiceRegistrationNumber: true,
        billingCutoffDay: true,
        paymentMonthDelay: true,
        paymentDay: true,
        defaultPaymentMethod: true,
      },
    });

    return NextResponse.json({ billing: customer });
  } catch (error) {
    console.error('Billing GET error:', error);
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
    const { invoiceRegistrationNumber, billingCutoffDay, paymentMonthDelay, paymentDay, defaultPaymentMethod } = body;

    // Validate invoice registration number if provided
    if (invoiceRegistrationNumber && !/^T\d{13}$/.test(invoiceRegistrationNumber)) {
      return NextResponse.json({ error: 'インボイス登録番号はT+13桁の数字で入力してください' }, { status: 400 });
    }

    await prisma.customer.update({
      where: { id: contact.customerId },
      data: {
        invoiceRegistrationNumber: invoiceRegistrationNumber?.trim() || null,
        billingCutoffDay: billingCutoffDay != null ? parseInt(billingCutoffDay) : null,
        paymentMonthDelay: paymentMonthDelay != null ? parseInt(paymentMonthDelay) : null,
        paymentDay: paymentDay != null ? parseInt(paymentDay) : null,
        defaultPaymentMethod: defaultPaymentMethod || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Billing PUT error:', error);
    return NextResponse.json({ error: '保存中にエラーが発生しました' }, { status: 500 });
  }
}
