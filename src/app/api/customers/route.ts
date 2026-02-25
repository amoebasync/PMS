import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendContactCredentials } from '@/lib/mailer';


function generateInitialPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const bytes = crypto.randomBytes(16);
  const getChar = (charset: string, byte: number) => charset[byte % charset.length];
  const chars = [
    getChar(upper, bytes[0]),
    getChar(lower, bytes[1]),
    getChar(digits, bytes[2]),
    ...Array.from({ length: 5 }, (_, i) => getChar(all, bytes[3 + i])),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[8 + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// 一覧取得 (GET)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // オートコンプリート用: search パラメータがある場合は絞り込みのみ返す
    if (search) {
      const customers = await prisma.customer.findMany({
        where: { name: { contains: search } },
        orderBy: { name: 'asc' },
        take: 10,
        select: { id: true, name: true },
      });
      return NextResponse.json(customers);
    }

    const customers = await prisma.customer.findMany({
      orderBy: { id: 'desc' },
      include: {
        salesRep: true,
        parentCustomer: true,
        billingCustomer: true,
        campaign: { select: { id: true, name: true } },
      }
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error('Customer Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

// 新規登録 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const salesRepId = body.salesRepId ? parseInt(body.salesRepId) : null;
    const parentCustomerId = body.parentCustomerId ? parseInt(body.parentCustomerId) : null;
    const billingCustomerId = body.billingCustomerId ? parseInt(body.billingCustomerId) : null;
    const billingCutoffDay = body.billingCutoffDay ? parseInt(body.billingCutoffDay) : null;
    const paymentMonthDelay = body.paymentMonthDelay ? parseInt(body.paymentMonthDelay) : 1;
    const paymentDay = body.paymentDay ? parseInt(body.paymentDay) : null;
    const campaignId = body.campaignId ? parseInt(body.campaignId) : null;

    const contact = body.contact as {
      lastName: string; firstName: string;
      lastNameKana?: string; firstNameKana?: string;
      department?: string; position?: string;
      email?: string; mobilePhone?: string; directLine?: string;
    } | undefined;

    // メール重複チェック
    if (contact?.email) {
      const existing = await prisma.customerContact.findFirst({ where: { email: contact.email } });
      if (existing) {
        return NextResponse.json({ error: '入力したメールアドレスは既に他の担当者に使用されています' }, { status: 409 });
      }
    }

    const customerData = {
      customerCode: body.customerCode,
      name: body.name,
      nameKana: body.nameKana || null,
      salesRepId,
      parentCustomerId,
      billingCustomerId,
      invoiceRegistrationNumber: body.invoiceRegistrationNumber || null,
      billingCutoffDay,
      paymentMonthDelay,
      paymentDay,
      postalCode: body.postalCode || null,
      address: body.address || null,
      addressBuilding: body.addressBuilding || null,
      phone: body.phone || null,
      fax: body.fax || null,
      note: body.note || null,
      status: body.status || 'VALID',
      acquisitionChannel: body.acquisitionChannel || null,
      campaignId,
    };

    let newCustomer;
    let plainPassword: string | null = null;

    if (contact?.lastName && contact?.firstName) {
      plainPassword = generateInitialPassword();
      const passwordHash = crypto.createHash('sha256').update(plainPassword).digest('hex');

      newCustomer = await prisma.$transaction(async (tx) => {
        const cust = await tx.customer.create({ data: customerData });
        await tx.customerContact.create({
          data: {
            customerId: cust.id,
            lastName: contact.lastName,
            firstName: contact.firstName,
            lastNameKana: contact.lastNameKana || null,
            firstNameKana: contact.firstNameKana || null,
            department: contact.department || null,
            position: contact.position || null,
            email: contact.email || null,
            mobilePhone: contact.mobilePhone || null,
            directLine: contact.directLine || null,
            isPrimary: true,
            passwordHash,
            mustChangePassword: true,
          },
        });
        return cust;
      });

      // メール送信（emailある場合）
      if (contact.email && plainPassword) {
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://example.com'}/portal/login`;
        sendContactCredentials(
          contact.email,
          contact.lastName,
          contact.firstName,
          body.name,
          loginUrl,
          plainPassword,
        ).catch(console.error);
      }
    } else {
      newCustomer = await prisma.customer.create({ data: customerData });
    }

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    console.error('Customer Create Error:', error);
    return NextResponse.json({ error: '顧客の登録に失敗しました' }, { status: 500 });
  }
}
