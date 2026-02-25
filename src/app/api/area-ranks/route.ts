import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const ranks = await prisma.areaRank.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true, postingUnitPrice: true },
    });
    return NextResponse.json(ranks);
  } catch (error) {
    console.error('AreaRanks fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
