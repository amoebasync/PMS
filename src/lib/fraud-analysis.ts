/**
 * 配布不正検知分析ロジック
 *
 * 6つの指標を算出し、重み付き合計でリスクスコア（0〜100）を算出する。
 * 配布速度・距離枚数比はエリア平均 + 配布員個人平均の2軸で比較する。
 */

import { prisma } from '@/lib/prisma';
import { notificationEmitter } from '@/lib/notification-emitter';

// --- 定数 ---
const EARTH_RADIUS_M = 6371000;
const DWELL_RADIUS_M = 30;       // 滞在スポットのクラスタ半径（メートル）
const DWELL_MIN_MS = 30_000;     // 最低滞在時間（30秒）
const OUT_OF_AREA_DWELL_THRESHOLD_MS = 10 * 60_000; // エリア外滞在の警告閾値（10分）

// 各指標の重み（合計100）
const WEIGHTS = {
  outOfAreaRatio: 25,
  outOfAreaDwell: 20,
  distanceCountRatio: 20,
  speedAnomaly: 15,
  gpsGapRatio: 10,
  workRatio: 10,
};

// リスクレベル閾値
const RISK_THRESHOLDS = { CRITICAL: 80, HIGH: 60, MEDIUM: 30 };

// --- Geo ユーティリティ ---

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** GeoJSONからポリゴン配列を抽出（TrajectoryViewer.tsx と同一ロジック） */
function extractPolygons(geojsonStr: string): Array<Array<{ lat: number; lng: number }>> {
  if (!geojsonStr) return [];
  const trimmed = geojsonStr.trim();
  if (!trimmed.startsWith('{')) return [];
  try {
    const parsed = JSON.parse(trimmed);
    const getCoords = (geom: any): any[][] => {
      if (!geom) return [];
      if (geom.type === 'FeatureCollection') return geom.features.flatMap((f: any) => getCoords(f.geometry || f));
      if (geom.type === 'Feature') return getCoords(geom.geometry);
      if (geom.type === 'Polygon') return [geom.coordinates[0]];
      if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly: any[]) => poly[0]);
      return [];
    };
    return getCoords(parsed)
      .map((poly: any[]) =>
        poly
          .map((c: any[]) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) }))
          .filter((c) => !isNaN(c.lat) && !isNaN(c.lng))
      )
      .filter((p) => p.length > 0);
  } catch {
    return [];
  }
}

/** Ray-casting法によるPoint-in-Polygon判定 */
function pointInPolygon(lat: number, lng: number, polygon: Array<{ lat: number; lng: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** いずれかのポリゴン内に点があるか */
function pointInAnyPolygon(lat: number, lng: number, polygons: Array<Array<{ lat: number; lng: number }>>): boolean {
  return polygons.some((poly) => pointInPolygon(lat, lng, poly));
}

// --- 滞在スポットクラスタリング ---

interface DwellSpot {
  centerLat: number;
  centerLng: number;
  dwellMs: number;
  startTime: Date;
  endTime: Date;
}

function clusterDwellSpots(points: Array<{ lat: number; lng: number; timestamp: Date }>): DwellSpot[] {
  if (points.length < 2) return [];
  const spots: DwellSpot[] = [];
  let clusterStart = 0;
  let centroidLat = points[0].lat;
  let centroidLng = points[0].lng;

  for (let i = 1; i < points.length; i++) {
    const dist = haversineM(centroidLat, centroidLng, points[i].lat, points[i].lng);
    if (dist <= DWELL_RADIUS_M) {
      const n = i - clusterStart + 1;
      centroidLat += (points[i].lat - centroidLat) / n;
      centroidLng += (points[i].lng - centroidLng) / n;
    } else {
      const dwellMs = points[i - 1].timestamp.getTime() - points[clusterStart].timestamp.getTime();
      if (dwellMs >= DWELL_MIN_MS) {
        spots.push({ centerLat: centroidLat, centerLng: centroidLng, dwellMs, startTime: points[clusterStart].timestamp, endTime: points[i - 1].timestamp });
      }
      clusterStart = i;
      centroidLat = points[i].lat;
      centroidLng = points[i].lng;
    }
  }
  const lastMs = points[points.length - 1].timestamp.getTime() - points[clusterStart].timestamp.getTime();
  if (lastMs >= DWELL_MIN_MS) {
    spots.push({ centerLat: centroidLat, centerLng: centroidLng, dwellMs: lastMs, startTime: points[clusterStart].timestamp, endTime: points[points.length - 1].timestamp });
  }
  return spots;
}

// --- Pause時間の合計を計算 ---

function totalPauseMs(pauseEvents: Array<{ pausedAt: Date; resumedAt: Date | null }>, sessionEnd: Date): number {
  let total = 0;
  for (const pe of pauseEvents) {
    const end = pe.resumedAt || sessionEnd;
    total += end.getTime() - pe.pausedAt.getTime();
  }
  return total;
}

// --- 過去データ統計 ---

interface HistoricalStats {
  avgSpeed: number;       // 枚/時
  stdSpeed: number;
  avgDistPerCount: number; // m/枚
  stdDistPerCount: number;
  count: number;
}

async function getAreaStats(areaId: number, excludeSessionId: number): Promise<HistoricalStats> {
  return getHistoricalStats({ areaId }, excludeSessionId);
}

async function getDistributorStats(distributorId: number, excludeSessionId: number): Promise<HistoricalStats> {
  return getHistoricalStats({ distributorId }, excludeSessionId);
}

async function getHistoricalStats(
  filter: { areaId?: number; distributorId?: number },
  excludeSessionId: number
): Promise<HistoricalStats> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const sessions = await prisma.distributionSession.findMany({
    where: {
      id: { not: excludeSessionId },
      finishedAt: { not: null },
      startedAt: { gte: ninetyDaysAgo },
      ...(filter.distributorId ? { distributorId: filter.distributorId } : {}),
      ...(filter.areaId ? { schedule: { areaId: filter.areaId } } : {}),
    },
    include: {
      schedule: { include: { items: true } },
      pauseEvents: true,
    },
    take: 200,
  });

  const speeds: number[] = [];
  const distPerCounts: number[] = [];

  for (const s of sessions) {
    if (!s.finishedAt || !s.schedule) continue;
    const maxActual = Math.max(...s.schedule.items.map((i) => i.actualCount ?? 0), 0);
    if (maxActual <= 0) continue;

    const sessionMs = s.finishedAt.getTime() - s.startedAt.getTime();
    const pauseMs = totalPauseMs(s.pauseEvents, s.finishedAt);
    const workMs = sessionMs - pauseMs;
    if (workMs <= 0) continue;

    const workHours = workMs / 3_600_000;
    speeds.push(maxActual / workHours);

    if (s.totalDistance > 0) {
      distPerCounts.push(s.totalDistance / maxActual);
    }
  }

  return {
    avgSpeed: mean(speeds),
    stdSpeed: stdDev(speeds),
    avgDistPerCount: mean(distPerCounts),
    stdDistPerCount: stdDev(distPerCounts),
    count: speeds.length,
  };
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// --- メイン分析関数 ---

export async function analyzeFraudIndicators(sessionId: number): Promise<void> {
  const session = await prisma.distributionSession.findUnique({
    where: { id: sessionId },
    include: {
      schedule: { include: { items: true, area: true } },
      gpsPoints: { orderBy: { timestamp: 'asc' } },
      progressEvents: { orderBy: { timestamp: 'asc' } },
      pauseEvents: { orderBy: { pausedAt: 'asc' } },
    },
  });

  if (!session || !session.finishedAt || !session.schedule) return;

  const schedule = session.schedule;
  const gpsPoints = session.gpsPoints.map((p) => ({
    lat: p.latitude, lng: p.longitude, timestamp: p.timestamp,
    accuracy: p.accuracy, steps: p.steps, distance: p.distance,
  }));

  if (gpsPoints.length < 5) return; // データ不足

  const maxActual = Math.max(...schedule.items.map((i) => i.actualCount ?? 0), 0);
  const sessionMs = session.finishedAt.getTime() - session.startedAt.getTime();
  const pauseMs = totalPauseMs(session.pauseEvents, session.finishedAt);
  const workMs = sessionMs - pauseMs;
  const workHours = workMs / 3_600_000;

  // エリアポリゴン取得
  const polygons = schedule.area?.boundary_geojson
    ? extractPolygons(schedule.area.boundary_geojson)
    : [];

  // --- 指標1: エリア外活動率 ---
  let outOfAreaRatio = 0;
  if (polygons.length > 0) {
    const outsideCount = gpsPoints.filter((p) => !pointInAnyPolygon(p.lat, p.lng, polygons)).length;
    outOfAreaRatio = Math.min(outsideCount / gpsPoints.length, 1);
  }

  // --- 指標2: エリア外長時間滞在 ---
  let outOfAreaDwell = 0;
  if (polygons.length > 0) {
    const dwellSpots = clusterDwellSpots(gpsPoints);
    const outsideDwells = dwellSpots.filter(
      (s) => !pointInAnyPolygon(s.centerLat, s.centerLng, polygons) && s.dwellMs >= OUT_OF_AREA_DWELL_THRESHOLD_MS
    );
    const totalOutsideDwellMs = outsideDwells.reduce((sum, s) => sum + s.dwellMs, 0);
    // 実働時間の30%以上がエリア外滞在なら1.0
    outOfAreaDwell = workMs > 0 ? Math.min(totalOutsideDwellMs / (workMs * 0.3), 1) : 0;
  }

  // --- 過去データ取得（エリア平均 + 配布員平均） ---
  const areaStats = schedule.areaId
    ? await getAreaStats(schedule.areaId, sessionId)
    : { avgSpeed: 0, stdSpeed: 0, avgDistPerCount: 0, stdDistPerCount: 0, count: 0 };
  const distStats = await getDistributorStats(session.distributorId, sessionId);

  // --- 指標3: 距離-枚数比 ---
  let distanceCountRatio = 0;
  if (maxActual > 0 && session.totalDistance > 0) {
    const currentDistPerCount = session.totalDistance / maxActual;
    // 2軸比較: エリア平均と配布員平均
    let anomalyScores: number[] = [];
    if (areaStats.count >= 3 && areaStats.avgDistPerCount > 0) {
      const threshold = areaStats.avgDistPerCount / 3;
      anomalyScores.push(currentDistPerCount < threshold ? 1 : currentDistPerCount < areaStats.avgDistPerCount / 2 ? 0.5 : 0);
    }
    if (distStats.count >= 3 && distStats.avgDistPerCount > 0) {
      const threshold = distStats.avgDistPerCount / 3;
      anomalyScores.push(currentDistPerCount < threshold ? 1 : currentDistPerCount < distStats.avgDistPerCount / 2 ? 0.5 : 0);
    }
    distanceCountRatio = anomalyScores.length > 0 ? Math.max(...anomalyScores) : 0;
  }

  // --- 指標4: 配布速度異常 ---
  let speedAnomaly = 0;
  if (maxActual > 0 && workHours > 0) {
    const currentSpeed = maxActual / workHours;
    let areaAnomaly = 0;
    let distAnomaly = 0;

    // エリア平均+2σ比較
    if (areaStats.count >= 3 && areaStats.stdSpeed > 0) {
      const zScore = (currentSpeed - areaStats.avgSpeed) / areaStats.stdSpeed;
      areaAnomaly = zScore > 3 ? 1 : zScore > 2 ? 0.5 : 0;
    }
    // 配布員平均+2σ比較
    if (distStats.count >= 3 && distStats.stdSpeed > 0) {
      const zScore = (currentSpeed - distStats.avgSpeed) / distStats.stdSpeed;
      distAnomaly = zScore > 3 ? 1 : zScore > 2 ? 0.5 : 0;
    }

    // 両方超えていれば1.0、片方だけなら0.5程度
    if (areaAnomaly > 0 && distAnomaly > 0) {
      speedAnomaly = Math.max(areaAnomaly, distAnomaly);
    } else {
      speedAnomaly = Math.max(areaAnomaly, distAnomaly) * 0.5;
    }
  }

  // --- 指標5: GPS欠損率 ---
  let gpsGapRatio = 0;
  if (workMs > 0) {
    const gpsIntervalSetting = await prisma.systemSetting.findUnique({ where: { key: 'gpsTrackingInterval' } });
    const intervalSec = parseInt(gpsIntervalSetting?.value || '10', 10);
    const expectedPoints = Math.floor(workMs / (intervalSec * 1000));
    if (expectedPoints > 0) {
      const receivedRatio = gpsPoints.length / expectedPoints;
      // 受信率50%未満で1.0、70%未満で0.5
      gpsGapRatio = receivedRatio < 0.5 ? 1 : receivedRatio < 0.7 ? 0.5 : 0;
    }
  }

  // --- 指標6: 実働率 ---
  let workRatioScore = 0;
  if (sessionMs > 0) {
    const ratio = workMs / sessionMs;
    // 実働率40%未満で1.0、60%未満で0.5
    workRatioScore = ratio < 0.4 ? 1 : ratio < 0.6 ? 0.5 : 0;
  }

  // --- 総合リスクスコア ---
  const riskScore = Math.round(
    outOfAreaRatio * WEIGHTS.outOfAreaRatio +
    outOfAreaDwell * WEIGHTS.outOfAreaDwell +
    distanceCountRatio * WEIGHTS.distanceCountRatio +
    speedAnomaly * WEIGHTS.speedAnomaly +
    gpsGapRatio * WEIGHTS.gpsGapRatio +
    workRatioScore * WEIGHTS.workRatio
  );

  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
    riskScore >= RISK_THRESHOLDS.CRITICAL ? 'CRITICAL' :
    riskScore >= RISK_THRESHOLDS.HIGH ? 'HIGH' :
    riskScore >= RISK_THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';

  // 分析詳細
  const detail = {
    sessionDurationMin: Math.round(sessionMs / 60_000),
    pauseDurationMin: Math.round(pauseMs / 60_000),
    workDurationMin: Math.round(workMs / 60_000),
    gpsPointCount: gpsPoints.length,
    maxActualCount: maxActual,
    totalDistanceM: Math.round(session.totalDistance),
    currentSpeedPerHour: workHours > 0 ? Math.round(maxActual / workHours) : 0,
    currentDistPerCount: maxActual > 0 ? Math.round(session.totalDistance / maxActual * 10) / 10 : 0,
    areaStats: { avg: Math.round(areaStats.avgSpeed), std: Math.round(areaStats.stdSpeed), samples: areaStats.count },
    distributorStats: { avg: Math.round(distStats.avgSpeed), std: Math.round(distStats.stdSpeed), samples: distStats.count },
  };

  // DB保存
  await prisma.fraudAnalysis.upsert({
    where: { sessionId },
    create: {
      sessionId,
      scheduleId: session.scheduleId,
      distributorId: session.distributorId,
      outOfAreaRatio,
      outOfAreaDwell,
      distanceCountRatio,
      speedAnomaly,
      gpsGapRatio,
      workRatio: workRatioScore,
      riskScore,
      riskLevel,
      analysisDetail: JSON.stringify(detail),
    },
    update: {
      outOfAreaRatio,
      outOfAreaDwell,
      distanceCountRatio,
      speedAnomaly,
      gpsGapRatio,
      workRatio: workRatioScore,
      riskScore,
      riskLevel,
      analysisDetail: JSON.stringify(detail),
    },
  });

  // HIGH/CRITICAL の場合は管理者通知
  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: session.distributorId },
      select: { name: true },
    });
    const areaName = schedule.area
      ? `${schedule.area.town_name || ''}${schedule.area.chome_name || ''}`
      : '';

    await prisma.adminNotification.create({
      data: {
        type: 'ALERT',
        title: `不正検知: ${distributor?.name || '不明'} — ${riskLevel}`,
        message: `${areaName} / リスクスコア: ${riskScore}`,
        scheduleId: session.scheduleId || undefined,
        distributorId: session.distributorId,
      },
    });
    notificationEmitter.emit({ type: 'ALERT' });
  }

  console.log(`[FraudAnalysis] session=${sessionId} score=${riskScore} level=${riskLevel}`);
}
