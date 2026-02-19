import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      orderBy: { name: 'asc' }, // 日本語名で五十音順
    });
    return NextResponse.json(countries);
  } catch (error) {
    console.error('Fetch Countries Error:', error);
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 });
  }
}