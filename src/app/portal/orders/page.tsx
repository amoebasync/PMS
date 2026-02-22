// src/app/portal/orders/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ステータス定義
const STATUS_MAP: Record<string, { label: string, color: string, icon: string }> = {
  ALL: { label: 'すべて', color: '', icon: '' },
  PENDING_SUBMISSION: { label: '入稿待ち', color: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200', icon: 'bi-cloud-arrow-up' },
  PENDING_REVIEW: { label: '審査中', color: 'bg-orange-50 text-orange-700 border border-orange-200', icon: 'bi-hourglass-split' },
  ADJUSTING: { label: '調整中', color: 'bg-indigo-50 text-indigo-700 border border-indigo-200', icon: 'bi-tools' },
  CONFIRMED: { label: '手配中', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: 'bi-box-seam' },
  IN_PROGRESS: { label: '作業中', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: 'bi-bicycle' },
  COMPLETED: { label: '完了', color: 'bg-slate-100 text-slate-600 border border-slate-200', icon: 'bi-flag-fill' },
  CANCELED: { label: 'キャンセル', color: 'bg-rose-50 text-rose-700 border border-rose-200', icon: 'bi-x-circle' },
  DRAFT: { label: '一時保存', color: 'bg-slate-50 text-slate-500 border border-slate-200', icon: 'bi-save' },
  PLANNING: { label: '提案中', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: 'bi-lightbulb' },
  PENDING_PAYMENT: { label: '入金待ち', color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: 'bi-wallet2' },
};

const FILTER_TABS = [
  { id: 'ALL', label: 'すべて' },
  { id: 'PENDING_SUBMISSION', label: '入稿待ち' },
  { id: 'PENDING_REVIEW', label: '審査中' },
  { id: 'ADJUSTING', label: '調整中' },
  { id: 'CONFIRMED', label: '手配中' },
  { id: 'IN_PROGRESS', label: '作業中' },
  { id: 'COMPLETED', label: '完了' },
  { id: 'CANCELED', label: 'キャンセル' },
];

const CANCELABLE_STATUSES = ['DRAFT', 'PLANNING', 'PENDING_PAYMENT', 'PENDING_SUBMISSION', 'PENDING_REVIEW', 'ADJUSTING'];

export default function PortalOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // モーダル用State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryType, setInquiryType] = useState('エリア・枚数の変更について');
  const [inquiryText, setInquiryText] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/orders');
      if (res.status === 401) { router.push('/portal/login'); return; }
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [router]);

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setIsCanceling(true);
    try {
      const res = await fetch(`/api/portal/orders/${selectedOrder.id}/cancel`, { method: 'PUT' });
      if (res.ok) {
        alert('発注をキャンセルしました。');
        setIsCancelModalOpen(false);
        setSelectedOrder(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'キャンセルの処理に失敗しました。');
      }
    } catch (e) {
      alert('通信エラーが発生しました。');
    }
    setIsCanceling(false);
  };

  const handleSendInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    alert('お問い合わせを送信しました。\n担当者よりご登録のメールアドレスへご連絡いたします。');
    setIsInquiryModalOpen(false);
    setInquiryText('');
  };

  // フィルタリング処理
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const target = `${o.orderNo} ${o.title || ''}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filterStatus, searchQuery]);

  // アラート用カウント
  const pendingSubmissionCount = orders.filter(o => o.status === 'PENDING_SUBMISSION').length;
  const pendingPaymentCount = orders.filter(o => o.status === 'PENDING_PAYMENT').length;
  const adjustingCount = orders.filter(o => o.status === 'ADJUSTING').length;
  const needsActionCount = pendingSubmissionCount + pendingPaymentCount + adjustingCount;

  // ステータス集計ヘルパー
  const countByStatus = (status: string | string[]) => {
    if (Array.isArray(status)) return orders.filter(o => status.includes(o.status)).length;
    return orders.filter(o => o.status === status).length;
  };

  if (isLoading) return <div className="p-20 text-center text-slate-500"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>データを読み込んでいます...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in pb-20">
      
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <i className="bi bi-card-list text-indigo-600"></i> 発注履歴・状況確認
          </h1>
          <p className="text-slate-500 text-sm mt-1">過去の発注履歴や、現在の進行状況をリアルタイムで確認できます。</p>
        </div>
        <Link href="/portal/orders/new" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0">
          <i className="bi bi-plus-lg"></i> 新しく発注する
        </Link>
      </div>

      {/* 要対応アクションアラート */}
      {needsActionCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 shadow-sm">
          <div className="font-bold mb-4 flex items-center gap-2 text-rose-800 text-base">
            <i className="bi bi-exclamation-triangle-fill"></i> 要対応アクションがあります。
          </div>
          <ul className="space-y-3 ml-2">
            {pendingPaymentCount > 0 && (
              <li>
                <button 
                  onClick={() => setFilterStatus('PENDING_PAYMENT')} 
                  className="flex items-center gap-2 hover:underline text-rose-600 font-medium transition-all hover:translate-x-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  入金待ちの案件が <span className="font-black text-lg mx-1">{pendingPaymentCount}</span> 件あります。
                  <i className="bi bi-chevron-right text-[10px] opacity-50 ml-1"></i>
                </button>
              </li>
            )}
            {pendingSubmissionCount > 0 && (
              <li>
                <button 
                  onClick={() => setFilterStatus('PENDING_SUBMISSION')} 
                  className="flex items-center gap-2 hover:underline text-rose-600 font-medium transition-all hover:translate-x-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  入稿待ちの案件が <span className="font-black text-lg mx-1">{pendingSubmissionCount}</span> 件あります。
                  <i className="bi bi-chevron-right text-[10px] opacity-50 ml-1"></i>
                </button>
              </li>
            )}
            {adjustingCount > 0 && (
              <li>
                <button 
                  onClick={() => setFilterStatus('ADJUSTING')} 
                  className="flex items-center gap-2 hover:underline text-rose-600 font-medium transition-all hover:translate-x-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  調整中の案件が <span className="font-black text-lg mx-1">{adjustingCount}</span> 件あります。
                  <i className="bi bi-chevron-right text-[10px] opacity-50 ml-1"></i>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* ========================================================= */}
        {/* 左カラム：ステータスサマリー */}
        {/* ========================================================= */}
        <div className="w-full lg:w-1/4 shrink-0 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
              <i className="bi bi-pie-chart-fill text-indigo-500"></i> ステータス別件数
            </h3>
            
            <div className="space-y-1">
              <div 
                className={`flex justify-between items-center text-sm p-3 rounded-xl cursor-pointer transition-colors ${filterStatus === 'PENDING_PAYMENT' ? 'bg-amber-50 border border-amber-200' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => setFilterStatus('PENDING_PAYMENT')}
              >
                <span className="text-amber-700 font-bold"><i className="bi bi-wallet2 mr-2"></i>入金待ち</span>
                <span className="font-black text-slate-800">{pendingPaymentCount} <span className="text-[10px] font-normal text-slate-500">件</span></span>
              </div>

              <div 
                className={`flex justify-between items-center text-sm p-3 rounded-xl cursor-pointer transition-colors ${filterStatus === 'PENDING_SUBMISSION' ? 'bg-fuchsia-50 border border-fuchsia-200' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => setFilterStatus('PENDING_SUBMISSION')}
              >
                <span className="text-fuchsia-700 font-bold"><i className="bi bi-cloud-arrow-up mr-2"></i>入稿待ち</span>
                <span className="font-black text-slate-800">{pendingSubmissionCount} <span className="text-[10px] font-normal text-slate-500">件</span></span>
              </div>

              <div 
                className={`flex justify-between items-center text-sm p-3 rounded-xl cursor-pointer transition-colors ${filterStatus === 'PENDING_REVIEW' ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => setFilterStatus('PENDING_REVIEW')}
              >
                <span className="text-orange-700 font-bold"><i className="bi bi-hourglass-split mr-2"></i>審査中</span>
                <span className="font-black text-slate-800">{countByStatus('PENDING_REVIEW')} <span className="text-[10px] font-normal text-slate-500">件</span></span>
              </div>

              <div 
                className={`flex justify-between items-center text-sm p-3 rounded-xl cursor-pointer transition-colors ${filterStatus === 'ADJUSTING' ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => setFilterStatus('ADJUSTING')}
              >
                <span className="text-indigo-700 font-bold"><i className="bi bi-tools mr-2"></i>調整中</span>
                <span className="font-black text-slate-800">{adjustingCount} <span className="text-[10px] font-normal text-slate-500">件</span></span>
              </div>

              <div 
                className={`flex justify-between items-center text-sm p-3 rounded-xl cursor-pointer transition-colors ${filterStatus === 'CONFIRMED' ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => setFilterStatus('CONFIRMED')}
              >
                <span className="text-emerald-700 font-bold"><i className="bi bi-box-seam mr-2"></i>手配中</span>
                <span className="font-black text-slate-800">{countByStatus('CONFIRMED')} <span className="text-[10px] font-normal text-slate-500">件</span></span>
              </div>

              <div 
                className={`flex justify-between items-center text-sm p-3 rounded-xl cursor-pointer transition-colors ${filterStatus === 'IN_PROGRESS' ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'}`}
                onClick={() => setFilterStatus('IN_PROGRESS')}
              >
                <span className="text-blue-700 font-bold"><i className="bi bi-bicycle mr-2"></i>作業中</span>
                <span className="font-black text-slate-800">{countByStatus('IN_PROGRESS')} <span className="text-[10px] font-normal text-slate-500">件</span></span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 text-xs text-slate-500 leading-relaxed font-medium">
            <i className="bi bi-info-circle-fill text-slate-400 mr-1"></i>
            審査通過後に手配が開始された案件は、画面上からキャンセルすることができません。<br/><br/>
            エリアや内容の変更をご希望の場合は、各案件の詳細画面より「<i className="bi bi-chat-dots mx-1"></i>」アイコンからお問い合わせください。
          </div>
        </div>

        {/* ========================================================= */}
        {/* 右カラム：発注一覧 (スッキリしたリストビュー) */}
        {/* ========================================================= */}
        <div className="w-full lg:w-3/4 space-y-4">
          
          {/* 検索・フィルターバー */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex overflow-x-auto custom-scrollbar px-2 bg-white">
              {FILTER_TABS.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-5 py-4 font-bold text-sm whitespace-nowrap border-b-2 transition-colors ${filterStatus === tab.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
                <input 
                  type="text" 
                  placeholder="案件名、発注番号などで検索..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>
              <div className="text-xs font-bold text-slate-500 hidden md:block">
                全 {filteredOrders.length} 件
              </div>
            </div>
          </div>

          {/* リスト表示部 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* デスクトップ用 テーブルヘッダー (幅とgapを調整) */}
            <div className="hidden lg:flex items-center px-6 py-3 bg-white border-b border-slate-200 text-xs font-bold text-slate-500 gap-6">
              <div className="w-24 shrink-0 text-center">ステータス</div>
              <div className="flex-1 min-w-0 pr-2">案件名 / 発注日</div>
              <div className="w-20 shrink-0 text-center">プラン</div>
              <div className="w-48 shrink-0">配布エリア / 枚数</div>
              <div className="w-28 shrink-0 text-right">金額(税込)</div>
              <div className="w-24 shrink-0 text-center">アクション</div>
            </div>

            {/* リスト本体 */}
            <div className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <div className="p-16 text-center">
                  <i className="bi bi-inbox text-4xl text-slate-300 mb-3 block"></i>
                  <p className="text-slate-500 font-bold text-sm">該当する発注がありません。</p>
                </div>
              ) : (
                filteredOrders.map(order => {
                  const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-600 border border-slate-200', icon: 'bi-circle' };
                  const hasPrinting = order.printings?.length > 0;
                  const totalCount = order.distributions?.reduce((sum: number, d: any) => sum + d.plannedCount, 0) || 0;
                  
                  let areasSummary = '未指定';
                  if (order.distributions?.[0]?.areas?.length > 0) {
                    const firstArea = order.distributions[0].areas[0].area;
                    const count = order.distributions[0].areas.length;
                    areasSummary = `${firstArea?.city?.name || ''} ${firstArea?.town_name || ''} ${count > 1 ? `他 計${count}ヶ所` : ''}`;
                  }

                  return (
                    <div key={order.id} className="flex flex-col lg:flex-row lg:items-center px-5 lg:px-6 py-4 gap-6 hover:bg-indigo-50/30 transition-colors group">
                      
                      {/* モバイルレイアウト */}
                      <div className="lg:hidden flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <div className="font-bold text-slate-800 text-base truncate">{order.title || '名称未設定'}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="shrink-0">{new Date(order.orderDate).toLocaleDateString('ja-JP')}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-end mt-1 text-xs text-slate-600">
                          <div className="flex flex-col gap-1">
                            <span className="truncate"><i className="bi bi-geo-alt text-slate-400 mr-1"></i>{areasSummary}</span>
                            <span><i className="bi bi-file-earmark-text text-slate-400 mr-1"></i>{totalCount.toLocaleString()} 枚</span>
                          </div>
                          <span className="font-black text-slate-800 text-base">¥{order.totalAmount?.toLocaleString() || '---'}</span>
                        </div>
                      </div>

                      {/* PCレイアウト */}
                      <div className="hidden lg:flex w-24 shrink-0 justify-center">
                        <span className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center text-center gap-1.5 w-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="hidden lg:flex flex-1 min-w-0 flex-col justify-center gap-1 pr-2">
                        <div className="font-bold text-slate-800 text-base truncate" title={order.title}>
                          {order.title || '名称未設定'}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="shrink-0">{new Date(order.orderDate).toLocaleDateString('ja-JP')}</span>
                        </div>
                      </div>

                      <div className="hidden lg:flex w-20 shrink-0 justify-center items-center">
                        <span className={`text-[9px] font-bold px-2 py-1 rounded text-center leading-tight ${hasPrinting ? 'bg-indigo-50 text-indigo-600' : 'bg-fuchsia-50 text-fuchsia-600'}`}>
                          {hasPrinting ? '印刷＋配布' : '配布のみ'}
                        </span>
                      </div>

                      <div className="hidden lg:flex w-48 shrink-0 flex-col justify-center gap-1 text-[11px] text-slate-600">
                        <span className="truncate" title={areasSummary}><i className="bi bi-geo-alt text-slate-400 mr-1.5"></i>{areasSummary}</span>
                        <span><i className="bi bi-file-earmark-text text-slate-400 mr-1.5"></i>{totalCount.toLocaleString()} 枚</span>
                      </div>

                      <div className="hidden lg:flex w-28 shrink-0 justify-end items-center">
                        <span className="font-black text-slate-800 text-base">¥{order.totalAmount?.toLocaleString() || '---'}</span>
                      </div>

                      {/* アクションボタン */}
                      <div className="w-full lg:w-24 shrink-0 flex justify-end mt-2 lg:mt-0">
                        {order.status === 'PENDING_SUBMISSION' ? (
                          <Link href={`/portal/orders/${order.id}/submit`} className="w-full lg:w-full px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-md text-xs font-bold shadow-sm transition-all text-center flex items-center justify-center gap-1.5">
                            入稿
                          </Link>
                        ) : (
                          <button onClick={() => setSelectedOrder(order)} className="w-full lg:w-full px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs font-bold border border-slate-300 transition-all text-center flex items-center justify-center gap-1.5 shadow-sm">
                            <i className="bi bi-list-ul"></i> 詳細
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* 詳細モーダル */}
      {/* ========================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="px-6 py-4 bg-slate-800 text-white flex justify-between items-center shrink-0">
              <div>
                <div className="text-xs font-mono text-slate-400 mb-1">{selectedOrder.orderNo}</div>
                <h3 className="font-bold text-lg leading-tight">{selectedOrder.title}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"><i className="bi bi-x-lg"></i></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50 custom-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">現在のステータス</div>
                  <div className={`px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 border ${STATUS_MAP[selectedOrder.status]?.color || 'bg-slate-100'}`}>
                    <i className={`bi ${STATUS_MAP[selectedOrder.status]?.icon}`}></i> {STATUS_MAP[selectedOrder.status]?.label}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">発注日 / 支払方法</div>
                  <div className="font-bold text-slate-800 mb-1">{new Date(selectedOrder.orderDate).toLocaleDateString('ja-JP')}</div>
                  <div className="text-sm text-slate-600 font-medium">{selectedOrder.paymentMethod || '未定'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">発注総額 (税込)</div>
                  <div className="text-3xl font-black text-indigo-600 tracking-tight">¥{selectedOrder.totalAmount?.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-100 px-5 py-3 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-2">
                  <i className="bi bi-card-checklist text-indigo-500"></i> 手配内容の詳細
                </div>
                <div className="p-5 space-y-6">
                  {selectedOrder.distributions?.map((dist: any, idx: number) => {
                    const isPrinting = selectedOrder.printings?.some((p: any) => p.flyerId === dist.flyerId);
                    const printInfo = selectedOrder.printings?.find((p: any) => p.flyerId === dist.flyerId);

                    return (
                      <div key={idx} className={`flex flex-col md:flex-row gap-6 ${idx !== 0 ? 'pt-6 border-t border-slate-100' : ''}`}>
                        <div className="flex-1 space-y-4">
                          <h4 className="font-black text-slate-800 text-lg border-l-4 border-indigo-500 pl-2 leading-tight">
                            {dist.flyer?.name} <span className="text-sm font-normal text-slate-500 ml-2">({dist.flyer?.size?.name})</span>
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm">
                            <div><span className="block text-[10px] text-slate-500 font-bold mb-0.5">配布プラン</span><span className="font-bold text-slate-800">{isPrinting ? '印刷＋配布' : '配布のみ'} ({dist.method})</span></div>
                            <div><span className="block text-[10px] text-slate-500 font-bold mb-0.5">配布枚数</span><span className="font-black text-indigo-600 text-base">{dist.plannedCount?.toLocaleString()}</span> 枚</div>
                            <div><span className="block text-[10px] text-slate-500 font-bold mb-0.5">配布開始日</span><span className="font-bold text-slate-800">{dist.startDate ? new Date(dist.startDate).toLocaleDateString() : '未定'}</span></div>
                            <div><span className="block text-[10px] text-slate-500 font-bold mb-0.5">完了期限日</span><span className="font-bold text-rose-600">{dist.endDate ? new Date(dist.endDate).toLocaleDateString() : '未定'}</span></div>
                          </div>

                          {isPrinting && printInfo && (
                            <div className="bg-fuchsia-50/50 p-4 rounded-lg border border-fuchsia-100 text-sm">
                              <span className="block text-[10px] text-fuchsia-600 font-bold mb-2">印刷仕様</span>
                              <div className="flex flex-wrap gap-3 font-medium text-slate-700">
                                <span>{printInfo.paperType}</span> / <span>{printInfo.paperWeight}</span> / <span>{printInfo.colorType}</span> / <span>加工: {printInfo.foldingOption || 'なし'}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col max-h-48 overflow-y-auto custom-scrollbar">
                          <span className="block text-[10px] text-slate-500 font-bold mb-2 sticky top-0 bg-slate-50 z-10">指定エリア ({dist.areas?.length || 0}ヶ所)</span>
                          <ul className="space-y-1.5">
                            {dist.areas?.map((a: any, i: number) => (
                              <li key={i} className="text-xs font-bold text-slate-700 border-b border-slate-200 pb-1.5 last:border-0 truncate" title={`${a.area?.prefecture?.name} ${a.area?.city?.name} ${a.area?.town_name} ${a.area?.chome_name}`}>
                                <span className="text-[9px] text-slate-400 font-normal mr-1">{a.area?.city?.name}</span>
                                {a.area?.town_name} {a.area?.chome_name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
            
            <div className="p-5 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
              <button onClick={() => setSelectedOrder(null)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">
                閉じる
              </button>
              
              <div className="flex gap-3">
                {CANCELABLE_STATUSES.includes(selectedOrder.status) ? (
                  <button onClick={() => setIsCancelModalOpen(true)} className="px-5 py-2.5 bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors flex items-center gap-2">
                    <i className="bi bi-x-circle-fill"></i> 発注をキャンセル
                  </button>
                ) : (
                  <button onClick={() => setIsInquiryModalOpen(true)} className="px-5 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl transition-colors flex items-center gap-2">
                    <i className="bi bi-chat-dots-fill"></i> 変更・お問い合わせ
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- キャンセル確認モーダル --- */}
      {isCancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">発注をキャンセルしますか？</h3>
            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed">
              この発注を取り消します。<br/>この操作は元に戻すことができません。
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsCancelModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-sm">
                戻る
              </button>
              <button onClick={handleCancelOrder} disabled={isCanceling} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm disabled:opacity-50">
                {isCanceling ? '処理中...' : 'キャンセルを実行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- お問い合わせモーダル --- */}
      {isInquiryModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-chat-dots-fill text-blue-600"></i>
                変更・お問い合わせ
              </h3>
              <button onClick={() => setIsInquiryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSendInquiry} className="p-6 space-y-5">
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl mb-2">
                <div className="text-[10px] text-blue-600 font-bold mb-1">対象案件</div>
                <div className="text-sm font-bold text-slate-800 truncate">{selectedOrder.title}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">{selectedOrder.orderNo}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">お問い合わせ種別</label>
                <select value={inquiryType} onChange={(e) => setInquiryType(e.target.value)} className="w-full border border-slate-300 p-3 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700">
                  <option>エリア・枚数の変更について</option>
                  <option>入稿データの差し替えについて</option>
                  <option>スケジュールの変更について</option>
                  <option>手配のキャンセル相談</option>
                  <option>その他のお問い合わせ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">ご要望・メッセージ <span className="text-rose-500">*</span></label>
                <textarea 
                  required
                  value={inquiryText} 
                  onChange={(e) => setInquiryText(e.target.value)} 
                  rows={5} 
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                  placeholder="具体的な変更内容やご相談事項をご記入ください..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsInquiryModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-sm">
                  キャンセル
                </button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm flex items-center gap-2">
                  <i className="bi bi-send-fill"></i> 担当者へ送信
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}