import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// --- Geo utilities (same as fraud-analysis.ts) ---

/** GeoJSON -> polygon array */
function extractPolygons(geojsonStr: string): Array<Array<{ lat: number; lng: number }>> {
  if (!geojsonStr) return [];
  const trimmed = geojsonStr.trim();

  // GeoJSON format
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const getCoords = (geom: any): any[][] => {
        if (!geom) return [];
        if (geom.type === 'FeatureCollection') return geom.features.flatMap((f: any) => getCoords(f.geometry || f));
        if (geom.type === 'Feature') return getCoords(geom.geometry);
        if (geom.type === 'Polygon') return [geom.coordinates[0]];
        if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly: any[]) => poly[0]);
        return [];
      };
      return getCoords(parsed)
        .map((poly: any[]) =>
          poly
            .map((c: any[]) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) }))
            .filter((c) => !isNaN(c.lat) && !isNaN(c.lng))
        )
        .filter((p) => p.length > 0);
    } catch {
      return [];
    }
  }

  // Pipe-delimited format: "lat,lng|lat,lng|..."
  if (trimmed.includes('|')) {
    try {
      const points = trimmed.split('|').map((pair) => {
        const [lat, lng] = pair.split(',').map(Number);
        return { lat, lng };
      }).filter((p) => !isNaN(p.lat) && !isNaN(p.lng));
      return points.length > 2 ? [points] : [];
    } catch {
      return [];
    }
  }

  return [];
}

/** Ray-casting point-in-polygon */
function pointInPolygon(lat: number, lng: number, polygon: Array<{ lat: number; lng: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Check if a point is inside any polygon in the array */
function isInsideArea(lat: number, lng: number, polygons: Array<Array<{ lat: number; lng: number }>>): boolean {
  return polygons.some((poly) => pointInPolygon(lat, lng, poly));
}

// GET /api/sessions/[id]/area-match?scheduleIds=1,2,3
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: '不正なセッションID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleIdsParam = searchParams.get('scheduleIds');
    if (!scheduleIdsParam) {
      return NextResponse.json({ error: 'scheduleIds は必須です' }, { status: 400 });
    }

    const scheduleIds = scheduleIdsParam.split(',').map(Number).filter((n) => !isNaN(n));
    if (scheduleIds.length === 0) {
      return NextResponse.json({ error: '有効なスケジュールIDがありません' }, { status: 400 });
    }

    // 1. Get total GPS point count for this session
    const totalCount = await prisma.gpsPoint.count({
      where: { sessionId },
    });

    if (totalCount === 0) {
      return NextResponse.json({
        totalPoints: 0,
        matches: scheduleIds.map((sid) => ({
          scheduleId: sid,
          areaName: '',
          matchedPoints: 0,
          matchRate: 0,
        })),
      });
    }

    // 2. Sample up to 500 GPS points (evenly distributed)
    let gpsPoints: { latitude: number; longitude: number }[];
    if (totalCount <= 500) {
      gpsPoints = await prisma.gpsPoint.findMany({
        where: { sessionId },
        select: { latitude: true, longitude: true },
        orderBy: { timestamp: 'asc' },
      });
    } else {
      // Evenly sample ~500 points using skip/take strategy
      // Fetch all IDs, then pick every Nth
      const allPoints = await prisma.gpsPoint.findMany({
        where: { sessionId },
        select: { id: true },
        orderBy: { timestamp: 'asc' },
      });
      const step = Math.floor(allPoints.length / 500);
      const sampledIds: number[] = [];
      for (let i = 0; i < allPoints.length && sampledIds.length < 500; i += step) {
        sampledIds.push(allPoints[i].id);
      }
      gpsPoints = await prisma.gpsPoint.findMany({
        where: { id: { in: sampledIds } },
        select: { latitude: true, longitude: true },
        orderBy: { timestamp: 'asc' },
      });
    }

    // 3. Get schedules with area boundary data
    const schedules = await prisma.distributionSchedule.findMany({
      where: { id: { in: scheduleIds } },
      select: {
        id: true,
        area: {
          select: {
            boundary_geojson: true,
            chome_name: true,
            town_name: true,
            prefecture: { select: { name: true } },
            city: { select: { name: true } },
          },
        },
      },
    });

    // 4. Build polygon map for each schedule
    const schedulePolygons = new Map<number, {
      polygons: Array<Array<{ lat: number; lng: number }>>;
      areaName: string;
    }>();

    for (const s of schedules) {
      const geojson = s.area?.boundary_geojson;
      const polygons = geojson ? extractPolygons(geojson) : [];
      const pref = s.area?.prefecture?.name || '';
      const city = s.area?.city?.name || '';
      const chome = s.area?.chome_name || s.area?.town_name || '';
      const areaName = `${pref}${city}${chome}` || '-';
      schedulePolygons.set(s.id, { polygons, areaName });
    }

    // 5. Count GPS points inside each schedule's area polygon
    const matchCounts = new Map<number, number>();
    for (const sid of scheduleIds) {
      matchCounts.set(sid, 0);
    }

    const sampledTotal = gpsPoints.length;
    for (const point of gpsPoints) {
      for (const sid of scheduleIds) {
        const data = schedulePolygons.get(sid);
        if (data && data.polygons.length > 0 && isInsideArea(point.latitude, point.longitude, data.polygons)) {
          matchCounts.set(sid, (matchCounts.get(sid) || 0) + 1);
        }
      }
    }

    // 6. Build response
    const matches = scheduleIds.map((sid) => {
      const data = schedulePolygons.get(sid);
      const matched = matchCounts.get(sid) || 0;
      return {
        scheduleId: sid,
        areaName: data?.areaName || '-',
        matchedPoints: matched,
        matchRate: sampledTotal > 0 ? Math.round((matched / sampledTotal) * 100) / 100 : 0,
      };
    });

    // Sort by matchRate descending
    matches.sort((a, b) => b.matchRate - a.matchRate);

    return NextResponse.json({
      totalPoints: sampledTotal,
      matches,
    });
  } catch (err) {
    console.error('Area match error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
