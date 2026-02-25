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

  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[8 + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, contactId } = await params;
  const customerId = parseInt(id);
  const contactIdNum = parseInt(contactId);
  if (isNaN(customerId) || isNaN(contactIdNum)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const contact = await prisma.customerContact.findUnique({
    where: { id: contactIdNum },
    include: { customer: { select: { name: true } } },
  });

  if (!contact || contact.customerId !== customerId) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
  }

  if (!contact.email) {
    return NextResponse.json({ error: 'メールアドレスが登録されていません' }, { status: 400 });
  }

  const plainPassword = generateInitialPassword();
  const passwordHash = crypto.createHash('sha256').update(plainPassword).digest('hex');

  await prisma.customerContact.update({
    where: { id: contactIdNum },
    data: { passwordHash, mustChangePassword: true },
  });

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://example.com'}/portal/login`;

  try {
    await sendContactCredentials(
      contact.email,
      contact.lastName,
      contact.firstName,
      contact.customer.name,
      loginUrl,
      plainPassword,
    );
  } catch (e) {
    console.error('Failed to send credentials email:', e);
    return NextResponse.json({ error: 'メール送信に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
