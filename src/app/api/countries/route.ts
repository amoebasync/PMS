import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], // 優先順 → 五十音順
    });
    return NextResponse.json(countries);
  } catch (error) {
    console.error('Fetch Countries Error:', error);
    return NextResponse.json({ error: 'Failed to fetch countries' }, { status: 500 });
  }
}