'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useNotification } from '@/components/ui/NotificationProvider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type InspectionCategory = 'CHECK' | 'GUIDANCE';

interface Inspection {
  id: number;
  inspectedAt: string;
  status: InspectionStatus;
  category: InspectionCategory;
  confirmationRate: number | null;
  complianceRate: number | null;
  distributor: {
    id: number;
    name: string;
    staffId: string;
  } | null;
  schedule: {
    id: number;
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
  PENDING: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-400 line-through',
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
  const { showToast } = useNotification();

  /* ---- State ---- */
  const [data, setData] = useState<InspectionListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | InspectionStatus>('ALL');
  const [filterCategory, setFilterCategory] = useState<'ALL' | InspectionCategory>('ALL');
  const [page, setPage] = useState(1);
  const [lineSending, setLineSending] = useState(false);
  const [showLineGroupModal, setShowLineGroupModal] = useState(false);
  const [lineGroups, setLineGroups] = useState<{ groupId: string; groupName: string }[]>([]);
  const [lineGroupConfigured, setLineGroupConfigured] = useState<boolean | null>(null);

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

  /* ---- Delete handler ---- */
  const handleDelete = async (id: number) => {
    if (!window.confirm(t('confirm_cancel'))) return;
    try {
      const res = await fetch(`/api/inspections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchData();
    } catch {
      showToast(t('error_generic'), 'error');
    }
  };

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

  /* ---- LINE share ---- */
  const handleLineShare = async () => {
    // グループ未設定なら選択モーダルを表示
    if (lineGroupConfigured === null) {
      try {
        const res = await fetch('/api/line/groups');
        if (res.ok) {
          const { groups, inspectionNotificationGroupId } = await res.json();
          setLineGroups(groups || []);
          if (inspectionNotificationGroupId) {
            setLineGroupConfigured(true);
          } else {
            setShowLineGroupModal(true);
            return;
          }
        }
      } catch { return; }
    } else if (!lineGroupConfigured) {
      setShowLineGroupModal(true);
      return;
    }
    sendLineMessage();
  };

  const sendLineMessage = async () => {
    const targetDate = filterDate || new Date().toISOString().split('T')[0];
    if (!confirm(t('line_share_confirm'))) return;
    setLineSending(true);
    try {
      const res = await fetch('/api/inspections/share-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: targetDate }),
      });
      if (res.ok) {
        const { count } = await res.json();
        alert(t('line_share_success', { count }));
      } else {
        const err = await res.json();
        alert(err.error || t('error_generic'));
      }
    } catch {
      alert(t('error_generic'));
    } finally {
      setLineSending(false);
    }
  };

  const selectLineGroup = async (groupId: string) => {
    try {
      await fetch('/api/line/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, type: 'inspection' }),
      });
      setLineGroupConfigured(true);
      setShowLineGroupModal(false);
      sendLineMessage();
    } catch { /* silent */ }
  };

  /* ---- Status badge ---- */
  const renderStatusBadge = (status: InspectionStatus) => {
    const statusKey = `status_${status.toLowerCase()}` as string;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'}`}>
        <i className={`bi ${STATUS_ICON[status] || 'bi-circle'} text-[10px]`} />
        {t(statusKey)}
      </span>
    );
  };

  /* ---- Category badge ---- */
  const renderCategoryBadge = (category: InspectionCategory) => {
    const categoryKey = `category_${category.toLowerCase()}` as string;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md ${CATEGORY_STYLE[category] || 'bg-gray-100 text-gray-600'}`}>
        <i className={`bi ${CATEGORY_ICON[category] || 'bi-tag'} text-[10px]`} />
        {t(categoryKey)}
      </span>
    );
  };

  /* ---- Rate display ---- */
  const renderRate = (rate: number | null) => {
    if (rate === null || rate === undefined) return <span className="text-slate-400">-</span>;
    const pct = Math.round(rate * 100);
    const color = pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-rose-600';
    return <span className={`font-bold ${color}`}>{pct}%</span>;
  };

  const stats = data?.stats || { total: 0, pending: 0, inProgress: 0, completed: 0 };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* ---- Inline stat badges ---- */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
          <i className="bi bi-list-check text-slate-500" />
          {t('stats_total')}: {stats.total}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
          <i className="bi bi-clock text-slate-500" />
          {t('stats_pending')}: {stats.pending}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg text-xs font-bold text-amber-700">
          <i className="bi bi-play-circle text-amber-500" />
          {t('stats_in_progress')}: {stats.inProgress}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg text-xs font-bold text-emerald-700">
          <i className="bi bi-check-circle-fill text-emerald-500" />
          {t('stats_completed')}: {stats.completed}
        </span>
      </div>

      {/* ---- Filter bar ---- */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
        {/* Date filter */}
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">{t('filter_date')}</label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border border-slate-300 rounded-lg text-xs md:text-sm px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-slate-400 hover:text-slate-600 text-sm"
                title={t('clear_date')}
              >
                <i className="bi bi-x-circle" />
              </button>
            )}
          </div>
        </div>

        {/* Status tabs */}
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">{t('col_status')}</label>
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => {
              const isActive = filterStatus === s;
              const key = s === 'ALL' ? 'status_all' : `status_${s.toLowerCase()}`;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t(key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category tabs */}
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">{t('col_category')}</label>
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {(['ALL', 'CHECK', 'GUIDANCE'] as const).map((c) => {
              const isActive = filterCategory === c;
              const key = c === 'ALL' ? 'category_all' : `category_${c.toLowerCase()}`;
              return (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    isActive ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t(key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="md:ml-auto flex items-center gap-2">
          <button
            onClick={handleLineShare}
            disabled={lineSending || !data?.data.length}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-green-300 rounded-lg hover:bg-green-50 disabled:opacity-50 text-xs font-bold text-green-700 transition-colors"
          >
            <i className={`bi ${lineSending ? 'bi-arrow-repeat animate-spin' : 'bi-line'}`} />
            {t('line_share')}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 text-xs font-bold text-slate-600 transition-colors"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <i className="bi bi-plus-lg" />
            {t('btn_new_assign')}
          </button>
        </div>
      </div>

      {/* ---- Desktop table ---- */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">{t('col_distributor')}</th>
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">{t('col_area')}</th>
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">{t('col_date')}</th>
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">{t('col_inspector')}</th>
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">{t('col_status')}</th>
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold">{t('col_category')}</th>
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold text-right">{t('col_confirmation_rate')}</th>
              <th className="px-3 py-2.5 text-slate-500 text-[10px] uppercase tracking-wider font-bold text-right">{t('col_compliance_rate')}</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.data.map((inspection) => (
              <tr
                key={inspection.id}
                onClick={() => router.push(`/inspections/${inspection.id}`)}
                className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
              >
                <td className="px-3 py-3">
                  <div className="font-bold text-slate-800">
                    {inspection.distributor?.name || t('unassigned')}
                  </div>
                  {inspection.distributor?.staffId && (
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {inspection.distributor.staffId}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {inspection.schedule?.area ? formatArea(inspection.schedule.area) : '-'}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {new Date(inspection.inspectedAt).toLocaleDateString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {inspection.inspector
                    ? `${inspection.inspector.lastNameJa} ${inspection.inspector.firstNameJa}`
                    : '-'}
                </td>
                <td className="px-3 py-3">{renderStatusBadge(inspection.status)}</td>
                <td className="px-3 py-3">{renderCategoryBadge(inspection.category)}</td>
                <td className="px-3 py-3 text-right">{renderRate(inspection.confirmationRate)}</td>
                <td className="px-3 py-3 text-right">{renderRate(inspection.complianceRate)}</td>
                <td className="px-1 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleDelete(inspection.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="削除"
                  >
                    <i className="bi bi-trash3 text-sm"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state in table */}
        {data && data.data.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">
            <i className="bi bi-clipboard-x text-3xl block mb-2" />
            <p className="text-sm">{t('no_inspections')}</p>
          </div>
        )}
      </div>

      {/* ---- Mobile card list ---- */}
      <div className="md:hidden space-y-2">
        {data?.data.map((inspection) => (
          <div
            key={inspection.id}
            onClick={() => router.push(`/inspections/${inspection.id}`)}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 active:bg-indigo-50/30 cursor-pointer transition-colors"
          >
            {/* Top row: distributor + badges */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <div className="font-bold text-slate-800 text-sm truncate">
                  {inspection.distributor?.name || t('unassigned')}
                </div>
                {inspection.distributor?.staffId && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {inspection.distributor.staffId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {renderCategoryBadge(inspection.category)}
                {renderStatusBadge(inspection.status)}
              </div>
            </div>

            {/* Area */}
            {inspection.schedule?.area && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
                <i className="bi bi-geo-alt text-slate-400 text-[10px]" />
                <span className="truncate">{formatArea(inspection.schedule.area)}</span>
              </div>
            )}

            {/* Date + Inspector */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-1.5">
              <span>
                <i className="bi bi-calendar3 text-slate-400 mr-1" />
                {new Date(inspection.inspectedAt).toLocaleDateString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </span>
              <span>
                <i className="bi bi-person text-slate-400 mr-1" />
                {inspection.inspector
                  ? `${inspection.inspector.lastNameJa} ${inspection.inspector.firstNameJa}`
                  : '-'}
              </span>
            </div>

            {/* Rates */}
            <div className="flex gap-4 text-[11px]">
              <div>
                <span className="text-slate-400">{t('col_confirmation_rate')}: </span>
                {renderRate(inspection.confirmationRate)}
              </div>
              <div>
                <span className="text-slate-400">{t('col_compliance_rate')}: </span>
                {renderRate(inspection.complianceRate)}
              </div>
            </div>
          </div>
        ))}

        {/* Empty state mobile */}
        {data && data.data.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">
            <i className="bi bi-clipboard-x text-3xl block mb-2" />
            <p className="text-sm">{t('no_inspections')}</p>
          </div>
        )}
      </div>

      {/* ---- Loading ---- */}
      {loading && !data && (
        <div className="px-6 py-12 text-center text-slate-400">
          <i className="bi bi-arrow-repeat animate-spin text-3xl block mb-2" />
        </div>
      )}

      {/* ---- Pagination ---- */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3">
          <div className="text-xs text-slate-500">
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
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50 disabled:hover:bg-white transition-colors text-slate-600"
            >
              <i className="bi bi-chevron-double-left" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50 disabled:hover:bg-white transition-colors text-slate-600"
            >
              <i className="bi bi-chevron-left" />
            </button>
            <span className="px-3 py-1.5 text-xs font-bold text-slate-700">
              {page} / {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50 disabled:hover:bg-white transition-colors text-slate-600"
            >
              <i className="bi bi-chevron-right" />
            </button>
            <button
              onClick={() => setPage(data.totalPages)}
              disabled={page === data.totalPages}
              className="px-2 py-1.5 text-xs border border-slate-200 rounded-md disabled:opacity-30 hover:bg-slate-50 disabled:hover:bg-white transition-colors text-slate-600"
            >
              <i className="bi bi-chevron-double-right" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  LINE Group Select Modal                                         */}
      {/* ================================================================ */}
      {showLineGroupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowLineGroupModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <i className="bi bi-line text-green-600" />
              {t('line_group_select_title')}
            </h3>
            {lineGroups.length === 0 ? (
              <p className="text-xs text-slate-500">{t('line_no_groups')}</p>
            ) : (
              <div className="space-y-2">
                {lineGroups.map((g) => (
                  <button
                    key={g.groupId}
                    onClick={() => selectLineGroup(g.groupId)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:border-green-400 hover:bg-green-50 text-sm font-medium text-slate-700 transition-colors"
                  >
                    <i className="bi bi-people-fill text-green-500 mr-2" />
                    {g.groupName}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowLineGroupModal(false)}
              className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              {t('btn_cancel')}
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
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800">{t('assign_title')}</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  resetAssignForm();
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4 space-y-4">
              {/* Date */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('assign_date')}</label>
                <input
                  type="date"
                  value={assignForm.date}
                  onChange={(e) => setAssignForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg text-xs md:text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Schedule search */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('assign_schedule')}</label>
                {selectedSchedule ? (
                  <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-800 text-xs">
                        {selectedSchedule.distributor?.name || t('unassigned')}
                        {selectedSchedule.distributor?.staffId && (
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                            ({selectedSchedule.distributor.staffId})
                          </span>
                        )}
                      </div>
                      {selectedSchedule.area && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <i className="bi bi-geo-alt text-slate-400 mr-1" />
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
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <i className="bi bi-search text-slate-400 text-xs" />
                    </div>
                    <input
                      type="text"
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      placeholder={t('assign_schedule_search')}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    {scheduleSearching && (
                      <div className="absolute right-3 top-2.5">
                        <i className="bi bi-arrow-repeat animate-spin text-slate-400" />
                      </div>
                    )}
                    {/* Search results dropdown */}
                    {scheduleResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {scheduleResults.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedSchedule(s);
                              setAssignForm((f) => ({ ...f, scheduleId: s.id }));
                              setScheduleSearch('');
                              setScheduleResults([]);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-indigo-50/30 border-b border-slate-100 last:border-b-0 transition-colors"
                          >
                            <div className="font-bold text-xs text-slate-800">
                              {s.distributor?.name || t('unassigned')}
                              {s.distributor?.staffId && (
                                <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                                  ({s.distributor.staffId})
                                </span>
                              )}
                            </div>
                            {s.area && (
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                <i className="bi bi-geo-alt text-slate-400 mr-1" />
                                {formatArea(s.area)}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {scheduleSearch.length >= 2 && !scheduleSearching && scheduleResults.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs text-slate-400 text-center">
                        {t('assign_no_results')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Inspector */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('assign_inspector')}</label>
                <select
                  value={assignForm.inspectorId}
                  onChange={(e) => setAssignForm((f) => ({ ...f, inspectorId: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-lg text-xs md:text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                <label className="text-xs font-bold text-slate-500 mb-1 block">{t('assign_category')}</label>
                <div className="flex gap-2">
                  {(['CHECK', 'GUIDANCE'] as const).map((c) => {
                    const isActive = assignForm.category === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setAssignForm((f) => ({ ...f, category: c }))}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold transition-colors ${
                          isActive
                            ? c === 'CHECK'
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-violet-50 border-violet-300 text-violet-700'
                            : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
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
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  resetAssignForm();
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || !assignForm.scheduleId || !assignForm.inspectorId || !assignForm.date}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
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
