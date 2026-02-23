// src/app/portal/orders/page.tsx
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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

function PortalOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetOrderId = searchParams.get('orderId');

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

  // --- QRコード管理用 State ---
  const [modalTab, setModalTab] = useState<'detail' | 'qr'>('detail');
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isQrSaving, setIsQrSaving] = useState(false);
  const [qrForm, setQrForm] = useState({ redirectUrl: '', alias: '', memo: '' });
  const [editingQrId, setEditingQrId] = useState<number | null>(null);
  const [editQrForm, setEditQrForm] = useState({ redirectUrl: '', memo: '' });
  const [qrOptions, setQrOptions] = useState<Record<number, { transparent: boolean }>>({});
  // スタンドアロンQR割り当て用 State
  const [standaloneQrCodes, setStandaloneQrCodes] = useState<any[]>([]);
  const [isStandaloneQrLoading, setIsStandaloneQrLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState<number | null>(null);

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
        closeOrderModal();
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

  // フィルタリング処理（URLパラメータ targetOrderId も考慮）
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 通知から飛んできた場合はその案件のみ表示
      if (targetOrderId && o.id.toString() !== targetOrderId) return false;
      
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const target = `${o.orderNo} ${o.title || ''}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filterStatus, searchQuery, targetOrderId]);

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

  // ★ 左カラムステータスフィルターの共通コンポーネント化
  const renderStatusFilterItem = (id: string, icon: string, label: string, count: number) => {
    const isActive = filterStatus === id;
    return (
      <div 
        className={`flex justify-between items-center text-sm p-3 rounded-lg cursor-pointer transition-colors border ${
          isActive 
            ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
            : 'border-transparent hover:bg-slate-50'
        }`}
        onClick={() => setFilterStatus(id)}
      >
        <span className={`font-bold flex items-center ${isActive ? 'text-indigo-700' : 'text-slate-600'}`}>
          <i className={`bi ${icon} mr-2 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}></i>
          {label}
        </span>
        <span className={`font-bold ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
          {count} <span className="text-[10px] font-normal text-slate-400">件</span>
        </span>
      </div>
    );
  };

  // --- モーダル開閉ヘルパー ---
  const openOrderModal = (order: any) => {
    setSelectedOrder(order);
    setModalTab('detail');
    setQrCodes([]);
    setEditingQrId(null);
    setQrForm({ redirectUrl: '', alias: '', memo: '' });
  };

  const closeOrderModal = () => {
    setSelectedOrder(null);
    setModalTab('detail');
    setQrCodes([]);
    setEditingQrId(null);
  };

  // --- QRコード操作関数 ---
  const fetchQrCodes = async (flyerId: number) => {
    setIsQrLoading(true);
    try {
      const res = await fetch(`/api/portal/flyers/${flyerId}/qrcodes`);
      if (res.ok) setQrCodes(await res.json());
    } catch (e) { console.error(e); }
    setIsQrLoading(false);
  };

  const saveQrCode = async (e: React.FormEvent, flyerId: number) => {
    e.preventDefault();
    setIsQrSaving(true);
    try {
      const res = await fetch(`/api/portal/flyers/${flyerId}/qrcodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qrForm),
      });
      if (res.ok) {
        setQrForm({ redirectUrl: '', alias: '', memo: '' });
        fetchQrCodes(flyerId);
      } else {
        const err = await res.json();
        alert(err.error || 'エラーが発生しました');
      }
    } catch (e) { alert('通信エラーが発生しました'); }
    setIsQrSaving(false);
  };

  const deleteQrCode = async (qrId: number, flyerId: number) => {
    if (!confirm('このQRコードを削除しますか？\nスキャン履歴も削除されます。この操作は元に戻せません。')) return;
    const res = await fetch(`/api/portal/qrcodes/${qrId}`, { method: 'DELETE' });
    if (res.ok) fetchQrCodes(flyerId);
  };

  const toggleQrActive = async (qr: any, flyerId: number) => {
    const res = await fetch(`/api/portal/qrcodes/${qr.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !qr.isActive }),
    });
    if (res.ok) fetchQrCodes(flyerId);
  };

  const startEditQr = (qr: any) => {
    setEditingQrId(qr.id);
    setEditQrForm({ redirectUrl: qr.redirectUrl, memo: qr.memo || '' });
  };

  const saveEditQr = async (qrId: number, flyerId: number) => {
    const res = await fetch(`/api/portal/qrcodes/${qrId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editQrForm),
    });
    if (res.ok) {
      setEditingQrId(null);
      fetchQrCodes(flyerId);
    }
  };

  const fetchStandaloneQrCodes = async () => {
    setIsStandaloneQrLoading(true);
    try {
      const res = await fetch('/api/portal/qrcodes?unlinked=true');
      if (res.ok) {
        const data = await res.json();
        setStandaloneQrCodes(data.qrCodes || []);
      }
    } catch (e) { console.error(e); }
    setIsStandaloneQrLoading(false);
  };

  const assignQrToFlyer = async (qrId: number, flyerId: number) => {
    setIsAssigning(qrId);
    try {
      const res = await fetch(`/api/portal/qrcodes/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flyerId }),
      });
      if (res.ok) {
        // スタンドアロン一覧から除外し、チラシ紐付きQR一覧を再取得
        setStandaloneQrCodes(prev => prev.filter(q => q.id !== qrId));
        fetchQrCodes(flyerId);
      } else {
        alert('割り当てに失敗しました。');
      }
    } catch (e) { alert('通信エラーが発生しました。'); }
    setIsAssigning(null);
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

      {/* 通知からの絞り込み解除ボタン */}
      {targetOrderId && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center text-indigo-800 text-sm font-bold shadow-sm">
          <span><i className="bi bi-funnel-fill mr-2"></i> 通知された案件のみを表示しています</span>
          <button onClick={() => router.push('/portal/orders')} className="px-4 py-1.5 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors text-xs">
            すべて表示に戻す
          </button>
        </div>
      )}

      {/* 要対応アクションアラート (絞り込みされていない時だけ表示) */}
      {!targetOrderId && needsActionCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-sm">
          <div className="font-bold mb-3 flex items-center gap-2 text-rose-800 text-sm">
            <i className="bi bi-exclamation-triangle-fill"></i> 要対応アクションがあります。
          </div>
          <ul className="space-y-2 ml-1 text-sm">
            {pendingPaymentCount > 0 && (
              <li>
                <button onClick={() => setFilterStatus('PENDING_PAYMENT')} className="flex items-center gap-2 hover:underline text-rose-600 font-medium transition-all hover:translate-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  入金待ちの案件が <span className="font-bold mx-0.5">{pendingPaymentCount}</span> 件あります。
                  <i className="bi bi-chevron-right text-[10px] opacity-50 ml-1"></i>
                </button>
              </li>
            )}
            {pendingSubmissionCount > 0 && (
              <li>
                <button onClick={() => setFilterStatus('PENDING_SUBMISSION')} className="flex items-center gap-2 hover:underline text-rose-600 font-medium transition-all hover:translate-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  入稿待ちの案件が <span className="font-bold mx-0.5">{pendingSubmissionCount}</span> 件あります。
                  <i className="bi bi-chevron-right text-[10px] opacity-50 ml-1"></i>
                </button>
              </li>
            )}
            {adjustingCount > 0 && (
              <li>
                <button onClick={() => setFilterStatus('ADJUSTING')} className="flex items-center gap-2 hover:underline text-rose-600 font-medium transition-all hover:translate-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  調整中の案件が <span className="font-bold mx-0.5">{adjustingCount}</span> 件あります。
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
              <i className="bi bi-pie-chart-fill text-indigo-500"></i> ステータス別件数
            </h3>
            
            <div className="space-y-1">
              {renderStatusFilterItem('PENDING_PAYMENT', 'bi-wallet2', '入金待ち', pendingPaymentCount)}
              {renderStatusFilterItem('PENDING_SUBMISSION', 'bi-cloud-arrow-up', '入稿待ち', pendingSubmissionCount)}
              {renderStatusFilterItem('PENDING_REVIEW', 'bi-hourglass-split', '審査中', countByStatus('PENDING_REVIEW'))}
              {renderStatusFilterItem('ADJUSTING', 'bi-tools', '調整中', adjustingCount)}
              {renderStatusFilterItem('CONFIRMED', 'bi-box-seam', '手配中', countByStatus('CONFIRMED'))}
              {renderStatusFilterItem('IN_PROGRESS', 'bi-bicycle', '作業中', countByStatus('IN_PROGRESS'))}
            </div>
          </div>
          
          <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 text-xs text-slate-500 leading-relaxed font-medium">
            <i className="bi bi-info-circle-fill text-slate-400 mr-1"></i>
            審査通過後に手配が開始された案件は、画面上からキャンセルすることができません。<br/><br/>
            エリアや内容の変更をご希望の場合は、各案件の詳細画面より「<i className="bi bi-chat-dots mx-1"></i>」アイコンからお問い合わせください。
          </div>
        </div>

        {/* ========================================================= */}
        {/* 右カラム：発注一覧 */}
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
                  placeholder="案件名などで検索..." 
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
            
            {/* デスクトップ用 テーブルヘッダー */}
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
                    <div
                      key={order.id}
                      onClick={() => openOrderModal(order)}
                      className="flex flex-col lg:flex-row lg:items-center px-5 lg:px-6 py-4 gap-6 hover:bg-blue-50/50 transition-colors cursor-pointer"
                    >
                      
                      {/* モバイルレイアウト */}
                      <div className="lg:hidden flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 border ${statusInfo.color}`}>
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
                        <span className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center text-center gap-1.5 w-full border ${statusInfo.color}`}>
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
                          <Link 
                            href={`/portal/orders/${order.id}/submit`} 
                            onClick={(e) => e.stopPropagation()}
                            className="w-full lg:w-full px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-md text-xs font-bold shadow-sm transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            入稿
                          </Link>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); openOrderModal(order); }}
                            className="w-full lg:w-full px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs font-bold border border-slate-300 transition-all text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
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
      {selectedOrder && (() => {
        const flyerId = selectedOrder.distributions?.[0]?.flyerId as number | undefined;
        return (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" onClick={closeOrderModal}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>

              {/* ヘッダー */}
              <div className="px-6 py-4 bg-slate-800 text-white flex justify-between items-center shrink-0">
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1">{selectedOrder.orderNo}</div>
                  <h3 className="font-bold text-lg leading-tight">{selectedOrder.title}</h3>
                </div>
                <button onClick={closeOrderModal} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors"><i className="bi bi-x-lg"></i></button>
              </div>

              {/* タブナビゲーション */}
              <div className="flex border-b border-slate-200 bg-white shrink-0">
                <button
                  onClick={() => setModalTab('detail')}
                  className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === 'detail' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  <i className="bi bi-card-checklist"></i> 手配内容
                </button>
                <button
                  onClick={() => {
                    setModalTab('qr');
                    if (flyerId && qrCodes.length === 0) fetchQrCodes(flyerId);
                    if (standaloneQrCodes.length === 0) fetchStandaloneQrCodes();
                  }}
                  className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === 'qr' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  <i className="bi bi-qr-code"></i> QRコード管理
                </button>
              </div>

              {/* ボディ */}
              <div className="flex-1 overflow-hidden bg-slate-50">

                {/* --- 手配内容タブ --- */}
                {modalTab === 'detail' && (
                  <div className="h-full overflow-y-auto p-6 space-y-8 custom-scrollbar">
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
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* --- QRコード管理タブ --- */}
                {modalTab === 'qr' && (
                  <div className="flex flex-col md:flex-row h-full overflow-hidden">

                    {/* 左側: 新規作成フォーム */}
                    <div className="w-full md:w-[280px] shrink-0 bg-white border-r border-slate-200 p-5 overflow-y-auto custom-scrollbar">
                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                        <i className="bi bi-plus-circle-fill text-indigo-500"></i> 新規QRコード発行
                      </h4>

                      {flyerId ? (
                        <form onSubmit={(e) => saveQrCode(e, flyerId)} className="space-y-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              転送先URL <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="url"
                              required
                              value={qrForm.redirectUrl}
                              onChange={e => setQrForm({ ...qrForm, redirectUrl: e.target.value })}
                              className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="https://example.com/lp"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">チラシのQRコードを読んだ人が飛ぶ先のURL</p>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                              エイリアス <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center text-sm border border-slate-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                              <span className="bg-slate-100 text-slate-500 px-2.5 py-2.5 text-[10px] font-mono border-r border-slate-300 shrink-0 whitespace-nowrap">/q/</span>
                              <input
                                type="text"
                                required
                                value={qrForm.alias}
                                onChange={e => setQrForm({ ...qrForm, alias: e.target.value })}
                                className="w-full p-2.5 outline-none font-mono text-sm"
                                placeholder="my-campaign"
                                pattern="[a-zA-Z0-9\-_]+"
                                title="半角英数字・ハイフン・アンダースコアのみ"
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">半角英数字・ハイフン・アンダースコアのみ使用可</p>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">識別メモ</label>
                            <input
                              type="text"
                              value={qrForm.memo}
                              onChange={e => setQrForm({ ...qrForm, memo: e.target.value })}
                              className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="表面右下用 など"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isQrSaving}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {isQrSaving ? (
                              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> 発行中...</>
                            ) : (
                              <><i className="bi bi-qr-code"></i> QRコードを発行</>
                            )}
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-slate-400">この発注にはチラシが紐付いていません。</p>
                      )}

                      <div className="mt-6 pt-5 border-t border-slate-100 bg-indigo-50/50 rounded-xl p-4 text-[10px] text-indigo-800 leading-relaxed">
                        <i className="bi bi-lightbulb-fill text-indigo-400 mr-1"></i>
                        QRコードをチラシに印刷することで、スキャン数・ユニーク人数をリアルタイムで計測できます。
                      </div>
                    </div>

                    {/* 右側: 発行済みQRコード一覧 */}
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">

                      {/* スタンドアロンQR割り当てセクション */}
                      {flyerId && (
                        <div className="mb-5 bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-4">
                          <h4 className="font-bold text-fuchsia-800 mb-3 flex items-center gap-2 text-sm">
                            <i className="bi bi-link-45deg text-fuchsia-500"></i> 既存のスタンドアロンQRをこのチラシに割り当て
                          </h4>
                          {isStandaloneQrLoading ? (
                            <div className="text-center py-3 text-slate-400 text-xs flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
                              読み込み中...
                            </div>
                          ) : standaloneQrCodes.length === 0 ? (
                            <p className="text-[11px] text-fuchsia-600 text-center py-1">割り当て可能なスタンドアロンQRコードがありません</p>
                          ) : (
                            <div className="space-y-2">
                              {standaloneQrCodes.map(qr => (
                                <div key={qr.id} className="flex items-center gap-3 bg-white border border-fuchsia-100 rounded-lg px-3 py-2.5 shadow-sm">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 text-sm truncate">
                                      {qr.memo || <span className="text-slate-400 font-normal">(メモなし)</span>}
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-400 truncate mt-0.5">/q/{qr.alias}</div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                      <i className="bi bi-calendar3 mr-1"></i>
                                      作成日：{new Date(qr.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => assignQrToFlyer(qr.id, flyerId)}
                                    disabled={isAssigning === qr.id}
                                    className="shrink-0 px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {isAssigning === qr.id ? (
                                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                      <><i className="bi bi-link-45deg"></i> 割り当て</>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {isQrLoading ? (
                        <div className="flex items-center justify-center h-40 text-slate-400">
                          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mr-2"></div>
                          読み込み中...
                        </div>
                      ) : qrCodes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center">
                          <i className="bi bi-qr-code text-5xl mb-3 opacity-20"></i>
                          <p className="text-sm font-bold">まだQRコードがありません</p>
                          <p className="text-xs mt-1">左のフォームから作成してください</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {qrCodes.map((qr: any) => {
                            const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/q/${qr.alias}` : `/q/${qr.alias}`;
                            const isTransp = qrOptions[qr.id]?.transparent || false;
                            const dlPng = `/api/portal/qrcodes/download?data=${encodeURIComponent(qrUrl)}&format=png&transparent=${isTransp}&alias=${qr.alias}`;
                            const dlSvg = `/api/portal/qrcodes/download?data=${encodeURIComponent(qrUrl)}&format=svg&transparent=${isTransp}&alias=${qr.alias}`;

                            return (
                              <div key={qr.id} className={`flex gap-4 p-4 border rounded-2xl shadow-sm transition-all ${qr.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'}`}>

                                {/* QR画像 + ダウンロード */}
                                <div className="shrink-0 flex flex-col items-center gap-2 w-[88px]">
                                  <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
                                    <img
                                      src={`https://quickchart.io/qr?text=${encodeURIComponent(qrUrl)}&size=200&margin=1`}
                                      alt="QR Code"
                                      className="w-[72px] h-[72px] object-contain"
                                    />
                                  </div>
                                  <label className="flex items-center gap-1 cursor-pointer text-[9px] text-slate-500 hover:text-indigo-600 transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={isTransp}
                                      onChange={e => setQrOptions({ ...qrOptions, [qr.id]: { transparent: e.target.checked } })}
                                      className="accent-indigo-600 w-3 h-3"
                                    />
                                    背景透過
                                  </label>
                                  <div className="flex gap-1 w-full">
                                    <a href={dlPng} download={`QR_${qr.alias}.png`} className="flex-1 text-center bg-indigo-50 text-indigo-600 text-[9px] font-bold py-1 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors">
                                      <i className="bi bi-download"></i> PNG
                                    </a>
                                    <a href={dlSvg} download={`QR_${qr.alias}.svg`} className="flex-1 text-center bg-fuchsia-50 text-fuchsia-600 text-[9px] font-bold py-1 rounded border border-fuchsia-200 hover:bg-fuchsia-100 transition-colors">
                                      <i className="bi bi-download"></i> SVG
                                    </a>
                                  </div>
                                </div>

                                {/* 情報・編集・統計 */}
                                <div className="flex-1 min-w-0">
                                  {editingQrId === qr.id ? (
                                    <div className="space-y-2.5">
                                      <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">転送先URL</label>
                                        <input
                                          type="url"
                                          value={editQrForm.redirectUrl}
                                          onChange={e => setEditQrForm({ ...editQrForm, redirectUrl: e.target.value })}
                                          className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">メモ</label>
                                        <input
                                          type="text"
                                          value={editQrForm.memo}
                                          onChange={e => setEditQrForm({ ...editQrForm, memo: e.target.value })}
                                          className="w-full text-xs border border-slate-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <div className="flex gap-2 mt-1">
                                        <button
                                          onClick={() => setEditingQrId(null)}
                                          className="px-3 py-1.5 text-[11px] font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                        >
                                          キャンセル
                                        </button>
                                        <button
                                          onClick={() => flyerId && saveEditQr(qr.id, flyerId)}
                                          className="px-3 py-1.5 text-[11px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                        >
                                          保存する
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {/* ステータス・操作ボタン */}
                                      <div className="flex justify-between items-center mb-2.5">
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => flyerId && toggleQrActive(qr, flyerId)}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${qr.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
                                          >
                                            <span className={`w-1.5 h-1.5 rounded-full ${qr.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                            {qr.isActive ? '有効' : '無効'}
                                          </button>
                                          {qr.memo && (
                                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 font-medium truncate max-w-[100px]" title={qr.memo}>
                                              {qr.memo}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => startEditQr(qr)}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 text-sm border border-slate-200 rounded-lg hover:border-indigo-200 bg-white transition-colors"
                                            title="編集"
                                          >
                                            <i className="bi bi-pencil"></i>
                                          </button>
                                          <button
                                            onClick={() => flyerId && deleteQrCode(qr.id, flyerId)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 text-sm border border-slate-200 rounded-lg hover:border-rose-200 bg-white transition-colors"
                                            title="削除"
                                          >
                                            <i className="bi bi-trash"></i>
                                          </button>
                                        </div>
                                      </div>

                                      {/* QR URL */}
                                      <div className="mb-2">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-0.5">QR URL</div>
                                        <div className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1.5 rounded-lg truncate" title={qrUrl}>
                                          {qrUrl}
                                        </div>
                                      </div>

                                      {/* 転送先URL */}
                                      <div className="mb-3">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-0.5">転送先</div>
                                        <a href={qr.redirectUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline truncate block" title={qr.redirectUrl}>
                                          <i className="bi bi-link-45deg mr-0.5"></i>{qr.redirectUrl}
                                        </a>
                                      </div>

                                      {/* スキャン統計 */}
                                      <div className="flex items-center gap-5 pt-2.5 border-t border-slate-100">
                                        <div>
                                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Scans</div>
                                          <div className="text-xl font-black text-slate-700 flex items-center gap-1">
                                            <i className="bi bi-qr-code-scan text-slate-300 text-sm"></i>
                                            {qr._count?.scanLogs || 0}
                                          </div>
                                        </div>
                                        <div className="w-px h-6 bg-slate-200"></div>
                                        <div>
                                          <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Unique</div>
                                          <div className="text-xl font-black text-emerald-600 flex items-center gap-1">
                                            <i className="bi bi-person-check text-emerald-300 text-sm"></i>
                                            {qr.uniqueScans || 0}
                                          </div>
                                        </div>
                                        <div className="ml-auto text-[9px] text-slate-400">
                                          作成: {new Date(qr.createdAt).toLocaleDateString('ja-JP')}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* フッター */}
              <div className="p-5 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                <button onClick={closeOrderModal} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">
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
        );
      })()}

      {/* --- キャンセル確認モーダル --- */}
      {isCancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95" onClick={() => setIsCancelModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95" onClick={() => setIsInquiryModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
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

// Next.js の仕様により、useSearchParams を使用するコンポーネントは Suspense で囲む必要があります。
export default function PortalOrdersPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-slate-500"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>データを読み込んでいます...</div>}>
      <PortalOrdersContent />
    </Suspense>
  );
}