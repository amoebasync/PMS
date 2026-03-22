'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Source, Layer } from 'react-map-gl/mapbox';
import type { LayerProps } from 'react-map-gl/mapbox';
import type { FeatureCollection } from 'geojson';

// ============================================================
// Types
// ============================================================
interface IsochroneOverlayProps {
  /** Center point for isochrone calculation */
  center: { lat: number; lng: number };
  /** Comma-separated minutes for contours, e.g. "15,30,60" */
  minutes: string;
  /** Routing profile */
  profile?: 'walking' | 'cycling' | 'driving';
  /** Whether to show the overlay */
  visible: boolean;
  /** Unique ID prefix for layer disambiguation (default: 'isochrone') */
  id?: string;
}

// Color palette for up to 5 contour levels (inner to outer)
const CONTOUR_COLORS = [
  'rgba(0, 120, 255, 0.35)',
  'rgba(0, 160, 255, 0.25)',
  'rgba(0, 200, 255, 0.18)',
  'rgba(0, 220, 255, 0.12)',
  'rgba(0, 240, 255, 0.08)',
];

const CONTOUR_LINE_COLORS = [
  'rgba(0, 100, 220, 0.8)',
  'rgba(0, 140, 220, 0.65)',
  'rgba(0, 180, 220, 0.5)',
  'rgba(0, 200, 220, 0.4)',
  'rgba(0, 220, 220, 0.3)',
];

// ============================================================
// Component
// ============================================================
export default function IsochroneOverlay({
  center,
  minutes,
  profile = 'walking',
  visible,
  id = 'isochrone',
}: IsochroneOverlayProps) {
  const [geoJson, setGeoJson] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIsochrone = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lat: String(center.lat),
        lng: String(center.lng),
        minutes,
        profile,
      });

      const res = await fetch(`/api/mapbox/isochrone?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data: FeatureCollection = await res.json();
      setGeoJson(data);
    } catch (err) {
      console.error('Isochrone fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load isochrone');
      setGeoJson(null);
    } finally {
      setLoading(false);
    }
  }, [center.lat, center.lng, minutes, profile, visible]);

  useEffect(() => {
    fetchIsochrone();
  }, [fetchIsochrone]);

  if (!visible || !geoJson) return null;

  // Parse the minute values for labeling
  const minuteValues = minutes.split(',').map(Number).sort((a, b) => b - a);

  // Mapbox Isochrone API returns features ordered from largest to smallest contour.
  // We render them in that order so smaller (inner) polygons draw on top.
  return (
    <>
      {loading && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 12px',
          borderRadius: 4, fontSize: 12, zIndex: 10,
        }}>
          Loading isochrone...
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(200,0,0,0.8)', color: '#fff', padding: '4px 12px',
          borderRadius: 4, fontSize: 12, zIndex: 10,
        }}>
          {error}
        </div>
      )}

      {geoJson.features.map((feature, idx) => {
        const sourceId = `${id}-source-${idx}`;
        const fillLayerId = `${id}-fill-${idx}`;
        const lineLayerId = `${id}-line-${idx}`;
        const colorIdx = Math.min(idx, CONTOUR_COLORS.length - 1);

        const fillLayer: LayerProps = {
          id: fillLayerId,
          type: 'fill',
          paint: {
            'fill-color': CONTOUR_COLORS[colorIdx],
          },
        };

        const lineLayer: LayerProps = {
          id: lineLayerId,
          type: 'line',
          paint: {
            'line-color': CONTOUR_LINE_COLORS[colorIdx],
            'line-width': idx === 0 ? 2.5 : 1.5,
            'line-dasharray': idx === 0 ? [1] : [4, 2],
          },
        };

        const singleFeatureCollection: FeatureCollection = {
          type: 'FeatureCollection',
          features: [feature],
        };

        return (
          <Source key={sourceId} id={sourceId} type="geojson" data={singleFeatureCollection}>
            <Layer {...fillLayer} />
            <Layer {...lineLayer} />
          </Source>
        );
      })}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 30, right: 10, background: 'rgba(255,255,255,0.92)',
        borderRadius: 6, padding: '8px 12px', fontSize: 12, zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {profile === 'walking' ? '徒歩' : profile === 'cycling' ? '自転車' : '車'}到達圏
        </div>
        {minuteValues.map((m, idx) => {
          const colorIdx = Math.min(idx, CONTOUR_COLORS.length - 1);
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div style={{
                width: 14, height: 14, borderRadius: 2,
                background: CONTOUR_COLORS[colorIdx],
                border: `1.5px solid ${CONTOUR_LINE_COLORS[colorIdx]}`,
              }} />
              <span>{m}分</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
