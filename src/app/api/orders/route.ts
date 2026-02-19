import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { id: 'desc' },
      include: {
        customer: true,
        salesRep: true,
      }
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 簡易的な受注番号の自動採番 (例: ORD-20260220-123456)
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const orderNo = body.orderNo || `ORD-${timestamp}`;

    const newOrder = await prisma.order.create({
      data: {
        orderNo: orderNo,
        customerId: parseInt(body.customerId),
        salesRepId: body.salesRepId ? parseInt(body.salesRepId) : null,
        orderDate: new Date(body.orderDate),
        totalAmount: body.totalAmount ? parseInt(body.totalAmount) : null,
        status: body.status || 'PLANNING',
        remarks: body.remarks || null,
      },
    });

    return NextResponse.json(newOrder);
  } catch (error) {
    console.error('Create Order Error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}