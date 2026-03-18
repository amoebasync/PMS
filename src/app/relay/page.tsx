'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';
import { GoogleMap, Marker, Polygon, useJsApiLoader } from '@react-google-maps/api';
import RouteOptimizationPanel from '@/components/relay/RouteOptimizationPanel';

const getTodayStr = () => {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  if (jst.getHours() < 3) jst.setDate(jst.getDate() - 1);
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}`;
};

const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 6;
  return { start: `${String(h).padStart(2, '0')}:00`, end: `${String(h + 1).padStart(2, '0')}:00`, label: `${h}:00〜${h + 1}:00` };
});

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const TYPE_STYLE: Record<string, string> = {
  RELAY: 'bg-orange-100 text-orange-700',
  COLLECTION: 'bg-purple-100 text-purple-700',
  FULL_RELAY: 'bg-green-100 text-green-700',
};

const TYPE_ICON: Record<string, string> = {
  RELAY: 'bi-truck',
  COLLECTION: 'bi-box-arrow-in-left',
  FULL_RELAY: 'bi-truck',
};

const formatAreaName = (area: any) => {
  if (!area) return '-';
  const pref = area.prefecture?.name || '';
  const city = area.city?.name || '';
  const chome = area.chome_name || '';
  return `${pref}${city}${chome}`;
};

export default function RelayListPage() {
  const { t } = useTranslation('relay');
  const { showToast, showConfirm } = useNotification();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDriver, setFilterDriver] = useState('ALL');
  const [editTask, setEditTask] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [driverSearch, setDriverSearch] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapKey, setMapKey] = useState(0); // マップ再マウント用キー
  const [polygonPaths, setPolygonPaths] = useState<google.maps.LatLngLiteral[][]>([]);
  const [showRouteOpt, setShowRouteOpt] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ date: filterDate });
      if (filterType !== 'ALL') params.append('type', filterType);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterDriver !== 'ALL') params.append('driverId', filterDriver);
      const res = await fetch(`/api/relay-tasks?${params}`);
      if (res.ok) setTasks(await res.json());
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [filterDate, filterType, filterStatus, filterDriver]);

  useEffect(() => {
    fetch('/api/employees?active=true&limit=500').then(r => r.ok ? r.json() : []).then(data => {
      setEmployees(Array.isArray(data) ? data : data.data || []);
    });
  }, []);

  const handleStatusChange = async (task: any, newStatus: string) => {
    try {
      const res = await fetch(`/api/relay-tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        showToast(t('status_change_success'), 'success');
      }
    } catch { showToast(t('save_error'), 'error'); }
  };

  const handleDelete = async (task: any) => {
    if (!await showConfirm(t('delete_confirm'), { variant: 'danger', confirmLabel: t('btn_delete') })) return;
    try {
      const res = await fetch(`/api/relay-tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== task.id));
        showToast(t('delete_success'), 'success');
      }
    } catch { showToast(t('delete_error'), 'error'); }
  };

  const openEdit = (task: any) => {
    setEditTask(task);
    const slot = task.timeSlotStart ? TIME_SLOTS.find(s => s.start === task.timeSlotStart) : null;
    // タスクの実施日: date フィールドがあればそれ、なければ schedule.date
    const taskDate = task.date ? task.date.split('T')[0] : task.schedule?.date?.split('T')[0] || filterDate;
    setEditForm({
      type: task.type,
      driverId: task.driverId,
      driverName: task.driverName || '',
      timeSlot: slot?.label || '',
      locationName: task.locationName || '',
      latitude: task.latitude,
      longitude: task.longitude,
      note: task.note || '',
      date: taskDate,
    });
    setDriverSearch(task.driver ? `${task.driver.lastNameJa} ${task.driver.firstNameJa}` : '');
    setShowMap(!!(task.latitude && task.longitude));
    // エリアポリゴン取得
    setPolygonPaths([]);
    const areaId = task.schedule?.area?.id;
    if (areaId) {
      fetch(`/api/areas/${areaId}`).then(r => r.ok ? r.json() : null).then(area => {
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
    }
  };

  const saveEdit = async () => {
    if (!editTask) return;
    setEditSaving(true);
    const slot = TIME_SLOTS.find(s => s.label === editForm.timeSlot);
    try {
      const res = await fetch(`/api/relay-tasks/${editTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editForm.type,
          driverId: editForm.driverId || null,
          driverName: editForm.driverName || null,
          timeSlotStart: slot?.start || null,
          timeSlotEnd: slot?.end || null,
          locationName: editForm.locationName || null,
          latitude: editForm.latitude || null,
          longitude: editForm.longitude || null,
          note: editForm.note || null,
          date: editForm.date || null,
        }),
      });
      if (res.ok) {
        showToast(t('save_success'), 'success');
        setEditTask(null);
        setShowMap(false);
        fetchTasks();
      }
    } catch { showToast(t('save_error'), 'error'); }
    setEditSaving(false);
  };

  // Drag & drop reorder
  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOver.current = index; };
  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) return;
    const reordered = [...tasks];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOver.current, 0, removed);
    setTasks(reordered);
    dragItem.current = null;
    dragOver.current = null;

    try {
      await fetch('/api/relay-tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: reordered.map(t => t.id) }),
      });
    } catch { /* silent */ }
  };

  const getTypeLabel = (type: string) => {
    if (type === 'RELAY') return t('type_relay');
    if (type === 'FULL_RELAY') return t('type_full_relay');
    return t('type_collection');
  };

  const getDriverName = (task: any) => {
    if (task.driver) return `${task.driver.lastNameJa} ${task.driver.firstNameJa}`;
    if (task.driverName) return task.driverName;
    return t('unassigned');
  };

  // Unique drivers in current tasks for filter
  const uniqueDrivers = Array.from(new Map(
    tasks.filter(t => t.driverId).map(t => [t.driverId, t.driver])
  ).entries());

  const filteredEmployees = employees.filter(e => {
    if (!driverSearch) return true;
    const name = `${e.lastNameJa || ''} ${e.firstNameJa || ''} ${e.employeeCode || ''}`.toLowerCase();
    return name.includes(driverSearch.toLowerCase());
  }).slice(0, 10);

  const handleShowMap = () => {
    // 既にマップ表示中の場合はキーを変えて再マウント（center反映のため）
    setMapKey(k => k + 1);
    setShowMap(true);
    if (!editForm.latitude && !editForm.longitude) {
      // ポリゴンが既に取得済みならそこから中心座標を計算
      if (polygonPaths.length > 0 && polygonPaths[0].length > 0) {
        const pts = polygonPaths.flat();
        setEditForm((f: any) => ({
          ...f,
          latitude: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
          longitude: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
        }));
      } else {
        setEditForm((f: any) => ({ ...f, latitude: 35.6895, longitude: 139.6917 }));
      }
    }
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      setEditForm((f: any) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      setShowMap(true);
    });
  };

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setEditForm((f: any) => ({ ...f, latitude: e.latLng!.lat(), longitude: e.latLng!.lng() }));
    }
  }, []);

  const handleCarryOver = async (task: any) => {
    if (!await showConfirm(t('carryover_confirm'), { confirmLabel: t('btn_carryover') })) return;
    // 現在のタスク日付を取得し、翌日に設定
    const currentDate = task.date ? task.date.split('T')[0] : task.schedule?.date?.split('T')[0] || filterDate;
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    try {
      const res = await fetch(`/api/relay-tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: nextDateStr }),
      });
      if (res.ok) {
        showToast(t('carryover_success', { date: nextDateStr }), 'success');
        fetchTasks();
      }
    } catch { showToast(t('save_error'), 'error'); }
  };

  const handleApplyRouteOrder = async (orderedIds: number[]) => {
    try {
      await fetch('/api/relay-tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      showToast(t('route_applied_order'), 'success');
      setShowRouteOpt(false);
      fetchTasks();
    } catch { showToast(t('save_error'), 'error'); }
  };

  const selectedDriverInfo = uniqueDrivers.find(([id]) => String(id) === filterDriver);
  const selectedDriverName = selectedDriverInfo
    ? `${selectedDriverInfo[1]?.lastNameJa || ''} ${selectedDriverInfo[1]?.firstNameJa || ''}`
    : '';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header / Filters */}
      <div className="px-3 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-500">{t('filter_date')}</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="px-2 md:px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-500">{t('filter_type')}</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-2 md:px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="ALL">{t('filter_type_all')}</option>
              <option value="RELAY">{t('type_relay')}</option>
              <option value="COLLECTION">{t('type_collection')}</option>
              <option value="FULL_RELAY">{t('type_full_relay')}</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-500">{t('filter_status')}</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-2 md:px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="ALL">{t('filter_status_all')}</option>
              <option value="PENDING">{t('status_pending')}</option>
              <option value="IN_PROGRESS">{t('status_in_progress')}</option>
              <option value="COMPLETED">{t('status_completed')}</option>
              <option value="CANCELLED">{t('status_cancelled')}</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-500">{t('filter_driver')}</label>
            <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)}
              className="px-2 md:px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="ALL">{t('filter_driver_all')}</option>
              {uniqueDrivers.map(([id, driver]) => (
                <option key={id} value={id}>{driver?.lastNameJa} {driver?.firstNameJa}</option>
              ))}
            </select>
          </div>
          <button onClick={() => setShowRouteOpt(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 transition-colors">
            <i className="bi bi-signpost-2"></i>
            <span className="hidden sm:inline">{t('btn_optimize_route')}</span>
          </button>
          <div className="ml-auto text-xs text-slate-500">
            {t('total_count', { count: tasks.length })}
          </div>
        </div>
      </div>

      {/* Empty / Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto mb-2"></div>
            {t('loading')}
          </div>
        </div>
      )}
      {tasks.length === 0 && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <i className="bi bi-truck text-3xl block mb-2"></i>
            {t('no_data')}
          </div>
        </div>
      )}

      {/* Desktop Table */}
      {!isLoading && tasks.length > 0 && (
        <div className="flex-1 overflow-auto hidden md:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="px-2 py-2.5 w-[30px]">{t('th_priority')}</th>
                <th className="px-3 py-2.5 w-[80px]">{t('th_type')}</th>
                <th className="px-3 py-2.5 w-[90px]">{t('th_status')}</th>
                <th className="px-3 py-2.5 w-[100px]">{t('th_time_slot')}</th>
                <th className="px-3 py-2.5">{t('th_driver')}</th>
                <th className="px-3 py-2.5">{t('th_staff')}</th>
                <th className="px-3 py-2.5">{t('th_area')}</th>
                <th className="px-3 py-2.5">{t('th_location')}</th>
                <th className="px-3 py-2.5">{t('th_note')}</th>
                <th className="px-3 py-2.5 w-[120px] text-center">{t('th_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors cursor-grab active:cursor-grabbing ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  <td className="px-2 py-3 text-center">
                    <span className="text-slate-400 font-mono text-[10px]">
                      <i className="bi bi-grip-vertical mr-0.5"></i>{index + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_STYLE[task.type]}`}>
                      <i className={`bi ${TYPE_ICON[task.type]} text-[9px]`}></i>
                      {getTypeLabel(task.type)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <select value={task.status}
                      onChange={e => handleStatusChange(task, e.target.value)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border-0 cursor-pointer ${STATUS_STYLE[task.status]}`}>
                      <option value="PENDING">{t('status_pending')}</option>
                      <option value="IN_PROGRESS">{t('status_in_progress')}</option>
                      <option value="COMPLETED">{t('status_completed')}</option>
                      <option value="CANCELLED">{t('status_cancelled')}</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 text-xs font-mono text-slate-700">
                    {task.timeSlotStart && task.timeSlotEnd ? `${task.timeSlotStart}〜${task.timeSlotEnd}` : '-'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-bold ${task.driverId || task.driverName ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                      {getDriverName(task)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs">
                      <span className="font-bold text-slate-800">{task.schedule?.distributor?.name || '-'}</span>
                      {task.schedule?.distributor?.staffId && (
                        <span className="text-slate-400 ml-1">{task.schedule.distributor.staffId}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-slate-700 max-w-[200px] truncate" title={formatAreaName(task.schedule?.area)}>
                      {formatAreaName(task.schedule?.area)}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-slate-700">
                      {task.locationName || '-'}
                      {task.latitude && task.longitude && (
                        <a href={`https://www.google.com/maps?q=${task.latitude},${task.longitude}`} target="_blank" rel="noopener noreferrer"
                          className="ml-1 text-indigo-500 hover:text-indigo-700">
                          <i className="bi bi-geo-alt text-[10px]"></i>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-slate-600 max-w-[150px] truncate" title={task.note || ''}>
                      {task.note || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleCarryOver(task)} title={t('btn_carryover')}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                        <i className="bi bi-arrow-right-circle text-xs"></i>
                      </button>
                      <button onClick={() => openEdit(task)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <i className="bi bi-pencil text-xs"></i>
                      </button>
                      <button onClick={() => handleDelete(task)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <i className="bi bi-trash3 text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile Card Layout */}
      {!isLoading && tasks.length > 0 && (
        <div className="flex-1 overflow-auto md:hidden p-3 space-y-2">
          {tasks.map((task, index) => (
            <div key={task.id}
              className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm active:shadow-none transition-shadow"
              onClick={() => openEdit(task)}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-[10px] w-4">{index + 1}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_STYLE[task.type]}`}>
                    <i className={`bi ${TYPE_ICON[task.type]} text-[9px]`}></i>
                    {getTypeLabel(task.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <select value={task.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); handleStatusChange(task, e.target.value); }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border-0 cursor-pointer ${STATUS_STYLE[task.status]}`}>
                    <option value="PENDING">{t('status_pending')}</option>
                    <option value="IN_PROGRESS">{t('status_in_progress')}</option>
                    <option value="COMPLETED">{t('status_completed')}</option>
                    <option value="CANCELLED">{t('status_cancelled')}</option>
                  </select>
                  <button onClick={e => { e.stopPropagation(); handleCarryOver(task); }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                    <i className="bi bi-arrow-right-circle text-xs"></i>
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(task); }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <i className="bi bi-trash3 text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">{t('th_time_slot')}</span>
                  <div className="font-mono text-slate-800">
                    {task.timeSlotStart && task.timeSlotEnd ? `${task.timeSlotStart}〜${task.timeSlotEnd}` : '-'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">{t('th_driver')}</span>
                  <div className={`font-bold ${task.driverId || task.driverName ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                    {getDriverName(task)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">{t('th_staff')}</span>
                  <div className="text-slate-800 font-bold">
                    {task.schedule?.distributor?.name || '-'}
                    {task.schedule?.distributor?.staffId && (
                      <span className="text-slate-400 font-normal ml-1">{task.schedule.distributor.staffId}</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">{t('th_area')}</span>
                  <div className="text-slate-700 truncate">{formatAreaName(task.schedule?.area)}</div>
                </div>
              </div>

              {/* Location & Note */}
              {(task.locationName || task.note) && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-0.5">
                  {task.locationName && (
                    <div className="flex items-center gap-1">
                      <i className="bi bi-geo-alt text-indigo-400 text-[10px]"></i>
                      <span>{task.locationName}</span>
                      {task.latitude && task.longitude && (
                        <a href={`https://www.google.com/maps?q=${task.latitude},${task.longitude}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-indigo-500 hover:text-indigo-700 ml-1">
                          <i className="bi bi-box-arrow-up-right text-[9px]"></i>
                        </a>
                      )}
                    </div>
                  )}
                  {task.note && (
                    <div className="flex items-start gap-1 text-slate-500">
                      <i className="bi bi-chat-text text-[10px] mt-0.5"></i>
                      <span className="line-clamp-2">{task.note}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Route Optimization Panel */}
      {showRouteOpt && (
        <RouteOptimizationPanel
          isLoaded={isLoaded}
          date={filterDate}
          driverId={filterDriver}
          driverName={filterDriver === 'ALL' ? t('filter_driver_all') : selectedDriverName}
          isAllDrivers={filterDriver === 'ALL'}
          onClose={() => setShowRouteOpt(false)}
          onApplyOrder={handleApplyRouteOrder}
          t={t}
        />
      )}

      {/* Edit Modal */}
      {editTask && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-2xl md:rounded-xl shadow-xl w-full md:max-w-lg overflow-hidden flex flex-col max-h-[92vh] md:max-h-[90vh]">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base text-slate-800">
                <i className={`bi ${editForm.type === 'COLLECTION' ? 'bi-box-arrow-in-left text-purple-500' : editForm.type === 'FULL_RELAY' ? 'bi-truck text-green-500' : 'bi-truck text-orange-500'} mr-2`}></i>
                {t('modal_edit_title')}
              </h3>
              <button onClick={() => { setEditTask(null); setShowMap(false); }} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto overscroll-contain">
              {/* Type */}
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_type')}</label>
                <div className="flex gap-2">
                  <button onClick={() => setEditForm({ ...editForm, type: 'RELAY' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${editForm.type === 'RELAY' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>
                    <i className="bi bi-truck mr-1"></i>{t('type_relay')}
                  </button>
                  <button onClick={() => setEditForm({ ...editForm, type: 'FULL_RELAY' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${editForm.type === 'FULL_RELAY' ? 'border-green-400 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600'}`}>
                    <i className="bi bi-truck mr-1"></i>{t('type_full_relay')}
                  </button>
                  <button onClick={() => setEditForm({ ...editForm, type: 'COLLECTION' })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${editForm.type === 'COLLECTION' ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600'}`}>
                    <i className="bi bi-box-arrow-in-left mr-1"></i>{t('type_collection')}
                  </button>
                </div>
              </div>

              {/* Driver */}
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_driver')}</label>
                <div className="relative">
                  <input type="text" value={driverSearch} onChange={e => { setDriverSearch(e.target.value); setEditForm({ ...editForm, driverId: null }); }}
                    placeholder={t('field_driver_placeholder')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400" />
                  {driverSearch && !editForm.driverId && filteredEmployees.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-auto">
                      {filteredEmployees.map(e => (
                        <button key={e.id} onClick={() => { setEditForm({ ...editForm, driverId: e.id }); setDriverSearch(`${e.lastNameJa} ${e.firstNameJa}`); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2">
                          <span className="text-slate-400">{e.employeeCode}</span>
                          <span className="font-bold">{e.lastNameJa} {e.firstNameJa}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="text" value={editForm.driverName} onChange={e => setEditForm({ ...editForm, driverName: e.target.value })}
                  placeholder={t('field_driver_name_placeholder')}
                  className="w-full mt-2 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400" />
              </div>

              {/* Date + Time slot */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_date')}</label>
                  <input type="date" value={editForm.date || ''} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_time_slot')}</label>
                  <select value={editForm.timeSlot} onChange={e => setEditForm({ ...editForm, timeSlot: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400">
                    <option value="">-</option>
                    {TIME_SLOTS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_location')}</label>
                <input type="text" value={editForm.locationName} onChange={e => setEditForm({ ...editForm, locationName: e.target.value })}
                  placeholder={t('field_location_placeholder')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400" />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleShowMap} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-1 transition-colors">
                    <i className="bi bi-map"></i>{t('btn_set_location')}
                  </button>
                  <button onClick={handleCurrentLocation} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-1 transition-colors">
                    <i className="bi bi-crosshair"></i>{t('btn_current_location')}
                  </button>
                </div>
                {editForm.latitude && editForm.longitude && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    <i className="bi bi-pin-map mr-1"></i>{editForm.latitude.toFixed(6)}, {editForm.longitude.toFixed(6)}
                  </div>
                )}
                {showMap && isLoaded && editForm.latitude && editForm.longitude && (
                  <div className="w-full h-40 mt-2 rounded-lg border border-slate-200 overflow-hidden">
                    <GoogleMap
                      key={mapKey}
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={{ lat: editForm.latitude, lng: editForm.longitude }}
                      zoom={15}
                      onClick={handleMapClick}
                      options={{ disableDefaultUI: true, zoomControl: true }}
                    >
                      {polygonPaths.map((path, i) => (
                        <Polygon key={i} paths={path} options={{ fillColor: '#6366f1', fillOpacity: 0.15, strokeColor: '#6366f1', strokeOpacity: 0.6, strokeWeight: 2 }} />
                      ))}
                      <Marker position={{ lat: editForm.latitude, lng: editForm.longitude }} draggable
                        onDragEnd={(e) => { if (e.latLng) { setEditForm((f: any) => ({ ...f, latitude: e.latLng!.lat(), longitude: e.latLng!.lng() })); } }} />
                    </GoogleMap>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_note')}</label>
                <textarea value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} rows={2}
                  placeholder={t('field_note_placeholder')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 resize-none" />
              </div>
            </div>
            <div className="px-4 md:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-slate-100 flex justify-end gap-2 shrink-0 bg-white">
              <button onClick={() => { setEditTask(null); setShowMap(false); }} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
                {t('btn_cancel')}
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {editSaving ? <i className="bi bi-arrow-repeat animate-spin"></i> : <><i className="bi bi-check-lg mr-1"></i>{t('btn_save')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
