'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useNotification } from '@/components/ui/NotificationProvider';

type Distributor = {
  id: number;
  staffId: string;
  name: string;
};

type DailyExpense = {
  date: string;
  amount: number;
  description: string;
  status: string;
};

type PayrollItem = {
  id: number;
  date: string;
  scheduleId: number | null;
  flyerTypeCount: number;
  baseRate: number;
  areaUnitPrice: number;
  sizeUnitPrice: number;
  unitPrice: number;
  actualCount: number;
  earnedAmount: number;
};

type PayrollRecord = {
  id: number;
  distributorId: number;
  distributor: { id: number; staffId: string; name: string };
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  schedulePay: number;
  expensePay: number;
  grossPay: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID';
  note: string | null;
  items: PayrollItem[];
  expenses: DailyExpense[];
};

type ViewMode = 'week' | 'search';

function getSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  DRAFT:     { label: '下書き', color: 'bg-slate-100 text-slate-600',       icon: 'bi-pencil' },
  CONFIRMED: { label: '確定済', color: 'bg-amber-100 text-amber-700',      icon: 'bi-check-circle' },
  PAID:      { label: '支払済', color: 'bg-emerald-100 text-emerald-700',  icon: 'bi-check-circle-fill' },
};

interface FillExcelAlert {
  staffId: string;
  name: string;
  date: string;
  old: number;
  new: number;
  diff: number;
}

interface FillExcelResult {
  success: boolean;
  sheet: string;
  weekBlock: string;
  updated: number;
  newStaff: string[];
  alerts: FillExcelAlert[];
}

export default function DistributorPayrollPage() {
  const { showConfirm } = useNotification();
  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => getSunday(today));
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Record<number, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<number, boolean>>({});

  // 検索・フィルタ
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showWithDataOnly, setShowWithDataOnly] = useState(false);

  // 配布員検索モード
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [searchDistId, setSearchDistId] = useState<number | null>(null);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear());
  const [searchRecords, setSearchRecords] = useState<PayrollRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedSearchMonth, setExpandedSearchMonth] = useState<number | null>(null);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekLabel = `${formatDateJa(isoDate(weekStart))}（日）〜 ${formatDateJa(isoDate(weekEnd))}（土）`;
  const paymentDate = new Date(weekEnd);
  paymentDate.setDate(paymentDate.getDate() + 6);

  useEffect(() => {
    fetch('/api/distributors')
      .then((r) => r.json())
      .then((data) => setDistributors(Array.isArray(data) ? data : (data.distributors || [])));
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/distributor-payroll?weekStart=${isoDate(weekStart)}`);
    if (res.ok) {
      const data = await res.json();
      setRecords(data.records || []);
    }
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // 配布員個別の年間データ取得
  const fetchDistributorYear = useCallback(async (distId: number, year: number) => {
    setSearchLoading(true);
    setExpandedSearchMonth(null);
    try {
      const promises = Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/distributor-payroll?distributorId=${distId}&year=${year}&month=${i + 1}`)
          .then(r => r.ok ? r.json() : { records: [] })
          .then(j => j.records || [])
          .catch(() => [])
      );
      const results = await Promise.all(promises);
      const seen = new Set<number>();
      const all: PayrollRecord[] = [];
      for (const recs of results) {
        for (const rec of recs) {
          if (!seen.has(rec.id)) { seen.add(rec.id); all.push(rec); }
        }
      }
      setSearchRecords(all);
    } catch { /* ignore */ }
    setSearchLoading(false);
  }, []);

  const handleGenerate = async (distributorId: number) => {
    setGenerating((prev) => ({ ...prev, [distributorId]: true }));
    await fetch('/api/distributor-payroll/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distributorId, weekStart: isoDate(weekStart) }),
    });
    await fetchRecords();
    setGenerating((prev) => ({ ...prev, [distributorId]: false }));
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    for (const dist of filteredDistributors) {
      setGenerating((prev) => ({ ...prev, [dist.id]: true }));
      await fetch('/api/distributor-payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributorId: dist.id, weekStart: isoDate(weekStart) }),
      });
      setGenerating((prev) => ({ ...prev, [dist.id]: false }));
    }
    await fetchRecords();
    setGeneratingAll(false);
  };

  const handleStatusChange = async (recordId: number, status: string) => {
    setStatusUpdating((prev) => ({ ...prev, [recordId]: true }));
    await fetch(`/api/distributor-payroll/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await fetchRecords();
    setStatusUpdating((prev) => ({ ...prev, [recordId]: false }));
  };

  const handleDelete = async (recordId: number) => {
    if (!await showConfirm('この給与レコードを削除しますか？', { variant: 'danger', confirmLabel: '削除する' })) return;
    await fetch(`/api/distributor-payroll/${recordId}`, { method: 'DELETE' });
    await fetchRecords();
  };

  const recordMap = new Map(records.map((r) => [r.distributorId, r]));

  // フィルタ適用
  const filteredDistributors = useMemo(() => {
    let list = distributors;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.staffId.toLowerCase().includes(q));
    }
    if (showWithDataOnly) {
      list = list.filter(d => {
        const rec = recordMap.get(d.id);
        return rec && rec.grossPay > 0;
      });
    }
    if (statusFilter !== 'all') {
      list = list.filter(d => {
        const rec = recordMap.get(d.id);
        if (statusFilter === 'none') return !rec;
        return rec?.status === statusFilter;
      });
    }
    return list;
  }, [distributors, searchQuery, showWithDataOnly, statusFilter, recordMap]);

  const totalSchedulePay = records.reduce((s, r) => s + r.schedulePay, 0);
  const totalExpensePay  = records.reduce((s, r) => s + r.expensePay, 0);
  const totalGross       = records.reduce((s, r) => s + r.grossPay, 0);
  const paidCount = records.filter(r => r.status === 'PAID').length;
  const confirmedCount = records.filter(r => r.status === 'CONFIRMED').length;
  const draftCount = records.filter(r => r.status === 'DRAFT').length;

  function buildDailyRows(record: PayrollRecord) {
    return weekDays.map((day) => {
      const dayStr = isoDate(day);
      const scheduleEarned = record.items
        .filter((item) => item.date.startsWith(dayStr))
        .reduce((s, item) => s + item.earnedAmount, 0);
      const scheduleItems = record.items.filter((item) => item.date.startsWith(dayStr));
      const expenseAmount = record.expenses
        .filter((e) => e.date.startsWith(dayStr))
        .reduce((s, e) => s + e.amount, 0);
      const total = scheduleEarned + expenseAmount;
      return { day, dayStr, scheduleEarned, scheduleItems, expenseAmount, total };
    });
  }

  const [copied, setCopied] = useState(false);

  // Excel差し込み
  const excelFileRef = useRef<HTMLInputElement>(null);
  const [excelPassword, setExcelPassword] = useState('4566');
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResult, setExcelResult] = useState<FillExcelResult | null>(null);

  const handleFillExcel = async (file: File) => {
    setExcelUploading(true);
    setExcelResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('password', excelPassword);
      formData.append('weekStart', isoDate(weekStart));

      const res = await fetch('/api/distributor-payroll/fill-excel', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'エラー' }));
        alert(err.error || 'エラーが発生しました');
        setExcelUploading(false);
        return;
      }

      // Parse result from header
      const resultHeader = res.headers.get('X-Payroll-Result');
      let result: FillExcelResult | null = null;
      if (resultHeader) {
        try { result = JSON.parse(decodeURIComponent(resultHeader)); } catch { /* ignore */ }
      }
      setExcelResult(result);

      // Download the file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `給与入力済_${isoDate(weekStart)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'エラーが発生しました');
    }
    setExcelUploading(false);
  };

  /* ---- Excel貼り付け用TSVコピー ---- */
  const handleCopyForExcel = () => {
    // データありの配布員をスタッフコード順に
    const sorted = [...records]
      .filter(r => r.grossPay > 0)
      .sort((a, b) => a.distributor.staffId.localeCompare(b.distributor.staffId));
    if (sorted.length === 0) return;

    const tab = '\t';
    const lines: string[] = [];

    // Row 1: スタッフコード
    lines.push(['スタッフコード', ...sorted.map(r => r.distributor.staffId)].join(tab));
    // Row 2: 名前
    lines.push(['名前', ...sorted.map(r => r.distributor.name)].join(tab));

    // Daily rows
    weekDays.forEach((day) => {
      const dayStr = isoDate(day);
      const dayLabel = `${formatDateJa(dayStr)}（${DAY_LABELS[day.getDay()]}）`;
      const vals = sorted.map(r => {
        const earned = r.items.filter(it => it.date.startsWith(dayStr)).reduce((s, it) => s + it.earnedAmount, 0);
        return earned || 0;
      });
      lines.push([dayLabel, ...vals].join(tab));
    });

    // Summary rows
    lines.push(['配布報酬 小計', ...sorted.map(r => r.schedulePay)].join(tab));
    lines.push(['交通費', ...sorted.map(r => r.expensePay)].join(tab));
    lines.push(['総支給額', ...sorted.map(r => r.grossPay)].join(tab));
    lines.push(['ステータス', ...sorted.map(r => statusConfig[r.status]?.label || r.status)].join(tab));

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 配布員選択ドロップダウンの候補
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || viewMode !== 'search') return [];
    const q = searchQuery.toLowerCase();
    return distributors.filter(d => d.name.toLowerCase().includes(q) || d.staffId.toLowerCase().includes(q)).slice(0, 10);
  }, [distributors, searchQuery, viewMode]);

  const selectedDist = distributors.find(d => d.id === searchDistId);

  // 配布員検索モードの月別集計
  const searchMonthMap = useMemo(() => {
    const map = new Map<number, { records: PayrollRecord[]; totalSchedule: number; totalExpense: number; totalGross: number }>();
    for (const rec of searchRecords) {
      const m = new Date(rec.periodStart).getMonth() + 1;
      if (!map.has(m)) map.set(m, { records: [], totalSchedule: 0, totalExpense: 0, totalGross: 0 });
      const entry = map.get(m)!;
      entry.records.push(rec);
      entry.totalSchedule += rec.schedulePay;
      entry.totalExpense += rec.expensePay;
      entry.totalGross += rec.grossPay;
    }
    return map;
  }, [searchRecords]);

  const searchYearTotal = searchRecords.reduce((s, r) => s + r.grossPay, 0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">

      {/* ====== View Mode Toggle + Actions ====== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* View mode tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 shrink-0">
          <button onClick={() => setViewMode('week')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'week' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <i className="bi bi-calendar-week mr-1.5"></i>週次管理
          </button>
          <button onClick={() => setViewMode('search')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'search' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <i className="bi bi-person-lines-fill mr-1.5"></i>配布員別
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Link href="/distributors/payroll/statement"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors">
            <i className="bi bi-file-earmark-pdf text-emerald-600"></i>明細書
          </Link>
          <Link href="/distributors/payroll/import"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors">
            <i className="bi bi-upload text-slate-400"></i>取込
          </Link>
          {viewMode === 'week' && (
            <button
              onClick={() => setShowExcelModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-colors"
            >
              <i className="bi bi-file-earmark-excel text-emerald-600"></i>Excel差し込み
            </button>
          )}
          {viewMode === 'week' && (
            <button onClick={handleGenerateAll} disabled={generatingAll || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60">
              {generatingAll ? <><i className="bi bi-arrow-repeat animate-spin"></i>計算中...</> : <><i className="bi bi-calculator-fill"></i>全員一斉計算</>}
            </button>
          )}
        </div>
      </div>

      {/* ====== 週次管理モード ====== */}
      {viewMode === 'week' && (
        <>
          {/* Week navigation */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
            <button onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <i className="bi bi-chevron-left"></i>
            </button>
            <div className="text-center">
              <p className="font-bold text-sm text-slate-800">{weekLabel}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">支払日: {formatDateFull(isoDate(paymentDate))}（金）</p>
            </div>
            <button onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          {/* Summary cards */}
          {records.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">配布報酬</p>
                <p className="text-lg font-black text-indigo-600 mt-1">¥{totalSchedulePay.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">交通費</p>
                <p className="text-lg font-black text-emerald-600 mt-1">¥{totalExpensePay.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">総支給額</p>
                <p className="text-lg font-black text-slate-800 mt-1">¥{totalGross.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ステータス</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {draftCount > 0 && <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{draftCount} 下書き</span>}
                  {confirmedCount > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{confirmedCount} 確定</span>}
                  {paidCount > 0 && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{paidCount} 支払済</span>}
                </div>
              </div>
            </div>
          )}

          {/* Search & filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
              <input type="text" placeholder="名前 or スタッフID で検索..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              <option value="all">全ステータス</option>
              <option value="DRAFT">下書き</option>
              <option value="CONFIRMED">確定済</option>
              <option value="PAID">支払済</option>
              <option value="none">未計算</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input type="checkbox" checked={showWithDataOnly} onChange={e => setShowWithDataOnly(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              データありのみ
            </label>
            <span className="text-[10px] text-slate-400 ml-auto">{filteredDistributors.length}名 / {distributors.length}名</span>
          </div>

          {/* Distributor list */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {filteredDistributors.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {distributors.length === 0 ? '配布員が登録されていません' : '検索条件に一致する配布員がいません'}
                </div>
              ) : filteredDistributors.map((dist) => {
                const record = recordMap.get(dist.id);
                const isExpanded = expandedId === (record?.id ?? -1);
                const dailyRows = record ? buildDailyRows(record) : [];

                return (
                  <div key={dist.id}>
                    {/* Row */}
                    <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
                      {/* Avatar circle */}
                      <Link href={`/distributors/${dist.id}?tab=payroll`}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black shrink-0 hover:scale-105 transition-transform"
                        title="給与履歴を見る">
                        {dist.name.charAt(0)}
                      </Link>

                      {/* Name */}
                      <Link href={`/distributors/${dist.id}?tab=payroll`} className="flex-1 min-w-0 group">
                        <p className="text-[10px] text-slate-400 font-mono">{dist.staffId}</p>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{dist.name}</p>
                      </Link>

                      {generating[dist.id] && !record && (
                        <span className="text-[10px] text-indigo-500 flex items-center gap-1">
                          <i className="bi bi-arrow-repeat animate-spin"></i>計算中
                        </span>
                      )}

                      {record ? (
                        <>
                          {/* Amounts */}
                          <div className="hidden sm:flex items-center gap-4 text-right">
                            <div>
                              <p className="text-[10px] text-slate-400">配布</p>
                              <p className="text-xs font-bold text-indigo-600">¥{record.schedulePay.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">交通費</p>
                              <p className="text-xs font-bold text-emerald-600">¥{record.expensePay.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="text-right min-w-[70px]">
                            <p className="text-sm font-black text-slate-800">¥{record.grossPay.toLocaleString()}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${statusConfig[record.status].color}`}>
                            <i className={`bi ${statusConfig[record.status].icon} mr-0.5`}></i>
                            {statusConfig[record.status].label}
                          </span>
                          <button onClick={() => setExpandedId(isExpanded ? null : record.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                            <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-xs`}></i>
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleGenerate(dist.id)} disabled={generating[dist.id]}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors disabled:opacity-60 shrink-0">
                          {generating[dist.id] ? <><i className="bi bi-arrow-repeat animate-spin mr-1"></i>計算中</> : <><i className="bi bi-calculator mr-1"></i>計算</>}
                        </button>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {record && isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 space-y-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 pr-3 font-bold text-slate-500 w-20">日付</th>
                                <th className="text-right py-2 px-3 font-bold text-slate-500">配布内容</th>
                                <th className="text-right py-2 px-3 font-bold text-indigo-500 w-20">配布報酬</th>
                                <th className="text-right py-2 px-3 font-bold text-emerald-600 w-16">交通費</th>
                                <th className="text-right py-2 pl-3 font-bold text-slate-800 w-20">合計</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyRows.map(({ day, dayStr, scheduleEarned, scheduleItems, expenseAmount, total }) => {
                                const dayLabel = DAY_LABELS[day.getDay()];
                                const hasData = total > 0;
                                return (
                                  <tr key={dayStr} className={`border-b border-slate-100 ${hasData ? '' : 'opacity-30'}`}>
                                    <td className={`py-1.5 pr-3 font-bold text-[11px] ${day.getDay() === 0 ? 'text-rose-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-slate-600'}`}>
                                      {formatDateJa(dayStr)}（{dayLabel}）
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-slate-400 text-[10px]">
                                      {scheduleItems.length > 0
                                        ? scheduleItems.map((item) => `${item.flyerTypeCount}種×¥${item.unitPrice % 1 === 0 ? item.unitPrice.toFixed(0) : item.unitPrice.toFixed(2)} ${item.actualCount.toLocaleString()}枚`).join(' / ')
                                        : '—'}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-medium text-indigo-600">
                                      {scheduleEarned > 0 ? `¥${scheduleEarned.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-medium text-emerald-600">
                                      {expenseAmount > 0 ? `¥${expenseAmount.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="py-1.5 pl-3 text-right font-bold text-slate-700">
                                      {total > 0 ? `¥${total.toLocaleString()}` : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-300">
                                <td className="pt-2 pr-3 font-bold text-slate-500 text-[10px]">週計</td>
                                <td></td>
                                <td className="pt-2 px-3 text-right font-black text-indigo-600">¥{record.schedulePay.toLocaleString()}</td>
                                <td className="pt-2 px-3 text-right font-black text-emerald-600">¥{record.expensePay.toLocaleString()}</td>
                                <td className="pt-2 pl-3 text-right font-black text-slate-800">¥{record.grossPay.toLocaleString()}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                          {record.status === 'DRAFT' && (
                            <button onClick={() => handleStatusChange(record.id, 'CONFIRMED')} disabled={statusUpdating[record.id]}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors disabled:opacity-60">
                              <i className="bi bi-check-circle mr-1"></i>確定する
                            </button>
                          )}
                          {record.status === 'CONFIRMED' && (
                            <>
                              <button onClick={() => handleStatusChange(record.id, 'PAID')} disabled={statusUpdating[record.id]}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-colors disabled:opacity-60">
                                <i className="bi bi-cash-coin mr-1"></i>支払済にする
                              </button>
                              <button onClick={() => handleStatusChange(record.id, 'DRAFT')} disabled={statusUpdating[record.id]}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg transition-colors disabled:opacity-60">
                                下書きに戻す
                              </button>
                            </>
                          )}
                          <button onClick={() => handleGenerate(dist.id)} disabled={generating[dist.id]}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg transition-colors disabled:opacity-60">
                            <i className="bi bi-arrow-repeat mr-1"></i>再計算
                          </button>
                          <button onClick={() => handleDelete(record.id)}
                            className="px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg transition-colors">
                            <i className="bi bi-trash mr-1"></i>削除
                          </button>
                          <Link href={`/distributors/${dist.id}?tab=payroll`}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg transition-colors ml-auto">
                            <i className="bi bi-clock-history mr-1"></i>全履歴
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ====== 配布員別モード ====== */}
      {viewMode === 'search' && (
        <>
          {/* Distributor search */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500"><i className="bi bi-person-lines-fill mr-1.5"></i>配布員を選択して給与履歴を確認</p>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
              <input type="text" placeholder="名前 or スタッフID で検索..."
                value={searchQuery} onChange={e => { setSearchQuery(e.target.value); }}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              {/* Dropdown */}
              {searchSuggestions.length > 0 && !searchDistId && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-60 overflow-auto">
                  {searchSuggestions.map(d => (
                    <button key={d.id} onClick={() => { setSearchDistId(d.id); setSearchQuery(`${d.staffId} ${d.name}`); fetchDistributorYear(d.id, searchYear); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black shrink-0">
                        {d.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{d.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{d.staffId}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {searchDistId && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">選択中:</span>
                <span className="text-xs font-bold text-indigo-600">{selectedDist?.staffId} {selectedDist?.name}</span>
                <button onClick={() => { setSearchDistId(null); setSearchQuery(''); setSearchRecords([]); }}
                  className="text-xs text-slate-400 hover:text-rose-500 ml-1 transition-colors">
                  <i className="bi bi-x-circle"></i> 解除
                </button>
                <Link href={`/distributors/${searchDistId}`}
                  className="text-xs text-indigo-500 hover:text-indigo-700 ml-auto transition-colors">
                  <i className="bi bi-box-arrow-up-right mr-0.5"></i>詳細
                </Link>
              </div>
            )}
          </div>

          {/* Year-based results */}
          {searchDistId && (
            <>
              {/* Year nav */}
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                <button onClick={() => { const y = searchYear - 1; setSearchYear(y); fetchDistributorYear(searchDistId, y); }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                  <i className="bi bi-chevron-left"></i>
                </button>
                <span className="text-sm font-bold text-slate-800">{searchYear}年</span>
                <button onClick={() => { const y = searchYear + 1; setSearchYear(y); fetchDistributorYear(searchDistId, y); }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
                  disabled={searchYear >= new Date().getFullYear()}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>

              {searchLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : searchRecords.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <i className="bi bi-wallet2 text-4xl text-slate-200 block mb-2"></i>
                  <p className="text-sm text-slate-400">{searchYear}年の給与データはありません</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Year total */}
                  <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700">{searchYear}年 合計</span>
                    <span className="text-base font-black text-emerald-700">¥{searchYearTotal.toLocaleString()}</span>
                  </div>

                  {/* Month rows */}
                  <div className="divide-y divide-slate-100">
                    {Array.from(searchMonthMap.entries()).sort((a, b) => b[0] - a[0]).map(([month, data]) => (
                      <div key={month}>
                        <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => setExpandedSearchMonth(expandedSearchMonth === month ? null : month)}>
                          <div className="flex items-center gap-3">
                            <i className={`bi ${expandedSearchMonth === month ? 'bi-chevron-down' : 'bi-chevron-right'} text-slate-400 text-xs`}></i>
                            <span className="text-sm font-bold text-slate-700">{month}月</span>
                            <span className="text-[10px] text-slate-400">{data.records.length}週</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="hidden sm:inline text-xs text-slate-500">配布 <b className="text-indigo-600">¥{data.totalSchedule.toLocaleString()}</b></span>
                            <span className="hidden sm:inline text-xs text-slate-500">交通費 <b className="text-emerald-600">¥{data.totalExpense.toLocaleString()}</b></span>
                            <span className="text-sm font-black text-emerald-600 min-w-[80px] text-right">¥{data.totalGross.toLocaleString()}</span>
                          </div>
                        </div>

                        {expandedSearchMonth === month && (
                          <div className="bg-slate-50 border-t border-slate-200">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-4 py-2 text-left font-bold text-slate-500">期間</th>
                                  <th className="px-4 py-2 text-right font-bold text-slate-500">配布報酬</th>
                                  <th className="px-4 py-2 text-right font-bold text-slate-500">交通費</th>
                                  <th className="px-4 py-2 text-right font-bold text-slate-500">合計</th>
                                  <th className="px-4 py-2 text-center font-bold text-slate-500">状態</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {data.records.sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()).map(rec => {
                                  const ps = new Date(rec.periodStart);
                                  const pe = new Date(rec.periodEnd);
                                  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
                                  const st = statusConfig[rec.status] || statusConfig.DRAFT;
                                  return (
                                    <tr key={rec.id} className="hover:bg-white transition-colors">
                                      <td className="px-4 py-2.5 text-slate-600">{fmt(ps)}〜{fmt(pe)}</td>
                                      <td className="px-4 py-2.5 text-right font-medium text-indigo-600">¥{rec.schedulePay.toLocaleString()}</td>
                                      <td className="px-4 py-2.5 text-right font-medium text-emerald-600">¥{rec.expensePay.toLocaleString()}</td>
                                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">¥{rec.grossPay.toLocaleString()}</td>
                                      <td className="px-4 py-2.5 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                                          <i className={`bi ${st.icon} mr-0.5`}></i>{st.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!searchDistId && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <i className="bi bi-person-lines-fill text-4xl text-slate-200 block mb-3"></i>
              <p className="text-sm text-slate-400">上の検索欄から配布員を選択してください</p>
            </div>
          )}
        </>
      )}
      {/* ====== Excel差し込みモーダル ====== */}
      {showExcelModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={() => !excelUploading && setShowExcelModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-file-earmark-excel text-emerald-600"></i>
                Excel差し込み
              </h3>
              <button onClick={() => !excelUploading && setShowExcelModal(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-slate-500">
                給与管理Excelをアップロードすると、PMSの計算結果を該当週に差し込んで返します。
                金額が大きく変わった箇所は赤くハイライトされます。
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">対象週</label>
                <div className="text-sm font-bold text-slate-800">
                  {`${formatDateJa(isoDate(weekStart))}（${DAY_LABELS[weekStart.getDay()]}）〜 ${formatDateJa(isoDate(new Date(weekStart.getTime() + 6 * 86400000)))}（${DAY_LABELS[new Date(weekStart.getTime() + 6 * 86400000).getDay()]}）`}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Excelパスワード</label>
                <input
                  type="password"
                  value={excelPassword}
                  onChange={e => setExcelPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="パスワード"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Excelファイル</label>
                <input
                  ref={excelFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:px-3 file:py-1 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                />
              </div>
              <button
                onClick={() => {
                  const file = excelFileRef.current?.files?.[0];
                  if (!file) { alert('ファイルを選択してください'); return; }
                  if (!excelPassword) { alert('パスワードを入力してください'); return; }
                  handleFillExcel(file);
                }}
                disabled={excelUploading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {excelUploading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>処理中...</>
                ) : (
                  <><i className="bi bi-play-fill"></i>差し込み実行</>
                )}
              </button>

              {/* Result */}
              {excelResult && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                    <p className="text-sm font-bold text-emerald-700">
                      <i className="bi bi-check-circle-fill mr-1.5"></i>
                      {excelResult.updated}名のデータを差し込みました
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">シート: {excelResult.sheet} / {excelResult.weekBlock}</p>
                  </div>

                  {excelResult.newStaff.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                      <p className="text-xs font-bold text-blue-700 mb-1">
                        <i className="bi bi-person-plus-fill mr-1"></i>
                        新規追加（{excelResult.newStaff.length}名）
                      </p>
                      <p className="text-xs text-blue-600">{excelResult.newStaff.join(', ')}</p>
                    </div>
                  )}

                  {excelResult.alerts.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-xs font-bold text-red-700 mb-2">
                        <i className="bi bi-exclamation-triangle-fill mr-1"></i>
                        金額差異アラート（{excelResult.alerts.length}件）
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {excelResult.alerts.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-red-600 bg-white rounded px-2 py-1">
                            <span className="font-bold shrink-0">{a.staffId}</span>
                            <span className="truncate">{a.name}</span>
                            <span className="text-red-400 shrink-0">{a.date}</span>
                            <span className="ml-auto font-mono shrink-0">
                              ¥{a.old.toLocaleString()} → ¥{a.new.toLocaleString()}
                              <span className={a.diff > 0 ? 'text-emerald-600' : 'text-red-600'}>
                                ({a.diff > 0 ? '+' : ''}{a.diff.toLocaleString()})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {excelResult.alerts.length === 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-500">
                      <i className="bi bi-check2 mr-1"></i>金額差異なし
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
