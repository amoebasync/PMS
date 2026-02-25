import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function PUT(
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

  const body = await req.json();
  const {
    lastName, firstName, lastNameKana, firstNameKana,
    department, position, email, mobilePhone, directLine,
    isPrimary, isBillingContact,
  } = body;

  if (!lastName || !firstName) {
    return NextResponse.json({ error: '姓・名は必須です' }, { status: 400 });
  }

  // email重複チェック（自分自身を除外）
  if (email) {
    const existing = await prisma.customerContact.findFirst({
      where: { email, NOT: { id: contactIdNum } },
    });
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に使用されています' }, { status: 409 });
    }
  }

  let contact;
  if (isPrimary) {
    contact = await prisma.$transaction(async (tx) => {
      await tx.customerContact.updateMany({
        where: { customerId, isPrimary: true, NOT: { id: contactIdNum } },
        data: { isPrimary: false },
      });
      return tx.customerContact.update({
        where: { id: contactIdNum },
        data: {
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
        },
        select: {
          id: true, lastName: true, firstName: true, lastNameKana: true, firstNameKana: true,
          department: true, position: true, email: true, mobilePhone: true, directLine: true,
          isPrimary: true, isBillingContact: true, mustChangePassword: true, lastLoginAt: true,
        },
      });
    });
  } else {
    contact = await prisma.customerContact.update({
      where: { id: contactIdNum },
      data: {
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
      },
      select: {
        id: true, lastName: true, firstName: true, lastNameKana: true, firstNameKana: true,
        department: true, position: true, email: true, mobilePhone: true, directLine: true,
        isPrimary: true, isBillingContact: true, mustChangePassword: true, lastLoginAt: true,
      },
    });
  }

  return NextResponse.json(contact);
}

export async function DELETE(
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

  // 残り1件の場合は削除不可
  const count = await prisma.customerContact.count({ where: { customerId } });
  if (count <= 1) {
    return NextResponse.json({ error: '担当者が1名の場合は削除できません' }, { status: 400 });
  }

  await prisma.customerContact.delete({ where: { id: contactIdNum } });

  return NextResponse.json({ success: true });
}
