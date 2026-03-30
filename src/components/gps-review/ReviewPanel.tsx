'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import IndicatorBadges, { type IndicatorData } from './IndicatorBadges';
import { useTranslation } from '@/i18n';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: string;
}

interface TrajectoryData {
  session: {
    id: number;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  gpsPoints: GpsPoint[];
  area: {
    boundaryGeojson: string;
    townName: string;
    chomeName: string;
  } | null;
  schedule: {
    id: number;
    date: string;
    status: string;
    distributorName: string;
    distributorStaffId: string;
    checkGps?: boolean;
    checkGpsResult?: string | null;
    checkGpsComment?: string | null;
  };
}

interface ScheduleItem {
  id: number;
  checkGps: boolean;
  checkGpsResult: string | null;
  checkGpsComment: string | null;
}

interface Props {
  scheduleId: number;
  onVerdictSaved: (updated: ScheduleItem) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

/* ------------------------------------------------------------------ */
/*  GeoJSON parser                                                     */
/* ------------------------------------------------------------------ */

const parseAreaGeoJson = (geojsonStr: string): GeoJSON.FeatureCollection | null => {
  if (!geojsonStr) return null;
  const trimmed = geojsonStr.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.type === 'FeatureCollection') return parsed;
    if (parsed.type === 'Feature') return { type: 'FeatureCollection', features: [parsed] };
    if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
      return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: parsed }] };
    }
    return null;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Speed helpers                                                      */
/* ------------------------------------------------------------------ */

const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const PAST_COLORS = ['#a855f7', '#14b8a6', '#f59e0b', '#6366f1', '#f43f5e'];

const SPEED_THRESHOLDS = { posting: 1.5, slowWalk: 3.5, normalWalk: 5.0 };
const SPEED_COLORS: Record<string, string> = {
  posting: '#ef4444',
  slowWalk: '#f97316',
  normalWalk: '#22c55e',
  fast: '#3b82f6',
};

function speedToColor(kmh: number): string {
  if (kmh <= SPEED_THRESHOLDS.posting) return SPEED_COLORS.posting;
  if (kmh <= SPEED_THRESHOLDS.slowWalk) return SPEED_COLORS.slowWalk;
  if (kmh <= SPEED_THRESHOLDS.normalWalk) return SPEED_COLORS.normalWalk;
  return SPEED_COLORS.fast;
}

/* ------------------------------------------------------------------ */
/*  Point-in-polygon (ray casting)                                     */
/* ------------------------------------------------------------------ */

/** polygon coords are GeoJSON [lng, lat] pairs */
function isPointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pLng_i = polygon[i][0], pLat_i = polygon[i][1];
    const pLng_j = polygon[j][0], pLat_j = polygon[j][1];
    const intersect = ((pLat_i > lat) !== (pLat_j > lat)) &&
      (lng < (pLng_j - pLng_i) * (lat - pLat_i) / (pLat_j - pLat_i) + pLng_i);
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildSpeedSegments(points: GpsPoint[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (points.length < 2) return { type: 'FeatureCollection', features };

  for (let i = 1; i < points.length; i++) {
    const distM = haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    const dtSec = Math.max(
      (new Date(points[i].timestamp).getTime() - new Date(points[i - 1].timestamp).getTime()) / 1000,
      0.1
    );
    const speedKmh = Math.min((distM / dtSec) * 3.6, 30);
    features.push({
      type: 'Feature',
      properties: { color: speedToColor(speedKmh) },
      geometry: {
        type: 'LineString',
        coordinates: [
          [points[i - 1].lng, points[i - 1].lat],
          [points[i].lng, points[i].lat],
        ],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReviewPanel({
  scheduleId,
  onVerdictSaved,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const { t } = useTranslation('gps-review');

  /* ---- State ---- */
  const [trajData, setTrajData] = useState<TrajectoryData | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [loadingTraj, setLoadingTraj] = useState(false);
  const [loadingInd, setLoadingInd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSpeedColors, setShowSpeedColors] = useState(false);
  const [showPastTrajectory, setShowPastTrajectory] = useState(false);
  const [pastTrajectories, setPastTrajectories] = useState<any[]>([]);
  const [selectedPastIndex, setSelectedPastIndex] = useState<number | null>(null);

  /* ---- Fetch trajectory ---- */
  const fetchTrajectory = useCallback(async () => {
    setLoadingTraj(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/trajectory`);
      if (res.ok) {
        const data = await res.json();
        setTrajData(data);
        setCurrentResult(data.schedule?.checkGpsResult ?? null);
        setComment(data.schedule?.checkGpsComment ?? '');
        setShowComment(
          data.schedule?.checkGpsResult === 'NG' || false
        );
      }
    } catch (err) {
      console.error('Fetch trajectory error:', err);
    } finally {
      setLoadingTraj(false);
    }
  }, [scheduleId]);

  /* ---- Fetch indicators ---- */
  const fetchIndicators = useCallback(async () => {
    setLoadingInd(true);
    try {
      const res = await fetch(`/api/gps-review/${scheduleId}/indicators`);
      if (res.ok) {
        const data = await res.json();
        setIndicators(data);
      }
    } catch (err) {
      console.error('Fetch indicators error:', err);
    } finally {
      setLoadingInd(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    fetchTrajectory();
    fetchIndicators();
  }, [fetchTrajectory, fetchIndicators]);

  /* ---- Map data ---- */
  const speedSegments = useMemo(
    () => (trajData?.gpsPoints ? buildSpeedSegments(trajData.gpsPoints) : null),
    [trajData?.gpsPoints]
  );

  const areaGeoJson = useMemo(
    () => (trajData?.area?.boundaryGeojson ? parseAreaGeoJson(trajData.area.boundaryGeojson) : null),
    [trajData?.area?.boundaryGeojson]
  );

  const pinkLineGeoJson = useMemo(() => {
    if (!trajData?.gpsPoints?.length || trajData.gpsPoints.length < 2) return null;
    const coordinates = trajData.gpsPoints.map(p => [p.lng, p.lat]);
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates },
      }],
    };
  }, [trajData?.gpsPoints]);

  const areaPolygonCoords = useMemo(() => {
    if (!areaGeoJson) return null;
    const features = areaGeoJson.features || [];
    for (const f of features) {
      const geom = f.geometry;
      if (geom?.type === 'Polygon') return (geom as any).coordinates[0];
      if (geom?.type === 'MultiPolygon') return (geom as any).coordinates[0][0];
    }
    return null;
  }, [areaGeoJson]);

  // Realtime coverage: % of GPS points inside area polygon
  const realtimeCoverage = useMemo(() => {
    if (!areaPolygonCoords || !trajData?.gpsPoints?.length) return null;
    const total = trajData.gpsPoints.length;
    const inside = trajData.gpsPoints.filter(p => isPointInPolygon(p.lat, p.lng, areaPolygonCoords)).length;
    return Math.round((inside / total) * 100);
  }, [areaPolygonCoords, trajData?.gpsPoints]);

  const heatmapGeoJson = useMemo(() => {
    if (!trajData?.gpsPoints?.length) return null;
    const features = trajData.gpsPoints.map((p, i, arr) => {
      let weight = 1;
      if (i > 0) {
        const dtSec = Math.max((new Date(p.timestamp).getTime() - new Date(arr[i-1].timestamp).getTime()) / 1000, 0.1);
        const distM = haversineM(arr[i-1].lat, arr[i-1].lng, p.lat, p.lng);
        const speedKmh = (distM / dtSec) * 3.6;
        weight = speedKmh < 2 ? 3 : speedKmh < 4 ? 2 : 1;
      }
      return {
        type: 'Feature' as const,
        properties: { weight },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      };
    });
    return { type: 'FeatureCollection' as const, features };
  }, [trajData?.gpsPoints]);

  useEffect(() => {
    if (!showPastTrajectory || !scheduleId || pastTrajectories.length > 0) return;
    fetch(`/api/schedules/${scheduleId}/trajectory/past-area?limit=5`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.pastTrajectories) {
          setPastTrajectories(data.pastTrajectories);
          setSelectedPastIndex(null);
        }
      })
      .catch(() => {});
  }, [showPastTrajectory, scheduleId]);

  const startPoint = trajData?.gpsPoints?.[0] ?? null;
  const endPoint =
    trajData?.gpsPoints && trajData.gpsPoints.length > 1
      ? trajData.gpsPoints[trajData.gpsPoints.length - 1]
      : null;

  /* ---- Fit bounds to area polygon (priority) or GPS points ---- */
  const fitMapBounds = useCallback(() => {
    if (!mapRef.current) return;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    if (areaGeoJson) {
      const extractCoords = (geojson: any): number[][] => {
        const coords: number[][] = [];
        const features = geojson.features || [geojson];
        for (const f of features) {
          const geom = f.geometry || f;
          if (geom.type === 'Polygon') coords.push(...geom.coordinates[0]);
          else if (geom.type === 'MultiPolygon') for (const poly of geom.coordinates) coords.push(...poly[0]);
        }
        return coords;
      };
      for (const [lng, lat] of extractCoords(areaGeoJson)) {
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      }
    }
    if (minLat === Infinity && trajData?.gpsPoints?.length) {
      for (const p of trajData.gpsPoints) {
        if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng; if (p.lng > maxLng) maxLng = p.lng;
      }
    }
    if (minLat !== Infinity) {
      mapRef.current.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, duration: 500, maxZoom: 17 });
    }
  }, [areaGeoJson, trajData?.gpsPoints]);

  // Fit on data change
  useEffect(() => { fitMapBounds(); }, [fitMapBounds]);

  /* ---- Save verdict ---- */
  const handleVerdict = async (result: 'OK' | 'NG') => {
    if (result === 'NG' && !showComment) {
      setShowComment(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/gps-review/${scheduleId}/verdict`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, comment: result === 'NG' ? comment : '' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentResult(result);
        onVerdictSaved(updated);
      }
    } catch (err) {
      console.error('Save verdict error:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ---- Loading state ---- */
  if (loadingTraj && !trajData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const defaultCenter = { latitude: 35.6812, longitude: 139.7671 };
  const center = startPoint
    ? { latitude: startPoint.lat, longitude: startPoint.lng }
    : defaultCenter;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ---- Map (fills available space) ---- */}
      <div className="flex-1 min-h-0 relative">
        <Map
          ref={mapRef}
          initialViewState={{ ...center, zoom: 14 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          onLoad={fitMapBounds}
        >
          <NavigationControl position="top-right" />

          {/* Area polygon */}
          {areaGeoJson && (
            <Source id="area-polygon" type="geojson" data={areaGeoJson}>
              <Layer
                id="area-fill"
                type="fill"
                paint={{ 'fill-color': '#6366f1', 'fill-opacity': 0.12 }}
              />
              <Layer
                id="area-outline"
                type="line"
                paint={{ 'line-color': '#6366f1', 'line-width': 2, 'line-opacity': 0.6 }}
              />
            </Source>
          )}

          {/* Trajectory: both layers always mounted, toggle visibility */}
          {pinkLineGeoJson && (
            <Source id="pink-line" type="geojson" data={pinkLineGeoJson}>
              <Layer
                id="pink-line-layer"
                type="line"
                layout={{ visibility: showSpeedColors ? 'none' : 'visible' }}
                paint={{ 'line-color': '#ec4899', 'line-width': 3, 'line-opacity': 0.85 }}
              />
            </Source>
          )}
          {speedSegments && speedSegments.features.length > 0 && (
            <Source id="speed-segments" type="geojson" data={speedSegments}>
              <Layer
                id="speed-line"
                type="line"
                layout={{ visibility: showSpeedColors ? 'visible' : 'none' }}
                paint={{ 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.85 }}
              />
            </Source>
          )}

          {/* Heatmap layer */}
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
                    0, 'rgba(33,102,172,0)',
                    0.2, 'rgb(103,169,207)',
                    0.4, 'rgb(209,229,240)',
                    0.6, 'rgb(253,219,199)',
                    0.8, 'rgb(239,138,98)',
                    1, 'rgb(178,24,43)',
                  ],
                  'heatmap-opacity': 0.7,
                }}
              />
            </Source>
          )}

          {/* Past trajectory (single selection, area-filtered) */}
          {showPastTrajectory && selectedPastIndex !== null && pastTrajectories[selectedPastIndex] && (() => {
            const past = pastTrajectories[selectedPastIndex];
            const coords = (past.gpsPoints || []).map((p: any) => [p.longitude || p.lng, p.latitude || p.lat]).filter((c: number[]) => c[0] && c[1]);
            const filteredCoords = coords.filter(([lng, lat]: number[]) =>
              areaPolygonCoords ? isPointInPolygon(lat, lng, areaPolygonCoords) : true
            );
            if (filteredCoords.length < 2) return null;
            const pastGeoJson: GeoJSON.FeatureCollection = {
              type: 'FeatureCollection',
              features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: filteredCoords } }],
            };
            return (
              <Source key={`past-${selectedPastIndex}`} id={`past-traj-${selectedPastIndex}`} type="geojson" data={pastGeoJson}>
                <Layer
                  id={`past-traj-line-${selectedPastIndex}`}
                  type="line"
                  paint={{
                    'line-color': '#0ea5e9',
                    'line-width': 2.5,
                    'line-opacity': 0.6,
                  }}
                />
              </Source>
            );
          })()}

          {/* Start marker */}
          {startPoint && (
            <Marker latitude={startPoint.lat} longitude={startPoint.lng} anchor="center">
              <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">S</span>
              </div>
            </Marker>
          )}

          {/* End marker */}
          {endPoint && (
            <Marker latitude={endPoint.lat} longitude={endPoint.lng} anchor="center">
              <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">E</span>
              </div>
            </Marker>
          )}
        </Map>

        {/* Map overlay controls (top-left) */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-10">
          <button onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-2 py-1 text-[10px] font-bold rounded-md shadow-sm backdrop-blur-sm transition-colors ${
              showHeatmap ? 'bg-orange-500 text-white' : 'bg-white/90 text-slate-600 hover:bg-white'}`}>
            <i className="bi bi-fire mr-0.5" />{t('heatmap')}
          </button>
          <button onClick={() => setShowSpeedColors(!showSpeedColors)}
            className={`px-2 py-1 text-[10px] font-bold rounded-md shadow-sm backdrop-blur-sm transition-colors ${
              showSpeedColors ? 'bg-blue-500 text-white' : 'bg-white/90 text-slate-600 hover:bg-white'}`}>
            <i className="bi bi-speedometer2 mr-0.5" />{t('movement_speed')}
          </button>
          <button onClick={() => { setShowPastTrajectory(!showPastTrajectory); if (showPastTrajectory) setSelectedPastIndex(null); }}
            className={`px-2 py-1 text-[10px] font-bold rounded-md shadow-sm backdrop-blur-sm transition-colors ${
              showPastTrajectory ? 'bg-indigo-500 text-white' : 'bg-white/90 text-slate-600 hover:bg-white'}`}>
            <i className="bi bi-clock-history mr-0.5" />{t('past_comparison')}
          </button>
          {/* Past trajectory date chips (radio-button style) */}
          {showPastTrajectory && pastTrajectories.length > 0 && pastTrajectories.map((past, idx) => {
            const d = new Date(past.date);
            const label = `${d.getMonth() + 1}/${d.getDate()} ${past.distributorName?.split(' ')[0] || ''}`;
            const selected = selectedPastIndex === idx;
            const color = '#0ea5e9';
            return (
              <button key={idx} onClick={() => {
                setSelectedPastIndex(prev => prev === idx ? null : idx);
              }}
                className={`px-2 py-1 text-[10px] font-bold rounded-md shadow-sm backdrop-blur-sm transition-colors ${
                  selected ? 'text-white' : 'bg-white/90 text-slate-500'}`}
                style={selected ? { backgroundColor: color } : {}}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Speed legend overlay (bottom-left) — only when speed coloring is on */}
        {showSpeedColors && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-sm z-10">
            {[
              { color: '#ef4444', label: '~1.5' },
              { color: '#f97316', label: '~3.5' },
              { color: '#22c55e', label: '~5.0' },
              { color: '#3b82f6', label: '5.0~' },
            ].map(l => (
              <div key={l.color} className="flex items-center gap-0.5">
                <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: l.color }} />
                <span className="text-[9px] text-slate-500">{l.label}</span>
              </div>
            ))}
            <span className="text-[9px] text-slate-400">km/h</span>
          </div>
        )}
      </div>

      {/* ---- Compact bottom bar: indicators + verdict ---- */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2 space-y-2">
        {/* Indicators inline */}
        <div className="flex items-center gap-3 text-[11px]">
          {indicators ? (
            <>
              <div className="flex items-center gap-1">
                <i className="bi bi-bar-chart-fill text-slate-400" />
                <span className="text-slate-500">{t('indicator_coverage')}</span>
                <span className="font-bold text-slate-800">
                  {indicators.coverage?.currentInsideRatio != null ? `${Math.round(indicators.coverage.currentInsideRatio * 100)}%` : indicators.coverage?.diffPercent != null ? `${indicators.coverage.diffPercent > 0 ? '+' : ''}${indicators.coverage.diffPercent}%` : realtimeCoverage != null ? `${realtimeCoverage}%` : '--'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <i className="bi bi-speedometer text-slate-400" />
                <span className="text-slate-500">{t('speed_label')}</span>
                <span className="font-bold text-slate-800">{indicators.speed?.currentSpeed != null ? `${Math.round(indicators.speed.currentSpeed)}${t('sheets_per_hour')}` : '--'}</span>
              </div>
              <div className="flex items-center gap-1">
                <i className="bi bi-lightning text-slate-400" />
                <span className="text-slate-500">{t('movement_label')}</span>
                <span className="font-bold text-slate-800">{indicators.fastMove?.fastRatio != null ? `${Math.round(indicators.fastMove.fastRatio * 100)}%` : '--'}</span>
              </div>
              {indicators.auxiliary?.outOfAreaWarning && (
                <span className="text-[10px] font-bold text-amber-600"><i className="bi bi-exclamation-triangle mr-0.5" />{t('indicator_out_of_area')}{Math.round(indicators.auxiliary.outOfAreaPct)}%</span>
              )}
            </>
          ) : loadingInd ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
          ) : (
            <span className="text-slate-400">{t('no_indicator_data')}</span>
          )}
          <div className="ml-auto">
            <button onClick={() => window.open(`/schedules?trajectory=${scheduleId}`, '_blank')}
              className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-0.5">
              <i className="bi bi-map" />{t('detail')}<i className="bi bi-box-arrow-up-right text-[8px]" />
            </button>
          </div>
        </div>

        {/* Past comparison stats */}
        {showPastTrajectory && selectedPastIndex !== null && pastTrajectories[selectedPastIndex] && (() => {
          const past = pastTrajectories[selectedPastIndex];
          const d = new Date(past.date);
          const pastLabel = `${d.getMonth() + 1}/${d.getDate()} ${past.distributorName?.split(' ')[0] || ''}`;
          const pastSheets = past.totalSheets ?? 0;
          const pastGps = past.gpsPoints || [];
          let pastSpeed = 0;
          if (pastGps.length >= 2 && pastSheets > 0) {
            const pastStart = new Date(pastGps[0].timestamp || pastGps[0].recordedAt).getTime();
            const pastEnd = new Date(pastGps[pastGps.length - 1].timestamp || pastGps[pastGps.length - 1].recordedAt).getTime();
            const pastHours = Math.max((pastEnd - pastStart) / 3600000, 0.01);
            pastSpeed = Math.round(pastSheets / pastHours);
          }
          const currentGps = trajData?.gpsPoints || [];
          let currentSheets = 0;
          let currentSpeed = 0;
          if (indicators?.speed?.currentSpeed) {
            currentSpeed = Math.round(indicators.speed.currentSpeed);
          }
          // Try to get current sheets from trajectory session or indicators
          if (currentGps.length >= 2 && currentSpeed > 0) {
            const cStart = new Date(currentGps[0].timestamp).getTime();
            const cEnd = new Date(currentGps[currentGps.length - 1].timestamp).getTime();
            const cHours = Math.max((cEnd - cStart) / 3600000, 0.01);
            currentSheets = Math.round(currentSpeed * cHours);
          }
          return (
            <div className="flex items-center gap-2 text-[10px] bg-indigo-50 rounded-md px-2 py-1">
              <i className="bi bi-arrow-left-right text-indigo-500" />
              <span className="text-indigo-700 font-bold">{t('past_label')} {pastLabel}:</span>
              <span className="text-slate-700">{pastSheets}{t('sheets_unit')} {pastSpeed}{t('sheets_per_hour')}</span>
              <span className="text-slate-400">|</span>
              <span className="text-pink-700 font-bold">{t('current_label')}:</span>
              <span className="text-slate-700">{currentSheets > 0 ? `${currentSheets}${t('sheets_unit')}` : '--'} {currentSpeed > 0 ? `${currentSpeed}${t('sheets_per_hour')}` : '--'}</span>
            </div>
          );
        })()}

        {/* Verdict row */}
        <div className="flex items-center gap-2">
          {currentResult && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
              currentResult === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              <i className={`bi ${currentResult === 'OK' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />{currentResult}
            </span>
          )}
          <button onClick={() => handleVerdict('OK')} disabled={saving}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">
            <i className="bi bi-check-lg mr-0.5" />OK
          </button>
          <button onClick={() => handleVerdict('NG')} disabled={saving}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">
            <i className="bi bi-x-lg mr-0.5" />NG
          </button>
          {showComment && (
            <>
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder={t('ng_reason_short')}
                className="flex-1 border border-slate-300 rounded-lg text-xs px-2 py-1.5 outline-none focus:ring-1 focus:ring-red-400" />
              <button onClick={() => handleVerdict('NG')} disabled={saving || !comment.trim()}
                className="px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                {saving ? '...' : t('save')}
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={onPrev} disabled={!hasPrev} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:text-slate-200 disabled:hover:bg-transparent">
              <i className="bi bi-chevron-left text-sm" />
            </button>
            <button onClick={onNext} disabled={!hasNext} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:text-slate-200 disabled:hover:bg-transparent">
              <i className="bi bi-chevron-right text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
