import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const prefectureId = searchParams.get('prefectureId');

    const cities = await prisma.city.findMany({
      where: prefectureId ? { prefecture_id: parseInt(prefectureId) } : undefined,
      orderBy: { id: 'asc' },
      select: { id: true, name: true, prefecture_id: true },
    });
    return NextResponse.json(cities);
  } catch (error) {
    console.error('Cities fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
