import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * POST /api/mapbox/directions
 * Proxies Mapbox Directions API to keep the token secure on the server side.
 *
 * Body:
 *   coordinates - Array of [lng, lat] pairs (min 2, max 25)
 *   profile     - Routing profile: walking | cycling | driving (default: "walking")
 *
 * Returns: Mapbox Directions API response with route geometry and turn-by-turn steps
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { coordinates, profile = 'walking' } = body;

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return NextResponse.json({ error: 'At least 2 coordinates required' }, { status: 400 });
  }

  if (coordinates.length > 25) {
    return NextResponse.json({ error: 'Maximum 25 coordinates allowed' }, { status: 400 });
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
    const coordStr = coordinates.map((c: number[]) => c.join(',')).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordStr}?geometries=geojson&steps=true&overview=full&language=ja&access_token=${token}`;

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
    console.error('Directions API error:', err);
    return NextResponse.json({ error: 'Failed to fetch directions' }, { status: 500 });
  }
}
