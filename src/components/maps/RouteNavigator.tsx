'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { LayerProps } from 'react-map-gl/mapbox';
import type { FeatureCollection, LineString } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';

// ============================================================
// Types
// ============================================================
interface Waypoint {
  lat: number;
  lng: number;
  label?: string;
}

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  location: [number, number]; // [lng, lat]
}

interface RouteData {
  geometry: LineString;
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
}

interface Props {
  waypoints: Waypoint[];
  profile?: 'walking' | 'cycling' | 'driving';
  optimize?: boolean;
  onClose: () => void;
}

// ============================================================
// Helpers
// ============================================================
function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}時間${mins}分`;
  return `${mins}分`;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Layer styles
const routeLineLayer: LayerProps = {
  id: 'route-line',
  type: 'line',
  paint: {
    'line-color': '#3b82f6',
    'line-width': 5,
    'line-opacity': 0.85,
  },
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
};

const routeLineOutlineLayer: LayerProps = {
  id: 'route-line-outline',
  type: 'line',
  paint: {
    'line-color': '#1e40af',
    'line-width': 8,
    'line-opacity': 0.3,
  },
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
};

const stepDotLayer: LayerProps = {
  id: 'step-dots',
  type: 'circle',
  paint: {
    'circle-radius': 4,
    'circle-color': '#ffffff',
    'circle-stroke-color': '#3b82f6',
    'circle-stroke-width': 2,
  },
};

// Marker colors
const MARKER_COLORS = {
  start: '#22c55e',
  end: '#ef4444',
  waypoint: '#3b82f6',
};

// ============================================================
// Component
// ============================================================
export default function RouteNavigator({
  waypoints: initialWaypoints,
  profile = 'walking',
  optimize = false,
  onClose,
}: Props) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);
  const [isOptimized, setIsOptimized] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(profile);
  const stepListRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Calculate initial viewport to fit all waypoints
  const initialViewState = useMemo(() => {
    if (waypoints.length === 0) {
      return { latitude: 35.68, longitude: 139.76, zoom: 12 };
    }
    const lats = waypoints.map(w => w.lat);
    const lngs = waypoints.map(w => w.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    return { latitude: centerLat, longitude: centerLng, zoom: 13 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Fetch directions ----
  const fetchRoute = useCallback(async (wps: Waypoint[], prof: string) => {
    if (wps.length < 2) return;
    setLoading(true);
    setError(null);

    try {
      const coordinates = wps.map(w => [w.lng, w.lat]);
      const res = await fetch('/api/mapbox/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, profile: prof }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const r = data.routes[0];
      const steps: RouteStep[] = [];
      for (const leg of r.legs) {
        for (const step of leg.steps) {
          steps.push({
            instruction: step.maneuver?.instruction || '',
            distance: step.distance,
            duration: step.duration,
            location: step.maneuver?.location || [0, 0],
          });
        }
      }

      setRoute({
        geometry: r.geometry,
        distance: r.distance,
        duration: r.duration,
        steps,
      });
      setActiveStepIdx(null);
    } catch (err) {
      console.error('Route fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch route');
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- Optimize route ----
  const optimizeRoute = useCallback(async () => {
    if (waypoints.length < 3) return;
    setLoading(true);
    setError(null);

    try {
      const coordinates = waypoints.map(w => [w.lng, w.lat]);
      const res = await fetch('/api/mapbox/optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates, profile: currentProfile, roundtrip: false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.trips || data.trips.length === 0) {
        throw new Error('No optimized route found');
      }

      // Reorder waypoints based on optimization result
      const trip = data.trips[0];
      const waypointOrder: number[] = data.waypoints.map((wp: { waypoint_index: number }) => wp.waypoint_index);
      const reordered = waypointOrder.map((idx: number) => waypoints[idx]);

      setWaypoints(reordered);
      setIsOptimized(true);

      // Use the optimized route geometry directly
      const steps: RouteStep[] = [];
      for (const leg of trip.legs) {
        if (leg.steps) {
          for (const step of leg.steps) {
            steps.push({
              instruction: step.maneuver?.instruction || '',
              distance: step.distance,
              duration: step.duration,
              location: step.maneuver?.location || [0, 0],
            });
          }
        }
      }

      setRoute({
        geometry: trip.geometry,
        distance: trip.distance,
        duration: trip.duration,
        steps,
      });
      setActiveStepIdx(null);
    } catch (err) {
      console.error('Optimization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to optimize route');
    } finally {
      setLoading(false);
    }
  }, [waypoints, currentProfile]);

  // Fetch route on mount or profile change
  useEffect(() => {
    fetchRoute(waypoints, currentProfile);
  }, [currentProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch
  useEffect(() => {
    if (optimize && waypoints.length >= 3) {
      optimizeRoute();
    } else {
      fetchRoute(waypoints, currentProfile);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Step click handler ----
  const handleStepClick = useCallback((idx: number) => {
    setActiveStepIdx(idx);
    if (route && route.steps[idx]) {
      const [lng, lat] = route.steps[idx].location;
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 800 });
    }
  }, [route]);

  // ---- Build GeoJSON for route line ----
  const routeGeoJson: FeatureCollection | null = useMemo(() => {
    if (!route) return null;
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: route.geometry,
      }],
    };
  }, [route]);

  // ---- Build GeoJSON for step dots ----
  const stepDotsGeoJson: FeatureCollection | null = useMemo(() => {
    if (!route || route.steps.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: route.steps
        .filter(s => s.location[0] !== 0 && s.location[1] !== 0)
        .map((s, idx) => ({
          type: 'Feature' as const,
          properties: { index: idx },
          geometry: { type: 'Point' as const, coordinates: s.location },
        })),
    };
  }, [route]);

  // ---- Profile label ----
  const profileLabel = (p: string) => {
    switch (p) {
      case 'walking': return '徒歩';
      case 'cycling': return '自転車';
      case 'driving': return '車';
      default: return p;
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      background: '#f8fafc',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0',
        minHeight: 52,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            ルートナビゲーション
          </h2>
          {route && (
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {formatDistance(route.distance)} / {formatDuration(route.duration)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Profile selector */}
          <div style={{
            display: 'flex', borderRadius: 6, overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}>
            {(['walking', 'cycling', 'driving'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentProfile(p)}
                style={{
                  padding: '4px 10px', fontSize: 12, border: 'none', cursor: 'pointer',
                  background: currentProfile === p ? '#3b82f6' : '#fff',
                  color: currentProfile === p ? '#fff' : '#374151',
                }}
              >
                {profileLabel(p)}
              </button>
            ))}
          </div>

          {/* Optimize button */}
          {waypoints.length >= 3 && (
            <button
              onClick={optimizeRoute}
              disabled={loading}
              style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 6,
                border: '1px solid #e2e8f0', cursor: loading ? 'not-allowed' : 'pointer',
                background: isOptimized ? '#dcfce7' : '#fff',
                color: isOptimized ? '#166534' : '#374151',
              }}
            >
              {isOptimized ? 'ルート最適化済' : 'ルート最適化'}
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px', fontSize: 13, borderRadius: 6,
              border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
              color: '#374151',
            }}
          >
            閉じる
          </button>
        </div>
      </div>

      {/* Map + Instruction Panel */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1 }}>
          <Map
            ref={mapRef}
            initialViewState={initialViewState}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" />

            {/* Route outline + line */}
            {routeGeoJson && (
              <Source id="route-source" type="geojson" data={routeGeoJson}>
                <Layer {...routeLineOutlineLayer} />
                <Layer {...routeLineLayer} />
              </Source>
            )}

            {/* Step dots */}
            {stepDotsGeoJson && (
              <Source id="step-dots-source" type="geojson" data={stepDotsGeoJson}>
                <Layer {...stepDotLayer} />
              </Source>
            )}

            {/* Waypoint markers */}
            {waypoints.map((wp, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === waypoints.length - 1;
              const color = isStart ? MARKER_COLORS.start : isEnd ? MARKER_COLORS.end : MARKER_COLORS.waypoint;
              const num = idx + 1;

              return (
                <Marker key={`wp-${idx}`} latitude={wp.lat} longitude={wp.lng} anchor="center">
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    transform: 'translateY(-12px)',
                  }}>
                    {/* Numbered circle */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      border: '2.5px solid #fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }}>
                      {num}
                    </div>
                    {/* Label */}
                    {wp.label && (
                      <div style={{
                        marginTop: 2, padding: '1px 6px', borderRadius: 3,
                        background: 'rgba(255,255,255,0.9)', fontSize: 10,
                        whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {wp.label}
                      </div>
                    )}
                  </div>
                </Marker>
              );
            })}

            {/* Active step marker */}
            {activeStepIdx !== null && route && route.steps[activeStepIdx] && (
              <Marker
                latitude={route.steps[activeStepIdx].location[1]}
                longitude={route.steps[activeStepIdx].location[0]}
                anchor="center"
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#f59e0b', border: '3px solid #fff',
                  boxShadow: '0 0 8px rgba(245,158,11,0.6)',
                }} />
              </Marker>
            )}
          </Map>

          {/* Loading overlay */}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.5)', zIndex: 10,
            }}>
              <div style={{
                padding: '8px 20px', background: '#fff', borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: 14,
              }}>
                読み込み中...
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(220,38,38,0.9)', color: '#fff',
              padding: '6px 16px', borderRadius: 6, fontSize: 13, zIndex: 10,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Turn-by-turn instructions panel */}
        <div
          ref={stepListRef}
          style={{
            width: 340, background: '#fff', borderLeft: '1px solid #e2e8f0',
            overflowY: 'auto', flexShrink: 0,
          }}
        >
          {/* Summary */}
          {route && (
            <div style={{
              padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                ルート概要
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>距離</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                    {formatDistance(route.distance)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>所要時間</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                    {formatDuration(route.duration)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>地点数</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                    {waypoints.length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Waypoints list */}
          <div style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ padding: '4px 16px', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              経由地点
            </div>
            {waypoints.map((wp, idx) => {
              const isStart = idx === 0;
              const isEnd = idx === waypoints.length - 1;
              const color = isStart ? MARKER_COLORS.start : isEnd ? MARKER_COLORS.end : MARKER_COLORS.waypoint;
              return (
                <div
                  key={`wplist-${idx}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 16px', fontSize: 13,
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>
                  <span style={{ color: '#374151' }}>
                    {wp.label || `地点 ${idx + 1}`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Steps */}
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '8px 16px 4px', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              ターンバイターン案内
            </div>
            {route?.steps.map((step, idx) => (
              <div
                key={`step-${idx}`}
                onClick={() => handleStepClick(idx)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 16px', cursor: 'pointer',
                  background: activeStepIdx === idx ? '#eff6ff' : 'transparent',
                  borderLeft: activeStepIdx === idx ? '3px solid #3b82f6' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (activeStepIdx !== idx) e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  if (activeStepIdx !== idx) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: activeStepIdx === idx ? '#3b82f6' : '#e2e8f0',
                  color: activeStepIdx === idx ? '#fff' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, flexShrink: 0, marginTop: 1,
                }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
                    {step.instruction || '(指示なし)'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {formatDistance(step.distance)}
                    {step.duration > 0 && ` / ${formatDuration(step.duration)}`}
                  </div>
                </div>
              </div>
            ))}

            {route && route.steps.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>
                案内情報がありません
              </div>
            )}

            {!route && !loading && (
              <div style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>
                ルートを取得しています...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
