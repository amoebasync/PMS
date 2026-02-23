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
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const customer = await prisma.customer.findUnique({
      where: { id: contact.customerId },
      select: { customerType: true },
    });

    const contacts = await prisma.customerContact.findMany({
      where: { customerId: contact.customerId },
      select: {
        id: true, lastName: true, firstName: true,
        lastNameKana: true, firstNameKana: true,
        department: true, position: true,
        email: true, mobilePhone: true, directLine: true,
        isPrimary: true, isBillingContact: true,
        notifyOrderStatus: true, notifyQrScan: true,
        defaultDeliveryAddressId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      contacts,
      currentContactId: contactId,
      currentContactIsPrimary: contact.isPrimary,
      customerType: customer?.customerType || 'COMPANY',
    });
  } catch (error) {
    console.error('Contacts GET error:', error);
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

    // 権限チェック: 主担当のみ担当者の追加が可能
    if (!contact.isPrimary) {
      return NextResponse.json({ error: '担当者の追加は主担当のみ可能です' }, { status: 403 });
    }

    const body = await request.json();
    const { lastName, firstName, lastNameKana, firstNameKana, department, position, email, mobilePhone, directLine, isPrimary, isBillingContact, password } = body;

    if (!lastName?.trim() || !firstName?.trim()) {
      return NextResponse.json({ error: '姓と名は必須です' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'メールアドレスは必須です' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'パスワードは8文字以上で入力してください' }, { status: 400 });
    }

    // Check email uniqueness
    const existing = await prisma.customerContact.findFirst({ where: { email: email.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に使用されています' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // If setting as primary, clear other primaries in a transaction
    if (isPrimary) {
      await prisma.$transaction([
        prisma.customerContact.updateMany({
          where: { customerId: contact.customerId, isPrimary: true },
          data: { isPrimary: false },
        }),
        prisma.customerContact.create({
          data: {
            customerId: contact.customerId,
            lastName: lastName.trim(),
            firstName: firstName.trim(),
            lastNameKana: lastNameKana?.trim() || null,
            firstNameKana: firstNameKana?.trim() || null,
            department: department?.trim() || null,
            position: position?.trim() || null,
            email: email.trim(),
            mobilePhone: mobilePhone?.trim() || null,
            directLine: directLine?.trim() || null,
            isPrimary: true,
            isBillingContact: !!isBillingContact,
            passwordHash: hash,
          },
        }),
      ]);
    } else {
      await prisma.customerContact.create({
        data: {
          customerId: contact.customerId,
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          lastNameKana: lastNameKana?.trim() || null,
          firstNameKana: firstNameKana?.trim() || null,
          department: department?.trim() || null,
          position: position?.trim() || null,
          email: email.trim(),
          mobilePhone: mobilePhone?.trim() || null,
          directLine: directLine?.trim() || null,
          isPrimary: false,
          isBillingContact: !!isBillingContact,
          passwordHash: hash,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contacts POST error:', error);
    return NextResponse.json({ error: '担当者作成中にエラーが発生しました' }, { status: 500 });
  }
}
