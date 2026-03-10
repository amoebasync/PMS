'use client';

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

const TrajectoryViewer = lazy(() => import('@/components/schedules/TrajectoryViewer'));

// 本日の日付を YYYY-MM-DD 形式で取得する関数
const getTodayStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// ★ 追加: エリア名（町名と丁目名）の重複を綺麗に排除する関数
const formatAreaName = (town?: string | null, chome?: string | null) => {
  const t = town || '';
  const c = chome || '';
  
  if (!t && !c) return '-';
  if (t === c) return c; // 「富久町 富久町」なら「富久町」のみ
  if (c.includes(t)) return c; // 「西新宿」と「西新宿１丁目」なら「西新宿１丁目」のみ
  
  // 「岩本町二丁目」と「岩本町２丁目」のような漢数字/算用数字の違いを吸収
  const baseTown = t.replace(/[一二三四五六七八九十]+丁目$/, ''); 
  if (baseTown && c.includes(baseTown)) return c;

  return t && c ? `${t} ${c}` : (c || t); // 「神田」と「１丁目」のように全く違う場合は繋げる
};

export default function ScheduleListPage() {
  const { t } = useTranslation('schedules');
  const { showToast } = useNotification();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [remarksInput, setRemarksInput] = useState('');
  const [trajectoryScheduleId, setTrajectoryScheduleId] = useState<number | null>(null);

  const fetchSchedules = async (dateStr: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/schedules?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (filterDate) {
      fetchSchedules(filterDate);
    }
  }, [filterDate]);

  const saveRemarks = async () => {
    if (!editingSchedule) return;
    try {
      const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: remarksInput })
      });
      if (res.ok) {
        setSchedules(prev => prev.map(s => 
          s.id === editingSchedule.id ? { ...s, remarks: remarksInput } : s
        ));
        setEditingSchedule(null);
      } else {
        showToast(t('save_remarks_error'), 'error');
      }
    } catch (e) {
      showToast(t('communication_error'), 'error');
    }
  };

  const filteredSchedules = schedules.filter(s => {
    if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const flyerNames = s.items.map((i:any) => i.flyerName).join(' ');
      
      const searchTarget = `
        ${s.distributor?.name || ''} 
        ${s.distributor?.staffId || ''}
        ${s.city?.name || s.area?.city?.name || ''} 
        ${s.area?.town_name || ''} 
        ${s.area?.chome_name || ''} 
        ${flyerNames}
      `.toLowerCase();
      
      if (!searchTarget.includes(q)) return false;
    }
    return true;
  });

  const getFlyerSlots = (items: any[]) => {
    const slots = [];
    for (let i = 1; i <= 6; i++) {
      slots.push(items.find(item => item.slotIndex === i) || null);
    }
    return slots;
  };

  return (
    <div className="space-y-4 md:space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex-none space-y-4">
        <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_date')}</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex-1 md:flex-none">
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none md:min-w-[120px]"
              >
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
              <input
                type="text"
                placeholder={t('search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Desktop table ===== */}
      <div className="hidden md:flex flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-100 text-slate-600 sticky top-0 z-20 shadow-sm">
              <tr>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 z-30 sticky left-0 text-center">{t('th_status')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[100px]">{t('th_branch')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[100px]">{t('th_staff_code')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[150px]">{t('th_staff_name')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">{t('th_prefecture')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">{t('th_city')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[150px]">{t('th_area')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 whitespace-normal min-w-[80px]">{t('th_capacity')}</th>

                {[1, 2, 3, 4, 5, 6].map(num => (
                  <th key={num} colSpan={5} className="border border-slate-200 px-3 py-1 bg-indigo-50 text-indigo-800 text-center font-bold">
                    {t('th_flyer')} {num}
                  </th>
                ))}

                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">{t('th_start_time')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">{t('th_current_count')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">{t('th_finish_time')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 text-center">{t('th_gps')}</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 text-center">{t('th_remarks')}</th>
              </tr>
              <tr>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <React.Fragment key={`sub-${num}`}>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium min-w-[150px]">{t('th_flyer_name')}</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium">{t('th_deadline')}</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium">{t('th_method')}</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium text-right">{t('th_planned')}</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium text-right">{t('th_actual')}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredSchedules.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={43} className="px-6 py-10 text-center text-slate-500">
                    {t('no_results')}
                  </td>
                </tr>
              )}
              {filteredSchedules.map((s) => {
                const flyers = getFlyerSlots(s.items);
                // ★ APIで取得した市区町村名をここで適用
                const cityName = s.city?.name || s.area?.city?.name || '-';
                // ★ 新しく作った関数で重複を排除したエリア名を取得
                const displayAreaName = formatAreaName(s.area?.town_name, s.area?.chome_name);

                return (
                  <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors border-b border-slate-100">
                    <td className="border border-slate-200 px-3 py-2 text-center sticky left-0 bg-white shadow-[1px_0_0_0_#e2e8f0]">
                      {s.status === 'COMPLETED' ? <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">{t('status_completed')}</span> :
                       s.status === 'DISTRIBUTING' ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>{t('status_distributing')}</span> :
                       s.status === 'IN_PROGRESS' ? <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">{t('status_in_progress')}</span> :
                       <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{t('status_unstarted')}</span>}
                    </td>

                    <td className="border border-slate-200 px-3 py-2 font-bold text-slate-700">{s.branch?.nameJa || '-'}</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-500">{s.distributor?.staffId || '-'}</td>
                    <td className="border border-slate-200 px-3 py-2">{s.distributor?.name || '-'}</td>
                    <td className="border border-slate-200 px-3 py-2">{s.area?.prefecture?.name || '-'}</td>
                    <td className="border border-slate-200 px-3 py-2">{cityName}</td>
                    <td className="border border-slate-200 px-3 py-2">{displayAreaName}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right font-bold text-emerald-600">
                      {s.area?.door_to_door_count?.toLocaleString() || '-'}
                    </td>

                    {flyers.map((flyer, idx) => (
                      <React.Fragment key={`flyer-${s.id}-${idx}`}>
                        <td className="border border-slate-200 px-2 py-2 truncate max-w-[200px]" title={flyer?.flyerName}>{flyer?.flyerName || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2 text-slate-500">{flyer?.endDate ? new Date(flyer.endDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</td>
                        <td className="border border-slate-200 px-2 py-2">{flyer?.method || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2 text-right">{flyer?.plannedCount?.toLocaleString() || '-'}</td>
                        <td className="border border-slate-200 px-2 py-2 text-right font-bold text-indigo-600">
                          {flyer && flyer.actualCount !== null ? flyer.actualCount.toLocaleString() : '-'}
                        </td>
                      </React.Fragment>
                    ))}

                    <td className="border border-slate-200 px-3 py-2 text-slate-400">-</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-400">-</td>
                    <td className="border border-slate-200 px-3 py-2 text-slate-400">-</td>

                    <td className="border border-slate-200 px-2 py-2 text-center">
                      <button
                        onClick={() => (s.status === 'DISTRIBUTING' || s.status === 'COMPLETED') && setTrajectoryScheduleId(s.id)}
                        className={`transition-colors ${
                          s.status === 'DISTRIBUTING'
                            ? 'text-emerald-500 hover:text-emerald-600 animate-pulse'
                            : s.status === 'COMPLETED'
                            ? 'text-blue-500 hover:text-blue-600'
                            : 'text-slate-300 cursor-not-allowed'
                        }`}
                        title={s.status === 'DISTRIBUTING' ? t('gps_realtime') : s.status === 'COMPLETED' ? t('gps_trajectory') : t('gps_not_started')}
                      >
                        <i className="bi bi-geo-alt-fill text-lg"></i>
                      </button>
                    </td>

                    <td className="border border-slate-200 px-2 py-2 text-center">
                      <button
                        onClick={() => { setEditingSchedule(s); setRemarksInput(s.remarks || ''); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${s.remarks ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        title={s.remarks || t('remarks_add')}
                      >
                        <i className={`bi ${s.remarks ? 'bi-chat-text-fill' : 'bi-chat-text'}`}></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Mobile card list ===== */}
      <div className="md:hidden flex-1 overflow-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}
        {!isLoading && filteredSchedules.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            {t('no_results')}
          </div>
        )}
        <div className="p-3 space-y-3">
          {filteredSchedules.map((s) => {
            const flyers = getFlyerSlots(s.items);
            const activeFlyers = flyers.filter((f: any) => f !== null);
            const cityName = s.city?.name || s.area?.city?.name || '-';
            const displayAreaName = formatAreaName(s.area?.town_name, s.area?.chome_name);

            return (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
                {/* Row 1: Status + Distributor name + action buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.status === 'COMPLETED' ? <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold shrink-0">{t('status_completed')}</span> :
                     s.status === 'DISTRIBUTING' ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold shrink-0"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>{t('status_distributing')}</span> :
                     s.status === 'IN_PROGRESS' ? <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold shrink-0">{t('status_in_progress')}</span> :
                     <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold shrink-0">{t('status_unstarted')}</span>}
                    <span className="font-bold text-sm text-slate-800 truncate">{s.distributor?.name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => (s.status === 'DISTRIBUTING' || s.status === 'COMPLETED') && setTrajectoryScheduleId(s.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        s.status === 'DISTRIBUTING'
                          ? 'bg-emerald-100 text-emerald-500 animate-pulse'
                          : s.status === 'COMPLETED'
                          ? 'bg-blue-100 text-blue-500'
                          : 'bg-slate-100 text-slate-300'
                      }`}
                    >
                      <i className="bi bi-geo-alt-fill text-sm"></i>
                    </button>
                    <button
                      onClick={() => { setEditingSchedule(s); setRemarksInput(s.remarks || ''); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${s.remarks ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                      <i className={`bi ${s.remarks ? 'bi-chat-text-fill' : 'bi-chat-text'} text-sm`}></i>
                    </button>
                  </div>
                </div>

                {/* Row 2: Branch + Staff code */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">{s.branch?.nameJa || '-'}</span>
                  {s.distributor?.staffId && <span className="text-slate-300">|</span>}
                  {s.distributor?.staffId && <span className="shrink-0">{s.distributor.staffId}</span>}
                </div>

                {/* Row 3: Area info */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <i className="bi bi-geo text-slate-400 shrink-0"></i>
                  <span className="truncate">{cityName} {displayAreaName}</span>
                  <span className="text-emerald-600 font-bold shrink-0 ml-auto">{s.area?.door_to_door_count?.toLocaleString() || '-'}</span>
                </div>

                {/* Row 4: Flyer list (only show non-null flyers) */}
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
              </div>
            );
          })}
        </div>
      </div>

      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto md:max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col md:block">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base md:text-lg text-slate-800">{t('remarks_edit_title')}</h3>
              <button onClick={() => setEditingSchedule(null)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-4 md:p-6 flex-1 md:flex-none overflow-auto">
              <p className="text-sm text-slate-500 mb-2">
                <span className="font-bold text-slate-700">{editingSchedule.distributor?.name}</span> さんの 
                <span className="font-bold text-slate-700 ml-1">
                  {formatAreaName(editingSchedule.area?.town_name, editingSchedule.area?.chome_name)}
                </span> でのスケジュールに対する備考
              </p>
              <textarea 
                value={remarksInput}
                onChange={(e) => setRemarksInput(e.target.value)}
                className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                placeholder={t('remarks_placeholder')}
              ></textarea>
            </div>
            <div className="px-4 md:px-6 py-3 md:py-4 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditingSchedule(null)} className="px-4 py-2 text-xs md:text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">{t('cancel')}</button>
              <button onClick={saveRemarks} className="px-4 py-2 text-xs md:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">{t('btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {trajectoryScheduleId && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-slate-600 text-sm">{t('loading')}</p>
            </div>
          </div>
        }>
          <TrajectoryViewer
            scheduleId={trajectoryScheduleId}
            onClose={() => setTrajectoryScheduleId(null)}
          />
        </Suspense>
      )}
    </div>
  );
}