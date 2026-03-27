'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Map, { Source, Layer, Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

// ============================================================
// Types (same as TrajectoryViewer)
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
  roomNumber?: string | null;
  residentName?: string | null;
  reasonDetail?: string | null;
  reasonName?: string | null;
  severity?: number | null;
  pinColor?: string | null;
  boundaryGeojson?: string | null;
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
    checkGps?: boolean;
    checkGpsResult?: string | null;
    checkGpsComment?: string | null;
  };
}

interface Props {
  scheduleId: number;
  onClose: () => void;
  onSwitchToGoogle?: () => void;
}

// ============================================================
// GeoJSON parser — converts boundaryGeojson to a valid GeoJSON object for Mapbox
// ============================================================
const parseAreaGeoJson = (geojsonStr: string): GeoJSON.FeatureCollection | null => {
  if (!geojsonStr) return null;
  const trimmed = geojsonStr.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  try {
    const parsed = JSON.parse(trimmed);
    // If it's already a FeatureCollection or Feature, wrap as needed
    if (parsed.type === 'FeatureCollection') return parsed;
    if (parsed.type === 'Feature') {
      return { type: 'FeatureCollection', features: [parsed] };
    }
    if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
      return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: parsed }],
      };
    }
    return null;
  } catch {
    return null;
  }
};

// Compute center from GeoJSON polygon
const computeGeoJsonCenter = (fc: GeoJSON.FeatureCollection): { lat: number; lng: number } | null => {
  const coords: number[][] = [];
  for (const feature of fc.features) {
    const geom = feature.geometry as any;
    if (geom.type === 'Polygon') {
      coords.push(...geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        coords.push(...poly[0]);
      }
    }
  }
  if (coords.length === 0) return null;
  const sumLng = coords.reduce((s, c) => s + c[0], 0);
  const sumLat = coords.reduce((s, c) => s + c[1], 0);
  return { lng: sumLng / coords.length, lat: sumLat / coords.length };
};

// ============================================================
// Helpers
// ============================================================
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
// Dwell spot analysis (same as TrajectoryViewer)
// ============================================================
interface DwellSpot {
  id: number;
  centerLat: number;
  centerLng: number;
  dwellMs: number;
  pointCount: number;
  startTime: string;
  endTime: string;
}

type ViewMode = 'trajectory' | 'dwell' | 'heatmap';

const DWELL_RADIUS_M = 30;
const DWELL_MIN_MS = 30 * 1000;

const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** 隣接2点間のスピード */
interface SegmentSpeed {
  speedKmh: number;
  distanceM: number;
  durationSec: number;
}

const SPEED_THRESHOLDS = {
  posting: 1.5,     // 0〜1.5 km/h: ほぼ停止・ポスティング中
  slowWalk: 3.5,    // 1.5〜3.5 km/h: 配布しながら歩行
  normalWalk: 5.0,  // 3.5〜5.0 km/h: 通常歩行
};

const SPEED_COLORS = {
  posting: '#ef4444',    // 赤
  slowWalk: '#f97316',   // オレンジ
  normalWalk: '#22c55e', // 緑
  fast: '#3b82f6',       // 青
};

const computeSegmentSpeeds = (points: GpsPoint[]): SegmentSpeed[] => {
  if (points.length < 2) return [];
  const rawSpeeds: SegmentSpeed[] = [];
  for (let i = 1; i < points.length; i++) {
    const distM = haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    const dtMs = new Date(points[i].timestamp).getTime() - new Date(points[i - 1].timestamp).getTime();
    const dtSec = Math.max(dtMs / 1000, 0.1);
    const speedKmh = (distM / dtSec) * 3.6;
    rawSpeeds.push({ speedKmh: Math.min(speedKmh, 30), distanceM: distM, durationSec: dtSec });
  }
  // 3-point moving average
  return rawSpeeds.map((seg, i) => {
    const start = Math.max(0, i - 1);
    const end = Math.min(rawSpeeds.length - 1, i + 1);
    let sumSpeed = 0, count = 0;
    for (let j = start; j <= end; j++) { sumSpeed += rawSpeeds[j].speedKmh; count++; }
    return { ...seg, speedKmh: sumSpeed / count };
  });
};

const speedToColor = (kmh: number): string => {
  if (kmh <= SPEED_THRESHOLDS.posting) return SPEED_COLORS.posting;
  if (kmh <= SPEED_THRESHOLDS.slowWalk) return SPEED_COLORS.slowWalk;
  if (kmh <= SPEED_THRESHOLDS.normalWalk) return SPEED_COLORS.normalWalk;
  return SPEED_COLORS.fast;
};

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
      const n = i - clusterStart + 1;
      centroidLat = centroidLat + (points[i].lat - centroidLat) / n;
      centroidLng = centroidLng + (points[i].lng - centroidLng) / n;
    } else {
      const dwellMs = new Date(points[i - 1].timestamp).getTime() - new Date(points[clusterStart].timestamp).getTime();
      if (dwellMs >= DWELL_MIN_MS) {
        spots.push({ id: spotId++, centerLat: centroidLat, centerLng: centroidLng, dwellMs, pointCount: i - clusterStart, startTime: points[clusterStart].timestamp, endTime: points[i - 1].timestamp });
      }
      clusterStart = i;
      centroidLat = points[i].lat;
      centroidLng = points[i].lng;
    }
  }
  const lastDwell = new Date(points[points.length - 1].timestamp).getTime() - new Date(points[clusterStart].timestamp).getTime();
  if (lastDwell >= DWELL_MIN_MS) {
    spots.push({ id: spotId++, centerLat: centroidLat, centerLng: centroidLng, dwellMs: lastDwell, pointCount: points.length - clusterStart, startTime: points[clusterStart].timestamp, endTime: points[points.length - 1].timestamp });
  }
  return spots;
};

const dwellColor = (ms: number) => {
  if (ms < 2 * 60 * 1000) return '#22c55e';
  if (ms < 5 * 60 * 1000) return '#eab308';
  if (ms < 10 * 60 * 1000) return '#f97316';
  return '#ef4444';
};

const dwellLabel = (ms: number) => {
  if (ms < 2 * 60 * 1000) return '短い停止';
  if (ms < 5 * 60 * 1000) return '中程度';
  if (ms < 10 * 60 * 1000) return '長め';
  return '非常に長い';
};

// ============================================================
// Speed Distribution Chart
// ============================================================
function SpeedDistributionChart({ speeds }: { speeds: SegmentSpeed[] }) {
  const buckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0, 0, 0];
    const labels = ['0-1', '1-2', '2-3', '3-4', '4-5', '5-6', '6+'];
    const colors = [SPEED_COLORS.posting, SPEED_COLORS.posting, SPEED_COLORS.slowWalk, SPEED_COLORS.slowWalk, SPEED_COLORS.normalWalk, SPEED_COLORS.fast, SPEED_COLORS.fast];
    for (const seg of speeds) {
      const idx = Math.min(Math.floor(seg.speedKmh), 6);
      b[idx] += seg.durationSec;
    }
    const maxVal = Math.max(...b, 1);
    return labels.map((label, i) => ({ label, value: b[i], pct: (b[i] / maxVal) * 100, color: colors[i] }));
  }, [speeds]);

  return (
    <div className="space-y-1">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex items-center gap-2 text-[10px]">
          <span className="w-8 text-right text-slate-500 shrink-0">{bucket.label}</span>
          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${bucket.pct}%`, background: bucket.color }} />
          </div>
          <span className="w-10 text-right text-slate-400 shrink-0">
            {bucket.value > 0 ? fmtDuration(bucket.value * 1000) : '-'}
          </span>
        </div>
      ))}
      <div className="text-[9px] text-slate-400 text-center mt-1">km/h → 滞在時間</div>
    </div>
  );
}

// ============================================================
// Component
// ============================================================
export default function MapboxTrajectoryViewer({ scheduleId, onClose, onSwitchToGoogle }: Props) {
  const mapRef = useRef<MapRef>(null);

  const [data, setData] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'pms' | 'posting-system'>('pms');
  const [gpsComment, setGpsComment] = useState('');
  const [gpsSaving, setGpsSaving] = useState(false);
  const [showGpsCommentInput, setShowGpsCommentInput] = useState(false);
  const [ppPopup, setPpPopup] = useState<{ lng: number; lat: number; props: any } | null>(null);

  // View mode: trajectory (default), dwell, heatmap
  const [viewMode, setViewMode] = useState<ViewMode>('trajectory');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showProhibited, setShowProhibited] = useState(true);
  const [show3D, setShow3D] = useState(false);
  const [selectedDwellSpot, setSelectedDwellSpot] = useState<DwellSpot | null>(null);

  // Coverage analysis
  const [showCoverage, setShowCoverage] = useState(false);
  const [coverageRate, setCoverageRate] = useState<number | null>(null);

  // Speed visualization
  const [showSpeed, setShowSpeed] = useState(false);

  // 過去エリア軌跡比較
  interface PastTrajectory {
    scheduleId: number;
    date: string;
    distributorName: string;
    distributorStaffId: string;
    totalDistance: number;
    startedAt: string | null;
    finishedAt: string | null;
    gpsPoints: { lat: number; lng: number; timestamp: string }[];
  }
  const [showPastComparison, setShowPastComparison] = useState(false);
  const [pastTrajectories, setPastTrajectories] = useState<PastTrajectory[] | null>(null);
  const [pastSelectedIdx, setPastSelectedIdx] = useState(0);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState('');

  // Route suggestion
  const [suggestedRoute, setSuggestedRoute] = useState<any>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Playback state
  const [sliderValue, setSliderValue] = useState(1000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Popup
  const [popup, setPopup] = useState<{ lng: number; lat: number; content: string } | null>(null);

  // Live polling
  const [isLive, setIsLive] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // Dwell spot analysis
  const dwellSpots = useMemo(() => data ? clusterDwellSpots(data.gpsPoints) : [], [data]);
  const dwellSorted = useMemo(() => [...dwellSpots].sort((a, b) => b.dwellMs - a.dwellMs), [dwellSpots]);
  const dwellStats = useMemo(() => {
    if (dwellSpots.length === 0) return { count: 0, avgMs: 0, maxMs: 0, totalMs: 0 };
    const totalMs = dwellSpots.reduce((s, d) => s + d.dwellMs, 0);
    return { count: dwellSpots.length, avgMs: totalMs / dwellSpots.length, maxMs: Math.max(...dwellSpots.map(d => d.dwellMs)), totalMs };
  }, [dwellSpots]);

  // Speed analysis
  const segmentSpeeds = useMemo(() => data ? computeSegmentSpeeds(data.gpsPoints) : [], [data]);

  const speedStats = useMemo(() => {
    if (segmentSpeeds.length === 0) return { avg: 0, max: 0, postingPct: 0, movingPct: 0, postingTime: 0, movingTime: 0 };
    const totalSec = segmentSpeeds.reduce((s, seg) => s + seg.durationSec, 0);
    const avgSpeed = totalSec > 0 ? segmentSpeeds.reduce((s, seg) => s + seg.speedKmh * seg.durationSec, 0) / totalSec : 0;
    const maxSpeed = Math.max(...segmentSpeeds.map(s => s.speedKmh));
    const postingSec = segmentSpeeds.filter(s => s.speedKmh <= SPEED_THRESHOLDS.slowWalk).reduce((sum, s) => sum + s.durationSec, 0);
    const movingSec = totalSec - postingSec;
    return {
      avg: avgSpeed, max: maxSpeed,
      postingPct: totalSec > 0 ? (postingSec / totalSec) * 100 : 0,
      movingPct: totalSec > 0 ? (movingSec / totalSec) * 100 : 0,
      postingTime: postingSec * 1000, movingTime: movingSec * 1000,
    };
  }, [segmentSpeeds]);

  // Speed gradient GeoJSON (full trajectory with lineMetrics)
  const speedTrajectoryGeoJson = useMemo(() => {
    if (!data || data.gpsPoints.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: data.gpsPoints.map(p => [p.lng, p.lat]) },
    };
  }, [data]);

  // line-gradient stops
  const speedGradientStops = useMemo(() => {
    if (!data || data.gpsPoints.length < 2 || segmentSpeeds.length === 0) return null;
    const cumulativeDistances: number[] = [0];
    let totalDist = 0;
    for (let i = 0; i < segmentSpeeds.length; i++) {
      totalDist += segmentSpeeds[i].distanceM;
      cumulativeDistances.push(totalDist);
    }
    if (totalDist === 0) return null;
    const stops: [number, string][] = [];
    for (let i = 0; i < cumulativeDistances.length; i++) {
      const progress = cumulativeDistances[i] / totalDist;
      const speed = i === 0 ? (segmentSpeeds[0]?.speedKmh ?? 0) : segmentSpeeds[i - 1].speedKmh;
      stops.push([Math.min(progress, 1), speedToColor(speed)]);
    }
    return stops;
  }, [data, segmentSpeeds]);

  // Fetch trajectory data
  const fetchData = useCallback(async () => {
    try {
      let pmsJson: any = null;
      const res = await fetch(`/api/schedules/${scheduleId}/trajectory`);
      if (res.ok) {
        pmsJson = await res.json();
        // GPSポイントがある場合はPMSデータを使用
        if (pmsJson.gpsPoints && pmsJson.gpsPoints.length > 0) {
          setData(pmsJson);
          setDataSource('pms');
          setIsLive(pmsJson.session.finishedAt === null);
          return;
        }
        // GPSポイント0件 → PS Fallbackを試行
      }
      // PMS session not available or has no GPS points — try Posting System fallback
      const psRes = await fetch(`/api/schedules/${scheduleId}/trajectory/posting-system`);
      if (psRes.ok) {
        const psJson = await psRes.json();
        const isCompleted = psJson.schedule?.status === 'COMPLETED';
        const hasPmsSession = pmsJson?.session;
        const wrapped: TrajectoryData = {
          session: hasPmsSession ? {
            ...pmsJson.session,
          } : {
            id: 0,
            startedAt: psJson.gpsPoints.length > 0 ? psJson.gpsPoints[0].timestamp : new Date().toISOString(),
            finishedAt: isCompleted && psJson.gpsPoints.length > 0 ? psJson.gpsPoints[psJson.gpsPoints.length - 1].timestamp : null,
            totalSteps: 0, totalDistance: 0, totalCalories: 0, incompleteReason: null, incompleteNote: null,
          },
          gpsPoints: psJson.gpsPoints,
          progressEvents: hasPmsSession ? pmsJson.progressEvents : [],
          skipEvents: hasPmsSession ? pmsJson.skipEvents : [],
          pauseEvents: hasPmsSession ? (pmsJson.pauseEvents || []) : [],
          area: psJson.area,
          prohibitedProperties: psJson.prohibitedProperties || [],
          schedule: psJson.schedule,
        };
        setData(wrapped);
        setDataSource('posting-system');
        setIsLive(!isCompleted);
        return;
      }
      // PS fallback も失敗した場合、PMSデータがあればそれを使う（GPSなしでもセッション情報は表示）
      if (pmsJson) {
        setData(pmsJson);
        setDataSource('pms');
        setIsLive(pmsJson.session.finishedAt === null);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // 過去エリア軌跡データ取得
  useEffect(() => {
    if (!showPastComparison || pastTrajectories !== null) return;
    const fetchPast = async () => {
      setPastLoading(true);
      setPastError('');
      try {
        const res = await fetch(`/api/schedules/${scheduleId}/trajectory/past-area?limit=5`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setPastError(err.error || '過去データ取得失敗');
          return;
        }
        const json = await res.json();
        setPastTrajectories(json.pastTrajectories || []);
        setPastSelectedIdx(0);
      } catch {
        setPastError('過去データ取得失敗');
      } finally {
        setPastLoading(false);
      }
    };
    fetchPast();
  }, [showPastComparison, pastTrajectories, scheduleId]);

  // 選択中の過去軌跡
  const selectedPast = pastTrajectories && pastTrajectories.length > 0 ? pastTrajectories[pastSelectedIdx] : null;

  // 過去軌跡 GeoJSON
  const pastTrajectoryGeoJson = useMemo(() => {
    if (!selectedPast || selectedPast.gpsPoints.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: selectedPast.gpsPoints.map(p => [p.lng, p.lat]),
      },
    };
  }, [selectedPast]);

  // GPS comment初期化
  useEffect(() => {
    if (data?.schedule?.checkGpsComment) setGpsComment(data.schedule.checkGpsComment);
    if (data?.schedule?.checkGpsResult === 'NG') setShowGpsCommentInput(true);
  }, [data?.schedule?.checkGpsComment, data?.schedule?.checkGpsResult]);

  const setGpsResult = useCallback(async (result: 'OK' | 'NG' | null) => {
    setGpsSaving(true);
    try {
      const payload: any = { checkGps: result !== null, checkGpsResult: result };
      if (result !== 'NG') { payload.checkGpsComment = null; setShowGpsCommentInput(false); setGpsComment(''); }
      else { setShowGpsCommentInput(true); }
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && data) {
        setData({ ...data, schedule: { ...data.schedule, checkGps: result !== null, checkGpsResult: result, checkGpsComment: result !== 'NG' ? null : data.schedule.checkGpsComment } });
      }
    } catch { /* silent */ }
    setGpsSaving(false);
  }, [scheduleId, data]);

  const saveGpsComment = useCallback(async () => {
    setGpsSaving(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkGpsComment: gpsComment }),
      });
      if (res.ok && data) {
        setData({ ...data, schedule: { ...data.schedule, checkGpsComment: gpsComment } });
      }
    } catch { /* silent */ }
    setGpsSaving(false);
  }, [scheduleId, data, gpsComment]);

  // Live polling
  useEffect(() => {
    if (!isLive) return;
    const interval = dataSource === 'posting-system' ? 20000 : 15000;
    pollingRef.current = setInterval(() => fetchData(), interval);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isLive, fetchData, dataSource]);

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
        const increment = (delta / 50) * playbackSpeed;
        const next = prev + increment;
        if (next >= 1000) { setIsPlaying(false); return 1000; }
        return next;
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };
    lastTimeRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying, playbackSpeed]);

  // 3D buildings toggle — pitch + fill-extrusion layer
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;

    if (show3D) {
      map.easeTo({ pitch: 45, duration: 500 });
      if (!map.getLayer('3d-buildings')) {
        map.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#e2e8f0',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.7,
          },
        });
      }
    } else {
      map.easeTo({ pitch: 0, duration: 500 });
      if (map.getLayer('3d-buildings')) {
        map.removeLayer('3d-buildings');
      }
    }
  }, [show3D]);

  // ============================================================
  // GeoJSON data for Mapbox layers (memoized)
  // ============================================================

  // Area polygon GeoJSON
  const areaGeoJson = useMemo(() => {
    if (!data?.area?.boundaryGeojson) return null;
    return parseAreaGeoJson(data.area.boundaryGeojson);
  }, [data]);

  const areaCenter = useMemo(() => {
    if (!areaGeoJson) return null;
    return computeGeoJsonCenter(areaGeoJson);
  }, [areaGeoJson]);

  // GPS trajectory line GeoJSON (visible portion based on slider)
  const trajectoryGeoJson = useMemo(() => {
    if (!data || data.gpsPoints.length < 2) return null;
    const sliderRatio = sliderValue / 1000;
    const visibleCount = Math.max(1, Math.round(data.gpsPoints.length * sliderRatio));
    const visible = data.gpsPoints.slice(0, visibleCount);
    if (visible.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: visible.map(p => [p.lng, p.lat]),
      },
    };
  }, [data, sliderValue]);

  // Remaining trajectory (dimmed)
  const remainingGeoJson = useMemo(() => {
    if (!data || data.gpsPoints.length < 2) return null;
    const sliderRatio = sliderValue / 1000;
    const visibleCount = Math.max(1, Math.round(data.gpsPoints.length * sliderRatio));
    if (visibleCount >= data.gpsPoints.length) return null;
    const remaining = data.gpsPoints.slice(visibleCount - 1);
    if (remaining.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: remaining.map(p => [p.lng, p.lat]),
      },
    };
  }, [data, sliderValue]);

  // Full trajectory for dwell mode (faint)
  const fullTrajectoryGeoJson = useMemo(() => {
    if (!data || data.gpsPoints.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: data.gpsPoints.map(p => [p.lng, p.lat]),
      },
    };
  }, [data]);

  // Heatmap data — weight by time spent at each point
  const heatmapGeoJson = useMemo(() => {
    if (!data || data.gpsPoints.length < 2) return null;
    const features = data.gpsPoints.map((p, i) => {
      let weight = 1;
      if (i < data.gpsPoints.length - 1) {
        const dt = new Date(data.gpsPoints[i + 1].timestamp).getTime() - new Date(p.timestamp).getTime();
        // Normalize: 10s = weight 1, longer = higher weight (capped at 10)
        weight = Math.min(10, Math.max(1, dt / 10000));
      }
      return {
        type: 'Feature' as const,
        properties: { weight },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      };
    });
    return { type: 'FeatureCollection' as const, features };
  }, [data]);

  // Prohibited properties GeoJSON
  const prohibitedGeoJson = useMemo(() => {
    if (!data) return null;
    const features = data.prohibitedProperties
      .filter(pp => pp.latitude && pp.longitude)
      .map((pp, idx) => ({
        type: 'Feature' as const,
        properties: {
          id: pp.id ?? idx,
          name: pp.buildingName || pp.address || '禁止物件',
          address: pp.address || '',
          buildingName: pp.buildingName || '',
          roomNumber: pp.roomNumber || '',
          residentName: pp.residentName || '',
          reasonDetail: pp.reasonDetail || '',
          reasonName: pp.reasonName || '',
          severity: pp.severity ?? 0,
          color: pp.pinColor && pp.pinColor !== '#000000'
            ? (pp.pinColor.startsWith('#') ? pp.pinColor : `#${pp.pinColor}`)
            : '#ef4444',
        },
        geometry: { type: 'Point' as const, coordinates: [pp.longitude!, pp.latitude!] },
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [data]);

  // Prohibited properties polygon GeoJSON
  const prohibitedPolygonGeoJson = useMemo(() => {
    if (!data) return null;
    const features: any[] = [];
    data.prohibitedProperties.forEach((pp, idx) => {
      if (!pp.boundaryGeojson) return;
      try {
        const parsed = JSON.parse(pp.boundaryGeojson.trim());
        const color = pp.pinColor && pp.pinColor !== '#000000'
          ? (pp.pinColor.startsWith('#') ? pp.pinColor : `#${pp.pinColor}`)
          : '#ef4444';
        const addFeature = (geom: any) => {
          if (!geom) return;
          if (geom.type === 'FeatureCollection') { geom.features?.forEach((f: any) => addFeature(f.geometry || f)); return; }
          if (geom.type === 'Feature') { addFeature(geom.geometry); return; }
          if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
            features.push({ type: 'Feature', properties: { id: pp.id ?? idx, color }, geometry: geom });
          }
        };
        addFeature(parsed);
      } catch { /* ignore */ }
    });
    if (features.length === 0) return null;
    return { type: 'FeatureCollection' as const, features };
  }, [data]);

  // Prohibited properties 3D GeoJSON — small square polygons for fill-extrusion columns
  const prohibited3DData = useMemo(() => {
    if (!data) return null;
    const SIZE = 0.000025; // ~2.5m in degrees ≈ 5m x 5m square
    const features = data.prohibitedProperties
      .filter(pp => pp.latitude && pp.longitude)
      .map((pp, idx) => {
        const lng = pp.longitude!;
        const lat = pp.latitude!;
        return {
          type: 'Feature' as const,
          properties: { id: pp.id ?? idx },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[
              [lng - SIZE, lat - SIZE],
              [lng + SIZE, lat - SIZE],
              [lng + SIZE, lat + SIZE],
              [lng - SIZE, lat + SIZE],
              [lng - SIZE, lat - SIZE],
            ]],
          },
        };
      });
    return { type: 'FeatureCollection' as const, features };
  }, [data]);

  // Dwell spots GeoJSON (circles)
  const dwellGeoJson = useMemo(() => {
    if (dwellSpots.length === 0) return null;
    const features = dwellSpots.map(spot => ({
      type: 'Feature' as const,
      properties: {
        id: spot.id,
        dwellMs: spot.dwellMs,
        color: dwellColor(spot.dwellMs),
        radius: Math.min(50, Math.max(15, 15 + (Math.min(1, (spot.dwellMs - DWELL_MIN_MS) / (15 * 60 * 1000 - DWELL_MIN_MS))) * 35)),
        label: dwellLabel(spot.dwellMs),
        startTime: spot.startTime,
        endTime: spot.endTime,
        pointCount: spot.pointCount,
      },
      geometry: { type: 'Point' as const, coordinates: [spot.centerLng, spot.centerLat] },
    }));
    return { type: 'FeatureCollection' as const, features };
  }, [dwellSpots]);

  // Point-in-polygon判定（ray casting algorithm）
  const pointInPolygon = useCallback((lng: number, lat: number, polygon: number[][]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }, []);

  // エリアポリゴン内かどうか判定
  const isInsideArea = useCallback((lng: number, lat: number) => {
    if (!areaGeoJson) return true; // ポリゴンがなければ全域対象
    for (const feature of areaGeoJson.features) {
      const geom = feature.geometry as any;
      if (geom.type === 'Polygon') {
        if (pointInPolygon(lng, lat, geom.coordinates[0])) return true;
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          if (pointInPolygon(lng, lat, poly[0])) return true;
        }
      }
    }
    return false;
  }, [areaGeoJson, pointInPolygon]);

  // Road-based coverage analysis（配布エリアポリゴン内の道路のみ対象）
  const [coverageGeoJson, setCoverageGeoJson] = useState<any>(null);

  useEffect(() => {
    if (!showCoverage || !data || data.gpsPoints.length === 0) {
      setCoverageGeoJson(null);
      if (!showCoverage) setCoverageRate(null);
      return;
    }

    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;

    const gpsPoints = data.gpsPoints;
    const PROXIMITY = 0.00015; // ~15m

    // Mapboxの道路レイヤーからレンダリング済みの道路フィーチャーを取得
    const roadLayers = map.getStyle()?.layers
      ?.filter((l: any) => l.type === 'line' && l['source-layer'] === 'road')
      .map((l: any) => l.id) || [];

    let roadFeatures: any[] = [];
    if (roadLayers.length > 0) {
      try {
        roadFeatures = map.queryRenderedFeatures(undefined, { layers: roadLayers });
      } catch { /* ignore */ }
    }

    if (roadFeatures.length === 0) {
      const allLayers = map.getStyle()?.layers?.map((l: any) => l.id) || [];
      const roadish = allLayers.filter((id: string) => /road|street|path|pedestrian|track/i.test(id));
      if (roadish.length > 0) {
        try { roadFeatures = map.queryRenderedFeatures(undefined, { layers: roadish }); } catch { /* ignore */ }
      }
    }

    if (roadFeatures.length > 0) {
      // 配布対象の道路クラスのみ（駅構内・高速道路・線路を除外）
      const DISTRIBUTABLE_CLASSES = new Set([
        'street', 'street_limited', 'pedestrian',
        'primary', 'primary_link', 'secondary', 'secondary_link',
        'tertiary', 'tertiary_link', 'trunk', 'trunk_link',
      ]);
      const filteredRoadFeatures = roadFeatures.filter((f: any) => {
        const cls = f.properties?.class || '';
        return DISTRIBUTABLE_CLASSES.has(cls);
      });

      // landuse レイヤーから駅・公園等の非配布エリアを取得して除外
      const EXCLUDE_LANDUSE = new Set(['railway', 'park', 'cemetery', 'industrial', 'pitch', 'airport']);
      let excludePolygons: any[] = [];
      try {
        const landuseLayers = map.getStyle()?.layers
          ?.filter((l: any) => (l['source-layer'] === 'landuse' || l['source-layer'] === 'landuse_overlay') && (l.type === 'fill' || l.type === 'line'))
          .map((l: any) => l.id) || [];
        if (landuseLayers.length > 0) {
          const luFeatures = map.queryRenderedFeatures(undefined, { layers: landuseLayers });
          excludePolygons = luFeatures.filter((f: any) => EXCLUDE_LANDUSE.has(f.properties?.class || ''));
        }
      } catch { /* ignore */ }

      // 除外ポリゴン内判定（簡易レイキャスト）
      const isInsideExcludeZone = (lng: number, lat: number): boolean => {
        for (const f of excludePolygons) {
          const geom = f.geometry;
          const rings = geom.type === 'Polygon' ? geom.coordinates : geom.type === 'MultiPolygon' ? geom.coordinates.flat() : [];
          for (const ring of rings) {
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              const xi = ring[i][0], yi = ring[i][1];
              const xj = ring[j][0], yj = ring[j][1];
              if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
            }
            if (inside) return true;
          }
        }
        return false;
      };

      // 道路セグメントから座標ポイントを抽出
      const roadPoints: [number, number][] = [];
      for (const f of filteredRoadFeatures) {
        const geom = f.geometry;
        if (geom.type === 'LineString') {
          for (const coord of geom.coordinates) roadPoints.push([coord[0], coord[1]]);
        } else if (geom.type === 'MultiLineString') {
          for (const line of geom.coordinates) for (const coord of line) roadPoints.push([coord[0], coord[1]]);
        }
      }

      // 道路ポイントを間引き（重複排除）+ エリアポリゴン内のみ + 駅・公園等除外
      const seen = new Set<string>();
      const uniqueRoadPoints = roadPoints.filter(p => {
        const key = `${(p[0] * 10000).toFixed(0)},${(p[1] * 10000).toFixed(0)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        // 配布エリアポリゴン内かつ除外ゾーン外
        return isInsideArea(p[0], p[1]) && !isInsideExcludeZone(p[0], p[1]);
      });

      // 各道路ポイントがGPS軌跡でカバーされているか判定
      let coveredCount = 0;
      const features: any[] = [];
      for (const rp of uniqueRoadPoints) {
        const hasCoverage = gpsPoints.some(gp =>
          Math.abs(gp.lng - rp[0]) < PROXIMITY && Math.abs(gp.lat - rp[1]) < PROXIMITY
        );
        if (hasCoverage) coveredCount++;
        if (!hasCoverage) {
          features.push({
            type: 'Feature' as const,
            properties: { covered: false },
            geometry: { type: 'Point' as const, coordinates: rp },
          });
        }
      }
      const rate = uniqueRoadPoints.length > 0 ? coveredCount / uniqueRoadPoints.length : 0;
      setCoverageRate(rate);
      setCoverageGeoJson({ type: 'FeatureCollection' as const, features });
    } else {
      setCoverageRate(null);
      setCoverageGeoJson(null);
    }
  }, [showCoverage, data, isInsideArea]);

  // Route suggestion handler
  const generateSuggestedRoute = useCallback(async () => {
    if (!areaGeoJson || loadingRoute) return;

    // If already showing route, toggle off
    if (suggestedRoute) {
      setSuggestedRoute(null);
      return;
    }

    setLoadingRoute(true);

    // Compute bounding box of area polygon
    const allCoords: number[][] = [];
    for (const feature of areaGeoJson.features) {
      const geom = feature.geometry as any;
      if (geom.type === 'Polygon') {
        allCoords.push(...geom.coordinates[0]);
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) allCoords.push(...poly[0]);
      }
    }
    if (allCoords.length === 0) { setLoadingRoute(false); return; }

    const minLng = Math.min(...allCoords.map(c => c[0]));
    const maxLng = Math.max(...allCoords.map(c => c[0]));
    const minLat = Math.min(...allCoords.map(c => c[1]));
    const maxLat = Math.max(...allCoords.map(c => c[1]));

    const step = 0.001; // ~100m
    const points: [number, number][] = [];

    for (let lng = minLng; lng <= maxLng; lng += step) {
      for (let lat = minLat; lat <= maxLat; lat += step) {
        points.push([lng, lat]);
      }
    }

    // Sample max 12 points evenly
    const sampled = points.length <= 12 ? points :
      points.filter((_, i) => i % Math.ceil(points.length / 12) === 0).slice(0, 12);

    if (sampled.length < 2) { setLoadingRoute(false); return; }

    try {
      const res = await fetch('/api/mapbox/optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: sampled, profile: 'walking', roundtrip: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Route optimization API error:', res.status, err);
        setLoadingRoute(false);
        return;
      }
      const resData = await res.json();
      if (resData.trips?.[0]?.geometry) {
        setSuggestedRoute({
          type: 'Feature',
          geometry: resData.trips[0].geometry,
          properties: {
            distance: resData.trips[0].distance,
            duration: resData.trips[0].duration,
          },
        });
      } else {
        console.error('No trips in optimization response:', resData);
      }
    } catch (e) {
      console.error('Route suggestion error:', e);
    }
    setLoadingRoute(false);
  }, [areaGeoJson, loadingRoute, suggestedRoute]);

  // ============================================================
  // Loading / Error states
  // ============================================================
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

  // ============================================================
  // Computed values for rendering
  // ============================================================
  const points = data.gpsPoints;
  const sliderRatio = sliderValue / 1000;
  const visibleCount = Math.max(1, Math.round(points.length * sliderRatio));
  const visiblePoints = points.slice(0, visibleCount);
  const currentPoint = visiblePoints[visiblePoints.length - 1];
  const currentTimestamp = currentPoint ? new Date(currentPoint.timestamp) : null;
  const startTime = new Date(data.session.startedAt);
  const endTime = data.session.finishedAt ? new Date(data.session.finishedAt) : new Date(nowTick);

  const visibleProgress = currentTimestamp
    ? data.progressEvents.filter((e) => new Date(e.timestamp) <= currentTimestamp)
    : [];
  const visibleSkips = currentTimestamp
    ? data.skipEvents.filter((e) => new Date(e.timestamp) <= currentTimestamp)
    : [];

  // Map center — エリアポリゴンの中心を優先
  const center = areaCenter
    ? areaCenter
    : points.length > 0
    ? { lat: points[Math.floor(points.length / 2)].lat, lng: points[Math.floor(points.length / 2)].lng }
    : { lat: 35.68, lng: 139.76 };

  // Duration / stats
  const totalPausedMs = (data.pauseEvents || []).reduce((sum, e) => {
    const pausedAt = new Date(e.pausedAt).getTime();
    const resumedAt = e.resumedAt ? new Date(e.resumedAt).getTime() : data.session.finishedAt ? new Date(data.session.finishedAt).getTime() : nowTick;
    return sum + Math.max(0, resumedAt - pausedAt);
  }, 0);
  const totalDuration = endTime.getTime() - startTime.getTime();
  const duration = Math.max(0, totalDuration - totalPausedMs);
  const durationHours = duration / (1000 * 60 * 60);
  const lastProgress = data.progressEvents[data.progressEvents.length - 1];
  const isFinished = !!data.session.finishedAt || data.schedule.status === 'COMPLETED';
  const maxActualCount = Math.max(0, ...data.schedule.items.map(i => i.actualCount || 0));
  const totalMailboxes = (isFinished && maxActualCount > 0) ? maxActualCount : (lastProgress?.mailboxCount || 0);

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
              {onSwitchToGoogle && (
                <span className="ml-2 inline-flex bg-slate-100 rounded-md p-0.5">
                  <button onClick={onSwitchToGoogle} className="px-2 py-0.5 text-[10px] font-bold rounded text-slate-500 hover:text-slate-700 transition-colors">Google</button>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-white text-indigo-600 shadow-sm">Mapbox</span>
                </span>
              )}
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
          {/* View mode toggle */}
          {dataSource === 'pms' ? (
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => { setViewMode('trajectory'); setSelectedDwellSpot(null); }}
                className={`px-2 md:px-3 py-1 rounded-md text-xs font-bold transition-colors ${viewMode === 'trajectory' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <i className="bi bi-bezier2 mr-1"></i>
                <span className="hidden md:inline">軌跡</span>
              </button>
              <button
                onClick={() => { setViewMode('dwell'); setSelectedDwellSpot(null); setIsPlaying(false); }}
                className={`px-2 md:px-3 py-1 rounded-md text-xs font-bold transition-colors ${viewMode === 'dwell' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
          {/* GPS OK/NG */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
            <i className="bi bi-geo-alt text-slate-400 text-xs hidden md:inline"></i>
            <span className="text-[10px] text-slate-500 font-bold hidden md:inline mr-0.5">GPS</span>
            <button
              onClick={() => setGpsResult(data?.schedule?.checkGpsResult === 'OK' ? null : 'OK')}
              disabled={gpsSaving}
              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                data?.schedule?.checkGpsResult === 'OK'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
              }`}
            >OK</button>
            <button
              onClick={() => setGpsResult(data?.schedule?.checkGpsResult === 'NG' ? null : 'NG')}
              disabled={gpsSaving}
              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                data?.schedule?.checkGpsResult === 'NG'
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-600'
              }`}
            >NG</button>
            {gpsSaving && <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>}
          </div>
          <button onClick={() => fetchData()} title="更新" className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      {/* GPS NG comment bar */}
      {showGpsCommentInput && data?.schedule?.checkGpsResult === 'NG' && (
        <div className="bg-rose-50 border-b border-rose-200 px-3 md:px-4 py-2 flex items-center gap-2 shrink-0">
          <i className="bi bi-exclamation-triangle-fill text-rose-500 text-xs"></i>
          <span className="text-xs font-bold text-rose-600 shrink-0">NG理由:</span>
          <input
            type="text"
            value={gpsComment}
            onChange={(e) => setGpsComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveGpsComment(); }}
            placeholder="NGの理由を入力..."
            className="flex-1 text-xs border border-rose-200 rounded px-2 py-1 focus:ring-1 focus:ring-rose-400 focus:border-rose-400 placeholder:text-rose-300 bg-white"
          />
          <button
            onClick={saveGpsComment}
            disabled={gpsSaving || gpsComment === (data?.schedule?.checkGpsComment || '')}
            className="px-3 py-1 rounded text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 transition-colors shrink-0"
          >
            {gpsSaving ? '...' : '保存'}
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1 relative">
          <Map
            ref={mapRef}
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            initialViewState={{
              longitude: center.lng,
              latitude: center.lat,
              zoom: 16,
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            onLoad={(e) => {
              const map = e.target;
              // エリアポリゴンのboundsにフィット
              if (areaGeoJson) {
                const coords: number[][] = [];
                for (const feature of areaGeoJson.features) {
                  const geom = feature.geometry as any;
                  if (geom.type === 'Polygon') coords.push(...geom.coordinates[0]);
                  else if (geom.type === 'MultiPolygon') {
                    for (const poly of geom.coordinates) coords.push(...poly[0]);
                  }
                }
                if (coords.length > 0) {
                  const lngs = coords.map(c => c[0]);
                  const lats = coords.map(c => c[1]);
                  map.fitBounds(
                    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                    { padding: 60, duration: 0 }
                  );
                }
              }
              // 番地番号のフォントサイズを大きくする
              if (map.getLayer('housenum-label')) {
                map.setPaintProperty('housenum-label', 'text-color', '#333');
                map.setLayoutProperty('housenum-label', 'text-size', 14);
              }
              // 建物のアウトラインを強調
              if (map.getLayer('building')) {
                map.setPaintProperty('building', 'fill-color', '#e2e8f0');
                map.setPaintProperty('building', 'fill-outline-color', '#94a3b8');
              }
            }}
            interactiveLayerIds={['prohibited-circles']}
            onClick={(e) => {
              const feature = e.features?.[0];
              if (feature && feature.layer?.id === 'prohibited-circles' && feature.geometry.type === 'Point') {
                const [lng, lat] = feature.geometry.coordinates;
                setPpPopup({ lng, lat, props: feature.properties });
              } else {
                setPpPopup(null);
              }
            }}
            cursor={ppPopup ? 'default' : undefined}
          >
            <NavigationControl position="top-right" />

            {/* ========== Area polygon ========== */}
            {areaGeoJson && (
              <Source id="area" type="geojson" data={areaGeoJson}>
                <Layer
                  id="area-fill"
                  type="fill"
                  paint={{
                    'fill-color': '#6366f1',
                    'fill-opacity': 0.08,
                  }}
                />
                <Layer
                  id="area-line"
                  type="line"
                  paint={{
                    'line-color': '#6366f1',
                    'line-width': 2,
                    'line-opacity': 0.6,
                  }}
                />
              </Source>
            )}

            {/* ========== TRAJECTORY MODE ========== */}
            {viewMode === 'trajectory' && (
              <>
                {/* GPS trajectory - already traversed (normal mode) */}
                {!showSpeed && trajectoryGeoJson && (
                  <Source id="trajectory" type="geojson" data={trajectoryGeoJson}>
                    <Layer
                      id="trajectory-line"
                      type="line"
                      paint={{
                        'line-color': '#ec4899',
                        'line-width': 3,
                        'line-opacity': 0.85,
                      }}
                      layout={{
                        'line-cap': 'round',
                        'line-join': 'round',
                      }}
                    />
                  </Source>
                )}

                {/* Speed-colored trajectory (when speed mode ON) */}
                {showSpeed && speedTrajectoryGeoJson && speedGradientStops && speedGradientStops.length >= 2 && (
                  <Source id="speed-trajectory" type="geojson" data={speedTrajectoryGeoJson} lineMetrics={true}>
                    <Layer
                      id="speed-trajectory-line"
                      type="line"
                      paint={{
                        'line-width': 4,
                        'line-gradient': [
                          'interpolate',
                          ['linear'],
                          ['line-progress'],
                          ...speedGradientStops.flatMap(([progress, color]) => [progress, color]),
                        ],
                        'line-opacity': 0.9,
                      }}
                      layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    />
                  </Source>
                )}

                {/* GPS trajectory - remaining (dimmed) */}
                {!showSpeed && remainingGeoJson && (
                  <Source id="trajectory-remaining" type="geojson" data={remainingGeoJson}>
                    <Layer
                      id="trajectory-remaining-line"
                      type="line"
                      paint={{
                        'line-color': '#f9a8d4',
                        'line-width': 2,
                        'line-opacity': 0.35,
                      }}
                      layout={{
                        'line-cap': 'round',
                        'line-join': 'round',
                      }}
                    />
                  </Source>
                )}

                {/* Past area trajectory comparison overlay */}
                {showPastComparison && pastTrajectoryGeoJson && (
                  <Source id="past-trajectory" type="geojson" data={pastTrajectoryGeoJson}>
                    <Layer
                      id="past-trajectory-line"
                      type="line"
                      paint={{
                        'line-color': '#f59e0b',
                        'line-width': 3,
                        'line-opacity': 0.6,
                        'line-dasharray': [4, 3],
                      }}
                      layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    />
                  </Source>
                )}
                {showPastComparison && selectedPast && selectedPast.gpsPoints.length > 0 && (
                  <>
                    <Marker longitude={selectedPast.gpsPoints[0].lng} latitude={selectedPast.gpsPoints[0].lat} anchor="center">
                      <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-md flex items-center justify-center">
                        <span className="text-white text-[7px] font-bold">S</span>
                      </div>
                    </Marker>
                    <Marker longitude={selectedPast.gpsPoints[selectedPast.gpsPoints.length - 1].lng} latitude={selectedPast.gpsPoints[selectedPast.gpsPoints.length - 1].lat} anchor="center">
                      <div className="w-4 h-4 rounded-full bg-amber-700 border-2 border-white shadow-md flex items-center justify-center">
                        <span className="text-white text-[7px] font-bold">E</span>
                      </div>
                    </Marker>
                  </>
                )}

                {/* Heatmap overlay (toggle) */}
                {showHeatmap && heatmapGeoJson && (
                  <Source id="heatmap" type="geojson" data={heatmapGeoJson}>
                    <Layer
                      id="heatmap-layer"
                      type="heatmap"
                      paint={{
                        'heatmap-weight': ['get', 'weight'],
                        'heatmap-intensity': 1,
                        'heatmap-radius': 20,
                        'heatmap-color': [
                          'interpolate', ['linear'], ['heatmap-density'],
                          0, 'rgba(0,0,255,0)',
                          0.2, 'rgb(0,0,255)',
                          0.4, 'rgb(0,255,0)',
                          0.6, 'rgb(255,255,0)',
                          1, 'rgb(255,0,0)',
                        ],
                        'heatmap-opacity': 0.7,
                      }}
                    />
                  </Source>
                )}

                {/* Prohibited property markers */}
                {showProhibited && prohibitedGeoJson && (
                  <Source id="prohibited" type="geojson" data={prohibitedGeoJson}>
                    <Layer
                      id="prohibited-circles"
                      type="circle"
                      paint={{
                        'circle-radius': 7,
                        'circle-color': ['get', 'color'],
                        'circle-opacity': 0.7,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                      }}
                    />
                  </Source>
                )}
                {/* Prohibited property polygons */}
                {showProhibited && prohibitedPolygonGeoJson && (
                  <Source id="prohibited-polygons" type="geojson" data={prohibitedPolygonGeoJson}>
                    <Layer
                      id="prohibited-polygon-fill"
                      type="fill"
                      paint={{
                        'fill-color': ['get', 'color'],
                        'fill-opacity': 0.2,
                      }}
                    />
                    <Layer
                      id="prohibited-polygon-line"
                      type="line"
                      paint={{
                        'line-color': ['get', 'color'],
                        'line-opacity': 0.8,
                        'line-width': 2,
                      }}
                    />
                  </Source>
                )}

                {/* Prohibited property Popup */}
                {ppPopup && (
                  <Popup
                    longitude={ppPopup.lng}
                    latitude={ppPopup.lat}
                    anchor="bottom"
                    onClose={() => setPpPopup(null)}
                    closeOnClick={false}
                    maxWidth="280px"
                  >
                    <div className="text-xs space-y-1 p-1">
                      {ppPopup.props.buildingName && (
                        <div className="font-bold text-slate-800 text-sm">{ppPopup.props.buildingName}</div>
                      )}
                      {ppPopup.props.address && (
                        <div className="text-slate-600"><i className="bi bi-geo-alt text-rose-500 mr-1"></i>{ppPopup.props.address}</div>
                      )}
                      {ppPopup.props.roomNumber && (
                        <div className="text-slate-500">部屋: {ppPopup.props.roomNumber}</div>
                      )}
                      {ppPopup.props.residentName && (
                        <div className="text-slate-500">居住者: {ppPopup.props.residentName}</div>
                      )}
                      {(ppPopup.props.reasonName || ppPopup.props.reasonDetail) && (
                        <div className="border-t border-slate-100 pt-1 mt-1">
                          {ppPopup.props.reasonName && <span className="inline-block bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-bold mr-1">{ppPopup.props.reasonName}</span>}
                          {ppPopup.props.reasonDetail && <div className="text-slate-500 mt-0.5">{ppPopup.props.reasonDetail}</div>}
                        </div>
                      )}
                      {ppPopup.props.severity > 0 && (
                        <div className="text-[10px] text-slate-400">重要度: {'★'.repeat(ppPopup.props.severity)}{'☆'.repeat(5 - ppPopup.props.severity)}</div>
                      )}
                    </div>
                  </Popup>
                )}

                {/* Coverage — uncovered road points (orange diamonds, distinct from red prohibited circles) */}
                {showCoverage && coverageGeoJson && (
                  <Source id="coverage-uncovered" type="geojson" data={coverageGeoJson}>
                    <Layer
                      id="coverage-uncovered-circles"
                      type="circle"
                      paint={{
                        'circle-radius': 3.5,
                        'circle-color': '#f97316',
                        'circle-opacity': 0.7,
                        'circle-stroke-width': 1.5,
                        'circle-stroke-color': '#ea580c',
                      }}
                    />
                    <Layer
                      id="coverage-uncovered-x"
                      type="symbol"
                      layout={{
                        'text-field': '×',
                        'text-size': 9,
                        'text-allow-overlap': true,
                        'text-ignore-placement': true,
                      }}
                      paint={{
                        'text-color': '#ffffff',
                      }}
                    />
                  </Source>
                )}

                {/* Suggested route overlay */}
                {suggestedRoute && (
                  <Source id="suggested-route" type="geojson" data={suggestedRoute}>
                    <Layer
                      id="suggested-route-line"
                      type="line"
                      paint={{
                        'line-color': '#3b82f6',
                        'line-width': 4,
                        'line-dasharray': [2, 2],
                        'line-opacity': 0.8,
                      }}
                      layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                    />
                  </Source>
                )}

                {/* Prohibited property 3D red columns */}
                {show3D && showProhibited && prohibited3DData && (
                  <Source id="prohibited-3d" type="geojson" data={prohibited3DData}>
                    <Layer
                      id="prohibited-3d-extrusion"
                      type="fill-extrusion"
                      paint={{
                        'fill-extrusion-color': '#ef4444',
                        'fill-extrusion-height': 30,
                        'fill-extrusion-base': 0,
                        'fill-extrusion-opacity': 0.8,
                      }}
                    />
                  </Source>
                )}

                {/* Start marker */}
                {points.length > 0 && (
                  <Marker
                    longitude={points[0].lng}
                    latitude={points[0].lat}
                    anchor="center"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      setPopup({ lng: points[0].lng, lat: points[0].lat, content: `START: ${fmtTime(points[0].timestamp)}` });
                    }}
                  >
                    <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-white">
                      START
                    </div>
                  </Marker>
                )}

                {/* Finish marker */}
                {data.session.finishedAt && points.length > 0 && (
                  <Marker
                    longitude={points[points.length - 1].lng}
                    latitude={points[points.length - 1].lat}
                    anchor="center"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      setPopup({ lng: points[points.length - 1].lng, lat: points[points.length - 1].lat, content: `FINISH: ${fmtTime(points[points.length - 1].timestamp)}` });
                    }}
                  >
                    <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-white">
                      FINISH
                    </div>
                  </Marker>
                )}

                {/* Current position marker */}
                {currentPoint && (
                  <Marker
                    longitude={currentPoint.lng}
                    latitude={currentPoint.lat}
                    anchor="bottom"
                  >
                    <div className={`flex flex-col items-center ${!data.session.finishedAt ? 'animate-bounce' : ''}`}>
                      <div className="text-[10px] font-mono text-slate-600 bg-white/90 px-1 rounded shadow mb-0.5">
                        {currentTimestamp ? fmtTime(currentTimestamp.toISOString()) : ''}
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${data.session.finishedAt ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      />
                    </div>
                  </Marker>
                )}

                {/* Progress event markers */}
                {visibleProgress.map((e) =>
                  e.lat != null && e.lng != null ? (
                    <Marker
                      key={`progress-${e.id}`}
                      longitude={e.lng}
                      latitude={e.lat}
                      anchor="center"
                      onClick={(ev) => {
                        ev.originalEvent.stopPropagation();
                        setPopup({ lng: e.lng!, lat: e.lat!, content: `${e.mailboxCount}枚完了 (${fmtTime(e.timestamp)})` });
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center text-white text-[9px] font-bold">
                        {e.mailboxCount}
                      </div>
                    </Marker>
                  ) : null
                )}

                {/* Skip event markers */}
                {visibleSkips.map((e) => (
                  <Marker
                    key={`skip-${e.id}`}
                    longitude={e.lng}
                    latitude={e.lat}
                    anchor="bottom"
                    onClick={(ev) => {
                      ev.originalEvent.stopPropagation();
                      setPopup({
                        lng: e.lng, lat: e.lat,
                        content: `スキップ (${fmtTime(e.timestamp)})${e.reason ? `\n${e.reason}` : ''}${e.prohibitedProperty ? `\n${e.prohibitedProperty.buildingName || e.prohibitedProperty.address}` : ''}`,
                      });
                    }}
                  >
                    <div className="text-orange-500 text-lg drop-shadow-md">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                    </div>
                  </Marker>
                ))}
              </>
            )}

            {/* ========== DWELL TIME MODE ========== */}
            {viewMode === 'dwell' && (
              <>
                {/* Faint full trajectory for context */}
                {fullTrajectoryGeoJson && (
                  <Source id="dwell-trajectory" type="geojson" data={fullTrajectoryGeoJson}>
                    <Layer
                      id="dwell-trajectory-line"
                      type="line"
                      paint={{
                        'line-color': '#cbd5e1',
                        'line-width': 1.5,
                        'line-opacity': 0.5,
                      }}
                      layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    />
                  </Source>
                )}

                {/* Dwell spot circles */}
                {dwellGeoJson && (
                  <Source id="dwell-spots" type="geojson" data={dwellGeoJson}>
                    <Layer
                      id="dwell-circles"
                      type="circle"
                      paint={{
                        'circle-radius': ['get', 'radius'],
                        'circle-color': ['get', 'color'],
                        'circle-opacity': 0.45,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': ['get', 'color'],
                        'circle-stroke-opacity': 0.9,
                      }}
                    />
                  </Source>
                )}

                {/* Start marker */}
                {points.length > 0 && (
                  <Marker longitude={points[0].lng} latitude={points[0].lat} anchor="center">
                    <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-white">START</div>
                  </Marker>
                )}

                {/* Finish marker */}
                {data.session.finishedAt && points.length > 0 && (
                  <Marker longitude={points[points.length - 1].lng} latitude={points[points.length - 1].lat} anchor="center">
                    <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-white">FINISH</div>
                  </Marker>
                )}
              </>
            )}

            {/* Popup (both modes) */}
            {popup && (
              <Popup
                longitude={popup.lng}
                latitude={popup.lat}
                anchor="bottom"
                onClose={() => { setPopup(null); setSelectedDwellSpot(null); }}
                closeOnClick={false}
              >
                <div className="text-xs whitespace-pre-line">{popup.content}</div>
              </Popup>
            )}
          </Map>

          {/* Layer toggle buttons (floating over map) */}
          {viewMode === 'trajectory' && (
            <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 z-10">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border transition-colors ${
                  showHeatmap
                    ? 'bg-orange-500 text-white border-orange-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <i className="bi bi-fire mr-1"></i>
                ヒートマップ
              </button>
              <button
                onClick={() => setShowProhibited(!showProhibited)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border transition-colors ${
                  showProhibited
                    ? 'bg-red-500 text-white border-red-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <i className="bi bi-slash-circle mr-1"></i>
                禁止物件
              </button>
              <button
                onClick={() => setShow3D(!show3D)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border transition-colors ${
                  show3D
                    ? 'bg-purple-600 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <i className="bi bi-badge-3d"></i>
                3D建物
              </button>
              <button
                onClick={() => setShowCoverage(!showCoverage)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border transition-colors ${
                  showCoverage
                    ? 'bg-teal-600 text-white border-teal-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <i className="bi bi-grid-3x3"></i>
                カバレッジ
              </button>
              <button
                onClick={generateSuggestedRoute}
                disabled={loadingRoute}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border transition-colors ${
                  suggestedRoute
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                } ${loadingRoute ? 'opacity-50' : ''}`}
              >
                <i className={`bi ${loadingRoute ? 'bi-arrow-repeat animate-spin' : 'bi-signpost-2'}`}></i>
                ルート提案
              </button>
              <button
                onClick={() => setShowSpeed(!showSpeed)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border transition-colors ${
                  showSpeed
                    ? 'bg-cyan-600 text-white border-cyan-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <i className="bi bi-speedometer2"></i>
                移動速度
              </button>
              <button
                onClick={() => setShowPastComparison(!showPastComparison)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border transition-colors ${
                  showPastComparison
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <i className={`bi ${pastLoading ? 'bi-arrow-repeat animate-spin' : 'bi-clock-history'}`}></i>
                過去比較
              </button>
            </div>
          )}

          {/* Past comparison legend */}
          {showPastComparison && selectedPast && (
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2.5 text-xs z-10 max-w-56">
              <div className="font-bold text-slate-700 mb-1.5">
                <i className="bi bi-clock-history mr-1"></i>過去比較
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded" style={{ background: '#ec4899' }}></div>
                  <span className="text-slate-600">今回</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded border border-amber-400" style={{ background: '#f59e0b' }}></div>
                  <span className="text-slate-600 truncate">
                    {new Date(selectedPast.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })}
                    {' '}{selectedPast.distributorName}
                  </span>
                </div>
              </div>
              {/* Past trajectory selector */}
              {pastTrajectories && pastTrajectories.length > 1 && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex gap-1 flex-wrap">
                  {pastTrajectories.map((pt, i) => (
                    <button
                      key={pt.scheduleId}
                      onClick={() => setPastSelectedIdx(i)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        i === pastSelectedIdx ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {new Date(pt.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past comparison error */}
          {showPastComparison && pastError && (
            <div className="absolute bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600 z-10">
              <i className="bi bi-exclamation-triangle mr-1"></i>{pastError}
            </div>
          )}

          {/* Coverage stat badge */}
          {showCoverage && coverageRate !== null && (
            <div className="absolute top-16 left-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-slate-200 text-sm font-bold z-10">
              <i className="bi bi-grid-3x3 text-teal-500 mr-1.5"></i>
              カバレッジ: <span className={coverageRate > 0.8 ? 'text-emerald-600' : coverageRate > 0.5 ? 'text-amber-600' : 'text-red-600'}>{Math.round(coverageRate * 100)}%</span>
            </div>
          )}

          {/* Speed legend */}
          {showSpeed && (
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2.5 text-xs z-10">
              <div className="font-bold text-slate-700 mb-1.5">移動速度</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded" style={{ background: SPEED_COLORS.posting }}></div>
                  <span className="text-slate-600">〜{SPEED_THRESHOLDS.posting} km/h（配布中）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded" style={{ background: SPEED_COLORS.slowWalk }}></div>
                  <span className="text-slate-600">〜{SPEED_THRESHOLDS.slowWalk} km/h（配布歩行）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded" style={{ background: SPEED_COLORS.normalWalk }}></div>
                  <span className="text-slate-600">〜{SPEED_THRESHOLDS.normalWalk} km/h（通常歩行）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-1 rounded" style={{ background: SPEED_COLORS.fast }}></div>
                  <span className="text-slate-600">{SPEED_THRESHOLDS.normalWalk}+ km/h（高速移動）</span>
                </div>
              </div>
            </div>
          )}

          {/* Route info badge */}
          {suggestedRoute && (
            <div className="absolute top-16 right-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-slate-200 text-xs z-10">
              <div className="font-bold text-blue-600 mb-1"><i className="bi bi-signpost-2 mr-1"></i>推奨ルート</div>
              <div>距離: {(suggestedRoute.properties.distance / 1000).toFixed(1)} km</div>
              <div>所要時間: {Math.round(suggestedRoute.properties.duration / 60)} 分</div>
              <button onClick={() => setSuggestedRoute(null)} className="mt-1 text-slate-400 hover:text-slate-600 text-[10px]">
                <i className="bi bi-x-circle mr-0.5"></i>クリア
              </button>
            </div>
          )}
        </div>

        {/* Side panel */}
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

              {/* Stats */}
              {(dataSource === 'pms' || (dataSource === 'posting-system' && isFinished)) && (
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3">
                    <i className="bi bi-speedometer2 mr-1"></i>
                    パフォーマンス
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {dataSource === 'pms' && (
                      <>
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
                      </>
                    )}
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="text-purple-600 font-black text-lg">{fmtDuration(duration)}</div>
                      <div className="text-purple-400">作業時間{totalPausedMs > 0 ? '*' : ''}</div>
                    </div>
                    {isFinished && totalMailboxes > 0 && (
                      <div className="bg-indigo-50 rounded-lg p-2 text-center">
                        <div className="text-indigo-600 font-black text-lg">{durationHours > 0 ? Math.round(totalMailboxes / durationHours).toLocaleString() : 0}</div>
                        <div className="text-indigo-400">枚/時</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Speed analysis (when speed mode is ON) */}
              {showSpeed && segmentSpeeds.length > 0 && (
                <>
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm mb-3">
                      <i className="bi bi-speedometer2 mr-1"></i>
                      速度分析
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <div className="text-blue-600 font-black text-lg">{speedStats.avg.toFixed(1)}</div>
                        <div className="text-blue-400">平均 km/h</div>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-2 text-center">
                        <div className="text-indigo-600 font-black text-lg">{speedStats.max.toFixed(1)}</div>
                        <div className="text-indigo-400">最高 km/h</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm mb-3">
                      <i className="bi bi-pie-chart mr-1"></i>
                      配布 vs 移動
                    </h3>
                    <div className="flex h-6 rounded-full overflow-hidden mb-2">
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${Math.max(speedStats.postingPct, 2)}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }}
                      >
                        {speedStats.postingPct >= 15 ? `${Math.round(speedStats.postingPct)}%` : ''}
                      </div>
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ width: `${Math.max(speedStats.movingPct, 2)}%`, background: 'linear-gradient(90deg, #22c55e, #3b82f6)' }}
                      >
                        {speedStats.movingPct >= 15 ? `${Math.round(speedStats.movingPct)}%` : ''}
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500"></span>
                          配布活動（〜{SPEED_THRESHOLDS.slowWalk} km/h）
                        </span>
                        <span className="font-bold text-slate-700">{fmtDuration(speedStats.postingTime)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-500 to-blue-500"></span>
                          移動（{SPEED_THRESHOLDS.slowWalk}+ km/h）
                        </span>
                        <span className="font-bold text-slate-700">{fmtDuration(speedStats.movingTime)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm mb-3">
                      <i className="bi bi-bar-chart mr-1"></i>
                      速度分布
                    </h3>
                    <SpeedDistributionChart speeds={segmentSpeeds} />
                  </div>
                </>
              )}

              {/* 過去エリア軌跡比較 stats */}
              {showPastComparison && selectedPast && data && (
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3">
                    <i className="bi bi-clock-history mr-1 text-amber-500"></i>
                    過去比較
                  </h3>
                  {/* Past trajectory selector */}
                  {pastTrajectories && pastTrajectories.length > 1 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                      {pastTrajectories.map((pt, i) => (
                        <button
                          key={pt.scheduleId}
                          onClick={() => setPastSelectedIdx(i)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                            i === pastSelectedIdx ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {new Date(pt.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3">
                    <div className="text-[10px] text-amber-600 font-bold">{selectedPast.distributorName}</div>
                    <div className="text-[10px] text-amber-500">
                      {new Date(selectedPast.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' })}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">今回 距離</span>
                      <span className="font-bold text-slate-700">{(data.session.totalDistance / 1000).toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">過去 距離</span>
                      <span className="font-bold text-amber-600">{(selectedPast.totalDistance / 1000).toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">今回 GPS点数</span>
                      <span className="font-bold text-slate-700">{data.gpsPoints.length.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">過去 GPS点数</span>
                      <span className="font-bold text-amber-600">{selectedPast.gpsPoints.length.toLocaleString()}</span>
                    </div>
                    {selectedPast.startedAt && selectedPast.finishedAt && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">過去 時間</span>
                          <span className="font-bold text-amber-600">
                            {fmtTime(selectedPast.startedAt)} ~ {fmtTime(selectedPast.finishedAt)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {showPastComparison && pastTrajectories && pastTrajectories.length === 0 && !pastLoading && (
                <div className="p-4 border-b border-slate-100">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                    <i className="bi bi-info-circle mr-1"></i>
                    同エリアの過去の配布データがありません。
                  </div>
                </div>
              )}

              {/* Per-hour metrics — PMS session only */}
              {dataSource === 'pms' && isFinished && (
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
                      <span className="font-bold text-slate-700">{durationHours > 0 ? Math.round(totalMailboxes / durationHours).toLocaleString() : 0} ポスト/h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">歩数</span>
                      <span className="font-bold text-slate-700">{durationHours > 0 ? Math.round(data.session.totalSteps / durationHours).toLocaleString() : 0} 歩/h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">移動距離</span>
                      <span className="font-bold text-slate-700">{durationHours > 0 ? (data.session.totalDistance / 1000 / durationHours).toFixed(1) : 0} km/h</span>
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
                        const dotColor = item.type === 'START' ? 'bg-emerald-500' : item.type === 'PROGRESS' ? 'bg-blue-400' : item.type === 'SKIP' ? 'bg-orange-400' : item.type === 'PAUSE' ? 'bg-yellow-400' : item.type === 'RESUME' ? 'bg-teal-400' : 'bg-red-500';
                        const textColor = item.type === 'START' ? 'text-emerald-600' : item.type === 'PROGRESS' ? 'text-blue-600' : item.type === 'SKIP' ? 'text-orange-600' : item.type === 'PAUSE' ? 'text-yellow-600' : item.type === 'RESUME' ? 'text-teal-600' : 'text-red-600';
                        const label = item.type === 'PROGRESS' && 'mailboxCount' in item ? `${item.mailboxCount}枚` : item.type;
                        return (
                          <div key={`${item.type}-${idx}`} className="flex items-center gap-2">
                            <span className={`w-2 h-2 ${dotColor} rounded-full shrink-0`}></span>
                            <span className="text-slate-500">{fmtTime(item.time)}</span>
                            <span className={`font-bold ${textColor}`}>{label}</span>
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
                          <span className="text-slate-500">{isFinished ? '終了' : '最終GPS'}</span>
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
                            setPopup({
                              lng: spot.centerLng, lat: spot.centerLat,
                              content: `滞在時間: ${fmtDuration(spot.dwellMs)}\n${fmtTime(spot.startTime)} 〜 ${fmtTime(spot.endTime)}\nGPSポイント: ${spot.pointCount}件\n${dwellLabel(spot.dwellMs)}`,
                            });
                            mapRef.current?.flyTo({ center: [spot.centerLng, spot.centerLat], zoom: 18, duration: 500 });
                          }}
                          className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                            isSelected ? 'bg-slate-200 ring-1 ring-slate-400' : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-slate-400 font-bold w-5 text-right shrink-0">#{idx + 1}</span>
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
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

      {/* Dwell mode footer */}
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
