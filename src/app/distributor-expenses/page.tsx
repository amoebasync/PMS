'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import Pagination from '@/components/ui/Pagination';
import { useTranslation } from '@/i18n';

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

type Expense = {
  id: number;
  distributorId: number;
  date: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  distributor: Distributor;
};

type ParsedBreakdown = {
  office: number;
  field: number;
  home: number;
};

const LIMIT = 50;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** description文字列を "事務所: ¥510 / 現場: ¥178 / 帰宅: ¥566" からパース */
function parseDescription(desc: string): ParsedBreakdown {
  const result: ParsedBreakdown = { office: 0, field: 0, home: 0 };
  if (!desc) return result;

  const officeMatch = desc.match(/事務所:\s*¥?(\d+)/);
  const fieldMatch = desc.match(/現場:\s*¥?(\d+)/);
  const homeMatch = desc.match(/帰宅:\s*¥?(\d+)/);

  if (officeMatch) result.office = parseInt(officeMatch[1]);
  if (fieldMatch) result.field = parseInt(fieldMatch[1]);
  if (homeMatch) result.home = parseInt(homeMatch[1]);

  return result;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const wd = WEEKDAYS[d.getDay()];
  return `${y}/${m}/${day} (${wd})`;
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────

export default function DistributorExpensesPage() {
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('distributor-expenses');

  // 支店データ
  const [branches, setBranches] = useState<Branch[]>([]);

  // フィルタ
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 一覧
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // 編集モーダル
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formOffice, setFormOffice] = useState(0);
  const [formField, setFormField] = useState(0);
  const [formHome, setFormHome] = useState(0);
  const [formSaving, setFormSaving] = useState(false);

  const formTotal = formOffice + formField + formHome;

  // 支店データ取得
  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(data => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // ────── 一覧データ取得 ──────

  const fetchExpenses = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p || page));
      params.set('limit', String(LIMIT));
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (filterBranchId) params.set('branchId', filterBranchId);
      if (filterSearch) params.set('search', filterSearch);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/distributor-expenses?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setExpenses(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch {
      showToast(t('error_fetch'), 'error');
    }
    setLoading(false);
  }, [page, filterDateFrom, filterDateTo, filterBranchId, filterSearch, filterStatus, showToast, t]);

  useEffect(() => {
    fetchExpenses(1);
    setPage(1);
  }, [filterDateFrom, filterDateTo, filterBranchId, filterSearch, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ────── 操作ハンドラ ──────

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    const parsed = parseDescription(expense.description);
    setFormOffice(parsed.office);
    setFormField(parsed.field);
    setFormHome(parsed.home);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingExpense) return;

    setFormSaving(true);
    try {
      const totalAmount = formOffice + formField + formHome;
      const description = `事務所: ¥${formOffice} / 現場: ¥${formField} / 帰宅: ¥${formHome}`;

      const res = await fetch(`/api/distributor-expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount, description }),
      });

      if (!res.ok) throw new Error();

      showToast(t('toast_updated'), 'success');
      setShowModal(false);
      fetchExpenses(page);
    } catch {
      showToast(t('error_save'), 'error');
    }
    setFormSaving(false);
  };

  const handleDelete = async (expense: Expense) => {
    const confirmed = await showConfirm(
      t('confirm_delete', { name: expense.distributor.name, date: formatDate(expense.date) }),
      { variant: 'danger', confirmLabel: t('confirm_delete_btn') }
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/distributor-expenses/${expense.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(t('toast_deleted'), 'success');
      fetchExpenses(page);
    } catch {
      showToast(t('error_delete'), 'error');
    }
  };

  // ──────────────────────────────────────────
  // レンダリング
  // ──────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* フィルタバー */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('filter_start_date')}</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('filter_end_date')}</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('filter_branch')}</label>
          <select
            value={filterBranchId}
            onChange={e => setFilterBranchId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">{t('filter_all_branches')}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.nameJa}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('filter_status')}</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">{t('filter_all_status')}</option>
            <option value="PENDING">{t('status_pending')}</option>
            <option value="APPROVED">{t('status_approved')}</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-medium text-slate-400 mb-1">{t('filter_search')}</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder={t('filter_search_placeholder')}
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <i className="bi bi-receipt text-3xl mb-2 block"></i>
            <p className="text-sm">{t('no_data')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_date')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_distributor')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_staff_id')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_branch')}</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-600">{t('table_office')}</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-600">{t('table_field')}</th>
                  <th className="text-right px-3 py-3 font-semibold text-slate-600">{t('table_home')}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">{t('table_total')}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('table_status')}</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 w-24">{t('table_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(expense => {
                  const parsed = parseDescription(expense.description);
                  return (
                    <tr
                      key={expense.id}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3 font-medium">{expense.distributor.name}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">{expense.distributor.staffId}</td>
                      <td className="px-4 py-3 text-slate-500">{expense.distributor.branch?.nameJa || '-'}</td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                        {parsed.office > 0 ? `¥${parsed.office.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                        {parsed.field > 0 ? `¥${parsed.field.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                        {parsed.home > 0 ? `¥${parsed.home.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ¥{expense.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {expense.status === 'APPROVED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                            {t('status_approved')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                            {t('status_pending')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(expense)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                            title={t('modal_title_edit')}
                          >
                            <i className="bi bi-pencil text-xs"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(expense)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title={t('confirm_delete_btn')}
                          >
                            <i className="bi bi-trash text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={(p) => { setPage(p); fetchExpenses(p); }}
        />
      </div>

      {/* ==================== 編集モーダル ==================== */}
      {showModal && editingExpense && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                <i className="bi bi-pencil mr-2 text-indigo-600"></i>
                {t('modal_title_edit')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <i className="bi bi-x-lg text-sm"></i>
              </button>
            </div>

            {/* フォーム */}
            <div className="p-5 space-y-4">
              {/* 配布員（読み取り専用） */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal_distributor')}</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-slate-50 border-slate-200">
                  <span className="text-sm font-medium">{editingExpense.distributor.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{editingExpense.distributor.staffId}</span>
                </div>
              </div>

              {/* 日付（読み取り専用） */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal_date')}</label>
                <div className="px-3 py-2 rounded-lg border bg-slate-50 border-slate-200 text-sm">
                  {formatDate(editingExpense.date)}
                </div>
              </div>

              {/* 事務所 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal_office')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={formOffice}
                    onChange={e => setFormOffice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tabular-nums"
                  />
                </div>
              </div>

              {/* 現場 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal_field')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={formField}
                    onChange={e => setFormField(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tabular-nums"
                  />
                </div>
              </div>

              {/* 帰宅 */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal_home')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={formHome}
                    onChange={e => setFormHome(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tabular-nums"
                  />
                </div>
              </div>

              {/* 合計（自動計算） */}
              <div className="bg-indigo-50 rounded-lg px-4 py-3 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-600">{t('modal_total')}</span>
                  <span className="text-lg font-bold text-indigo-700 tabular-nums">¥{formTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={formSaving}
                className="px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {formSaving ? (
                  <span className="flex items-center gap-1.5">
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    {t('saving')}
                  </span>
                ) : (
                  t('btn_update')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
