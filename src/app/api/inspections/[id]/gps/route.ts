import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// POST /api/inspections/[id]/gps
// 巡回担当者のGPS座標を記録（高頻度・軽量、監査ログなし）
export async function POST(
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

    const body = await request.json();
    const { latitude, longitude, accuracy, timestamp } = body;

    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: 'latitude と longitude は必須です' }, { status: 400 });
    }

    // 該当するInspectionSessionを取得
    const session = await prisma.inspectionSession.findUnique({
      where: { inspectionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません。先に開始してください' }, { status: 404 });
    }

    if (session.finishedAt) {
      return NextResponse.json({ error: 'セッションは既に終了しています' }, { status: 400 });
    }

    const gpsPoint = await prisma.inspectionGpsPoint.create({
      data: {
        sessionId: session.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy != null ? parseFloat(accuracy) : null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({ id: gpsPoint.id });
  } catch (err) {
    console.error('POST /api/inspections/[id]/gps error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
