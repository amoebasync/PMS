'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

// 指定日の週の日曜日を返す
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

const statusConfig = {
  DRAFT:     { label: '下書き',  color: 'bg-slate-100 text-slate-600' },
  CONFIRMED: { label: '確定済',  color: 'bg-amber-100 text-amber-700' },
  PAID:      { label: '支払済',  color: 'bg-emerald-100 text-emerald-700' },
};

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
  const [showStatement, setShowStatement] = useState(false);
  const [stmtDistId, setStmtDistId] = useState<number>(0);
  const [stmtYear, setStmtYear] = useState(today.getFullYear());
  const [stmtMonth, setStmtMonth] = useState<number | null>(today.getMonth() + 1);
  const [stmtLoading, setStmtLoading] = useState(false);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // 週の各日付を生成 (日〜土)
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

  // 全員一斉計算
  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    for (const dist of distributors) {
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

  const handleDownloadStatement = async () => {
    if (!stmtDistId) return;
    setStmtLoading(true);
    try {
      const params = new URLSearchParams({ distributorId: String(stmtDistId), year: String(stmtYear) });
      if (stmtMonth) params.set('month', String(stmtMonth));
      const res = await fetch(`/api/distributor-payroll/statement?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dist = distributors.find(d => d.id === stmtDistId);
      a.download = stmtMonth
        ? `支払明細書_${dist?.staffId || ''}_${stmtYear}年${stmtMonth}月.pdf`
        : `支払明細書_${dist?.staffId || ''}_${stmtYear}年度.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF生成に失敗しました');
    } finally {
      setStmtLoading(false);
    }
  };

  const recordMap = new Map(records.map((r) => [r.distributorId, r]));

  const totalSchedulePay = records.reduce((s, r) => s + r.schedulePay, 0);
  const totalExpensePay  = records.reduce((s, r) => s + r.expensePay, 0);
  const totalGross       = records.reduce((s, r) => s + r.grossPay, 0);

  // レコードの日別集計を生成
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Action buttons */}
      {distributors.length > 0 && (
        <div className="flex justify-end gap-3 mb-4">
          <button
            onClick={() => setShowStatement(!showStatement)}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold rounded-xl transition-colors"
          >
            <i className="bi bi-file-earmark-pdf"></i>支払明細書
          </button>
          <a
            href="/distributors/payroll/import"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
          >
            <i className="bi bi-file-earmark-arrow-up"></i>過去データ取込
          </a>
          <button
            onClick={handleGenerateAll}
            disabled={generatingAll || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60"
          >
            {generatingAll ? (
              <><i className="bi bi-arrow-repeat animate-spin"></i>計算中...</>
            ) : (
              <><i className="bi bi-calculator-fill"></i>全員一斉計算</>
            )}
          </button>
        </div>
      )}

      {/* 支払明細書パネル */}
      {showStatement && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <i className="bi bi-file-earmark-pdf text-emerald-600"></i>支払明細書ダウンロード
            </h3>
            <button onClick={() => setShowStatement(false)} className="text-slate-400 hover:text-slate-600">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">配布員</label>
              <select
                value={stmtDistId}
                onChange={e => setStmtDistId(parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value={0}>選択してください</option>
                {distributors.map(d => (
                  <option key={d.id} value={d.id}>{d.staffId} - {d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">年</label>
              <select
                value={stmtYear}
                onChange={e => setStmtYear(parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">月（空欄=年間）</label>
              <select
                value={stmtMonth ?? ''}
                onChange={e => setStmtMonth(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">年間</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleDownloadStatement}
                disabled={!stmtDistId || stmtLoading}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {stmtLoading ? (
                  <><i className="bi bi-hourglass-split animate-spin"></i>生成中...</>
                ) : (
                  <><i className="bi bi-download"></i>PDFダウンロード</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
        <button
          onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        <div className="text-center">
          <p className="font-bold text-slate-800">{weekLabel}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            支払日: {formatDateFull(isoDate(paymentDate))}（金）
          </p>
        </div>
        <button
          onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>

      {/* Summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '配布報酬合計', value: totalSchedulePay, color: 'text-indigo-600' },
            { label: '交通費合計',   value: totalExpensePay,  color: 'text-emerald-600' },
            { label: '総支給合計',   value: totalGross,       color: 'text-slate-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>¥{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Distributor list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {distributors.map((dist) => {
            const record = recordMap.get(dist.id);
            const isExpanded = expandedId === (record?.id ?? -1);
            const dailyRows = record ? buildDailyRows(record) : [];

            return (
              <div key={dist.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Row header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400">{dist.staffId}</p>
                    <p className="font-bold text-slate-800">{dist.name}</p>
                  </div>

                  {generating[dist.id] && !record && (
                    <span className="text-xs text-indigo-500 flex items-center gap-1">
                      <i className="bi bi-arrow-repeat animate-spin"></i>計算中
                    </span>
                  )}

                  {record ? (
                    <>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          配布 ¥{record.schedulePay.toLocaleString()} ＋ 交通費 ¥{record.expensePay.toLocaleString()}
                        </p>
                        <p className="text-lg font-black text-slate-800">¥{record.grossPay.toLocaleString()}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusConfig[record.status].color}`}>
                        {statusConfig[record.status].label}
                      </span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleGenerate(dist.id)}
                      disabled={generating[dist.id]}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                    >
                      {generating[dist.id] ? (
                        <><i className="bi bi-arrow-repeat animate-spin mr-1"></i>計算中</>
                      ) : (
                        <><i className="bi bi-calculator mr-1"></i>計算</>
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded detail */}
                {record && isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-4">

                    {/* 日別明細テーブル */}
                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2">日別明細</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left py-2 pr-3 font-bold text-slate-500 w-16">日付</th>
                              <th className="text-right py-2 px-3 font-bold text-slate-500">配布内容</th>
                              <th className="text-right py-2 px-3 font-bold text-indigo-500">配布報酬</th>
                              <th className="text-right py-2 px-3 font-bold text-emerald-600">交通費</th>
                              <th className="text-right py-2 pl-3 font-bold text-slate-800">合計</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyRows.map(({ day, dayStr, scheduleEarned, scheduleItems, expenseAmount, total }) => {
                              const dayLabel = DAY_LABELS[day.getDay()];
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                              const hasData = total > 0;
                              return (
                                <tr
                                  key={dayStr}
                                  className={`border-b border-slate-50 ${hasData ? '' : 'opacity-40'}`}
                                >
                                  <td className={`py-2 pr-3 font-bold ${day.getDay() === 0 ? 'text-rose-500' : day.getDay() === 6 ? 'text-blue-500' : 'text-slate-700'}`}>
                                    {formatDateJa(dayStr)}（{dayLabel}）
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-500">
                                    {scheduleItems.length > 0
                                      ? scheduleItems.map((item) =>
                                          `${item.flyerTypeCount}種×¥${item.unitPrice.toFixed(1)} ${item.actualCount.toLocaleString()}投`
                                        ).join(' / ')
                                      : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-medium text-indigo-600">
                                    {scheduleEarned > 0 ? `¥${scheduleEarned.toLocaleString()}` : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-medium text-emerald-600">
                                    {expenseAmount > 0 ? `¥${expenseAmount.toLocaleString()}` : '—'}
                                  </td>
                                  <td className="py-2 pl-3 text-right font-bold text-slate-800">
                                    {total > 0 ? `¥${total.toLocaleString()}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-200">
                              <td className="pt-2 pr-3 font-bold text-slate-600 text-xs">週計</td>
                              <td></td>
                              <td className="pt-2 px-3 text-right font-black text-indigo-600">¥{record.schedulePay.toLocaleString()}</td>
                              <td className="pt-2 px-3 text-right font-black text-emerald-600">¥{record.expensePay.toLocaleString()}</td>
                              <td className="pt-2 pl-3 text-right font-black text-slate-800">¥{record.grossPay.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {record.status === 'DRAFT' && (
                        <button
                          onClick={() => handleStatusChange(record.id, 'CONFIRMED')}
                          disabled={statusUpdating[record.id]}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                        >
                          <i className="bi bi-check-circle mr-1"></i>確定する
                        </button>
                      )}
                      {record.status === 'CONFIRMED' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(record.id, 'PAID')}
                            disabled={statusUpdating[record.id]}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                          >
                            <i className="bi bi-cash-coin mr-1"></i>支払済にする
                          </button>
                          <button
                            onClick={() => handleStatusChange(record.id, 'DRAFT')}
                            disabled={statusUpdating[record.id]}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                          >
                            下書きに戻す
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleGenerate(dist.id)}
                        disabled={generating[dist.id]}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
                      >
                        <i className="bi bi-arrow-repeat mr-1"></i>再計算
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-colors"
                      >
                        <i className="bi bi-trash mr-1"></i>削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {distributors.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">配布員が登録されていません</div>
          )}
        </div>
      )}
    </div>
  );
}
