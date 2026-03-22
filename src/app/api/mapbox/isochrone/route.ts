import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * GET /api/mapbox/isochrone
 * Proxies Mapbox Isochrone API to keep the token secure on the server side.
 *
 * Query params:
 *   lat       - Latitude of the center point (required)
 *   lng       - Longitude of the center point (required)
 *   minutes   - Comma-separated contour minutes, e.g. "15,30,60" (default: "30")
 *   profile   - Routing profile: walking | cycling | driving (default: "walking")
 *
 * Returns: GeoJSON FeatureCollection with isochrone polygon(s)
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const minutes = searchParams.get('minutes') || '30';
  const profile = searchParams.get('profile') || 'walking';

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const validProfiles = ['walking', 'cycling', 'driving'];
  if (!validProfiles.includes(profile)) {
    return NextResponse.json({ error: `Invalid profile. Must be one of: ${validProfiles.join(', ')}` }, { status: 400 });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 });
  }

  try {
    const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${minutes}&polygons=true&access_token=${token}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Mapbox API error', details: errorData },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Isochrone API error:', err);
    return NextResponse.json({ error: 'Failed to fetch isochrone data' }, { status: 500 });
  }
}
