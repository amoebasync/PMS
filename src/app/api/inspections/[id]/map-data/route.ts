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
                address_code: true,
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

    // エリア内の禁止物件（Posting System API → PMS DB フォールバック）
    let prohibitedProperties: any[] = [];
    const addressCode = inspection.schedule?.area?.address_code || null;

    if (addressCode) {
      // Posting System API から禁止物件を取得
      try {
        // 顧客コードを取得（スケジュールのチラシに紐づく顧客）
        const schedule = await prisma.distributionSchedule.findUnique({
          where: { id: inspection.scheduleId! },
          select: { items: { select: { customerId: true } } },
        });
        const customerIds = [...new Set((schedule?.items || []).map(i => i.customerId).filter(Boolean))];
        let clientCodes = '';
        if (customerIds.length > 0) {
          const customers = await prisma.customer.findMany({
            where: { id: { in: customerIds as number[] } },
            select: { customerCode: true },
          });
          clientCodes = customers.map(c => c.customerCode).join(',');
        }
        const psUrl = `https://postingsystem.net/postingmanage/GetForbiddenBuildingsExec.php?areaCode=${encodeURIComponent(addressCode)}&clientCodes=${encodeURIComponent(clientCodes)}`;
        const psRes = await fetch(psUrl, { signal: AbortSignal.timeout(5000) });
        if (psRes.ok) {
          const psBody = await psRes.text();
          let rows: any[] = [];
          try {
            const parsed = JSON.parse(psBody);
            rows = Array.isArray(parsed) ? parsed : (parsed.data || []);
          } catch { /* ignore */ }
          prohibitedProperties = rows
            .filter((r: any) => {
              const lat = parseFloat(r.lat || '0');
              const lng = parseFloat(r.lng || '0');
              return lat !== 0 || lng !== 0;
            })
            .map((r: any) => ({
              id: null,
              latitude: parseFloat(r.lat || '0'),
              longitude: parseFloat(r.lng || '0'),
              address: r.address || null,
              buildingName: r.buildingName || null,
              roomNumber: r.roomNumber || null,
              residentName: r.residentName || null,
              reasonDetail: r.reasonDetail || r.remarks || null,
              pinColor: r.pinColor || null,
              boundaryGeojson: r.boundaryGeojson || r.polygon || null,
            }));
        }
      } catch (e) {
        console.warn('[Inspection map-data] PS forbidden buildings fetch failed:', e);
      }
    }

    // PMS DB フォールバック
    if (prohibitedProperties.length === 0 && inspection.schedule?.areaId) {
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
