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

    // 配布員のGPS軌跡（distribution_sessionsから取得）
    let distributorTrajectory: { latitude: number; longitude: number; accuracy: number | null; timestamp: Date }[] = [];
    if (inspection.scheduleId) {
      const distributionSession = await prisma.distributionSession.findUnique({
        where: { scheduleId: inspection.scheduleId },
        select: {
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
      });
      if (distributionSession) {
        distributorTrajectory = distributionSession.gpsPoints;
      }
    }

    // エリア内の禁止物件
    let prohibitedProperties: { id: number; address: string; buildingName: string | null; latitude: number | null; longitude: number | null }[] = [];
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
