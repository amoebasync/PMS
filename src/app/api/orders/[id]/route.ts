import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // "new" というパスでアクセスされた場合は、空オブジェクトを返す（新規作成画面用）
    if (id === 'new') return NextResponse.json({});

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        salesRep: true,
        distributions: { include: { flyer: true } },
        printings: { include: { flyer: true, partner: true } },
        newspaperInserts: { include: { partner: true } },
        designs: { include: { partner: true, employee: true } },
      }
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error('Fetch Order Detail Error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        orderNo: body.orderNo,
        customerId: parseInt(body.customerId),
        salesRepId: body.salesRepId ? parseInt(body.salesRepId) : null,
        orderDate: new Date(body.orderDate),
        totalAmount: body.totalAmount ? parseInt(body.totalAmount) : null,
        status: body.status,
        remarks: body.remarks || null,
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Update Order Error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.order.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Order Error:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}