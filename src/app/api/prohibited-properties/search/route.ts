import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET /api/prohibited-properties/search?lat=XX&lng=XX&radius=50&q=address_text
// GPS proximity search (primary) + text partial match (fallback)
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const radiusM = parseInt(searchParams.get('radius') || '50');
    const q = searchParams.get('q') || '';

    const results: any[] = [];

    // 1) GPS proximity search (if coordinates provided)
    if (!isNaN(lat) && !isNaN(lng)) {
      // Bounding box approximation: 1 degree lat ≈ 111km, 1 degree lng ≈ 91km (at 35°N)
      const latDelta = radiusM / 111000;
      const lngDelta = radiusM / 91000;

      const gpsResults = await prisma.prohibitedProperty.findMany({
        where: {
          isActive: true,
          latitude: { gte: lat - latDelta, lte: lat + latDelta },
          longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
        },
        select: {
          id: true,
          address: true,
          buildingName: true,
          roomNumber: true,
          latitude: true,
          longitude: true,
          residentName: true,
          severity: true,
          prohibitedReason: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
        take: 10,
      });

      // Calculate actual distance and filter
      for (const p of gpsResults) {
        if (p.latitude && p.longitude) {
          const dist = haversineDistance(lat, lng, p.latitude, p.longitude);
          if (dist <= radiusM) {
            results.push({ ...p, distance: Math.round(dist), matchType: 'gps' });
          }
        }
      }

      results.sort((a, b) => a.distance - b.distance);
    }

    // 2) Text search (if query provided and GPS found fewer than 5)
    if (q.trim() && results.length < 5) {
      const existingIds = new Set(results.map(r => r.id));

      const textResults = await prisma.prohibitedProperty.findMany({
        where: {
          isActive: true,
          OR: [
            { address: { contains: q.trim() } },
            { buildingName: { contains: q.trim() } },
          ],
        },
        select: {
          id: true,
          address: true,
          buildingName: true,
          roomNumber: true,
          latitude: true,
          longitude: true,
          residentName: true,
          severity: true,
          prohibitedReason: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
        },
        take: 10,
      });

      for (const p of textResults) {
        if (!existingIds.has(p.id)) {
          results.push({ ...p, distance: null, matchType: 'text' });
        }
      }
    }

    return NextResponse.json({ results: results.slice(0, 10) });
  } catch (err) {
    console.error('Prohibited property search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Haversine distance in meters */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
