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

  const fetchExpenses = async () => {
    setLoading(true);
    const res = await fetch('/api/staff/expenses');
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses || []);
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-600 ml-1">Date</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, date: today }))}
                className="text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                Today
              </button>
            </div>
            <input
              type="date"
              required
              max={today}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base"
            />
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
