'use client';

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';
import { GoogleMap, useJsApiLoader, Marker, Polygon } from '@react-google-maps/api';

const TrajectoryViewer = lazy(() => import('@/components/schedules/TrajectoryViewer'));
const AllTrajectoriesViewer = lazy(() => import('@/components/schedules/AllTrajectoriesViewer'));

const getTodayStr = () => {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  // 0時〜3時は前日を表示
  if (jst.getHours() < 3) {
    jst.setDate(jst.getDate() - 1);
  }
  const yyyy = jst.getFullYear();
  const mm = String(jst.getMonth() + 1).padStart(2, '0');
  const dd = String(jst.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

const getCheckCount = (s: any) => {
  return (s.checkFlyerPhoto ? 1 : 0) + (s.checkAppOperation ? 1 : 0) + (s.checkGps ? 1 : 0) + (s.checkMapPhoto ? 1 : 0);
};

const getCheckBadgeClass = (count: number) => {
  if (count === 0) return 'bg-slate-100 text-slate-500';
  if (count === 4) return 'bg-emerald-100 text-emerald-700';
  return 'bg-amber-100 text-amber-700';
};

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: 'bg-blue-100 text-blue-700',
  DISTRIBUTING: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  UNSTARTED: 'bg-slate-100 text-slate-600',
};

const STATUS_DOT: Record<string, string> = {
  COMPLETED: 'bg-blue-400',
  DISTRIBUTING: 'bg-emerald-400',
  IN_PROGRESS: 'bg-amber-400',
  UNSTARTED: 'bg-slate-400',
};

function CompliancePopover({ schedule, onUpdate, t }: { schedule: any; onUpdate: (updated: any) => void; t: (key: string) => string }) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const checks = [
    { key: 'checkFlyerPhoto', icon: 'bi-camera', label: t('compliance_flyer_photo') },
    { key: 'checkAppOperation', icon: 'bi-phone', label: t('compliance_app_operation') },
    { key: 'checkGps', icon: 'bi-geo-alt', label: t('compliance_gps') },
    { key: 'checkMapPhoto', icon: 'bi-map', label: t('compliance_map_photo') },
  ];

  const toggleCheck = useCallback(async (field: string) => {
    const newValue = !schedule[field];
    setSaving(field);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(data);
      }
    } catch { /* silent */ }
    setSaving(null);
  }, [schedule, onUpdate]);

  return (
    <div ref={popoverRef} className="w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 space-y-2">
      {checks.map(({ key, icon, label }) => (
        <label key={key} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
          <input type="checkbox" checked={!!schedule[key]} onChange={() => toggleCheck(key)} disabled={saving === key}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600" />
          <i className={`bi ${icon} text-slate-500 text-sm`}></i>
          <span className="text-xs text-slate-700 flex-1">{label}</span>
          {saving === key && <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>}
        </label>
      ))}
      {schedule.checkedBy && (
        <div className="border-t border-slate-100 pt-2 mt-1 px-2 space-y-0.5">
          <div className="text-[10px] text-slate-400">
            {t('compliance_checked_by')}: <span className="text-slate-600">{schedule.checkedBy.lastNameJa} {schedule.checkedBy.firstNameJa}</span>
          </div>
          {schedule.checkedAt && (
            <div className="text-[10px] text-slate-400">
              {t('compliance_checked_at')}: <span className="text-slate-600">{new Date(schedule.checkedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusChangeModal({ schedule, onClose, onSave, t, getStatusKey }: {
  schedule: any;
  onClose: () => void;
  onSave: (id: number, status: string, items?: { id: number; actualCount: number }[]) => Promise<void>;
  t: (key: string) => string;
  getStatusKey: (status: string) => string;
}) {
  const [selectedStatus, setSelectedStatus] = useState<string>(schedule.status);
  const [saving, setSaving] = useState(false);
  const activeItems = (schedule.items || []).filter((item: any) => item.flyerName);
  const [itemCounts, setItemCounts] = useState<Record<number, string>>(() => {
    const counts: Record<number, string> = {};
    activeItems.forEach((item: any) => {
      counts[item.id] = item.actualCount != null ? String(item.actualCount) : String(item.plannedCount || 0);
    });
    return counts;
  });
  const handleSave = async () => {
    setSaving(true);
    const items = selectedStatus === 'COMPLETED'
      ? activeItems.map((item: any) => ({ id: item.id, actualCount: parseInt(itemCounts[item.id]) || 0 }))
      : undefined;
    await onSave(schedule.id, selectedStatus, items);
    setSaving(false);
  };

  const fillPlanned = () => {
    const counts: Record<number, string> = {};
    activeItems.forEach((item: any) => { counts[item.id] = String(item.plannedCount || 0); });
    setItemCounts(counts);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-w-md overflow-hidden flex flex-col md:block">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-base md:text-lg text-slate-800">
            <i className="bi bi-arrow-repeat text-indigo-500 mr-2"></i>{t('status_change_title')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="p-4 md:p-6 flex-1 md:flex-none overflow-auto space-y-4">
          {/* Schedule info */}
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-3">
            <span className="font-bold text-slate-700">{schedule.distributor?.name || '-'}</span>
            <span className="text-slate-300">|</span>
            <span>{formatAreaName(schedule.area?.town_name, schedule.area?.chome_name)}</span>
          </div>

          {/* Status selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600">{t('status_select_label')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['UNSTARTED', 'IN_PROGRESS', 'DISTRIBUTING', 'COMPLETED'] as const).map(st => (
                <button key={st} onClick={() => setSelectedStatus(st)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                    selectedStatus === st
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[st]}`}></span>
                  {t(getStatusKey(st))}
                </button>
              ))}
            </div>
          </div>

          {/* Flyer counts - only show when COMPLETED selected */}
          {selectedStatus === 'COMPLETED' && activeItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600">{t('status_actual_counts')}</label>
                <button onClick={fillPlanned} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold">
                  {t('status_fill_planned')}
                </button>
              </div>
              <div className="space-y-2">
                {activeItems.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-700 truncate">{item.flyerName}</div>
                      <div className="text-[10px] text-slate-400">{t('status_planned')}: {item.plannedCount?.toLocaleString() || 0}</div>
                    </div>
                    <input
                      type="number"
                      value={itemCounts[item.id] || ''}
                      onChange={e => setItemCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-24 text-right border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      min={0}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-4 md:px-6 py-3 md:py-4 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs md:text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">{t('cancel')}</button>
          <button onClick={handleSave} disabled={saving || selectedStatus === schedule.status}
            className="px-4 py-2 text-xs md:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors">
            {saving ? <span className="inline-flex items-center gap-1"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>{t('saving')}</span> : t('btn_save')}
          </button>
        </div>
      </div>
    </div>
  );
}

const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 6; // 6:00 ~ 20:00
  return { start: `${String(h).padStart(2, '0')}:00`, end: `${String(h + 1).padStart(2, '0')}:00`, label: `${h}:00〜${h + 1}:00` };
});

function RelayAddModal({ schedule, type, saving, onSave, onClose, t }: {
  schedule: any; type: 'RELAY' | 'COLLECTION' | 'FULL_RELAY'; saving: boolean;
  onSave: (data: any) => void; onClose: () => void; t: (key: string, params?: any) => string;
}) {
  const [formType, setFormType] = useState<'RELAY' | 'COLLECTION' | 'FULL_RELAY'>(type);
  const [driverId, setDriverId] = useState<number | null>(null);
  const [driverName, setDriverName] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [timeSlot, setTimeSlot] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [polygonPaths, setPolygonPaths] = useState<google.maps.LatLngLiteral[][]>([]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  useEffect(() => {
    fetch('/api/employees?active=true&limit=500').then(r => r.ok ? r.json() : []).then(data => {
      setEmployees(Array.isArray(data) ? data : data.data || []);
    });
  }, []);

  // エリアポリゴン取得（モーダルマウント時に即取得）
  useEffect(() => {
    if (!schedule.area?.id) return;
    fetch(`/api/areas/${schedule.area.id}`).then(r => r.ok ? r.json() : null).then(area => {
      if (!area?.boundary_geojson) return;
      try {
        const geo = typeof area.boundary_geojson === 'string' ? JSON.parse(area.boundary_geojson) : area.boundary_geojson;
        const paths: google.maps.LatLngLiteral[][] = [];
        const features = geo.features || [geo];
        for (const f of features) {
          const geom = f.geometry || f;
          if (geom.type === 'Polygon') {
            paths.push(geom.coordinates[0].map((c: number[]) => ({ lat: c[1], lng: c[0] })));
          } else if (geom.type === 'MultiPolygon') {
            for (const poly of geom.coordinates) {
              paths.push(poly[0].map((c: number[]) => ({ lat: c[1], lng: c[0] })));
            }
          }
        }
        setPolygonPaths(paths);
      } catch { /* silent */ }
    });
  }, [schedule.area?.id]);

  const filteredEmployees = employees.filter(e => {
    if (!driverSearch) return true;
    const name = `${e.lastNameJa || ''} ${e.firstNameJa || ''} ${e.employeeCode || ''}`.toLowerCase();
    return name.includes(driverSearch.toLowerCase());
  }).slice(0, 10);

  const handleSubmit = () => {
    const slot = TIME_SLOTS.find(s => s.label === timeSlot);
    onSave({
      type: formType,
      driverId: driverId || undefined,
      driverName: driverName || undefined,
      timeSlotStart: slot?.start || undefined,
      timeSlotEnd: slot?.end || undefined,
      locationName: locationName || undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      note: note || undefined,
    });
  };

  const handleShowMap = () => {
    setShowMap(true);
    if (!latitude && !longitude) {
      // エリアのポリゴン中心座標を使用（なければ都庁前フォールバック）
      if (polygonPaths.length > 0 && polygonPaths[0].length > 0) {
        const pts = polygonPaths[0];
        const avgLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
        const avgLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
        setLatitude(avgLat);
        setLongitude(avgLng);
      } else {
        // ポリゴンがまだ未取得の場合はエリアAPIから取得を試みる
        if (schedule.area?.id) {
          fetch(`/api/areas/${schedule.area.id}`).then(r => r.ok ? r.json() : null).then(area => {
            if (!area?.boundary_geojson) { setLatitude(35.6895); setLongitude(139.6917); return; }
            try {
              const geo = typeof area.boundary_geojson === 'string' ? JSON.parse(area.boundary_geojson) : area.boundary_geojson;
              const pts: { lat: number; lng: number }[] = [];
              const features = geo.features || [geo];
              for (const f of features) {
                const geom = f.geometry || f;
                if (geom.type === 'Polygon') {
                  geom.coordinates[0].forEach((c: number[]) => pts.push({ lat: c[1], lng: c[0] }));
                } else if (geom.type === 'MultiPolygon') {
                  for (const poly of geom.coordinates) {
                    poly[0].forEach((c: number[]) => pts.push({ lat: c[1], lng: c[0] }));
                  }
                }
              }
              if (pts.length > 0) {
                setLatitude(pts.reduce((s, p) => s + p.lat, 0) / pts.length);
                setLongitude(pts.reduce((s, p) => s + p.lng, 0) / pts.length);
              } else {
                setLatitude(35.6895); setLongitude(139.6917);
              }
            } catch { setLatitude(35.6895); setLongitude(139.6917); }
          });
        } else {
          setLatitude(35.6895);
          setLongitude(139.6917);
        }
      }
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      setLatitude(pos.coords.latitude);
      setLongitude(pos.coords.longitude);
      setShowMap(true);
    });
  };

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setLatitude(e.latLng.lat());
      setLongitude(e.latLng.lng());
    }
  }, []);

  const areaName = `${schedule.area?.city?.prefecture?.name || ''}${schedule.area?.city?.name || ''}${formatAreaName(schedule.area?.town_name, schedule.area?.chome_name)}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-w-lg overflow-hidden flex flex-col max-h-full md:max-h-[90vh]">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-base text-slate-800">
            <i className={`bi ${formType === 'COLLECTION' ? 'bi-box-arrow-in-left text-purple-500' : formType === 'FULL_RELAY' ? 'bi-truck text-green-500' : 'bi-truck text-orange-500'} mr-2`}></i>
            {formType === 'RELAY' ? t('add_relay') : formType === 'FULL_RELAY' ? t('add_full_relay') : t('add_collection')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="p-4 md:p-6 space-y-4 flex-1 overflow-auto">
          {/* Schedule info */}
          <div className="text-xs bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-2 text-slate-600">
            <span className="font-bold text-slate-700">{schedule.distributor?.name || '-'}</span>
            <span className="text-slate-300">|</span>
            <span>{areaName}</span>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_type') || '種別'}</label>
            <div className="flex gap-2">
              <button onClick={() => setFormType('RELAY')}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${formType === 'RELAY' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <i className="bi bi-truck mr-1"></i>{t('type_relay') || '中継'}
              </button>
              <button onClick={() => setFormType('FULL_RELAY')}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${formType === 'FULL_RELAY' ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <i className="bi bi-truck mr-1"></i>{t('type_full_relay') || '全中継'}
              </button>
              <button onClick={() => setFormType('COLLECTION')}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${formType === 'COLLECTION' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <i className="bi bi-box-arrow-in-left mr-1"></i>{t('type_collection') || '回収'}
              </button>
            </div>
          </div>

          {/* Driver */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_driver') || '担当者（社員）'}</label>
            <div className="relative">
              <input type="text" value={driverSearch} onChange={e => { setDriverSearch(e.target.value); setDriverId(null); }}
                placeholder={t('field_driver_placeholder') || '社員を検索...'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
              {driverSearch && !driverId && filteredEmployees.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-auto">
                  {filteredEmployees.map(e => (
                    <button key={e.id} onClick={() => { setDriverId(e.id); setDriverSearch(`${e.lastNameJa} ${e.firstNameJa}`); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2">
                      <span className="text-slate-400">{e.employeeCode}</span>
                      <span className="font-bold">{e.lastNameJa} {e.firstNameJa}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)}
              placeholder={t('field_driver_name_placeholder') || '業務委託等の場合に入力'}
              className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
          </div>

          {/* Time slot */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_time_slot') || '到着時間枠'}</label>
            <select value={timeSlot} onChange={e => setTimeSlot(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400">
              <option value="">-</option>
              {TIME_SLOTS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_location') || '場所'}</label>
            <input type="text" value={locationName} onChange={e => setLocationName(e.target.value)}
              placeholder={t('field_location_placeholder') || '場所を入力 or 地図で指定'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
            <div className="flex gap-2 mt-2">
              <button onClick={handleShowMap} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-1 transition-colors">
                <i className="bi bi-map"></i>{t('btn_set_location') || '地図で指定'}
              </button>
              <button onClick={handleCurrentLocation} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-1 transition-colors">
                <i className="bi bi-crosshair"></i>{t('btn_current_location') || '現在地を使用'}
              </button>
            </div>
            {latitude && longitude && (
              <div className="text-[10px] text-slate-400 mt-1">
                <i className="bi bi-pin-map mr-1"></i>{latitude.toFixed(6)}, {longitude.toFixed(6)}
              </div>
            )}
            {showMap && isLoaded && latitude && longitude && (
              <div className="w-full h-48 mt-2 rounded-lg border border-slate-200 overflow-hidden">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={{ lat: latitude, lng: longitude }}
                  zoom={15}
                  onClick={handleMapClick}
                  options={{ disableDefaultUI: true, zoomControl: true }}
                >
                  <Marker position={{ lat: latitude, lng: longitude }} draggable
                    onDragEnd={(e) => { if (e.latLng) { setLatitude(e.latLng.lat()); setLongitude(e.latLng.lng()); } }} />
                  {polygonPaths.map((path, i) => (
                    <Polygon key={i} paths={path}
                      options={{ fillColor: '#6366f1', fillOpacity: 0.15, strokeColor: '#6366f1', strokeWeight: 2 }} />
                  ))}
                </GoogleMap>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_note') || 'メモ'}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder={t('field_note_placeholder') || 'メモを入力...'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 resize-none" />
          </div>
        </div>
        <div className="px-4 md:px-6 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            {t('cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? <><i className="bi bi-arrow-repeat animate-spin mr-1"></i></> : <><i className="bi bi-check-lg mr-1"></i>{t('btn_save') || '保存'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleListPage() {
  const { t } = useTranslation('schedules');
  const { showToast, showConfirm } = useNotification();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [remarksInput, setRemarksInput] = useState('');
  const [trajectoryScheduleId, setTrajectoryScheduleId] = useState<number | null>(null);
  const [compliancePopoverId, setCompliancePopoverId] = useState<number | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [relayAddSchedule, setRelayAddSchedule] = useState<{ schedule: any; type: 'RELAY' | 'COLLECTION' | 'FULL_RELAY' } | null>(null);
  const [relaySaving, setRelaySaving] = useState(false);
  const popoverContainerRef = useRef<HTMLDivElement>(null);
  const complianceBtnRef = useRef<HTMLButtonElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // 配布員割り当てモーダル
  const [assignSchedule, setAssignSchedule] = useState<any>(null);
  const [assignMode, setAssignMode] = useState<'shift' | 'all'>('shift');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignCandidates, setAssignCandidates] = useState<any[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [shiftDistributorIds, setShiftDistributorIds] = useState<Set<number>>(new Set());
  const [statusModalSchedule, setStatusModalSchedule] = useState<any>(null);
  const [showAllTrajectories, setShowAllTrajectories] = useState(false);

  // 配布員だけ割り当てモーダル
  const [showAddDistModal, setShowAddDistModal] = useState(false);
  const [addDistCandidates, setAddDistCandidates] = useState<any[]>([]);
  const [addDistLoading, setAddDistLoading] = useState(false);
  const [addDistSearch, setAddDistSearch] = useState('');
  const [addDistMode, setAddDistMode] = useState<'shift' | 'all'>('shift');
  const [addDistShiftIds, setAddDistShiftIds] = useState<Set<number>>(new Set());
  const [addDistSaving, setAddDistSaving] = useState(false);

  // ポップオーバー/メニュー外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (compliancePopoverId !== null && popoverContainerRef.current && !popoverContainerRef.current.contains(e.target as Node)) {
        setCompliancePopoverId(null);
      }
      if (actionMenuId !== null && actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    };
    // clickイベントで登録（mousedownだとメニュー内ボタンのonClickより先に発火してメニューが消える）
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [compliancePopoverId, actionMenuId]);

  const fetchSchedules = async (dateStr: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/schedules?date=${dateStr}`);
      if (res.ok) setSchedules(await res.json());
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { if (filterDate) fetchSchedules(filterDate); }, [filterDate]);

  const saveRemarks = async () => {
    if (!editingSchedule) return;
    try {
      const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: remarksInput })
      });
      if (res.ok) {
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? { ...s, remarks: remarksInput } : s));
        setEditingSchedule(null);
      } else {
        showToast(t('save_remarks_error'), 'error');
      }
    } catch { showToast(t('communication_error'), 'error'); }
  };

  const handleComplianceUpdate = useCallback((updated: any) => {
    setSchedules(prev => prev.map(s =>
      s.id === updated.id
        ? { ...s, checkFlyerPhoto: updated.checkFlyerPhoto, checkAppOperation: updated.checkAppOperation, checkGps: updated.checkGps, checkMapPhoto: updated.checkMapPhoto, checkedBy: updated.checkedBy, checkedAt: updated.checkedAt, checkedById: updated.checkedById }
        : s
    ));
  }, []);

  const handleStatusChange = useCallback(async (scheduleId: number, newStatus: string, items?: { id: number; actualCount: number }[]) => {
    try {
      const body: any = { status: newStatus };
      if (items) body.items = items;
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const updated = await res.json();
        setSchedules(prev => prev.map(s => s.id === scheduleId
          ? { ...s, status: newStatus, items: updated.items || s.items }
          : s
        ));
        setStatusModalSchedule(null);
      } else {
        showToast(t('communication_error'), 'error');
      }
    } catch { showToast(t('communication_error'), 'error'); }
  }, [showToast, t]);

  // 配布員を外す
  const handleUnassign = async (schedule: any) => {
    setActionMenuId(null);
    if (!await showConfirm(t('unassign_confirm', { name: schedule.distributor?.name || '-' }), { variant: 'warning', confirmLabel: t('unassign_btn') })) return;
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributorId: null }),
      });
      if (res.ok) {
        setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, distributor: null, distributorId: null } : s));
        showToast(t('unassign_success'), 'success');
      } else {
        showToast(t('communication_error'), 'error');
      }
    } catch { showToast(t('communication_error'), 'error'); }
  };

  // スケジュール削除
  const handleDelete = async (schedule: any) => {
    setActionMenuId(null);
    if (!await showConfirm(t('delete_confirm'), { variant: 'danger', confirmLabel: t('delete_btn') })) return;
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSchedules(prev => prev.filter(s => s.id !== schedule.id));
        showToast(t('delete_success'), 'success');
      } else {
        showToast(t('communication_error'), 'error');
      }
    } catch { showToast(t('communication_error'), 'error'); }
  };

  // 中継/回収タスク作成
  const handleCreateRelay = async (data: { type: string; driverId?: number; driverName?: string; timeSlotStart?: string; timeSlotEnd?: string; locationName?: string; latitude?: number; longitude?: number; note?: string }) => {
    if (!relayAddSchedule) return;
    setRelaySaving(true);
    try {
      const res = await fetch('/api/relay-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: relayAddSchedule.schedule.id, ...data }),
      });
      if (res.ok) {
        const task = await res.json();
        setSchedules(prev => prev.map(s => s.id === relayAddSchedule.schedule.id
          ? { ...s, relayTasks: [...(s.relayTasks || []), { id: task.id, type: task.type, status: task.status }] }
          : s
        ));
        showToast(t('save_success'), 'success');
        setRelayAddSchedule(null);
      } else {
        showToast(t('communication_error'), 'error');
      }
    } catch { showToast(t('communication_error'), 'error'); }
    setRelaySaving(false);
  };

  // 配布員割り当てモーダルを開く
  const openAssignModal = useCallback(async (schedule: any) => {
    setAssignSchedule(schedule);
    setAssignSearch('');
    setAssignMode('shift');
    setAssignCandidates([]);
    setAssignLoading(true);

    try {
      // 当日シフトの配布員を取得
      const shiftRes = await fetch(`/api/distributor-shifts?dateFrom=${filterDate}&dateTo=${filterDate}&status=WORKING&limit=200`);
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json();
        const ids = new Set<number>((shiftData.data || []).map((s: any) => s.distributorId));
        setShiftDistributorIds(ids);
      }
      // 全配布員を取得
      const distRes = await fetch('/api/distributors');
      if (distRes.ok) {
        const distData = await distRes.json();
        const active = (distData || []).filter((d: any) => d.isActive !== false && !d.leaveDate);
        setAssignCandidates(active);
      }
    } catch { /* silent */ }
    setAssignLoading(false);
  }, [filterDate]);

  // 配布員を割り当て
  const handleAssign = async (distributorId: number) => {
    if (!assignSchedule) return;
    try {
      const res = await fetch(`/api/schedules/${assignSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributorId }),
      });
      if (res.ok) {
        const selected = assignCandidates.find(d => d.id === distributorId);
        setSchedules(prev => prev.map(s => s.id === assignSchedule.id
          ? { ...s, distributorId, distributor: selected ? { id: selected.id, name: selected.name, staffId: selected.staffId } : s.distributor }
          : s
        ));
        showToast(t('assign_success'), 'success');
        setAssignSchedule(null);
      } else {
        showToast(t('communication_error'), 'error');
      }
    } catch { showToast(t('communication_error'), 'error'); }
  };

  // 割り当てモーダル内のフィルタ済み候補
  const filteredCandidates = assignCandidates.filter(d => {
    if (assignMode === 'shift' && !shiftDistributorIds.has(d.id)) return false;
    if (assignSearch) {
      const q = assignSearch.toLowerCase();
      const target = `${d.name || ''} ${d.staffId || ''}`.toLowerCase();
      if (!target.includes(q)) return false;
    }
    return true;
  });

  // 配布員追加モーダルを開く
  const openAddDistModal = useCallback(async () => {
    setShowAddDistModal(true);
    setAddDistSearch('');
    setAddDistMode('shift');
    setAddDistCandidates([]);
    setAddDistLoading(true);
    try {
      const shiftRes = await fetch(`/api/distributor-shifts?dateFrom=${filterDate}&dateTo=${filterDate}&status=WORKING&limit=200`);
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json();
        const ids = new Set<number>((shiftData.data || []).map((s: any) => s.distributorId));
        setAddDistShiftIds(ids);
      }
      const distRes = await fetch('/api/distributors');
      if (distRes.ok) {
        const distData = await distRes.json();
        const active = (distData || []).filter((d: any) => d.isActive !== false && !d.leaveDate);
        setAddDistCandidates(active);
      }
    } catch { /* silent */ }
    setAddDistLoading(false);
  }, [filterDate]);

  // 配布員だけのスケジュールを作成
  const handleAddDistSchedule = async (distributorId: number) => {
    setAddDistSaving(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: filterDate,
          distributorId,
        }),
      });
      if (res.ok) {
        showToast(t('add_dist_success'), 'success');
        setShowAddDistModal(false);
        fetchSchedules(filterDate);
      } else {
        showToast(t('communication_error'), 'error');
      }
    } catch { showToast(t('communication_error'), 'error'); }
    setAddDistSaving(false);
  };

  const addDistFilteredCandidates = addDistCandidates.filter(d => {
    if (addDistMode === 'shift' && !addDistShiftIds.has(d.id)) return false;
    if (addDistSearch) {
      const q = addDistSearch.toLowerCase();
      const target = `${d.name || ''} ${d.staffId || ''}`.toLowerCase();
      if (!target.includes(q)) return false;
    }
    return true;
  });

  // 配布員だけのスケジュールかを判定（エリアなし＆チラシなし）
  const isDistOnlySchedule = (s: any) => !s.areaId && (!s.items || s.items.length === 0 || s.items.every((i: any) => !i.flyerName));

  const filteredSchedules = schedules.filter(s => {
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const flyerNames = s.items.map((i: any) => i.flyerName).join(' ');
      const searchTarget = `${s.distributor?.name || ''} ${s.distributor?.staffId || ''} ${s.city?.name || s.area?.city?.name || ''} ${s.area?.town_name || ''} ${s.area?.chome_name || ''} ${flyerNames}`.toLowerCase();
      if (!searchTarget.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    // 1. 全中継（FULL_RELAY）があるスケジュールを最上位
    const aHasFullRelay = (a.relayTasks || []).some((r: any) => r.type === 'FULL_RELAY');
    const bHasFullRelay = (b.relayTasks || []).some((r: any) => r.type === 'FULL_RELAY');
    if (aHasFullRelay && !bHasFullRelay) return -1;
    if (!aHasFullRelay && bHasFullRelay) return 1;

    // 2. 支店名でソート（高田馬場を最上位）
    const aBranch = a.branch?.nameJa || '';
    const bBranch = b.branch?.nameJa || '';
    const aIsTop = aBranch.includes('高田馬場') ? 0 : 1;
    const bIsTop = bBranch.includes('高田馬場') ? 0 : 1;
    if (aIsTop !== bIsTop) return aIsTop - bIsTop;
    return aBranch.localeCompare(bBranch, 'ja');
  });

  const getStatusKey = (status: string) => {
    if (status === 'COMPLETED') return 'status_completed';
    if (status === 'DISTRIBUTING') return 'status_distributing';
    if (status === 'IN_PROGRESS') return 'status_in_progress';
    return 'status_unstarted';
  };

  return (
    <div className="space-y-4 md:space-y-5 h-[calc(100vh-6rem)] flex flex-col">
      {/* Filters */}
      <div className="flex-none">
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_date')}</label>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="flex-1 md:flex-none">
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none md:min-w-[120px]">
                <option value="ALL">{t('status_all')}</option>
                <option value="UNSTARTED">{t('status_unstarted')}</option>
                <option value="IN_PROGRESS">{t('status_in_progress')}</option>
                <option value="DISTRIBUTING">{t('status_distributing')}</option>
                <option value="COMPLETED">{t('status_completed')}</option>
              </select>
            </div>
          </div>
          <div className="flex-1 min-w-0 md:min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_keyword')}</label>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
              <input type="text" placeholder={t('search_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-3 md:ml-auto flex-wrap">
            {/* Summary stats */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
                <i className="bi bi-people-fill text-slate-500"></i>
                {t('summary_workers')}: {new Set(filteredSchedules.filter(s => s.distributorId).map(s => s.distributorId)).size}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg text-xs font-bold text-amber-700">
                <i className="bi bi-file-earmark text-amber-500"></i>
                {t('summary_main_count')}: {filteredSchedules.reduce((sum, s) => {
                  const slot1 = (s.items || []).find((item: any) => item.slotIndex === 1);
                  return sum + (slot1?.plannedCount || 0);
                }, 0).toLocaleString()}
              </span>
            </div>
            <button onClick={openAddDistModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">
              <i className="bi bi-person-plus-fill"></i>{t('add_dist_btn')}
            </button>
            <button onClick={() => setShowAllTrajectories(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
              <i className="bi bi-map"></i>{t('all_traj_btn')}
            </button>
            <span className="text-xs text-slate-400">
              {filteredSchedules.length} {t('results_count')}
            </span>
          </div>
        </div>
      </div>

      {/* ===== Desktop table (redesigned compact) ===== */}
      <div className="hidden md:flex flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 z-20">
              <tr>
                <th className="px-3 py-2.5 w-[80px]">{t('th_status')}</th>
                <th className="px-3 py-2.5">{t('th_staff_name')}</th>
                <th className="px-3 py-2.5">{t('th_branch')}</th>
                <th className="px-3 py-2.5">{t('th_area')}</th>
                <th className="px-3 py-2.5">{t('th_flyers')}</th>
                <th className="px-3 py-2.5 w-[60px] text-center">{t('th_relay')}</th>
                <th className="px-3 py-2.5 w-[60px] text-center">{t('th_compliance')}</th>
                <th className="px-3 py-2.5 w-[80px] text-center">{t('th_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchedules.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <i className="bi bi-calendar-x text-3xl block mb-2"></i>
                    {t('no_results')}
                  </td>
                </tr>
              )}
              {filteredSchedules.map(s => {
                const cityName = s.city?.name || s.area?.city?.name || '';
                const prefName = s.area?.prefecture?.name || '';
                const displayAreaName = formatAreaName(s.area?.town_name, s.area?.chome_name);
                const checkCount = getCheckCount(s);
                const activeFlyers = (s.items || []).filter((f: any) => f.flyerName);
                const totalPlanned = activeFlyers.reduce((sum: number, f: any) => sum + (f.plannedCount || 0), 0);
                const totalActual = activeFlyers.reduce((sum: number, f: any) => sum + (f.actualCount || 0), 0);

                const isDistOnly = isDistOnlySchedule(s);

                return (
                  <tr key={s.id}
                    onClick={() => (s.status === 'DISTRIBUTING' || s.status === 'COMPLETED') && setTrajectoryScheduleId(s.id)}
                    className={`transition-colors group ${isDistOnly ? 'bg-red-50 hover:bg-red-100/80' : 'hover:bg-slate-50/80'} ${(s.status === 'DISTRIBUTING' || s.status === 'COMPLETED') ? 'cursor-pointer' : ''}`}>
                    {/* Status */}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setStatusModalSchedule(s)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLE[s.status] || STATUS_STYLE.UNSTARTED}`}
                      >
                        {s.status === 'DISTRIBUTING' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
                        {t(getStatusKey(s.status))}
                      </button>
                    </td>

                    {/* Distributor */}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      {s.distributor ? (
                        <div className="flex items-center gap-1.5 group/dist">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-xs">{s.distributor.name}</div>
                            <div className="text-[10px] text-slate-400">{s.distributor.staffId}</div>
                          </div>
                          {s.status !== 'DISTRIBUTING' && s.status !== 'COMPLETED' && (
                            <button onClick={() => openAssignModal(s)}
                              className="shrink-0 opacity-0 group-hover/dist:opacity-100 text-[10px] text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-all">
                              <i className="bi bi-arrow-repeat"></i>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => openAssignModal(s)}
                          className="text-indigo-400 hover:text-indigo-600 italic text-xs hover:bg-indigo-50 px-2 py-1 rounded transition-colors">
                          <i className="bi bi-person-plus text-[10px] mr-1"></i>{t('unassigned')}
                        </button>
                      )}
                    </td>

                    {/* Branch */}
                    <td className="px-3 py-2.5 text-slate-600">{s.branch?.nameJa || '-'}</td>

                    {/* Area (combined) */}
                    <td className="px-3 py-2.5">
                      {isDistOnly ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                          <i className="bi bi-exclamation-triangle-fill"></i>{t('needs_schedule_assignment')}
                        </span>
                      ) : (
                        <>
                          <div className="text-xs text-slate-700">{displayAreaName !== '-' ? `${cityName} ${displayAreaName}` : cityName || '-'}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            {prefName && <span>{prefName}</span>}
                            {s.area?.door_to_door_count > 0 && (
                              <span className="text-emerald-600 font-bold">{s.area.door_to_door_count.toLocaleString()}{t('th_capacity_unit')}</span>
                            )}
                          </div>
                        </>
                      )}
                    </td>

                    {/* Flyers (compact) */}
                    <td className="px-3 py-2.5">
                      {activeFlyers.length === 0 ? (
                        <span className={isDistOnly ? 'text-red-300' : 'text-slate-300'}>-</span>
                      ) : (
                        <div className="space-y-0.5">
                          {activeFlyers.map((f: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <span className="truncate max-w-[220px] text-slate-700" title={f.flyerName}>{f.flyerName}</span>
                              <span className="shrink-0 text-slate-400 text-[10px]">{f.plannedCount?.toLocaleString() || 0}</span>
                              {f.actualCount != null && (
                                <>
                                  <span className="text-slate-300">/</span>
                                  <span className="shrink-0 font-bold text-indigo-600 text-[10px]">{f.actualCount.toLocaleString()}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Relay */}
                    <td className="px-3 py-2.5 text-center">
                      {(() => {
                        const relays = (s.relayTasks || []).filter((r: any) => r.type === 'RELAY');
                        const fullRelays = (s.relayTasks || []).filter((r: any) => r.type === 'FULL_RELAY');
                        const collections = (s.relayTasks || []).filter((r: any) => r.type === 'COLLECTION');
                        const pendingRelays = relays.filter((r: any) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
                        const pendingFullRelays = fullRelays.filter((r: any) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
                        const pendingCollections = collections.filter((r: any) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
                        if (pendingRelays.length === 0 && pendingFullRelays.length === 0 && pendingCollections.length === 0 && relays.length === 0 && fullRelays.length === 0 && collections.length === 0) {
                          return <span className="text-slate-300 text-[10px]">-</span>;
                        }
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            {pendingRelays.length > 0 && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                pendingRelays.some((r: any) => r.status === 'IN_PROGRESS') ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                              }`}>
                                <i className="bi bi-truck text-[8px]"></i>
                                {pendingRelays.some((r: any) => r.status === 'IN_PROGRESS') ? t('relay_in_progress') : t('relay_pending')}
                              </span>
                            )}
                            {pendingFullRelays.length > 0 && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                pendingFullRelays.some((r: any) => r.status === 'IN_PROGRESS') ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                              }`}>
                                <i className="bi bi-truck text-[8px]"></i>
                                {pendingFullRelays.some((r: any) => r.status === 'IN_PROGRESS') ? t('full_relay_in_progress') : t('full_relay_pending')}
                              </span>
                            )}
                            {pendingCollections.length > 0 && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                pendingCollections.some((r: any) => r.status === 'IN_PROGRESS') ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                <i className="bi bi-box-arrow-in-left text-[8px]"></i>
                                {pendingCollections.some((r: any) => r.status === 'IN_PROGRESS') ? t('collection_in_progress') : t('collection_pending')}
                              </span>
                            )}
                            {pendingRelays.length === 0 && pendingFullRelays.length === 0 && pendingCollections.length === 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600">
                                <i className="bi bi-check-circle text-[8px]"></i>
                                {relays.length + fullRelays.length + collections.length}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Compliance */}
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        ref={compliancePopoverId === s.id ? complianceBtnRef : undefined}
                        onClick={() => setCompliancePopoverId(compliancePopoverId === s.id ? null : s.id)}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors hover:opacity-80 ${getCheckBadgeClass(checkCount)}`}
                      >
                        <i className="bi bi-check2-square text-[10px]"></i>
                        {checkCount}/4
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* GPS */}
                        <button
                          onClick={() => (s.status === 'DISTRIBUTING' || s.status === 'COMPLETED') && setTrajectoryScheduleId(s.id)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            s.status === 'DISTRIBUTING' ? 'text-emerald-500 hover:bg-emerald-50 animate-pulse'
                            : s.status === 'COMPLETED' ? 'text-blue-500 hover:bg-blue-50'
                            : 'text-slate-300 cursor-not-allowed'
                          }`}
                          title={s.status === 'DISTRIBUTING' ? t('gps_realtime') : s.status === 'COMPLETED' ? t('gps_trajectory') : t('gps_not_started')}
                        >
                          <i className="bi bi-geo-alt-fill text-sm"></i>
                        </button>

                        {/* More actions */}
                        <div className="relative">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === s.id ? null : s.id)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <i className="bi bi-three-dots-vertical text-sm"></i>
                          </button>
                          {actionMenuId === s.id && (
                            <div ref={actionMenuRef} className="absolute top-full right-0 mt-1 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-44">
                              <button onClick={() => { setEditingSchedule(s); setRemarksInput(s.remarks || ''); setActionMenuId(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-700">
                                <i className={`bi ${s.remarks ? 'bi-chat-text-fill text-amber-500' : 'bi-chat-text text-slate-400'}`}></i>
                                {t('remarks_edit_title')}
                              </button>
                              <button onClick={() => { setRelayAddSchedule({ schedule: s, type: 'RELAY' }); setActionMenuId(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-orange-600">
                                <i className="bi bi-truck"></i>
                                {t('add_relay')}
                              </button>
                              <button onClick={() => { setRelayAddSchedule({ schedule: s, type: 'FULL_RELAY' }); setActionMenuId(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-green-600">
                                <i className="bi bi-truck"></i>
                                {t('add_full_relay')}
                              </button>
                              <button onClick={() => { setRelayAddSchedule({ schedule: s, type: 'COLLECTION' }); setActionMenuId(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-purple-600">
                                <i className="bi bi-box-arrow-in-left"></i>
                                {t('add_collection')}
                              </button>
                              {s.distributor && s.status !== 'DISTRIBUTING' && s.status !== 'COMPLETED' && (
                                <button onClick={() => handleUnassign(s)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 flex items-center gap-2 text-amber-600">
                                  <i className="bi bi-person-dash"></i>
                                  {t('unassign_distributor')}
                                </button>
                              )}
                              {s.status !== 'DISTRIBUTING' && s.status !== 'COMPLETED' && (
                                <button onClick={() => handleDelete(s)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 flex items-center gap-2 text-red-600">
                                  <i className="bi bi-trash3"></i>
                                  {t('delete_schedule')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Popover (fixed position portal) */}
      {compliancePopoverId !== null && (() => {
        const s = schedules.find(x => x.id === compliancePopoverId);
        if (!s) return null;
        const rect = complianceBtnRef.current?.getBoundingClientRect();
        const style: React.CSSProperties = rect
          ? { position: 'fixed', top: rect.bottom + 4, right: window.innerWidth - rect.right, zIndex: 100 }
          : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 };
        return (
          <div ref={popoverContainerRef} style={style}>
            <CompliancePopover schedule={s} onUpdate={handleComplianceUpdate} t={t} />
          </div>
        );
      })()}

      {/* ===== Mobile card list ===== */}
      <div className="md:hidden flex-1 overflow-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}
        {!isLoading && filteredSchedules.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">{t('no_results')}</div>
        )}
        <div className="p-3 space-y-3">
          {filteredSchedules.map(s => {
            const activeFlyers = (s.items || []).filter((f: any) => f.flyerName);
            const cityName = s.city?.name || s.area?.city?.name || '-';
            const displayAreaName = formatAreaName(s.area?.town_name, s.area?.chome_name);
            const checkCount = getCheckCount(s);
            const isDistOnly = isDistOnlySchedule(s);

            return (
              <div key={s.id} className={`rounded-xl border p-4 shadow-sm space-y-2.5 ${isDistOnly ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                {/* Row 1: Status + Distributor + Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setStatusModalSchedule(s)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${STATUS_STYLE[s.status] || STATUS_STYLE.UNSTARTED}`}
                    >
                      {s.status === 'DISTRIBUTING' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
                      {t(getStatusKey(s.status))}
                    </button>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${getCheckBadgeClass(checkCount)}`}>
                      <i className="bi bi-check2-square text-[10px]"></i>{checkCount}/4
                    </span>
                    {s.distributor ? (
                      <span className="font-bold text-sm text-slate-800 truncate">{s.distributor.name}</span>
                    ) : (
                      <button onClick={() => openAssignModal(s)} className="text-indigo-400 hover:text-indigo-600 italic text-xs">
                        <i className="bi bi-person-plus mr-1"></i>{t('unassigned')}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => (s.status === 'DISTRIBUTING' || s.status === 'COMPLETED') && setTrajectoryScheduleId(s.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        s.status === 'DISTRIBUTING' ? 'bg-emerald-100 text-emerald-500 animate-pulse'
                        : s.status === 'COMPLETED' ? 'bg-blue-100 text-blue-500'
                        : 'bg-slate-100 text-slate-300'
                      }`}
                    >
                      <i className="bi bi-geo-alt-fill text-sm"></i>
                    </button>
                    <button onClick={() => { setEditingSchedule(s); setRemarksInput(s.remarks || ''); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${s.remarks ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      <i className={`bi ${s.remarks ? 'bi-chat-text-fill' : 'bi-chat-text'} text-sm`}></i>
                    </button>
                    {s.status !== 'DISTRIBUTING' && s.status !== 'COMPLETED' && (
                      <button onClick={() => setActionMenuId(actionMenuId === s.id ? null : s.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
                        <i className="bi bi-three-dots-vertical text-sm"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile action menu */}
                {actionMenuId === s.id && (
                  <div ref={actionMenuRef} className="flex gap-2 p-2 bg-slate-50 rounded-lg">
                    {s.distributor && (
                      <button onClick={() => handleUnassign(s)}
                        className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-amber-50 text-amber-700 font-bold flex items-center justify-center gap-1">
                        <i className="bi bi-person-dash"></i>{t('unassign_distributor')}
                      </button>
                    )}
                    <button onClick={() => handleDelete(s)}
                      className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-red-50 text-red-700 font-bold flex items-center justify-center gap-1">
                      <i className="bi bi-trash3"></i>{t('delete_schedule')}
                    </button>
                  </div>
                )}

                {/* Row 2: Branch + Staff code */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">{s.branch?.nameJa || '-'}</span>
                  {s.distributor?.staffId && <><span className="text-slate-300">|</span><span className="shrink-0">{s.distributor.staffId}</span></>}
                </div>

                {/* Row 3: Area info */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  {isDistOnly ? (
                    <>
                      <i className="bi bi-exclamation-triangle-fill text-red-500 shrink-0"></i>
                      <span className="font-bold text-red-600">{t('needs_schedule_assignment')}</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-geo text-slate-400 shrink-0"></i>
                      <span className="truncate">{cityName} {displayAreaName}</span>
                      <span className="text-emerald-600 font-bold shrink-0 ml-auto">{s.area?.door_to_door_count?.toLocaleString() || '-'}</span>
                    </>
                  )}
                </div>

                {/* Row 4: Flyer list */}
                {activeFlyers.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    {activeFlyers.map((flyer: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 truncate mr-2">{flyer.flyerName}</span>
                        <div className="flex items-center gap-2 shrink-0 text-slate-500">
                          <span>{flyer.plannedCount?.toLocaleString() || '-'}</span>
                          <span className="text-slate-300">/</span>
                          <span className="font-bold text-indigo-600">{flyer.actualCount !== null ? flyer.actualCount.toLocaleString() : '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Row 5: Compliance checklist */}
                <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
                  {[
                    { key: 'checkFlyerPhoto', icon: 'bi-camera', label: t('compliance_flyer_photo') },
                    { key: 'checkAppOperation', icon: 'bi-phone', label: t('compliance_app_operation') },
                    { key: 'checkGps', icon: 'bi-geo-alt', label: t('compliance_gps') },
                    { key: 'checkMapPhoto', icon: 'bi-map', label: t('compliance_map_photo') },
                  ].map(({ key, icon, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={!!s[key]}
                        onChange={async () => {
                          try {
                            const res = await fetch(`/api/schedules/${s.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ [key]: !s[key] }),
                            });
                            if (res.ok) handleComplianceUpdate(await res.json());
                          } catch {}
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 accent-indigo-600" />
                      <i className={`bi ${icon} text-slate-400 text-[10px]`}></i>
                      <span className="text-[10px] text-slate-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assign Distributor Modal */}
      {assignSchedule && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-w-lg overflow-hidden flex flex-col md:block md:max-h-[80vh]">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base md:text-lg text-slate-800">
                <i className="bi bi-person-plus text-indigo-500 mr-2"></i>{t('assign_title')}
              </h3>
              <button onClick={() => setAssignSchedule(null)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="px-4 md:px-6 pt-3 space-y-3 shrink-0">
              {/* Schedule info */}
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-3">
                <span>{assignSchedule.branch?.nameJa || '-'}</span>
                <span className="text-slate-300">|</span>
                <span>{formatAreaName(assignSchedule.area?.town_name, assignSchedule.area?.chome_name)}</span>
                {assignSchedule.distributor && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-600 font-bold">{assignSchedule.distributor.name}</span>
                  </>
                )}
              </div>
              {/* Mode toggle */}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setAssignMode('shift')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${assignMode === 'shift' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <i className="bi bi-calendar-check mr-1"></i>{t('assign_mode_shift')}
                  <span className="ml-1 opacity-60">({assignCandidates.filter(d => shiftDistributorIds.has(d.id)).length})</span>
                </button>
                <button
                  onClick={() => setAssignMode('all')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${assignMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <i className="bi bi-people mr-1"></i>{t('assign_mode_all')}
                  <span className="ml-1 opacity-60">({assignCandidates.length})</span>
                </button>
              </div>
              {/* Search */}
              <div className="relative">
                <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                <input type="text" value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                  placeholder={t('assign_search_placeholder')}
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus />
              </div>
            </div>
            {/* Candidate list */}
            <div className="flex-1 overflow-auto px-4 md:px-6 py-3 md:min-h-[200px] md:max-h-[400px]">
              {assignLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mr-2"></div>
                  {t('assign_loading')}
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <i className="bi bi-person-x text-3xl mb-2"></i>
                  <span className="text-xs">{assignMode === 'shift' ? t('assign_no_shift') : t('assign_no_results')}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCandidates.map(d => {
                    const hasShift = shiftDistributorIds.has(d.id);
                    const isCurrentlyAssigned = assignSchedule.distributorId === d.id;
                    return (
                      <button key={d.id} onClick={() => !isCurrentlyAssigned && handleAssign(d.id)}
                        disabled={isCurrentlyAssigned}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isCurrentlyAssigned ? 'bg-indigo-50 border border-indigo-200 cursor-default' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {d.avatarUrl ? (
                            <img src={d.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="bi bi-person-fill text-slate-300 text-sm mt-0.5"></i>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate">{d.name}</div>
                          <div className="text-[10px] text-slate-400">{d.staffId}{d.branch?.nameJa ? ` · ${d.branch.nameJa}` : ''}</div>
                        </div>
                        {hasShift && (
                          <span className="shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <i className="bi bi-calendar-check mr-0.5"></i>SHIFT
                          </span>
                        )}
                        {isCurrentlyAssigned && (
                          <span className="shrink-0 text-[10px] font-bold text-indigo-600">
                            <i className="bi bi-check-circle-fill"></i>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remarks Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-w-lg overflow-hidden flex flex-col md:block">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base md:text-lg text-slate-800">{t('remarks_edit_title')}</h3>
              <button onClick={() => setEditingSchedule(null)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-4 md:p-6 flex-1 md:flex-none overflow-auto">
              <p className="text-sm text-slate-500 mb-2">
                <span className="font-bold text-slate-700">{editingSchedule.distributor?.name || '-'}</span> {t('remarks_description')}
                <span className="font-bold text-slate-700 ml-1">{formatAreaName(editingSchedule.area?.town_name, editingSchedule.area?.chome_name)}</span> {t('remarks_schedule_for')}
              </p>
              <textarea value={remarksInput} onChange={e => setRemarksInput(e.target.value)}
                className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder={t('remarks_placeholder')} />
            </div>
            <div className="px-4 md:px-6 py-3 md:py-4 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditingSchedule(null)} className="px-4 py-2 text-xs md:text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">{t('cancel')}</button>
              <button onClick={saveRemarks} className="px-4 py-2 text-xs md:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">{t('btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {statusModalSchedule && (
        <StatusChangeModal
          schedule={statusModalSchedule}
          onClose={() => setStatusModalSchedule(null)}
          onSave={handleStatusChange}
          t={t}
          getStatusKey={getStatusKey}
        />
      )}

      {/* All Trajectories Viewer */}
      {showAllTrajectories && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-600 text-sm">{t('loading')}</p>
            </div>
          </div>
        }>
          <AllTrajectoriesViewer date={filterDate} onClose={() => setShowAllTrajectories(false)} />
        </Suspense>
      )}

      {/* Relay Add Modal */}
      {relayAddSchedule && (
        <RelayAddModal
          schedule={relayAddSchedule.schedule}
          type={relayAddSchedule.type}
          saving={relaySaving}
          onSave={handleCreateRelay}
          onClose={() => setRelayAddSchedule(null)}
          t={t}
        />
      )}

      {/* Add Distributor Schedule Modal */}
      {showAddDistModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-w-lg overflow-hidden flex flex-col md:block md:max-h-[80vh]">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base md:text-lg text-slate-800">
                <i className="bi bi-person-plus-fill text-red-500 mr-2"></i>{t('add_dist_title')}
              </h3>
              <button onClick={() => setShowAddDistModal(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="px-4 md:px-6 pt-3 space-y-3 shrink-0">
              <div className="text-xs text-slate-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill text-red-500"></i>
                <span>{t('add_dist_description', { date: filterDate })}</span>
              </div>
              {/* Mode toggle */}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setAddDistMode('shift')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${addDistMode === 'shift' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <i className="bi bi-calendar-check mr-1"></i>{t('assign_mode_shift')}
                  <span className="ml-1 opacity-60">({addDistCandidates.filter(d => addDistShiftIds.has(d.id)).length})</span>
                </button>
                <button
                  onClick={() => setAddDistMode('all')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${addDistMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <i className="bi bi-people mr-1"></i>{t('assign_mode_all')}
                  <span className="ml-1 opacity-60">({addDistCandidates.length})</span>
                </button>
              </div>
              {/* Search */}
              <div className="relative">
                <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                <input type="text" value={addDistSearch} onChange={e => setAddDistSearch(e.target.value)}
                  placeholder={t('assign_search_placeholder')}
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus />
              </div>
            </div>
            {/* Candidate list */}
            <div className="flex-1 overflow-auto px-4 md:px-6 py-3 md:min-h-[200px] md:max-h-[400px]">
              {addDistLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mr-2"></div>
                  {t('assign_loading')}
                </div>
              ) : addDistFilteredCandidates.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  {addDistMode === 'shift' ? t('assign_no_shift') : t('assign_no_results')}
                </div>
              ) : (
                <div className="space-y-1">
                  {addDistFilteredCandidates.map(d => {
                    // 既にスケジュールに含まれている配布員かチェック
                    const alreadyAssigned = schedules.some(s => s.distributorId === d.id);
                    return (
                      <button key={d.id} onClick={() => !addDistSaving && handleAddDistSchedule(d.id)}
                        disabled={addDistSaving}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          alreadyAssigned ? 'bg-slate-50 border border-slate-200 opacity-50' : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {d.avatarUrl ? (
                            <img src={d.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="bi bi-person-fill text-slate-300 text-sm mt-0.5"></i>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate">{d.name}</div>
                          <div className="text-[10px] text-slate-400">{d.staffId}{d.branch?.nameJa ? ` · ${d.branch.nameJa}` : ''}</div>
                        </div>
                        {alreadyAssigned && (
                          <span className="shrink-0 text-[10px] font-bold text-slate-400">
                            {t('add_dist_already')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trajectory Viewer */}
      {trajectoryScheduleId && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-600 text-sm">{t('loading')}</p>
            </div>
          </div>
        }>
          <TrajectoryViewer scheduleId={trajectoryScheduleId} onClose={() => setTrajectoryScheduleId(null)} />
        </Suspense>
      )}
    </div>
  );
}
