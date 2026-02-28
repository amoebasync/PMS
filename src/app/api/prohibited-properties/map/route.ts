import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// GET /api/prohibited-properties/map
// 管理者: 地図表示用の軽量データ（アクティブ物件のみ）
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const prefectureId = searchParams.get('prefectureId');
    const cityId = searchParams.get('cityId');
    const bounds = searchParams.get('bounds'); // lat1,lng1,lat2,lng2

    const where: Prisma.ProhibitedPropertyWhereInput = {
      isActive: true,
    };

    if (prefectureId) {
      where.prefectureId = parseInt(prefectureId);
    }
    if (cityId) {
      where.cityId = parseInt(cityId);
    }

    // bounds: lat1,lng1,lat2,lng2 (南西緯度,南西経度,北東緯度,北東経度)
    if (bounds) {
      const parts = bounds.split(',').map(Number);
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        const [lat1, lng1, lat2, lng2] = parts;
        const minLat = Math.min(lat1, lat2);
        const maxLat = Math.max(lat1, lat2);
        const minLng = Math.min(lng1, lng2);
        const maxLng = Math.max(lng1, lng2);

        where.latitude = { gte: minLat, lte: maxLat };
        where.longitude = { gte: minLng, lte: maxLng };
      }
    }

    // 件数制限（大量マーカーによるフリーズ防止）
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam), 5000) : 2000;

    const [properties, total] = await Promise.all([
      prisma.prohibitedProperty.findMany({
        where,
        select: {
          id: true,
          latitude: true,
          longitude: true,
          boundaryGeojson: true,
          address: true,
          buildingName: true,
          customer: { select: { name: true } },
        },
        take: limit,
      }),
      prisma.prohibitedProperty.count({ where }),
    ]);

    return NextResponse.json({ data: properties, total, limited: total > limit });
  } catch (error) {
    console.error('ProhibitedProperty Map Error:', error);
    return NextResponse.json({ error: '地図データの取得に失敗しました' }, { status: 500 });
  }
}
