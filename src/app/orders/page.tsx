'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

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

export default function OrdersListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSalesRep, setFilterSalesRep] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL'); 

  // ★ 審査モーダル・アクション用のState
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewOrderData, setReviewOrderData] = useState<any>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) setOrders(await res.json());
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const del = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (!confirm('この受注データを削除しますか？')) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) fetchOrders();
    } catch (error) { alert('削除に失敗しました'); }
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
        fetchOrders(); // リストを再取得して画面を更新
      } else {
        alert('ステータス更新に失敗しました。');
      }
    } catch (e) {
      alert('通信エラーが発生しました。');
    }
  };

  // ★ 入金確認アクション
  const handlePaymentConfirm = (order: any) => {
    if (confirm(`受注番号 ${order.orderNo} (${order.customer?.name}) の入金を確認し、審査待ちへ進めますか？`)) {
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
      // 詳細な内容をAPIから取得してモーダルに表示する
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        setReviewOrderData(await res.json());
      }
    } catch (e) {
      alert('詳細データの取得に失敗しました');
      setReviewModalOpen(false);
    }
    setIsReviewLoading(false);
  };

  // モーダル内の「承認」ボタン
  const handleApprove = () => {
    if (confirm('この発注を承認し、受注確定(手配中)としますか？')) {
      updateOrderStatus(reviewOrderData.id, 'CONFIRMED', 'APPROVE');
    }
  };

  // モーダル内の「不承認」ボタン
  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true); // 理由入力欄を表示する
      return;
    }
    if (!rejectComment.trim()) {
      alert('不承認の理由（クライアントへの伝達事項など）を入力してください。');
      return;
    }
    if (confirm('この発注を不承認として差し戻しますか？')) {
      updateOrderStatus(reviewOrderData.id, 'ADJUSTING', 'REJECT', rejectComment);
    }
  };

  const salesReps = useMemo(() => {
    const repsMap = new Map();
    orders.forEach(o => {
      if (o.salesRep) repsMap.set(o.salesRep.id, o.salesRep);
    });
    return Array.from(repsMap.values());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
      if (filterSalesRep !== 'ALL' && String(o.salesRepId) !== filterSalesRep) return false;
      if (filterSource !== 'ALL' && o.orderSource !== filterSource) return false; 
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const target = `${o.orderNo} ${o.title || ''} ${o.customer?.name || ''} ${o.customer?.nameKana || ''}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filterStatus, filterSalesRep, filterSource, searchQuery]);

  // ★ 追加: KPIの計算
  const pendingPaymentCount = orders.filter(o => o.status === 'PENDING_PAYMENT').length;
  const pendingReviewCount = orders.filter(o => o.status === 'PENDING_REVIEW').length;

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

      {/* ★ 追加: 要対応アラートパネル */}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">受注経路</label>
          <select 
            value={filterSource} 
            onChange={(e) => setFilterSource(e.target.value)}
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
            onChange={(e) => setFilterStatus(e.target.value)}
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
            onChange={(e) => setFilterSalesRep(e.target.value)}
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
              <th className="px-6 py-4">受注番号 / 受注日</th>
              <th className="px-6 py-4">顧客名 / 案件名</th>
              <th className="px-6 py-4">担当営業</th>
              <th className="px-6 py-4">依頼内訳</th>
              <th className="px-6 py-4 text-right">受注総額</th>
              <th className="px-6 py-4 text-center">ステータス <span className="font-normal lowercase">(Click to Action)</span></th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">読み込み中...</td></tr> : 
             filteredOrders.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">該当する受注データがありません</td></tr> :
             filteredOrders.map(o => {
               const status = STATUS_MAP[o.status] || STATUS_MAP['PLANNING'];
               
               const hasDist = o.distributions?.length > 0;
               const hasPrint = o.printings?.length > 0;
               const hasNews = o.newspaperInserts?.length > 0;
               const hasDesign = o.designs?.length > 0;

               // ステータスがアクション可能かどうか
               const isClickableStatus = o.status === 'PENDING_PAYMENT' || o.status === 'PENDING_REVIEW';

               return (
                <tr key={o.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/orders/${o.id}`} className="font-mono font-bold text-indigo-600 hover:underline">{o.orderNo}</Link>
                      {o.orderSource === 'WEB_EC' ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200" title="ECサイト経由の発注">EC経由</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200" title="社内システムでの発注">営業経由</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(o.orderDate).toLocaleDateString()}</div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700 truncate max-w-[200px]" title={o.customer?.name}>{o.customer?.name}</div>
                    {o.title && <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]" title={o.title}>{o.title}</div>}
                  </td>
                  
                  <td className="px-6 py-4 text-slate-600">{o.salesRep ? `${o.salesRep.lastNameJa} ${o.salesRep.firstNameJa}` : '未定'}</td>
                  
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${hasDist ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="ポスティング">ポス</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${hasPrint ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="印刷手配">印刷</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${hasNews ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="新聞折込">折込</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${hasDesign ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title="デザイン">デザ</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    {o.totalAmount ? `¥${o.totalAmount.toLocaleString()}` : '-'}
                  </td>

                  {/* ★ 変更: ステータスをアクションボタン化 */}
                  <td className="px-6 py-4 text-center">
                    {isClickableStatus ? (
                      <button 
                        onClick={() => o.status === 'PENDING_PAYMENT' ? handlePaymentConfirm(o) : openReviewModal(o.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${status.color}`}
                        title="クリックして処理を進める"
                      >
                        <i className={`bi ${status.icon}`}></i> {status.label} <i className="bi bi-chevron-right ml-1 opacity-50"></i>
                      </button>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${status.color}`}>
                        <i className={`bi ${status.icon}`}></i> {status.label}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Link href={`/orders/${o.id}`} className="p-2 text-slate-400 hover:text-indigo-600"><i className="bi bi-pencil-square text-lg"></i></Link>
                    <button onClick={(e) => del(e, o.id)} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash text-lg"></i></button>
                  </td>
                </tr>
               )
             })}
          </tbody>
        </table>
      </div>

      {/* --- ★ 追加: 審査モーダル --- */}
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
                  {/* サマリー情報 */}
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

                  {/* 依頼内容のプレビュー */}
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
                        )
                      })}
                    </div>
                  </div>

                  {/* 支払い状況 */}
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

                  {/* 不承認入力エリア */}
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
                <button onClick={() => setShowRejectInput(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">
                  キャンセル
                </button>
              ) : (
                <button onClick={() => setReviewModalOpen(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-colors">
                  閉じる
                </button>
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