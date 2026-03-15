'use client';

import React, { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';

type DailyEarning = { date: string; amount: number };

type WeekData = {
  periodStart: string;
  periodEnd: string;
  dailyEarnings: DailyEarning[];
  schedulePay: number;
  expensePay: number;
  grossPay: number;
  deductions: Record<string, number>;
};

type ParsedDistributor = {
  staffId: string;
  name: string;
  weeks: WeekData[];
  totalGross: number;
  dbMatch: boolean | null; // null = not checked yet
};

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: { staffId: string; week?: string; message: string }[];
};

// 日付パターン: MM/DD(曜) or M/D(曜)
const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\([日月火水木金土]\)$/;

// 値を数値に変換: 空→0, #N/A→0, カンマ除去, マイナス対応
function parseValue(val: string): number {
  if (!val || val.trim() === '' || val === '#N/A' || val === '-' || val === '—') return 0;
  const cleaned = val.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

// 年と MM/DD から ISO date 文字列を生成
function toISODate(year: number, monthDay: string): string {
  const match = monthDay.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!match) return '';
  const m = parseInt(match[1]);
  const d = parseInt(match[2]);
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 指定日の曜日を取得（0=日, 6=土）
function getDayOfWeek(isoDate: string): number {
  return new Date(isoDate).getDay();
}

// 日曜日を起点に週の開始・終了を計算
function getWeekRange(isoDate: string): { start: string; end: string } {
  const d = new Date(isoDate);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(sunday.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(saturday.getDate() + 6);
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return { start: fmt(sunday), end: fmt(saturday) };
}

// 控除項目ラベル一覧（順序通り）
const DEDUCTION_LABELS = [
  '差額', '日払い', '交通費', '罰金', '備品代', '前借', '振込手数料',
  'システム', '寮費', '寮費調整', '金（中継等）', '税金', 'バイク', 'バイク2',
];

function parseClipboardData(text: string, year: number): ParsedDistributor[] {
  const lines = text.split('\n').map((line) => line.split('\t'));
  if (lines.length < 3) return [];

  // 行1: staffId（A列はラベル）
  const staffIdRow = lines[0];
  // 行2: 名前
  const nameRow = lines[1];

  // 配布員数 = 列数 - 1（A列がラベル）
  const numDistributors = Math.max(staffIdRow.length - 1, 0);
  if (numDistributors === 0) return [];

  // 配布員ごとの結果を初期化
  const distributors: ParsedDistributor[] = [];
  for (let col = 1; col <= numDistributors; col++) {
    const staffId = (staffIdRow[col] || '').trim();
    const name = (nameRow[col] || '').trim();
    if (!staffId) continue;
    distributors.push({
      staffId,
      name,
      weeks: [],
      totalGross: 0,
      dbMatch: null,
    });
  }

  if (distributors.length === 0) return [];

  // 行3以降をパース: 週ブロックを検出
  // 各配布員について、現在の週のデータを追跡
  type WeekBuilder = {
    dailyEarnings: DailyEarning[];
    schedulePay: number;
    expensePay: number;
    grossPay: number;
    deductions: Record<string, number>;
    firstDate: string | null;
    subtotalCount: number;
  };

  const currentWeeks: WeekBuilder[] = distributors.map(() => ({
    dailyEarnings: [],
    schedulePay: 0,
    expensePay: 0,
    grossPay: 0,
    deductions: {},
    firstDate: null,
    subtotalCount: 0,
  }));

  const finalizeWeek = (distIdx: number) => {
    const w = currentWeeks[distIdx];
    if (!w.firstDate) return;
    const { start, end } = getWeekRange(w.firstDate);
    // 小計・合計行がない場合は日別合計から算出
    const dailyTotal = w.dailyEarnings.reduce((s, d) => s + d.amount, 0);
    const schedulePay = w.schedulePay || dailyTotal;
    const grossPay = w.grossPay || (dailyTotal + w.expensePay);
    distributors[distIdx].weeks.push({
      periodStart: start,
      periodEnd: end,
      dailyEarnings: [...w.dailyEarnings],
      schedulePay,
      expensePay: w.expensePay,
      grossPay,
      deductions: { ...w.deductions },
    });
    // reset
    currentWeeks[distIdx] = {
      dailyEarnings: [],
      schedulePay: 0,
      expensePay: 0,
      grossPay: 0,
      deductions: {},
      firstDate: null,
      subtotalCount: 0,
    };
  };

  for (let row = 2; row < lines.length; row++) {
    const cells = lines[row];
    const label = (cells[0] || '').trim();
    if (!label) continue;

    // 日付行の判定
    const dateMatch = label.match(DATE_PATTERN);
    if (dateMatch) {
      const isoDate = toISODate(year, label);
      if (!isoDate) continue;

      for (let i = 0; i < distributors.length; i++) {
        const colIdx = i + 1;
        const amount = parseValue(cells[colIdx] || '');
        // 新しい週ブロックの開始を検出（日曜日の場合）
        const dayOfWeek = getDayOfWeek(isoDate);
        if (dayOfWeek === 0 && currentWeeks[i].firstDate) {
          // 前の週を確定
          finalizeWeek(i);
        }
        if (!currentWeeks[i].firstDate) {
          currentWeeks[i].firstDate = isoDate;
        }
        currentWeeks[i].dailyEarnings.push({ date: isoDate, amount });
      }
      continue;
    }

    // 「小計」行
    if (label === '小計') {
      for (let i = 0; i < distributors.length; i++) {
        const colIdx = i + 1;
        const val = parseValue(cells[colIdx] || '');
        currentWeeks[i].subtotalCount++;
        // 最初の小計 = schedulePay
        if (currentWeeks[i].subtotalCount === 1) {
          currentWeeks[i].schedulePay = val;
        }
      }
      continue;
    }

    // 「合計」行 → 週ブロック終端
    if (label === '合計') {
      for (let i = 0; i < distributors.length; i++) {
        const colIdx = i + 1;
        currentWeeks[i].grossPay = parseValue(cells[colIdx] || '');
        finalizeWeek(i);
      }
      continue;
    }

    // 「交通費」行
    if (label === '交通費') {
      for (let i = 0; i < distributors.length; i++) {
        const colIdx = i + 1;
        currentWeeks[i].expensePay = parseValue(cells[colIdx] || '');
      }
      continue;
    }

    // その他のラベル → 控除項目として記録
    if (DEDUCTION_LABELS.includes(label) || currentWeeks[0]?.subtotalCount >= 1) {
      // 小計以降のラベル行は控除項目として扱う（交通費・合計は上で処理済み）
      if (label !== '交通費' && label !== '合計' && label !== '小計') {
        for (let i = 0; i < distributors.length; i++) {
          const colIdx = i + 1;
          const val = parseValue(cells[colIdx] || '');
          if (val !== 0) {
            currentWeeks[i].deductions[label] = val;
          }
        }
      }
    }
  }

  // 未確定の週を確定
  for (let i = 0; i < distributors.length; i++) {
    if (currentWeeks[i].firstDate) {
      finalizeWeek(i);
    }
  }

  // 合計を計算
  for (const dist of distributors) {
    dist.totalGross = dist.weeks.reduce((s, w) => s + w.grossPay, 0);
  }

  return distributors;
}

export default function DistributorPayrollImportPage() {
  const { t } = useTranslation('distributor-payroll-import');
  const { showToast } = useNotification();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedDistributor[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleParse = useCallback(async () => {
    try {
      const data = parseClipboardData(rawText, year);
      if (data.length === 0) {
        showToast(t('no_valid_data'), 'error');
        return;
      }

      // DB照合: staffId で配布員を検索
      const staffIds = data.map((d) => d.staffId);
      const res = await fetch('/api/distributors?' + new URLSearchParams({ staffIds: staffIds.join(',') }));
      if (res.ok) {
        const json = await res.json();
        const dbStaffIds = new Set(
          (Array.isArray(json) ? json : json.distributors || []).map((d: any) => d.staffId)
        );
        for (const d of data) {
          d.dbMatch = dbStaffIds.has(d.staffId);
        }
      }

      setParsed(data);
      setResult(null);
    } catch {
      showToast(t('parse_error'), 'error');
    }
  }, [rawText, year, showToast, t]);

  const handleImport = useCallback(async () => {
    const validRecords = parsed.filter((d) => d.dbMatch === true && d.weeks.length > 0);
    if (validRecords.length === 0) {
      showToast(t('no_valid_data'), 'error');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/distributor-payroll/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: validRecords.map((d) => ({
            staffId: d.staffId,
            weeks: d.weeks,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        showToast(t('import_success'), 'success');
      } else {
        showToast(data.error || t('import_error'), 'error');
      }
    } catch {
      showToast(t('import_error'), 'error');
    } finally {
      setImporting(false);
    }
  }, [parsed, showToast, t]);

  const handleClear = () => {
    setRawText('');
    setParsed([]);
    setResult(null);
    setExpandedIdx(null);
  };

  const matchedCount = parsed.filter((d) => d.dbMatch === true).length;
  const unmatchedCount = parsed.filter((d) => d.dbMatch === false).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800">{t('page_title')}</h1>
        <a
          href="/distributors/payroll"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <i className="bi bi-arrow-left"></i>
          {t('back_to_payroll')}
        </a>
      </div>

      {/* Year selector + paste area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-bold text-slate-600">{t('year_label')}</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-600 mb-2">{t('paste_label')}</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={t('paste_placeholder')}
            rows={8}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40"
          >
            <i className="bi bi-file-earmark-spreadsheet"></i>
            {t('btn_parse')}
          </button>
          <button
            onClick={handleClear}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors"
          >
            {t('btn_clear')}
          </button>
        </div>
      </div>

      {/* Import result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <h3 className="text-sm font-black text-emerald-800 mb-3">{t('result_title')}</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: t('result_imported'), value: result.imported, color: 'text-emerald-700' },
              { label: t('result_updated'), value: result.updated, color: 'text-amber-700' },
              { label: t('result_skipped'), value: result.skipped, color: 'text-slate-500' },
              { label: t('result_errors'), value: result.errors.length, color: 'text-rose-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl font-black ${color}`}>{value}{t('result_unit')}</p>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-rose-600">
                  <span className="font-bold">{err.staffId}</span>
                  {err.week && <span className="ml-1">({err.week})</span>}
                  : {err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {parsed.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-700">
              {t('preview_title')} ({parsed.length}
              {matchedCount > 0 && <span className="text-emerald-600 ml-2">DB: {matchedCount}</span>}
              {unmatchedCount > 0 && <span className="text-rose-500 ml-2">{t('preview_not_found')}: {unmatchedCount}</span>}
              )
            </h2>
            <button
              onClick={handleImport}
              disabled={importing || matchedCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40"
            >
              {importing ? (
                <><i className="bi bi-arrow-repeat animate-spin"></i>{t('btn_importing')}</>
              ) : (
                <><i className="bi bi-database-fill-add"></i>{t('btn_import')}</>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {parsed.map((dist, idx) => {
              const isExpanded = expandedIdx === idx;
              return (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl border overflow-hidden ${
                    dist.dbMatch === false ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'
                  }`}
                >
                  {/* Row header */}
                  <div
                    className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400">{dist.staffId}</p>
                      <p className="font-bold text-slate-800 text-sm">{dist.name}</p>
                    </div>
                    <div>
                      {dist.dbMatch === true && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          <i className="bi bi-check-circle mr-1"></i>{t('preview_matched')}
                        </span>
                      )}
                      {dist.dbMatch === false && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-600">
                          <i className="bi bi-x-circle mr-1"></i>{t('preview_not_found')}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{dist.weeks.length} {t('preview_weeks')}</p>
                      <p className="text-lg font-black text-slate-800">
                        ¥{dist.totalGross.toLocaleString()}
                      </p>
                    </div>
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-400`}></i>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                      {dist.weeks.map((week, wIdx) => (
                        <div key={wIdx} className="bg-slate-50 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-slate-600">
                              {t('week_label', { week: wIdx + 1 })}:
                              {' '}{week.periodStart} ~ {week.periodEnd}
                            </p>
                            <p className="text-sm font-black text-slate-800">¥{week.grossPay.toLocaleString()}</p>
                          </div>

                          {/* Daily earnings */}
                          <div className="mb-2">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">{t('daily_earnings')}</p>
                            <div className="flex flex-wrap gap-1">
                              {week.dailyEarnings.map((d, dIdx) => (
                                <span
                                  key={dIdx}
                                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    d.amount > 0
                                      ? 'bg-indigo-100 text-indigo-700 font-bold'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {d.date.slice(5)} : ¥{d.amount.toLocaleString()}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Summary row */}
                          <div className="flex gap-4 text-[10px]">
                            <span className="text-indigo-600 font-bold">
                              配布: ¥{week.schedulePay.toLocaleString()}
                            </span>
                            <span className="text-emerald-600 font-bold">
                              交通費: ¥{week.expensePay.toLocaleString()}
                            </span>
                          </div>

                          {/* Deductions */}
                          {Object.keys(week.deductions).length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] font-bold text-slate-400 mb-1">{t('deductions_label')}</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(week.deductions).map(([key, val]) => (
                                  <span
                                    key={key}
                                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      val < 0
                                        ? 'bg-rose-50 text-rose-600'
                                        : val > 0
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    {key}: ¥{val.toLocaleString()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {parsed.length === 0 && !result && (
        <div className="text-center py-12 text-slate-400 text-sm">
          {t('preview_no_data')}
        </div>
      )}
    </div>
  );
}
