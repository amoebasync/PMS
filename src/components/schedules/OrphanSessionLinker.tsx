'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';

interface OrphanSession {
  id: number;
  distributorId: number;
  distributorName: string;
  distributorStaffId: string | null;
  startedAt: string;
  finishedAt: string | null;
  hasGpsData: boolean;
  lastMailboxCount: number;
  totalSteps: number;
  totalDistance: number;
}

interface Schedule {
  id: number;
  distributorId: number | null;
  distributor: { id: number; name: string; staffId: string | null } | null;
  area: { town_name: string | null; chome_name: string | null; city?: { name: string } | null; prefecture?: { name: string } | null } | null;
  status: string;
  session: { id: number } | null;
}

interface AreaMatchResult {
  scheduleId: number;
  areaName: string;
  matchedPoints: number;
  matchRate: number;
}

interface AreaMatchData {
  totalPoints: number;
  matches: AreaMatchResult[];
}

interface OrphanSessionLinkerProps {
  date: string;
  schedules: Schedule[];
  onClose: () => void;
  onLinked: () => void;
}

export default function OrphanSessionLinker({ date, schedules, onClose, onLinked }: OrphanSessionLinkerProps) {
  const { t } = useTranslation('schedules');
  const [orphans, setOrphans] = useState<OrphanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Area match state
  const [areaMatch, setAreaMatch] = useState<AreaMatchData | null>(null);
  const [areaMatchLoading, setAreaMatchLoading] = useState(false);

  // 紐付け可能なスケジュール（セッション未紐付け）
  const selectedOrphan = orphans.find(o => o.id === selectedSession);
  const linkableSchedules = schedules
    .filter(s => !s.session && s.status !== 'COMPLETED')
    .sort((a, b) => {
      if (!selectedOrphan) return 0;
      const name = selectedOrphan.distributorName.toLowerCase();
      const aName = (a.distributor?.name || '').toLowerCase();
      const bName = (b.distributor?.name || '').toLowerCase();

      // First priority: distributor name match
      const aExact = aName === name ? 2 : aName.includes(name) || name.includes(aName) ? 1 : 0;
      const bExact = bName === name ? 2 : bName.includes(name) || name.includes(bName) ? 1 : 0;
      if (bExact !== aExact) return bExact - aExact;

      // Second priority: area match rate (within same distributor match tier)
      if (areaMatch) {
        const aRate = areaMatch.matches.find(m => m.scheduleId === a.id)?.matchRate || 0;
        const bRate = areaMatch.matches.find(m => m.scheduleId === b.id)?.matchRate || 0;
        return bRate - aRate;
      }

      return 0;
    });

  // Find the best match schedule ID
  const bestMatchScheduleId = areaMatch && areaMatch.matches.length > 0 && areaMatch.matches[0].matchRate > 0
    ? areaMatch.matches[0].scheduleId
    : null;

  const fetchOrphans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/orphans?date=${date}`);
      if (res.ok) {
        setOrphans(await res.json());
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchOrphans(); }, [fetchOrphans]);

  // Fetch area match data when session is selected and there are GPS-enabled linkable schedules
  useEffect(() => {
    if (!selectedSession) {
      setAreaMatch(null);
      return;
    }

    const orphan = orphans.find(o => o.id === selectedSession);
    if (!orphan?.hasGpsData) {
      setAreaMatch(null);
      return;
    }

    const candidateSchedules = schedules.filter(s => !s.session && s.status !== 'COMPLETED');
    if (candidateSchedules.length === 0) {
      setAreaMatch(null);
      return;
    }

    const scheduleIds = candidateSchedules.map(s => s.id).join(',');

    let cancelled = false;
    setAreaMatchLoading(true);
    fetch(`/api/sessions/${selectedSession}/area-match?scheduleIds=${scheduleIds}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data) {
          setAreaMatch(data);
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => {
        if (!cancelled) setAreaMatchLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedSession, orphans, schedules]);

  const handleLink = async () => {
    if (!selectedSession || !selectedSchedule) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession, scheduleId: selectedSchedule }),
      });
      if (res.ok) {
        setSuccess(t('orphan_link_success'));
        setSelectedSession(null);
        setSelectedSchedule(null);
        setAreaMatch(null);
        await fetchOrphans();
        onLinked();
      } else {
        const data = await res.json();
        setError(data.error || t('error'));
      }
    } catch {
      setError(t('error'));
    }
    setLinking(false);
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return t('orphan_in_progress');
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatAreaName = (s: Schedule) => {
    const pref = s.area?.prefecture?.name || '';
    const city = s.area?.city?.name || '';
    const chome = s.area?.chome_name || s.area?.town_name || '';
    if (!pref && !city && !chome) return '-';
    return `${pref}${city}${chome}`;
  };

  const getMatchRate = (scheduleId: number): number | null => {
    if (!areaMatch) return null;
    const match = areaMatch.matches.find(m => m.scheduleId === scheduleId);
    return match ? match.matchRate : null;
  };

  const formatMatchRate = (rate: number) => `${Math.round(rate * 100)}%`;

  const getMatchRateColor = (rate: number) => {
    if (rate >= 0.6) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (rate >= 0.3) return 'text-amber-600 bg-amber-50 border-amber-200';
    if (rate > 0) return 'text-slate-500 bg-slate-50 border-slate-200';
    return 'text-slate-400 bg-slate-50 border-slate-200';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-none md:rounded-xl shadow-xl w-full max-h-full md:h-auto md:max-w-2xl overflow-hidden flex flex-col md:max-h-[80vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-base md:text-lg text-slate-800">
            <i className="bi bi-link-45deg text-amber-500 mr-2"></i>{t('orphan_title')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-4 md:px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <i className="bi bi-exclamation-circle"></i>{error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
              <i className="bi bi-check-circle"></i>{success}
            </div>
          )}

          {/* Step 1: Orphan Sessions */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-black">1</span>
              {t('orphan_step1')}
            </h4>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : orphans.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                <i className="bi bi-inbox text-2xl block mb-2"></i>
                {t('orphan_empty')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {orphans.map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                      selectedSession === s.id
                        ? 'border-amber-400 bg-amber-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="orphanSession"
                      checked={selectedSession === s.id}
                      onChange={() => { setSelectedSession(s.id); setSelectedSchedule(null); }}
                      className="accent-amber-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate">{s.distributorName}</span>
                        {s.distributorStaffId && (
                          <span className="text-[10px] text-slate-400">{s.distributorStaffId}</span>
                        )}
                        {s.finishedAt ? (
                          <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">{t('orphan_finished')}</span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-bold animate-pulse">{t('orphan_active')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                        <span><i className="bi bi-clock mr-1"></i>{formatTime(s.startedAt)}{s.finishedAt ? ` ~ ${formatTime(s.finishedAt)}` : ''}</span>
                        <span><i className="bi bi-hourglass-split mr-1"></i>{formatDuration(s.startedAt, s.finishedAt)}</span>
                        {s.hasGpsData && <span className="text-emerald-600"><i className="bi bi-geo-alt-fill mr-0.5"></i>GPS</span>}
                        {s.lastMailboxCount > 0 && <span><i className="bi bi-mailbox mr-1"></i>{s.lastMailboxCount}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Target Schedule */}
          {selectedSession && (
            <div>
              <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">2</span>
                {t('orphan_step2')}
                {areaMatchLoading && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-indigo-500 font-normal">
                    <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
                    {t('orphan_area_analyzing')}
                  </span>
                )}
              </h4>
              {linkableSchedules.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  {t('orphan_no_schedules')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {linkableSchedules.map((s) => {
                    const matchRate = getMatchRate(s.id);
                    const isBestMatch = bestMatchScheduleId === s.id;
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                          selectedSchedule === s.id
                            ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                            : isBestMatch
                              ? 'border-emerald-300 bg-emerald-50/50 hover:border-emerald-400'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="targetSchedule"
                          checked={selectedSchedule === s.id}
                          onChange={() => setSelectedSchedule(s.id)}
                          className="accent-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800 truncate">
                              {s.distributor?.name || t('unassigned')}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              s.status === 'UNSTARTED' ? 'bg-slate-100 text-slate-600' :
                              s.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {t(`status_${s.status.toLowerCase()}`)}
                            </span>
                            {isBestMatch && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                <i className="bi bi-stars"></i>
                                {t('orphan_area_recommended')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-500 truncate">
                              <i className="bi bi-geo-alt mr-1"></i>{formatAreaName(s)}
                            </span>
                            {matchRate !== null && matchRate > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold whitespace-nowrap ${getMatchRateColor(matchRate)}`}>
                                <i className="bi bi-crosshair mr-0.5"></i>{formatMatchRate(matchRate)}
                              </span>
                            )}
                            {matchRate !== null && matchRate === 0 && areaMatch && areaMatch.totalPoints > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-400 font-bold whitespace-nowrap">
                                <i className="bi bi-crosshair mr-0.5"></i>0%
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="text-[11px] text-slate-400">
            {orphans.length > 0 && `${orphans.length} ${t('orphan_count')}`}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition-colors">
              {t('close')}
            </button>
            <button
              onClick={handleLink}
              disabled={!selectedSession || !selectedSchedule || linking}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
            >
              {linking ? (
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
              ) : (
                <i className="bi bi-link-45deg"></i>
              )}
              {t('orphan_link_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
