'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import IndicatorBadges, { type IndicatorData } from './IndicatorBadges';

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
  const [showPastTrajectory, setShowPastTrajectory] = useState(false);
  const [pastTrajectories, setPastTrajectories] = useState<any[]>([]);

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
        if (data?.pastSessions) setPastTrajectories(data.pastSessions);
      })
      .catch(() => {});
  }, [showPastTrajectory, scheduleId]);

  const startPoint = trajData?.gpsPoints?.[0] ?? null;
  const endPoint =
    trajData?.gpsPoints && trajData.gpsPoints.length > 1
      ? trajData.gpsPoints[trajData.gpsPoints.length - 1]
      : null;

  /* ---- Fit bounds to area polygon (priority) or GPS points ---- */
  useEffect(() => {
    if (!mapRef.current) return;

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

    // Priority: fit to area polygon
    if (areaGeoJson) {
      const extractCoords = (geojson: any): number[][] => {
        const coords: number[][] = [];
        const features = geojson.features || [geojson];
        for (const f of features) {
          const geom = f.geometry || f;
          if (geom.type === 'Polygon') {
            coords.push(...geom.coordinates[0]);
          } else if (geom.type === 'MultiPolygon') {
            for (const poly of geom.coordinates) coords.push(...poly[0]);
          }
        }
        return coords;
      };
      const coords = extractCoords(areaGeoJson);
      for (const [lng, lat] of coords) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
    }

    // Fallback: fit to GPS points
    if (minLat === Infinity && trajData?.gpsPoints?.length) {
      for (const p of trajData.gpsPoints) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }
    }

    if (minLat !== Infinity) {
      mapRef.current.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 40, duration: 500, maxZoom: 17 }
      );
    }
  }, [areaGeoJson, trajData?.gpsPoints]);

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
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto p-4">
      {/* ---- Map ---- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ height: 300 }}>
        <Map
          ref={mapRef}
          initialViewState={{ ...center, zoom: 14 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
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

          {/* Speed-colored trajectory segments */}
          {speedSegments && speedSegments.features.length > 0 && (
            <Source id="speed-segments" type="geojson" data={speedSegments}>
              <Layer
                id="speed-line"
                type="line"
                paint={{
                  'line-color': ['get', 'color'],
                  'line-width': 3,
                  'line-opacity': 0.85,
                }}
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

          {/* Past trajectories */}
          {showPastTrajectory && pastTrajectories.map((past, idx) => {
            const pastGeoJson: GeoJSON.FeatureCollection = {
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: (past.gpsPoints || []).map((p: any) => [p.longitude || p.lng, p.latitude || p.lat]),
                },
              }],
            };
            return (
              <Source key={`past-${idx}`} id={`past-traj-${idx}`} type="geojson" data={pastGeoJson}>
                <Layer
                  id={`past-traj-line-${idx}`}
                  type="line"
                  paint={{
                    'line-color': '#94a3b8',
                    'line-width': 2,
                    'line-opacity': 0.4,
                    'line-dasharray': [2, 2],
                  }}
                />
              </Source>
            );
          })}

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
      </div>

      {/* Speed legend */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[10px] text-slate-400">速度:</span>
        {[
          { color: '#ef4444', label: '~1.5km/h' },
          { color: '#f97316', label: '~3.5km/h' },
          { color: '#22c55e', label: '~5.0km/h' },
          { color: '#3b82f6', label: '5.0km/h~' },
        ].map((l) => (
          <div key={l.color} className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Map toggle buttons */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
            showHeatmap ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <i className="bi bi-fire mr-1" />ヒートマップ
        </button>
        <button
          onClick={() => setShowPastTrajectory(!showPastTrajectory)}
          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
            showPastTrajectory ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <i className="bi bi-clock-history mr-1" />過去比較
        </button>
      </div>

      {/* ---- Indicators ---- */}
      {loadingInd && !indicators ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
        </div>
      ) : indicators ? (
        <IndicatorBadges indicators={indicators} />
      ) : (
        <div className="text-center text-sm text-slate-400 py-4">指標データなし</div>
      )}

      {/* ---- Verdict section ---- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
        {/* Current status */}
        {currentResult && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-500">判定済み:</span>
            {currentResult === 'OK' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700">
                <i className="bi bi-check-circle-fill" /> OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700">
                <i className="bi bi-x-circle-fill" /> NG
              </span>
            )}
          </div>
        )}

        {/* Verdict buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleVerdict('OK')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            <i className="bi bi-check-lg" />
            OK
          </button>
          <button
            onClick={() => handleVerdict('NG')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            <i className="bi bi-x-lg" />
            NG
          </button>
        </div>

        {/* Comment textarea (shown for NG) */}
        {showComment && (
          <div className="space-y-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="NGの理由を入力..."
              rows={3}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
            <button
              onClick={() => handleVerdict('NG')}
              disabled={saving}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : 'NGで保存'}
            </button>
          </div>
        )}

        {/* Detail link */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={() => window.open(`/schedules?trajectory=${scheduleId}`, '_blank')}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
          >
            <i className="bi bi-map" />
            詳細GPS画面
            <i className="bi bi-box-arrow-up-right text-[10px]" />
          </button>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 disabled:text-slate-300 disabled:cursor-not-allowed"
          >
            <i className="bi bi-chevron-left" />
            前へ
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 disabled:text-slate-300 disabled:cursor-not-allowed"
          >
            次へ
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
}
