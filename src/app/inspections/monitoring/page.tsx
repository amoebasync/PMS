'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';

interface Distributor {
  id: number;
  name: string;
  staffId: string | null;
  branchName: string | null;
  rank: string | null;
  lastInspectedAt: string | null;
  lastInspectionType: string | null;
  nextInspectionDue: string | null;
  inspectionInterval: number;
  daysSinceLastCheck: number | null;
  daysUntilDue: number | null;
  status: 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NEVER' | 'NOT_REQUIRED';
}

interface Summary {
  overdue: number;
  dueSoon: number;
  never: number;
  ok: number;
  notRequired: number;
  total: number;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string; labelEn: string; icon: string }> = {
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', label: '期限超過', labelEn: 'Overdue', icon: 'bi-exclamation-triangle-fill' },
  DUE_SOON: { bg: 'bg-amber-100', text: 'text-amber-700', label: '間もなく', labelEn: 'Due Soon', icon: 'bi-clock-fill' },
  NEVER: { bg: 'bg-slate-100', text: 'text-slate-600', label: '未実施', labelEn: 'Never', icon: 'bi-dash-circle' },
  OK: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '正常', labelEn: 'OK', icon: 'bi-check-circle-fill' },
  NOT_REQUIRED: { bg: 'bg-slate-50', text: 'text-slate-400', label: '不要', labelEn: 'N/A', icon: 'bi-skip-forward-fill' },
};

export default function InspectionMonitoringPage() {
  const { t, language } = useTranslation('inspections');
  const router = useRouter();
  const [data, setData] = useState<Distributor[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [branches, setBranches] = useState<{ id: number; nameJa: string }[]>([]);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (branchFilter) params.set('branchId', branchFilter);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/distributors/inspection-status?${params}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data);
      setSummary(json.summary);
    }
    setLoading(false);
  }, [branchFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetch('/api/branches').then(r => r.ok ? r.json() : []).then(setBranches);
  }, []);

  const filtered = search
    ? data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || (d.staffId || '').toLowerCase().includes(search.toLowerCase()))
    : data;

  const fmtDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric' });
  };

  const fmtDays = (days: number | null) => {
    if (days === null) return '-';
    if (days === 0) return t('monitoring_today') || '今日';
    if (days < 0) return `${Math.abs(days)}${t('monitoring_days_overdue') || '日超過'}`;
    return `${days}${t('monitoring_days') || '日'}`;
  };

  const isJa = language === 'ja';

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {([
            { key: 'OVERDUE', count: summary.overdue, color: 'border-red-200 bg-red-50' },
            { key: 'DUE_SOON', count: summary.dueSoon, color: 'border-amber-200 bg-amber-50' },
            { key: 'NEVER', count: summary.never, color: 'border-slate-200 bg-slate-50' },
            { key: 'OK', count: summary.ok, color: 'border-emerald-200 bg-emerald-50' },
            { key: 'NOT_REQUIRED', count: summary.notRequired, color: 'border-slate-100 bg-white' },
          ] as const).map(({ key, count, color }) => {
            const s = STATUS_STYLE[key];
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                className={`border rounded-xl p-3 text-center transition-all hover:shadow-sm ${
                  statusFilter === key ? 'ring-2 ring-indigo-400 ' + color : color
                }`}
              >
                <div className={`text-2xl font-black ${s.text}`}>{count}</div>
                <div className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1">
                  <i className={`bi ${s.icon} ${s.text}`}></i>
                  {isJa ? s.label : s.labelEn}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={branchFilter}
          onChange={e => setBranchFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">{t('filter_all_branches') || '全支店'}</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('monitoring_search') || '名前・スタッフIDで検索...'}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
        />
        <span className="text-xs text-slate-400">{filtered.length}{t('monitoring_count') || '名'}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">{t('col_distributor') || '配布員'}</th>
                <th className="px-3 py-2.5">{t('col_branch') || '支店'}</th>
                <th className="px-3 py-2.5">{t('monitoring_last_check') || '最終チェック'}</th>
                <th className="px-3 py-2.5">{t('monitoring_type') || '種別'}</th>
                <th className="px-3 py-2.5">{t('monitoring_elapsed') || '経過'}</th>
                <th className="px-3 py-2.5">{t('monitoring_next_due') || '次回予定'}</th>
                <th className="px-3 py-2.5">{t('monitoring_status') || 'ステータス'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t('monitoring_empty') || 'データがありません'}</td></tr>
              ) : filtered.map(d => {
                const s = STATUS_STYLE[d.status];
                return (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/distributors/${d.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-800">{d.name}</div>
                      <div className="text-[10px] text-slate-400">{d.staffId || '-'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{d.branchName || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{fmtDate(d.lastInspectedAt)}</td>
                    <td className="px-3 py-2.5">
                      {d.lastInspectionType ? (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          d.lastInspectionType === 'CHECK' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {d.lastInspectionType === 'CHECK' ? (isJa ? 'チェック' : 'Check') : (isJa ? '指導' : 'Guidance')}
                        </span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {d.daysSinceLastCheck !== null ? (
                        <span className={d.daysSinceLastCheck > 30 ? 'text-red-600 font-bold' : 'text-slate-600'}>
                          {d.daysSinceLastCheck}{isJa ? '日前' : 'd ago'}
                        </span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{fmtDate(d.nextInspectionDue)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
                        <i className={`bi ${s.icon}`}></i>
                        {isJa ? s.label : s.labelEn}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
