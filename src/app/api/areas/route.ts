// src/app/api/areas/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const rawSearch = searchParams.get('search') || '';
    const prefectureIdParam = searchParams.get('prefectureId');
    const cityIdParam = searchParams.get('cityId');
    const isVisibleParam = searchParams.get('isVisible');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    // --- 複合住所検索: "東京都新宿区高田馬場１丁目" のようなフリーテキストを解析 ---
    let effectivePrefectureId = prefectureIdParam ? parseInt(prefectureIdParam) : undefined;
    let effectiveCityId = cityIdParam ? parseInt(cityIdParam) : undefined;
    let textSearch = rawSearch;

    if (rawSearch && !prefectureIdParam && !cityIdParam) {
      const allPrefectures = await prisma.prefecture.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, name: true },
      });
      // 名前が長い順にマッチングして誤マッチを防ぐ
      const sortedPrefs = [...allPrefectures].sort((a, b) => b.name.length - a.name.length);
      const matchedPref = sortedPrefs.find(p => rawSearch.startsWith(p.name));
      if (matchedPref) {
        effectivePrefectureId = matchedPref.id;
        const remaining = rawSearch.slice(matchedPref.name.length);
        const citiesInPref = await prisma.city.findMany({
          where: { prefecture_id: matchedPref.id },
          select: { id: true, name: true },
        });
        const sortedCities = [...citiesInPref].sort((a, b) => b.name.length - a.name.length);
        const matchedCity = sortedCities.find(c => remaining.startsWith(c.name));
        if (matchedCity) {
          effectiveCityId = matchedCity.id;
          textSearch = remaining.slice(matchedCity.name.length);
        } else {
          textSearch = remaining;
        }
      }
    }

    // --- where 条件組み立て ---
    const where: Record<string, unknown> = {};
    if (effectivePrefectureId) where.prefecture_id = effectivePrefectureId;
    if (effectiveCityId) where.city_id = effectiveCityId;
    if (isVisibleParam !== null && isVisibleParam !== '') {
      where.is_client_visible = parseInt(isVisibleParam);
    }
    if (textSearch) {
      where.OR = [
        { town_name: { contains: textSearch } },
        { chome_name: { contains: textSearch } },
        { address_code: { contains: textSearch } },
      ];
    }

    // page パラメーターなし: 後方互換のため全件返す
    if (!pageParam) {
      const areas = await prisma.area.findMany({
        take: 50,
        where,
        include: { prefecture: true, city: true },
        orderBy: { address_code: 'asc' },
      });
      return NextResponse.json({ data: areas });
    }

    const page = Math.max(1, parseInt(pageParam));

    const [total, areas] = await Promise.all([
      prisma.area.count({ where }),
      prisma.area.findMany({
        where,
        include: { prefecture: true, city: true, areaRank: true },
        orderBy: { address_code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({ data: areas, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Database Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
