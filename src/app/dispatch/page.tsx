'use client';

import React, { useState, useEffect, useMemo } from 'react';

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

// ★ 左側固定用のCSS定義
const thBase = "px-2 py-2 font-bold text-slate-600 bg-slate-50 border-b border-slate-200 shadow-[0_1px_0_0_#e2e8f0]";
const tdBase = "px-2 py-2 border-b border-slate-100 align-top bg-white group-hover:bg-indigo-50/40 transition-colors";

const stickyClasses = {
  date: { th: `sticky left-0 z-50 w-[100px] min-w-[100px] ${thBase}`, td: `sticky left-0 z-20 w-[100px] min-w-[100px] ${tdBase}` },
  area: { th: `sticky left-[100px] z-50 w-[150px] min-w-[150px] ${thBase}`, td: `sticky left-[100px] z-20 w-[150px] min-w-[150px] ${tdBase}` },
  branch: { th: `sticky left-[250px] z-50 w-[90px] min-w-[90px] ${thBase}`, td: `sticky left-[250px] z-20 w-[90px] min-w-[90px] ${tdBase}` },
  distributor: { th: `sticky left-[340px] z-50 w-[110px] min-w-[110px] ${thBase}`, td: `sticky left-[340px] z-20 w-[110px] min-w-[110px] ${tdBase}` },
  status: { th: `sticky left-[450px] z-50 w-[80px] min-w-[80px] border-r-2 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${thBase}`, td: `sticky left-[450px] z-20 w-[80px] min-w-[80px] border-r-2 border-r-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${tdBase}` },
};

export default function DispatchPage() {
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

  const handleDragStart = (e: React.DragEvent, data: any) => { e.dataTransfer.setData('application/json', JSON.stringify(data)); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent, targetScheduleId: number, targetSlotIndex: number, targetAreaId: number) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);

    if (data.areaId !== targetAreaId) {
      alert('エラー: 配布先エリアが異なるため、このスケジュールには組み込めません。');
      return;
    }

    const targetSchedule = enrichedSchedules.find(s => s.id === targetScheduleId);
    if (targetSchedule) {
      const isDuplicate = targetSchedule.items.some(i => {
        if (data.type === 'SCHEDULED' && i.id === data.itemId) return false; 
        if (i.flyerId === data.flyerId) return true; 
        if (data.flyerCode && i.flyerCode === data.flyerCode) return true; 
        return false;
      });
      if (isDuplicate) {
        alert('エラー: このスケジュールには、すでに同じチラシ（または同一コードのチラシ）が組み込まれています。');
        return;
      }
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
    } catch (err) { alert('処理に失敗しました'); }
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
          alert(`チラシの完了期限日（${targetDate}）に合わせてスケジュールを作成しました。\n表示期間を自動調整します。`);
          setDateFrom(targetDate); setDateTo(targetDate);
        } else {
          fetchData();
        }
      }
    } catch (e) { alert('スケジュールの作成に失敗しました'); }
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
    } catch (e) { alert('更新に失敗しました'); }
  };

  const updateItemPlannedCount = async (itemId: number, newCount: string) => {
    try {
      const res = await fetch('/api/schedules/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, plannedCount: newCount })
      });
      if (res.ok) fetchData();
    } catch (e) { alert('枚数の更新に失敗しました'); }
  };

  const handleAdjustCount = async (itemId: number, currentCount: number, excess: number) => {
    const newCount = Math.max(0, currentCount - excess);
    if (!confirm(`配布予定枚数を ${excess.toLocaleString()} 枚オーバーしています。\nこの枠の枚数を ${currentCount.toLocaleString()}枚 から 【${newCount.toLocaleString()}枚】 に自動調整しますか？`)) return;
    await updateItemPlannedCount(itemId, newCount.toString());
  };

  const removeFlyerFromSchedule = async (itemId: number) => {
    if (!confirm('このチラシをスケジュールから外して、未手配に戻しますか？')) return;
    try {
      const res = await fetch(`/api/schedules/items?id=${itemId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (e) { alert('削除に失敗しました'); }
  };

  const deleteSchedule = async (scheduleId: number) => {
    if (!confirm('このスケジュール枠自体を削除しますか？\n(※組み込まれているチラシはすべて未手配に戻ります)')) return;
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (e) { alert('削除に失敗しました'); }
  };

  const executeMoveFromModal = async () => {
    if (!movingItem || !targetMoveScheduleId) return;

    const targetSchedule = enrichedSchedules.find(s => s.id === parseInt(targetMoveScheduleId));
    if (targetSchedule) {
      const isDuplicate = targetSchedule.items.some(i => {
        if (i.id === movingItem.id) return false;
        if (i.flyerId === movingItem.flyerId) return true;
        if (movingItem.flyerCode && i.flyerCode === movingItem.flyerCode) return true;
        return false;
      });
      if (isDuplicate) {
        alert('エラー: このスケジュールには、すでに同じチラシが組み込まれています。');
        return;
      }
    }

    try {
      const res = await fetch('/api/schedules/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: movingItem.id, targetScheduleId: targetMoveScheduleId, targetSlotIndex: movingItem.slotIndex })
      });
      if (res.ok) {
        setMovingItem(null); setTargetMoveScheduleId(''); fetchData();
      }
    } catch (e) { alert('移動に失敗しました'); }
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
      alert('新規スケジュールの作成＆移動に失敗しました。');
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
        if (isOverCount) alertReasons.push("予定枚数超過");
        if (isBeforeStart) alertReasons.push("開始日前");
        if (isOverSpareDate) alertReasons.push("予備期限超過");

        return { ...item, isOverCount, isDanger, isWarning, hasAlert: isDanger, alertReasons };
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
    // ★ 修正: LayoutWrapperの p-6 を考慮し、画面の100%の高さから確実にヘッダー分だけを引いた絶対高さを設定。
    // 親コンテナに overflow-hidden を設定して全体のスクロールを無効化。
    <div className="flex flex-col h-[calc(100vh-3rem)] w-full overflow-hidden space-y-4 -mx-2">
      
      {/* 1. ヘッダー＆フィルタエリア (高さ固定、スクロールなし) */}
      <div className="flex-none bg-white p-4 rounded-xl shadow-sm border border-slate-200 mx-2">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-diagram-3-fill text-indigo-600"></i>ディスパッチ (スケジュール編成)
          </h1>
          <button 
            onClick={() => setShowOnlyAlerts(!showOnlyAlerts)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm transition-colors border ${showOnlyAlerts ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <i className={`bi ${alertCount > 0 ? 'bi-exclamation-triangle-fill text-rose-500' : 'bi-check-circle-fill text-emerald-500'}`}></i>
            アラート対象: {alertCount}件
            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 ml-1">{showOnlyAlerts ? '解除' : '絞り込む'}</span>
          </button>
        </div>
        
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">期間 (FROM)</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">期間 (TO)</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">ステータス</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
              <option value="ALL">すべて</option>
              <option value="UNSTARTED">未開始 (未完了)</option>
              <option value="IN_PROGRESS">配布中</option>
              <option value="COMPLETED">完了</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">検索 (チラシ, 人, エリア)</label>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-2 text-slate-400 text-sm"></i>
              <input type="text" placeholder="キーワード..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. メインの2ペイン (残り高さをすべて使い切る、かつ内部でスクロール) */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden w-full px-2 pb-2">
        
        {/* 左側: 未手配リスト (幅を固定、内部でのみ縦スクロール) */}
        <div className="w-[280px] shrink-0 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full z-10">
          <div className="flex-none p-3 bg-slate-800 text-white flex justify-between items-center rounded-t-xl">
            <h3 className="font-bold text-sm"><i className="bi bi-inbox-fill mr-1"></i> 未手配の依頼</h3>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">{filteredUnassignedItems.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50">
            {isLoading ? <div className="text-center text-slate-400 text-sm py-10">読み込み中...</div> :
             filteredUnassignedItems.length === 0 ? <div className="text-center text-slate-400 text-sm py-10">この期間の未手配依頼はありません。</div> :
             filteredUnassignedItems.map(oda => {
               const od = oda.orderDistribution;
               const stat = orderStats[`${od.orderId}_${od.flyerId}`];

               return (
                 <div 
                   key={oda.id} 
                   draggable
                   onDragStart={(e) => handleDragStart(e, { type: 'UNASSIGNED', odaId: oda.id, areaId: oda.areaId, flyerId: od.flyerId, flyerCode: od.flyer?.flyerCode })}
                   className={`p-3 rounded-lg shadow-sm border cursor-move transition-all group relative ${stat?.isOver ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200 hover:border-indigo-400'}`}
                 >
                   <div className="text-[10px] font-bold text-indigo-600 mb-1 flex justify-between">
                     <span className="truncate pr-1">{od.order?.customer?.name || '顧客不明'}</span>
                     <span className="shrink-0 bg-indigo-100 px-1 rounded text-indigo-800">{od.flyer?.size?.name || ''}</span>
                   </div>
                   <div className="text-xs font-bold text-slate-800 mb-1 line-clamp-1" title={od.flyer?.name}>{od.flyer?.name}</div>
                   <div className="font-bold text-slate-700 text-[11px] mb-2">{oda.area.city?.name} {formatAreaName(oda.area.town_name, oda.area.chome_name)}</div>
                   
                   <div className="pt-2 border-t border-slate-100 text-[10px] space-y-1">
                     <div className="text-slate-500 font-mono">
                       {od.startDate ? new Date(od.startDate).toLocaleDateString('ja-JP',{month:'short',day:'numeric'}) : '-'} 〜 <span className="font-bold text-rose-600">{od.endDate ? new Date(od.endDate).toLocaleDateString('ja-JP',{month:'short',day:'numeric'}) : '-'}</span>
                     </div>
                     <div className="flex justify-between text-slate-500">
                       <span>全体依頼数:</span><span className="font-bold">{od.plannedCount?.toLocaleString()}枚</span>
                     </div>
                     <div className={`flex justify-between ${stat?.isOver ? 'text-rose-600 font-bold' : 'text-emerald-600'}`}>
                       <span>手配済合計:</span><span>{stat?.totalAssigned?.toLocaleString() || 0}枚</span>
                     </div>
                   </div>
                   
                   <button 
                     onClick={() => handleCreateScheduleFromUnassigned(oda.id, od.endDate)}
                     className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold hover:bg-indigo-600 hover:text-white transition-colors border border-indigo-200 shadow-sm"
                     title="このチラシの完了期限日でスケジュールを作成します"
                   >
                     <i className="bi bi-box-arrow-in-right"></i> 枠を作る
                   </button>
                 </div>
               )
             })}
          </div>
          <div className="flex-none p-2 text-center text-[10px] text-slate-500 bg-slate-100 border-t border-slate-200 rounded-b-xl">
            右の枠へドラッグ＆ドロップで配置
          </div>
        </div>

        {/* 右側: スケジュール一覧 (内部でのみ横・縦にスクロール) */}
        <div className="flex-1 min-w-0 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm h-full relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* ★ テーブル表示領域。ここだけがスクロールする */}
          <div className="flex-1 overflow-auto custom-scrollbar rounded-xl relative">
            <table className="text-left text-[11px] whitespace-nowrap border-separate border-spacing-0 w-max min-w-full">
              <thead>
                <tr>
                  <th className={stickyClasses.date.th} onClick={() => handleSort('date')}>日付 {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                  <th className={stickyClasses.area.th} onClick={() => handleSort('areaCode')}>エリア {sortConfig.key === 'areaCode' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                  <th className={stickyClasses.branch.th} onClick={() => handleSort('branch')}>支店 {sortConfig.key === 'branch' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                  <th className={stickyClasses.distributor.th}>配布員</th>
                  <th className={stickyClasses.status.th}>状態</th>
                  
                  {/* スクロールするチラシ列 */}
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <th key={num} className={`z-40 min-w-[180px] text-center bg-indigo-50/50 ${thBase}`}>チラシ {num}</th>
                  ))}
                  <th className={`z-40 w-[30px] text-center ${thBase}`}><i className="bi bi-trash"></i></th>
                </tr>
              </thead>
              <tbody>
                {processedSchedules.map(schedule => (
                  <tr key={schedule.id} className="group cursor-default">
                    {/* --- 左側固定カラム --- */}
                    <td className={stickyClasses.date.td}>
                      <input 
                        type="date" 
                        value={new Date(schedule.date).toISOString().split('T')[0]} 
                        onChange={(e) => updateScheduleProp(schedule.id, 'date', e.target.value)}
                        className="border-0 bg-transparent font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 rounded p-1 w-[90px] text-[10px]"
                      />
                    </td>
                    <td className={stickyClasses.area.td}>
                      <div className="font-bold text-indigo-700 truncate" title={formatAreaName(schedule.area?.town_name, schedule.area?.chome_name)}>
                        {formatAreaName(schedule.area?.town_name, schedule.area?.chome_name)}
                      </div>
                      <div className="text-[9px] text-slate-400">{schedule.area?.prefecture?.name} {schedule.city?.name}</div>
                    </td>
                    <td className={stickyClasses.branch.td}>
                      <select value={schedule.branchId || ''} onChange={(e) => updateScheduleProp(schedule.id, 'branchId', e.target.value)} className="border-0 bg-transparent font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 rounded p-1 w-full text-[10px] truncate cursor-pointer">
                        <option value="">未設定</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
                      </select>
                    </td>
                    <td className={stickyClasses.distributor.td}>
                      <select value={schedule.distributorId || ''} onChange={(e) => updateScheduleProp(schedule.id, 'distributorId', e.target.value)} className="border border-slate-200 bg-slate-50 rounded p-1 w-full text-[10px] focus:ring-2 focus:ring-indigo-500 truncate cursor-pointer">
                        <option value="">未割当</option>
                        {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td className={stickyClasses.status.td}>
                      <select value={schedule.status} onChange={(e) => updateScheduleProp(schedule.id, 'status', e.target.value)} className="border-0 bg-transparent font-bold p-1 rounded w-full text-[10px] cursor-pointer">
                        <option value="UNSTARTED">未開始</option><option value="IN_PROGRESS">配布中</option><option value="COMPLETED">完了</option>
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
                          className={tdBase}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, schedule.id, slotIndex, schedule.areaId)}
                        >
                          {item ? (
                            <div 
                              draggable 
                              onDragStart={(e) => handleDragStart(e, { type: 'SCHEDULED', itemId: item.id, areaId: schedule.areaId, scheduleId: schedule.id, slotIndex, flyerId: item.flyerId, flyerCode: item.flyerCode })}
                              className={`border rounded p-1.5 cursor-move transition-colors relative group/card h-full flex flex-col justify-between ${cardClass}`}
                            >
                              <div>
                                <div className="font-bold text-slate-800 truncate mb-1 pr-6" title={item.flyerName}>
                                  {item.flyerName}
                                </div>

                                {(item.isDanger || item.isWarning) && (
                                  <div className={`text-[9px] font-bold mb-1 p-1 rounded border leading-tight ${item.isDanger ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                    {item.isDanger && item.alertReasons.map((r:string, i:number) => <div key={i} className="flex items-start"><i className="bi bi-exclamation-triangle-fill mr-1 mt-0.5"></i><span>{r}</span></div>)}
                                    {item.isWarning && <div className="flex items-start"><i className="bi bi-exclamation-triangle-fill mr-1 mt-0.5"></i><span>配布期限超過</span></div>}
                                  </div>
                                )}

                                <div className="text-[9px] text-slate-500">
                                  <div className="flex justify-between items-center border-b border-slate-100 pb-0.5 mb-0.5">
                                    <span className="truncate max-w-[60px]">{item.method}</span>
                                    <span className="truncate max-w-[50px] font-bold text-slate-600">{item.flyer?.size?.name || '-'}</span>
                                  </div>
                                  <div className="truncate font-mono">
                                    期限: <span className={`font-bold ${item.isOverSpareDate ? 'text-rose-600' : item.isOverEndDate ? 'text-amber-600' : 'text-slate-600'}`}>
                                      {item.endDate ? new Date(item.endDate).toLocaleDateString('ja-JP', {month:'short', day:'numeric'}) : '-'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-1 pt-1 border-t border-slate-100/50 flex items-center justify-between">
                                <span className="text-[9px] text-slate-500">予定枚数:</span>
                                <div className="flex items-center">
                                  <input 
                                    type="number" 
                                    value={item.plannedCount || ''} 
                                    onChange={(e) => updateItemPlannedCount(item.id, e.target.value)}
                                    onBlur={fetchData} 
                                    className={`w-14 text-right border rounded px-1 py-0.5 focus:outline-none focus:ring-1 ${item.isOverCount ? 'border-rose-300 bg-white text-rose-600 font-bold' : 'border-slate-200 bg-slate-50 text-indigo-600 font-bold'}`}
                                  />
                                  <span className="ml-0.5 text-[9px] text-slate-500">枚</span>
                                </div>
                              </div>

                              {item.isOverCount && excessCount > 0 && (
                                <button 
                                  onClick={() => handleAdjustCount(item.id, item.plannedCount, excessCount)}
                                  className="mt-1 w-full text-[9px] bg-rose-100 text-rose-700 py-0.5 rounded hover:bg-rose-200 transition-colors font-bold flex items-center justify-center gap-1"
                                >
                                  <i className="bi bi-magic"></i>枚数を自動調整
                                </button>
                              )}
                              
                              <div className="absolute top-0.5 right-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-0.5 bg-white/95 backdrop-blur rounded px-1 shadow border border-slate-200">
                                <button onClick={() => setMovingItem(item)} className="text-indigo-500 hover:text-indigo-700 p-0.5" title="移動"><i className="bi bi-arrow-left-right"></i></button>
                                <button onClick={() => removeFlyerFromSchedule(item.id)} className="text-rose-400 hover:text-rose-600 p-0.5" title="枠から外す"><i className="bi bi-x-circle-fill"></i></button>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full min-h-[70px] border-2 border-dashed border-slate-200 rounded flex items-center justify-center text-slate-300 hover:bg-slate-50 hover:border-indigo-300 transition-colors">
                              <span className="text-[9px]">Drop Here</span>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className={`text-center ${tdBase}`}>
                      <button onClick={() => deleteSchedule(schedule.id)} className="text-slate-300 hover:text-rose-600 transition-colors mt-2"><i className="bi bi-trash text-sm"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- 移動用モーダル --- */}
      {movingItem && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">チラシの移動</h3>
              <button onClick={() => setMovingItem(null)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <p className="text-xs text-indigo-800 font-bold mb-1">対象のチラシ:</p>
                <p className="text-sm font-bold">{movingItem.flyerName}</p>
                {movingItem.flyerCode && <p className="text-xs text-indigo-600 mt-1">コード: {movingItem.flyerCode}</p>}
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">移動先のスケジュールを選択 (同一エリアのみ表示)</label>
                <select 
                  value={targetMoveScheduleId} 
                  onChange={(e) => setTargetMoveScheduleId(e.target.value)}
                  className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 mb-3 bg-white"
                >
                  <option value="">-- 既存のスケジュール枠へ移動 --</option>
                  {schedules
                    .filter(s => {
                      const movingAreaId = schedules.find(ms => ms.id === movingItem?.scheduleId)?.areaId;
                      return s.areaId === movingAreaId && s.id !== movingItem?.scheduleId;
                    })
                    .map(s => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.date).toLocaleDateString('ja-JP')} - {s.distributor?.name || '未割当'}
                    </option>
                  ))}
                </select>

                <div className="border-t border-slate-200 pt-3 mt-2">
                  <p className="text-[10px] text-slate-500 mb-2">または、新しい枠（スケジュール）を作成して移動します</p>
                  <button 
                    onClick={handleMoveToNewSchedule}
                    className="w-full py-2 border-2 border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <i className="bi bi-plus-lg"></i> 新規スケジュール枠を作って移動
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button onClick={() => setMovingItem(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">キャンセル</button>
              <button onClick={executeMoveFromModal} disabled={!targetMoveScheduleId} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow">選択した枠へ移動</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}