import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const { customerId } = await params;
    
    const flyers = await prisma.flyer.findMany({
      where: { customerId: parseInt(customerId, 10) },
      include: {
        size: true,
        industry: true,
      },
      orderBy: { id: 'desc' }
    });

    return NextResponse.json(flyers);
  } catch (error) {
    console.error('Fetch Customer Flyers Error:', error);
    return NextResponse.json({ error: 'Failed to fetch flyers' }, { status: 500 });
  }
}