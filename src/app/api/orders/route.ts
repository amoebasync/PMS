import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const salesRepId = searchParams.get('salesRepId') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.orderSource = source;
    if (salesRepId) where.salesRepId = parseInt(salesRepId);
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { title: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { nameKana: { contains: search } } },
      ];
    }

    const include = {
      customer: true,
      salesRep: true,
      distributions: { select: { id: true } },
      printings: { select: { id: true } },
      newspaperInserts: { select: { id: true } },
      designs: { select: { id: true } },
    };

    const [total, orders, pendingPaymentCount, pendingReviewCount] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
      prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.order.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);

    return NextResponse.json({
      data: orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      pendingPaymentCount,
      pendingReviewCount,
    });
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