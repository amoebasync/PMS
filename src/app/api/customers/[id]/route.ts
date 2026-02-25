import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


// 詳細取得 (GET)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const customerId = parseInt(id);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesRep: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        parentCustomer: { select: { id: true, name: true, customerCode: true } },
        billingCustomer: { select: { id: true, name: true, customerCode: true } },
        contacts: true,
        campaign: { select: { id: true, name: true } },
        tasks: {
          where: { status: { not: 'DONE' } },
          orderBy: { dueDate: 'asc' },
          take: 10,
          include: { assignee: { select: { id: true, lastNameJa: true, firstNameJa: true } } },
        },
      },
    });
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(customer);
  } catch (error) {
    console.error('Customer GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}

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
    const campaignId = body.campaignId ? parseInt(body.campaignId) : null;

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
        acquisitionChannel: body.acquisitionChannel || null,
        campaignId,
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