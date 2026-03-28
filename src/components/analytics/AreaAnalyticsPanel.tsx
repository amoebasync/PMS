'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface AreaAnalyticsPanelProps {
  areaId: number | null;
  onClose: () => void;
}

// KpiCard helper (same pattern as AnalyticsTab)
function KpiCard({ icon, label, value, suffix }: { icon: string; label: string; value: string | number | undefined | null; suffix?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-base">
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-lg font-bold text-slate-800">
          {value ?? '-'}{suffix && <span className="text-xs font-normal text-slate-400 ml-0.5">{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

// Completion type badge
function CompletionBadge({ type, t }: { type: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    all_distributed: 'bg-green-100 text-green-700',
    area_done: 'bg-blue-100 text-blue-700',
    give_up: 'bg-red-100 text-red-700',
    other: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${colors[type] || colors.other}`}>
      {t(`completion_type.${type}`)}
    </span>
  );
}

export default function AreaAnalyticsPanel({ areaId, onClose }: AreaAnalyticsPanelProps) {
  const { t } = useTranslation('analytics-areas');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    if (!areaId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/analytics/areas/${areaId}?${params}`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [areaId, fromDate, toDate, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [fromDate, toDate, areaId]);

  const PIE_COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#94a3b8'];

  if (!areaId) return null;

  // Slide-over backdrop + panel
  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-slate-50 shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-slate-800">
            <i className="bi bi-bar-chart-line-fill mr-2 text-blue-600"></i>
            {data?.area?.areaName || t('area_info.title')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <i className="bi bi-x-lg text-slate-400"></i>
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data ? (
          <div className="p-6 space-y-6">
            {/* Area Basic Info */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[11px] text-slate-500">{t('area_info.door_to_door')}</div>
                  <div className="text-lg font-bold">{data.area.doorToDoorCount?.toLocaleString() ?? '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t('area_info.multi_family')}</div>
                  <div className="text-lg font-bold">{data.area.multiFamilyCount?.toLocaleString() ?? '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t('area_info.posting_cap')}</div>
                  <div className="text-lg font-bold">{data.area.postingCapWithNg?.toLocaleString() ?? '-'}</div>
                </div>
              </div>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-3">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder={t('filter.from')} />
              <span className="text-slate-400">~</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder={t('filter.to')} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <KpiCard icon="bi-calendar-check" label={t('kpi.total_schedules')} value={data.kpi.totalSchedules} />
              <KpiCard icon="bi-check-circle-fill" label={t('kpi.all_distributed')} value={data.kpi.allDistributedCount} />
              <KpiCard icon="bi-flag-fill" label={t('kpi.area_done')} value={data.kpi.areaDoneCount} />
              <KpiCard icon="bi-percent" label={t('kpi.avg_completion_rate')} value={data.kpi.avgCompletionRate} suffix="%" />
              <KpiCard icon="bi-bar-chart-fill" label={t('kpi.avg_distribution_rate')} value={data.kpi.avgDistributionRate} suffix="%" />
              <KpiCard icon="bi-arrow-repeat" label={t('kpi.frequency_per_month')} value={data.kpi.frequencyPerMonth} suffix={t('times_per_month')} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Delivery Trend (Bar) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('sections.delivery_trend')}</h3>
                {data.timeSeries?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="totalActual" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('chart.actual_count')} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-slate-400 text-center py-8">{t('no_data')}</p>}
              </div>

              {/* Rate Trends (Line) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('sections.completion_trend')}</h3>
                {data.timeSeries?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="avgCompletionRate" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name={t('chart.completion_rate')} />
                      <Line type="monotone" dataKey="avgDistributionRate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name={t('chart.distribution_rate')} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-slate-400 text-center py-8">{t('no_data')}</p>}
              </div>
            </div>

            {/* Completion Type Pie */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('sections.completion_breakdown')}</h3>
              {data.kpi.totalSchedules > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('completion_type.all_distributed'), value: data.kpi.allDistributedCount },
                          { name: t('completion_type.area_done'), value: data.kpi.areaDoneCount },
                          { name: t('completion_type.give_up'), value: data.kpi.giveUpCount },
                          { name: t('completion_type.other'), value: data.kpi.otherCount },
                        ].filter((d: { name: string; value: number }) => d.value > 0)}
                        cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {[0,1,2,3].map(i => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-8">{t('no_data')}</p>}
            </div>

            {/* Distribution History Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('sections.distribution_history')}</h3>
              {data.history?.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 pr-3 text-[11px] font-semibold text-slate-500">{t('table.date')}</th>
                          <th className="pb-2 pr-3 text-[11px] font-semibold text-slate-500">{t('table.distributor')}</th>
                          <th className="pb-2 pr-3 text-[11px] font-semibold text-slate-500 text-right">{t('table.planned')}</th>
                          <th className="pb-2 pr-3 text-[11px] font-semibold text-slate-500 text-right">{t('table.actual')}</th>
                          <th className="pb-2 pr-3 text-[11px] font-semibold text-slate-500 text-right">{t('table.distribution_rate')}</th>
                          <th className="pb-2 pr-3 text-[11px] font-semibold text-slate-500">{t('table.type')}</th>
                          <th className="pb-2 text-[11px] font-semibold text-slate-500 text-right">{t('table.duration')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.map((h: any) => (
                          <tr key={h.scheduleId} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 pr-3 text-xs">{h.date}</td>
                            <td className="py-2 pr-3 text-xs">{h.distributorName}</td>
                            <td className="py-2 pr-3 text-xs text-right">{h.totalPlanned?.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-xs text-right">{h.totalActual?.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-xs text-right font-medium">{h.distributionRate}%</td>
                            <td className="py-2 pr-3"><CompletionBadge type={h.completionType} t={t} /></td>
                            <td className="py-2 text-xs text-right">{h.sessionDuration != null ? `${h.sessionDuration}${t('minutes')}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {data.historyTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1 text-sm border rounded-lg disabled:opacity-30 hover:bg-slate-50">
                        <i className="bi bi-chevron-left"></i>
                      </button>
                      <span className="text-sm text-slate-600">{page} / {data.historyTotalPages}</span>
                      <button onClick={() => setPage(p => Math.min(data.historyTotalPages, p + 1))} disabled={page >= data.historyTotalPages}
                        className="px-3 py-1 text-sm border rounded-lg disabled:opacity-30 hover:bg-slate-50">
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                  )}
                </>
              ) : <p className="text-sm text-slate-400 text-center py-8">{t('no_data')}</p>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
