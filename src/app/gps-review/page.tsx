'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReviewPanel from '@/components/gps-review/ReviewPanel';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScheduleItem {
  id: number;
  status: string;
  distributorId: number | null;
  distributorName: string;
  distributorStaffId: string;
  areaName: string;
  plannedCount: number;
  actualCount: number;
  startTime: string | null;
  endTime: string | null;
  workMinutes: number;
  totalDistanceKm: number;
  gpsPointCount: number;
  speedPerHour: number;
  coverageDiff: number | null;
  speedDeviation: number | null;
  fastMoveRatio: number | null;
  outOfAreaPct: number | null;
  pauseMinutes: number | null;
  riskScoreV2: number | null;
  riskLevelV2: string | null;
  checkGps: boolean;
  checkGpsResult: string | null;
  checkGpsComment: string | null;
  hasSession: boolean;
}

interface Summary {
  total: number;
  reviewed: number;
  unreviewedHigh: number;
}

type FilterTab = 'all' | 'unreviewed' | 'high';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Yesterday in JST as YYYY-MM-DD */
function getYesterdayJST(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function riskScoreColor(score: number | null, checkGps: boolean, checkGpsResult: string | null): string {
  if (checkGps && checkGpsResult === 'OK') return 'bg-emerald-500';
  if (checkGps && checkGpsResult === 'NG') return 'bg-red-500';
  if (score == null) return 'bg-slate-300';
  if (score >= 50) return 'bg-red-500';
  if (score >= 25) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function indicatorDot(value: number | null, thresholdHigh: number, thresholdMed: number): string {
  if (value == null) return 'bg-slate-300';
  if (value >= thresholdHigh) return 'bg-red-500';
  if (value >= thresholdMed) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GpsReviewPage() {
  const [date, setDate] = useState(getYesterdayJST);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, reviewed: 0, unreviewedHigh: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const listRef = useRef<HTMLDivElement>(null);

  /* ---- Fetch data ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gps-review?date=${date}`);
      if (res.ok) {
        const json = await res.json();
        setSchedules(json.schedules ?? []);
        setSummary(json.summary ?? { total: 0, reviewed: 0, unreviewedHigh: 0 });
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
    setSelectedId(null);
  }, [fetchData]);

  /* ---- Filtered schedules ---- */
  const filtered = schedules.filter((s) => {
    if (filter === 'unreviewed') return !s.checkGps;
    if (filter === 'high') return (s.riskScoreV2 ?? 0) >= 50 && !s.checkGps;
    return true;
  });

  /* ---- Selected index ---- */
  const selectedIndex = filtered.findIndex((s) => s.id === selectedId);

  /* ---- Keyboard shortcuts ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filtered.length === 0) return;
        const nextIdx = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, filtered.length - 1);
        setSelectedId(filtered[nextIdx].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filtered.length === 0) return;
        const prevIdx = selectedIndex < 0 ? 0 : Math.max(selectedIndex - 1, 0);
        setSelectedId(filtered[prevIdx].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedId != null) {
          const sel = schedules.find((s) => s.id === selectedId);
          if (sel && !sel.checkGps) {
            handleQuickOK(selectedId);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, selectedIndex, selectedId, schedules]);

  /* ---- Quick OK ---- */
  const handleQuickOK = async (id: number) => {
    try {
      const res = await fetch(`/api/gps-review/${id}/verdict`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'OK', comment: '' }),
      });
      if (res.ok) {
        const updated = await res.json();
        handleVerdictSaved(updated);
      }
    } catch (err) {
      console.error('Quick OK error:', err);
    }
  };

  /* ---- Verdict saved handler ---- */
  const handleVerdictSaved = (updated: { id: number; checkGps: boolean; checkGpsResult: string | null; checkGpsComment: string | null }) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === updated.id
          ? { ...s, checkGps: updated.checkGps, checkGpsResult: updated.checkGpsResult, checkGpsComment: updated.checkGpsComment }
          : s
      )
    );
    setSummary((prev) => ({
      ...prev,
      reviewed: prev.reviewed + (updated.checkGps ? 1 : 0),
      unreviewedHigh: Math.max(0, prev.unreviewedHigh - (updated.checkGps ? 1 : 0)),
    }));

    // Auto-advance to next unreviewed
    const currentIdx = filtered.findIndex((s) => s.id === updated.id);
    if (currentIdx >= 0) {
      const nextUnreviewed = filtered.find((s, idx) => idx > currentIdx && !s.checkGps);
      if (nextUnreviewed) {
        setSelectedId(nextUnreviewed.id);
      }
    }
  };

  /* ---- Navigate prev/next ---- */
  const goToPrev = () => {
    if (selectedIndex > 0) setSelectedId(filtered[selectedIndex - 1].id);
  };
  const goToNext = () => {
    if (selectedIndex < filtered.length - 1) setSelectedId(filtered[selectedIndex + 1].id);
  };

  /* ---- Progress ---- */
  const progressPct = summary.total > 0 ? Math.round((summary.reviewed / summary.total) * 100) : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* ---- Top Bar ---- */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        {/* Date navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <i className="bi bi-chevron-left" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-slate-300 rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2 min-w-[180px]">
            <div className="flex-1 bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
              {summary.reviewed}/{summary.total}件 レビュー済み
            </span>
          </div>

          {/* Unreviewed HIGH warning */}
          {summary.unreviewedHigh > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold">
              <i className="bi bi-exclamation-triangle-fill" />
              未レビューHIGH: {summary.unreviewedHigh}件
            </span>
          )}
        </div>
      </div>

      {/* ---- Main Layout ---- */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* ---- Left Panel (Schedule List) ---- */}
        <div className="w-[400px] flex-shrink-0 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200">
          {/* Filter tabs */}
          <div className="p-3 border-b border-slate-100">
            <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
              {([
                { key: 'all' as FilterTab, label: '全て' },
                { key: 'unreviewed' as FilterTab, label: '未レビュー' },
                { key: 'high' as FilterTab, label: 'HIGH以上' },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    filter === tab.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule list */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400">
                <i className="bi bi-inbox text-3xl block mb-2" />
                <p className="text-sm">対象スケジュールなし</p>
              </div>
            ) : (
              filtered.map((s) => {
                const isSelected = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-3 py-3 border-b border-slate-50 hover:bg-indigo-50/30 transition-colors ${
                      isSelected ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Risk score badge */}
                      <div className="flex-shrink-0 pt-0.5">
                        {s.checkGps ? (
                          s.checkGpsResult === 'OK' ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                              <i className="bi bi-check-lg text-emerald-600 text-sm" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
                              <i className="bi bi-x-lg text-red-600 text-sm" />
                            </div>
                          )
                        ) : (
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${riskScoreColor(s.riskScoreV2, false, null)}`}
                          >
                            {s.riskScoreV2 != null ? Math.round(s.riskScoreV2) : '-'}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-bold text-slate-800 truncate">
                            {s.distributorName || '未割当'}
                          </span>
                          {s.distributorStaffId && (
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                              {s.distributorStaffId}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mb-1">
                          {s.areaName || '-'}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* 3 indicator dots */}
                          <div className="flex items-center gap-1">
                            <span
                              className={`w-2 h-2 rounded-full ${indicatorDot(s.coverageDiff != null ? Math.abs(s.coverageDiff) : null, 0.6, 0.3)}`}
                              title="カバレッジ"
                            />
                            <span
                              className={`w-2 h-2 rounded-full ${indicatorDot(s.speedDeviation, 0.6, 0.3)}`}
                              title="配布速度"
                            />
                            <span
                              className={`w-2 h-2 rounded-full ${indicatorDot(s.fastMoveRatio, 0.6, 0.3)}`}
                              title="移動速度"
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">|</span>
                          <span className="text-[10px] text-slate-600">
                            {s.plannedCount}/{s.actualCount}枚
                          </span>
                          <span className="text-[10px] text-slate-400">|</span>
                          <span className="text-[10px] text-slate-600">
                            {s.speedPerHour}枚/h
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ---- Right Panel ---- */}
        {selectedId ? (
          <ReviewPanel
            key={selectedId}
            scheduleId={selectedId}
            onVerdictSaved={handleVerdictSaved}
            onPrev={goToPrev}
            onNext={goToNext}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < filtered.length - 1}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <i className="bi bi-geo-alt text-4xl block mb-3" />
              <p className="text-sm">左のリストからスケジュールを選択してください</p>
              <p className="text-xs mt-1 text-slate-300">キーボード: ↑↓で移動, Enterで即OK</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
