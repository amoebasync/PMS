import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const prefectures = await prisma.prefecture.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
    return NextResponse.json(prefectures);
  } catch (error) {
    console.error('Prefectures fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
