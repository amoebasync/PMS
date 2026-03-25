'use client';

import React, { useEffect, useState } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';

type Expense = {
  id: number;
  date: string;
  amount: number;
  description: string;
  status: string;
};

const statusColor: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
};
const statusLabel: Record<string, string> = {
  PENDING:  'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export default function ExpensesPageEn() {
  const { showConfirm } = useNotification();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', amount: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Set<string>>(new Set());
  const [expenseMap, setExpenseMap] = useState<Record<string, string>>({});
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const fetchExpenses = async () => {
    setLoading(true);
    const res = await fetch('/api/staff/expenses');
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses || []);
      if (data.calendarData) {
        setScheduleDates(new Set(data.calendarData.scheduleDates || []));
        setExpenseMap(data.calendarData.expenseMap || {});
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const amt = parseInt(form.amount);
    if (isNaN(amt) || amt <= 0) {
      setMessage({ type: 'error', text: 'Amount must be at least ¥1.' });
      setSubmitting(false);
      return;
    }

    const res = await fetch('/api/staff/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        amount: amt,
        description: form.description,
      }),
    });
    const data = await res.json();

    if (res.ok) {
      setMessage({ type: 'success', text: 'Expense submitted successfully.' });
      setForm({ date: '', amount: '', description: '' });
      setShowForm(false);
      fetchExpenses();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to submit.' });
    }
    setSubmitting(false);
  };

  const handleCancel = async (id: number) => {
    if (!await showConfirm('Cancel this expense request?', { variant: 'danger', confirmLabel: 'Cancel' })) return;
    setMessage(null);
    const res = await fetch(`/api/staff/expenses/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: 'Request canceled.' });
      fetchExpenses();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to cancel.' });
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Transportation Expense</h1>
          <p className="text-xs text-slate-500 mt-1">Showing latest 50 records</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors text-sm"
        >
          <i className={`bi ${showForm ? 'bi-x-lg' : 'bi-plus-lg'}`}></i>
          {showForm ? 'Close' : 'New Request'}
        </button>
      </div>

      {/* Transportation expense rules */}
      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
        <div className="flex items-start gap-2.5">
          <i className="bi bi-info-circle-fill text-sky-500 mt-0.5 shrink-0"></i>
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-sky-800">Expense Rules</p>
            <ul className="text-xs text-sky-700 space-y-1 leading-relaxed">
              <li>- Daily limit: <span className="font-bold">¥1,000</span></li>
              <li>- Deadline: <span className="font-bold">Next Monday 15:00</span></li>
              <li>- If you miss the deadline, the company will calculate the amount based on your registered address</li>
            </ul>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm font-bold ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {message.type === 'success'
            ? <i className="bi bi-check-circle-fill mr-2"></i>
            : <i className="bi bi-exclamation-triangle-fill mr-2"></i>}
          {message.text}
        </div>
      )}

      {/* New expense form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-slate-800">New Expense Request</h2>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">Date</label>
            {/* Calendar */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                  className="w-7 h-7 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500"><i className="bi bi-chevron-left text-xs"></i></button>
                <span className="text-sm font-bold text-slate-700">{calMonth.getFullYear()}/{String(calMonth.getMonth() + 1).padStart(2, '0')}</span>
                <button type="button" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                  className="w-7 h-7 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500"><i className="bi bi-chevron-right text-xs"></i></button>
              </div>
              <div className="grid grid-cols-7 text-center text-[10px] text-slate-400 font-bold mb-1">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {(() => {
                  const year = calMonth.getFullYear(), month = calMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells = [];
                  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`}></div>);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const hasSchedule = scheduleDates.has(dateStr);
                    const expenseStatus = expenseMap[dateStr];
                    const isSelected = form.date === dateStr;
                    const isFuture = dateStr > today;
                    const isToday = dateStr === today;

                    cells.push(
                      <button key={d} type="button" disabled={isFuture}
                        onClick={async () => {
                          if (!hasSchedule) {
                            if (!confirm('No schedule on this date. Add expense anyway?')) return;
                          }
                          setForm(f => ({ ...f, date: dateStr }));
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                          isSelected ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
                          isFuture ? 'text-slate-200' :
                          'hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span className={isToday && !isSelected ? 'underline decoration-2 decoration-indigo-500' : ''}>{d}</span>
                        <div className="flex justify-center gap-0.5 mt-0.5 h-1.5">
                          {hasSchedule && !expenseStatus && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unclaimed"></span>}
                          {hasSchedule && expenseStatus && <span className={`w-1.5 h-1.5 rounded-full ${expenseStatus === 'APPROVED' ? 'bg-emerald-500' : expenseStatus === 'REJECTED' ? 'bg-rose-500' : 'bg-indigo-400'}`} title={expenseStatus}></span>}
                          {!hasSchedule && !isFuture && dateStr <= today && <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span>}
                        </div>
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span><span className="text-[9px] text-slate-500">Unclaimed</span></div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400"></span><span className="text-[9px] text-slate-500">Pending</span></div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-[9px] text-slate-500">Approved</span></div>
              </div>
            </div>
            {form.date && <p className="text-xs text-indigo-600 font-bold mt-1 ml-1">Selected: {form.date}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">Amount (JPY)</label>
            <input
              type="number"
              required
              min={1}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base"
              placeholder="e.g. 840"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">Route / Purpose</label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base resize-none"
              placeholder="e.g. Shinjuku → Shibuya round trip (posting work)"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-70"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      )}

      {/* Expenses list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="bi bi-train-front text-5xl mb-3 block"></i>
          <p className="font-medium">No expense history found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{exp.date.slice(0, 10)}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      statusColor[exp.status] || 'bg-slate-100 text-slate-600'
                    }`}>
                      {statusLabel[exp.status] || exp.status}
                    </span>
                  </div>
                  <p className="text-lg font-black text-slate-800 mt-1">
                    ¥{exp.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">
                    {exp.description}
                  </p>
                </div>
                {exp.status === 'PENDING' && (
                  <button
                    onClick={() => handleCancel(exp.id)}
                    className="shrink-0 text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
