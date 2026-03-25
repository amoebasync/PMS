'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import Pagination from '@/components/ui/Pagination';
import { useTranslation } from '@/i18n';

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────

type Branch = { id: number; nameJa: string };

type Distributor = {
  id: number;
  name: string;
  staffId: string;
  branch: Branch | null;
};

type Shift = {
  id: number;
  distributorId: number;
  date: string;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  distributor: Distributor;
};

type WeeklyShiftCell = { id: number; count: number; note: string | null } | null;

type WeeklyDistributor = {
  id: number;
  name: string;
  staffId: string;
  branch: Branch | null;
  shifts: Record<string, WeeklyShiftCell>;
};

const LIMIT = 50;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const STATUS_OPTIONS = [
  { value: 'WORKING', label: '出勤', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'CANCELED', label: 'キャンセル', color: 'bg-red-100 text-red-700' },
];

function getStatusBadge(status: string) {
  const opt = STATUS_OPTIONS.find(o => o.value === status);
  if (!opt) return <span className="text-xs text-slate-500">{status}</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${opt.color}`}>
      {opt.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const wd = WEEKDAYS[d.getDay()];
  return `${y}/${m}/${day} (${wd})`;
}

/** 今日の日付を YYYY-MM-DD で返す */
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 日付を n 日ずらす */
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────

export default function DistributorShiftsPage() {
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('distributor-shifts');

  // タブ
  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');

  // 共通: 支店フィルタ
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranchId, setFilterBranchId] = useState('');

  // ────── 週間グリッド ──────
  const [weekStartDate, setWeekStartDate] = useState(getTodayStr);
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [weekDistributors, setWeekDistributors] = useState<WeeklyDistributor[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  // 一覧
  const [listShifts, setListShifts] = useState<Shift[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // モーダル
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  // フォーム
  const [formDistributorId, setFormDistributorId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStatus, setFormStatus] = useState('WORKING');
  const [formNote, setFormNote] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // 配布員検索
  const [distributorSearch, setDistributorSearch] = useState('');
  const [distributorOptions, setDistributorOptions] = useState<Distributor[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [showDistributorDropdown, setShowDistributorDropdown] = useState(false);
  const distributorSearchRef = useRef<HTMLDivElement>(null);

  // 支店データ取得
  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(data => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // 配布員検索
  useEffect(() => {
    if (!distributorSearch || distributorSearch.length < 1) {
      setDistributorOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/distributors?search=${encodeURIComponent(distributorSearch)}`)
        .then(r => r.json())
        .then(data => {
          setDistributorOptions(Array.isArray(data) ? data : []);
          setShowDistributorDropdown(true);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [distributorSearch]);

  // 配布員ドロップダウン外クリック
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (distributorSearchRef.current && !distributorSearchRef.current.contains(e.target as Node)) {
        setShowDistributorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ────── 週間データ取得 ──────

  const fetchWeeklyData = useCallback(async () => {
    setWeekLoading(true);
    try {
      const params = new URLSearchParams({ startDate: weekStartDate });
      if (filterBranchId) params.set('branchId', filterBranchId);
      const res = await fetch(`/api/distributor-shifts/weekly?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setWeekDates(json.dates || []);
      setWeekDistributors(json.distributors || []);
    } catch {
      showToast(t('error_fetch_weekly'), 'error');
    }
    setWeekLoading(false);
  }, [weekStartDate, filterBranchId, showToast]);

  useEffect(() => {
    if (activeTab === 'calendar') fetchWeeklyData();
  }, [activeTab, fetchWeeklyData]);

  // ────── 一覧データ取得 ──────

  const fetchListShifts = useCallback(async (p?: number) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p || page));
      params.set('limit', String(LIMIT));
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (filterBranchId) params.set('branchId', filterBranchId);
      if (filterSearch) params.set('search', filterSearch);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/distributor-shifts?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setListShifts(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch {
      showToast(t('error_fetch_list'), 'error');
    }
    setListLoading(false);
  }, [page, filterDateFrom, filterDateTo, filterBranchId, filterSearch, filterStatus, showToast]);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchListShifts(1);
      setPage(1);
    }
  }, [activeTab, filterDateFrom, filterDateTo, filterBranchId, filterSearch, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ────── 操作ハンドラ ──────

  const openCreateModal = (date?: string, distributorId?: number, distributor?: Distributor) => {
    setEditingShift(null);
    setFormDistributorId(distributorId ? String(distributorId) : '');
    setFormDate(date || getTodayStr());
    setFormStatus('WORKING');
    setFormNote('');
    setSelectedDistributor(distributor || null);
    setDistributorSearch('');
    setShowModal(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setFormDistributorId(String(shift.distributorId));
    setFormDate(new Date(shift.date).toISOString().split('T')[0]);
    setFormStatus(shift.status);
    setFormNote(shift.note || '');
    setSelectedDistributor(shift.distributor);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingShift && !formDistributorId) {
      showToast(t('error_select_distributor'), 'warning');
      return;
    }
    if (!formDate) {
      showToast(t('error_select_date'), 'warning');
      return;
    }

    setFormSaving(true);
    try {
      const url = editingShift
        ? `/api/distributor-shifts/${editingShift.id}`
        : '/api/distributor-shifts';
      const method = editingShift ? 'PUT' : 'POST';
      const body = editingShift
        ? { date: formDate, status: formStatus, note: formNote }
        : { distributorId: formDistributorId, date: formDate, note: formNote };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        showToast(t('error_duplicate'), 'error');
        setFormSaving(false);
        return;
      }
      if (!res.ok) throw new Error();

      showToast(editingShift ? t('toast_updated') : t('toast_created'), 'success');
      setShowModal(false);
      refreshData();
    } catch {
      showToast(t('save_error'), 'error');
    }
    setFormSaving(false);
  };

  const handleDeleteShift = async (shiftId: number, distributorName: string, date: string) => {
    const confirmed = await showConfirm(
      t('confirm_delete', { name: distributorName, date: formatDate(date) }),
      { variant: 'danger', confirmLabel: t('confirm_delete_btn') }
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/distributor-shifts/${shiftId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(t('toast_deleted'), 'success');
      refreshData();
    } catch {
      showToast(t('delete_error'), 'error');
    }
  };

  const handleDelete = async (shift: Shift) => {
    await handleDeleteShift(shift.id, shift.distributor.name, shift.date);
  };

  const refreshData = () => {
    if (activeTab === 'calendar') {
      fetchWeeklyData();
    } else {
      fetchListShifts(page);
    }
  };

  // ────── 週間ナビ ──────
  const goToday = () => setWeekStartDate(getTodayStr());
  const goPrev = () => setWeekStartDate(prev => addDays(prev, -7));
  const goNext = () => setWeekStartDate(prev => addDays(prev, 7));

  // 日付ごとの出勤人数集計
  const dailyCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of weekDates) {
      counts[d] = weekDistributors.filter(dist => dist.shifts[d] !== null).length;
    }
    return counts;
  }, [weekDates, weekDistributors]);

  // ──────────────────────────────────────────
  // レンダリング
  // ──────────────────────────────────────────

  const todayStr = getTodayStr();

  return (
    <div className="space-y-4">
      {/* タブ */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['calendar', 'list'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <i className={`bi ${tab === 'calendar' ? 'bi-calendar-week' : 'bi-list-ul'} mr-1.5`}></i>
            {tab === 'calendar' ? t('tab_calendar') : t('tab_list')}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* 共通フィルタ: 支店 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">{t('filter_branch')}</label>
          <select
            value={filterBranchId}
            onChange={e => setFilterBranchId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">{t('filter_all_branches')}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.nameJa}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold
                     bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <i className="bi bi-plus-lg text-xs"></i>
          {t('btn_add_shift')}
        </button>
      </div>

      {/* ==================== 週間シフトタブ ==================== */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* ナビゲーション */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <i className="bi bi-chevron-left text-sm"></i>
              </button>
              <button
                onClick={goNext}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <i className="bi bi-chevron-right text-sm"></i>
              </button>
            </div>
            <button
              onClick={goToday}
              className="px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {t('today')}
            </button>
            {weekDates.length > 0 && (
              <h3 className="text-sm font-bold text-slate-800">
                {(() => {
                  const s = new Date(weekDates[0] + 'T00:00:00');
                  const e = new Date(weekDates[weekDates.length - 1] + 'T00:00:00');
                  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 〜 ${e.getMonth() + 1}月${e.getDate()}日`;
                })()}
              </h3>
            )}
            {weekLoading && (
              <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full ml-2" />
            )}
          </div>

          {/* グリッドテーブル */}
          <div className="overflow-auto max-h-[calc(100vh-220px)]">
            <table className="w-full text-sm border-collapse table-fixed">
              <colgroup>
                <col className="w-[180px] min-w-[180px]" />
                {weekDates.map(d => (
                  <col key={d} className="w-[72px] min-w-[72px]" />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-30">
                    {t('table_distributor')}
                  </th>
                  {weekDates.map(dateStr => {
                    const d = new Date(dateStr + 'T00:00:00');
                    const day = d.getDate();
                    const wd = WEEKDAYS[d.getDay()];
                    const isToday = dateStr === todayStr;
                    const isSun = d.getDay() === 0;
                    const isSat = d.getDay() === 6;
                    const count = dailyCounts[dateStr] || 0;
                    return (
                      <th
                        key={dateStr}
                        className={`text-center px-1 py-1.5 border-b border-r border-slate-200 ${
                          isToday ? 'bg-indigo-50' : 'bg-slate-50'
                        }`}
                      >
                        <div className={`text-[10px] font-bold leading-none ${
                          isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-500'
                        }`}>
                          {wd}
                        </div>
                        <div className={`text-base font-bold leading-tight ${
                          isToday ? 'text-indigo-600' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-800'
                        }`}>
                          {day}
                        </div>
                        <div className={`text-[9px] ${
                          isToday ? 'text-indigo-500' : 'text-slate-400'
                        }`}>
                          {d.getMonth() + 1}月
                        </div>
                        {weekDistributors.length > 0 && (
                          <div className={`text-[10px] font-bold mt-0.5 ${count > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                            {count}{t('people_suffix')}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {weekDistributors.length === 0 && !weekLoading ? (
                  <tr>
                    <td colSpan={1 + weekDates.length} className="text-center py-12 text-slate-400">
                      <i className="bi bi-people text-3xl mb-2 block"></i>
                      <p className="text-sm">{t('no_distributors')}</p>
                    </td>
                  </tr>
                ) : (
                  weekDistributors.map(dist => (
                    <tr key={dist.id} className="hover:bg-slate-50/30 transition-colors group">
                      {/* 配布員名 */}
                      <td className="px-3 py-1 border-b border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50/30 z-10">
                        <div className="font-medium text-slate-800 text-xs leading-tight truncate" title={dist.name}>{dist.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-mono text-slate-400">{dist.staffId}</span>
                          {dist.branch && (
                            <span className="text-[9px] text-slate-400">{dist.branch.nameJa}</span>
                          )}
                        </div>
                      </td>
                      {/* 日付セル */}
                      {weekDates.map(dateStr => {
                        const cell = dist.shifts[dateStr];
                        const isToday = dateStr === todayStr;
                        return (
                          <td
                            key={dateStr}
                            className={`text-center border-b border-r border-slate-100 relative cursor-pointer transition-colors ${
                              isToday ? 'bg-indigo-50/40' : ''
                            } ${cell ? 'hover:bg-emerald-50' : 'hover:bg-slate-100/50'}`}
                            onClick={() => {
                              if (cell) {
                                handleDeleteShift(cell.id, dist.name, dateStr);
                              } else {
                                openCreateModal(dateStr, dist.id, dist as Distributor);
                              }
                            }}
                            title={cell?.note || undefined}
                          >
                            {cell ? (
                              <div className="py-1">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-sm">
                                  {cell.count}
                                </span>
                                {cell.note && (
                                  <div className="absolute top-0.5 right-0.5">
                                    <i className="bi bi-chat-left-text text-[8px] text-amber-500"></i>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="py-1 opacity-0 group-hover:opacity-30 hover:!opacity-60 transition-opacity">
                                <i className="bi bi-plus-circle text-slate-400 text-sm"></i>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== 一覧タブ ==================== */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* フィルタバー */}
          <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('list_start_date')}</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('list_end_date')}</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('table_status')}</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">{t('list_filter_all')}</option>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{t(`status_${o.value.toLowerCase()}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('list_search')}</label>
              <div className="relative">
                <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder={t('list_search_placeholder')}
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* テーブル */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {listLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
              </div>
            ) : listShifts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <i className="bi bi-calendar-x text-3xl mb-2 block"></i>
                <p className="text-sm">{t('no_shifts')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_date')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_distributor')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_staff_id')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_branch')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_status')}</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_memo')}</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600 w-24">{t('table_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listShifts.map(shift => (
                      <tr
                        key={shift.id}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(shift.date)}</td>
                        <td className="px-4 py-3 font-medium">{shift.distributor.name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{shift.distributor.staffId}</td>
                        <td className="px-4 py-3 text-slate-500">{shift.distributor.branch?.nameJa || '-'}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const opt = STATUS_OPTIONS.find(o => o.value === shift.status);
                            if (!opt) return <span className="text-xs text-slate-500">{shift.status}</span>;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${opt.color}`}>
                                {t(`status_${shift.status.toLowerCase()}`)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{shift.note || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(shift)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                              title={t('edit')}
                            >
                              <i className="bi bi-pencil text-xs"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(shift)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                              title={t('delete')}
                            >
                              <i className="bi bi-trash text-xs"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={LIMIT}
              onPageChange={(p) => { setPage(p); fetchListShifts(p); }}
            />
          </div>
        </div>
      )}

      {/* ==================== 作成・編集モーダル ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                <i className={`bi ${editingShift ? 'bi-pencil' : 'bi-plus-circle'} mr-2 text-indigo-600`}></i>
                {editingShift ? t('modal_title_edit') : t('modal_title_new')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <i className="bi bi-x-lg text-sm"></i>
              </button>
            </div>

            {/* フォーム */}
            <div className="p-5 space-y-4">
              {/* 配布員 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('form_distributor')} <span className="text-red-500">*</span></label>
                {editingShift || selectedDistributor ? (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    editingShift ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50 border-indigo-200'
                  }`}>
                    <span className={`text-sm font-medium ${editingShift ? '' : 'text-indigo-700'}`}>
                      {selectedDistributor?.name}
                    </span>
                    <span className={`text-[10px] font-mono ${editingShift ? 'text-slate-400' : 'text-indigo-400'}`}>
                      {selectedDistributor?.staffId}
                    </span>
                    {!editingShift && (
                      <button
                        onClick={() => { setSelectedDistributor(null); setFormDistributorId(''); setDistributorSearch(''); }}
                        className="ml-auto text-indigo-400 hover:text-indigo-600"
                      >
                        <i className="bi bi-x-lg text-xs"></i>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative" ref={distributorSearchRef}>
                    <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      type="text"
                      value={distributorSearch}
                      onChange={e => setDistributorSearch(e.target.value)}
                      onFocus={() => { if (distributorOptions.length > 0) setShowDistributorDropdown(true); }}
                      placeholder={t('form_search_placeholder')}
                      className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {showDistributorDropdown && distributorOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {distributorOptions.map(d => (
                          <button
                            key={d.id}
                            onClick={() => {
                              setSelectedDistributor(d);
                              setFormDistributorId(String(d.id));
                              setShowDistributorDropdown(false);
                              setDistributorSearch('');
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          >
                            <span className="text-sm font-medium">{d.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{d.staffId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 日付 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('form_date')} <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* ステータス（編集時のみ） */}
              {editingShift && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('form_status')}</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{t(`status_${o.value.toLowerCase()}`)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* メモ */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('form_memo')}</label>
                <textarea
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  rows={2}
                  placeholder={t('form_memo_placeholder')}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* フッター */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={formSaving}
                className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {formSaving ? (
                  <span className="flex items-center gap-1.5">
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    {t('saving')}
                  </span>
                ) : (
                  editingShift ? t('btn_update') : t('btn_create')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
