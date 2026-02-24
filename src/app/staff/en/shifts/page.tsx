'use client';

import React, { useEffect, useState, useCallback } from 'react';

type Shift = {
  id: number;
  date: string;
  status: string;
  note?: string | null;
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ShiftsPageEn() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<number>>(new Set());

  const now = new Date();
  const hour = now.getHours();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + (hour < 9 ? 1 : 2));

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const year = weekStart.getFullYear();
    const month = weekStart.getMonth() + 1;
    const res = await fetch(`/api/staff/shifts?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setShifts(data.shifts || []);
    }
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchShifts();
    setPendingAdd(new Set());
    setPendingRemove(new Set());
  }, [fetchShifts]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const shiftMap = new Map(shifts.map((s) => [s.date.slice(0, 10), s]));

  const handleDayClick = (day: Date) => {
    const dateStr = formatDate(day);
    const existingShift = shiftMap.get(dateStr);

    if (existingShift) {
      setPendingRemove((prev) => {
        const next = new Set(prev);
        if (next.has(existingShift.id)) next.delete(existingShift.id);
        else next.add(existingShift.id);
        return next;
      });
    } else {
      if (day < minDate) return;
      setPendingAdd((prev) => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (pendingAdd.size === 0 && pendingRemove.size === 0) return;
    setSubmitting(true);
    setMessage(null);

    const errors: string[] = [];

    for (const dateStr of pendingAdd) {
      const res = await fetch('/api/staff/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      if (!res.ok) {
        const data = await res.json();
        errors.push(data.error || `Failed to register ${dateStr}`);
      }
    }

    for (const id of pendingRemove) {
      const res = await fetch(`/api/staff/shifts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        errors.push(data.error || `Failed to cancel shift ID ${id}`);
      }
    }

    setPendingAdd(new Set());
    setPendingRemove(new Set());
    await fetchShifts();

    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join(' / ') });
    } else {
      setMessage({ type: 'success', text: 'Shifts updated successfully.' });
    }
    setSubmitting(false);
  };

  const canGoPrev = weekStart > today;
  const hasPending = pendingAdd.size > 0 || pendingRemove.size > 0;

  const statusColor: Record<string, string> = {
    WORKING:   'bg-emerald-500 text-white',
    APPROVED:  'bg-emerald-500 text-white',
    REQUESTED: 'bg-indigo-400 text-white',
    REJECTED:  'bg-rose-400 text-white',
    CANCELED:  'bg-slate-300 text-slate-600',
  };
  const statusLabel: Record<string, string> = {
    WORKING:   'Registered',
    APPROVED:  'Registered',
    REQUESTED: 'Pending',
    REJECTED:  'Rejected',
    CANCELED:  'Canceled',
  };

  const weekLabel = `${weekStart.toLocaleString('en-US', { month: 'short' })} ${weekStart.getDate()} – ${addDays(weekStart, 6).toLocaleString('en-US', { month: 'short' })} ${addDays(weekStart, 6).getDate()}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-800">Shift Registration</h1>
        <p className="text-xs text-slate-500 mt-1">
          Tap dates to select, then press &quot;Confirm&quot; to register.
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm font-bold ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {message.type === 'success'
            ? <i className="bi bi-check-circle-fill mr-2"></i>
            : <i className="bi bi-exclamation-triangle-fill mr-2"></i>}
          {message.text}
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <button
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          disabled={!canGoPrev}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <i className="bi bi-chevron-left text-lg"></i>
        </button>
        <span className="font-bold text-slate-700 text-sm">{weekLabel}</span>
        <button
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <i className="bi bi-chevron-right text-lg"></i>
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`py-2 text-center text-xs font-bold ${
              i === 5 ? 'text-sky-500' : i === 6 ? 'text-rose-500' : 'text-slate-500'
            }`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weekDays.map((day, i) => {
            const dateStr = formatDate(day);
            const shift = shiftMap.get(dateStr);
            const isPast = day < minDate;
            const isToday = formatDate(day) === formatDate(today);
            const isSat = i === 5;
            const isSun = i === 6;
            const isSelectedAdd = pendingAdd.has(dateStr);
            const isSelectedRemove = shift ? pendingRemove.has(shift.id) : false;

            return (
              <button
                key={dateStr}
                onClick={() => !isPast && handleDayClick(day)}
                disabled={isPast && !shift}
                className={`relative flex flex-col items-center justify-center p-2 min-h-[76px] transition-colors border-r last:border-r-0 border-slate-50
                  ${isPast && !shift ? 'opacity-30 cursor-default' : 'cursor-pointer active:bg-slate-100'}
                  ${isSelectedAdd ? 'bg-indigo-50' : ''}
                  ${isSelectedRemove ? 'bg-rose-50' : ''}
                  ${isToday && !isSelectedAdd && !isSelectedRemove ? 'bg-blue-50' : ''}
                `}
              >
                <span className={`text-sm font-bold mb-1 ${
                  isToday && !isSelectedAdd && !isSelectedRemove
                    ? 'w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs'
                    : isSat ? 'text-sky-500' : isSun ? 'text-rose-500' : 'text-slate-700'
                }`}>
                  {day.getDate()}
                </span>

                {shift && !isSelectedRemove && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    statusColor[shift.status] || 'bg-slate-200 text-slate-600'
                  }`}>
                    {statusLabel[shift.status] || shift.status}
                  </span>
                )}

                {isSelectedRemove && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-rose-500 text-white">
                    Cancel
                  </span>
                )}

                {isSelectedAdd && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none bg-indigo-600 text-white">
                    Selected
                  </span>
                )}

                {!shift && !isSelectedAdd && !isPast && (
                  <span className="text-[9px] text-slate-300 font-medium">Tap</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span className="text-xs text-slate-500">Registered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
          <span className="text-xs text-slate-500">Selected (to register)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500"></span>
          <span className="text-xs text-slate-500">To cancel</span>
        </div>
      </div>

      {/* Submit panel */}
      {hasPending && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
          {pendingAdd.size > 0 && (
            <p className="text-sm text-slate-600">
              <i className="bi bi-plus-circle-fill text-indigo-500 mr-1.5"></i>
              Register: <span className="font-bold text-indigo-600">{pendingAdd.size} day(s)</span>
              {' '}({[...pendingAdd].sort().join(', ')})
            </p>
          )}
          {pendingRemove.size > 0 && (
            <p className="text-sm text-slate-600">
              <i className="bi bi-dash-circle-fill text-rose-500 mr-1.5"></i>
              Cancel: <span className="font-bold text-rose-600">{pendingRemove.size} day(s)</span>
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
            ) : (
              <><i className="bi bi-check2-all"></i> Confirm</>
            )}
          </button>
        </div>
      )}

      {/* Shift list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : shifts.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-600 mb-3 px-1">This Month&apos;s Shifts</h2>
          <div className="space-y-2">
            {shifts.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 flex items-center justify-between">
                <p className="font-bold text-slate-800 text-sm">{s.date.slice(0, 10)}</p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  statusColor[s.status] || 'bg-slate-100 text-slate-600'
                }`}>
                  {statusLabel[s.status] || s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
