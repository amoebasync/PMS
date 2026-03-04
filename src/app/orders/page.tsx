'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';
import SkeletonRow from '@/components/ui/SkeletonRow';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';

const STATUS_MAP: Record<string, { labelKey: string, color: string, icon: string }> = {
  DRAFT: { labelKey: 'status_draft', color: 'bg-slate-100 text-slate-500 hover:bg-slate-200', icon: 'bi-pencil' },
  PLANNING: { labelKey: 'status_planning', color: 'bg-slate-100 text-slate-500 hover:bg-slate-200', icon: 'bi-chat-dots' },
  PENDING_PAYMENT: { labelKey: 'status_pending_payment', color: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:shadow', icon: 'bi-coin' },
  PENDING_REVIEW: { labelKey: 'status_pending_review', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200 hover:shadow', icon: 'bi-hourglass-split' },
  ADJUSTING: { labelKey: 'status_adjusting', color: 'bg-rose-100 text-rose-700 hover:bg-rose-200', icon: 'bi-exclamation-triangle-fill' },
  CONFIRMED: { labelKey: 'status_confirmed', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200', icon: 'bi-check-circle-fill' },
  IN_PROGRESS: { labelKey: 'status_in_progress', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200', icon: 'bi-truck' },
  COMPLETED: { labelKey: 'status_completed', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', icon: 'bi-flag-fill' },
  CANCELED: { labelKey: 'status_canceled', color: 'bg-slate-200 text-slate-500 hover:bg-slate-300', icon: 'bi-x-circle-fill' },
};

const LIMIT = 20;

export default function OrdersListPage() {
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSalesRep, setFilterSalesRep] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const [sortKey, setSortKey] = useState<'orderDate' | 'totalAmount' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ★ 審査モーダル・アクション用のState
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewOrderData, setReviewOrderData] = useState<any>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildQuery = useCallback((overrides: Record<string, unknown> = {}) => {
    const params = new URLSearchParams();
    const q = (overrides.searchQuery ?? searchQuery) as string;
    const st = (overrides.filterStatus ?? filterStatus) as string;
    const rep = (overrides.filterSalesRep ?? filterSalesRep) as string;
    const src = (overrides.filterSource ?? filterSource) as string;
    const p = (overrides.page ?? page) as number;
    if (q) params.set('search', q);
    if (st !== 'ALL') params.set('status', st);
    if (rep !== 'ALL') params.set('salesRepId', rep);
    if (src !== 'ALL') params.set('source', src);
    params.set('page', String(p));
    params.set('limit', String(LIMIT));
    return params.toString();
  }, [searchQuery, filterStatus, filterSalesRep, filterSource, page]);

  const fetchOrders = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?${query}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
        setPendingPaymentCount(json.pendingPaymentCount ?? 0);
        setPendingReviewCount(json.pendingReviewCount ?? 0);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, []);

  // Initial load: fetch orders + salesReps for dropdown
  useEffect(() => {
    fetchOrders(buildQuery({ page: 1 }));
    fetch('/api/employees').then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setSalesReps(list);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (overrides: Record<string, unknown>) => {
    const newPage = 1;
    const merged = { page: newPage, ...overrides };
    setPage(newPage);
    if ('filterStatus' in overrides) setFilterStatus(overrides.filterStatus as string);
    if ('filterSalesRep' in overrides) setFilterSalesRep(overrides.filterSalesRep as string);
    if ('filterSource' in overrides) setFilterSource(overrides.filterSource as string);
    fetchOrders(buildQuery(merged));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchOrders(buildQuery({ searchQuery: value, page: 1 }));
    }, 400);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchOrders(buildQuery({ page: newPage }));
  };

  const handleSort = (key: 'orderDate' | 'totalAmount') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedOrders = sortKey ? [...orders].sort((a, b) => {
    const aVal = sortKey === 'orderDate' ? new Date(a.orderDate).getTime() : (a.totalAmount ?? 0);
    const bVal = sortKey === 'orderDate' ? new Date(b.orderDate).getTime() : (b.totalAmount ?? 0);
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  }) : orders;

  const SortIcon = ({ col }: { col: 'orderDate' | 'totalAmount' }) => (
    <i className={`bi ml-1 ${sortKey === col ? (sortDir === 'asc' ? 'bi-arrow-up text-indigo-500' : 'bi-arrow-down text-indigo-500') : 'bi-arrow-down-up text-slate-300'}`} />
  );

  const del = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (!await showConfirm(t('delete_confirm'), { variant: 'danger', confirmLabel: t('delete'), title: t('delete_confirm_title') })) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) fetchOrders(buildQuery());
    } catch { showToast(t('delete_failed'), 'error'); }
  };

  // ★ ステータス更新APIを呼び出す共通関数
  const updateOrderStatus = async (orderId: number, newStatus: string, action: string, comment: string = '') => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: 'STATUS', status: newStatus, action, comment })
      });
      if (res.ok) {
        setReviewModalOpen(false);
        setRejectComment('');
        setShowRejectInput(false);
        fetchOrders(buildQuery());
      } else {
        showToast(t('status_update_failed'), 'error');
      }
    } catch {
      showToast(t('communication_error'), 'error');
    }
  };

  // ★ 入金確認アクション
  const handlePaymentConfirm = async (order: any) => {
    const ok = await showConfirm(t('payment_confirm', { orderNo: order.orderNo, customerName: order.customer?.name }), { variant: 'primary', confirmLabel: t('payment_confirm_label') });
    if (ok) {
      updateOrderStatus(order.id, 'PENDING_REVIEW', 'PAYMENT_CONFIRMED');
    }
  };

  // ★ 審査モーダルを開くアクション
  const openReviewModal = async (orderId: number) => {
    setReviewModalOpen(true);
    setIsReviewLoading(true);
    setShowRejectInput(false);
    setRejectComment('');
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        setReviewOrderData(await res.json());
      }
    } catch {
      showToast(t('review_detail_failed'), 'error');
      setReviewModalOpen(false);
    }
    setIsReviewLoading(false);
  };

  const handleApprove = async () => {
    const ok = await showConfirm(t('approve_confirm'), { variant: 'primary', confirmLabel: t('approve_confirm_label') });
    if (ok) updateOrderStatus(reviewOrderData.id, 'CONFIRMED', 'APPROVE');
  };

  const handleReject = async () => {
    if (!showRejectInput) { setShowRejectInput(true); return; }
    if (!rejectComment.trim()) { showToast(t('reject_reason_required'), 'warning'); return; }
    const ok = await showConfirm(t('reject_confirm'), { variant: 'danger', confirmLabel: t('reject_confirm_label') });
    if (ok) updateOrderStatus(reviewOrderData.id, 'ADJUSTING', 'REJECT', rejectComment);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        <Link href="/orders/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all">
          <i className="bi bi-plus-lg"></i> {t('btn_new_order')}
        </Link>
      </div>

      {/* ★ 要対応アラートパネル */}
      {(pendingPaymentCount > 0 || pendingReviewCount > 0) && (
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          {pendingPaymentCount > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-3 md:p-4 rounded-r-xl shadow-sm flex items-center gap-3 md:gap-4 flex-1">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-base md:text-xl shrink-0">
                <i className="bi bi-coin"></i>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-orange-600 font-bold uppercase tracking-wider">{t('alert_action_required')}</p>
                <p className="text-xs md:text-sm font-bold text-slate-800">
                  <span className="text-xl md:text-2xl font-black text-orange-600 mr-1">{pendingPaymentCount}</span>
                  <span dangerouslySetInnerHTML={{ __html: t('alert_pending_payment') }} />
                </p>
              </div>
            </div>
          )}
          {pendingReviewCount > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 md:p-4 rounded-r-xl shadow-sm flex items-center gap-3 md:gap-4 flex-1">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-base md:text-xl shrink-0">
                <i className="bi bi-ui-checks"></i>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-yellow-600 font-bold uppercase tracking-wider">{t('alert_action_required')}</p>
                <p className="text-xs md:text-sm font-bold text-slate-800">
                  <span className="text-xl md:text-2xl font-black text-yellow-600 mr-1">{pendingReviewCount}</span>
                  <span dangerouslySetInnerHTML={{ __html: t('alert_pending_review') }} />
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
        <div className="w-full md:flex-1 md:min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_keyword')}</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              placeholder={t('filter_keyword_placeholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap md:flex-nowrap md:gap-4">
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_source')}</label>
            <select
              value={filterSource}
              onChange={(e) => handleFilterChange({ filterSource: e.target.value })}
              className="w-full md:w-auto border border-slate-300 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-0 md:min-w-[120px] bg-white cursor-pointer"
            >
              <option value="ALL">{t('filter_all')}</option>
              <option value="WEB_EC">{t('filter_source_web')}</option>
              <option value="SALES_INTERNAL">{t('filter_source_sales')}</option>
            </select>
          </div>

          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
            <select
              value={filterStatus}
              onChange={(e) => handleFilterChange({ filterStatus: e.target.value })}
              className="w-full md:w-auto border border-slate-300 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-0 md:min-w-[120px] bg-white cursor-pointer"
            >
              <option value="ALL">{t('filter_all')}</option>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <option key={key} value={key}>{t(val.labelKey)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_sales_rep')}</label>
            <select
              value={filterSalesRep}
              onChange={(e) => handleFilterChange({ filterSalesRep: e.target.value })}
              className="w-full md:w-auto border border-slate-300 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-0 md:min-w-[140px] bg-white cursor-pointer"
            >
              <option value="ALL">{t('filter_all')}</option>
              {salesReps.map(rep => (
                <option key={rep.id} value={String(rep.id)}>{rep.lastNameJa} {rep.firstNameJa}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Desktop テーブル */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('orderDate')}>
                {t('th_order_no')} <SortIcon col="orderDate" />
              </th>
              <th className="px-3 py-3">{t('th_customer')}</th>
              <th className="px-3 py-3 whitespace-nowrap">{t('th_sales_rep')}</th>
              <th className="px-3 py-3 whitespace-nowrap">{t('th_breakdown')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('totalAmount')}>
                {t('th_total_amount')} <SortIcon col="totalAmount" />
              </th>
              <th className="px-3 py-3 text-center whitespace-nowrap">{t('th_status')}</th>
              <th className="px-3 py-3 text-right w-px whitespace-nowrap">{t('th_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <SkeletonRow rows={8} cols={7} />
            ) : orders.length === 0 ? (
              <EmptyState icon="bi-briefcase" title={t('empty_title')} description={t('empty_description')} />
            ) : (
              sortedOrders.map(o => {
                const status = STATUS_MAP[o.status] || STATUS_MAP['PLANNING'];
                const hasDist = o.distributions?.length > 0;
                const hasPrint = o.printings?.length > 0;
                const hasNews = o.newspaperInserts?.length > 0;
                const hasDesign = o.designs?.length > 0;
                const isClickableStatus = o.status === 'PENDING_PAYMENT' || o.status === 'PENDING_REVIEW';

                return (
                  <tr key={o.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/orders/${o.id}`} className="font-mono font-bold text-xs text-indigo-600 hover:underline">{o.orderNo}</Link>
                        {o.orderSource === 'WEB_EC' ? (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200" title={t('badge_ec_tooltip')}>{t('badge_ec')}</span>
                        ) : (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200" title={t('badge_sales_tooltip')}>{t('badge_sales')}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{new Date(o.orderDate).toLocaleDateString()}</div>
                    </td>

                    <td className="px-3 py-3 max-w-[160px]">
                      <div className="font-bold text-slate-700 text-xs truncate" title={o.customer?.name}>{o.customer?.name}</div>
                      {o.title && <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={o.title}>{o.title}</div>}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{o.salesRep ? `${o.salesRep.lastNameJa} ${o.salesRep.firstNameJa}` : t('sales_rep_unassigned')}</td>

                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasDist ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title={t('badge_posting_tooltip')}>{t('badge_posting')}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasPrint ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title={t('badge_print_tooltip')}>{t('badge_print')}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasNews ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title={t('badge_insert_tooltip')}>{t('badge_insert')}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasDesign ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title={t('badge_design_tooltip')}>{t('badge_design')}</span>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right font-bold text-xs text-slate-800 whitespace-nowrap">
                      {o.totalAmount ? `¥${o.totalAmount.toLocaleString()}` : '-'}
                    </td>

                    <td className="px-3 py-3 text-center">
                      {isClickableStatus ? (
                        <button
                          onClick={() => o.status === 'PENDING_PAYMENT' ? handlePaymentConfirm(o) : openReviewModal(o.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap ${status.color}`}
                          title={t('click_to_process')}
                        >
                          <i className={`bi ${status.icon}`}></i> {t(status.labelKey)} <i className="bi bi-chevron-right opacity-50"></i>
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${status.color}`}>
                          <i className={`bi ${status.icon}`}></i> {t(status.labelKey)}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <Link href={`/orders/${o.id}`} className="p-1.5 text-slate-400 hover:text-indigo-600 inline-block"><i className="bi bi-pencil-square"></i></Link>
                      <button onClick={(e) => del(e, o.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><i className="bi bi-trash"></i></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>

        {/* Mobile カードレイアウト */}
        <div className="md:hidden">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 space-y-2 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 text-slate-400 py-16">
              <i className="bi bi-briefcase text-4xl"></i>
              <p className="text-sm font-medium">{t('empty_title')}</p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {sortedOrders.map(o => {
                const status = STATUS_MAP[o.status] || STATUS_MAP['PLANNING'];
                return (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="block bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-600">{o.orderNo}</span>
                        {o.orderSource === 'WEB_EC' ? (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-fuchsia-100 text-fuchsia-700">{t('badge_ec')}</span>
                        ) : (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">{t('badge_sales')}</span>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${status.color}`}>
                        <i className={`bi ${status.icon}`}></i> {t(status.labelKey)}
                      </span>
                    </div>
                    <div className="font-bold text-slate-700 text-sm truncate mb-1">{o.customer?.name}</div>
                    {o.title && <div className="text-xs text-slate-500 truncate mb-1">{o.title}</div>}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{new Date(o.orderDate).toLocaleDateString()}</span>
                      <span className="font-bold text-slate-800">{o.totalAmount ? `¥${o.totalAmount.toLocaleString()}` : '-'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={handlePageChange} />
      </div>

      {/* --- ★ 審査モーダル --- */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full md:max-w-3xl flex flex-col overflow-hidden h-full md:h-auto md:max-h-[90vh]">
            <div className="bg-yellow-50 p-5 border-b border-yellow-200 flex justify-between items-center">
              <h3 className="font-bold text-yellow-800 text-lg flex items-center gap-2">
                <i className="bi bi-ui-checks"></i> {t('review_modal_title')}
              </h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-yellow-600 hover:text-yellow-800"><i className="bi bi-x-lg text-xl"></i></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50 flex-1">
              {isReviewLoading || !reviewOrderData ? (
                <div className="text-center py-20 text-slate-500 font-bold"><div className="w-8 h-8 border-4 border-yellow-200 border-t-yellow-500 rounded-full animate-spin mx-auto mb-3"></div>{t('review_loading')}</div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Customer / Title</div>
                      <div className="font-bold text-slate-800">{reviewOrderData.customer?.name}</div>
                      <div className="text-sm text-slate-600">{reviewOrderData.title || t('review_title_unset')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Order No. / Date</div>
                      <div className="font-mono font-bold text-slate-700">{reviewOrderData.orderNo}</div>
                      <div className="text-sm text-slate-500">{new Date(reviewOrderData.orderDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Amount</div>
                      <div className="font-black text-xl text-indigo-600">¥{reviewOrderData.totalAmount?.toLocaleString() || '-'}</div>
                      <div className="text-[10px] text-slate-400">{t('review_tax_included')}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-sm text-slate-700">{t('review_content_title')}</div>
                    <div className="p-4 space-y-4">
                      {reviewOrderData.distributions?.map((dist: any, idx: number) => {
                        const isPrinting = reviewOrderData.printings?.some((p: any) => p.flyerId === dist.flyerId);
                        return (
                          <div key={idx} className={`flex gap-4 ${idx !== 0 ? 'pt-4 border-t border-slate-100' : ''}`}>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl shadow-inner ${isPrinting ? 'bg-indigo-50 text-indigo-500' : 'bg-fuchsia-50 text-fuchsia-500'}`}>
                              <i className={`bi ${isPrinting ? 'bi-printer-fill' : 'bi-send-fill'}`}></i>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-slate-800 text-sm mb-1">{dist.flyer?.name}</h4>
                              <div className="text-xs text-slate-600 space-y-1">
                                <div><span className="text-slate-400">{t('review_plan_label')}</span> {isPrinting ? t('review_plan_print_posting') : t('review_plan_posting_only')} ({dist.method})</div>
                                <div><span className="text-slate-400">{t('review_planned_count')}</span> <span className="font-bold">{dist.plannedCount?.toLocaleString()}</span> {t('review_count_unit')}</div>
                                <div><span className="text-slate-400">{t('review_area_count')}</span> {dist.areas?.length || 0} {t('review_area_unit')}</div>
                                <div><span className="text-slate-400">{t('review_period')}</span> {dist.startDate ? new Date(dist.startDate).toLocaleDateString() : t('review_unset')} ~ <span className="font-bold text-rose-600">{dist.endDate ? new Date(dist.endDate).toLocaleDateString() : t('review_unset')}</span></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {reviewOrderData.payments?.[0] && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-slate-400 mr-2">{t('review_payment_method')}</span>
                        <span className="font-bold">{reviewOrderData.payments[0].method === 'CREDIT_CARD' ? t('review_payment_credit') : t('review_payment_bank')}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400 mr-2">{t('review_payment_status')}</span>
                        {reviewOrderData.payments[0].status === 'COMPLETED' ? (
                          <span className="font-bold text-emerald-600"><i className="bi bi-check-circle-fill mr-1"></i>{t('review_payment_completed')}</span>
                        ) : (
                          <span className="font-bold text-rose-500"><i className="bi bi-exclamation-circle-fill mr-1"></i>{t('review_payment_pending')}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {showRejectInput && (
                    <div className="bg-rose-50 p-5 rounded-xl border border-rose-200 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-sm font-bold text-rose-700 mb-2">{t('reject_reason_label')}</label>
                      <textarea
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        className="w-full h-24 border border-rose-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                        placeholder={t('reject_reason_placeholder')}
                      ></textarea>
                      <p className="text-[10px] text-rose-500 mt-1">{t('reject_reason_note')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border-t border-slate-200 p-5 flex justify-between items-center shrink-0">
              {showRejectInput ? (
                <button onClick={() => setShowRejectInput(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">{t('cancel')}</button>
              ) : (
                <button onClick={() => setReviewModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">{t('btn_close')}</button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={isReviewLoading}
                  className="px-6 py-2.5 border-2 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  <i className="bi bi-arrow-return-left mr-2"></i>{t('btn_reject')}
                </button>
                {!showRejectInput && (
                  <button
                    onClick={handleApprove}
                    disabled={isReviewLoading}
                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                  >
                    <i className="bi bi-check-circle-fill mr-2"></i>{t('btn_approve')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
