'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type InspectionCategory = 'CHECK' | 'GUIDANCE';

interface Inspection {
  id: number;
  date: string;
  status: InspectionStatus;
  category: InspectionCategory;
  confirmationRate: number | null;
  complianceRate: number | null;
  schedule: {
    id: number;
    distributor: {
      id: number;
      name: string;
      staffId: string;
    } | null;
    area: {
      chome_name: string;
      town_name: string;
      prefecture: { name: string };
      city: { name: string };
    } | null;
  } | null;
  inspector: {
    id: number;
    lastNameJa: string;
    firstNameJa: string;
  } | null;
}

interface InspectionListResponse {
  data: Inspection[];
  total: number;
  totalPages: number;
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
}

interface ScheduleSearchResult {
  id: number;
  date: string;
  distributor: {
    id: number;
    name: string;
    staffId: string;
  } | null;
  area: {
    chome_name: string;
    town_name: string;
    prefecture: { name: string };
    city: { name: string };
  } | null;
}

interface Employee {
  id: number;
  lastNameJa: string;
  firstNameJa: string;
  staffId?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

const STATUS_ICON: Record<string, string> = {
  PENDING: 'bi-clock',
  IN_PROGRESS: 'bi-play-circle',
  COMPLETED: 'bi-check-circle-fill',
  CANCELLED: 'bi-x-circle',
};

const CATEGORY_STYLE: Record<string, string> = {
  CHECK: 'bg-blue-100 text-blue-700',
  GUIDANCE: 'bg-violet-100 text-violet-700',
};

const CATEGORY_ICON: Record<string, string> = {
  CHECK: 'bi-clipboard-check',
  GUIDANCE: 'bi-person-raised-hand',
};

const LIMIT = 20;

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

const formatArea = (area: Inspection['schedule'] extends null ? never : NonNullable<NonNullable<Inspection['schedule']>['area']>) => {
  if (!area) return '-';
  return `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InspectionsPage() {
  const { t } = useTranslation('inspections');
  const router = useRouter();

  /* ---- State ---- */
  const [data, setData] = useState<InspectionListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | InspectionStatus>('ALL');
  const [filterCategory, setFilterCategory] = useState<'ALL' | InspectionCategory>('ALL');
  const [page, setPage] = useState(1);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    scheduleId: 0,
    inspectorId: 0,
    category: 'CHECK' as InspectionCategory,
    date: new Date().toISOString().split('T')[0],
  });
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleResults, setScheduleResults] = useState<ScheduleSearchResult[]>([]);
  const [scheduleSearching, setScheduleSearching] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleSearchResult | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assigning, setAssigning] = useState(false);

  /* ---- Fetch data ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (filterDate) params.append('date', filterDate);
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterCategory !== 'ALL') params.append('category', filterCategory);

      const res = await fetch(`/api/inspections?${params}`);
      if (res.ok) {
        const json: InspectionListResponse = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterDate, filterStatus, filterCategory]);

  useRefreshOnFocus(fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterDate, filterStatus, filterCategory]);

  /* ---- Fetch employees for assign modal ---- */
  useEffect(() => {
    if (!showAssignModal) return;
    fetch('/api/employees?active=true&limit=500')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setEmployees(Array.isArray(d) ? d : d.data || []);
      })
      .catch(() => {});
  }, [showAssignModal]);

  /* ---- Schedule search ---- */
  useEffect(() => {
    if (!showAssignModal || scheduleSearch.length < 2) {
      setScheduleResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setScheduleSearching(true);
      try {
        const params = new URLSearchParams({ q: scheduleSearch, limit: '10' });
        if (assignForm.date) params.append('date', assignForm.date);
        const res = await fetch(`/api/schedules/search?${params}`);
        if (res.ok) {
          const json = await res.json();
          setScheduleResults(Array.isArray(json) ? json : json.data || []);
        }
      } catch {
        /* silent */
      } finally {
        setScheduleSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [scheduleSearch, showAssignModal, assignForm.date]);

  /* ---- Assign handler ---- */
  const handleAssign = async () => {
    if (!assignForm.scheduleId || !assignForm.inspectorId || !assignForm.date) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm),
      });
      if (res.ok) {
        setShowAssignModal(false);
        resetAssignForm();
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || t('error_generic'));
      }
    } catch {
      alert(t('error_generic'));
    } finally {
      setAssigning(false);
    }
  };

  const resetAssignForm = () => {
    setAssignForm({
      scheduleId: 0,
      inspectorId: 0,
      category: 'CHECK',
      date: new Date().toISOString().split('T')[0],
    });
    setScheduleSearch('');
    setScheduleResults([]);
    setSelectedSchedule(null);
  };

  /* ---- Status badge ---- */
  const renderStatusBadge = (status: InspectionStatus) => {
    const statusKey = `status_${status.toLowerCase()}` as string;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'}`}>
        <i className={`bi ${STATUS_ICON[status] || 'bi-circle'} text-[10px]`} />
        {t(statusKey)}
      </span>
    );
  };

  /* ---- Category badge ---- */
  const renderCategoryBadge = (category: InspectionCategory) => {
    const categoryKey = `category_${category.toLowerCase()}` as string;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${CATEGORY_STYLE[category] || 'bg-gray-100 text-gray-600'}`}>
        <i className={`bi ${CATEGORY_ICON[category] || 'bi-tag'} text-[10px]`} />
        {t(categoryKey)}
      </span>
    );
  };

  /* ---- Rate display ---- */
  const renderRate = (rate: number | null) => {
    if (rate === null || rate === undefined) return <span className="text-gray-400">-</span>;
    const pct = Math.round(rate * 100);
    const color = pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-rose-600';
    return <span className={`font-semibold ${color}`}>{pct}%</span>;
  };

  const stats = data?.stats || { total: 0, pending: 0, inProgress: 0, completed: 0 };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date filter */}
          <div className="flex items-center gap-2">
            <i className="bi bi-calendar3 text-gray-400" />
            <label className="text-sm text-gray-500 hidden sm:inline">{t('filter_date')}</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-gray-400 hover:text-gray-600 text-sm"
                title={t('clear_date')}
              >
                <i className="bi bi-x-circle" />
              </button>
            )}
          </div>
          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>
        </div>
        {/* New assignment button */}
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <i className="bi bi-plus-lg" />
          {t('btn_new_assign')}
        </button>
      </div>

      {/* ---- Stats cards ---- */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <i className="bi bi-list-check text-gray-400 text-sm" />
          </div>
          <div className="text-[10px] md:text-sm text-gray-500 truncate">{t('stats_total')}</div>
          <div className="text-lg md:text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <i className="bi bi-clock text-slate-400 text-sm" />
          </div>
          <div className="text-[10px] md:text-sm text-slate-500 truncate">{t('stats_pending')}</div>
          <div className="text-lg md:text-2xl font-bold text-slate-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <i className="bi bi-play-circle text-amber-400 text-sm" />
          </div>
          <div className="text-[10px] md:text-sm text-amber-500 truncate">{t('stats_in_progress')}</div>
          <div className="text-lg md:text-2xl font-bold text-amber-600">{stats.inProgress}</div>
        </div>
        <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <i className="bi bi-check-circle-fill text-emerald-400 text-sm" />
          </div>
          <div className="text-[10px] md:text-sm text-emerald-500 truncate">{t('stats_completed')}</div>
          <div className="text-lg md:text-2xl font-bold text-emerald-600">{stats.completed}</div>
        </div>
      </div>

      {/* ---- Filter tabs ---- */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => {
            const isActive = filterStatus === s;
            const key = s === 'ALL' ? 'status_all' : `status_${s.toLowerCase()}`;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(key)}
              </button>
            );
          })}
        </div>
        {/* Category tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['ALL', 'CHECK', 'GUIDANCE'] as const).map((c) => {
            const isActive = filterCategory === c;
            const key = c === 'ALL' ? 'category_all' : `category_${c.toLowerCase()}`;
            return (
              <button
                key={c}
                onClick={() => setFilterCategory(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Desktop table ---- */}
      <div className="hidden md:block bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">{t('col_distributor')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">{t('col_area')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">{t('col_date')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">{t('col_inspector')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">{t('col_status')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">{t('col_category')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{t('col_confirmation_rate')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">{t('col_compliance_rate')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data?.data.map((inspection) => (
              <tr
                key={inspection.id}
                onClick={() => router.push(`/inspections/${inspection.id}`)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {inspection.schedule?.distributor?.name || t('unassigned')}
                  </div>
                  {inspection.schedule?.distributor?.staffId && (
                    <div className="text-xs text-gray-400 font-mono">
                      {inspection.schedule.distributor.staffId}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {inspection.schedule?.area ? formatArea(inspection.schedule.area) : '-'}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {new Date(inspection.date).toLocaleDateString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {inspection.inspector
                    ? `${inspection.inspector.lastNameJa} ${inspection.inspector.firstNameJa}`
                    : '-'}
                </td>
                <td className="px-4 py-3">{renderStatusBadge(inspection.status)}</td>
                <td className="px-4 py-3">{renderCategoryBadge(inspection.category)}</td>
                <td className="px-4 py-3 text-right">{renderRate(inspection.confirmationRate)}</td>
                <td className="px-4 py-3 text-right">{renderRate(inspection.complianceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state in table */}
        {data && data.data.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <i className="bi bi-clipboard-x text-4xl mb-3 block" />
            <p>{t('no_inspections')}</p>
          </div>
        )}
      </div>

      {/* ---- Mobile card list ---- */}
      <div className="md:hidden space-y-3">
        {data?.data.map((inspection) => (
          <div
            key={inspection.id}
            onClick={() => router.push(`/inspections/${inspection.id}`)}
            className="bg-white rounded-xl border shadow-sm p-4 active:bg-gray-50 cursor-pointer transition-colors"
          >
            {/* Top row: distributor + badges */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">
                  {inspection.schedule?.distributor?.name || t('unassigned')}
                </div>
                {inspection.schedule?.distributor?.staffId && (
                  <span className="text-xs text-gray-400 font-mono">
                    {inspection.schedule.distributor.staffId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {renderCategoryBadge(inspection.category)}
                {renderStatusBadge(inspection.status)}
              </div>
            </div>

            {/* Area */}
            {inspection.schedule?.area && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1.5">
                <i className="bi bi-geo-alt text-gray-400 text-xs" />
                <span className="truncate">{formatArea(inspection.schedule.area)}</span>
              </div>
            )}

            {/* Date + Inspector */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
              <span>
                <i className="bi bi-calendar3 text-gray-400 mr-1" />
                {new Date(inspection.date).toLocaleDateString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </span>
              <span>
                <i className="bi bi-person text-gray-400 mr-1" />
                {inspection.inspector
                  ? `${inspection.inspector.lastNameJa} ${inspection.inspector.firstNameJa}`
                  : '-'}
              </span>
            </div>

            {/* Rates */}
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-gray-400">{t('col_confirmation_rate')}: </span>
                {renderRate(inspection.confirmationRate)}
              </div>
              <div>
                <span className="text-gray-400">{t('col_compliance_rate')}: </span>
                {renderRate(inspection.complianceRate)}
              </div>
            </div>
          </div>
        ))}

        {/* Empty state mobile */}
        {data && data.data.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <i className="bi bi-clipboard-x text-4xl mb-3 block" />
            <p>{t('no_inspections')}</p>
          </div>
        )}
      </div>

      {/* ---- Loading ---- */}
      {loading && !data && (
        <div className="text-center py-16 text-gray-400">
          <i className="bi bi-arrow-repeat animate-spin text-3xl mb-3 block" />
        </div>
      )}

      {/* ---- Pagination ---- */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border px-4 py-3">
          <div className="text-sm text-gray-500">
            {t('pagination_showing', {
              start: String((page - 1) * LIMIT + 1),
              end: String(Math.min(page * LIMIT, data.total)),
              total: String(data.total),
            })}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2.5 py-1.5 text-sm border rounded-md disabled:opacity-30 hover:bg-gray-50 disabled:hover:bg-white transition-colors"
            >
              <i className="bi bi-chevron-double-left" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 text-sm border rounded-md disabled:opacity-30 hover:bg-gray-50 disabled:hover:bg-white transition-colors"
            >
              <i className="bi bi-chevron-left" />
            </button>
            <span className="px-3 py-1.5 text-sm font-medium text-gray-700">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-2.5 py-1.5 text-sm border rounded-md disabled:opacity-30 hover:bg-gray-50 disabled:hover:bg-white transition-colors"
            >
              <i className="bi bi-chevron-right" />
            </button>
            <button
              onClick={() => setPage(data.totalPages)}
              disabled={page === data.totalPages}
              className="px-2.5 py-1.5 text-sm border rounded-md disabled:opacity-30 hover:bg-gray-50 disabled:hover:bg-white transition-colors"
            >
              <i className="bi bi-chevron-double-right" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  Assign Modal                                                    */}
      {/* ================================================================ */}
      {showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAssignModal(false);
            resetAssignForm();
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{t('assign_title')}</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  resetAssignForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="bi bi-x-lg text-xl" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('assign_date')}</label>
                <input
                  type="date"
                  value={assignForm.date}
                  onChange={(e) => setAssignForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Schedule search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('assign_schedule')}</label>
                {selectedSchedule ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {selectedSchedule.distributor?.name || t('unassigned')}
                        {selectedSchedule.distributor?.staffId && (
                          <span className="text-xs text-gray-400 font-mono ml-1.5">
                            ({selectedSchedule.distributor.staffId})
                          </span>
                        )}
                      </div>
                      {selectedSchedule.area && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          <i className="bi bi-geo-alt text-gray-400 mr-1" />
                          {formatArea(selectedSchedule.area)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedSchedule(null);
                        setAssignForm((f) => ({ ...f, scheduleId: 0 }));
                        setScheduleSearch('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      placeholder={t('assign_schedule_search')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {scheduleSearching && (
                      <div className="absolute right-3 top-2.5">
                        <i className="bi bi-arrow-repeat animate-spin text-gray-400" />
                      </div>
                    )}
                    {/* Search results dropdown */}
                    {scheduleResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {scheduleResults.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedSchedule(s);
                              setAssignForm((f) => ({ ...f, scheduleId: s.id }));
                              setScheduleSearch('');
                              setScheduleResults([]);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-sm text-gray-900">
                              {s.distributor?.name || t('unassigned')}
                              {s.distributor?.staffId && (
                                <span className="text-xs text-gray-400 font-mono ml-1.5">
                                  ({s.distributor.staffId})
                                </span>
                              )}
                            </div>
                            {s.area && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                <i className="bi bi-geo-alt text-gray-400 mr-1" />
                                {formatArea(s.area)}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {scheduleSearch.length >= 2 && !scheduleSearching && scheduleResults.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-400 text-center">
                        {t('assign_no_results')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Inspector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('assign_inspector')}</label>
                <select
                  value={assignForm.inspectorId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, inspectorId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>{t('assign_inspector')}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.lastNameJa} {emp.firstNameJa}
                      {emp.staffId ? ` (${emp.staffId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('assign_category')}</label>
                <div className="flex gap-2">
                  {(['CHECK', 'GUIDANCE'] as const).map((c) => {
                    const isActive = assignForm.category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setAssignForm((f) => ({ ...f, category: c }))}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          isActive
                            ? c === 'CHECK'
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-violet-50 border-violet-300 text-violet-700'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <i className={`bi ${CATEGORY_ICON[c]}`} />
                        {t(`category_${c.toLowerCase()}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  resetAssignForm();
                }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || !assignForm.scheduleId || !assignForm.inspectorId || !assignForm.date}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {assigning && <i className="bi bi-arrow-repeat animate-spin" />}
                {t('assign_submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
