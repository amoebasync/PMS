'use client';

import React, { useEffect, useState, useCallback } from 'react';

type ScheduleItem = {
  id: number;
  slotIndex: number;
  flyerName: string | null;
  plannedCount: number | null;
  actualCount: number | null;
};

type Schedule = {
  id: number;
  date: string;
  status: string;
  areaUnitPrice: number | null;
  sizeUnitPrice: number | null;
  area: { town_name: string; chome_name: string } | null;
  city: { name: string } | null;
  items: ScheduleItem[];
};

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

const statusLabel: Record<string, string> = {
  UNSTARTED: '未開始',
  IN_PROGRESS: '進行中',
  DISTRIBUTING: '配布中',
  COMPLETED: '完了',
};
const statusColor: Record<string, string> = {
  UNSTARTED: 'bg-slate-100 text-slate-500',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DISTRIBUTING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

export default function StaffHistoryPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/staff/schedules?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setSchedules(data.schedules || []);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const grouped: Record<string, Schedule[]> = {};
  for (const s of schedules) {
    const d = s.date.slice(0, 10);
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(s);
  }
  const sortedDates = Object.keys(grouped).sort();

  // 月合計
  const totalPlanned = schedules.reduce((sum, s) => sum + s.items.reduce((a, i) => a + (i.plannedCount || 0), 0), 0);
  const totalActual = schedules.reduce((sum, s) => sum + s.items.reduce((a, i) => a + (i.actualCount || 0), 0), 0);
  const completedDays = new Set(schedules.filter(s => s.status === 'COMPLETED').map(s => s.date.slice(0, 10))).size;

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-800">配布履歴</h1>
        <p className="text-xs text-slate-500 mt-1">月ごとの配布実績を確認できます</p>
      </div>

      {/* 月ナビ */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <button onClick={prevMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-left text-lg"></i>
        </button>
        <span className="font-bold text-slate-700 text-sm">{year}年{month}月</span>
        <button onClick={nextMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-right text-lg"></i>
        </button>
      </div>

      {/* サマリー */}
      {!loading && schedules.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">配布日数</p>
            <p className="text-xl font-black text-indigo-600 mt-0.5">{completedDays}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">予定数</p>
            <p className="text-xl font-black text-slate-700 mt-0.5">{totalPlanned.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">実績数</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{totalActual.toLocaleString()}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
          この月の配布履歴はありません
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((dateStr) => {
            const date = new Date(dateStr + 'T00:00:00');
            const dayOfWeek = date.getDay();
            const isSat = dayOfWeek === 6;
            const isSun = dayOfWeek === 0;
            const isToday = dateStr === formatDate(today);

            return (
              <div key={dateStr}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : isSat ? 'text-sky-500' : isSun ? 'text-rose-500' : 'text-slate-700'}`}>
                    {month !== date.getMonth() + 1 ? `${date.getMonth() + 1}/` : ''}{date.getDate()}日（{DAY_NAMES[dayOfWeek]}）
                  </span>
                  {isToday && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">今日</span>}
                </div>

                {grouped[dateStr].map((schedule) => {
                  const areaLabel = schedule.area
                    ? `${schedule.city?.name || ''} ${schedule.area.town_name}${schedule.area.chome_name}`
                    : 'エリア未設定';

                  return (
                    <div key={schedule.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-3">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                        <div>
                          <p className="text-xs font-bold text-slate-600">{areaLabel}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {schedule.items.length}種類
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[schedule.status] || 'bg-slate-100 text-slate-500'}`}>
                          {statusLabel[schedule.status] || schedule.status}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-50">
                        {schedule.items.map((item) => (
                          <div key={item.id} className="px-4 py-3">
                            <p className="text-xs font-bold text-slate-700 mb-1.5 leading-snug line-clamp-2">
                              {item.slotIndex}. {item.flyerName || '（チラシ名未設定）'}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <p className="text-[11px] text-slate-400">
                                  予定: <span className="font-bold text-slate-600">{item.plannedCount?.toLocaleString() ?? '—'}</span>
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  実績: <span className={`font-bold ${item.actualCount ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {item.actualCount?.toLocaleString() ?? '—'}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
