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
      // "Minato City" や "新宿区" などの表記ゆれを吸収
      const cleanCityName = cityName.replace(/(区|市|City|Ku|Ward|Town|Village|\s)/gi, '');
      whereClause.city = {
        name: {
          contains: cleanCityName
        }
      };
    }

    const areas = await prisma.area.findMany({
      where: whereClause,
      take: cityName ? 5000 : 500, // 区単位なら全件取得できる余裕を持たせる
      select: {
        id: true,
        address_code: true,
        town_name: true,
        chome_name: true,
        door_to_door_count: true,
        multi_family_count: true,
        posting_cap_with_ng: true, 
        boundary_geojson: true, 
        prefecture: { select: { name: true } }, // ★ 追加: 都道府県名も取得
        city: { select: { name: true } }
      }
    });

    return NextResponse.json(areas);
  } catch (error) {
    console.error('Fetch Areas Map Error:', error);
    return NextResponse.json({ error: 'Failed to fetch map areas' }, { status: 500 });
  }
}