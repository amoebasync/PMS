import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const cityIdParam = searchParams.get('cityId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)));

    // Get all coverage areas for summary (no boundary_geojson)
    const coverageAreas = await prisma.partnerCoverageArea.findMany({
      where: { partnerId },
      include: {
        area: {
          select: {
            id: true,
            town_name: true,
            chome_name: true,
            address_code: true,
            prefecture_id: true,
            city_id: true,
            prefecture: { select: { id: true, name: true } },
            city: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Group by prefecture -> city for summary
    const prefectureMap = new Map<number, {
      prefectureId: number;
      prefectureName: string;
      cities: Map<number, { cityId: number; cityName: string; areaCount: number }>;
      totalAreas: number;
    }>();

    for (const ca of coverageAreas) {
      const { area } = ca;
      const prefId = area.prefecture_id;
      const cityId = area.city_id;

      if (!prefectureMap.has(prefId)) {
        prefectureMap.set(prefId, {
          prefectureId: prefId,
          prefectureName: area.prefecture.name,
          cities: new Map(),
          totalAreas: 0,
        });
      }

      const pref = prefectureMap.get(prefId)!;
      pref.totalAreas++;

      if (!pref.cities.has(cityId)) {
        pref.cities.set(cityId, {
          cityId,
          cityName: area.city.name,
          areaCount: 0,
        });
      }
      pref.cities.get(cityId)!.areaCount++;
    }

    const summary = Array.from(prefectureMap.values()).map((pref) => ({
      prefectureId: pref.prefectureId,
      prefectureName: pref.prefectureName,
      cities: Array.from(pref.cities.values()).sort((a, b) => a.cityId - b.cityId),
      totalAreas: pref.totalAreas,
    })).sort((a, b) => a.prefectureId - b.prefectureId);

    const result: Record<string, unknown> = {
      summary,
      totalCoverage: coverageAreas.length,
    };

    // If cityId is provided, return paginated area list for that city
    if (cityIdParam) {
      const cityId = parseInt(cityIdParam, 10);
      if (!isNaN(cityId)) {
        const total = await prisma.partnerCoverageArea.count({
          where: { partnerId, area: { city_id: cityId } },
        });

        const areas = await prisma.partnerCoverageArea.findMany({
          where: { partnerId, area: { city_id: cityId } },
          include: {
            area: {
              select: {
                id: true,
                town_name: true,
                chome_name: true,
                address_code: true,
                prefecture_id: true,
                city_id: true,
                door_to_door_count: true,
                multi_family_count: true,
                posting_cap_raw: true,
                posting_cap_with_ng: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { area: { address_code: 'asc' } },
        });

        result.areas = {
          data: areas.map((ca) => ca.area),
          total,
          page,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch Coverage Areas Error:', error);
    return NextResponse.json({ error: 'Failed to fetch coverage areas' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const body = await request.json();
    const { areaIds } = body;
    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      return NextResponse.json({ error: 'areaIds must be a non-empty array' }, { status: 400 });
    }

    const result = await prisma.partnerCoverageArea.createMany({
      data: areaIds.map((areaId: number) => ({ partnerId, areaId })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Add Coverage Areas Error:', error);
    return NextResponse.json({ error: 'Failed to add coverage areas' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const body = await request.json();
    const { areaIds } = body;
    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      return NextResponse.json({ error: 'areaIds must be a non-empty array' }, { status: 400 });
    }

    const result = await prisma.partnerCoverageArea.deleteMany({
      where: { partnerId, areaId: { in: areaIds } },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Remove Coverage Areas Error:', error);
    return NextResponse.json({ error: 'Failed to remove coverage areas' }, { status: 500 });
  }
}
