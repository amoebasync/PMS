'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Polyline, Marker, InfoWindow } from '@react-google-maps/api';
import { useTranslation } from '@/i18n';

// ============================================================
// Types
// ============================================================
interface DistributorTrajectory {
  scheduleId: number;
  distributorId: number;
  distributorName: string;
  distributorStaffId: string;
  status: string;
  area: {
    boundaryGeojson: string;
    townName: string;
    chomeName: string;
    prefName: string;
    cityName: string;
  } | null;
  session: {
    id: number;
    startedAt: string;
    finishedAt: string | null;
    totalDistance: number;
    totalSteps: number;
  };
  gpsPoints: { lat: number; lng: number; timestamp: string }[];
  progressEvents: { mailboxCount: number; lat: number | null; lng: number | null; timestamp: string }[];
  lastMailboxCount: number;
  items: { flyerName: string | null; plannedCount: number | null; actualCount: number | null }[];
}

interface Props {
  date: string;
  onClose: () => void;
}

// ============================================================
// Constants
// ============================================================
const TRAJECTORY_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48', '#0ea5e9', '#a855f7', '#10b981',
  '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed',
];

// ============================================================
// GeoJSON parser
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

const formatAreaName = (town?: string | null, chome?: string | null) => {
  const t = town || '';
  const c = chome || '';
  if (!t && !c) return '-';
  if (t === c) return c;
  if (c.includes(t)) return c;
  const baseTown = t.replace(/[一二三四五六七八九十]+丁目$/, '');
  if (baseTown && c.includes(baseTown)) return c;
  return t && c ? `${t} ${c}` : (c || t);
};

// ============================================================
// Component
// ============================================================
export default function AllTrajectoriesViewer({ date, onClose }: Props) {
  const { t } = useTranslation('schedules');
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [distributors, setDistributors] = useState<DistributorTrajectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibility, setVisibility] = useState<Record<number, boolean>>({});
  const [selectedInfo, setSelectedInfo] = useState<{ position: google.maps.LatLngLiteral; content: string } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedules/trajectories?date=${date}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'データの取得に失敗しました');
        return;
      }
      const json = await res.json();
      setDistributors(json.distributors);
      // 初回のみ全員表示ONに
      setVisibility(prev => {
        const updated = { ...prev };
        for (const d of json.distributors) {
          if (updated[d.scheduleId] === undefined) updated[d.scheduleId] = true;
        }
        return updated;
      });
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // リアルタイムポーリング（配布中の配布員がいる場合）
  const hasLive = distributors.some(d => d.status === 'DISTRIBUTING');
  useEffect(() => {
    if (!hasLive) return;
    pollingRef.current = setInterval(fetchData, 15000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [hasLive, fetchData]);

  // 色割り当て
  const colorMap = useMemo(() => {
    const map: Record<number, string> = {};
    distributors.forEach((d, i) => {
      map[d.scheduleId] = TRAJECTORY_COLORS[i % TRAJECTORY_COLORS.length];
    });
    return map;
  }, [distributors]);

  // 表示中の配布員
  const visibleDistributors = distributors.filter(d => visibility[d.scheduleId]);

  // fitBounds
  useEffect(() => {
    if (!mapRef.current || visibleDistributors.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;
    for (const d of visibleDistributors) {
      for (const p of d.gpsPoints) {
        bounds.extend({ lat: p.lat, lng: p.lng });
        hasPoints = true;
      }
      if (d.area?.boundaryGeojson) {
        const paths = extractPaths(d.area.boundaryGeojson);
        for (const path of paths) {
          for (const p of path) {
            bounds.extend(p);
            hasPoints = true;
          }
        }
      }
    }
    if (hasPoints) mapRef.current.fitBounds(bounds, 60);
  }, [visibleDistributors.length, loading]);

  const toggleAll = (show: boolean) => {
    const updated: Record<number, boolean> = {};
    distributors.forEach(d => { updated[d.scheduleId] = show; });
    setVisibility(updated);
  };

  const activeCount = distributors.filter(d => d.status === 'DISTRIBUTING').length;
  const completedCount = distributors.filter(d => d.status === 'COMPLETED').length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">{t('all_traj_loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-8 text-center max-w-sm">
          <i className="bi bi-exclamation-triangle text-3xl text-amber-500 mb-3 block"></i>
          <p className="text-slate-700 font-bold mb-2">{error}</p>
          <button onClick={onClose} className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-600">{t('cancel')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/50 backdrop-blur-sm">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <i className="bi bi-map-fill text-indigo-500 text-xl"></i>
          <div>
            <h2 className="font-bold text-slate-800">
              {t('all_traj_title')}
            </h2>
            <p className="text-xs text-slate-500">
              {new Date(date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })}
              <span className="ml-2 text-slate-400">
                {t('all_traj_total')}: {distributors.length}
                {activeCount > 0 && <span className="ml-2 text-emerald-600 font-bold">{t('all_traj_active')}: {activeCount}</span>}
                {completedCount > 0 && <span className="ml-2 text-blue-600">{t('all_traj_completed')}: {completedCount}</span>}
              </span>
              {hasLive && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  {t('all_traj_live')}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => fetchData()} title="更新" className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {distributors.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
              <div className="text-center text-slate-400">
                <i className="bi bi-geo text-4xl block mb-2"></i>
                <p className="text-sm">{t('all_traj_no_data')}</p>
              </div>
            </div>
          )}
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: 35.68, lng: 139.76 }}
              zoom={12}
              options={{
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: false,
              }}
              onLoad={(map) => { mapRef.current = map; }}
            >
              {visibleDistributors.map((d) => {
                const color = colorMap[d.scheduleId];
                const areaPaths = d.area?.boundaryGeojson ? extractPaths(d.area.boundaryGeojson) : [];
                const lastPoint = d.gpsPoints[d.gpsPoints.length - 1];

                return (
                  <React.Fragment key={d.scheduleId}>
                    {/* Area polygon */}
                    {areaPaths.map((path, i) => (
                      <Polygon
                        key={`area-${d.scheduleId}-${i}`}
                        paths={path}
                        options={{
                          fillColor: color,
                          fillOpacity: 0.08,
                          strokeColor: color,
                          strokeWeight: 2,
                          strokeOpacity: 0.5,
                        }}
                      />
                    ))}

                    {/* GPS trajectory polyline */}
                    {d.gpsPoints.length > 1 && (
                      <Polyline
                        path={d.gpsPoints.map(p => ({ lat: p.lat, lng: p.lng }))}
                        options={{
                          strokeColor: color,
                          strokeWeight: 3,
                          strokeOpacity: 0.85,
                        }}
                      />
                    )}

                    {/* Name label at last GPS point */}
                    {lastPoint && (
                      <Marker
                        position={{ lat: lastPoint.lat, lng: lastPoint.lng }}
                        label={{
                          text: d.distributorName,
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          className: 'trajectory-label',
                        }}
                        icon={{
                          path: d.status === 'DISTRIBUTING'
                            ? 'M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 10c-2.21 0-4-1.12-4-2.5C8 10.12 9.79 9 12 9s4 1.12 4 2.5c0 1.38-1.79 2.5-4 2.5z'
                            : google.maps.SymbolPath.CIRCLE,
                          scale: d.status === 'DISTRIBUTING' ? 1.5 : 10,
                          fillColor: color,
                          fillOpacity: 1,
                          strokeColor: '#fff',
                          strokeWeight: 2,
                          anchor: d.status === 'DISTRIBUTING'
                            ? new google.maps.Point(12, 24)
                            : new google.maps.Point(0, 0),
                          labelOrigin: d.status === 'DISTRIBUTING'
                            ? new google.maps.Point(12, -8)
                            : new google.maps.Point(0, -14),
                        }}
                        animation={d.status === 'DISTRIBUTING' ? google.maps.Animation.BOUNCE : undefined}
                        onClick={() => {
                          const areaName = d.area ? formatAreaName(d.area.townName, d.area.chomeName) : '-';
                          const dist = (d.session.totalDistance / 1000).toFixed(1);
                          setSelectedInfo({
                            position: { lat: lastPoint.lat, lng: lastPoint.lng },
                            content: `${d.distributorName} (${d.distributorStaffId})\n${areaName}\n距離: ${dist}km / ${d.lastMailboxCount}枚`,
                          });
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Info window */}
              {selectedInfo && (
                <InfoWindow position={selectedInfo.position} onCloseClick={() => setSelectedInfo(null)}>
                  <div className="text-xs whitespace-pre-line font-bold">{selectedInfo.content}</div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>

        {/* Side panel */}
        <div className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0">
          {/* Toggle all */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              <i className="bi bi-people-fill mr-1"></i>
              {t('all_traj_distributors')} ({distributors.length})
            </span>
            <div className="flex gap-1">
              <button onClick={() => toggleAll(true)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold px-1.5 py-0.5 rounded hover:bg-indigo-50">
                {t('all_traj_show_all')}
              </button>
              <button onClick={() => toggleAll(false)} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded hover:bg-slate-50">
                {t('all_traj_hide_all')}
              </button>
            </div>
          </div>

          {/* Distributor list */}
          <div className="flex-1 overflow-y-auto">
            {distributors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <i className="bi bi-geo text-3xl mb-2"></i>
                <p className="text-xs">{t('all_traj_no_data')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {distributors.map((d) => {
                  const color = colorMap[d.scheduleId];
                  const isVisible = visibility[d.scheduleId] ?? true;
                  const areaName = d.area ? formatAreaName(d.area.townName, d.area.chomeName) : '-';
                  const dist = (d.session.totalDistance / 1000).toFixed(1);
                  const lastPoint = d.gpsPoints[d.gpsPoints.length - 1];

                  return (
                    <button
                      key={d.scheduleId}
                      onClick={() => setVisibility(prev => ({ ...prev, [d.scheduleId]: !prev[d.scheduleId] }))}
                      className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${!isVisible ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Color dot */}
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">{d.distributorName}</span>
                            {d.status === 'DISTRIBUTING' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                {t('status_distributing')}
                              </span>
                            )}
                            {d.status === 'COMPLETED' && (
                              <span className="px-1.5 py-0 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
                                {t('status_completed')}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{areaName}</div>
                        </div>
                        {/* Toggle icon */}
                        <i className={`bi ${isVisible ? 'bi-eye-fill text-indigo-500' : 'bi-eye-slash text-slate-300'} text-sm shrink-0`}></i>
                      </div>
                      {/* Stats */}
                      {isVisible && (
                        <div className="flex items-center gap-3 mt-1 ml-5 text-[10px] text-slate-500">
                          <span><i className="bi bi-signpost-2 mr-0.5"></i>{dist}km</span>
                          <span><i className="bi bi-footprints mr-0.5"></i>{d.session.totalSteps.toLocaleString()}</span>
                          {d.lastMailboxCount > 0 && (
                            <span><i className="bi bi-mailbox mr-0.5"></i>{d.lastMailboxCount}</span>
                          )}
                          <span className="text-slate-300">|</span>
                          <span>{d.gpsPoints.length}pts</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
