import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET() {
  try {
    const banks = await prisma.bank.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(banks);
  } catch (error) {
    console.error('Fetch Banks Error:', error);
    return NextResponse.json({ error: 'Failed to fetch banks' }, { status: 500 });
  }
}
