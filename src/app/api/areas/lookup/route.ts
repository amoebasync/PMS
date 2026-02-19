import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { addressCodes } = await request.json();

    if (!addressCodes || !Array.isArray(addressCodes) || addressCodes.length === 0) {
      return NextResponse.json({});
    }

    // ★ 修正: addressCode -> address_code に変更
    const areas = await prisma.area.findMany({
      where: {
        address_code: { in: addressCodes } 
      },
      include: {
        prefecture: true,
        city: true
      }
    });

    const areaMap: Record<string, any> = {};
    areas.forEach(a => {
      // ★ 修正: DBのカラム名 (address_code, town_name, chome_name) に合わせる
      areaMap[a.address_code] = {
        prefectureName: a.prefecture?.name || '',
        cityName: a.city?.name || '',
        townName: a.town_name || '',
        chomeName: a.chome_name || '',
      };
    });

    return NextResponse.json(areaMap);
  } catch (error) {
    console.error('Area Lookup Error:', error);
    return NextResponse.json({ error: 'Failed to lookup areas' }, { status: 500 });
  }
}