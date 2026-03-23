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
    const mode = request.nextUrl.searchParams.get('mode') || 'trajectory'; // 'trajectory' or 'area'

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

    // 配布員のGPSデータを取得（PMS → Posting System フォールバック）
    let gpsPoints: { latitude: number; longitude: number; timestamp: Date }[] = [];

    const distributionSession = await prisma.distributionSession.findUnique({
      where: { scheduleId: inspection.scheduleId },
      select: {
        gpsPoints: {
          orderBy: { timestamp: 'asc' },
          select: { latitude: true, longitude: true, timestamp: true },
        },
      },
    });

    if (distributionSession && distributionSession.gpsPoints.length > 0) {
      gpsPoints = distributionSession.gpsPoints;
    } else {
      // Posting System フォールバック
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
              gpsPoints = rows
                .filter((r: any) => parseFloat(r.LATITUDE || '0') !== 0 && parseFloat(r.LONGITUDE || '0') !== 0)
                .map((r: any) => ({
                  latitude: parseFloat(r.LATITUDE),
                  longitude: parseFloat(r.LONGITUDE),
                  timestamp: new Date(`${dateStr}T${(r.TERMINAL_TIME || '00:00:00').trim()}+09:00`),
                }));
            }
          }
        } catch (e) {
          console.error('[sample-points] PS GPS fallback error:', e);
        }
      }
    }

    if (gpsPoints.length === 0) {
      return NextResponse.json({ samplePoints: [], message: '配布員のGPSデータがありません' });
    }

    // mode=area: エリアポリゴン全体からランダムサンプリング
    if (mode === 'area') {
      // エリアのバウンディングボックスを取得
      const schedule = await prisma.distributionSchedule.findUnique({
        where: { id: inspection.scheduleId },
        select: { area: { select: { boundary_geojson: true } } },
      });
      const geojsonStr = schedule?.area?.boundary_geojson;
      if (!geojsonStr) {
        return NextResponse.json({ samplePoints: [], message: 'エリアポリゴンがありません' });
      }

      // GeoJSONからポリゴン座標を抽出
      let polygons: number[][][] = [];
      try {
        const parsed = JSON.parse(geojsonStr);
        const extractPolygons = (geom: any): void => {
          if (!geom) return;
          if (geom.type === 'FeatureCollection') geom.features.forEach((f: any) => extractPolygons(f.geometry || f));
          else if (geom.type === 'Feature') extractPolygons(geom.geometry);
          else if (geom.type === 'Polygon') polygons.push(geom.coordinates[0]);
          else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((p: any) => polygons.push(p[0]));
        };
        extractPolygons(parsed);
      } catch { /* ignore parse error */ }

      if (polygons.length === 0) {
        return NextResponse.json({ samplePoints: [], message: 'ポリゴンの解析に失敗しました' });
      }

      // バウンディングボックス
      const allCoords = polygons.flat();
      const minLng = Math.min(...allCoords.map(c => c[0]));
      const maxLng = Math.max(...allCoords.map(c => c[0]));
      const minLat = Math.min(...allCoords.map(c => c[1]));
      const maxLat = Math.max(...allCoords.map(c => c[1]));

      // Point-in-polygon判定
      const pointInPolygon = (lng: number, lat: number, poly: number[][]) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
          if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
        }
        return inside;
      };

      // ランダムにエリア内のポイントを生成
      const samplePoints: Array<{ latitude: number; longitude: number; timestamp: Date; index: number }> = [];
      let attempts = 0;
      const maxAttempts = count * 100;
      while (samplePoints.length < count && attempts < maxAttempts) {
        attempts++;
        const lng = minLng + Math.random() * (maxLng - minLng);
        const lat = minLat + Math.random() * (maxLat - minLat);
        const isInside = polygons.some(poly => pointInPolygon(lng, lat, poly));
        if (!isInside) continue;
        // 既存サンプルとの距離チェック（最低30m離す）
        const tooClose = samplePoints.some(sp => {
          const dlat = (sp.latitude - lat) * 111000;
          const dlng = (sp.longitude - lng) * 111000 * Math.cos(lat * Math.PI / 180);
          return Math.sqrt(dlat * dlat + dlng * dlng) < 30;
        });
        if (!tooClose) {
          samplePoints.push({ latitude: lat, longitude: lng, timestamp: new Date(), index: samplePoints.length });
        }
      }

      return NextResponse.json({ samplePoints, totalGpsPoints: gpsPoints.length, mode: 'area' });
    }

    // mode=trajectory: 軌跡上の低速ポイントからサンプリング（既存ロジック）
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

    // 空間的に分散したN個のサンプルを選択（全域にばらつくように）
    // グリッドベース: エリアをN個のセルに分割し、各セルから1つずつ選択
    const samplePoints: Array<{
      latitude: number;
      longitude: number;
      timestamp: Date;
      index: number;
    }> = [];

    if (pool.length <= count) {
      pool.forEach((p, i) => {
        samplePoints.push({ latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp, index: i });
      });
    } else {
      // バウンディングボックスを計算
      const lats = pool.map(p => p.latitude);
      const lngs = pool.map(p => p.longitude);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

      // グリッドのセル数を決定（sqrt(count) x sqrt(count)）
      const gridSize = Math.ceil(Math.sqrt(count));
      const cellWidth = (maxLng - minLng) / gridSize || 0.001;
      const cellHeight = (maxLat - minLat) / gridSize || 0.001;

      // 各セルにポイントを分類
      const cells = new Map<string, typeof pool>();
      for (const p of pool) {
        const col = Math.min(Math.floor((p.longitude - minLng) / cellWidth), gridSize - 1);
        const row = Math.min(Math.floor((p.latitude - minLat) / cellHeight), gridSize - 1);
        const key = `${row},${col}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(p);
      }

      // 各セルからランダムに1つ選択
      const cellKeys = Array.from(cells.keys());
      // ポイントが多いセルを優先
      cellKeys.sort((a, b) => (cells.get(b)?.length || 0) - (cells.get(a)?.length || 0));

      for (const key of cellKeys) {
        if (samplePoints.length >= count) break;
        const cellPoints = cells.get(key)!;
        // セル内のランダムなポイントを選択
        const randIdx = Math.floor(Math.random() * cellPoints.length);
        const p = cellPoints[randIdx];
        // 既存サンプルとの最小距離をチェック（近すぎるポイントを除外）
        const tooClose = samplePoints.some(sp =>
          haversineDistance(sp.latitude, sp.longitude, p.latitude, p.longitude) < 30
        );
        if (!tooClose) {
          samplePoints.push({ latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp, index: pool.indexOf(p) });
        }
      }

      // まだ足りない場合はランダムに追加
      if (samplePoints.length < count) {
        const remaining = pool.filter(p => !samplePoints.some(sp =>
          haversineDistance(sp.latitude, sp.longitude, p.latitude, p.longitude) < 20
        ));
        while (samplePoints.length < count && remaining.length > 0) {
          const randIdx = Math.floor(Math.random() * remaining.length);
          const p = remaining.splice(randIdx, 1)[0];
          samplePoints.push({ latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp, index: pool.indexOf(p) });
        }
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
