import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // ※今回はテスト用として、GeoJSONを持つエリアを最大1000件取得します。
    // 本番稼働時は、フロントから渡された「表示している地図の範囲（緯度経度）」で絞り込むのが一般的です。
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
        posting_cap_with_ng: true, // ★ 配布可能枚数
        boundary_geojson: true,    // ★ ポリゴンデータ
        city: { select: { name: true } }
      }
    });

    return NextResponse.json(areas);
  } catch (error) {
    console.error('Fetch Areas Map Error:', error);
    return NextResponse.json({ error: 'Failed to fetch map areas' }, { status: 500 });
  }
}