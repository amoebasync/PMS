import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  // ★ クエリパラメータから cityName を受け取る
  const { searchParams } = new URL(request.url);
  const cityName = searchParams.get('cityName');

  try {
    const whereClause: any = {
      boundary_geojson: { not: null }
    };

    // cityName が指定されている場合は、Cityテーブルの名前で絞り込む
    if (cityName) {
      whereClause.city = {
        name: {
          contains: cityName
        }
      };
    } else {
      // cityNameの指定がない場合は、安全のため空配列を返す
      return NextResponse.json([]);
    }

    const areas = await prisma.area.findMany({
      where: whereClause,
      select: {
        id: true,
        address_code: true,
        town_name: true,
        chome_name: true,
        door_to_door_count: true,  // 軒並み用
        multi_family_count: true,  // 集合用
        posting_cap_with_ng: true, // 全配布・その他用
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