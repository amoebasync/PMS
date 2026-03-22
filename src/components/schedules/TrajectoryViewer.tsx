'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Polyline, Marker, InfoWindow, Circle } from '@react-google-maps/api';

// ============================================================
// Types
// ============================================================
interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: string;
  steps: number | null;
  distance: number | null;
  calories: number | null;
}

interface ProgressEvent {
  id: number;
  mailboxCount: number;
  lat: number | null;
  lng: number | null;
  timestamp: string;
}

interface SkipEvent {
  id: number;
  lat: number;
  lng: number;
  prohibitedPropertyId: number | null;
  prohibitedProperty: { id: number; address: string; buildingName: string } | null;
  reason: string | null;
  timestamp: string;
}

interface PauseEvent {
  id: number;
  pausedAt: string;
  resumedAt: string | null;
}

interface ProhibitedProperty {
  id: number | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  buildingName: string | null;
  pinColor?: string | null;
}

interface TrajectoryData {
  session: {
    id: number;
    startedAt: string;
    finishedAt: string | null;
    totalSteps: number;
    totalDistance: number;
    totalCalories: number;
    incompleteReason: string | null;
    incompleteNote: string | null;
  };
  gpsPoints: GpsPoint[];
  progressEvents: ProgressEvent[];
  skipEvents: SkipEvent[];
  pauseEvents: PauseEvent[];
  area: {
    boundaryGeojson: string;
    townName: string;
    chomeName: string;
  } | null;
  prohibitedProperties: ProhibitedProperty[];
  schedule: {
    id: number;
    date: string;
    status: string;
    distributorName: string;
    distributorStaffId: string;
    items: { id: number; flyerName: string; plannedCount: number; actualCount: number | null }[];
  };
}

interface Props {
  scheduleId: number;
  onClose: () => void;
}

// ============================================================
// GeoJSON parser (same as prohibited-properties page)
// ============================================================
const extractPaths = (geojsonStr: string) => {
  if (!geojsonStr) return [];
  const trimmed = geojsonStr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
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
      const rawPolygons = getCoords(parsed);
      return rawPolygons
        .map((poly: any[]) =>
          poly
            .map((c: any[]) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) }))
            .filter((c: any) => !isNaN(c.lat) && !isNaN(c.lng))
        )
        .filter((p: any[]) => p.length > 0);
    } catch {
      // invalid JSON
    }
  }
  return [];
};

const fmtTime = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Tokyo' });
  } catch {
    return '';
  }
};

const fmtDuration = (ms: number) => {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分${s}秒`;
};

// ============================================================
// Dwell spot analysis
// ============================================================
interface DwellSpot {
  id: number;
  centerLat: number;
  centerLng: number;
  dwellMs: number;        // 滞在時間 (ms)
  pointCount: number;     // GPSポイント数
  startTime: string;      // 滞在開始時刻
  endTime: string;        // 滞在終了時刻
}

type ViewMode = 'trajectory' | 'dwell';

const DWELL_RADIUS_M = 30;          // クラスタ半径 (メートル)
const DWELL_MIN_MS = 30 * 1000;     // 最低滞在時間 (30秒)

/** 2点間の距離 (メートル) — Haversine */
const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** 連続するGPSポイントを滞在スポットにクラスタリング */
const clusterDwellSpots = (points: GpsPoint[]): DwellSpot[] => {
  if (points.length < 2) return [];

  const spots: DwellSpot[] = [];
  let clusterStart = 0;
  let centroidLat = points[0].lat;
  let centroidLng = points[0].lng;
  let spotId = 0;

  for (let i = 1; i < points.length; i++) {
    const dist = haversineM(centroidLat, centroidLng, points[i].lat, points[i].lng);

    if (dist <= DWELL_RADIUS_M) {
      // 重心を更新
      const n = i - clusterStart + 1;
      centroidLat = centroidLat + (points[i].lat - centroidLat) / n;
      centroidLng = centroidLng + (points[i].lng - centroidLng) / n;
    } else {
      // 現クラスタを確定
      const dwellMs = new Date(points[i - 1].timestamp).getTime() - new Date(points[clusterStart].timestamp).getTime();
      if (dwellMs >= DWELL_MIN_MS) {
        spots.push({
          id: spotId++,
          centerLat: centroidLat,
          centerLng: centroidLng,
          dwellMs,
          pointCount: i - clusterStart,
          startTime: points[clusterStart].timestamp,
          endTime: points[i - 1].timestamp,
        });
      }
      // 新クラスタ開始
      clusterStart = i;
      centroidLat = points[i].lat;
      centroidLng = points[i].lng;
    }
  }

  // 最後のクラスタ
  const lastDwell = new Date(points[points.length - 1].timestamp).getTime() - new Date(points[clusterStart].timestamp).getTime();
  if (lastDwell >= DWELL_MIN_MS) {
    spots.push({
      id: spotId++,
      centerLat: centroidLat,
      centerLng: centroidLng,
      dwellMs: lastDwell,
      pointCount: points.length - clusterStart,
      startTime: points[clusterStart].timestamp,
      endTime: points[points.length - 1].timestamp,
    });
  }

  return spots;
};

/** 滞在時間に応じた色 */
const dwellColor = (ms: number) => {
  if (ms < 2 * 60 * 1000) return '#22c55e';       // 緑: ~2分
  if (ms < 5 * 60 * 1000) return '#eab308';       // 黄: 2~5分
  if (ms < 10 * 60 * 1000) return '#f97316';      // オレンジ: 5~10分
  return '#ef4444';                                 // 赤: 10分+
};

/** 滞在時間に応じた円の半径 (px → meters for map) */
const dwellRadius = (ms: number) => {
  const minR = 15;
  const maxR = 50;
  const minMs = DWELL_MIN_MS;
  const maxMs = 15 * 60 * 1000;
  const ratio = Math.min(1, (ms - minMs) / (maxMs - minMs));
  return minR + ratio * (maxR - minR);
};

/** 滞在時間のカテゴリラベル */
const dwellLabel = (ms: number) => {
  if (ms < 2 * 60 * 1000) return '短い停止';
  if (ms < 5 * 60 * 1000) return '中程度';
  if (ms < 10 * 60 * 1000) return '長め';
  return '非常に長い';
};

// ============================================================
// Component
// ============================================================
export default function TrajectoryViewer({ scheduleId, onClose }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [data, setData] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'pms' | 'posting-system'>('pms');

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('trajectory');
  const [selectedDwellSpot, setSelectedDwellSpot] = useState<DwellSpot | null>(null);

  // Playback state
  const [sliderValue, setSliderValue] = useState(1000); // 0-1000 range
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Info window
  const [selectedInfo, setSelectedInfo] = useState<{ position: google.maps.LatLngLiteral; content: string } | null>(null);

  // Live polling
  const [isLive, setIsLive] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Live duration tick (every second)
  const [nowTick, setNowTick] = useState(Date.now());

  // Google Maps ref for panning (must be before early returns)
  const mapRef = useRef<google.maps.Map | null>(null);

  // Dwell spot analysis (must be before early returns to maintain hook order)
  const dwellSpots = useMemo(() => data ? clusterDwellSpots(data.gpsPoints) : [], [data]);
  const dwellSorted = useMemo(() => [...dwellSpots].sort((a, b) => b.dwellMs - a.dwellMs), [dwellSpots]);
  const dwellStats = useMemo(() => {
    if (dwellSpots.length === 0) return { count: 0, avgMs: 0, maxMs: 0, totalMs: 0 };
    const totalMs = dwellSpots.reduce((s, d) => s + d.dwellMs, 0);
    return {
      count: dwellSpots.length,
      avgMs: totalMs / dwellSpots.length,
      maxMs: Math.max(...dwellSpots.map(d => d.dwellMs)),
      totalMs,
    };
  }, [dwellSpots]);

  // Fetch trajectory data (PMS session first, then fallback to Posting System)
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/trajectory`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setDataSource('pms');
        setIsLive(json.session.finishedAt === null);
        return;
      }

      // PMS session not available — try Posting System fallback
      const psRes = await fetch(`/api/schedules/${scheduleId}/trajectory/posting-system`);
      if (psRes.ok) {
        const psJson = await psRes.json();
        // Wrap Posting System data into TrajectoryData shape
        const wrapped: TrajectoryData = {
          session: {
            id: 0,
            startedAt: psJson.gpsPoints.length > 0 ? psJson.gpsPoints[0].timestamp : new Date().toISOString(),
            finishedAt: psJson.gpsPoints.length > 0 ? psJson.gpsPoints[psJson.gpsPoints.length - 1].timestamp : null,
            totalSteps: 0,
            totalDistance: 0,
            totalCalories: 0,
            incompleteReason: null,
            incompleteNote: null,
          },
          gpsPoints: psJson.gpsPoints,
          progressEvents: [],
          skipEvents: [],
          pauseEvents: [],
          area: psJson.area,
          prohibitedProperties: psJson.prohibitedProperties || [],
          schedule: psJson.schedule,
        };
        setData(wrapped);
        setDataSource('posting-system');
        setIsLive(false);
        return;
      }

      const err = await psRes.json().catch(() => ({}));
      setError(err.error || 'データの取得に失敗しました');
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live polling for active sessions
  useEffect(() => {
    if (!isLive) return;
    pollingRef.current = setInterval(() => {
      fetchData();
    }, 15000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isLive, fetchData]);

  // Tick every second for live duration display
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  // Playback animation
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      setSliderValue((prev) => {
        const increment = (delta / 50) * playbackSpeed; // ~20 fps base
        const next = prev + increment;
        if (next >= 1000) {
          setIsPlaying(false);
          return 1000;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">軌跡データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-8 text-center max-w-sm">
          <i className="bi bi-exclamation-triangle text-3xl text-amber-500 mb-3 block"></i>
          <p className="text-slate-700 font-bold mb-2">{error || 'データが見つかりません'}</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600">閉じる</button>
        </div>
      </div>
    );
  }

  // Calculate visible data based on slider
  const points = data.gpsPoints;
  const sliderRatio = sliderValue / 1000;
  const visibleCount = Math.max(1, Math.round(points.length * sliderRatio));
  const visiblePoints = points.slice(0, visibleCount);
  const currentPoint = visiblePoints[visiblePoints.length - 1];

  // Current timestamp based on slider position
  const currentTimestamp = currentPoint ? new Date(currentPoint.timestamp) : null;
  const startTime = new Date(data.session.startedAt);
  const endTime = data.session.finishedAt ? new Date(data.session.finishedAt) : new Date(nowTick);

  // Filter events by current time
  const visibleProgress = currentTimestamp
    ? data.progressEvents.filter((e) => new Date(e.timestamp) <= currentTimestamp)
    : [];
  const visibleSkips = currentTimestamp
    ? data.skipEvents.filter((e) => new Date(e.timestamp) <= currentTimestamp)
    : [];

  // Area polygon
  const areaPaths = data.area?.boundaryGeojson ? extractPaths(data.area.boundaryGeojson) : [];

  // エリアポリゴンの中心を計算（GPSデータがない場合のフォールバック用）
  const areaCenter = areaPaths.length > 0 && areaPaths[0].length > 0
    ? {
        lat: areaPaths[0].reduce((s, p) => s + p.lat, 0) / areaPaths[0].length,
        lng: areaPaths[0].reduce((s, p) => s + p.lng, 0) / areaPaths[0].length,
      }
    : null;

  // Map center: GPSポイント > エリアポリゴン中心 > デフォルト の優先順
  const center = currentPoint
    ? { lat: currentPoint.lat, lng: currentPoint.lng }
    : points.length > 0
    ? { lat: points[0].lat, lng: points[0].lng }
    : areaCenter || { lat: 35.68, lng: 139.76 };

  // PAUSE 中の合計時間を計算（作業時間から除外する）
  const totalPausedMs = (data.pauseEvents || []).reduce((sum, e) => {
    const pausedAt = new Date(e.pausedAt).getTime();
    const resumedAt = e.resumedAt
      ? new Date(e.resumedAt).getTime()
      : data.session.finishedAt
      ? new Date(data.session.finishedAt).getTime()
      : nowTick;
    return sum + Math.max(0, resumedAt - pausedAt);
  }, 0);

  // 実効作業時間（全体時間 - PAUSE 時間）
  const totalDuration = endTime.getTime() - startTime.getTime();
  const duration = Math.max(0, totalDuration - totalPausedMs);
  const durationHours = duration / (1000 * 60 * 60);
  const lastProgress = data.progressEvents[data.progressEvents.length - 1];
  // 完了時: 最も配布実績枚数の多いチラシの actualCount を使用
  // actualCount がない場合は progressEvents の mailboxCount にフォールバック
  const isFinished = !!data.session.finishedAt || data.schedule.status === 'COMPLETED';
  const maxActualCount = Math.max(0, ...data.schedule.items.map(i => i.actualCount || 0));
  const totalMailboxes = (isFinished && maxActualCount > 0)
    ? maxActualCount
    : (lastProgress?.mailboxCount || 0);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/50 backdrop-blur-sm">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-4 py-2 md:py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <i className="bi bi-geo-alt-fill text-emerald-500 text-lg md:text-xl shrink-0"></i>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-800 text-sm md:text-base truncate">
              {data.schedule.distributorName}
              <span className="text-slate-400 font-normal text-xs md:text-sm ml-1 md:ml-2">({data.schedule.distributorStaffId})</span>
            </h2>
            <p className="text-[10px] md:text-xs text-slate-500 truncate">
              {data.area ? (data.area.chomeName || data.area.townName) : ''} / {new Date(data.schedule.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              {isLive && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  LIVE
                </span>
              )}
              {dataSource === 'posting-system' && (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">
                  <i className="bi bi-cloud-arrow-down"></i>
                  Posting System GPS
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* View mode toggle — hide dwell mode for Posting System data */}
          {dataSource === 'pms' ? (
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => { setViewMode('trajectory'); setSelectedDwellSpot(null); }}
                className={`px-2 md:px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  viewMode === 'trajectory'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className="bi bi-bezier2 mr-1"></i>
                <span className="hidden md:inline">軌跡</span>
              </button>
              <button
                onClick={() => { setViewMode('dwell'); setSelectedDwellSpot(null); setIsPlaying(false); }}
                className={`px-2 md:px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  viewMode === 'dwell'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <i className="bi bi-clock-fill mr-1"></i>
                <span className="hidden md:inline">滞在時間</span>
              </button>
            </div>
          ) : (
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <div className="px-2 md:px-3 py-1 rounded-md text-xs font-bold bg-white text-indigo-600 shadow-sm">
                <i className="bi bi-bezier2 mr-1"></i>
                <span className="hidden md:inline">軌跡</span>
              </div>
            </div>
          )}
          <button onClick={() => fetchData()} title="更新" className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1 relative">
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={16}
              options={{
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
              }}
              onLoad={(map) => { mapRef.current = map; }}
            >
              {/* Area polygon (both modes) */}
              {areaPaths.map((path, i) => (
                <Polygon
                  key={`area-${i}`}
                  paths={path}
                  options={{
                    fillColor: '#6366f1',
                    fillOpacity: 0.08,
                    strokeColor: '#6366f1',
                    strokeWeight: 2,
                    strokeOpacity: 0.6,
                  }}
                />
              ))}

              {/* ========== TRAJECTORY MODE ========== */}
              {viewMode === 'trajectory' && (
                <>
                  {/* GPS trajectory - already traversed */}
                  {visiblePoints.length > 1 && (
                    <Polyline
                      path={visiblePoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
                      options={{
                        strokeColor: '#ec4899',
                        strokeWeight: 3,
                        strokeOpacity: 0.85,
                      }}
                    />
                  )}

                  {/* GPS trajectory - remaining (dimmed) */}
                  {visibleCount < points.length && (
                    <Polyline
                      path={points.slice(visibleCount - 1).map((p) => ({ lat: p.lat, lng: p.lng }))}
                      options={{
                        strokeColor: '#f9a8d4',
                        strokeWeight: 2,
                        strokeOpacity: 0.35,
                      }}
                    />
                  )}

                  {/* Start marker */}
                  {points.length > 0 && (
                    <Marker
                      position={{ lat: points[0].lat, lng: points[0].lng }}
                      label={{ text: 'START', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                      icon={{
                        path: 'M -24 -12 L 24 -12 L 24 12 L -24 12 Z',
                        fillColor: '#22c55e',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                        scale: 1,
                        labelOrigin: new google.maps.Point(0, 0),
                      }}
                      onClick={() => setSelectedInfo({
                        position: { lat: points[0].lat, lng: points[0].lng },
                        content: `START: ${fmtTime(points[0].timestamp)}`,
                      })}
                    />
                  )}

                  {/* Finish marker */}
                  {data.session.finishedAt && points.length > 0 && (
                    <Marker
                      position={{ lat: points[points.length - 1].lat, lng: points[points.length - 1].lng }}
                      label={{ text: 'FINISH', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                      icon={{
                        path: 'M -24 -12 L 24 -12 L 24 12 L -24 12 Z',
                        fillColor: '#ef4444',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                        scale: 1,
                        labelOrigin: new google.maps.Point(0, 0),
                      }}
                      onClick={() => setSelectedInfo({
                        position: { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng },
                        content: `FINISH: ${fmtTime(points[points.length - 1].timestamp)}`,
                      })}
                    />
                  )}

                  {/* Current position marker */}
                  {currentPoint && (
                    <Marker
                      position={{ lat: currentPoint.lat, lng: currentPoint.lng }}
                      icon={data.session.finishedAt ? {
                        path: 'M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9zm-1.5 12.5l-3-3 1.41-1.41L10.5 9.67l4.59-4.58L16.5 6.5l-6 6z',
                        scale: 1.8,
                        fillColor: '#16a34a',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                        anchor: new google.maps.Point(12, 24),
                      } : {
                        path: 'M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 10c-2.21 0-4-1.12-4-2.5C8 10.12 9.79 9 12 9s4 1.12 4 2.5c0 1.38-1.79 2.5-4 2.5z',
                        scale: 1.8,
                        fillColor: '#3b82f6',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                        anchor: new google.maps.Point(12, 24),
                      }}
                      animation={data.session.finishedAt ? undefined : google.maps.Animation.BOUNCE}
                      title={currentTimestamp ? fmtTime(currentTimestamp.toISOString()) : ''}
                    />
                  )}

                  {/* Progress event markers */}
                  {visibleProgress.map((e) =>
                    e.lat != null && e.lng != null ? (
                      <Marker
                        key={`progress-${e.id}`}
                        position={{ lat: e.lat, lng: e.lng }}
                        label={{
                          text: String(e.mailboxCount),
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 'bold',
                        }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 14,
                          fillColor: '#22c55e',
                          fillOpacity: 0.9,
                          strokeColor: '#fff',
                          strokeWeight: 2,
                        }}
                        onClick={() => setSelectedInfo({
                          position: { lat: e.lat!, lng: e.lng! },
                          content: `${e.mailboxCount}枚完了 (${fmtTime(e.timestamp)})`,
                        })}
                      />
                    ) : null
                  )}

                  {/* Skip event markers */}
                  {visibleSkips.map((e) => (
                    <Marker
                      key={`skip-${e.id}`}
                      position={{ lat: e.lat, lng: e.lng }}
                      icon={{
                        path: 'M12 2L2 22h20L12 2z',
                        scale: 1.2,
                        fillColor: '#f97316',
                        fillOpacity: 0.9,
                        strokeColor: '#fff',
                        strokeWeight: 1,
                        anchor: new google.maps.Point(12, 22),
                      }}
                      onClick={() => setSelectedInfo({
                        position: { lat: e.lat, lng: e.lng },
                        content: `スキップ (${fmtTime(e.timestamp)})${e.reason ? `\n${e.reason}` : ''}${e.prohibitedProperty ? `\n${e.prohibitedProperty.buildingName || e.prohibitedProperty.address}` : ''}`,
                      })}
                    />
                  ))}

                  {/* Prohibited property markers */}
                  {data.prohibitedProperties.map((pp, idx) => {
                    if (!pp.latitude || !pp.longitude) return null;
                    const color = pp.pinColor && pp.pinColor !== '#000000'
                      ? (pp.pinColor.startsWith('#') ? pp.pinColor : `#${pp.pinColor}`)
                      : '#ef4444';
                    return (
                      <Marker
                        key={`pp-${pp.id ?? idx}-${pp.latitude}-${pp.longitude}`}
                        position={{ lat: pp.latitude, lng: pp.longitude }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 7,
                          fillColor: color,
                          fillOpacity: 0.7,
                          strokeColor: '#ffffff',
                          strokeWeight: 2,
                        }}
                        title={pp.buildingName || pp.address || '禁止物件'}
                      />
                    );
                  })}
                </>
              )}

              {/* ========== DWELL TIME MODE ========== */}
              {viewMode === 'dwell' && (
                <>
                  {/* Faint trajectory line for context */}
                  {points.length > 1 && (
                    <Polyline
                      path={points.map((p) => ({ lat: p.lat, lng: p.lng }))}
                      options={{
                        strokeColor: '#cbd5e1',
                        strokeWeight: 1.5,
                        strokeOpacity: 0.5,
                      }}
                    />
                  )}

                  {/* Dwell spot circles */}
                  {dwellSpots.map((spot) => {
                    const color = dwellColor(spot.dwellMs);
                    const isSelected = selectedDwellSpot?.id === spot.id;
                    return (
                      <Circle
                        key={`dwell-${spot.id}`}
                        center={{ lat: spot.centerLat, lng: spot.centerLng }}
                        radius={dwellRadius(spot.dwellMs)}
                        options={{
                          fillColor: color,
                          fillOpacity: isSelected ? 0.7 : 0.45,
                          strokeColor: isSelected ? '#1e293b' : color,
                          strokeWeight: isSelected ? 3 : 2,
                          strokeOpacity: 0.9,
                          clickable: true,
                          zIndex: isSelected ? 10 : Math.round(spot.dwellMs / 1000),
                        }}
                        onClick={() => {
                          setSelectedDwellSpot(spot);
                          setSelectedInfo({
                            position: { lat: spot.centerLat, lng: spot.centerLng },
                            content: `滞在時間: ${fmtDuration(spot.dwellMs)}\n${fmtTime(spot.startTime)} 〜 ${fmtTime(spot.endTime)}\nGPSポイント: ${spot.pointCount}件\n${dwellLabel(spot.dwellMs)}`,
                          });
                        }}
                      />
                    );
                  })}

                  {/* Start marker */}
                  {points.length > 0 && (
                    <Marker
                      position={{ lat: points[0].lat, lng: points[0].lng }}
                      label={{ text: 'START', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                      icon={{
                        path: 'M -24 -12 L 24 -12 L 24 12 L -24 12 Z',
                        fillColor: '#22c55e',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                        scale: 1,
                        labelOrigin: new google.maps.Point(0, 0),
                      }}
                    />
                  )}

                  {/* Finish marker */}
                  {data.session.finishedAt && points.length > 0 && (
                    <Marker
                      position={{ lat: points[points.length - 1].lat, lng: points[points.length - 1].lng }}
                      label={{ text: 'FINISH', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                      icon={{
                        path: 'M -24 -12 L 24 -12 L 24 12 L -24 12 Z',
                        fillColor: '#ef4444',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                        scale: 1,
                        labelOrigin: new google.maps.Point(0, 0),
                      }}
                    />
                  )}
                </>
              )}

              {/* Info window (both modes) */}
              {selectedInfo && (
                <InfoWindow
                  position={selectedInfo.position}
                  onCloseClick={() => { setSelectedInfo(null); setSelectedDwellSpot(null); }}
                >
                  <div className="text-xs whitespace-pre-line">{selectedInfo.content}</div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>

        {/* Side panel - mobile: toggle overlay, desktop: fixed sidebar */}
        <button
          onClick={() => setSidePanelOpen(!sidePanelOpen)}
          className="md:hidden absolute top-3 right-3 z-30 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-600 hover:bg-slate-50 active:bg-slate-100 border border-slate-200"
        >
          <i className={`bi ${sidePanelOpen ? 'bi-x-lg' : 'bi-bar-chart-line'} text-lg`}></i>
        </button>
        <div className={`
          ${sidePanelOpen ? 'translate-x-0' : 'translate-x-full'}
          md:translate-x-0
          absolute md:relative right-0 top-0 h-full z-20
          w-72 bg-white border-l border-slate-200 flex flex-col overflow-y-auto shrink-0
          transition-transform duration-200 ease-in-out shadow-xl md:shadow-none
        `}>
          {viewMode === 'trajectory' ? (
            <>
              {/* Posting System data source notice */}
              {dataSource === 'posting-system' && (
                <div className="p-4 border-b border-slate-100">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                    <i className="bi bi-info-circle mr-1"></i>
                    PMS GPS セッションなし。Posting System の GPS データを表示中。
                  </div>
                </div>
              )}

              {/* Stats — PMS session only */}
              {dataSource === 'pms' && (
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3">
                    <i className="bi bi-speedometer2 mr-1"></i>
                    パフォーマンス
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-blue-600 font-black text-lg">{(data.session.totalDistance / 1000).toFixed(1)}</div>
                      <div className="text-blue-400">km</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <div className="text-emerald-600 font-black text-lg">{data.session.totalSteps.toLocaleString()}</div>
                      <div className="text-emerald-400">歩</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <div className="text-orange-600 font-black text-lg">{Math.round(data.session.totalCalories)}</div>
                      <div className="text-orange-400">kcal</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="text-purple-600 font-black text-lg">{fmtDuration(duration)}</div>
                      <div className="text-purple-400">作業時間{totalPausedMs > 0 ? '*' : ''}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-hour metrics — PMS session only */}
              {dataSource === 'pms' && (
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3">
                    <i className="bi bi-graph-up mr-1"></i>
                    時間あたり
                  </h3>
                  {totalPausedMs > 0 && (
                    <div className="mb-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                      * PAUSE 時間（{fmtDuration(totalPausedMs)}）を除いた実効時間で計算
                    </div>
                  )}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">配布ペース</span>
                      <span className="font-bold text-slate-700">
                        {durationHours > 0 ? Math.round(totalMailboxes / durationHours).toLocaleString() : 0} ポスト/h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">歩数</span>
                      <span className="font-bold text-slate-700">
                        {durationHours > 0 ? Math.round(data.session.totalSteps / durationHours).toLocaleString() : 0} 歩/h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">移動距離</span>
                      <span className="font-bold text-slate-700">
                        {durationHours > 0 ? (data.session.totalDistance / 1000 / durationHours).toFixed(1) : 0} km/h
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Distribution items */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-700 text-sm mb-3">
                  <i className="bi bi-file-earmark-text mr-1"></i>
                  配布チラシ
                </h3>
                <div className="space-y-1.5 text-xs">
                  {data.schedule.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-slate-50 rounded-lg px-2 py-1.5">
                      <span className="text-slate-600 truncate max-w-[140px]" title={item.flyerName}>{item.flyerName}</span>
                      <span className="font-bold shrink-0 ml-1">
                        <span className="text-indigo-600">{item.actualCount ?? '-'}</span>
                        <span className="text-slate-400">/{item.plannedCount}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {data.session.incompleteReason && (
                  <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-amber-700">
                    未完了: {data.session.incompleteReason === 'AREA_DONE' ? 'エリア終了' : data.session.incompleteReason === 'GIVE_UP' ? 'ギブアップ' : 'その他'}
                    {data.session.incompleteNote && <span className="block text-amber-500 mt-0.5">{data.session.incompleteNote}</span>}
                  </div>
                )}
              </div>

              {/* Progress timeline — PMS session only */}
              {dataSource === 'pms' && (
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3">
                    <i className="bi bi-clock-history mr-1"></i>
                    配布進捗
                  </h3>
                  <div className="space-y-1 text-xs">
                    {[
                      { time: data.session.startedAt, type: 'START' as const },
                      ...data.progressEvents.map((e) => ({ time: e.timestamp, type: 'PROGRESS' as const, mailboxCount: e.mailboxCount })),
                      ...data.skipEvents.map((e) => ({ time: e.timestamp, type: 'SKIP' as const })),
                      ...(data.pauseEvents || []).flatMap((e) => [
                        { time: e.pausedAt, type: 'PAUSE' as const },
                        ...(e.resumedAt ? [{ time: e.resumedAt, type: 'RESUME' as const }] : []),
                      ]),
                      ...(data.session.finishedAt ? [{ time: data.session.finishedAt, type: 'FINISH' as const }] : []),
                    ]
                      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                      .map((item, idx) => {
                        if (item.type === 'START') return (
                          <div key={`start-${idx}`} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0"></span>
                            <span className="text-slate-500">{fmtTime(item.time)}</span>
                            <span className="font-bold text-emerald-600">START</span>
                          </div>
                        );
                        if (item.type === 'PROGRESS') return (
                          <div key={`p-${idx}`} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-400 rounded-full shrink-0"></span>
                            <span className="text-slate-500">{fmtTime(item.time)}</span>
                            <span className="font-bold text-blue-600">{'mailboxCount' in item ? item.mailboxCount : 0}枚</span>
                          </div>
                        );
                        if (item.type === 'SKIP') return (
                          <div key={`s-${idx}`} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-400 rounded-full shrink-0"></span>
                            <span className="text-slate-500">{fmtTime(item.time)}</span>
                            <span className="font-bold text-orange-600">SKIP</span>
                          </div>
                        );
                        if (item.type === 'PAUSE') return (
                          <div key={`pause-${idx}`} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full shrink-0"></span>
                            <span className="text-slate-500">{fmtTime(item.time)}</span>
                            <span className="font-bold text-yellow-600">PAUSE</span>
                          </div>
                        );
                        if (item.type === 'RESUME') return (
                          <div key={`resume-${idx}`} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-teal-400 rounded-full shrink-0"></span>
                            <span className="text-slate-500">{fmtTime(item.time)}</span>
                            <span className="font-bold text-teal-600">RESUME</span>
                          </div>
                        );
                        return (
                          <div key={`finish-${idx}`} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full shrink-0"></span>
                            <span className="text-slate-500">{fmtTime(item.time)}</span>
                            <span className="font-bold text-red-600">FINISH</span>
                          </div>
                        );
                      })}
                    {(data.pauseEvents || []).some((e) => !e.resumedAt) && !data.session.finishedAt && (
                      <div className="mt-1 text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-yellow-700 font-bold">
                        現在一時停止中
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GPS points summary — Posting System only */}
              {dataSource === 'posting-system' && (
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3">
                    <i className="bi bi-geo-alt mr-1"></i>
                    GPS データ
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">GPS ポイント数</span>
                      <span className="font-bold text-slate-700">{data.gpsPoints.length}</span>
                    </div>
                    {data.gpsPoints.length > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">開始</span>
                          <span className="font-bold text-slate-700">{fmtTime(data.gpsPoints[0].timestamp)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">終了</span>
                          <span className="font-bold text-slate-700">{fmtTime(data.gpsPoints[data.gpsPoints.length - 1].timestamp)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ========== DWELL TIME SIDE PANEL ========== */}

              {/* Dwell summary stats */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-700 text-sm mb-3">
                  <i className="bi bi-clock-fill mr-1 text-orange-500"></i>
                  滞在分析サマリー
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <div className="text-orange-600 font-black text-lg">{dwellStats.count}</div>
                    <div className="text-orange-400">滞在スポット</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2 text-center">
                    <div className="text-amber-600 font-black text-lg">{fmtDuration(dwellStats.totalMs)}</div>
                    <div className="text-amber-400">総滞在時間</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-blue-600 font-black text-lg">{dwellStats.count > 0 ? fmtDuration(dwellStats.avgMs) : '-'}</div>
                    <div className="text-blue-400">平均滞在</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2 text-center">
                    <div className="text-red-600 font-black text-lg">{dwellStats.maxMs > 0 ? fmtDuration(dwellStats.maxMs) : '-'}</div>
                    <div className="text-red-400">最長滞在</div>
                  </div>
                </div>
              </div>

              {/* Color legend */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-700 text-sm mb-2">
                  <i className="bi bi-palette mr-1"></i>
                  凡例
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 shrink-0"></span>
                    <span className="text-slate-600">30秒〜2分（個別住宅）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500 shrink-0"></span>
                    <span className="text-slate-600">2分〜5分（小〜中規模アパート）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0"></span>
                    <span className="text-slate-600">5分〜10分（大規模マンション）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
                    <span className="text-slate-600">10分以上（要確認）</span>
                  </div>
                </div>
              </div>

              {/* Dwell spot ranking */}
              <div className="p-4 border-b border-slate-100 flex-1">
                <h3 className="font-bold text-slate-700 text-sm mb-3">
                  <i className="bi bi-sort-down mr-1"></i>
                  滞在スポット（長い順）
                </h3>
                {dwellSorted.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">滞在スポットなし</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {dwellSorted.map((spot, idx) => {
                      const color = dwellColor(spot.dwellMs);
                      const isSelected = selectedDwellSpot?.id === spot.id;
                      return (
                        <button
                          key={spot.id}
                          onClick={() => {
                            setSelectedDwellSpot(spot);
                            setSelectedInfo({
                              position: { lat: spot.centerLat, lng: spot.centerLng },
                              content: `滞在時間: ${fmtDuration(spot.dwellMs)}\n${fmtTime(spot.startTime)} 〜 ${fmtTime(spot.endTime)}\nGPSポイント: ${spot.pointCount}件\n${dwellLabel(spot.dwellMs)}`,
                            });
                            if (mapRef.current) {
                              mapRef.current.panTo({ lat: spot.centerLat, lng: spot.centerLng });
                              mapRef.current.setZoom(18);
                            }
                          }}
                          className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                            isSelected
                              ? 'bg-slate-200 ring-1 ring-slate-400'
                              : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-slate-400 font-bold w-5 text-right shrink-0">#{idx + 1}</span>
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          ></span>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-700">{fmtDuration(spot.dwellMs)}</div>
                            <div className="text-slate-400">{fmtTime(spot.startTime)} 〜 {fmtTime(spot.endTime)}</div>
                          </div>
                          {spot.dwellMs >= 10 * 60 * 1000 && (
                            <span className="text-red-500 shrink-0" title="10分以上の長時間滞在">
                              <i className="bi bi-exclamation-triangle-fill"></i>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Time slider / Playback controls — trajectory mode only */}
      {viewMode === 'trajectory' && (
        <div className="bg-white border-t border-slate-200 px-2 md:px-4 py-2 md:py-3 flex items-center gap-2 md:gap-4 shrink-0">
          {/* Play/Pause */}
          <button
            onClick={() => {
              if (sliderValue >= 1000) setSliderValue(0);
              setIsPlaying(!isPlaying);
            }}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors shrink-0"
          >
            <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'} md:text-lg`}></i>
          </button>

          {/* Time display */}
          <div className="text-[10px] md:text-xs text-slate-500 w-12 md:w-16 shrink-0 text-center font-mono">
            {currentTimestamp ? fmtTime(currentTimestamp.toISOString()) : '--:--:--'}
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(sliderValue)}
            onChange={(e) => {
              setSliderValue(parseInt(e.target.value));
              setIsPlaying(false);
            }}
            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />

          {/* Speed selector */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {[1, 2, 5, 10].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Point count */}
          <span className="hidden md:inline text-xs text-slate-400 shrink-0">
            {visibleCount}/{points.length} pts
          </span>
        </div>
      )}

      {/* Dwell mode footer — spot count summary */}
      {viewMode === 'dwell' && (
        <div className="bg-white border-t border-slate-200 px-4 py-2 md:py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span><i className="bi bi-geo-alt mr-1"></i>{dwellStats.count} スポット検出</span>
            <span><i className="bi bi-clock mr-1"></i>総滞在 {fmtDuration(dwellStats.totalMs)}</span>
            {dwellSorted.filter(s => s.dwellMs >= 10 * 60 * 1000).length > 0 && (
              <span className="text-red-500 font-bold">
                <i className="bi bi-exclamation-triangle-fill mr-1"></i>
                {dwellSorted.filter(s => s.dwellMs >= 10 * 60 * 1000).length}件の長時間滞在
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">{points.length} GPS pts</span>
        </div>
      )}
    </div>
  );
}
