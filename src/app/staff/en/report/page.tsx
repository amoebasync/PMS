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
  area: { town_name: string; chome_name: string; prefecture?: { name: string } | null; city?: { name: string } | null } | null;
  city: { name: string } | null;
  items: ScheduleItem[];
};

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusLabel: Record<string, string> = {
  UNSTARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  DISTRIBUTING: 'Distributing',
  COMPLETED: 'Completed',
};
const statusColor: Record<string, string> = {
  UNSTARTED: 'bg-slate-100 text-slate-500',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DISTRIBUTING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
};

export default function StaffHistoryPageEn() {
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
        <h1 className="text-2xl font-black text-slate-800">Distribution History</h1>
        <p className="text-xs text-slate-500 mt-1">View your monthly distribution records</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <button onClick={prevMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-left text-lg"></i>
        </button>
        <span className="font-bold text-slate-700 text-sm">
          {new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' })} {year}
        </span>
        <button onClick={nextMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-right text-lg"></i>
        </button>
      </div>

      {/* Summary */}
      {!loading && schedules.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Days</p>
            <p className="text-xl font-black text-indigo-600 mt-0.5">{completedDays}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Planned</p>
            <p className="text-xl font-black text-slate-700 mt-0.5">{totalPlanned.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Actual</p>
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
          No delivery history for this month
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((dateStr) => {
            const date = new Date(dateStr + 'T00:00:00');
            const dayOfWeek = date.getDay();
            const isSat = dayOfWeek === 6;
            const isSun = dayOfWeek === 0;
            const isToday = dateStr === formatDate(today);
            const isFuture = date > today;
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const isTomorrow = dateStr === formatDate(tomorrow);

            return (
              <div key={dateStr}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : isSat ? 'text-sky-500' : isSun ? 'text-rose-500' : 'text-slate-700'}`}>
                    {DAY_NAMES[dayOfWeek]}, {date.toLocaleString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  {isToday && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Today</span>}
                  {isTomorrow && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Tomorrow</span>}
                  {isFuture && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Upcoming</span>}
                </div>

                {isFuture && (
                  <div className="flex items-center gap-1.5 px-2 mb-2 text-[10px] text-amber-600">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <span>* This schedule may be subject to change</span>
                  </div>
                )}

                {grouped[dateStr].map((schedule) => {
                  const pref = schedule.area?.prefecture?.name || '';
                  const city = schedule.area?.city?.name || schedule.city?.name || '';
                  const chome = schedule.area?.chome_name || schedule.area?.town_name || '';
                  const areaLabel = schedule.area ? `${city} ${chome}` : 'Area not set';
                  const fullAddress = `${pref}${city}${chome}`;
                  const mapUrl = schedule.area ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null;

                  return (
                    <div key={schedule.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden mb-3 ${isFuture ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                        <div className="flex-1 min-w-0">
                          {mapUrl ? (
                            <a href={mapUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1">
                              <i className="bi bi-geo-alt-fill text-[10px]"></i>{areaLabel}
                            </a>
                          ) : (
                            <p className="text-xs font-bold text-slate-600">{areaLabel}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {schedule.items.length} type(s)
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor[schedule.status] || 'bg-slate-100 text-slate-500'}`}>
                          {statusLabel[schedule.status] || schedule.status}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-50">
                        {schedule.items.map((item) => (
                          <div key={item.id} className="px-4 py-3">
                            <p className="text-xs font-bold text-slate-700 mb-1.5 leading-snug line-clamp-2">
                              {item.slotIndex}. {item.flyerName || '(Unnamed flyer)'}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <p className="text-[11px] text-slate-400">
                                  Planned: <span className="font-bold text-slate-600">{item.plannedCount?.toLocaleString() ?? '—'}</span>
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Actual: <span className={`font-bold ${item.actualCount ? 'text-emerald-600' : 'text-slate-400'}`}>
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
