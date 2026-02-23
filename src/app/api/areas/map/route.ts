import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cityName = searchParams.get('cityName');

  try {
    const whereClause: any = {
      boundary_geojson: { not: null }
    };

    if (cityName) {
      const cleanCityName = cityName.replace(/(区|市|City|Ku|Ward|Town|Village|\s)/gi, '');
      whereClause.city = {
        name: {
          contains: cleanCityName
        }
      };
    }

    const areas = await prisma.area.findMany({
      where: whereClause,
      take: cityName ? 5000 : 500,
      select: {
        id: true,
        address_code: true,
        town_name: true,
        chome_name: true,
        door_to_door_count: true,
        multi_family_count: true,
        posting_cap_with_ng: true,
        boundary_geojson: true,
        area_rank_id: true,
        prefecture: { select: { name: true } },
        city: { select: { name: true } }
      }
    });

    // エリアランク情報を別途取得してマージ
    const areaRanks = await prisma.areaRank.findMany();
    const rankMap = new Map(areaRanks.map(r => [r.id, r]));

    const areasWithRank = areas.map(a => ({
      ...a,
      areaRank: a.area_rank_id ? rankMap.get(a.area_rank_id) || null : null
    }));

    return NextResponse.json(areasWithRank);
  } catch (error) {
    console.error('Fetch Areas Map Error:', error);
    return NextResponse.json({ error: 'Failed to fetch map areas' }, { status: 500 });
  }
}
