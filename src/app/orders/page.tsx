'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useNotification } from '@/components/ui/NotificationProvider';
import SkeletonRow from '@/components/ui/SkeletonRow';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';

const STATUS_MAP: Record<string, { label: string, color: string, icon: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-500 hover:bg-slate-200', icon: 'bi-pencil' },
  PLANNING: { label: '提案中', color: 'bg-slate-100 text-slate-500 hover:bg-slate-200', icon: 'bi-chat-dots' },
  PENDING_PAYMENT: { label: '入金確認待ち', color: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 hover:shadow', icon: 'bi-coin' },
  PENDING_REVIEW: { label: '審査待ち', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200 hover:shadow', icon: 'bi-hourglass-split' },
  ADJUSTING: { label: '要調整・修正', color: 'bg-rose-100 text-rose-700 hover:bg-rose-200', icon: 'bi-exclamation-triangle-fill' },
  CONFIRMED: { label: '手配中(確定)', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200', icon: 'bi-check-circle-fill' },
  IN_PROGRESS: { label: '作業・配布中', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200', icon: 'bi-truck' },
  COMPLETED: { label: '完了', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', icon: 'bi-flag-fill' },
  CANCELED: { label: 'キャンセル', color: 'bg-slate-200 text-slate-500 hover:bg-slate-300', icon: 'bi-x-circle-fill' },
};

const LIMIT = 20;

export default function OrdersListPage() {
  const { showToast, showConfirm } = useNotification();
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
    if (!await showConfirm('この受注データを削除しますか？', { variant: 'danger', confirmLabel: '削除する', title: '受注データの削除' })) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) fetchOrders(buildQuery());
    } catch { showToast('削除に失敗しました', 'error'); }
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
        showToast('ステータス更新に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    }
  };

  // ★ 入金確認アクション
  const handlePaymentConfirm = async (order: any) => {
    const ok = await showConfirm(`受注番号 ${order.orderNo} (${order.customer?.name}) の入金を確認し、審査待ちへ進めますか？`, { variant: 'primary', confirmLabel: '確認・進める' });
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
      showToast('詳細データの取得に失敗しました', 'error');
      setReviewModalOpen(false);
    }
    setIsReviewLoading(false);
  };

  const handleApprove = async () => {
    const ok = await showConfirm('この発注を承認し、受注確定(手配中)としますか？', { variant: 'primary', confirmLabel: '承認する' });
    if (ok) updateOrderStatus(reviewOrderData.id, 'CONFIRMED', 'APPROVE');
  };

  const handleReject = async () => {
    if (!showRejectInput) { setShowRejectInput(true); return; }
    if (!rejectComment.trim()) { showToast('不承認の理由を入力してください', 'warning'); return; }
    const ok = await showConfirm('この発注を不承認として差し戻しますか？', { variant: 'danger', confirmLabel: '不承認にする' });
    if (ok) updateOrderStatus(reviewOrderData.id, 'ADJUSTING', 'REJECT', rejectComment);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-briefcase-fill text-indigo-600"></i> 受注 (オーダー) 管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">ポスティング・印刷・折込・デザインの案件を一元管理します。</p>
        </div>
        <Link href="/orders/new" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all">
          <i className="bi bi-plus-lg"></i> 新規受注の登録
        </Link>
      </div>

      {/* ★ 要対応アラートパネル */}
      {(pendingPaymentCount > 0 || pendingReviewCount > 0) && (
        <div className="flex gap-4">
          {pendingPaymentCount > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm flex items-center gap-4 flex-1">
              <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xl">
                <i className="bi bi-coin"></i>
              </div>
              <div>
                <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">要確認アクション</p>
                <p className="text-sm font-bold text-slate-800">
                  <span className="text-2xl font-black text-orange-600 mr-1">{pendingPaymentCount}</span>
                  件の <span className="underline decoration-orange-300 decoration-2">入金待ち</span> があります
                </p>
              </div>
            </div>
          )}
          {pendingReviewCount > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-xl shadow-sm flex items-center gap-4 flex-1">
              <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-xl">
                <i className="bi bi-ui-checks"></i>
              </div>
              <div>
                <p className="text-xs text-yellow-600 font-bold uppercase tracking-wider">要確認アクション</p>
                <p className="text-sm font-bold text-slate-800">
                  <span className="text-2xl font-black text-yellow-600 mr-1">{pendingReviewCount}</span>
                  件の <span className="underline decoration-yellow-300 decoration-2">審査待ち</span> があります
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">キーワード検索</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              placeholder="受注番号、案件名、顧客名など..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">受注経路</label>
          <select
            value={filterSource}
            onChange={(e) => handleFilterChange({ filterSource: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer"
          >
            <option value="ALL">すべて</option>
            <option value="WEB_EC">EC経由 (WEB)</option>
            <option value="SALES_INTERNAL">営業経由 (社内)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">ステータス</label>
          <select
            value={filterStatus}
            onChange={(e) => handleFilterChange({ filterStatus: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer"
          >
            <option value="ALL">すべて</option>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">担当営業</label>
          <select
            value={filterSalesRep}
            onChange={(e) => handleFilterChange({ filterSalesRep: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[140px] bg-white cursor-pointer"
          >
            <option value="ALL">すべて</option>
            {salesReps.map(rep => (
              <option key={rep.id} value={String(rep.id)}>{rep.lastNameJa} {rep.firstNameJa}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-3 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('orderDate')}>
                受注番号 / 受注日 <SortIcon col="orderDate" />
              </th>
              <th className="px-3 py-3">顧客名 / 案件名</th>
              <th className="px-3 py-3 whitespace-nowrap">担当営業</th>
              <th className="px-3 py-3 whitespace-nowrap">依頼内訳</th>
              <th className="px-3 py-3 text-right whitespace-nowrap cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort('totalAmount')}>
                受注総額 <SortIcon col="totalAmount" />
              </th>
              <th className="px-3 py-3 text-center whitespace-nowrap">ステータス</th>
              <th className="px-3 py-3 text-right w-px whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <SkeletonRow rows={8} cols={7} />
            ) : orders.length === 0 ? (
              <EmptyState icon="bi-briefcase" title="該当する受注データがありません" description="検索条件を変更するか、新規受注を登録してください" />
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
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200" title="ECサイト経由の発注">EC経由</span>
                        ) : (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200" title="社内システムでの発注">営業経由</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{new Date(o.orderDate).toLocaleDateString()}</div>
                    </td>

                    <td className="px-3 py-3 max-w-[160px]">
                      <div className="font-bold text-slate-700 text-xs truncate" title={o.customer?.name}>{o.customer?.name}</div>
                      {o.title && <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={o.title}>{o.title}</div>}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{o.salesRep ? `${o.salesRep.lastNameJa} ${o.salesRep.firstNameJa}` : '未定'}</td>

                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasDist ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="ポスティング">ポス</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasPrint ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="印刷手配">印刷</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasNews ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="新聞折込">折込</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${hasDesign ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="デザイン">デザ</span>
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
                          title="クリックして処理を進める"
                        >
                          <i className={`bi ${status.icon}`}></i> {status.label} <i className="bi bi-chevron-right opacity-50"></i>
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${status.color}`}>
                          <i className={`bi ${status.icon}`}></i> {status.label}
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
        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={handlePageChange} />
      </div>

      {/* --- ★ 審査モーダル --- */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="bg-yellow-50 p-5 border-b border-yellow-200 flex justify-between items-center">
              <h3 className="font-bold text-yellow-800 text-lg flex items-center gap-2">
                <i className="bi bi-ui-checks"></i> 発注の審査・承認
              </h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-yellow-600 hover:text-yellow-800"><i className="bi bi-x-lg text-xl"></i></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50 flex-1">
              {isReviewLoading || !reviewOrderData ? (
                <div className="text-center py-20 text-slate-500 font-bold"><div className="w-8 h-8 border-4 border-yellow-200 border-t-yellow-500 rounded-full animate-spin mx-auto mb-3"></div>データを読み込んでいます...</div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Customer / Title</div>
                      <div className="font-bold text-slate-800">{reviewOrderData.customer?.name}</div>
                      <div className="text-sm text-slate-600">{reviewOrderData.title || '案件名未設定'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Order No. / Date</div>
                      <div className="font-mono font-bold text-slate-700">{reviewOrderData.orderNo}</div>
                      <div className="text-sm text-slate-500">{new Date(reviewOrderData.orderDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Amount</div>
                      <div className="font-black text-xl text-indigo-600">¥{reviewOrderData.totalAmount?.toLocaleString() || '-'}</div>
                      <div className="text-[10px] text-slate-400">税込</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-sm text-slate-700">依頼内容</div>
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
                                <div><span className="text-slate-400">プラン:</span> {isPrinting ? '印刷＋ポスティング' : 'ポスティングのみ'} ({dist.method})</div>
                                <div><span className="text-slate-400">予定枚数:</span> <span className="font-bold">{dist.plannedCount?.toLocaleString()}</span> 枚</div>
                                <div><span className="text-slate-400">配布エリア:</span> {dist.areas?.length || 0} ヶ所</div>
                                <div><span className="text-slate-400">配布期間:</span> {dist.startDate ? new Date(dist.startDate).toLocaleDateString() : '未定'} 〜 <span className="font-bold text-rose-600">{dist.endDate ? new Date(dist.endDate).toLocaleDateString() : '未定'}</span></div>
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
                        <span className="text-slate-400 mr-2">支払方法:</span>
                        <span className="font-bold">{reviewOrderData.payments[0].method === 'CREDIT_CARD' ? 'クレジットカード' : '銀行振込・請求書'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400 mr-2">入金状況:</span>
                        {reviewOrderData.payments[0].status === 'COMPLETED' ? (
                          <span className="font-bold text-emerald-600"><i className="bi bi-check-circle-fill mr-1"></i>入金済 (決済完了)</span>
                        ) : (
                          <span className="font-bold text-rose-500"><i className="bi bi-exclamation-circle-fill mr-1"></i>未入金</span>
                        )}
                      </div>
                    </div>
                  )}

                  {showRejectInput && (
                    <div className="bg-rose-50 p-5 rounded-xl border border-rose-200 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-sm font-bold text-rose-700 mb-2">不承認・差し戻しの理由（必須）</label>
                      <textarea
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        className="w-full h-24 border border-rose-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                        placeholder="例: 配布エリアの容量が不足しているため、部数の調整をお願いいたします。"
                      ></textarea>
                      <p className="text-[10px] text-rose-500 mt-1">※この理由はクライアントにも通知・表示されます。</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border-t border-slate-200 p-5 flex justify-between items-center shrink-0">
              {showRejectInput ? (
                <button onClick={() => setShowRejectInput(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
              ) : (
                <button onClick={() => setReviewModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">閉じる</button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={isReviewLoading}
                  className="px-6 py-2.5 border-2 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  <i className="bi bi-arrow-return-left mr-2"></i>不承認にする
                </button>
                {!showRejectInput && (
                  <button
                    onClick={handleApprove}
                    disabled={isReviewLoading}
                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                  >
                    <i className="bi bi-check-circle-fill mr-2"></i>承認して手配へ進む
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
