'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Polyline } from '@react-google-maps/api';
import { useTranslation } from '@/i18n';

// ============================================================
// Types
// ============================================================
type AreaResult = {
  id: number;
  address_code: string;
  town_name: string;
  chome_name: string;
  boundary_geojson: string | null;
  prefecture: { name: string };
  city: { name: string };
};

type HistoryRecord = {
  conditionDate: string;
  manageCode: string;
  staffName: string;
  city: string;
  streetNumber: string;
  totalSheets: number;
  totalPosted: number;
};

type GpsPoint = { lat: number; lng: number; timestamp: string };

type TrajectoryData = {
  key: string;
  staffName: string;
  manageCode: string;
  date: string;
  gpsPoints: GpsPoint[];
  color: string;
};

// ============================================================
// Constants
// ============================================================
const TRAJECTORY_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48', '#0ea5e9', '#a855f7', '#10b981',
  '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed',
];

const MAX_COMPARE_RECORDS = 5;
const MAP_CONTAINER = { width: '100%', height: '500px' };
const MAP_CENTER = { lat: 35.7, lng: 139.7 };

// ============================================================
// Speed calculation (same as MapboxTrajectoryViewer)
// ============================================================
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

const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

type SpeedSegment = {
  from: GpsPoint;
  to: GpsPoint;
  speedKmh: number;
  color: string;
};

const speedToColor = (kmh: number): string => {
  if (kmh <= SPEED_THRESHOLDS.posting) return SPEED_COLORS.posting;
  if (kmh <= SPEED_THRESHOLDS.slowWalk) return SPEED_COLORS.slowWalk;
  if (kmh <= SPEED_THRESHOLDS.normalWalk) return SPEED_COLORS.normalWalk;
  return SPEED_COLORS.fast;
};

const computeSpeedSegments = (points: GpsPoint[]): SpeedSegment[] => {
  if (points.length < 2) return [];
  // Raw speeds
  const rawSpeeds: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const distM = haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    const dtSec = Math.max((new Date(points[i].timestamp).getTime() - new Date(points[i - 1].timestamp).getTime()) / 1000, 0.1);
    rawSpeeds.push(Math.min((distM / dtSec) * 3.6, 30));
  }
  // 3-point moving average
  const smoothed = rawSpeeds.map((_, i) => {
    const start = Math.max(0, i - 1);
    const end = Math.min(rawSpeeds.length - 1, i + 1);
    let sum = 0, count = 0;
    for (let j = start; j <= end; j++) { sum += rawSpeeds[j]; count++; }
    return sum / count;
  });
  return smoothed.map((speed, i) => ({
    from: points[i],
    to: points[i + 1],
    speedKmh: speed,
    color: speedToColor(speed),
  }));
};

// ============================================================
// GeoJSON parser (same pattern as AllTrajectoriesViewer)
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
    } catch { /* invalid JSON */ }
  }
  return [];
};

// ============================================================
// Component
// ============================================================
export default function AreaGpsComparison() {
  const { t } = useTranslation('fraud-detection');
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [areaSearch, setAreaSearch] = useState('');
  const [areaResults, setAreaResults] = useState<AreaResult[]>([]);
  const [selectedArea, setSelectedArea] = useState<AreaResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [trajectories, setTrajectories] = useState<TrajectoryData[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [partialError, setPartialError] = useState(false);

  const recordKey = (r: HistoryRecord) => `${r.manageCode}_${r.conditionDate}`;

  const formatArea = (area: AreaResult) =>
    `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`;

  // Area search
  // NOTE: /api/areas returns { data: Area[] } (not a plain array or { areas: [] })
  const searchAreas = useCallback(async () => {
    if (!areaSearch.trim()) return;
    setLoadingAreas(true);
    try {
      const res = await fetch(`/api/areas?search=${encodeURIComponent(areaSearch)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        // API returns { data: Area[] } for requests without a page param (up to 50 items)
        setAreaResults(Array.isArray(data) ? data : (data.data || []));
      }
    } finally {
      setLoadingAreas(false);
    }
  }, [areaSearch]);

  // Select area -> fetch history
  const selectArea = useCallback(async (area: AreaResult) => {
    setSelectedArea(area);
    setHistory([]);
    setSelectedKeys(new Set());
    setTrajectories([]);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/posting-system/area-history?streetNumber=${area.address_code}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Toggle record selection
  const toggleRecord = useCallback((record: HistoryRecord) => {
    const key = recordKey(record);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_COMPARE_RECORDS) {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Fetch GPS and display
  const compareGps = useCallback(async () => {
    const selected = history.filter(r => selectedKeys.has(recordKey(r)));
    if (selected.length === 0) return;

    setLoadingGps(true);
    setPartialError(false);

    const results: TrajectoryData[] = [];
    let hasError = false;

    await Promise.all(
      selected.map(async (record, idx) => {
        try {
          const res = await fetch(
            `/api/posting-system/staff-gps?staffId=${record.manageCode}&date=${record.conditionDate}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.gpsPoints && data.gpsPoints.length > 0) {
              results.push({
                key: recordKey(record),
                staffName: record.staffName,
                manageCode: record.manageCode,
                date: record.conditionDate,
                gpsPoints: data.gpsPoints,
                color: TRAJECTORY_COLORS[idx % TRAJECTORY_COLORS.length],
              });
            } else {
              hasError = true;
            }
          } else {
            hasError = true;
          }
        } catch {
          hasError = true;
        }
      })
    );

    setTrajectories(results);
    setPartialError(hasError && results.length > 0);
    setLoadingGps(false);
  }, [history, selectedKeys]);

  // Map center
  const mapCenter = useMemo(() => {
    if (trajectories.length > 0) {
      const allPts = trajectories.flatMap(t => t.gpsPoints);
      if (allPts.length > 0) {
        const avgLat = allPts.reduce((s, p) => s + p.lat, 0) / allPts.length;
        const avgLng = allPts.reduce((s, p) => s + p.lng, 0) / allPts.length;
        return { lat: avgLat, lng: avgLng };
      }
    }
    return MAP_CENTER;
  }, [trajectories]);

  // Area polygon paths
  const areaPaths = useMemo(() => {
    if (!selectedArea?.boundary_geojson) return [];
    return extractPaths(selectedArea.boundary_geojson);
  }, [selectedArea]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">
              {t('area_search_placeholder')}
            </label>
            <input
              type="text"
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchAreas()}
              placeholder={t('area_search_placeholder')}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={searchAreas}
            disabled={loadingAreas}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors"
          >
            {loadingAreas ? '...' : t('area_search_button')}
          </button>
        </div>

        {/* Area results dropdown */}
        {areaResults.length > 0 && !selectedArea && (
          <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
            {areaResults.map((area) => (
              <button
                key={area.id}
                onClick={() => { selectArea(area); setAreaResults([]); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                {formatArea(area)}
                <span className="text-[10px] text-slate-400 ml-2 font-mono">({area.address_code})</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected area */}
        {selectedArea && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">{t('area_selected')}:</span>
            <span className="text-xs font-black text-slate-800">{formatArea(selectedArea)}</span>
            <button
              onClick={() => { setSelectedArea(null); setHistory([]); setTrajectories([]); setSelectedKeys(new Set()); }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <i className="bi bi-x-circle text-xs"></i>
            </button>
          </div>
        )}
      </div>

      {/* Main content: history list + map */}
      {selectedArea && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: History list */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-black text-slate-700">{t('history_title')}</h3>
              {selectedKeys.size > 0 && (
                <span className="text-[10px] text-indigo-600 font-bold">
                  {t('compare_selected', { count: String(selectedKeys.size) })}
                </span>
              )}
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <i className="bi bi-inbox text-2xl mb-2 block"></i>
                {t('history_no_data')}
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                {history.map((record) => {
                  const key = recordKey(record);
                  const isSelected = selectedKeys.has(key);
                  const isDisabled = !isSelected && selectedKeys.size >= MAX_COMPARE_RECORDS;
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50' : isDisabled ? 'opacity-40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleRecord(record)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">{record.conditionDate}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {record.staffName}
                          <span className="font-mono ml-1">({record.manageCode})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">{record.totalPosted}/{record.totalSheets}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Compare button */}
            {selectedKeys.size > 0 && (
              <div className="px-3 py-2.5 border-t border-slate-100">
                <button
                  onClick={compareGps}
                  disabled={loadingGps}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {loadingGps ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('compare_loading')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-map"></i>
                      {t('compare_button')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right: Map */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {!isLoaded ? (
              <div className="flex items-center justify-center h-[500px]">
                <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : trajectories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-slate-400">
                <i className="bi bi-map text-4xl mb-3"></i>
                <p className="text-xs">{t('map_no_data')}</p>
              </div>
            ) : (
              <>
                {partialError && (
                  <div className="px-3 py-1.5 bg-amber-50 text-amber-700 text-[10px] font-bold border-b border-amber-200">
                    <i className="bi bi-exclamation-triangle mr-1"></i>
                    {t('compare_partial_error')}
                  </div>
                )}
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER}
                  center={mapCenter}
                  zoom={15}
                  options={{ mapTypeControl: false, streetViewControl: false }}
                >
                  {areaPaths.map((path, i) => (
                    <Polygon
                      key={`area-${i}`}
                      paths={path}
                      options={{
                        fillColor: '#6366f1',
                        fillOpacity: 0.08,
                        strokeColor: '#6366f1',
                        strokeOpacity: 0.5,
                        strokeWeight: 2,
                      }}
                    />
                  ))}

                  {/* Speed-colored segments for each trajectory */}
                  {trajectories.map((traj) => {
                    const segments = computeSpeedSegments(traj.gpsPoints);
                    // Group consecutive segments with same color for fewer Polyline components
                    const grouped: { path: { lat: number; lng: number }[]; color: string }[] = [];
                    for (const seg of segments) {
                      const last = grouped[grouped.length - 1];
                      if (last && last.color === seg.color) {
                        last.path.push(seg.to);
                      } else {
                        grouped.push({ path: [seg.from, seg.to], color: seg.color });
                      }
                    }
                    return grouped.map((g, i) => (
                      <Polyline
                        key={`${traj.key}-seg-${i}`}
                        path={g.path}
                        options={{
                          strokeColor: g.color,
                          strokeOpacity: 0.85,
                          strokeWeight: 3,
                        }}
                      />
                    ));
                  })}
                </GoogleMap>

                {/* Legend: speed colors + distributor list */}
                <div className="px-3 py-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-[10px] font-bold text-slate-500">{t('legend_title')}:</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                      <span className="w-4 h-1 rounded inline-block" style={{ background: SPEED_COLORS.posting }} />
                      〜{SPEED_THRESHOLDS.posting} km/h
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                      <span className="w-4 h-1 rounded inline-block" style={{ background: SPEED_COLORS.slowWalk }} />
                      〜{SPEED_THRESHOLDS.slowWalk} km/h
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                      <span className="w-4 h-1 rounded inline-block" style={{ background: SPEED_COLORS.normalWalk }} />
                      〜{SPEED_THRESHOLDS.normalWalk} km/h
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                      <span className="w-4 h-1 rounded inline-block" style={{ background: SPEED_COLORS.fast }} />
                      {SPEED_THRESHOLDS.normalWalk}+ km/h
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trajectories.map((traj) => (
                      <span key={traj.key} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                        {traj.staffName} ({traj.date})
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
