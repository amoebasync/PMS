import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 自社設定を取得（なければデフォルトを返す）
export async function GET() {
  try {
    const setting = await prisma.companySetting.findFirst({ orderBy: { id: 'asc' } });
    return NextResponse.json(setting ?? {});
  } catch (error) {
    console.error('CompanySetting fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// 自社設定を保存（upsert: id=1 固定）
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const data = {
      companyName:               body.companyName               || '',
      companyNameKana:           body.companyNameKana           || null,
      postalCode:                body.postalCode                || null,
      address:                   body.address                   || null,
      phone:                     body.phone                     || null,
      fax:                       body.fax                       || null,
      email:                     body.email                     || null,
      website:                   body.website                   || null,
      invoiceRegistrationNumber: body.invoiceRegistrationNumber || null,
      bankName:                  body.bankName                  || null,
      bankBranch:                body.bankBranch                || null,
      bankAccountType:           body.bankAccountType           || null,
      bankAccountNumber:         body.bankAccountNumber         || null,
      bankAccountHolder:         body.bankAccountHolder         || null,
      logoUrl:                   body.logoUrl                   || null,
    };
    const setting = await prisma.companySetting.upsert({
      where:  { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return NextResponse.json(setting);
  } catch (error) {
    console.error('CompanySetting update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
