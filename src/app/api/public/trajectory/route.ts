import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

/**
 * GET /api/public/trajectory?id=123
 * 認証不要 — GPS軌跡データ（PMS session + PS Fallback対応）
 */
export async function GET(request: NextRequest) {
  const scheduleId = parseInt(request.nextUrl.searchParams.get('id') || '');
  if (isNaN(scheduleId)) {
    return NextResponse.json({ error: '不正なID' }, { status: 400 });
  }

  const schedule = await prisma.distributionSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      distributor: { select: { name: true, staffId: true } },
      area: { select: { boundary_geojson: true, town_name: true, chome_name: true, prefecture: { select: { name: true } }, city: { select: { name: true } } } },
      items: { orderBy: { slotIndex: 'asc' }, select: { flyerName: true, plannedCount: true, actualCount: true } },
      session: {
        include: {
          gpsPoints: { orderBy: { timestamp: 'asc' }, select: { latitude: true, longitude: true, timestamp: true } },
          progressEvents: { orderBy: { timestamp: 'asc' }, select: { mailboxCount: true, latitude: true, longitude: true, timestamp: true } },
        },
      },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const area = schedule.area;
  const areaName = area ? `${area.prefecture?.name || ''}${area.city?.name || ''}${area.chome_name || area.town_name}` : '';

  // PMS session の GPS データ
  let gpsPoints: { lat: number; lng: number; t: string }[] = schedule.session?.gpsPoints.map(p => ({
    lat: p.latitude, lng: p.longitude, t: String(p.timestamp),
  })) || [];

  const progressEvents = schedule.session?.progressEvents.map(e => ({
    count: e.mailboxCount, lat: e.latitude, lng: e.longitude, t: e.timestamp,
  })) || [];

  // PMS session がない場合、PS Fallback から GPS データを取得
  if (gpsPoints.length === 0 && PS_API_URL && schedule.distributor?.staffId && schedule.date) {
    try {
      const dateStr = new Date(schedule.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (PS_API_KEY) headers['X-API-Key'] = PS_API_KEY;

      const res = await fetch(`${PS_API_URL}/GetStaffGPS.php`, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ STAFF_ID: schedule.distributor.staffId, TARGET_DATE: dateStr }).toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const text = await res.text();
        try {
          const rows = JSON.parse(text.trim());
          if (Array.isArray(rows)) {
            gpsPoints = rows
              .filter((r: any) => {
                const lat = parseFloat(r.LATITUDE || '0');
                const lng = parseFloat(r.LONGITUDE || '0');
                return lat !== 0 && lng !== 0;
              })
              .map((r: any) => ({
                lat: parseFloat(r.LATITUDE),
                lng: parseFloat(r.LONGITUDE),
                t: `${dateStr}T${r.TERMINAL_TIME || '00:00:00'}+09:00`,
              }));
          }
        } catch { /* parse error */ }
      }
    } catch (e) {
      console.warn('[Public Trajectory] PS Fallback GPS fetch failed:', e);
    }
  }

  return NextResponse.json({
    distributor: schedule.distributor?.name || '-',
    staffId: schedule.distributor?.staffId || '',
    date: schedule.date,
    areaName,
    status: schedule.status,
    session: schedule.session ? {
      startedAt: schedule.session.startedAt,
      finishedAt: schedule.session.finishedAt,
    } : null,
    gpsPoints,
    progressEvents,
    boundary: area?.boundary_geojson || null,
    items: schedule.items.map(i => ({
      name: i.flyerName, planned: i.plannedCount, actual: i.actualCount,
    })),
  });
}
