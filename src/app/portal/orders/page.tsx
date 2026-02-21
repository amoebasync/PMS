'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const STATUS_MAP: Record<string, { label: string, color: string, icon: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-500', icon: 'bi-pencil' },
  PLANNING: { label: '提案中', color: 'bg-slate-100 text-slate-500', icon: 'bi-chat-dots' },
  PENDING_PAYMENT: { label: '入金待ち', color: 'bg-orange-100 text-orange-700', icon: 'bi-coin' },
  PENDING_REVIEW: { label: '審査待ち', color: 'bg-yellow-100 text-yellow-700', icon: 'bi-hourglass-split' },
  ADJUSTING: { label: '要調整・修正', color: 'bg-rose-100 text-rose-700', icon: 'bi-exclamation-triangle-fill' },
  CONFIRMED: { label: '手配中(確定)', color: 'bg-blue-100 text-blue-700', icon: 'bi-check-circle-fill' },
  IN_PROGRESS: { label: '作業・配布中', color: 'bg-indigo-100 text-indigo-700', icon: 'bi-truck' },
  COMPLETED: { label: '完了', color: 'bg-emerald-100 text-emerald-700', icon: 'bi-flag-fill' },
  CANCELED: { label: 'キャンセル', color: 'bg-slate-200 text-slate-500', icon: 'bi-x-circle-fill' },
};

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/portal/orders');
        if (res.ok) setOrders(await res.json());
      } catch (e) {
        console.error(e);
      }
      setIsLoading(false);
    };
    fetchOrders();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pt-4">
      <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <i className="bi bi-clock-history text-indigo-600"></i> 
          発注履歴・ステータス
        </h1>
        <Link href="/portal/orders/new" className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2">
          <i className="bi bi-plus-lg"></i> 新規発注
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-400 font-bold">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          読み込み中...
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
            <i className="bi bi-box-seam"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">発注履歴がありません</h3>
          <p className="text-slate-500 mb-6 text-sm">システムからの発注履歴はここに一覧表示されます。</p>
          <Link href="/portal/orders/new" className="text-indigo-600 font-bold hover:underline">
            さっそくシミュレーションを始める &gt;
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const status = STATUS_MAP[order.status] || STATUS_MAP.PLANNING;
            
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-300 transition-colors">
                
                {/* オーダーヘッダー */}
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${status.color}`}>
                      <i className={`bi ${status.icon}`}></i> {status.label}
                    </span>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mr-2">Order No.</span>
                      <span className="font-mono font-bold text-slate-700">{order.orderNo}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold">発注日</div>
                      <div className="text-sm font-bold text-slate-700">{new Date(order.orderDate).toLocaleDateString('ja-JP')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold">合計金額 (税込)</div>
                      <div className="text-lg font-black text-slate-800">¥{order.totalAmount?.toLocaleString() || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* オーダー明細（配布・印刷） */}
                <div className="p-6">
                  {order.distributions?.map((dist: any, idx: number) => {
                     const isPrinting = order.printings?.some((p: any) => p.flyerId === dist.flyerId);
                     return (
                       <div key={dist.id} className={`${idx !== 0 ? 'mt-4 pt-4 border-t border-slate-100' : ''}`}>
                         <div className="flex items-start gap-4">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl shadow-inner ${isPrinting ? 'bg-indigo-50 text-indigo-500' : 'bg-fuchsia-50 text-fuchsia-500'}`}>
                             <i className={`bi ${isPrinting ? 'bi-printer-fill' : 'bi-send-fill'}`}></i>
                           </div>
                           <div className="flex-1">
                             <div className="flex gap-2 mb-1">
                               {isPrinting && <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">印刷込</span>}
                               <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{dist.method}</span>
                             </div>
                             <h4 className="font-bold text-slate-800 text-base mb-2">{dist.flyer?.name}</h4>
                             
                             <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                               <div><span className="text-slate-400 mr-1">配布予定:</span> <span className="font-bold">{dist.plannedCount?.toLocaleString()}</span> 枚</div>
                               <div><span className="text-slate-400 mr-1">エリア:</span> 
                                 <span className="font-bold" title={dist.areas?.map((a:any)=>a.area.city.name).join(', ')}>
                                   {dist.areas?.length} ヶ所
                                 </span>
                               </div>
                               <div><span className="text-slate-400 mr-1">期間:</span> {new Date(dist.startDate).toLocaleDateString('ja-JP')} 〜 <span className="font-bold text-indigo-600">{new Date(dist.endDate).toLocaleDateString('ja-JP')}</span></div>
                             </div>
                           </div>
                         </div>
                       </div>
                     )
                  })}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}