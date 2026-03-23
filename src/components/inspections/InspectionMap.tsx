'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Polyline, Marker, Circle } from '@react-google-maps/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

interface ProhibitedProperty {
  id: number;
  lat: number;
  lng: number;
  address: string;
  buildingName: string | null;
  severity: string | null;
}

interface Checkpoint {
  id: number;
  lat: number;
  lng: number;
  result: 'CONFIRMED' | 'NOT_FOUND' | 'UNABLE' | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface ProhibitedCheck {
  id: number;
  prohibitedPropertyId: number;
  result: 'COMPLIANT' | 'VIOLATION' | 'UNABLE' | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface MapData {
  areaBoundary: string | null;
  distributorGpsPoints: GpsPoint[];
  prohibitedProperties: ProhibitedProperty[];
  inspectorGpsPoints: GpsPoint[];
  checkpoints: Checkpoint[];
  prohibitedChecks: (ProhibitedCheck & { lat: number; lng: number })[];
}

interface Props {
  mapData: MapData | null;
  checkpoints: Checkpoint[];
  prohibitedChecks: ProhibitedCheck[];
  inspectorPosition: { lat: number; lng: number } | null;
  inspectorGpsPoints: GpsPoint[];
  samplePoints?: { lat: number; lng: number; index: number }[];
  onSamplePointsChange?: (points: { lat: number; lng: number; index: number }[]) => void;
}

/* ------------------------------------------------------------------ */
/*  GeoJSON parser (same pattern as TrajectoryViewer)                  */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Libraries constant (stable reference for useJsApiLoader)          */
/* ------------------------------------------------------------------ */

const LIBRARIES: ('geometry' | 'visualization')[] = ['geometry', 'visualization'];

/* ------------------------------------------------------------------ */
/*  Checkpoint marker color                                            */
/* ------------------------------------------------------------------ */

const checkpointColor = (result: string | null) => {
  switch (result) {
    case 'CONFIRMED': return '#22c55e';   // green
    case 'NOT_FOUND': return '#ef4444';   // red
    case 'UNABLE': return '#9ca3af';      // gray
    default: return '#ffffff';            // white (pending)
  }
};

const checkpointBorder = (result: string | null) => {
  switch (result) {
    case 'CONFIRMED': return '#16a34a';
    case 'NOT_FOUND': return '#dc2626';
    case 'UNABLE': return '#6b7280';
    default: return '#d1d5db';
  }
};

/* ------------------------------------------------------------------ */
/*  Prohibited check overlay color                                     */
/* ------------------------------------------------------------------ */

const prohibitedCheckColor = (result: string | null) => {
  switch (result) {
    case 'COMPLIANT': return '#22c55e';
    case 'VIOLATION': return '#ef4444';
    case 'UNABLE': return '#9ca3af';
    default: return null; // no overlay
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InspectionMap({ mapData, checkpoints, prohibitedChecks, inspectorPosition, inspectorGpsPoints, samplePoints = [], onSamplePointsChange }: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);

  /* ---- Area polygons ---- */
  const areaPolygons = useMemo(() => {
    if (!mapData?.areaBoundary) return [];
    return extractPaths(mapData.areaBoundary);
  }, [mapData?.areaBoundary]);

  /* ---- Distributor trajectory ---- */
  const distributorPath = useMemo(() => {
    if (!mapData?.distributorGpsPoints) return [];
    return mapData.distributorGpsPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [mapData?.distributorGpsPoints]);

  /* ---- Inspector trajectory (combine stored + real-time) ---- */
  const inspectorPath = useMemo(() => {
    const stored = inspectorGpsPoints.map((p) => ({ lat: p.lat, lng: p.lng }));
    if (inspectorPosition) {
      stored.push(inspectorPosition);
    }
    return stored;
  }, [inspectorGpsPoints, inspectorPosition]);

  /* ---- Map center (エリア中心を優先、自動追従しない) ---- */
  const center = useMemo(() => {
    if (areaPolygons.length > 0 && areaPolygons[0].length > 0) {
      const pts = areaPolygons[0];
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
      return { lat, lng };
    }
    if (distributorPath.length > 0) return distributorPath[0];
    if (inspectorPosition) return inspectorPosition;
    return { lat: 35.6812, lng: 139.7671 }; // Tokyo
  }, [areaPolygons, distributorPath, inspectorPosition]);

  /* ---- 現在地にフォーカス ---- */
  const panToMyLocation = useCallback(() => {
    if (inspectorPosition && mapRef.current) {
      mapRef.current.panTo(inspectorPosition);
      mapRef.current.setZoom(17);
    }
  }, [inspectorPosition]);

  /* ---- Prohibited check status map ---- */
  const prohibitedCheckMap = useMemo(() => {
    const m = new Map<number, ProhibitedCheck>();
    prohibitedChecks.forEach((c) => m.set(c.prohibitedPropertyId, c));
    return m;
  }, [prohibitedChecks]);

  /* ---- Heatmap ---- */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapData?.distributorGpsPoints?.length) return;
    if (!window.google?.maps?.visualization) return;

    // Remove old heatmap
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    }

    const points = mapData.distributorGpsPoints.map((p, i) => {
      // Weight by time spent (difference to next point, capped at 60s)
      let weight = 1;
      if (i < mapData.distributorGpsPoints.length - 1) {
        const dt = new Date(mapData.distributorGpsPoints[i + 1].timestamp).getTime() - new Date(p.timestamp).getTime();
        weight = Math.min(dt / 1000, 60); // cap at 60 seconds
        weight = Math.max(weight, 1);
      }
      return {
        location: new google.maps.LatLng(p.lat, p.lng),
        weight,
      };
    });

    const heatmap = new google.maps.visualization.HeatmapLayer({
      data: points,
      map: mapRef.current,
      radius: 20,
      opacity: 0.4,
      gradient: [
        'rgba(0, 0, 255, 0)',
        'rgba(0, 100, 255, 0.4)',
        'rgba(0, 200, 255, 0.6)',
        'rgba(0, 255, 100, 0.7)',
        'rgba(255, 255, 0, 0.8)',
        'rgba(255, 150, 0, 0.9)',
        'rgba(255, 0, 0, 1)',
      ],
    });
    heatmapRef.current = heatmap;

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [mapReady, mapData?.distributorGpsPoints]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
    <GoogleMap
      mapContainerClassName="w-full h-full"
      center={center}
      zoom={16}
      onLoad={onMapLoad}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      {/* Area polygon */}
      {areaPolygons.map((path, i) => (
        <Polygon
          key={`area-${i}`}
          paths={path}
          options={{
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.5,
            strokeWeight: 2,
          }}
        />
      ))}

      {/* Distributor GPS trajectory (blue) */}
      {distributorPath.length > 1 && (
        <Polyline
          path={distributorPath}
          options={{
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 3,
          }}
        />
      )}

      {/* Inspector GPS trajectory (orange) */}
      {inspectorPath.length > 1 && (
        <Polyline
          path={inspectorPath}
          options={{
            strokeColor: '#f97316',
            strokeOpacity: 0.9,
            strokeWeight: 3,
          }}
        />
      )}

      {/* Inspector current position */}
      {inspectorPosition && (
        <Marker
          position={inspectorPosition}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#f97316',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          }}
          zIndex={100}
        />
      )}

      {/* Sample points — pending (yellow numbered) or checked (result colored) */}
      {samplePoints.map((sp, idx) => {
        const matchedCp = checkpoints.find(
          (cp) => Math.abs(cp.lat - sp.lat) < 0.0002 && Math.abs(cp.lng - sp.lng) < 0.0002
        );
        if (matchedCp && matchedCp.result) {
          // Checked sample point — show result marker
          const fillColor = matchedCp.result === 'CONFIRMED' ? '#22c55e' : matchedCp.result === 'NOT_FOUND' ? '#ef4444' : '#94a3b8';
          const labelText = matchedCp.result === 'CONFIRMED' ? '✓' : matchedCp.result === 'NOT_FOUND' ? '✗' : '?';
          return (
            <Marker
              key={`sample-${idx}`}
              position={{ lat: sp.lat, lng: sp.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 14,
                fillColor,
                fillOpacity: 0.95,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
              label={{
                text: labelText,
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
              zIndex={40}
              title={`サンプル #${idx + 1} — ${matchedCp.result}`}
            />
          );
        }
        // Pending sample point — yellow numbered, draggable
        return (
          <Marker
            key={`sample-${idx}`}
            position={{ lat: sp.lat, lng: sp.lng }}
            draggable={!!onSamplePointsChange}
            onDragEnd={(e) => {
              if (e.latLng && onSamplePointsChange) {
                const newPoints = [...samplePoints];
                newPoints[idx] = { ...newPoints[idx], lat: e.latLng.lat(), lng: e.latLng.lng() };
                onSamplePointsChange(newPoints);
              }
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#fbbf24',
              fillOpacity: 0.95,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            label={{
              text: String(idx + 1),
              color: '#000000',
              fontSize: '11px',
              fontWeight: 'bold',
            }}
            zIndex={30}
            title={`サンプル #${idx + 1}`}
          />
        );
      })}

      {/* Prohibited properties (red markers) */}
      {mapData?.prohibitedProperties?.filter(pp => pp.lat && pp.lng).map((pp) => {
        const check = prohibitedCheckMap.get(pp.id);
        const overlayColor = check ? prohibitedCheckColor(check.result) : null;

        return (
          <React.Fragment key={`pp-${pp.id}`}>
            <Marker
              position={{ lat: pp.lat, lng: pp.lng }}
              icon={{
                path: 'M10 20S3 10.87 3 7a7 7 0 0 1 14 0c0 3.87-7 13-7 13zm0-11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#991b1b',
                strokeWeight: 1,
                scale: 1.2,
                anchor: new google.maps.Point(10, 20),
              }}
              title={pp.address}
              zIndex={50}
            />
            {/* Check status overlay circle */}
            {overlayColor && (
              <Circle
                center={{ lat: pp.lat, lng: pp.lng }}
                radius={8}
                options={{
                  fillColor: overlayColor,
                  fillOpacity: 0.7,
                  strokeColor: overlayColor,
                  strokeWeight: 2,
                  zIndex: 55,
                }}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Checkpoint markers (only those NOT matching a sample point — manual adds) */}
      {checkpoints.map((cp) => {
        const matchesSample = samplePoints.some(
          (sp) => Math.abs(cp.lat - sp.lat) < 0.0002 && Math.abs(cp.lng - sp.lng) < 0.0002
        );
        if (matchesSample) return null; // already rendered with sample point markers
        const fillColor = cp.result === 'CONFIRMED' ? '#22c55e' : cp.result === 'NOT_FOUND' ? '#ef4444' : '#94a3b8';
        const labelText = cp.result === 'CONFIRMED' ? '✓' : cp.result === 'NOT_FOUND' ? '✗' : '?';
        return (
          <Marker
            key={`cp-${cp.id}`}
            position={{ lat: cp.lat, lng: cp.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor,
              fillOpacity: 0.95,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
            label={{
              text: labelText,
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
            zIndex={40}
          />
        );
      })}
    </GoogleMap>
    {/* 現在地ボタン */}
    {inspectorPosition && (
      <button
        onClick={panToMyLocation}
        className="absolute bottom-4 right-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 transition-colors border border-slate-200"
        title="現在地"
      >
        <i className="bi bi-crosshair text-lg text-indigo-600"></i>
      </button>
    )}
    </div>
  );
}
