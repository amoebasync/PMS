'use client';

import React, { useEffect, useState, useCallback } from 'react';

type PayrollItem = {
  id: number;
  date: string;
  flyerTypeCount: number;
  unitPrice: number;
  actualCount: number;
  earnedAmount: number;
};

type PayrollRecord = {
  id: number;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  schedulePay: number;
  expensePay: number;
  grossPay: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID';
  items: PayrollItem[];
};

const statusConfig = {
  DRAFT:     { label: '計算中',  color: 'bg-slate-100 text-slate-500' },
  CONFIRMED: { label: '確定済',  color: 'bg-amber-100 text-amber-700' },
  PAID:      { label: '支払済',  color: 'bg-emerald-100 text-emerald-700' },
};

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function StaffPayrollPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/staff/payroll?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setRecords(data.records || []);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-800">給与履歴</h1>
        <p className="text-xs text-slate-500 mt-1">週ごとの配布報酬・交通費の支払い履歴です</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <button onClick={prevMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-left text-lg"></i>
        </button>
        <span className="font-bold text-slate-700 text-sm">{year}年{month}月</span>
        <button onClick={nextMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-right text-lg"></i>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
          この期間の給与データはありません
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const isExpanded = expandedId === record.id;
            return (
              <div key={record.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">
                      {formatDateJa(record.periodStart)}〜{formatDateJa(record.periodEnd)}
                      　支払: {formatDateJa(record.paymentDate)}
                    </p>
                    <p className="text-xl font-black text-slate-800 mt-0.5">
                      ¥{record.grossPay.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      配布 ¥{record.schedulePay.toLocaleString()} ＋ 交通費 ¥{record.expensePay.toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusConfig[record.status].color}`}>
                    {statusConfig[record.status].label}
                  </span>
                  <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-300`}></i>
                </button>

                {isExpanded && record.items.length > 0 && (
                  <div className="border-t border-slate-50 px-5 py-3">
                    <p className="text-[11px] font-bold text-slate-400 mb-2">配布明細</p>
                    <div className="space-y-2">
                      {record.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{formatDateJa(item.date)}</span>
                          <span className="text-slate-500">{item.flyerTypeCount}種 × ¥{item.unitPrice.toFixed(1)}</span>
                          <span className="text-slate-600">{item.actualCount.toLocaleString()}ポスト</span>
                          <span className="font-bold text-slate-800">¥{item.earnedAmount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
