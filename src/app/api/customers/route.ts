import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 一覧取得 (GET)
export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { id: 'desc' },
      include: {
        salesRep: true,       // 担当営業の情報を結合
        parentCustomer: true, // 親顧客の情報を結合
        billingCustomer: true // 請求先顧客の情報を結合
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

    // 数値型への変換処理 (空文字が送られてくる対策)
    const salesRepId = body.salesRepId ? parseInt(body.salesRepId) : null;
    const parentCustomerId = body.parentCustomerId ? parseInt(body.parentCustomerId) : null;
    const billingCustomerId = body.billingCustomerId ? parseInt(body.billingCustomerId) : null;
    const billingCutoffDay = body.billingCutoffDay ? parseInt(body.billingCutoffDay) : null;
    const paymentMonthDelay = body.paymentMonthDelay ? parseInt(body.paymentMonthDelay) : 1;
    const paymentDay = body.paymentDay ? parseInt(body.paymentDay) : null;

    const newCustomer = await prisma.customer.create({
      data: {
        customerCode: body.customerCode,
        name: body.name,
        nameKana: body.nameKana,
        salesRepId,
        parentCustomerId,
        billingCustomerId,
        invoiceRegistrationNumber: body.invoiceRegistrationNumber,
        billingCutoffDay,
        paymentMonthDelay,
        paymentDay,
        postalCode: body.postalCode,
        address: body.address,
        addressBuilding: body.addressBuilding,
        phone: body.phone,
        fax: body.fax,
        note: body.note,
        status: body.status || 'VALID', // デフォルト有効
      },
    });

    return NextResponse.json(newCustomer);
  } catch (error) {
    console.error('Customer Create Error:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}