import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/public/trajectory?id=123
 * 認証不要 — GPS軌跡データ（閲覧専用、最小限のデータのみ返す）
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
    gpsPoints: schedule.session?.gpsPoints.map(p => ({
      lat: p.latitude, lng: p.longitude, t: p.timestamp,
    })) || [],
    progressEvents: schedule.session?.progressEvents.map(e => ({
      count: e.mailboxCount, lat: e.latitude, lng: e.longitude, t: e.timestamp,
    })) || [],
    boundary: area?.boundary_geojson || null,
    items: schedule.items.map(i => ({
      name: i.flyerName, planned: i.plannedCount, actual: i.actualCount,
    })),
  });
}
