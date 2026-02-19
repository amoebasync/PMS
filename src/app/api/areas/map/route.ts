import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const areas = await prisma.area.findMany({
      where: {
        boundary_geojson: { not: null }
      },
      take: 1000, 
      select: {
        id: true,
        address_code: true,
        town_name: true,
        chome_name: true,
        posting_cap_with_ng: true, 
        boundary_geojson: true, 
        city: { select: { name: true } }
      }
    });

    return NextResponse.json(areas);
  } catch (error) {
    console.error('Fetch Areas Map Error:', error);
    return NextResponse.json({ error: 'Failed to fetch map areas' }, { status: 500 });
  }
}