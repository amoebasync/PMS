import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    const prices = await prisma.partnerFlyerPrice.findMany({
      where: { partnerId },
      orderBy: [{ flyerName: 'asc' }, { customerCode: 'asc' }],
    });

    return NextResponse.json(prices);
  } catch (error) {
    console.error('GET /api/partners/[id]/flyer-prices error:', error);
    return NextResponse.json({ error: 'Failed to fetch flyer prices' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    const body = await request.json();
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: 'Request body must be a non-empty array' }, { status: 400 });
    }

    // Delete existing and re-create (replace strategy)
    await prisma.$transaction(async (tx) => {
      await tx.partnerFlyerPrice.deleteMany({ where: { partnerId } });

      await tx.partnerFlyerPrice.createMany({
        data: body.map((item: any) => ({
          partnerId,
          flyerName: String(item.flyerName).trim(),
          customerCode: item.customerCode ? String(item.customerCode).trim() : null,
          flyerCode: item.flyerCode ? String(item.flyerCode).trim() : null,
          unitPrice: parseFloat(item.unitPrice),
        })),
      });
    });

    const count = body.length;
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('POST /api/partners/[id]/flyer-prices error:', error);
    return NextResponse.json({ error: 'Failed to import flyer prices' }, { status: 500 });
  }
}
