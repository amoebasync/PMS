'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Polyline, Marker, InfoWindow } from '@react-google-maps/api';

// ============================================================
// Types
// ============================================================
interface OptimizedTask {
  task: any;
  sequenceNumber: number;
  legDistance: number;
  legDuration: number;
  estimatedArrival: string | null;
  isTimeConstrained: boolean;
}

interface OptimizeResult {
  optimizedTasks: OptimizedTask[];
  totalDistance: number;
  totalDuration: number;
  polylineEncoded: string | null;
  skippedTasks: any[];
  origin: { lat: number; lng: number } | null;
}

type Priority = 'COLLECTION_FIRST' | 'RELAY_FIRST' | 'TIME_OPTIMAL';
type OriginType = 'DEFAULT' | 'CURRENT';

// 高田馬場4-39-6 の座標
const DEFAULT_ORIGIN = { lat: 35.7126, lng: 139.7038 };

const TYPE_COLOR: Record<string, string> = {
  RELAY: '#ea580c',      // orange-600
  COLLECTION: '#9333ea', // purple-600
  FULL_RELAY: '#16a34a', // green-600
};

const TYPE_BG: Record<string, string> = {
  RELAY: 'bg-orange-100 text-orange-700',
  COLLECTION: 'bg-purple-100 text-purple-700',
  FULL_RELAY: 'bg-green-100 text-green-700',
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m > 0 ? `${m}m` : ''}`;
}

// Decode Google Polyline encoding
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function getAreaName(area: any): string {
  if (!area) return '-';
  const pref = area.prefecture?.name || '';
  const city = area.city?.name || '';
  const chome = area.chome_name || '';
  return `${pref}${city}${chome}`;
}

// ============================================================
// Component
// ============================================================
interface Props {
  isLoaded: boolean;
  date: string;
  driverId: string;
  driverName: string;
  onClose: () => void;
  onApplyOrder: (orderedIds: number[]) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

export default function RouteOptimizationPanel({ isLoaded, date, driverId, driverName, onClose, onApplyOrder, t }: Props) {
  const [priority, setPriority] = useState<Priority>('TIME_OPTIMAL');
  const [originType, setOriginType] = useState<OriginType>('DEFAULT');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 35.6895, lng: 139.6917 });

  const getOriginCoords = useCallback((type: OriginType): { lat: number; lng: number } => {
    if (type === 'CURRENT' && currentLocation) return currentLocation;
    return DEFAULT_ORIGIN;
  }, [currentLocation]);

  const fetchOptimizedRoute = useCallback(async (p: Priority, oType?: OriginType) => {
    setLoading(true);
    setError(null);
    setSelectedIdx(null);
    const ot = oType ?? originType;
    const originCoords = getOriginCoords(ot);
    try {
      const params = new URLSearchParams({
        date, driverId, priority: p,
        originLat: originCoords.lat.toString(),
        originLng: originCoords.lng.toString(),
      });
      const res = await fetch(`/api/relay-tasks/optimize-route?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      const data: OptimizeResult = await res.json();
      setResult(data);
      if (data.optimizedTasks.length > 0) {
        const tasks = data.optimizedTasks;
        const avgLat = tasks.reduce((s, t) => s + t.task.latitude, 0) / tasks.length;
        const avgLng = tasks.reduce((s, t) => s + t.task.longitude, 0) / tasks.length;
        setMapCenter({ lat: avgLat, lng: avgLng });
      }
    } catch (e: any) {
      setError(e.message || t('route_error'));
    }
    setLoading(false);
  }, [date, driverId, t, originType, getOriginCoords]);

  // 現在地を取得
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // 失敗時は無視（デフォルト使用）
        { timeout: 5000, enableHighAccuracy: false },
      );
    }
  }, []);

  useEffect(() => {
    fetchOptimizedRoute(priority);
  }, []);

  const handlePriorityChange = (p: Priority) => {
    setPriority(p);
    fetchOptimizedRoute(p);
  };

  const handleOriginChange = (ot: OriginType) => {
    setOriginType(ot);
    fetchOptimizedRoute(priority, ot);
  };

  const handleApplyOrder = () => {
    if (!result) return;
    onApplyOrder(result.optimizedTasks.map(ot => ot.task.id));
  };

  const handleStartNavigation = () => {
    if (!result || result.optimizedTasks.length === 0) return;
    const tasks = result.optimizedTasks;
    const originCoords = getOriginCoords(originType);
    const origin = `${originCoords.lat},${originCoords.lng}`;
    const destination = `${tasks[tasks.length - 1].task.latitude},${tasks[tasks.length - 1].task.longitude}`;
    const waypoints = tasks.slice(0, -1).map(t => `${t.task.latitude},${t.task.longitude}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Polyline path
  const polylinePath = result?.polylineEncoded
    ? decodePolyline(result.polylineEncoded)
    : result?.optimizedTasks.map(ot => ({ lat: ot.task.latitude, lng: ot.task.longitude })) || [];

  // Custom numbered marker using SVG data URI
  const createNumberedMarkerIcon = (num: number, type: string) => {
    const color = TYPE_COLOR[type] || '#6366f1';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${color}"/>
      <circle cx="16" cy="15" r="10" fill="white"/>
      <text x="16" y="19" text-anchor="middle" font-size="12" font-weight="bold" font-family="Arial" fill="${color}">${num}</text>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: typeof google !== 'undefined' ? new google.maps.Size(32, 40) : undefined,
      anchor: typeof google !== 'undefined' ? new google.maps.Point(16, 40) : undefined,
    };
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white md:bg-black/40 md:backdrop-blur-sm md:items-center md:justify-center md:p-4">
      <div className="w-full h-full md:max-w-5xl md:max-h-[90vh] md:rounded-xl md:shadow-xl bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm md:text-base text-slate-800">
              <i className="bi bi-signpost-2 text-indigo-500 mr-2"></i>
              {t('btn_optimize_route')}
            </h3>
            <span className="text-xs text-slate-500">{driverName} / {date}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Priority Toggle + Origin Selector */}
        <div className="px-4 py-2 border-b border-slate-100 shrink-0 space-y-2">
          {/* Row 1: Priority buttons */}
          <div className="flex items-center gap-1.5">
            {([
              { key: 'COLLECTION_FIRST' as Priority, icon: 'bi-box-arrow-in-left', active: 'bg-purple-100 text-purple-700 border-purple-300' },
              { key: 'RELAY_FIRST' as Priority, icon: 'bi-truck', active: 'bg-orange-100 text-orange-700 border-orange-300' },
              { key: 'TIME_OPTIMAL' as Priority, icon: 'bi-clock', active: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
            ]).map(({ key, icon, active }) => (
              <button key={key} onClick={() => handlePriorityChange(key)}
                className={`px-2 md:px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold flex items-center gap-1 transition-all border ${
                  priority === key
                    ? active
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}>
                <i className={`bi ${icon}`}></i>
                <span className="hidden sm:inline">{t(`priority_${key.toLowerCase()}`)}</span>
              </button>
            ))}

            {/* Origin selector */}
            <div className="flex items-center gap-1 ml-auto md:ml-2 md:border-l border-slate-200 md:pl-2">
              <button onClick={() => handleOriginChange('DEFAULT')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                  originType === 'DEFAULT'
                    ? 'bg-sky-100 text-sky-700 border-sky-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                }`}>
                <i className="bi bi-pin-map mr-0.5"></i>
                <span className="hidden sm:inline">{t('route_origin_default')}</span>
              </button>
              <button onClick={() => handleOriginChange('CURRENT')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all border ${
                  originType === 'CURRENT'
                    ? 'bg-sky-100 text-sky-700 border-sky-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                }`}
                disabled={!currentLocation}
                title={!currentLocation ? t('route_origin_no_gps') : ''}>
                <i className="bi bi-crosshair"></i>
                <span className="hidden sm:inline ml-0.5">{t('route_origin_current')}</span>
              </button>
            </div>
          </div>

          {/* Row 2: Action buttons (mobile: full width) */}
          {result && result.optimizedTasks.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={handleApplyOrder}
                className="flex-1 md:flex-none px-3 py-2 md:py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5">
                <i className="bi bi-check-lg"></i>
                {t('btn_apply_order')}
              </button>
              <button onClick={handleStartNavigation}
                className="flex-1 md:flex-none px-3 py-2 md:py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 flex items-center justify-center gap-1.5">
                <i className="bi bi-navigation"></i>
                {t('btn_start_navigation')}
              </button>
            </div>
          )}
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full mx-auto mb-3"></div>
              <div className="text-sm">{t('route_optimizing')}</div>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-red-500">
              <i className="bi bi-exclamation-triangle text-3xl block mb-2"></i>
              {error}
            </div>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && result && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Map */}
            <div className="flex-1 min-h-[250px] md:min-h-0 relative">
              {isLoaded && result.optimizedTasks.length > 0 ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={12}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    fullscreenControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                  }}
                >
                  {/* Route polyline */}
                  {polylinePath.length > 1 && (
                    <Polyline
                      path={polylinePath}
                      options={{
                        strokeColor: '#4f46e5',
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                      }}
                    />
                  )}

                  {/* Origin marker */}
                  {result.origin && (
                    <Marker
                      position={{ lat: result.origin.lat, lng: result.origin.lng }}
                      icon={{
                        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#0ea5e9"/><circle cx="14" cy="13" r="8" fill="white"/><text x="14" y="17" text-anchor="middle" font-size="11" font-weight="bold" font-family="Arial" fill="#0ea5e9">S</text></svg>`)}`,
                        scaledSize: typeof google !== 'undefined' ? new google.maps.Size(28, 36) : undefined,
                        anchor: typeof google !== 'undefined' ? new google.maps.Point(14, 36) : undefined,
                      }}
                      zIndex={2000}
                    />
                  )}

                  {/* Numbered markers */}
                  {result.optimizedTasks.map((ot, idx) => (
                    <Marker
                      key={ot.task.id}
                      position={{ lat: ot.task.latitude, lng: ot.task.longitude }}
                      icon={createNumberedMarkerIcon(ot.sequenceNumber, ot.task.type)}
                      onClick={() => setSelectedIdx(idx)}
                      zIndex={1000 - idx}
                    />
                  ))}

                  {/* InfoWindow */}
                  {selectedIdx !== null && result.optimizedTasks[selectedIdx] && (
                    <InfoWindow
                      position={{
                        lat: result.optimizedTasks[selectedIdx].task.latitude,
                        lng: result.optimizedTasks[selectedIdx].task.longitude,
                      }}
                      onCloseClick={() => setSelectedIdx(null)}
                    >
                      <div style={{ minWidth: 180, fontSize: 12, lineHeight: 1.5 }}>
                        {(() => {
                          const ot = result.optimizedTasks[selectedIdx];
                          const task = ot.task;
                          return (
                            <>
                              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                #{ot.sequenceNumber} {task.locationName || getAreaName(task.schedule?.area)}
                              </div>
                              <div style={{ color: TYPE_COLOR[task.type] || '#666', fontWeight: 'bold', marginBottom: 2 }}>
                                {task.type === 'RELAY' ? t('type_relay') : task.type === 'COLLECTION' ? t('type_collection') : t('type_full_relay')}
                              </div>
                              {task.schedule?.distributor?.name && (
                                <div style={{ color: '#475569' }}>
                                  {task.schedule.distributor.name}
                                  {task.schedule.distributor.staffId && ` (${task.schedule.distributor.staffId})`}
                                </div>
                              )}
                              {task.timeSlotStart && (
                                <div style={{ color: '#0369a1' }}>
                                  <b>{task.timeSlotStart}~{task.timeSlotEnd}</b>
                                  {ot.isTimeConstrained && ' *'}
                                </div>
                              )}
                              {ot.estimatedArrival && (
                                <div style={{ color: '#16a34a' }}>
                                  {t('route_estimated_arrival')}: {ot.estimatedArrival}
                                </div>
                              )}
                              {ot.legDistance > 0 && (
                                <div style={{ color: '#64748b', marginTop: 2 }}>
                                  {formatDistance(ot.legDistance)} / {formatDuration(ot.legDuration)}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <i className="bi bi-geo-alt text-3xl block mb-2"></i>
                    {t('route_no_tasks')}
                  </div>
                </div>
              )}

              {/* Mobile navigation floating button removed - buttons are now in the toolbar */}
            </div>

            {/* Task List Panel */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col shrink-0 max-h-[35vh] md:max-h-none overflow-hidden">
              {/* Summary */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{t('route_overview')}</span>
                  <span className="text-slate-500">
                    {result.optimizedTasks.length} {t('route_stop')}
                  </span>
                </div>
                {result.totalDistance > 0 && (
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-600">
                    <span><i className="bi bi-signpost-2 mr-1"></i>{formatDistance(result.totalDistance)}</span>
                    <span><i className="bi bi-clock mr-1"></i>{formatDuration(result.totalDuration)}</span>
                  </div>
                )}
              </div>

              {/* Ordered task list */}
              <div className="flex-1 overflow-auto">
                {result.optimizedTasks.map((ot, idx) => {
                  const task = ot.task;
                  return (
                    <div key={task.id}
                      onClick={() => {
                        setSelectedIdx(idx);
                        setMapCenter({ lat: task.latitude, lng: task.longitude });
                      }}
                      className={`px-3 py-2.5 border-b border-slate-100 cursor-pointer transition-colors hover:bg-indigo-50/50 ${selectedIdx === idx ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Sequence number badge */}
                        <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: TYPE_COLOR[task.type] || '#6366f1' }}>
                          {ot.sequenceNumber}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Location / Area */}
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {task.locationName || getAreaName(task.schedule?.area)}
                          </div>

                          {/* Type + Time */}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold ${TYPE_BG[task.type]}`}>
                              {task.type === 'RELAY' ? t('type_relay') : task.type === 'COLLECTION' ? t('type_collection') : t('type_full_relay')}
                            </span>
                            {task.timeSlotStart && (
                              <span className="text-[10px] text-sky-700 font-mono">
                                <i className="bi bi-clock mr-0.5"></i>{task.timeSlotStart}~{task.timeSlotEnd}
                              </span>
                            )}
                          </div>

                          {/* Distributor */}
                          {task.schedule?.distributor?.name && (
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                              {task.schedule.distributor.name}
                              {task.schedule.distributor.staffId && ` (${task.schedule.distributor.staffId})`}
                            </div>
                          )}
                        </div>

                        {/* Leg info */}
                        <div className="shrink-0 text-right">
                          {ot.estimatedArrival && (
                            <div className="text-[10px] font-bold text-green-700">{ot.estimatedArrival}</div>
                          )}
                          {ot.legDistance > 0 && (
                            <div className="text-[9px] text-slate-400">{formatDistance(ot.legDistance)}</div>
                          )}
                        </div>
                      </div>

                      {/* Connector line (not on last item) */}
                      {idx < result.optimizedTasks.length - 1 && (
                        <div className="ml-3 mt-1 pl-[11px] border-l-2 border-dashed border-slate-200 h-1"></div>
                      )}
                    </div>
                  );
                })}

                {/* Skipped tasks */}
                {result.skippedTasks.length > 0 && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-200">
                    <div className="text-[10px] font-bold text-amber-700 mb-1">
                      <i className="bi bi-exclamation-triangle mr-1"></i>
                      {t('route_skipped_tasks')} ({result.skippedTasks.length})
                    </div>
                    {result.skippedTasks.map((task: any) => (
                      <div key={task.id} className="text-[10px] text-amber-600 truncate">
                        {task.locationName || task.schedule?.distributor?.name || `#${task.id}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No tasks */}
        {!loading && !error && result && result.optimizedTasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <i className="bi bi-geo-alt text-3xl block mb-2"></i>
              {t('route_no_tasks')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
