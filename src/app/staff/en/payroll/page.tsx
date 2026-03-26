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
  DRAFT:     { label: 'Processing', color: 'bg-slate-100 text-slate-500' },
  CONFIRMED: { label: 'Confirmed',  color: 'bg-amber-100 text-amber-700' },
  PAID:      { label: 'Paid',       color: 'bg-emerald-100 text-emerald-700' },
};

function formatDateEn(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export default function StaffPayrollPageEn() {
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

  const [downloading, setDownloading] = useState(false);

  const handleDownloadStatement = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/distributor-payroll/statement?distributorId=me&year=${year}&month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payslip_${year}_${String(month).padStart(2, '0')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* silent */ }
    setDownloading(false);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Payment History</h1>
          <p className="text-xs text-slate-500 mt-1">Weekly pay and transportation expense history</p>
        </div>
        <button onClick={handleDownloadStatement} disabled={downloading || records.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors">
          {downloading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="bi bi-file-earmark-pdf"></i>}
          Pay Slip
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <button onClick={prevMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-left text-lg"></i>
        </button>
        <span className="font-bold text-slate-700 text-sm">{monthLabel}</span>
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
          No pay records found for this period
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
                      {formatDateEn(record.periodStart)} – {formatDateEn(record.periodEnd)}
                      　Pay: {formatDateEn(record.paymentDate)}
                    </p>
                    <p className="text-xl font-black text-slate-800 mt-0.5">
                      ¥{record.grossPay.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Delivery ¥{record.schedulePay.toLocaleString()} + Expenses ¥{record.expensePay.toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusConfig[record.status].color}`}>
                    {statusConfig[record.status].label}
                  </span>
                  <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-300`}></i>
                </button>

                {isExpanded && record.items.length > 0 && (
                  <div className="border-t border-slate-50 px-5 py-3">
                    <p className="text-[11px] font-bold text-slate-400 mb-2">Delivery Breakdown</p>
                    <div className="space-y-2">
                      {record.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{formatDateEn(item.date)}</span>
                          <span className="text-slate-500">{item.flyerTypeCount} type(s) × ¥{item.unitPrice % 1 === 0 ? item.unitPrice : item.unitPrice.toFixed(2)}</span>
                          <span className="text-slate-600">{item.actualCount.toLocaleString()} posts</span>
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
