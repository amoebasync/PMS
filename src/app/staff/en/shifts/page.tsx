'use client';

import React, { useEffect, useState, useCallback } from 'react';

type Shift = {
  id: number;
  date: string;
  status: string;
  note?: string | null;
};

type BranchInfo = {
  id: number;
  nameJa: string;
  nameEn: string;
  closedDays: string | null;
  alternateBranch: {
    id: number;
    nameJa: string;
    nameEn: string;
    address: string | null;
    googleMapUrl: string | null;
  } | null;
} | null;

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
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL_JA = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const DAY_NAMES_SHORT_JA = ['日', '月', '火', '水', '木', '金', '土'];

function isClosedDay(date: Date, closedDays: string | null | undefined): boolean {
  if (!closedDays) return false;
  const dayNameFull = DAY_NAMES_FULL_JA[date.getDay()];
  const dayNameShort = DAY_NAMES_SHORT_JA[date.getDay()];
  const parts = closedDays.split(',').map(s => s.trim());
  return parts.some(p => p === dayNameFull || p === dayNameShort || p === dayNameShort + '曜日');
}

export default function ShiftsPageEn() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(today));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [branch, setBranch] = useState<BranchInfo>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});

  const now = new Date();
  const hour = now.getHours();
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + (hour < 9 ? 1 : 2));

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const year = weekStart.getFullYear();
    const month = weekStart.getMonth() + 1;
    const res = await fetch(`/api/staff/shifts?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setShifts(data.shifts || []);
      setBranch(data.branch || null);
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
      const shiftDate = new Date(existingShift.date);
      shiftDate.setHours(0, 0, 0, 0);

      if (shiftDate.getTime() === today.getTime()) {
        setMessage({ type: 'error', text: "You cannot cancel today's shift. If you have an emergency, please contact the company via LINE." });
        return;
      }
      if (shiftDate.getTime() === tomorrow.getTime() && hour >= 9) {
        setMessage({ type: 'error', text: "After 9 AM, you cannot cancel tomorrow's shift. If you have an emergency, please contact the company via LINE." });
        return;
      }

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

    const weekEndDate = addDays(weekStart, 6);
    const res = await fetch('/api/staff/shifts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addDates: [...pendingAdd],
        removeDateIds: [...pendingRemove],
        notes,
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(weekEndDate),
      }),
    });

    const data = await res.json();

    setPendingAdd(new Set());
    setPendingRemove(new Set());
    setNotes({});
    await fetchShifts();

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'An error occurred' });
    } else if (data.errors && data.errors.length > 0) {
      setMessage({ type: 'error', text: data.errors.join(' / ') });
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

  const closedDaySelections = [...pendingAdd].filter(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    return isClosedDay(d, branch?.closedDays);
  });

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
            const isClosed = isClosedDay(day, branch?.closedDays);
            const shiftDate = new Date(day);
            shiftDate.setHours(0, 0, 0, 0);
            const isCancelBlocked = shift && (
              shiftDate.getTime() === today.getTime() ||
              (shiftDate.getTime() === tomorrow.getTime() && hour >= 9)
            );

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                disabled={isPast && !shift}
                className={`relative flex flex-col items-center justify-center p-2 min-h-[76px] transition-colors border-r last:border-r-0 border-slate-50
                  ${isPast && !shift ? 'opacity-30 cursor-default' : isCancelBlocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:bg-slate-100'}
                  ${isSelectedAdd ? 'bg-indigo-50' : ''}
                  ${isSelectedRemove ? 'bg-rose-50' : ''}
                  ${isToday && !isSelectedAdd && !isSelectedRemove ? 'bg-blue-50' : ''}
                  ${isClosed && !isSelectedAdd && !isSelectedRemove && !isToday ? 'bg-amber-50/50' : ''}
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

                {isCancelBlocked && !isSelectedRemove && (
                  <i className="bi bi-lock-fill text-sm text-slate-400 absolute top-1 right-1"></i>
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
        <div className="flex items-center gap-1.5">
          <i className="bi bi-lock-fill text-xs text-slate-400"></i>
          <span className="text-xs text-slate-500">Cannot cancel</span>
        </div>
      </div>

      {/* Closed day alternate branch info */}
      {closedDaySelections.length > 0 && branch?.alternateBranch && (
        <div className="p-3 rounded-xl text-sm bg-amber-50 text-amber-800 border border-amber-200">
          <div className="flex items-start gap-2">
            <i className="bi bi-info-circle-fill mt-0.5 shrink-0"></i>
            <div>
              <p className="font-bold">Closed Day Notice</p>
              <p className="text-xs mt-1">
                Your selected dates include a closed day ({branch.closedDays}) for {branch.nameEn}.
                Please report to <span className="font-bold">{branch.alternateBranch.nameEn}</span> instead.
              </p>
              {branch.alternateBranch.address && (
                <p className="text-xs mt-1 text-amber-700">
                  <i className="bi bi-geo-alt-fill mr-1"></i>{branch.alternateBranch.address}
                </p>
              )}
              {branch.alternateBranch.googleMapUrl && (
                <a
                  href={branch.alternateBranch.googleMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full hover:bg-amber-200 transition-colors"
                >
                  <i className="bi bi-map"></i> View Map
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Submit panel */}
      {hasPending && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
          {pendingAdd.size > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                <i className="bi bi-plus-circle-fill text-indigo-500 mr-1.5"></i>
                Register: <span className="font-bold text-indigo-600">{pendingAdd.size} day(s)</span>
              </p>
              {[...pendingAdd].sort().map(dateStr => {
                const d = new Date(dateStr + 'T00:00:00');
                const dayName = DAY_NAMES_EN[d.getDay()];
                const closed = isClosedDay(d, branch?.closedDays);
                return (
                  <div key={dateStr} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-32 shrink-0">
                        {dateStr} ({dayName})
                        {closed && <span className="text-amber-600 ml-1">Closed</span>}
                      </span>
                      <input
                        type="text"
                        value={notes[dateStr] || ''}
                        onChange={(e) => setNotes(prev => ({ ...prev, [dateStr]: e.target.value }))}
                        placeholder="Note (optional)"
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
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

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
