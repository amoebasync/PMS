'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart,
} from 'recharts';

// ---------- Types ----------

interface Kpi {
  totalPlanned: number;
  totalActual: number;
  subPlanned: number;
  subActual: number;
  distributionRate: number;
  complaintCount: number;
  fraudCount: number;
  schedulesCount: number;
}

interface TrendItem {
  period: string;
  planned: number;
  actual: number;
  rate: number;
}

interface BranchItem {
  branchId: number;
  branchName: string;
  planned: number;
  actual: number;
  rate: number;
}

interface StaffItem {
  distributorId: number;
  name: string;
  staffId: string;
  branchName: string;
  areaNames: string;
  flyerTypeCount: number;
  planned: number;
  actual: number;
  rate: number;
}

interface AnalyticsData {
  kpi: Kpi;
  trend: TrendItem[];
  branchComparison: BranchItem[];
  staffList: StaffItem[];
}

type Period = 'daily' | 'weekly' | 'monthly';

// ---------- Helpers ----------

function fmt(n: number): string {
  return n.toLocaleString();
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const r = new Date(d);
  r.setDate(r.getDate() - diff);
  return r;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const r = new Date(s);
  r.setDate(r.getDate() + 6);
  return r;
}

function formatDateLabel(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function formatWeekLabel(from: Date, to: Date): string {
  const f = `${from.getMonth() + 1}/${from.getDate()}`;
  const t = `${to.getMonth() + 1}/${to.getDate()}`;
  return `${from.getFullYear()}年 ${f} ~ ${t}`;
}

function formatMonthLabel(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

// ---------- Sub-components ----------

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base ${color}`}>
        <i className={`bi ${icon}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-500 truncate">{label}</div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

// ---------- Main Page ----------

export default function DistributionAnalyticsPage() {
  const { t } = useTranslation('analytics-distribution');

  const [period, setPeriod] = useState<Period>('daily');
  const [dateFrom, setDateFrom] = useState(() => dateStr(new Date()));
  const [dateTo, setDateTo] = useState(() => dateStr(new Date()));
  const [branchId, setBranchId] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [distributorSearch, setDistributorSearch] = useState('');
  const [distributorOptions, setDistributorOptions] = useState<{ id: number; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: number; nameJa: string }[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch branches on mount
  useEffect(() => {
    fetch('/api/branches?limit=100')
      .then(r => r.json())
      .then(json => setBranches(json.data || json || []))
      .catch(console.error);
  }, []);

  // 期間に応じた日付範囲を算出
  const computeDates = useCallback((p: Period, baseDate: Date) => {
    if (p === 'daily') {
      return { from: dateStr(baseDate), to: dateStr(baseDate) };
    } else if (p === 'weekly') {
      return { from: dateStr(startOfWeek(baseDate)), to: dateStr(endOfWeek(baseDate)) };
    } else {
      return { from: dateStr(startOfMonth(baseDate)), to: dateStr(endOfMonth(baseDate)) };
    }
  }, []);

  // Period change → auto compute dates
  const handlePeriodChange = useCallback((p: Period) => {
    setPeriod(p);
    const { from, to } = computeDates(p, new Date());
    setDateFrom(from);
    setDateTo(to);
  }, [computeDates]);

  // 前へ / 次へ ナビゲーション
  const navigate = useCallback((direction: -1 | 1) => {
    const base = new Date(dateFrom);
    if (period === 'daily') {
      base.setDate(base.getDate() + direction);
    } else if (period === 'weekly') {
      base.setDate(base.getDate() + direction * 7);
    } else {
      base.setMonth(base.getMonth() + direction);
    }
    const { from, to } = computeDates(period, base);
    setDateFrom(from);
    setDateTo(to);
  }, [dateFrom, period, computeDates]);

  // 日付表示ラベル
  const dateLabel = useMemo(() => {
    const from = new Date(dateFrom);
    if (period === 'daily') {
      return formatDateLabel(from);
    } else if (period === 'weekly') {
      return formatWeekLabel(from, new Date(dateTo));
    } else {
      return formatMonthLabel(from);
    }
  }, [dateFrom, dateTo, period]);

  // Distributor search
  useEffect(() => {
    if (!distributorSearch.trim()) { setDistributorOptions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/distributors?search=${encodeURIComponent(distributorSearch)}&limit=10`);
        if (res.ok) {
          const json = await res.json();
          const items = (json.data || json || []).map((d: any) => ({
            id: d.id,
            name: `${d.lastName || ''}${d.firstName || ''} (${d.staffId || '-'})`,
          }));
          setDistributorOptions(items);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [distributorSearch]);

  // Fetch analytics data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, dateFrom, dateTo });
      if (branchId) params.set('branchId', branchId);
      if (distributorId) params.set('distributorId', distributorId);
      const res = await fetch(`/api/analytics/distribution?${params}`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period, dateFrom, dateTo, branchId, distributorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Trend chart formatted labels
  const trendData = useMemo(() => {
    if (!data) return [];
    return data.trend.map(item => ({
      ...item,
      label: period === 'monthly'
        ? item.period // "2026-03"
        : period === 'weekly'
          ? item.period.slice(5) // "03-01"
          : item.period.slice(5), // "03-01"
    }));
  }, [data, period]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-slate-500">{t('loading')}</span>
      </div>
    );
  }

  const kpi = data?.kpi;

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">{t('page_title')}</h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period pills */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t(`period.${p}`)}
              </button>
            ))}
          </div>

          {/* Date navigation */}
          <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-0.5">
            <button onClick={() => navigate(-1)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
              <i className="bi bi-chevron-left text-sm" />
            </button>
            {period === 'daily' ? (
              <input type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setDateTo(e.target.value); }}
                className="border-0 px-2 py-1 text-xs font-medium text-slate-700 bg-transparent focus:outline-none" />
            ) : (
              <span className="px-2 py-1 text-xs font-medium text-slate-700 whitespace-nowrap">{dateLabel}</span>
            )}
            <button onClick={() => navigate(1)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
              <i className="bi bi-chevron-right text-sm" />
            </button>
          </div>

          {/* Branch */}
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white min-w-[120px]">
            <option value="">{t('filter.all_branches')}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.nameJa}</option>
            ))}
          </select>

          {/* Distributor search */}
          <div className="relative">
            <input
              type="text"
              placeholder={t('filter.distributor_search')}
              value={distributorSearch}
              onChange={e => { setDistributorSearch(e.target.value); if (!e.target.value) setDistributorId(''); }}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white w-[160px]"
            />
            {distributorOptions.length > 0 && distributorSearch && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {distributorOptions.map(d => (
                  <button key={d.id} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
                    onClick={() => { setDistributorId(String(d.id)); setDistributorSearch(d.name); setDistributorOptions([]); }}>
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon="bi-clipboard-data" label={t('kpi.total_planned')} value={fmt(kpi.totalPlanned)} color="bg-blue-50 text-blue-600" />
          <KpiCard icon="bi-clipboard-check" label={t('kpi.total_actual')} value={fmt(kpi.totalActual)} color="bg-green-50 text-green-600" />
          <KpiCard icon="bi-percent" label={t('kpi.distribution_rate')} value={`${kpi.distributionRate}%`} color="bg-indigo-50 text-indigo-600" />
          <KpiCard icon="bi-exclamation-triangle" label={t('kpi.complaint_count')} value={fmt(kpi.complaintCount)} color="bg-amber-50 text-amber-600" />
          <KpiCard icon="bi-shield-x" label={t('kpi.fraud_count')} value={fmt(kpi.fraudCount)} color="bg-red-50 text-red-600" />
          <KpiCard icon="bi-people" label={t('kpi.schedules_count')} value={fmt(kpi.schedulesCount)} color="bg-slate-100 text-slate-600" />
        </div>
      )}
      {/* Sub flyer stats */}
      {kpi && (kpi.subPlanned > 0 || kpi.subActual > 0) && (
        <div className="flex items-center gap-3 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
          <i className="bi bi-tag text-amber-500"></i>
          <span className="font-bold text-amber-700">SUB</span>
          <span>{t('kpi.total_planned') || '予定'}: {fmt(kpi.subPlanned)}</span>
          <span>{t('kpi.total_actual') || '実績'}: {fmt(kpi.subActual)}</span>
        </div>
      )}

      {/* Charts Row: Trend + Branch Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">{t('sections.trend')}</h2>
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-slate-400 text-sm">{t('no_data')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name === 'rate') return [`${value}%`, t('chart.rate')];
                    return [fmt(value), name === 'planned' ? t('chart.planned') : t('chart.actual')];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    if (value === 'planned') return t('chart.planned');
                    if (value === 'actual') return t('chart.actual');
                    if (value === 'rate') return t('chart.rate');
                    return value;
                  }}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar yAxisId="left" dataKey="planned" fill="#93c5fd" radius={[3, 3, 0, 0]} barSize={20} />
                <Bar yAxisId="left" dataKey="actual" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={20} />
                <Line yAxisId="right" dataKey="rate" type="monotone" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Branch Comparison */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">{t('sections.branch_comparison')}</h2>
          {!data?.branchComparison?.length ? (
            <div className="flex items-center justify-center h-52 text-slate-400 text-sm">{t('no_data')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.branchComparison} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="branchName" tick={{ fontSize: 11 }} width={75} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => [`${value}%`, t('kpi.distribution_rate')]}
                />
                <Bar dataKey="rate" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Staff List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">{t('sections.staff_list')}</h2>
        {!data?.staffList?.length ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">{t('no_data')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 text-left font-medium">{t('staff.name')}</th>
                  <th className="py-2.5 text-left font-medium">{t('staff.branch')}</th>
                  <th className="py-2.5 text-left font-medium">{t('staff.area')}</th>
                  <th className="py-2.5 text-right font-medium">{t('staff.flyer_types')}</th>
                  <th className="py-2.5 text-right font-medium">{t('staff.planned')}</th>
                  <th className="py-2.5 text-right font-medium">{t('staff.actual')}</th>
                  <th className="py-2.5 text-right font-medium">{t('staff.rate')}</th>
                </tr>
              </thead>
              <tbody>
                {data.staffList.map(s => (
                  <tr key={s.distributorId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-700">{s.name}</td>
                    <td className="py-2 text-slate-500">{s.branchName}</td>
                    <td className="py-2 text-slate-500 max-w-[200px] truncate" title={s.areaNames}>{s.areaNames}</td>
                    <td className="py-2 text-right">{s.flyerTypeCount}</td>
                    <td className="py-2 text-right font-mono">{fmt(s.planned)}</td>
                    <td className="py-2 text-right font-mono">{fmt(s.actual)}</td>
                    <td className={`py-2 text-right font-medium ${
                      s.rate >= 95 ? 'text-green-600' : s.rate >= 80 ? 'text-amber-600' : 'text-red-600'
                    }`}>{s.rate}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold text-slate-700">
                  <td className="py-2.5" colSpan={3}>{t('staff.total')}</td>
                  <td className="py-2.5 text-right">{data.staffList.reduce((s, r) => s + r.flyerTypeCount, 0)}</td>
                  <td className="py-2.5 text-right font-mono">{fmt(data.staffList.reduce((s, r) => s + r.planned, 0))}</td>
                  <td className="py-2.5 text-right font-mono">{fmt(data.staffList.reduce((s, r) => s + r.actual, 0))}</td>
                  <td className="py-2.5 text-right font-mono">
                    {(() => {
                      const tp = data.staffList.reduce((s, r) => s + r.planned, 0);
                      const ta = data.staffList.reduce((s, r) => s + r.actual, 0);
                      return tp > 0 ? `${Math.round((ta / tp) * 1000) / 10}%` : '-';
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {loading && data && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-sm text-slate-600">{t('loading')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
