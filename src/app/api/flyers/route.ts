import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const parseDate = (d: any) => d ? new Date(d) : null;

export async function GET() {
  try {
    const flyers = await prisma.flyer.findMany({
      orderBy: { id: 'desc' },
      include: {
        customer: true,
        industry: true,
        size: true,
      }
    });
    return NextResponse.json(flyers);
  } catch (error) {
    console.error('Fetch Flyers Error:', error);
    return NextResponse.json({ error: 'Failed to fetch flyers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newFlyer = await prisma.flyer.create({
      data: {
        name: body.name,
        flyerCode: body.flyerCode || null,
        bundleCount: body.bundleCount ? parseInt(body.bundleCount, 10) : null,
        customerId: parseInt(body.customerId),
        industryId: parseInt(body.industryId),
        sizeId: parseInt(body.sizeId),
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        foldStatus: body.foldStatus,
        remarks: body.remarks || null,
      },
      include: { customer: true, industry: true, size: true }
    });

    return NextResponse.json(newFlyer);
  } catch (error) {
    console.error('Create Flyer Error:', error);
    return NextResponse.json({ error: 'Failed to create flyer' }, { status: 500 });
  }
}