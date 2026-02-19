'use client';

import React, { useState, useEffect } from 'react';

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
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [remarksInput, setRemarksInput] = useState('');

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
        alert('備考の保存に失敗しました');
      }
    } catch (e) {
      alert('通信エラーが発生しました');
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
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex-none space-y-4">
        <h1 className="text-2xl font-bold text-slate-800"><i className="bi bi-calendar-check text-indigo-600"></i> スケジュール照会</h1>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">対象日</label>
            <input 
              type="date" 
              value={filterDate} 
              onChange={(e) => setFilterDate(e.target.value)} 
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">ステータス</label>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px]"
            >
              <option value="ALL">すべて</option>
              <option value="UNSTARTED">未開始</option>
              <option value="IN_PROGRESS">配布中</option>
              <option value="COMPLETED">完了</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 mb-1">キーワード検索</label>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
              <input 
                type="text" 
                placeholder="チラシ名、配布員、エリア名で検索..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}
        
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-100 text-slate-600 sticky top-0 z-20 shadow-sm">
              <tr>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 z-30 sticky left-0 text-center">ステータス</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[100px]">支店名</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[100px]">配布員コード</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[150px]">配布員名</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">都道府県</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">市区町村</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 min-w-[150px]">エリア名</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 whitespace-normal min-w-[80px]">配布可能枚数</th>
                
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <th key={num} colSpan={5} className="border border-slate-200 px-3 py-1 bg-indigo-50 text-indigo-800 text-center font-bold">
                    チラシ {num}
                  </th>
                ))}
                
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">開始時間</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">現在の完了枚数</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100">完了時間</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 text-center">GPS</th>
                <th rowSpan={2} className="border border-slate-200 px-3 py-2 bg-slate-100 text-center">備考</th>
              </tr>
              <tr>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <React.Fragment key={`sub-${num}`}>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium min-w-[150px]">チラシ名</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium">配布期限</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium">配布方法</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium text-right">予定枚数</th>
                    <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium text-right">配布枚数</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredSchedules.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={43} className="px-6 py-10 text-center text-slate-500">
                    指定された条件のスケジュールは見つかりませんでした。
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
                      {s.status === 'COMPLETED' ? <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">完了</span> : 
                       s.status === 'IN_PROGRESS' ? <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">配布中</span> : 
                       <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">未開始</span>}
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
                        <td className="border border-slate-200 px-2 py-2 text-slate-500">{flyer?.endDate ? new Date(flyer.endDate).toLocaleDateString() : '-'}</td>
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
                      <button className="text-slate-400 hover:text-emerald-500 transition-colors" title="GPSマップを開く (未実装)">
                        <i className="bi bi-geo-alt-fill text-lg"></i>
                      </button>
                    </td>

                    <td className="border border-slate-200 px-2 py-2 text-center">
                      <button 
                        onClick={() => { setEditingSchedule(s); setRemarksInput(s.remarks || ''); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${s.remarks ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        title={s.remarks || "備考を追加"}
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

      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">備考の編集</h3>
              <button onClick={() => setEditingSchedule(null)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-6">
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
                placeholder="現場への指示や、特別な注意事項を記入してください..."
              ></textarea>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setEditingSchedule(null)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">キャンセル</button>
              <button onClick={saveRemarks} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">保存する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}