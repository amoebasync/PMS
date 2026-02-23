import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const visaTypes = await prisma.visaType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(visaTypes);
  } catch (error) {
    console.error('Fetch VisaTypes Error:', error);
    return NextResponse.json({ error: 'Failed to fetch visa types' }, { status: 500 });
  }
}
