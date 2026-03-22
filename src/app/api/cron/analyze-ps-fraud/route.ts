import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationEmitter } from '@/lib/notification-emitter';
import {
  haversineM,
  extractPolygons,
  pointInAnyPolygon,
  clusterDwellSpots,
  OUT_OF_AREA_DWELL_THRESHOLD_MS,
  mean,
  stdDev,
} from '@/lib/fraud-analysis';

const CRON_SECRET = process.env.CRON_SECRET;
const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

// PS fallback 用の重み（4指標、合計100）
const PS_WEIGHTS = {
  outOfAreaRatio: 30,
  outOfAreaDwell: 25,
  distanceCountRatio: 25,
  speedAnomaly: 20,
};

const RISK_THRESHOLDS = { CRITICAL: 80, HIGH: 60, MEDIUM: 30 };

/**
 * POST /api/cron/analyze-ps-fraud
 * 毎日21:00 JST (UTC 12:00) に実行
 * PMS セッションがない完了スケジュールに対して Posting System GPS データで不正検知分析
 */
export async function POST(request: Request) {
  // 2台構成の重複実行防止
  if (process.env.CRON_PRIMARY !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'not primary' });
  }

  // Bearer トークン認証
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  if (!PS_API_URL) {
    return NextResponse.json({ error: 'POSTING_SYSTEM_API_URL が設定されていません' }, { status: 500 });
  }

  try {
    // JSTで前日の日付を取得（朝5:00実行のため前日分を分析）
    const nowJst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    nowJst.setDate(nowJst.getDate() - 1);
    const todayStr = `${nowJst.getFullYear()}-${String(nowJst.getMonth() + 1).padStart(2, '0')}-${String(nowJst.getDate()).padStart(2, '0')}`;
    const todayStart = new Date(`${todayStr}T00:00:00+09:00`);
    const todayEnd = new Date(`${todayStr}T23:59:59+09:00`);

    // 1. 前日の完了スケジュールでPMSセッションがないものを取得
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        status: 'COMPLETED',
        session: null, // PMSセッションなし（PS fallback）
        distributor: {
          staffId: { not: '' }, // staffId が存在する
        },
        distributorId: { not: null },
      },
      include: {
        distributor: { select: { id: true, name: true, staffId: true } },
        area: true,
        items: { orderBy: { slotIndex: 'asc' } },
      },
    });

    if (schedules.length === 0) {
      console.log('[PS-FraudAnalysis] No PS fallback schedules found for today');
      return NextResponse.json({ success: true, date: todayStr, analyzed: 0, skipped: 0 });
    }

    // 2. 既に fraud_analyses がある scheduleId を除外（重複防止）
    const scheduleIds = schedules.map(s => s.id);
    const existingAnalyses = await prisma.fraudAnalysis.findMany({
      where: { scheduleId: { in: scheduleIds } },
      select: { scheduleId: true },
    });
    const analyzedScheduleIds = new Set(existingAnalyses.map(a => a.scheduleId));

    const targetSchedules = schedules.filter(s => !analyzedScheduleIds.has(s.id));

    if (targetSchedules.length === 0) {
      console.log('[PS-FraudAnalysis] All schedules already analyzed');
      return NextResponse.json({ success: true, date: todayStr, analyzed: 0, skipped: schedules.length });
    }

    let analyzed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const schedule of targetSchedules) {
      try {
        const result = await analyzeScheduleWithPsGps(schedule, todayStr);
        if (result) {
          analyzed++;
        } else {
          skipped++;
        }
      } catch (e: any) {
        skipped++;
        errors.push(`scheduleId=${schedule.id}: ${e.message}`);
        console.error(`[PS-FraudAnalysis] Error for scheduleId=${schedule.id}:`, e);
      }
    }

    console.log(`[PS-FraudAnalysis] Complete: analyzed=${analyzed}, skipped=${skipped}, errors=${errors.length}`);

    return NextResponse.json({
      success: true,
      date: todayStr,
      totalCandidates: schedules.length,
      alreadyAnalyzed: schedules.length - targetSchedules.length,
      analyzed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[PS-FraudAnalysis] Error:', error);
    return NextResponse.json({ error: 'PS不正検知分析に失敗しました' }, { status: 500 });
  }
}

/**
 * Posting System API から GPS データを取得
 */
async function fetchPsGpsData(
  staffId: string,
  targetDate: string
): Promise<Array<{ lat: number; lng: number; timestamp: Date }>> {
  const psUrl = `${PS_API_URL}/GetStaffGPS.php`;
  const body = new URLSearchParams({
    STAFF_ID: staffId,
    TARGET_DATE: targetDate,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (PS_API_KEY) {
    headers['X-API-Key'] = PS_API_KEY;
  }

  const psRes = await fetch(psUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!psRes.ok) {
    throw new Error(`PS API error: ${psRes.status}`);
  }

  const psBody = await psRes.text();
  let rows: any[] = [];
  try {
    const parsed = JSON.parse(psBody);
    rows = Array.isArray(parsed) ? parsed : (parsed.data || []);
  } catch {
    throw new Error('PS API response parse error');
  }

  // GPS ポイントの変換（lat/lng が 0,0 のポイントは除外）
  const points = rows
    .filter((r: any) => {
      const lat = parseFloat(r.LATITUDE || '0');
      const lng = parseFloat(r.LONGITUDE || '0');
      return lat !== 0 && lng !== 0;
    })
    .map((r: any) => {
      const terminalTime = (r.TERMINAL_TIME || '').trim();
      // "HH:MM:SS" → "${targetDate}THH:MM:SS+09:00"
      const isoTimestamp = terminalTime
        ? `${targetDate}T${terminalTime}+09:00`
        : new Date().toISOString();

      return {
        lat: parseFloat(r.LATITUDE),
        lng: parseFloat(r.LONGITUDE),
        timestamp: new Date(isoTimestamp),
      };
    })
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return points;
}

/**
 * 1000ポイント超はサンプリング
 */
function samplePoints<T>(points: T[], maxPoints: number = 1000): T[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

/**
 * GPS移動距離の合計を計算
 */
function calculateTotalDistance(points: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

/**
 * エリア平均の過去データ統計（PS fallback 用 -- セッションベースではなく FraudAnalysis テーブルから取得）
 */
async function getPsAreaStats(areaId: number, excludeScheduleId: number): Promise<{
  avgSpeed: number;
  stdSpeed: number;
  avgDistPerCount: number;
  stdDistPerCount: number;
  count: number;
}> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // 過去の同エリアの完了スケジュール（セッションあり）から統計を取得
  const sessions = await prisma.distributionSession.findMany({
    where: {
      finishedAt: { not: null },
      startedAt: { gte: ninetyDaysAgo },
      schedule: {
        areaId,
        id: { not: excludeScheduleId },
      },
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
    const maxActual = Math.max(...s.schedule.items.map(i => i.actualCount ?? 0), 0);
    if (maxActual <= 0) continue;

    const sessionMs = s.finishedAt.getTime() - s.startedAt.getTime();
    let pauseMs = 0;
    for (const pe of s.pauseEvents) {
      const end = pe.resumedAt || s.finishedAt;
      pauseMs += end.getTime() - pe.pausedAt.getTime();
    }
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

/**
 * 個別スケジュールの PS GPS 不正検知分析
 */
async function analyzeScheduleWithPsGps(
  schedule: any,
  targetDate: string
): Promise<boolean> {
  const staffId = schedule.distributor?.staffId;
  if (!staffId) {
    console.log(`[PS-FraudAnalysis] scheduleId=${schedule.id} — no staffId, skipping`);
    return false;
  }

  // エリアポリゴン
  const polygons = schedule.area?.boundary_geojson
    ? extractPolygons(schedule.area.boundary_geojson)
    : [];

  if (polygons.length === 0) {
    console.log(`[PS-FraudAnalysis] scheduleId=${schedule.id} — no boundary_geojson, skipping`);
    return false;
  }

  // PS GPS データ取得
  let gpsPoints = await fetchPsGpsData(staffId, targetDate);

  if (gpsPoints.length === 0) {
    console.log(`[PS-FraudAnalysis] scheduleId=${schedule.id} — no GPS points, skipping`);
    return false;
  }

  // 1000ポイント超はサンプリング
  gpsPoints = samplePoints(gpsPoints);

  const maxActual = Math.max(...schedule.items.map((i: any) => i.actualCount ?? 0), 0);

  // GPS データから作業時間を推定（最初のポイント〜最後のポイント）
  const firstTimestamp = gpsPoints[0].timestamp;
  const lastTimestamp = gpsPoints[gpsPoints.length - 1].timestamp;
  const workMs = lastTimestamp.getTime() - firstTimestamp.getTime();
  const workHours = workMs / 3_600_000;

  // GPS移動距離の合計
  const totalDistance = calculateTotalDistance(gpsPoints);

  // --- 指標1: エリア外活動率 (weight 30%) ---
  let outOfAreaRatio = 0;
  if (polygons.length > 0) {
    const outsideCount = gpsPoints.filter(p => !pointInAnyPolygon(p.lat, p.lng, polygons)).length;
    outOfAreaRatio = Math.min(outsideCount / gpsPoints.length, 1);
  }

  // --- 指標2: エリア外長時間滞在 (weight 25%) ---
  let outOfAreaDwell = 0;
  if (polygons.length > 0) {
    const dwellSpots = clusterDwellSpots(gpsPoints);
    const outsideDwells = dwellSpots.filter(
      s => !pointInAnyPolygon(s.centerLat, s.centerLng, polygons) && s.dwellMs >= OUT_OF_AREA_DWELL_THRESHOLD_MS
    );
    const totalOutsideDwellMs = outsideDwells.reduce((sum, s) => sum + s.dwellMs, 0);
    // 実働時間の30%以上がエリア外滞在なら1.0
    outOfAreaDwell = workMs > 0 ? Math.min(totalOutsideDwellMs / (workMs * 0.3), 1) : 0;
  }

  // --- 過去データ取得（エリア平均） ---
  const areaStats = schedule.areaId
    ? await getPsAreaStats(schedule.areaId, schedule.id)
    : { avgSpeed: 0, stdSpeed: 0, avgDistPerCount: 0, stdDistPerCount: 0, count: 0 };

  // --- 指標3: 距離-枚数比 (weight 25%) ---
  let distanceCountRatio = 0;
  if (maxActual > 0 && totalDistance > 0) {
    const currentDistPerCount = totalDistance / maxActual;
    if (areaStats.count >= 3 && areaStats.avgDistPerCount > 0) {
      const threshold = areaStats.avgDistPerCount / 3;
      distanceCountRatio = currentDistPerCount < threshold ? 1 : currentDistPerCount < areaStats.avgDistPerCount / 2 ? 0.5 : 0;
    }
  }

  // --- 指標4: 配布速度異常 (weight 20%) ---
  let speedAnomaly = 0;
  if (maxActual > 0 && workHours > 0) {
    const currentSpeed = maxActual / workHours;
    // エリア平均+3σ超で1.0
    if (areaStats.count >= 3 && areaStats.stdSpeed > 0) {
      const zScore = (currentSpeed - areaStats.avgSpeed) / areaStats.stdSpeed;
      speedAnomaly = zScore > 3 ? 1 : zScore > 2 ? 0.5 : 0;
    }
  }

  // --- 総合リスクスコア ---
  const riskScore = Math.round(
    outOfAreaRatio * PS_WEIGHTS.outOfAreaRatio +
    outOfAreaDwell * PS_WEIGHTS.outOfAreaDwell +
    distanceCountRatio * PS_WEIGHTS.distanceCountRatio +
    speedAnomaly * PS_WEIGHTS.speedAnomaly
  );

  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
    riskScore >= RISK_THRESHOLDS.CRITICAL ? 'CRITICAL' :
    riskScore >= RISK_THRESHOLDS.HIGH ? 'HIGH' :
    riskScore >= RISK_THRESHOLDS.MEDIUM ? 'MEDIUM' : 'LOW';

  // 分析詳細
  const detail = {
    source: 'posting-system',
    gpsPointCount: gpsPoints.length,
    workDurationMin: Math.round(workMs / 60_000),
    maxActualCount: maxActual,
    totalDistanceM: Math.round(totalDistance),
    currentSpeedPerHour: workHours > 0 ? Math.round(maxActual / workHours) : 0,
    currentDistPerCount: maxActual > 0 ? Math.round(totalDistance / maxActual * 10) / 10 : 0,
    areaStats: {
      avg: Math.round(areaStats.avgSpeed),
      std: Math.round(areaStats.stdSpeed),
      samples: areaStats.count,
    },
    firstGpsTime: firstTimestamp.toISOString(),
    lastGpsTime: lastTimestamp.toISOString(),
  };

  // DB保存（sessionId = null でスケジュールIDベースで保存）
  await prisma.fraudAnalysis.create({
    data: {
      sessionId: null,
      scheduleId: schedule.id,
      distributorId: schedule.distributorId,
      outOfAreaRatio,
      outOfAreaDwell,
      distanceCountRatio,
      speedAnomaly,
      gpsGapRatio: 0, // PS fallback では算出しない
      workRatio: 0,    // PS fallback では算出しない
      riskScore,
      riskLevel,
      analysisDetail: JSON.stringify(detail),
    },
  });

  // HIGH/CRITICAL の場合は管理者通知
  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    const areaName = schedule.area
      ? `${schedule.area.chome_name || schedule.area.town_name || ''}`
      : '';

    await prisma.adminNotification.create({
      data: {
        type: 'ALERT',
        title: `不正検知(PS): ${schedule.distributor?.name || '不明'} — ${riskLevel}`,
        message: `${areaName} / リスクスコア: ${riskScore}`,
        scheduleId: schedule.id,
        distributorId: schedule.distributorId,
      },
    });
    notificationEmitter.emit({ type: 'ALERT' });
  }

  console.log(`[PS-FraudAnalysis] scheduleId=${schedule.id} score=${riskScore} level=${riskLevel}`);
  return true;
}
