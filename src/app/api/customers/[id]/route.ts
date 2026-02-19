import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 更新 (PUT)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);
    const body = await request.json();

    // 数値変換
    const salesRepId = body.salesRepId ? parseInt(body.salesRepId) : null;
    const parentCustomerId = body.parentCustomerId ? parseInt(body.parentCustomerId) : null;
    const billingCustomerId = body.billingCustomerId ? parseInt(body.billingCustomerId) : null;
    const billingCutoffDay = body.billingCutoffDay ? parseInt(body.billingCutoffDay) : null;
    const paymentMonthDelay = body.paymentMonthDelay ? parseInt(body.paymentMonthDelay) : 1;
    const paymentDay = body.paymentDay ? parseInt(body.paymentDay) : null;

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
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
        status: body.status,
      },
    });
    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error('Customer Update Error:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

// 削除 (DELETE)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customerId = parseInt(id);

    // 物理削除する（関連データがある場合はエラーになるので、その場合はステータス変更にする運用も検討）
    // 今回は論理削除フラグ（Status=INVALID）への変更とします
    const deletedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: { status: 'INVALID' }
    });

    return NextResponse.json(deletedCustomer);
  } catch (error) {
    console.error('Customer Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}