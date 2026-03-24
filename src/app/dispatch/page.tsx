'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

const getTodayStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getMidnightTime = (dString: string | Date | null) => {
  if (!dString) return null;
  const dateStr = typeof dString === 'string' ? dString.split('T')[0] : dString.toISOString().split('T')[0];
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

const formatAreaName = (town?: string | null, chome?: string | null) => {
  const t = town || ''; const c = chome || '';
  if (!t && !c) return '-';
  if (t === c) return c; 
  if (c.includes(t)) return c; 
  const baseTown = t.replace(/[一二三四五六七八九十]+丁目$/, ''); 
  if (baseTown && c.includes(baseTown)) return c;
  return t && c ? `${t} ${c}` : (c || t); 
};

const thBaseClass = "px-2 py-2 font-bold text-slate-600 bg-slate-50 border-b border-slate-200 shadow-[0_1px_0_0_#e2e8f0]";
const tdBaseClass = "px-2 py-2 border-b border-slate-100 align-top bg-white group-hover:bg-indigo-50 transition-colors";

const getStickyStyle = (left: number, isHeader: boolean): React.CSSProperties => ({
  position: 'sticky',
  left: `${left}px`,
  top: isHeader ? '0px' : undefined,
  zIndex: isHeader ? 60 : 20,
});

export default function DispatchPage() {
  const { t } = useTranslation('dispatch');
  const { showToast, showConfirm } = useNotification();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [unassignedItems, setUnassignedItems] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [orderStats, setOrderStats] = useState<Record<string, any>>({}); 
  const [isLoading, setIsLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false); 
  const [sortConfig, setSortConfig] = useState({ key: 'areaCode', direction: 'asc' });

  const [movingItem, setMovingItem] = useState<any>(null);
  const [targetMoveScheduleId, setTargetMoveScheduleId] = useState('');

  // エリア検索
  const [editingAreaScheduleId, setEditingAreaScheduleId] = useState<number | null>(null);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [areaSearchResults, setAreaSearchResults] = useState<any[]>([]);
  const [areaSearching, setAreaSearching] = useState(false);
  const areaSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const areaDropdownRef = useRef<HTMLDivElement>(null);

  // チラシ追加
  const [addingFlyerSlot, setAddingFlyerSlot] = useState<{ scheduleId: number; slotIndex: number } | null>(null);
  const [flyerSearchQuery, setFlyerSearchQuery] = useState('');
  const [flyerSearchResults, setFlyerSearchResults] = useState<any[]>([]);
  const [allFlyers, setAllFlyers] = useState<any[]>([]);
  const flyerDropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [schedRes, unassignedRes, distRes, branchRes, statsRes] = await Promise.all([
        fetch(`/api/schedules?from=${dateFrom}&to=${dateTo}`),
        fetch('/api/schedules/unassigned'),
        fetch('/api/distributors'),
        fetch('/api/branches'),
        fetch('/api/schedules/stats') 
      ]);
      
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (unassignedRes.ok) setUnassignedItems(await unassignedRes.json());
      if (distRes.ok) setDistributors(await distRes.json());
      if (branchRes.ok) setBranches(await branchRes.json());
      if (statsRes.ok) setOrderStats(await statsRes.json());
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  // チラシ一覧を初回取得
  useEffect(() => {
    fetch('/api/flyers').then(r => r.ok ? r.json() : []).then(setAllFlyers).catch(() => {});
  }, []);

  // エリア検索
  const searchAreas = (query: string) => {
    setAreaSearchQuery(query);
    if (areaSearchTimer.current) clearTimeout(areaSearchTimer.current);
    if (!query || query.length < 2) { setAreaSearchResults([]); return; }
    areaSearchTimer.current = setTimeout(async () => {
      setAreaSearching(true);
      try {
        const res = await fetch(`/api/areas?search=${encodeURIComponent(query)}&limit=20`);
        if (res.ok) { const json = await res.json(); setAreaSearchResults(json.data || json.areas || []); }
      } catch {}
      setAreaSearching(false);
    }, 300);
  };

  const handleAreaSelect = async (scheduleId: number, area: any) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: area.id })
      });
      if (res.ok) fetchData();
    } catch { showToast(t('error_update_failed'), 'error'); }
    setEditingAreaScheduleId(null);
    setAreaSearchQuery('');
    setAreaSearchResults([]);
  };

  // チラシ検索フィルタ
  const filteredFlyers = useMemo(() => {
    if (!flyerSearchQuery) return allFlyers.slice(0, 20);
    const q = flyerSearchQuery.toLowerCase();
    return allFlyers.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.flyerCode || '').toLowerCase().includes(q) ||
      (f.customer?.name || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allFlyers, flyerSearchQuery]);

  const handleAddFlyer = async (scheduleId: number, slotIndex: number, flyer: any) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      const area = schedule?.area;
      const plannedCount = area
        ? (area.door_to_door_count || 0)
        : 0;

      const res = await fetch('/api/schedules/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, slotIndex, flyerId: flyer.id, plannedCount })
      });
      if (res.ok) fetchData();
    } catch { showToast(t('error_process_failed'), 'error'); }
    setAddingFlyerSlot(null);
    setFlyerSearchQuery('');
  };

  // クリック外でドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(e.target as Node)) {
        setEditingAreaScheduleId(null); setAreaSearchQuery(''); setAreaSearchResults([]);
      }
      if (flyerDropdownRef.current && !flyerDropdownRef.current.contains(e.target as Node)) {
        setAddingFlyerSlot(null); setFlyerSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ★ 追加: From日付変更時に、ToがFromより前になれば自動的に揃えるロジック
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = e.target.value;
    setDateFrom(newFrom);
    if (newFrom > dateTo) {
      setDateTo(newFrom);
    }
  };

  const isFlyerDuplicate = (targetSchedule: any, dropData: any) => {
    return targetSchedule.items.some((i: any) => {
      if (dropData.type === 'SCHEDULED' && i.id === dropData.itemId) return false;
      if (dropData.flyerId && i.flyerId === dropData.flyerId) return true;
      if (dropData.flyerCode && i.flyerCode === dropData.flyerCode) return true;
      if (dropData.flyerName && i.flyerName === dropData.flyerName) return true;
      return false;
    });
  };

  const handleDragStart = (e: React.DragEvent, data: any) => { e.dataTransfer.setData('application/json', JSON.stringify(data)); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent, targetScheduleId: number, targetSlotIndex: number, targetAreaId: number) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);

    if (data.areaId !== targetAreaId) {
      showToast(t('error_different_area'), 'error');
      return;
    }

    const targetSchedule = enrichedSchedules.find(s => s.id === targetScheduleId);
    if (targetSchedule && isFlyerDuplicate(targetSchedule, data)) {
      showToast(t('error_duplicate_flyer'), 'error');
      return;
    }

    try {
      if (data.type === 'UNASSIGNED') {
        const res = await fetch('/api/schedules/items', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduleId: targetScheduleId, slotIndex: targetSlotIndex, odaId: data.odaId })
        });
        if (res.ok) fetchData();
      } else if (data.type === 'SCHEDULED') {
        const res = await fetch('/api/schedules/items', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: data.itemId, targetScheduleId, targetSlotIndex })
        });
        if (res.ok) fetchData();
      }
    } catch (err) { showToast(t('error_process_failed'), 'error'); }
  };

  const handleCreateScheduleFromUnassigned = async (odaId: number, endDateStr: string | null) => {
    try {
      const targetDate = endDateStr ? endDateStr.split('T')[0] : dateFrom;
      const res = await fetch('/api/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_FROM_UNASSIGNED', date: targetDate, odaId })
      });
      if (res.ok) {
        if (targetDate < dateFrom || targetDate > dateTo) {
          showToast(t('toast_schedule_created', { date: targetDate }), 'success');
          setDateFrom(targetDate); setDateTo(targetDate);
        } else {
          fetchData();
        }
      }
    } catch (e) { showToast(t('error_create_schedule_failed'), 'error'); }
  };

  const updateScheduleProp = async (scheduleId: number, field: string, value: string) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, [field]: value } : s));
      }
    } catch (e) { showToast(t('error_update_failed'), 'error'); }
  };

  const updateItemPlannedCount = async (itemId: number, newCount: string) => {
    try {
      const res = await fetch('/api/schedules/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, plannedCount: newCount })
      });
      if (res.ok) fetchData();
    } catch (e) { showToast(t('error_count_update_failed'), 'error'); }
  };

  const handleAdjustCount = async (itemId: number, currentCount: number, excess: number) => {
    const newCount = Math.max(0, currentCount - excess);
    if (!await showConfirm(t('confirm_adjust_count', { excess: excess.toLocaleString(), current: currentCount.toLocaleString(), new: newCount.toLocaleString() }), { variant: 'warning', confirmLabel: t('confirm_adjust_btn') })) return;
    await updateItemPlannedCount(itemId, newCount.toString());
  };

  const removeFlyerFromSchedule = async (itemId: number) => {
    if (!await showConfirm(t('confirm_remove_from_schedule'), { variant: 'danger', confirmLabel: t('confirm_remove_btn') })) return;
    try {
      const res = await fetch(`/api/schedules/items?id=${itemId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (e) { showToast(t('error_delete_failed'), 'error'); }
  };

  const deleteSchedule = async (scheduleId: number) => {
    if (!await showConfirm(t('confirm_delete_schedule'), { variant: 'danger', confirmLabel: t('confirm_remove_btn') })) return;
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (e) { showToast(t('error_delete_failed'), 'error'); }
  };

  const executeMoveFromModal = async () => {
    if (!movingItem || !targetMoveScheduleId) return;

    const targetSchedule = enrichedSchedules.find(s => s.id === parseInt(targetMoveScheduleId));
    if (targetSchedule && isFlyerDuplicate(targetSchedule, { type: 'SCHEDULED', itemId: movingItem.id, flyerId: movingItem.flyerId, flyerCode: movingItem.flyerCode, flyerName: movingItem.flyerName })) {
      showToast(t('error_duplicate_flyer'), 'error');
      return;
    }

    try {
      const res = await fetch('/api/schedules/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: movingItem.id, targetScheduleId: targetMoveScheduleId, targetSlotIndex: movingItem.slotIndex })
      });
      if (res.ok) {
        setMovingItem(null); setTargetMoveScheduleId(''); fetchData();
      }
    } catch (e) { showToast(t('error_move_failed'), 'error'); }
  };

  const handleMoveToNewSchedule = async () => {
    if (!movingItem) return;
    try {
      const res1 = await fetch('/api/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: movingItem.schedule.date, areaId: movingItem.schedule.areaId })
      });
      if (!res1.ok) throw new Error();
      const newSchedule = await res1.json();

      const res2 = await fetch('/api/schedules/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: movingItem.id, targetScheduleId: newSchedule.id, targetSlotIndex: 1 })
      });
      if (!res2.ok) throw new Error();

      setMovingItem(null);
      fetchData();
    } catch (e) {
      showToast(t('error_create_move_failed'), 'error');
    }
  };

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const enrichedSchedules = useMemo(() => {
    return schedules.map(s => {
      const scheduleTime = getMidnightTime(s.date) || 0;
      let scheduleHasAlert = false; 
      
      const items = s.items.map((item: any) => {
        const startTime = getMidnightTime(item.startDate);
        const endTime = getMidnightTime(item.endDate);
        const spareTime = getMidnightTime(item.spareDate);
        const stat = orderStats[`${item.orderId}_${item.flyerId}`];
        
        const isOverCount = !!(stat && stat.isOver);
        const isBeforeStart = startTime !== null && scheduleTime < startTime;
        const isOverEndDate = endTime !== null && scheduleTime > endTime;
        const isOverSpareDate = spareTime !== null && scheduleTime > spareTime;

        const isDanger = isOverCount || isBeforeStart || isOverSpareDate;
        const isWarning = !isDanger && isOverEndDate;

        if (isDanger) scheduleHasAlert = true;

        let alertReasons = [];
        if (isOverCount) alertReasons.push(t('alert_count_over_full'));
        if (isBeforeStart) alertReasons.push(t('alert_before_start'));
        if (isOverSpareDate) alertReasons.push(t('alert_spare_over_full'));
        if (isWarning) alertReasons.push(t('alert_deadline_over_full'));

        let shortAlert = null;
        if (isOverCount) shortAlert = { text: t('alert_count_over'), color: "bg-rose-100 text-rose-700 border-rose-300" };
        else if (isOverSpareDate) shortAlert = { text: t('alert_spare_over'), color: "bg-rose-100 text-rose-700 border-rose-300" };
        else if (isBeforeStart) shortAlert = { text: t('alert_before_start'), color: "bg-rose-100 text-rose-700 border-rose-300" };
        else if (isOverEndDate) shortAlert = { text: t('alert_deadline_over'), color: "bg-amber-100 text-amber-700 border-amber-300" };

        return { ...item, isOverCount, isDanger, isWarning, hasAlert: isDanger, alertReasons, shortAlert };
      });

      return { ...s, items, hasAlert: scheduleHasAlert };
    });
  }, [schedules, orderStats]);

  const alertCount = useMemo(() => {
    let count = 0;
    enrichedSchedules.forEach(s => { s.items.forEach(i => { if (i.hasAlert) count++; }); });
    return count;
  }, [enrichedSchedules]);

  const filteredUnassignedItems = useMemo(() => {
    const fromTime = getMidnightTime(dateFrom) || 0;
    const toTime = getMidnightTime(dateTo) || Number.MAX_SAFE_INTEGER;

    let result = unassignedItems.filter(oda => {
      const od = oda.orderDistribution;
      if (!od) return false;
      const startT = od.startDate ? getMidnightTime(od.startDate) : 0;
      const endT = od.endDate ? getMidnightTime(od.endDate) : Number.MAX_SAFE_INTEGER;
      return (startT! <= toTime && endT! >= fromTime);
    });

    return result.sort((a, b) => {
      const endA = getMidnightTime(a.orderDistribution.endDate) || Number.MAX_SAFE_INTEGER;
      const endB = getMidnightTime(b.orderDistribution.endDate) || Number.MAX_SAFE_INTEGER;
      return endA - endB;
    });
  }, [unassignedItems, dateFrom, dateTo]);

  const processedSchedules = useMemo(() => {
    let result = enrichedSchedules.filter(s => {
      if (filterStatus !== 'ALL' && s.status !== filterStatus) return false;
      if (showOnlyAlerts && !s.hasAlert) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fNames = s.items.map((i:any) => i.flyerName).join(' ');
        const target = `${s.distributor?.name || ''} ${s.city?.name || ''} ${s.area?.town_name || ''} ${fNames}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let valA: any = '', valB: any = '';
      if (sortConfig.key === 'areaCode') { valA = a.area?.address_code || ''; valB = b.area?.address_code || ''; }
      else if (sortConfig.key === 'branch') { valA = a.branch?.nameJa || ''; valB = b.branch?.nameJa || ''; }
      else if (sortConfig.key === 'date') { valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [enrichedSchedules, filterStatus, showOnlyAlerts, searchQuery, sortConfig]);

  const getFlyerSlot = (scheduleItems: any[], slotNumber: number) => {
    return scheduleItems.find(i => i.slotIndex === slotNumber) || null;
  };

  return (
    <div className="flex flex-col w-full gap-4 overflow-hidden" style={{ height: 'calc(100vh - 3rem)', maxHeight: 'calc(100vh - 3rem)' }}>
      
      {/* 1. ヘッダー＆フィルタエリア */}
      <div className="flex-none bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-6 mb-4">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-diagram-3-fill text-indigo-600"></i>{t('page_title')}
          </h1>
          <button 
            onClick={() => setShowOnlyAlerts(!showOnlyAlerts)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm transition-colors border ${showOnlyAlerts ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <i className={`bi ${alertCount > 0 ? 'bi-exclamation-triangle-fill text-rose-500' : 'bi-check-circle-fill text-emerald-500'}`}></i>
            {t('alert_target', { count: alertCount })}
            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 ml-1">{showOnlyAlerts ? t('alert_release') : t('alert_filter')}</span>
          </button>
        </div>
        
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('period_from')}</label>
            {/* ★ 変更: handleDateFromChange を設定 */}
            <input type="date" value={dateFrom} onChange={handleDateFromChange} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('period_to')}</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('filter_status')}</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
              <option value="ALL">{t('filter_status_all')}</option>
              <option value="UNSTARTED">{t('filter_status_unstarted')}</option>
              <option value="IN_PROGRESS">{t('filter_status_in_progress')}</option>
              <option value="COMPLETED">{t('filter_status_completed')}</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('search_label')}</label>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-2 text-slate-400 text-sm"></i>
              <input type="text" placeholder={t('search_placeholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. メインの2ペイン */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 flex gap-4">
          
          {/* 左側: 未手配リスト */}
          <div className="w-[280px] shrink-0 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full overflow-hidden z-10">
            <div className="flex-none p-3 bg-slate-800 text-white flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold text-sm"><i className="bi bi-inbox-fill mr-1"></i> {t('unassigned_title')}</h3>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">{filteredUnassignedItems.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50">
              {isLoading ? <div className="text-center text-slate-400 text-sm py-10">{t('loading')}</div> :
               filteredUnassignedItems.length === 0 ? <div className="text-center text-slate-400 text-sm py-10">{t('unassigned_empty')}</div> :
               filteredUnassignedItems.map(oda => {
                 const od = oda.orderDistribution;
                 const stat = orderStats[`${od.orderId}_${od.flyerId}`];

                 return (
                   <div 
                     key={oda.id} 
                     draggable
                     onDragStart={(e) => handleDragStart(e, { type: 'UNASSIGNED', odaId: oda.id, areaId: oda.areaId, flyerId: od.flyerId, flyerCode: od.flyer?.flyerCode, flyerName: od.flyer?.name })}
                     className={`p-3 rounded-lg shadow-sm border cursor-move transition-all group relative ${stat?.isOver ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200 hover:border-indigo-400'}`}
                   >
                     <div className="text-[10px] font-bold text-indigo-600 mb-1 flex justify-between">
                       <span className="truncate pr-1">{od.order?.customer?.name || t('unassigned_customer_unknown')}</span>
                       <span className="shrink-0 bg-indigo-100 px-1 rounded text-indigo-800">{od.flyer?.size?.name || ''}</span>
                     </div>
                     <div className="text-xs font-bold text-slate-800 mb-1 line-clamp-1" title={od.flyer?.name}>{od.flyer?.name}</div>
                     <div className="font-bold text-slate-700 text-[11px] mb-2">{oda.area.city?.name} {formatAreaName(oda.area.town_name, oda.area.chome_name)}</div>
                     
                     <div className="pt-2 border-t border-slate-100 text-[10px] space-y-1">
                       <div className="text-slate-500 font-mono">
                         {od.startDate ? new Date(od.startDate).toLocaleDateString('ja-JP',{month:'short',day:'numeric',timeZone:'Asia/Tokyo'}) : '-'} 〜 <span className="font-bold text-rose-600">{od.endDate ? new Date(od.endDate).toLocaleDateString('ja-JP',{month:'short',day:'numeric',timeZone:'Asia/Tokyo'}) : '-'}</span>
                       </div>
                       <div className="flex justify-between text-slate-500">
                         <span>{t('unassigned_total_requested')}</span><span className="font-bold">{od.plannedCount?.toLocaleString()}{t('unassigned_sheets')}</span>
                       </div>
                       <div className={`flex justify-between ${stat?.isOver ? 'text-rose-600 font-bold' : 'text-emerald-600'}`}>
                         <span>{t('unassigned_total_assigned')}</span><span>{stat?.totalAssigned?.toLocaleString() || 0}{t('unassigned_sheets')}</span>
                       </div>
                     </div>
                     
                     <button 
                       onClick={() => handleCreateScheduleFromUnassigned(oda.id, od.endDate)}
                       className="mt-2 w-full text-[10px] bg-indigo-50 text-indigo-600 py-1.5 rounded font-bold hover:bg-indigo-600 hover:text-white transition-colors border border-indigo-200 shadow-sm flex items-center justify-center gap-1"
                       title="このチラシの完了期限日でスケジュールを作成します"
                     >
                       <i className="bi bi-calendar-plus"></i> {t('unassigned_create_btn')}
                     </button>
                   </div>
                 )
               })}
            </div>
            <div className="flex-none p-2 text-center text-[10px] text-slate-500 bg-slate-100 border-t border-slate-200 rounded-b-xl">
              {t('unassigned_drag_hint')}
            </div>
          </div>

          {/* 右側: スケジュール一覧 */}
          <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar rounded-xl relative">
              <table className="text-left text-[11px] whitespace-nowrap border-separate border-spacing-0 w-max min-w-full">
                <thead>
                  <tr>
                    <th className={`min-w-[100px] w-[100px] ${thBaseClass}`} style={getStickyStyle(0, true)} onClick={() => handleSort('date')}>{t('table_date')} {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                    <th className={`min-w-[160px] w-[160px] ${thBaseClass}`} style={getStickyStyle(100, true)} onClick={() => handleSort('areaCode')}>{t('table_area')} {sortConfig.key === 'areaCode' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                    <th className={`min-w-[100px] w-[100px] ${thBaseClass}`} style={getStickyStyle(260, true)} onClick={() => handleSort('branch')}>{t('table_branch')} {sortConfig.key === 'branch' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                    <th className={`min-w-[120px] w-[120px] ${thBaseClass}`} style={getStickyStyle(360, true)}>{t('table_distributor')}</th>
                    <th className={`min-w-[90px] w-[90px] ${thBaseClass} border-r-2 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`} style={getStickyStyle(480, true)}>{t('table_status')}</th>
                    
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <th key={num} className={`sticky top-0 z-40 min-w-[180px] text-center bg-indigo-50/50 ${thBaseClass}`}>{t('table_flyer_n', { n: num })}</th>
                    ))}
                    <th className={`sticky top-0 z-40 w-[40px] text-center bg-slate-50 ${thBaseClass}`}><i className="bi bi-trash"></i></th>
                  </tr>
                </thead>
                <tbody>
                  {processedSchedules.map(schedule => (
                    <tr key={schedule.id} className="group cursor-default">
                      {/* --- 左側固定カラム --- */}
                      <td className={`min-w-[100px] w-[100px] ${tdBaseClass}`} style={getStickyStyle(0, false)}>
                        <input 
                          type="date" 
                          value={new Date(schedule.date).toISOString().split('T')[0]} 
                          onChange={(e) => updateScheduleProp(schedule.id, 'date', e.target.value)}
                          className="border-0 bg-transparent font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 rounded p-1 w-[90px] text-[10px]"
                        />
                      </td>
                      <td className={`min-w-[160px] w-[160px] ${tdBaseClass} relative`} style={getStickyStyle(100, false)}>
                        {editingAreaScheduleId === schedule.id ? (
                          <div ref={areaDropdownRef} className="relative">
                            <input
                              autoFocus
                              type="text"
                              value={areaSearchQuery}
                              onChange={e => searchAreas(e.target.value)}
                              placeholder={t('area_search_placeholder') || 'エリアを検索...'}
                              className="w-full border border-indigo-300 rounded px-2 py-1 text-[10px] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            {(areaSearchResults.length > 0 || areaSearching) && (
                              <div className="absolute top-full left-0 w-[280px] max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-[100] mt-1">
                                {areaSearching && <div className="p-2 text-center text-[10px] text-slate-400">検索中...</div>}
                                {areaSearchResults.map((area: any) => (
                                  <button
                                    key={area.id}
                                    onClick={() => handleAreaSelect(schedule.id, area)}
                                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-[10px] border-b border-slate-50 transition-colors"
                                  >
                                    <div className="font-bold text-indigo-700">{formatAreaName(area.town_name, area.chome_name)}</div>
                                    <div className="text-[9px] text-slate-400">{area.prefecture?.name} {area.city?.name}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            onClick={() => { setEditingAreaScheduleId(schedule.id); setAreaSearchQuery(''); setAreaSearchResults([]); }}
                            className="cursor-pointer hover:bg-indigo-50 rounded p-1 -m-1 transition-colors"
                            title={t('area_click_to_change') || 'クリックしてエリアを変更'}
                          >
                            <div className="font-bold text-indigo-700 truncate" title={formatAreaName(schedule.area?.town_name, schedule.area?.chome_name)}>
                              {formatAreaName(schedule.area?.town_name, schedule.area?.chome_name)}
                            </div>
                            <div className="text-[9px] text-slate-400">{schedule.area?.prefecture?.name} {schedule.city?.name}</div>
                          </div>
                        )}
                      </td>
                      <td className={`min-w-[100px] w-[100px] ${tdBaseClass}`} style={getStickyStyle(260, false)}>
                        <select value={schedule.branchId || ''} onChange={(e) => updateScheduleProp(schedule.id, 'branchId', e.target.value)} className="border-0 bg-transparent font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 rounded p-1 w-full text-[10px] truncate cursor-pointer">
                          <option value="">{t('unset')}</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
                        </select>
                      </td>
                      <td className={`min-w-[120px] w-[120px] ${tdBaseClass}`} style={getStickyStyle(360, false)}>
                        <select value={schedule.distributorId || ''} onChange={(e) => updateScheduleProp(schedule.id, 'distributorId', e.target.value)} className="border border-slate-200 bg-slate-50 rounded p-1 w-full text-[10px] focus:ring-2 focus:ring-indigo-500 truncate cursor-pointer">
                          <option value="">{t('unassigned_distributor')}</option>
                          {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                      <td className={`min-w-[90px] w-[90px] ${tdBaseClass} border-r-2 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`} style={getStickyStyle(480, false)}>
                        <select value={schedule.status} onChange={(e) => updateScheduleProp(schedule.id, 'status', e.target.value)} className="border-0 bg-transparent font-bold p-1 rounded w-full text-[10px] cursor-pointer">
                          <option value="UNSTARTED">{t('status_unstarted')}</option><option value="IN_PROGRESS">{t('status_in_progress')}</option><option value="COMPLETED">{t('status_completed')}</option>
                        </select>
                      </td>

                      {/* --- スクロールするチラシ枠 --- */}
                      {[1, 2, 3, 4, 5, 6].map(slotIndex => {
                        const item = getFlyerSlot(schedule.items, slotIndex);
                        
                        let cardClass = 'bg-white border-indigo-200 hover:border-indigo-500';
                        let excessCount = 0;
                        
                        if (item) {
                          const stat = orderStats[`${item.orderId}_${item.flyerId}`];
                          if (stat && stat.isOver) {
                            excessCount = stat.totalAssigned - stat.totalPlanned;
                          }
                          if (item.isDanger) cardClass = 'bg-rose-50 border-rose-400 shadow-sm';
                          else if (item.isWarning) cardClass = 'bg-amber-50 border-amber-400 shadow-sm';
                        }

                        return (
                          <td 
                            key={slotIndex} 
                            className={tdBaseClass}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, schedule.id, slotIndex, schedule.areaId)}
                          >
                            {item ? (
                              <div 
                                draggable 
                                onDragStart={(e) => handleDragStart(e, { type: 'SCHEDULED', itemId: item.id, areaId: schedule.areaId, scheduleId: schedule.id, slotIndex, flyerId: item.flyerId, flyerCode: item.flyerCode, flyerName: item.flyerName })}
                                className={`border rounded p-1.5 cursor-move transition-colors relative group/card h-full flex flex-col justify-between ${cardClass}`}
                              >
                                <div>
                                  <div className="font-bold text-slate-800 truncate mb-1 pr-6" title={item.flyerName}>
                                    {item.flyerName}
                                  </div>

                                  <div className="text-[9px] text-slate-500">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-0.5 mb-0.5">
                                      <span className="truncate max-w-[60px]">{item.method}</span>
                                      <span className="truncate max-w-[50px] font-bold text-slate-600">{item.flyer?.size?.name || '-'}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center font-mono mt-1">
                                      <span className="truncate">
                                        {t('flyer_deadline')} <span className={`font-bold ${item.isOverSpareDate ? 'text-rose-600' : item.isOverEndDate ? 'text-amber-600' : 'text-slate-600'}`}>
                                          {item.endDate ? new Date(item.endDate).toLocaleDateString('ja-JP', {month:'short', day:'numeric', timeZone:'Asia/Tokyo'}) : '-'}
                                        </span>
                                      </span>
                                      {item.shortAlert && (
                                        <span 
                                          className={`px-1 py-0.5 rounded text-[8px] font-bold whitespace-nowrap leading-none border cursor-help ${item.shortAlert.color}`}
                                          title={item.alertReasons.join('\n')}
                                        >
                                          {item.shortAlert.text}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="mt-1 pt-1 border-t border-slate-100/50 flex items-center justify-between">
                                  <span className="text-[9px] text-slate-500">{t('flyer_planned_count')}</span>
                                  <div className="flex items-center">
                                    <input 
                                      type="number" 
                                      value={item.plannedCount || ''} 
                                      onChange={(e) => updateItemPlannedCount(item.id, e.target.value)}
                                      onBlur={fetchData} 
                                      className={`w-14 text-right border rounded px-1 py-0.5 focus:outline-none focus:ring-1 ${item.isOverCount ? 'border-rose-300 bg-white text-rose-600 font-bold' : 'border-slate-200 bg-slate-50 text-indigo-600 font-bold'}`}
                                    />
                                    <span className="ml-0.5 text-[9px] text-slate-500">{t('unassigned_sheets')}</span>
                                  </div>
                                </div>

                                {item.isOverCount && excessCount > 0 && (
                                  <button 
                                    onClick={() => handleAdjustCount(item.id, item.plannedCount, excessCount)}
                                    className="mt-1 w-full text-[9px] bg-rose-100 text-rose-700 py-0.5 rounded hover:bg-rose-200 transition-colors font-bold flex items-center justify-center gap-1"
                                  >
                                    <i className="bi bi-magic"></i>{t('flyer_auto_adjust')}
                                  </button>
                                )}
                                
                                <div className="absolute top-0.5 right-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-0.5 bg-white/95 backdrop-blur rounded px-1 shadow border border-slate-200">
                                  <button onClick={() => setMovingItem(item)} className="text-indigo-500 hover:text-indigo-700 p-0.5" title={t('flyer_move_title')}><i className="bi bi-arrow-left-right"></i></button>
                                  <button onClick={() => removeFlyerFromSchedule(item.id)} className="text-rose-400 hover:text-rose-600 p-0.5" title={t('flyer_remove_title')}><i className="bi bi-x-circle-fill"></i></button>
                                </div>
                              </div>
                            ) : (
                              addingFlyerSlot?.scheduleId === schedule.id && addingFlyerSlot?.slotIndex === slotIndex ? (
                                <div ref={flyerDropdownRef} className="h-full min-h-[70px] relative">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={flyerSearchQuery}
                                    onChange={e => setFlyerSearchQuery(e.target.value)}
                                    placeholder={t('flyer_search_placeholder') || 'チラシ名・コードで検索...'}
                                    className="w-full border border-indigo-300 rounded px-2 py-1 text-[10px] focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                  />
                                  <div className="absolute top-full left-0 w-[260px] max-h-[200px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-[100] mt-1">
                                    {filteredFlyers.length === 0 && (
                                      <div className="p-2 text-center text-[10px] text-slate-400">{t('no_results') || '該当なし'}</div>
                                    )}
                                    {filteredFlyers.map((flyer: any) => (
                                      <button
                                        key={flyer.id}
                                        onClick={() => handleAddFlyer(schedule.id, slotIndex, flyer)}
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-[10px] border-b border-slate-50 transition-colors"
                                      >
                                        <div className="font-bold text-slate-800 truncate">{flyer.name}</div>
                                        <div className="text-[9px] text-slate-400 flex gap-2">
                                          <span>{flyer.flyerCode || '-'}</span>
                                          <span>{flyer.customer?.name || ''}</span>
                                          <span>{flyer.size?.name || ''}</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="h-full min-h-[70px] border-2 border-dashed border-slate-200 rounded flex flex-col items-center justify-center text-slate-300 hover:bg-slate-50 hover:border-indigo-300 transition-colors cursor-pointer group/empty"
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDrop(e, schedule.id, slotIndex, schedule.areaId)}
                                  onClick={() => { setAddingFlyerSlot({ scheduleId: schedule.id, slotIndex }); setFlyerSearchQuery(''); }}
                                >
                                  <i className="bi bi-plus-circle text-sm text-slate-300 group-hover/empty:text-indigo-400 transition-colors"></i>
                                  <span className="text-[9px] mt-0.5">Drop / Click</span>
                                </div>
                              )
                            )}
                          </td>
                        );
                      })}

                      <td className={`text-center ${tdBaseClass}`}>
                        <button onClick={() => deleteSchedule(schedule.id)} className="text-slate-300 hover:text-rose-600 transition-colors mt-2"><i className="bi bi-trash text-sm"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- 移動用モーダル --- */}
      {movingItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{t('move_modal_title')}</h3>
              <button onClick={() => setMovingItem(null)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <p className="text-xs text-indigo-800 font-bold mb-1">{t('move_modal_target_flyer')}</p>
                <p className="text-sm font-bold">{movingItem.flyerName}</p>
                {movingItem.flyerCode && <p className="text-xs text-indigo-600 mt-1">{t('move_modal_code', { code: movingItem.flyerCode })}</p>}
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">{t('move_modal_select_label')}</label>
                <select 
                  value={targetMoveScheduleId} 
                  onChange={(e) => setTargetMoveScheduleId(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 mb-3 bg-white"
                >
                  <option value="">{t('move_modal_select_placeholder')}</option>
                  {schedules
                    .filter(s => {
                      const movingAreaId = schedules.find(ms => ms.id === movingItem?.scheduleId)?.areaId;
                      return s.areaId === movingAreaId && s.id !== movingItem?.scheduleId;
                    })
                    .map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })} - {s.distributor?.name || t('unassigned_distributor')}
                    </option>
                  ))}
                </select>

                <div className="border-t border-slate-200 pt-3 mt-2">
                  <p className="text-[10px] text-slate-500 mb-2">{t('move_modal_new_schedule_hint')}</p>
                  <button 
                    onClick={handleMoveToNewSchedule}
                    className="w-full py-2 border-2 border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <i className="bi bi-plus-lg"></i> {t('move_modal_create_and_move')}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button onClick={() => setMovingItem(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">{t('cancel')}</button>
              <button onClick={executeMoveFromModal} disabled={!targetMoveScheduleId} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow">{t('move_modal_execute')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}