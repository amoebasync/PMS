import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
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

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[8 + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const customerId = parseInt(id);
  if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const contacts = await prisma.customerContact.findMany({
    where: { customerId },
    orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      lastName: true,
      firstName: true,
      lastNameKana: true,
      firstNameKana: true,
      department: true,
      position: true,
      email: true,
      mobilePhone: true,
      directLine: true,
      isPrimary: true,
      isBillingContact: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const customerId = parseInt(id);
  if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json();
  const {
    lastName, firstName, lastNameKana, firstNameKana,
    department, position, email, mobilePhone, directLine,
    isPrimary, isBillingContact,
  } = body;

  if (!lastName || !firstName) {
    return NextResponse.json({ error: '姓・名は必須です' }, { status: 400 });
  }

  // email重複チェック
  if (email) {
    const existing = await prisma.customerContact.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に使用されています' }, { status: 409 });
    }
  }

  // 顧客情報取得（メール送信用）
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } });
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const plainPassword = generateInitialPassword();
  const passwordHash = crypto.createHash('sha256').update(plainPassword).digest('hex');

  let contact;
  if (isPrimary) {
    // トランザクションで既存主担当をfalseに
    contact = await prisma.$transaction(async (tx) => {
      await tx.customerContact.updateMany({
        where: { customerId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.customerContact.create({
        data: {
          customerId,
          lastName,
          firstName,
          lastNameKana: lastNameKana || null,
          firstNameKana: firstNameKana || null,
          department: department || null,
          position: position || null,
          email: email || null,
          mobilePhone: mobilePhone || null,
          directLine: directLine || null,
          isPrimary: true,
          isBillingContact: !!isBillingContact,
          passwordHash,
          mustChangePassword: true,
        },
        select: {
          id: true, lastName: true, firstName: true, lastNameKana: true, firstNameKana: true,
          department: true, position: true, email: true, mobilePhone: true, directLine: true,
          isPrimary: true, isBillingContact: true, mustChangePassword: true, lastLoginAt: true,
        },
      });
    });
  } else {
    contact = await prisma.customerContact.create({
      data: {
        customerId,
        lastName,
        firstName,
        lastNameKana: lastNameKana || null,
        firstNameKana: firstNameKana || null,
        department: department || null,
        position: position || null,
        email: email || null,
        mobilePhone: mobilePhone || null,
        directLine: directLine || null,
        isPrimary: false,
        isBillingContact: !!isBillingContact,
        passwordHash,
        mustChangePassword: true,
      },
      select: {
        id: true, lastName: true, firstName: true, lastNameKana: true, firstNameKana: true,
        department: true, position: true, email: true, mobilePhone: true, directLine: true,
        isPrimary: true, isBillingContact: true, mustChangePassword: true, lastLoginAt: true,
      },
    });
  }

  // メール送信（emailがある場合）
  if (email) {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://example.com'}/portal/login`;
    try {
      await sendContactCredentials(email, lastName, firstName, customer.name, loginUrl, plainPassword);
    } catch (e) {
      console.error('Failed to send credentials email:', e);
    }
  }

  return NextResponse.json(contact, { status: 201 });
}
