'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Polyline, Marker, InfoWindow } from '@react-google-maps/api';

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

interface ProhibitedProperty {
  id: number;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  buildingName: string | null;
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
    return new Date(dateStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
// Component
// ============================================================
export default function TrajectoryViewer({ scheduleId, onClose }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [data, setData] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Playback state
  const [sliderValue, setSliderValue] = useState(1000); // 0-1000 range
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Info window
  const [selectedInfo, setSelectedInfo] = useState<{ position: google.maps.LatLngLiteral; content: string } | null>(null);

  // Live polling
  const [isLive, setIsLive] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch trajectory data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/trajectory`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'データの取得に失敗しました');
        return;
      }
      const json = await res.json();
      setData(json);
      setIsLive(json.session.finishedAt === null);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">軌跡データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
  const endTime = data.session.finishedAt ? new Date(data.session.finishedAt) : new Date();

  // Filter events by current time
  const visibleProgress = currentTimestamp
    ? data.progressEvents.filter((e) => new Date(e.timestamp) <= currentTimestamp)
    : [];
  const visibleSkips = currentTimestamp
    ? data.skipEvents.filter((e) => new Date(e.timestamp) <= currentTimestamp)
    : [];

  // Area polygon
  const areaPaths = data.area?.boundaryGeojson ? extractPaths(data.area.boundaryGeojson) : [];

  // Map center
  const center = currentPoint
    ? { lat: currentPoint.lat, lng: currentPoint.lng }
    : points.length > 0
    ? { lat: points[0].lat, lng: points[0].lng }
    : { lat: 35.68, lng: 139.76 };

  // Stats
  const duration = endTime.getTime() - startTime.getTime();
  const durationHours = duration / (1000 * 60 * 60);
  const lastProgress = data.progressEvents[data.progressEvents.length - 1];
  const totalMailboxes = lastProgress?.mailboxCount || 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 backdrop-blur-sm">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <i className="bi bi-geo-alt-fill text-emerald-500 text-xl"></i>
          <div>
            <h2 className="font-bold text-slate-800">
              GPS軌跡 — {data.schedule.distributorName}
              <span className="text-slate-400 font-normal text-sm ml-2">({data.schedule.distributorStaffId})</span>
            </h2>
            <p className="text-xs text-slate-500">
              {data.area ? `${data.area.townName}${data.area.chomeName}` : ''} / {new Date(data.schedule.date).toLocaleDateString('ja-JP')}
              {isLive && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  LIVE
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600">
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={center}
              zoom={16}
              options={{
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: false,
              }}
            >
              {/* Area polygon */}
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

              {/* GPS trajectory - already traversed */}
              {visiblePoints.length > 1 && (
                <Polyline
                  path={visiblePoints.map((p) => ({ lat: p.lat, lng: p.lng }))}
                  options={{
                    strokeColor: '#3b82f6',
                    strokeWeight: 3,
                    strokeOpacity: 0.9,
                  }}
                />
              )}

              {/* GPS trajectory - remaining (dimmed) */}
              {visibleCount < points.length && (
                <Polyline
                  path={points.slice(visibleCount - 1).map((p) => ({ lat: p.lat, lng: p.lng }))}
                  options={{
                    strokeColor: '#94a3b8',
                    strokeWeight: 2,
                    strokeOpacity: 0.3,
                  }}
                />
              )}

              {/* Start marker */}
              {points.length > 0 && (
                <Marker
                  position={{ lat: points[0].lat, lng: points[0].lng }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#22c55e',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                  }}
                  title="START"
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
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                  }}
                  title="FINISH"
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
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 3,
                  }}
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
              {data.prohibitedProperties.map((pp) =>
                pp.latitude && pp.longitude ? (
                  <Marker
                    key={`pp-${pp.id}`}
                    position={{ lat: pp.latitude, lng: pp.longitude }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 5,
                      fillColor: '#ef4444',
                      fillOpacity: 0.6,
                      strokeColor: '#ef4444',
                      strokeWeight: 1,
                    }}
                    title={pp.buildingName || pp.address || '禁止物件'}
                  />
                ) : null
              )}

              {/* Info window */}
              {selectedInfo && (
                <InfoWindow
                  position={selectedInfo.position}
                  onCloseClick={() => setSelectedInfo(null)}
                >
                  <div className="text-xs whitespace-pre-line">{selectedInfo.content}</div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>

        {/* Side panel */}
        <div className="w-72 bg-white border-l border-slate-200 flex flex-col overflow-y-auto shrink-0">
          {/* Stats */}
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
                <div className="text-purple-400">作業時間</div>
              </div>
            </div>
          </div>

          {/* Per-hour metrics */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-700 text-sm mb-3">
              <i className="bi bi-graph-up mr-1"></i>
              時間あたり
            </h3>
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

          {/* Progress timeline */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-700 text-sm mb-3">
              <i className="bi bi-clock-history mr-1"></i>
              配布進捗
            </h3>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0"></span>
                <span className="text-slate-500">{fmtTime(data.session.startedAt)}</span>
                <span className="font-bold text-emerald-600">START</span>
              </div>
              {data.progressEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full shrink-0"></span>
                  <span className="text-slate-500">{fmtTime(e.timestamp)}</span>
                  <span className="font-bold text-blue-600">{e.mailboxCount}枚</span>
                </div>
              ))}
              {data.skipEvents.map((e) => (
                <div key={`s-${e.id}`} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-400 rounded-full shrink-0"></span>
                  <span className="text-slate-500">{fmtTime(e.timestamp)}</span>
                  <span className="font-bold text-orange-600">SKIP</span>
                </div>
              ))}
              {data.session.finishedAt && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full shrink-0"></span>
                  <span className="text-slate-500">{fmtTime(data.session.finishedAt)}</span>
                  <span className="font-bold text-red-600">FINISH</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Time slider / Playback controls */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-4 shrink-0">
        {/* Play/Pause */}
        <button
          onClick={() => {
            if (sliderValue >= 1000) setSliderValue(0);
            setIsPlaying(!isPlaying);
          }}
          className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors shrink-0"
        >
          <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'} text-lg`}></i>
        </button>

        {/* Time display */}
        <div className="text-xs text-slate-500 w-16 shrink-0 text-center font-mono">
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
        <div className="flex items-center gap-1 shrink-0">
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
        <span className="text-xs text-slate-400 shrink-0">
          {visibleCount}/{points.length} pts
        </span>
      </div>
    </div>
  );
}
