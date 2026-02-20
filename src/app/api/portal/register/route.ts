import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { accountType, companyName, lastName, firstName, email, password } = await request.json();

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
    const customerCode = `EC${Date.now()}`;
    
    // 法人なら入力された会社名、個人なら「姓 名」を顧客名とする
    const custName = accountType === 'company' ? companyName : `${lastName} ${firstName}`;
    const custType = accountType === 'company' ? 'COMPANY' : 'INDIVIDUAL';

    await prisma.customer.create({
      data: {
        customerCode,
        customerType: custType,
        name: custName,
        nameKana: null, // ★ 空欄で保存
        contacts: {
          create: {
            lastName: lastName,
            firstName: firstName,
            email: email,
            passwordHash: hash,
            isPrimary: true,
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Register API Error:', error);
    return NextResponse.json({ error: '登録処理中にエラーが発生しました' }, { status: 500 });
  }
}