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
  schedule: { id: number; date: string; area: { town_name: string; chome_name: string; name_en: string | null; prefecture?: { name: string }; city?: { name: string } } | null } | null;
  reviewedBy: { id: number; lastNameJa: string; firstNameJa: string } | null;
};

type KpiData = {
  totalAnalyzed: number;
  highCriticalCount: number;
  unreviewedCount: number;
  averageScore: number;
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

const PAGE_SIZE = 20;

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
  const [kpis, setKpis] = useState<KpiData>({ totalAnalyzed: 0, highCriticalCount: 0, unreviewedCount: 0, averageScore: 0 });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (filters.riskLevel) params.set('riskLevel', filters.riskLevel);
    if (filters.reviewResult) params.set('reviewResult', filters.reviewResult);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    try {
      const res = await fetch(`/api/fraud-analysis?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
        if (data.kpis) {
          setKpis(data.kpis);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReview = async () => {
    if (!selectedItem || !reviewForm.result) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/fraud-analysis/${selectedItem.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewForm),
      });
      if (res.ok) {
        setSelectedItem(null);
        setReviewForm({ result: '', note: '' });
        fetchData();
      }
    } catch (err) {
      console.error('Review error:', err);
    } finally {
      setReviewing(false);
    }
  };

  const detail = selectedItem?.analysisDetail ? JSON.parse(selectedItem.analysisDetail) : null;

  // Pagination helper (same pattern as complaints page)
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  // Area display helper (prefecture + city + chome_name)
  const formatArea = (schedule: FraudItem['schedule']) => {
    if (!schedule?.area) return '-';
    const area = schedule.area;
    if (area.prefecture && area.city) {
      return `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`;
    }
    return area.chome_name || area.town_name || '-';
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* Total Analyzed */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <i className="bi bi-shield-check text-indigo-600 text-lg"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 truncate">{t('kpi_total_analyzed')}</p>
              <p className="text-2xl md:text-3xl font-black text-slate-800">{kpis.totalAnalyzed.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* High + Critical */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <i className="bi bi-exclamation-triangle-fill text-red-500 text-lg"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 truncate">{t('kpi_high_critical')}</p>
              <p className={`text-2xl md:text-3xl font-black ${kpis.highCriticalCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{kpis.highCriticalCount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Unreviewed (HIGH/CRITICAL) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <i className="bi bi-clock-history text-amber-600 text-lg"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 truncate">{t('kpi_unreviewed')}</p>
              <p className={`text-2xl md:text-3xl font-black ${kpis.unreviewedCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{kpis.unreviewedCount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <i className="bi bi-graph-up text-slate-600 text-lg"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500 truncate">{t('kpi_avg_score')}</p>
              <p className="text-2xl md:text-3xl font-black text-slate-800">{kpis.averageScore}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_risk_level')}</label>
            <select
              value={filters.riskLevel}
              onChange={(e) => { setFilters((f) => ({ ...f, riskLevel: e.target.value })); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">{t('filter_all')}</option>
              <option value="CRITICAL">{t('level_CRITICAL')}</option>
              <option value="HIGH">{t('level_HIGH')}</option>
              <option value="MEDIUM">{t('level_MEDIUM')}</option>
              <option value="LOW">{t('level_LOW')}</option>
              <option value="HIGH,CRITICAL">{t('level_HIGH')} + {t('level_CRITICAL')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_review')}</label>
            <select
              value={filters.reviewResult}
              onChange={(e) => { setFilters((f) => ({ ...f, reviewResult: e.target.value })); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">{t('filter_all')}</option>
              <option value="unreviewed">{t('filter_unreviewed')}</option>
              <option value="FALSE_POSITIVE">{t('review_FALSE_POSITIVE')}</option>
              <option value="SUSPICIOUS">{t('review_SUSPICIOUS')}</option>
              <option value="CONFIRMED_FRAUD">{t('review_CONFIRMED_FRAUD')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_date_from')}</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_date_to')}</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-sm text-slate-500">{t('loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="bi bi-inbox text-4xl mb-3"></i>
            <p className="text-sm">{t('no_data')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('col_date')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('col_distributor')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('col_area')}</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('col_risk_score')}</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('col_risk_level')}</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('col_review')}</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => { setSelectedItem(item); setReviewForm({ result: item.reviewResult || '', note: item.reviewNote || '' }); }}
                      className="border-b border-slate-100 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{item.schedule?.date?.slice(0, 10) || item.createdAt.slice(0, 10)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{item.distributor.name}</span>
                        <span className="text-xs text-slate-400 ml-1.5 font-mono">({item.distributor.staffId})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{formatArea(item.schedule)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-black text-lg">{item.riskScore}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${RISK_COLORS[item.riskLevel] || ''}`}>
                          {t(`level_${item.riskLevel}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.reviewResult ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${REVIEW_COLORS[item.reviewResult] || ''}`}>
                            {t(`review_${item.reviewResult}`)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {item.scheduleId && (
                            <a
                              href={`/schedules?trajectory=${item.scheduleId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs transition-colors"
                            >
                              <i className="bi bi-geo-alt-fill mr-0.5"></i>GPS
                            </a>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setReviewForm({ result: item.reviewResult || '', note: item.reviewNote || '' }); }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold text-xs transition-colors"
                          >
                            {t('details')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-100 gap-3">
                <p className="text-xs text-slate-500">
                  {t('pagination_showing', { total: String(total), start: String(startItem), end: String(endItem) })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>
                  {getPageNumbers().map((p, idx) =>
                    typeof p === 'string' ? (
                      <span key={`dots-${idx}`} className="px-2 text-slate-400 text-xs">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          page === p
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
              </div>
            )}
          </>
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
                <button onClick={() => setSelectedItem(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
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
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
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
