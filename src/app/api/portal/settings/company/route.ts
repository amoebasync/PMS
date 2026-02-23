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
        id: true, name: true, nameKana: true, customerType: true,
        postalCode: true, address: true, addressBuilding: true,
        phone: true, fax: true, industryId: true,
      },
    });

    const industries = await prisma.industry.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    return NextResponse.json({ customer, industries });
  } catch (error) {
    console.error('Company GET error:', error);
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
    const { name, nameKana, postalCode, address, addressBuilding, phone, fax, industryId } = body;

    // customerTypeに応じたバリデーションメッセージ
    const customer = await prisma.customer.findUnique({
      where: { id: contact.customerId },
      select: { customerType: true },
    });
    const isIndividual = customer?.customerType === 'INDIVIDUAL';

    if (!name || !name.trim()) {
      return NextResponse.json({ error: isIndividual ? 'お名前は必須です' : '会社名は必須です' }, { status: 400 });
    }

    await prisma.customer.update({
      where: { id: contact.customerId },
      data: {
        name: name.trim(),
        nameKana: nameKana?.trim() || null,
        postalCode: postalCode?.trim() || null,
        address: address?.trim() || null,
        addressBuilding: addressBuilding?.trim() || null,
        phone: phone?.trim() || null,
        fax: fax?.trim() || null,
        industryId: industryId ? parseInt(industryId) : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Company PUT error:', error);
    return NextResponse.json({ error: '保存中にエラーが発生しました' }, { status: 500 });
  }
}
