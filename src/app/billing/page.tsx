'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';

type Customer = { id: number; name: string; customerCode: string };

type BillingStatement = {
  id: number;
  statementNo: string;
  billingMonth: string;
  status: 'DRAFT' | 'CONFIRMED' | 'SENT' | 'PAID';
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  customer: { id: number; name: string; customerCode: string };
  items: { id: number }[];
  createdAt: string;
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT:     'status_draft',
  CONFIRMED: 'status_confirmed',
  SENT:      'status_sent',
  PAID:      'status_paid',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT:     'bg-slate-100 text-slate-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SENT:      'bg-amber-100 text-amber-700',
  PAID:      'bg-green-100 text-green-700',
};

function getDefaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function BillingPage() {
  const { t } = useTranslation('billing');
  const [statements, setStatements] = useState<BillingStatement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルタ
  const [filterMonth, setFilterMonth]       = useState(getDefaultMonth());
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus]     = useState('');

  // 新規作成モーダル
  const [showModal, setShowModal]           = useState(false);
  const [newCustomerId, setNewCustomerId]   = useState('');
  const [newMonth, setNewMonth]             = useState(getDefaultMonth());
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [newNote, setNewNote]               = useState('');
  const [newPaymentDue, setNewPaymentDue]   = useState('');
  const [isCreating, setIsCreating]         = useState(false);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);

  // 通知
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStatements = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filterMonth)    params.set('month',      filterMonth);
    if (filterCustomer) params.set('customerId', filterCustomer);
    if (filterStatus)   params.set('status',     filterStatus);
    const res = await fetch(`/api/billing?${params}`);
    if (res.ok) setStatements(await res.json());
    setIsLoading(false);
  }, [filterMonth, filterCustomer, filterStatus]);

  useEffect(() => { fetchStatements(); }, [fetchStatements]);

  useEffect(() => {
    fetch('/api/customers?limit=500')
      .then(r => r.json())
      .then(d => setCustomers(Array.isArray(d) ? d : (d.customers ?? [])));
  }, []);

  // 新規作成: 顧客/月が変わったら未請求受注を取得
  useEffect(() => {
    if (!newCustomerId || !newMonth) { setAvailableOrders([]); return; }
    setIsFetchingOrders(true);
    const params = new URLSearchParams({ customerId: newCustomerId, month: newMonth });
    fetch(`/api/billing/orders?${params}`)
      .then(r => r.json())
      .then(d => { setAvailableOrders(Array.isArray(d) ? d : []); setSelectedOrderIds([]); })
      .finally(() => setIsFetchingOrders(false));
  }, [newCustomerId, newMonth]);

  // 翌月末をデフォルト
  useEffect(() => {
    if (!newMonth) return;
    const [y, m] = newMonth.split('-').map(Number);
    const due = new Date(y, m + 1, 0);
    setNewPaymentDue(due.toISOString().split('T')[0]);
  }, [newMonth]);

  const toggleOrder = (id: number) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!newCustomerId || !newMonth || selectedOrderIds.length === 0) {
      showToast(t('validation_error'), 'error'); return;
    }
    setIsCreating(true);
    const res = await fetch('/api/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId:    parseInt(newCustomerId),
        billingMonth:  newMonth,
        orderIds:      selectedOrderIds,
        note:          newNote || null,
        paymentDueDate: newPaymentDue || null,
      }),
    });
    setIsCreating(false);
    if (res.ok) {
      showToast(t('created_success'));
      setShowModal(false);
      setNewCustomerId(''); setNewNote(''); setSelectedOrderIds([]);
      fetchStatements();
    } else {
      const err = await res.json();
      showToast(err.error ?? t('create_error'), 'error');
    }
  };

  const fmt = (n: number) => n.toLocaleString('ja-JP');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-bold transition-all ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all"
        >
          <i className="bi bi-plus-circle"></i> {t('btn_create')}
        </button>
      </div>

      {/* フィルタ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_month')}</label>
          <input
            type="month" value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_customer')}</label>
          <select
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">{t('filter_all_customers')}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">{t('filter_all_status')}</option>
            {Object.entries(STATUS_LABEL_KEYS).map(([v, lk]) => <option key={v} value={v}>{t(lk)}</option>)}
          </select>
        </div>
        <button
          onClick={fetchStatements}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-all"
        >
          <i className="bi bi-search mr-1"></i>{t('filter_btn')}
        </button>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <i className="bi bi-hourglass-split animate-spin text-2xl block mb-2"></i>{t('loading')}
          </div>
        ) : statements.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <i className="bi bi-receipt text-4xl block mb-3"></i>
            <p className="font-bold">{t('no_statements')}</p>
            <p className="text-sm mt-1">{t('no_statements_hint')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold text-left">{t('table_statement_no')}</th>
                <th className="px-4 py-3 font-semibold text-left">{t('table_customer')}</th>
                <th className="px-4 py-3 font-semibold text-left">{t('table_month')}</th>
                <th className="px-4 py-3 font-semibold text-center">{t('table_items')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('table_total_incl_tax')}</th>
                <th className="px-4 py-3 font-semibold text-center">{t('table_status')}</th>
                <th className="px-4 py-3 font-semibold text-center">{t('table_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statements.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.statementNo}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{s.customer.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.billingMonth}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{t('items_count', { count: s.items.length })}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">¥{fmt(s.totalAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[s.status]}`}>
                      {t(STATUS_LABEL_KEYS[s.status])}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/billing/${s.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-all"
                    >
                      <i className="bi bi-arrow-right-circle"></i> {t('btn_detail')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── 新規作成モーダル ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                <i className="bi bi-plus-circle text-indigo-600 mr-2"></i>{t('modal_title')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_customer')} <span className="text-red-500">*</span></label>
                  <select
                    value={newCustomerId}
                    onChange={e => setNewCustomerId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">{t('modal_customer_placeholder')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_month')} <span className="text-red-500">*</span></label>
                  <input
                    type="month" value={newMonth}
                    onChange={e => setNewMonth(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* 未請求受注一覧 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  {t('modal_orders_label')} <span className="text-red-500">*</span>
                  <span className="ml-2 text-slate-400 font-normal">{t('modal_orders_billed_note')}</span>
                </label>
                {!newCustomerId ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-400 text-sm">
                    {t('select_customer_hint')}
                  </div>
                ) : isFetchingOrders ? (
                  <div className="border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
                    <i className="bi bi-hourglass-split animate-spin mr-2"></i>{t('loading')}
                  </div>
                ) : availableOrders.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-400 text-sm">
                    {t('no_unbilled_orders')}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 w-8">
                            <input type="checkbox"
                              checked={selectedOrderIds.length === availableOrders.length && availableOrders.length > 0}
                              onChange={e => setSelectedOrderIds(e.target.checked ? availableOrders.map((o:any) => o.id) : [])}
                            />
                          </th>
                          <th className="px-3 py-2 text-left">{t('modal_order_no')}</th>
                          <th className="px-3 py-2 text-left">{t('modal_order_title')}</th>
                          <th className="px-3 py-2 text-right">{t('modal_order_amount')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {availableOrders.map((o: any) => (
                          <tr key={o.id}
                            className={`cursor-pointer transition-colors ${selectedOrderIds.includes(o.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                            onClick={() => toggleOrder(o.id)}
                          >
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => {}} />
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-600">{o.orderNo}</td>
                            <td className="px-3 py-2 text-slate-700">{o.title ?? t('order_no_title')}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-700">¥{o.totalAmount?.toLocaleString('ja-JP') ?? '―'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {selectedOrderIds.length > 0 && (
                  <p className="text-xs text-indigo-600 font-bold mt-1">
                    <i className="bi bi-check-circle mr-1"></i>{t('modal_selected', { count: selectedOrderIds.length })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_payment_due')}</label>
                  <input
                    type="date" value={newPaymentDue}
                    onChange={e => setNewPaymentDue(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_note')}</label>
                <textarea
                  rows={2} value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder={t('modal_note_print_placeholder')}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-bold rounded-lg border border-slate-300 hover:bg-slate-100 transition-all text-sm"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || selectedOrderIds.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 text-sm"
              >
                {isCreating
                  ? <><i className="bi bi-hourglass-split animate-spin"></i> {t('modal_creating')}</>
                  : <><i className="bi bi-check2-circle"></i> {t('modal_create_btn')}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
