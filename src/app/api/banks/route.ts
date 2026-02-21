import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const banks = await prisma.bank.findMany({
      orderBy: { code: 'asc' }
    });
    return NextResponse.json(banks);
  } catch (error) {
    console.error('Fetch Banks Error:', error);
    return NextResponse.json({ error: 'Failed to fetch banks' }, { status: 500 });
  }
}