'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import AreaAnalyticsPanel from '@/components/analytics/AreaAnalyticsPanel';

// KpiCard (same helper)
function KpiCard({ icon, label, value, color }: { icon: string; label: string; value: number | undefined; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-lg ${color || 'bg-blue-50 text-blue-600'}`}>
        <i className={`bi ${icon}`}></i>
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-800">{value?.toLocaleString() ?? '-'}</div>
      </div>
    </div>
  );
}

interface AreaRow {
  areaId: number;
  areaName: string;
  schedulesCount: number;
  avgCompletionRate: number;
  allDistributedCount: number;
  areaDoneCount: number;
  lastDistributed: string | null;
}

export default function AreaAnalyticsPage() {
  const { t } = useTranslation('analytics-areas');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/areas/overview')
      .then(r => r.json())
      .then(setOverview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Area search using existing /api/areas endpoint
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/areas?search=${encodeURIComponent(searchQuery)}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.data || []);
      }
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Area table row component (renamed from AreaRow to avoid conflict with interface)
  const AreaTableRow = ({ area, rank }: { area: AreaRow; rank?: number }) => (
    <tr className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
      onClick={() => setSelectedAreaId(area.areaId)}>
      {rank != null && <td className="py-2.5 pr-2 text-xs text-slate-400 text-center">{rank}</td>}
      <td className="py-2.5 pr-3 text-sm font-medium text-slate-700">{area.areaName}</td>
      <td className="py-2.5 pr-3 text-sm text-center">{area.schedulesCount}</td>
      <td className="py-2.5 pr-3 text-sm text-center">
        <span className={`font-medium ${area.avgCompletionRate < 70 ? 'text-red-600' : area.avgCompletionRate < 90 ? 'text-amber-600' : 'text-green-600'}`}>
          {area.avgCompletionRate}%
        </span>
      </td>
      <td className="py-2.5 pr-3 text-sm text-center text-green-600">{area.allDistributedCount}</td>
      <td className="py-2.5 pr-3 text-sm text-center text-blue-600">{area.areaDoneCount}</td>
      <td className="py-2.5 text-xs text-slate-400">{area.lastDistributed || '-'}</td>
    </tr>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon="bi-geo-alt-fill" label={t('kpi.total_areas')} value={overview?.kpi?.totalAreas} color="bg-indigo-50 text-indigo-600" />
        <KpiCard icon="bi-calendar-check-fill" label={t('kpi.completed_schedules')} value={overview?.kpi?.totalCompletedSchedules} color="bg-emerald-50 text-emerald-600" />
        <KpiCard icon="bi-check-circle-fill" label={t('kpi.all_distributed')} value={overview?.kpi?.totalAllDistributed} color="bg-green-50 text-green-600" />
        <KpiCard icon="bi-flag-fill" label={t('kpi.area_done')} value={overview?.kpi?.totalAreaDone} color="bg-blue-50 text-blue-600" />
      </div>

      {/* Two Column: Needs Review + Most Frequent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Review */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill text-amber-500"></i>
            {t('sections.needs_review')}
          </h2>
          {overview?.needsReview?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 pr-2 text-[10px] font-semibold text-slate-400 text-center">#</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-left">{t('table.area_name')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.schedules_count')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.avg_completion_rate')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.all_distributed')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.area_done')}</th>
                    <th className="pb-2 text-[10px] font-semibold text-slate-400">{t('table.last_distributed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.needsReview.map((a: AreaRow, i: number) => <AreaTableRow key={a.areaId} area={a} rank={i + 1} />)}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-slate-400 text-center py-6">{t('no_data')}</p>}
        </div>

        {/* Most Frequent */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <i className="bi bi-arrow-repeat text-blue-500"></i>
            {t('sections.most_frequent')}
          </h2>
          {overview?.mostFrequent?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 pr-2 text-[10px] font-semibold text-slate-400 text-center">#</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-left">{t('table.area_name')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.schedules_count')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.avg_completion_rate')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.all_distributed')}</th>
                    <th className="pb-2 pr-3 text-[10px] font-semibold text-slate-400 text-center">{t('table.area_done')}</th>
                    <th className="pb-2 text-[10px] font-semibold text-slate-400">{t('table.last_distributed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.mostFrequent.map((a: AreaRow, i: number) => <AreaTableRow key={a.areaId} area={a} rank={i + 1} />)}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-slate-400 text-center py-6">{t('no_data')}</p>}
        </div>
      </div>

      {/* Area Search Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <i className="bi bi-search text-slate-400"></i>
          {t('sections.area_search')}
        </h2>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('filter.search_placeholder')}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searching && <div className="text-sm text-slate-400 mt-3 text-center">{t('loading')}</div>}
        {searchResults.length > 0 && (
          <div className="mt-3 max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
            {searchResults.map((area: any) => (
              <div key={area.id}
                className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center justify-between"
                onClick={() => setSelectedAreaId(area.id)}>
                <div>
                  <span className="text-sm font-medium text-slate-700">{area.prefecture?.name}{area.city?.name}{area.chome_name || area.town_name || ''}</span>
                </div>
                <i className="bi bi-chevron-right text-slate-300"></i>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Area Analytics Panel (slide-over) */}
      {selectedAreaId && (
        <AreaAnalyticsPanel areaId={selectedAreaId} onClose={() => setSelectedAreaId(null)} />
      )}
    </div>
  );
}
