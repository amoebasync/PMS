import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET /api/inspections/[id]/sample-points
// 配布員の軌跡からランダムサンプルポイントを生成
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

    const count = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('count') || '10')));

    const inspection = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
      select: { scheduleId: true },
    });

    if (!inspection) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    if (!inspection.scheduleId) {
      return NextResponse.json({ error: 'スケジュールが紐付いていません' }, { status: 400 });
    }

    // 配布員のGPSデータを取得
    const distributionSession = await prisma.distributionSession.findUnique({
      where: { scheduleId: inspection.scheduleId },
      select: {
        gpsPoints: {
          orderBy: { timestamp: 'asc' },
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
          },
        },
      },
    });

    if (!distributionSession || distributionSession.gpsPoints.length === 0) {
      return NextResponse.json({ samplePoints: [], message: '配布員のGPSデータがありません' });
    }

    const gpsPoints = distributionSession.gpsPoints;

    // 速度を計算してフィルタ（低速=配布中の可能性が高いポイント）
    // Haversine距離計算
    function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371000; // メートル
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    // 低速ポイントの抽出（配布停止地点の候補）
    interface CandidatePoint {
      latitude: number;
      longitude: number;
      timestamp: Date;
      speed: number; // m/s
    }

    const candidates: CandidatePoint[] = [];

    for (let i = 1; i < gpsPoints.length; i++) {
      const prev = gpsPoints[i - 1];
      const curr = gpsPoints[i];
      const dist = haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000; // seconds

      if (timeDiff <= 0) continue;

      const speed = dist / timeDiff; // m/s

      // 低速ポイント: 歩行速度以下（< 2 m/s ≈ 7.2 km/h）
      if (speed < 2.0) {
        candidates.push({
          latitude: curr.latitude,
          longitude: curr.longitude,
          timestamp: curr.timestamp,
          speed,
        });
      }
    }

    // 候補がない場合は全ポイントを対象にする
    const pool = candidates.length > 0 ? candidates : gpsPoints.map(p => ({
      ...p,
      speed: 0,
    }));

    // タイムライン全体に均等分布するようにN個のサンプルを選択
    const samplePoints: Array<{
      latitude: number;
      longitude: number;
      timestamp: Date;
      index: number;
    }> = [];

    if (pool.length <= count) {
      // 候補数がcount以下ならすべて返す
      pool.forEach((p, i) => {
        samplePoints.push({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
          index: i,
        });
      });
    } else {
      // 均等間隔でサンプリング
      const step = pool.length / count;
      for (let i = 0; i < count; i++) {
        const idx = Math.min(Math.floor(i * step), pool.length - 1);
        const p = pool[idx];
        samplePoints.push({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
          index: idx,
        });
      }
    }

    return NextResponse.json({
      samplePoints,
      totalGpsPoints: gpsPoints.length,
      lowSpeedCandidates: candidates.length,
    });
  } catch (err) {
    console.error('GET /api/inspections/[id]/sample-points error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
