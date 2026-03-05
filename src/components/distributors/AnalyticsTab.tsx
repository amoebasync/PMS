'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useTranslation } from '@/i18n';

/* ─── Props ─── */
interface AnalyticsTabProps {
  distributorId: string;
  evalData: any;
  evalLoading: boolean;
  evalRankForm: { determinedRank: string; note: string };
  setEvalRankForm: (fn: (prev: { determinedRank: string; note: string }) => { determinedRank: string; note: string }) => void;
  saveEvalRank: () => void;
  evalSaving: boolean;
}

/* ─── Rank Badge ─── */
const RANK_COLORS: Record<string, { bg: string; text: string }> = {
  S: { bg: 'bg-yellow-500', text: 'text-white' },
  A: { bg: 'bg-blue-500', text: 'text-white' },
  B: { bg: 'bg-green-500', text: 'text-white' },
  C: { bg: 'bg-slate-400', text: 'text-white' },
  D: { bg: 'bg-red-400', text: 'text-white' },
};

function EvalRankBadge({ rank, size = 'md' }: { rank: string; size?: 'sm' | 'md' | 'lg' }) {
  const c = RANK_COLORS[rank] || RANK_COLORS.C;
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : size === 'lg' ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg';
  return <span className={`inline-flex items-center justify-center rounded-lg font-black ${c.bg} ${c.text} ${sizeClass}`}>{rank}</span>;
}

/* ─── Style constants ─── */
const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';
const selectCls = inputCls + ' cursor-pointer';

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function AnalyticsTab({
  distributorId, evalData, evalLoading,
  evalRankForm, setEvalRankForm, saveEvalRank, evalSaving,
}: AnalyticsTabProps) {
  const { t } = useTranslation('distributors');

  const [period, setPeriod] = useState<'total' | 'monthly'>('total');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (period === 'monthly') params.set('month', month);
      const res = await fetch(`/api/distributors/${distributorId}/analytics?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [distributorId, period, month]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  /* ─── KPI Card helper ─── */
  function KpiCard({ icon, label, value, suffix, red }: {
    icon: string; label: string; value: string | number | undefined | null;
    suffix?: string; red?: boolean;
  }) {
    const isRed = red && value !== undefined && value !== null && Number(value) > 0;
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isRed ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          <i className={`bi ${icon}`}></i>
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`text-lg font-black ${isRed ? 'text-red-600' : 'text-slate-800'}`}>
            {value ?? '--'}{suffix && <span className="text-xs text-slate-400 ml-0.5">{suffix}</span>}
          </p>
        </div>
      </div>
    );
  }

  /* ─── Category badge for inspections ─── */
  const categoryBadge = (cat: string) => {
    const isCheck = cat === 'CHECK';
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCheck ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
        {isCheck ? t('inspection_category_check') : t('inspection_category_guidance')}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Period toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPeriod('total')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${period === 'total' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          {t('analytics_period_total')}
        </button>
        <button
          onClick={() => setPeriod('monthly')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${period === 'monthly' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          {t('analytics_period_monthly')}
        </button>
        {period === 'monthly' && (
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <i className="bi bi-bar-chart text-4xl text-slate-200 block mb-2"></i>
          <p className="text-sm text-slate-400">{t('analytics_no_data')}</p>
        </div>
      ) : (
        <>
          {/* KPI Cards 4x2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon="bi-calendar-check" label={t('analytics_total_schedules')} value={data.kpi.totalSchedules} suffix={t('analytics_unit_times')} />
            <KpiCard icon="bi-stack" label={t('analytics_total_delivered')} value={data.kpi.totalDelivered?.toLocaleString()} suffix={t('analytics_unit_sheets')} />
            <KpiCard icon="bi-check-circle" label={t('analytics_completion_rate')} value={data.kpi.completionRate} suffix="%" />
            <KpiCard icon="bi-speedometer2" label={t('analytics_avg_speed')} value={data.kpi.avgSpeed} suffix={t('analytics_unit_per_hour')} />
            <KpiCard icon="bi-exclamation-triangle" label={t('analytics_complaints')} value={data.kpi.totalComplaints} suffix={t('analytics_unit_cases')} red />
            <KpiCard icon="bi-shield-x" label={t('analytics_fraud_count')} value={data.kpi.fraudCount} suffix={t('analytics_unit_cases')} red />
            <KpiCard icon="bi-clipboard-check" label={t('analytics_inspection_score')} value={data.kpi.avgInspectionScore} suffix="/ 100" />
            <KpiCard
              icon="bi-award"
              label={t('analytics_rank_score')}
              value={data.kpi.currentRank ? `${data.kpi.currentRank} / ${data.kpi.currentScore ?? '--'}` : '--'}
            />
          </div>

          {/* Charts row */}
          {data.timeSeries?.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bar: Delivery count over time */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <p className="text-xs font-bold text-slate-500 mb-3">{t('analytics_delivered_trend')}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="delivered" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('analytics_total_delivered')} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line: Speed over time */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <p className="text-xs font-bold text-slate-500 mb-3">{t('analytics_speed_trend')}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="speed" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} name={t('analytics_avg_speed')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Pie: Complaint breakdown */}
          {data.complaintBreakdown?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-bold text-slate-500 mb-3">{t('analytics_complaint_breakdown')}</p>
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.complaintBreakdown}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(entry: any) => `${entry.type}: ${entry.count}`}
                    >
                      {data.complaintBreakdown.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent inspections */}
          {data.recentInspections?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-xs font-bold text-slate-500 mb-3">{t('analytics_recent_inspections')}</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500">{t('inspection_date')}</th>
                      <th className="px-3 py-2 text-left text-slate-500">{t('inspection_category')}</th>
                      <th className="px-3 py-2 text-right text-slate-500">{t('inspection_score')}</th>
                      <th className="px-3 py-2 text-left text-slate-500">{t('inspection_inspector')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentInspections.slice(0, 5).map((insp: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600">{new Date(insp.inspectedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                        <td className="px-3 py-2">{categoryBadge(insp.category)}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-700">{insp.score ?? '--'}</td>
                        <td className="px-3 py-2 text-slate-600">{insp.inspectorName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Rank manual adjustment (from evaluation tab) ─── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
          <i className="bi bi-pencil-square"></i> {t('analytics_rank_adjustment')}
        </p>
        {evalLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {evalData?.evaluations?.[0] && (
              <div className="flex items-center gap-3 mb-2">
                <EvalRankBadge rank={evalData.evaluations[0].determinedRank} size="md" />
                <div>
                  <p className="text-sm font-black text-slate-800">{evalData.evaluations[0].totalScore} <span className="text-xs text-slate-400">pt</span></p>
                </div>
              </div>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_rank')}</label>
                <select
                  value={evalRankForm.determinedRank}
                  onChange={e => setEvalRankForm(p => ({ ...p, determinedRank: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">--</option>
                  <option value="S">S</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('analytics_rank_comment')}</label>
                <input
                  value={evalRankForm.note}
                  onChange={e => setEvalRankForm(p => ({ ...p, note: e.target.value }))}
                  className={inputCls}
                  placeholder={t('analytics_rank_comment_placeholder')}
                />
              </div>
              <button
                onClick={saveEvalRank}
                disabled={evalSaving || !evalRankForm.determinedRank}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
              >
                {evalSaving ? '...' : <><i className="bi bi-check2"></i> {t('btn_update')}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
