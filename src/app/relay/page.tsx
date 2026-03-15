'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

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
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

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
    setEditForm({
      type: task.type,
      driverId: task.driverId,
      driverName: task.driverName || '',
      timeSlot: slot?.label || '',
      locationName: task.locationName || '',
      latitude: task.latitude,
      longitude: task.longitude,
      note: task.note || '',
    });
    setDriverSearch(task.driver ? `${task.driver.lastNameJa} ${task.driver.firstNameJa}` : '');
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
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === editTask.id ? updated : t));
        showToast(t('save_success'), 'success');
        setEditTask(null);
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

  const getStatusKey = (status: string) => {
    const map: Record<string, string> = { PENDING: 'status_pending', IN_PROGRESS: 'status_in_progress', COMPLETED: 'status_completed', CANCELLED: 'status_cancelled' };
    return map[status] || status;
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">{t('filter_date')}</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">{t('filter_type')}</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="ALL">{t('filter_type_all')}</option>
            <option value="RELAY">{t('type_relay')}</option>
            <option value="COLLECTION">{t('type_collection')}</option>
            <option value="FULL_RELAY">{t('type_full_relay')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">{t('filter_status')}</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="ALL">{t('filter_status_all')}</option>
            <option value="PENDING">{t('status_pending')}</option>
            <option value="IN_PROGRESS">{t('status_in_progress')}</option>
            <option value="COMPLETED">{t('status_completed')}</option>
            <option value="CANCELLED">{t('status_cancelled')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">{t('filter_driver')}</label>
          <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
            <option value="ALL">{t('filter_driver_all')}</option>
            {uniqueDrivers.map(([id, driver]) => (
              <option key={id} value={id}>{driver?.lastNameJa} {driver?.firstNameJa}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-xs text-slate-500">
          {t('total_count', { count: tasks.length })}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2.5 w-[30px]">{t('th_priority')}</th>
              <th className="px-3 py-2.5 w-[70px]">{t('th_type')}</th>
              <th className="px-3 py-2.5 w-[80px]">{t('th_status')}</th>
              <th className="px-3 py-2.5 w-[100px]">{t('th_time_slot')}</th>
              <th className="px-3 py-2.5">{t('th_driver')}</th>
              <th className="px-3 py-2.5">{t('th_staff')}</th>
              <th className="px-3 py-2.5">{t('th_area')}</th>
              <th className="px-3 py-2.5">{t('th_location')}</th>
              <th className="px-3 py-2.5">{t('th_note')}</th>
              <th className="px-3 py-2.5 w-[80px] text-center">{t('th_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length === 0 && !isLoading && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                  <i className="bi bi-truck text-3xl block mb-2"></i>
                  {t('no_data')}
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                  {t('loading')}
                </td>
              </tr>
            )}
            {tasks.map((task, index) => (
              <tr key={task.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                className="hover:bg-slate-50/80 transition-colors cursor-grab active:cursor-grabbing"
              >
                {/* Priority */}
                <td className="px-2 py-2.5 text-center">
                  <span className="text-slate-400 font-mono text-[10px]">
                    <i className="bi bi-grip-vertical mr-0.5"></i>{index + 1}
                  </span>
                </td>

                {/* Type */}
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_STYLE[task.type]}`}>
                    <i className={`bi ${task.type === 'COLLECTION' ? 'bi-box-arrow-in-left' : 'bi-truck'} text-[9px]`}></i>
                    {t(task.type === 'RELAY' ? 'type_relay' : task.type === 'FULL_RELAY' ? 'type_full_relay' : 'type_collection')}
                  </span>
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <select value={task.status}
                    onChange={e => handleStatusChange(task, e.target.value)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border-0 cursor-pointer ${STATUS_STYLE[task.status]}`}>
                    <option value="PENDING">{t('status_pending')}</option>
                    <option value="IN_PROGRESS">{t('status_in_progress')}</option>
                    <option value="COMPLETED">{t('status_completed')}</option>
                    <option value="CANCELLED">{t('status_cancelled')}</option>
                  </select>
                </td>

                {/* Time slot */}
                <td className="px-3 py-2.5 text-xs font-mono text-slate-600">
                  {task.timeSlotStart && task.timeSlotEnd ? `${task.timeSlotStart}〜${task.timeSlotEnd}` : '-'}
                </td>

                {/* Driver */}
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-bold ${task.driverId || task.driverName ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                    {getDriverName(task)}
                  </span>
                </td>

                {/* Distributor */}
                <td className="px-3 py-2.5">
                  <div className="text-xs">
                    <span className="font-bold text-slate-700">{task.schedule?.distributor?.name || '-'}</span>
                    {task.schedule?.distributor?.staffId && (
                      <span className="text-slate-400 ml-1">{task.schedule.distributor.staffId}</span>
                    )}
                  </div>
                </td>

                {/* Area */}
                <td className="px-3 py-2.5">
                  <div className="text-xs text-slate-600 max-w-[200px] truncate" title={formatAreaName(task.schedule?.area)}>
                    {formatAreaName(task.schedule?.area)}
                  </div>
                </td>

                {/* Location */}
                <td className="px-3 py-2.5">
                  <div className="text-xs text-slate-600">
                    {task.locationName || '-'}
                    {task.latitude && task.longitude && (
                      <a href={`https://www.google.com/maps?q=${task.latitude},${task.longitude}`} target="_blank" rel="noopener noreferrer"
                        className="ml-1 text-indigo-500 hover:text-indigo-700">
                        <i className="bi bi-geo-alt text-[10px]"></i>
                      </a>
                    )}
                  </div>
                </td>

                {/* Note */}
                <td className="px-3 py-2.5">
                  <div className="text-xs text-slate-500 max-w-[150px] truncate" title={task.note || ''}>
                    {task.note || '-'}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openEdit(task)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <i className="bi bi-pencil text-[10px]"></i>
                    </button>
                    <button onClick={() => handleDelete(task)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <i className="bi bi-trash3 text-[10px]"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-w-lg overflow-hidden flex flex-col md:block max-h-full md:max-h-[90vh]">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base text-slate-800">
                <i className={`bi ${editForm.type === 'COLLECTION' ? 'bi-box-arrow-in-left text-purple-500' : editForm.type === 'FULL_RELAY' ? 'bi-truck text-green-500' : 'bi-truck text-orange-500'} mr-2`}></i>
                {t('modal_edit_title')}
              </h3>
              <button onClick={() => setEditTask(null)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-4 md:p-6 space-y-4 flex-1 overflow-auto">
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
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-auto">
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

              {/* Time slot */}
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_time_slot')}</label>
                <select value={editForm.timeSlot} onChange={e => setEditForm({ ...editForm, timeSlot: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400">
                  <option value="">-</option>
                  {TIME_SLOTS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">{t('field_location')}</label>
                <input type="text" value={editForm.locationName} onChange={e => setEditForm({ ...editForm, locationName: e.target.value })}
                  placeholder={t('field_location_placeholder')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400" />
                {editForm.latitude && editForm.longitude && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    <i className="bi bi-pin-map mr-1"></i>{editForm.latitude.toFixed(6)}, {editForm.longitude.toFixed(6)}
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
            <div className="px-4 md:px-6 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button onClick={() => setEditTask(null)} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">
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
