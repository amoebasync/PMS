'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '@/i18n';

type FraudItem = {
  id: number;
  sessionId: number;
  scheduleId: number | null;
  distributorId: number;
  outOfAreaRatio: number;
  outOfAreaDwell: number;
  distanceCountRatio: number;
  speedAnomaly: number;
  gpsGapRatio: number;
  workRatio: number;
  riskScore: number;
  riskLevel: string;
  analysisDetail: string | null;
  reviewResult: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  distributor: { id: number; name: string; staffId: string };
  schedule: { id: number; date: string; area: { town_name: string; chome_name: string; name_en: string | null } | null } | null;
  reviewedBy: { id: number; lastNameJa: string; firstNameJa: string } | null;
};

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const REVIEW_COLORS: Record<string, string> = {
  FALSE_POSITIVE: 'bg-slate-100 text-slate-600',
  SUSPICIOUS: 'bg-amber-100 text-amber-700',
  CONFIRMED_FRAUD: 'bg-red-100 text-red-700',
};

const INDICATOR_KEYS = [
  'outOfAreaRatio', 'outOfAreaDwell', 'distanceCountRatio',
  'speedAnomaly', 'gpsGapRatio', 'workRatio',
] as const;

export default function FraudDetectionPage() {
  const { t } = useTranslation('fraud-detection');
  const [items, setItems] = useState<FraudItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ riskLevel: '', reviewResult: '', dateFrom: '', dateTo: '' });
  const [selectedItem, setSelectedItem] = useState<FraudItem | null>(null);
  const [reviewForm, setReviewForm] = useState({ result: '', note: '' });
  const [reviewing, setReviewing] = useState(false);
  const [kpis, setKpis] = useState({ today: 0, week: 0, unreviewed: 0, confirmed: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filters.riskLevel) params.set('riskLevel', filters.riskLevel);
    if (filters.reviewResult) params.set('reviewResult', filters.reviewResult);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const res = await fetch(`/api/fraud-analysis?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, filters]);

  const fetchKpis = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [todayRes, weekRes, unreviewedRes, confirmedRes] = await Promise.all([
      fetch(`/api/fraud-analysis?riskLevel=HIGH,CRITICAL&dateFrom=${today}&limit=1`),
      fetch(`/api/fraud-analysis?riskLevel=HIGH,CRITICAL&dateFrom=${weekAgo}&limit=1`),
      fetch(`/api/fraud-analysis?riskLevel=HIGH,CRITICAL&reviewResult=unreviewed&limit=1`),
      fetch(`/api/fraud-analysis?reviewResult=CONFIRMED_FRAUD&limit=1`),
    ]);

    const [todayData, weekData, unreviewedData, confirmedData] = await Promise.all([
      todayRes.ok ? todayRes.json() : { total: 0 },
      weekRes.ok ? weekRes.json() : { total: 0 },
      unreviewedRes.ok ? unreviewedRes.json() : { total: 0 },
      confirmedRes.ok ? confirmedRes.json() : { total: 0 },
    ]);

    setKpis({
      today: todayData.total,
      week: weekData.total,
      unreviewed: unreviewedData.total,
      confirmed: confirmedData.total,
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  const handleReview = async () => {
    if (!selectedItem || !reviewForm.result) return;
    setReviewing(true);
    const res = await fetch(`/api/fraud-analysis/${selectedItem.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewForm),
    });
    if (res.ok) {
      setSelectedItem(null);
      setReviewForm({ result: '', note: '' });
      fetchData();
      fetchKpis();
    }
    setReviewing(false);
  };

  const detail = selectedItem?.analysisDetail ? JSON.parse(selectedItem.analysisDetail) : null;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-800">{t('page_title')}</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('kpi_today'), value: kpis.today, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: t('kpi_week'), value: kpis.week, color: 'text-red-600', bg: 'bg-red-50' },
          { label: t('kpi_unreviewed'), value: kpis.unreviewed, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: t('kpi_confirmed'), value: kpis.confirmed, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 border`}>
            <p className="text-xs font-bold text-slate-500">{kpi.label}</p>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">{t('filter_risk_level')}</label>
          <select
            value={filters.riskLevel}
            onChange={(e) => { setFilters((f) => ({ ...f, riskLevel: e.target.value })); setPage(1); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
          >
            <option value="">{t('filter_all')}</option>
            <option value="CRITICAL">{t('level_CRITICAL')}</option>
            <option value="HIGH">{t('level_HIGH')}</option>
            <option value="MEDIUM">{t('level_MEDIUM')}</option>
            <option value="HIGH,CRITICAL">{t('level_HIGH')} + {t('level_CRITICAL')}</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">{t('filter_review')}</label>
          <select
            value={filters.reviewResult}
            onChange={(e) => { setFilters((f) => ({ ...f, reviewResult: e.target.value })); setPage(1); }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
          >
            <option value="">{t('filter_all')}</option>
            <option value="unreviewed">{t('filter_unreviewed')}</option>
            <option value="FALSE_POSITIVE">{t('review_FALSE_POSITIVE')}</option>
            <option value="SUSPICIOUS">{t('review_SUSPICIOUS')}</option>
            <option value="CONFIRMED_FRAUD">{t('review_CONFIRMED_FRAUD')}</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">{t('filter_date_from')}</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">{t('filter_date_to')}</label>
          <input type="date" value={filters.dateTo} onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500">{t('col_date')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500">{t('col_distributor')}</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500">{t('col_area')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">{t('col_risk_score')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">{t('col_risk_level')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">{t('col_review')}</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500">{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">{t('loading')}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">{t('no_data')}</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedItem(item); setReviewForm({ result: item.reviewResult || '', note: item.reviewNote || '' }); }}>
                  <td className="px-4 py-3 text-slate-600">{item.schedule?.date?.slice(0, 10) || item.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-800">{item.distributor.name}</span>
                    <span className="text-xs text-slate-400 ml-1">({item.distributor.staffId})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.schedule?.area?.chome_name || item.schedule?.area?.town_name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-black text-lg">{item.riskScore}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${RISK_COLORS[item.riskLevel] || ''}`}>
                      {t(`level_${item.riskLevel}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.reviewResult ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${REVIEW_COLORS[item.reviewResult] || ''}`}>
                        {t(`review_${item.reviewResult}`)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.scheduleId && (
                      <a
                        href={`/schedules?trajectory=${item.scheduleId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                      >
                        <i className="bi bi-geo-alt-fill mr-0.5"></i>GPS
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500">{total} 件</span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-bold ${p === page ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-black text-slate-800">{t('detail_title')}</h2>
                <p className="text-xs text-slate-400">{selectedItem.distributor.name} — {selectedItem.schedule?.date?.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-black ${RISK_COLORS[selectedItem.riskLevel]}`}>
                  {selectedItem.riskScore} {t(`level_${selectedItem.riskLevel}`)}
                </span>
                <button onClick={() => setSelectedItem(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
                  <i className="bi bi-x-lg text-slate-400"></i>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Stats */}
              {detail && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: t('detail_work_duration'), value: `${detail.workDurationMin}${t('min')}` },
                    { label: t('detail_pause_duration'), value: `${detail.pauseDurationMin}${t('min')}` },
                    { label: t('detail_gps_points'), value: detail.gpsPointCount },
                    { label: t('detail_actual_count'), value: `${detail.maxActualCount?.toLocaleString()}` },
                    { label: t('detail_distance'), value: `${detail.totalDistanceM?.toLocaleString()}${t('meters')}` },
                    { label: t('detail_speed'), value: `${detail.currentSpeedPerHour}${t('per_hour')}` },
                  ].map((s) => (
                    <div key={s.label} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-400">{s.label}</p>
                      <p className="text-lg font-black text-slate-800">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Comparison stats */}
              {detail && (detail.areaStats?.samples > 0 || detail.distributorStats?.samples > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {detail.areaStats?.samples > 0 && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-blue-400">{t('detail_area_avg')}</p>
                      <p className="text-lg font-black text-blue-700">{detail.areaStats.avg}{t('per_hour')}</p>
                      <p className="text-[10px] text-blue-400">{t('detail_samples')}: {detail.areaStats.samples}</p>
                    </div>
                  )}
                  {detail.distributorStats?.samples > 0 && (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-purple-400">{t('detail_personal_avg')}</p>
                      <p className="text-lg font-black text-purple-700">{detail.distributorStats.avg}{t('per_hour')}</p>
                      <p className="text-[10px] text-purple-400">{t('detail_samples')}: {detail.distributorStats.samples}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Indicator Bars */}
              <div className="space-y-2">
                {INDICATOR_KEYS.map((key) => {
                  const value = selectedItem[key] as number;
                  const pct = Math.round(value * 100);
                  const barColor = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-orange-400' : pct >= 30 ? 'bg-amber-400' : 'bg-emerald-400';
                  return (
                    <div key={key}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs font-bold text-slate-600">{t(`indicator_${key}`)}</span>
                        <span className="text-xs font-black text-slate-800">{pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Trajectory link */}
              {selectedItem.scheduleId && (
                <a
                  href={`/schedules?trajectory=${selectedItem.scheduleId}`}
                  className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl text-indigo-700 font-bold text-sm hover:bg-indigo-100 transition-colors"
                >
                  <i className="bi bi-geo-alt-fill"></i>
                  {t('view_trajectory')}
                </a>
              )}

              {/* Review Section */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h3 className="text-sm font-black text-slate-700">{t('review_title')}</h3>
                <div className="flex gap-2">
                  {(['FALSE_POSITIVE', 'SUSPICIOUS', 'CONFIRMED_FRAUD'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setReviewForm((f) => ({ ...f, result: r }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        reviewForm.result === r
                          ? r === 'CONFIRMED_FRAUD' ? 'bg-red-600 text-white border-red-600'
                          : r === 'SUSPICIOUS' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-600 text-white border-slate-600'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t(`review_${r}`)}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewForm.note}
                  onChange={(e) => setReviewForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder={t('review_note_placeholder')}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none h-20"
                />
                <div className="flex items-center justify-between">
                  {selectedItem.reviewedBy && (
                    <span className="text-xs text-slate-400">
                      {t('review_by')}: {selectedItem.reviewedBy.lastNameJa}{selectedItem.reviewedBy.firstNameJa}
                    </span>
                  )}
                  <button
                    onClick={handleReview}
                    disabled={reviewing || !reviewForm.result}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {reviewing && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {t('review_submit')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
