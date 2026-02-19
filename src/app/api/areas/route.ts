// src/app/api/areas/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: Request) {
  try {
    // areas ではなく area (単数形) になっているか注意
    const areas = await prisma.area.findMany({
      take: 50,
      include: {
        prefecture: true,
        city: true,
      },
      orderBy: {
        address_code: 'asc',
      },
    });

    return NextResponse.json({ data: areas });
  } catch (error) {
    console.error('Database Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}