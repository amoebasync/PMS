'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNotification } from '@/components/ui/NotificationProvider';
import Pagination from '@/components/ui/Pagination';

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

const LIMIT = 50;

const STATUS_OPTIONS = [
  { value: 'WORKING', label: '出勤', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'REQUESTED', label: '申請中', color: 'bg-amber-100 text-amber-700' },
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
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const wd = weekdays[d.getDay()];
  return `${y}/${m}/${day} (${wd})`;
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────

export default function DistributorShiftsPage() {
  const { showToast, showConfirm } = useNotification();
  const calendarRef = useRef<FullCalendar>(null);

  // タブ
  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');

  // 共通: 支店フィルタ
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterBranchId, setFilterBranchId] = useState('');

  // カレンダー
  const [calendarShifts, setCalendarShifts] = useState<Shift[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

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
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayModalDate, setDayModalDate] = useState('');
  const [dayModalShifts, setDayModalShifts] = useState<Shift[]>([]);

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

  // ────── カレンダーデータ取得 ──────

  const fetchCalendarShifts = useCallback(async (dateFrom: string, dateTo: string) => {
    setCalendarLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (filterBranchId) params.set('branchId', filterBranchId);
      const res = await fetch(`/api/distributor-shifts/calendar?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCalendarShifts(json.data || []);
    } catch {
      showToast('カレンダーデータの取得に失敗しました', 'error');
    }
    setCalendarLoading(false);
  }, [filterBranchId, showToast]);

  // 支店フィルタが変わったらカレンダー再取得
  useEffect(() => {
    if (activeTab === 'calendar') {
      const api = calendarRef.current?.getApi();
      if (api) {
        const start = api.view.activeStart;
        const end = api.view.activeEnd;
        fetchCalendarShifts(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
      }
    }
  }, [filterBranchId, activeTab, fetchCalendarShifts]);

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
      showToast('シフト一覧の取得に失敗しました', 'error');
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

  const openCreateModal = (date?: string) => {
    setEditingShift(null);
    setFormDistributorId('');
    setFormDate(date || new Date().toISOString().split('T')[0]);
    setFormStatus('WORKING');
    setFormNote('');
    setSelectedDistributor(null);
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
      showToast('配布員を選択してください', 'warning');
      return;
    }
    if (!formDate) {
      showToast('日付を入力してください', 'warning');
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
        showToast('この配布員はこの日付に既にシフトが登録されています', 'error');
        setFormSaving(false);
        return;
      }
      if (!res.ok) throw new Error();

      showToast(editingShift ? 'シフトを更新しました' : 'シフトを作成しました', 'success');
      setShowModal(false);
      refreshData();
    } catch {
      showToast('保存に失敗しました', 'error');
    }
    setFormSaving(false);
  };

  const handleDelete = async (shift: Shift) => {
    const confirmed = await showConfirm(
      `${shift.distributor.name} の ${formatDate(shift.date)} のシフトを削除しますか？`,
      { variant: 'danger', confirmLabel: '削除' }
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/distributor-shifts/${shift.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('シフトを削除しました', 'success');
      refreshData();
      // 日付モーダルが開いていれば更新
      if (showDayModal) {
        setDayModalShifts(prev => prev.filter(s => s.id !== shift.id));
      }
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  const refreshData = () => {
    if (activeTab === 'calendar') {
      const api = calendarRef.current?.getApi();
      if (api) {
        const start = api.view.activeStart;
        const end = api.view.activeEnd;
        fetchCalendarShifts(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
      }
    } else {
      fetchListShifts(page);
    }
  };

  // ────── カレンダーイベント生成 ──────

  const calendarEvents = React.useMemo(() => {
    // 日付ごとにグルーピング
    const grouped: Record<string, Shift[]> = {};
    for (const s of calendarShifts) {
      const dateKey = new Date(s.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(s);
    }

    return Object.entries(grouped).map(([dateKey, shifts]) => ({
      id: dateKey,
      start: dateKey,
      allDay: true,
      extendedProps: { shifts, count: shifts.length },
    }));
  }, [calendarShifts]);

  // ────── 日付クリック → 日付モーダル ──────

  const handleDateClick = (info: { dateStr: string }) => {
    const dateKey = info.dateStr;
    const shiftsForDay = calendarShifts.filter(
      s => new Date(s.date).toISOString().split('T')[0] === dateKey
    );
    setDayModalDate(dateKey);
    setDayModalShifts(shiftsForDay);
    setShowDayModal(true);
  };

  // ──────────────────────────────────────────
  // レンダリング
  // ──────────────────────────────────────────

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
            <i className={`bi ${tab === 'calendar' ? 'bi-calendar3' : 'bi-list-ul'} mr-1.5`}></i>
            {tab === 'calendar' ? 'カレンダー' : '一覧'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* 共通フィルタ: 支店 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">支店</label>
          <select
            value={filterBranchId}
            onChange={e => setFilterBranchId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">全支店</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.nameJa}</option>
            ))}
          </select>
        </div>

        {activeTab === 'calendar' && (
          <button
            onClick={() => openCreateModal()}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold
                       bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <i className="bi bi-plus-lg text-xs"></i>
            シフト追加
          </button>
        )}
      </div>

      {/* ==================== カレンダータブ ==================== */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          {calendarLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ja"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            buttonText={{ today: '今日' }}
            height="auto"
            events={calendarEvents}
            dateClick={handleDateClick}
            datesSet={(dateInfo) => {
              const start = dateInfo.start.toISOString().split('T')[0];
              const end = dateInfo.end.toISOString().split('T')[0];
              fetchCalendarShifts(start, end);
            }}
            eventContent={(arg) => {
              const { count, shifts } = arg.event.extendedProps;
              const displayShifts = (shifts as Shift[]).slice(0, 3);
              const more = count - 3;
              return (
                <div className="w-full px-1 py-0.5 cursor-pointer">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      {count}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">名出勤</span>
                  </div>
                  {displayShifts.map((s: Shift) => (
                    <div key={s.id} className="text-[10px] text-slate-600 truncate leading-tight">
                      {s.distributor.name}
                    </div>
                  ))}
                  {more > 0 && (
                    <div className="text-[10px] text-indigo-500 font-medium">+{more}名</div>
                  )}
                </div>
              );
            }}
            eventClick={(info) => {
              const dateKey = info.event.startStr;
              handleDateClick({ dateStr: dateKey });
            }}
          />
        </div>
      )}

      {/* ==================== 一覧タブ ==================== */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* フィルタバー */}
          <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">開始日</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">終了日</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">ステータス</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">全て</option>
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">検索</label>
              <div className="relative">
                <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="名前・Staff ID"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={() => openCreateModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold
                         bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <i className="bi bi-plus-lg text-xs"></i>
              追加
            </button>
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
                <p className="text-sm">シフトデータがありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">日付</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">配布員</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Staff ID</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">支店</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">ステータス</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">メモ</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600 w-24">操作</th>
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
                        <td className="px-4 py-3">{getStatusBadge(shift.status)}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{shift.note || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(shift)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="編集"
                            >
                              <i className="bi bi-pencil text-xs"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(shift)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                              title="削除"
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

      {/* ==================== 日付モーダル（カレンダー日付クリック） ==================== */}
      {showDayModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1200] flex items-center justify-center p-4" onClick={() => setShowDayModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                <i className="bi bi-calendar-event mr-2 text-indigo-600"></i>
                {formatDate(dayModalDate)}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowDayModal(false); openCreateModal(dayModalDate); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <i className="bi bi-plus-lg text-[10px]"></i>
                  追加
                </button>
                <button onClick={() => setShowDayModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <i className="bi bi-x-lg text-sm"></i>
                </button>
              </div>
            </div>
            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto p-5">
              {dayModalShifts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <i className="bi bi-calendar-x text-2xl mb-2 block"></i>
                  <p className="text-sm">この日のシフトはありません</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dayModalShifts.map(shift => (
                    <div key={shift.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-800">{shift.distributor.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{shift.distributor.staffId}</span>
                          {getStatusBadge(shift.status)}
                        </div>
                        {shift.distributor.branch && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{shift.distributor.branch.nameJa}</div>
                        )}
                        {shift.note && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">{shift.note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setShowDayModal(false); openEditModal(shift); }}
                          className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-indigo-600 transition-colors"
                          title="編集"
                        >
                          <i className="bi bi-pencil text-xs"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(shift)}
                          className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-red-600 transition-colors"
                          title="削除"
                        >
                          <i className="bi bi-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 作成・編集モーダル ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                <i className={`bi ${editingShift ? 'bi-pencil' : 'bi-plus-circle'} mr-2 text-indigo-600`}></i>
                {editingShift ? 'シフト編集' : 'シフト追加'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <i className="bi bi-x-lg text-sm"></i>
              </button>
            </div>

            {/* フォーム */}
            <div className="p-5 space-y-4">
              {/* 配布員 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">配布員 <span className="text-red-500">*</span></label>
                {editingShift ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm font-medium">{selectedDistributor?.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">{selectedDistributor?.staffId}</span>
                  </div>
                ) : (
                  <div className="relative" ref={distributorSearchRef}>
                    {selectedDistributor ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
                        <span className="text-sm font-medium text-indigo-700">{selectedDistributor.name}</span>
                        <span className="text-[10px] font-mono text-indigo-400">{selectedDistributor.staffId}</span>
                        <button
                          onClick={() => { setSelectedDistributor(null); setFormDistributorId(''); setDistributorSearch(''); }}
                          className="ml-auto text-indigo-400 hover:text-indigo-600"
                        >
                          <i className="bi bi-x-lg text-xs"></i>
                        </button>
                      </div>
                    ) : (
                      <>
                        <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                          type="text"
                          value={distributorSearch}
                          onChange={e => setDistributorSearch(e.target.value)}
                          onFocus={() => { if (distributorOptions.length > 0) setShowDistributorDropdown(true); }}
                          placeholder="名前またはStaff IDで検索..."
                          className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </>
                    )}
                    {showDistributorDropdown && distributorOptions.length > 0 && !selectedDistributor && (
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
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">日付 <span className="text-red-500">*</span></label>
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">ステータス</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* メモ */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">メモ</label>
                <textarea
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  rows={2}
                  placeholder="メモ（任意）"
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
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={formSaving}
                className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {formSaving ? (
                  <span className="flex items-center gap-1.5">
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    保存中...
                  </span>
                ) : (
                  editingShift ? '更新' : '作成'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
