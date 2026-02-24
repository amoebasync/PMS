'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

type Distributor = {
  id: number;
  staffId: string;
  name: string;
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

// 指定日の週の日曜日を返す
function getSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const statusConfig = {
  DRAFT:     { label: '下書き',  color: 'bg-slate-100 text-slate-600' },
  CONFIRMED: { label: '確定済',  color: 'bg-amber-100 text-amber-700' },
  PAID:      { label: '支払済',  color: 'bg-emerald-100 text-emerald-700' },
};

export default function DistributorPayrollPage() {
  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => getSunday(today));
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Record<number, boolean>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<number, boolean>>({});

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekLabel = `${formatDateJa(isoDate(weekStart))}（日）〜 ${formatDateJa(isoDate(weekEnd))}（土）`;

  // 配布員一覧
  useEffect(() => {
    fetch('/api/distributors?limit=500')
      .then((r) => r.json())
      .then((data) => setDistributors(data.distributors || []));
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
    if (!confirm('この給与レコードを削除しますか？')) return;
    await fetch(`/api/distributor-payroll/${recordId}`, { method: 'DELETE' });
    await fetchRecords();
  };

  // 配布員ごとにレコードをマップ
  const recordMap = new Map(records.map((r) => [r.distributorId, r]));

  // 生成済み合計
  const totalSchedulePay = records.reduce((s, r) => s + r.schedulePay, 0);
  const totalExpensePay = records.reduce((s, r) => s + r.expensePay, 0);
  const totalGross = records.reduce((s, r) => s + r.grossPay, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/distributors" className="hover:text-indigo-600">配布員管理</Link>
            <i className="bi bi-chevron-right text-xs"></i>
            <span>給与管理</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">配布員 給与管理</h1>
        </div>
      </div>

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
            支払日: {formatDateFull(isoDate((() => { const d = new Date(weekEnd); d.setDate(d.getDate() + 6); return d; })()))}（金）
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
            { label: '配布報酬', value: totalSchedulePay, color: 'text-indigo-600' },
            { label: '交通費',   value: totalExpensePay,  color: 'text-emerald-600' },
            { label: '合計支給', value: totalGross,       color: 'text-slate-800' },
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
            const isExpanded = expandedId === (record?.id ?? null);

            return (
              <div key={dist.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400">{dist.staffId}</p>
                    <p className="font-bold text-slate-800">{dist.name}</p>
                  </div>

                  {/* Record info */}
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
                        className="text-slate-400 hover:text-slate-700 transition-colors"
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
                    {/* Line items */}
                    {record.items.length > 0 ? (
                      <div>
                        <p className="text-xs font-bold text-slate-500 mb-2">配布明細</p>
                        <div className="space-y-1.5">
                          {record.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 text-xs">
                              <span className="text-slate-500 w-12 shrink-0">{formatDateJa(item.date)}</span>
                              <span className="text-slate-500">{item.flyerTypeCount}種 × ¥{item.unitPrice.toFixed(1)}/post</span>
                              <span className="text-slate-600 font-medium">{item.actualCount.toLocaleString()}ポスト</span>
                              <span className="ml-auto font-bold text-slate-800">¥{item.earnedAmount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">投函数が入力されているスケジュールがありません</p>
                    )}

                    {/* Expense pay */}
                    {record.expensePay > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">交通費合計</span>
                        <span className="font-bold text-emerald-600">¥{record.expensePay.toLocaleString()}</span>
                      </div>
                    )}

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
