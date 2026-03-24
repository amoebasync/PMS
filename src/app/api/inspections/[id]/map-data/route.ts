import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET /api/inspections/[id]/map-data
// 現地確認の地図表示用データ一括取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const inspection = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        scheduleId: true,
        schedule: {
          select: {
            id: true,
            areaId: true,
            area: {
              select: {
                id: true,
                boundary_geojson: true,
                prefecture: { select: { name: true } },
                city: { select: { name: true } },
                chome_name: true,
              },
            },
          },
        },
        checkpoints: {
          orderBy: { checkedAt: 'asc' },
        },
        prohibitedChecks: {
          include: {
            prohibitedProperty: {
              select: {
                id: true,
                address: true,
                buildingName: true,
                latitude: true,
                longitude: true,
              },
            },
          },
          orderBy: { checkedAt: 'asc' },
        },
        inspectionSession: {
          select: {
            id: true,
            gpsPoints: {
              orderBy: { timestamp: 'asc' },
              select: {
                latitude: true,
                longitude: true,
                accuracy: true,
                timestamp: true,
              },
            },
          },
        },
      },
    });

    if (!inspection) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    // 配布員のGPS軌跡（PMS session → Posting System fallback）
    let distributorTrajectory: { latitude: number; longitude: number; accuracy: number | null; timestamp: Date | string }[] = [];
    if (inspection.scheduleId) {
      // 1. PMS session から取得
      const distributionSession = await prisma.distributionSession.findUnique({
        where: { scheduleId: inspection.scheduleId },
        select: {
          gpsPoints: {
            orderBy: { timestamp: 'asc' },
            select: { latitude: true, longitude: true, accuracy: true, timestamp: true },
          },
        },
      });
      if (distributionSession && distributionSession.gpsPoints.length > 0) {
        distributorTrajectory = distributionSession.gpsPoints;
      } else {
        // 2. Posting System fallback
        const schedule = await prisma.distributionSchedule.findUnique({
          where: { id: inspection.scheduleId },
          select: { date: true, distributor: { select: { staffId: true } } },
        });
        const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
        if (schedule?.distributor?.staffId && PS_API_URL && schedule.date) {
          try {
            const dateStr = new Date(schedule.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
            const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
            if (process.env.POSTING_SYSTEM_API_KEY) headers['X-API-Key'] = process.env.POSTING_SYSTEM_API_KEY;
            const psRes = await fetch(`${PS_API_URL}/GetStaffGPS.php`, {
              method: 'POST', headers,
              body: new URLSearchParams({ STAFF_ID: schedule.distributor.staffId, TARGET_DATE: dateStr }).toString(),
              signal: AbortSignal.timeout(10000),
            });
            if (psRes.ok) {
              const rows = JSON.parse((await psRes.text()).trim());
              if (Array.isArray(rows)) {
                distributorTrajectory = rows
                  .filter((r: any) => parseFloat(r.LATITUDE || '0') !== 0 && parseFloat(r.LONGITUDE || '0') !== 0)
                  .map((r: any) => ({
                    latitude: parseFloat(r.LATITUDE),
                    longitude: parseFloat(r.LONGITUDE),
                    accuracy: null,
                    timestamp: `${dateStr}T${(r.TERMINAL_TIME || '').trim()}+09:00`,
                  }));
                // サンプリング（1000件超）
                if (distributorTrajectory.length > 1000) {
                  const step = Math.ceil(distributorTrajectory.length / 1000);
                  distributorTrajectory = distributorTrajectory.filter((_, i) => i % step === 0 || i === distributorTrajectory.length - 1);
                }
              }
            }
          } catch (e) {
            console.error('[Inspection map-data] PS GPS fallback error:', e);
          }
        }
      }
    }

    // エリア内の禁止物件（PMS DBのみ）
    let prohibitedProperties: any[] = [];
    if (inspection.schedule?.areaId) {
      prohibitedProperties = await prisma.prohibitedProperty.findMany({
        where: {
          areaId: inspection.schedule.areaId,
          isActive: true,
        },
        select: {
          id: true,
          address: true,
          buildingName: true,
          latitude: true,
          longitude: true,
          roomNumber: true,
          residentName: true,
          reasonDetail: true,
          boundaryGeojson: true,
        },
      });
    }

    return NextResponse.json({
      areaGeojson: inspection.schedule?.area?.boundary_geojson || null,
      areaName: inspection.schedule?.area
        ? `${inspection.schedule.area.prefecture.name}${inspection.schedule.area.city.name}${inspection.schedule.area.chome_name}`
        : null,
      distributorTrajectory,
      inspectorTrajectory: inspection.inspectionSession?.gpsPoints || [],
      checkpoints: inspection.checkpoints,
      prohibitedChecks: inspection.prohibitedChecks,
      prohibitedProperties,
    });
  } catch (err) {
    console.error('GET /api/inspections/[id]/map-data error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
