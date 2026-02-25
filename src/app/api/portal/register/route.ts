import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { generateUniqueCustomerCode } from '@/lib/customerCode';
import { sendWelcomeEmail } from '@/lib/mailer';


export async function POST(request: Request) {
  try {
    // ★ wantsNewsletter を受け取る
    const { accountType, companyName, lastName, firstName, department, position, mobilePhone, email, password, wantsNewsletter } = await request.json();

    if (!lastName || !firstName || !email || !password) {
      return NextResponse.json({ error: '必須項目が入力されていません' }, { status: 400 });
    }

    if (accountType === 'company' && !companyName) {
      return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 });
    }

    const existing = await prisma.customerContact.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'このメールアドレスは既に登録されています' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    const customerCode = await generateUniqueCustomerCode(prisma, 'EC');
    
    // 法人なら入力された会社名、個人なら「姓 名」を顧客名とする
    const custName = accountType === 'company' ? companyName : `${lastName} ${firstName}`;
    const custType = accountType === 'company' ? 'COMPANY' : 'INDIVIDUAL';

    await prisma.customer.create({
      data: {
        customerCode,
        customerType: custType,
        name: custName,
        nameKana: null,
        acquisitionChannel: 'EC',
        contacts: {
          create: {
            lastName: lastName,
            firstName: firstName,
            department: department || null,
            position: position || null,
            mobilePhone: mobilePhone || null,
            email: email,
            passwordHash: hash,
            isPrimary: true,
          }
        }
      }
    });

    // 登録完了メール送信（fire-and-forget）
    const loginUrl = `${process.env.NEXTAUTH_URL}/portal/login`;
    sendWelcomeEmail(
      email,
      lastName,
      firstName,
      loginUrl,
      accountType === 'company' ? companyName : undefined,
    ).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Register API Error:', error);
    return NextResponse.json({ error: '登録処理中にエラーが発生しました' }, { status: 500 });
  }
}