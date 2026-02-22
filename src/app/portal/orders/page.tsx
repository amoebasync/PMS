'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUS_MAP: Record<string, { label: string, color: string, icon: string }> = {
  DRAFT: { label: '一時保存', color: 'bg-slate-100 text-slate-600', icon: 'bi-save' },
  PLANNING: { label: '提案中', color: 'bg-blue-100 text-blue-700', icon: 'bi-lightbulb' },
  PENDING_PAYMENT: { label: '入金待ち', color: 'bg-amber-100 text-amber-700', icon: 'bi-wallet2' },
  PENDING_SUBMISSION: { label: 'データ入稿待ち', color: 'bg-fuchsia-100 text-fuchsia-700', icon: 'bi-cloud-arrow-up' },
  PENDING_REVIEW: { label: '審査待ち', color: 'bg-orange-100 text-orange-700', icon: 'bi-hourglass-split' },
  ADJUSTING: { label: '調整中', color: 'bg-indigo-100 text-indigo-700', icon: 'bi-tools' },
  CONFIRMED: { label: '受注確定', color: 'bg-emerald-100 text-emerald-700', icon: 'bi-check-circle' },
  IN_PROGRESS: { label: '作業中/配布中', color: 'bg-blue-100 text-blue-700', icon: 'bi-bicycle' },
  COMPLETED: { label: '完了', color: 'bg-slate-800 text-white', icon: 'bi-flag-fill' },
  CANCELED: { label: 'キャンセル', color: 'bg-rose-100 text-rose-700', icon: 'bi-x-circle' },
};

export default function PortalOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const PreviewElement = ({ url }: { url: string }) => {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.match(/\.(jpeg|jpg|png|webp|gif)$/)) {
      return <img src={url} alt="Preview" className="w-full h-full object-cover rounded-xl shadow-inner border border-slate-200" />;
    }
    if (lower.endsWith('.pdf')) {
      return <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full object-cover rounded-xl shadow-inner border border-slate-200 pointer-events-none" />;
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 border border-slate-200 rounded-xl text-slate-400">
        <i className="bi bi-file-earmark-zip-fill text-3xl mb-1"></i>
        <span className="text-[10px] font-bold">Preview N/A</span>
      </div>
    );
  };

  if (isLoading) return <div className="p-20 text-center text-slate-500">読み込み中...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-10">
      
      <div className="flex justify-between items-end border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <i className="bi bi-card-list text-blue-600"></i> 発注履歴一覧
          </h1>
          <p className="text-slate-500 text-sm mt-1">過去の発注状況の確認や、データの入稿を行えます。</p>
        </div>
        <Link href="/portal/orders/new" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
          <i className="bi bi-plus-lg"></i> 新しい発注
        </Link>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200">
            <i className="bi bi-inbox text-4xl text-slate-300 mb-3 block"></i>
            <p className="text-slate-500 font-bold">まだ発注履歴がありません。</p>
          </div>
        ) : (
          orders.map(order => {
            const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-600', icon: 'bi-circle' };
            const printing = order.printings?.[0]; 
            
            return (
              <div key={order.id} className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between gap-6 hover:shadow-md transition-shadow">
                
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-slate-400 text-xs font-bold bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      {order.orderNo}
                    </span>
                    <span className={`px-3 py-1 text-xs font-black rounded-full flex items-center gap-1.5 shadow-sm ${statusInfo.color}`}>
                      <i className={`bi ${statusInfo.icon}`}></i> {statusInfo.label}
                    </span>
                    {order.status === 'PENDING_SUBMISSION' && (
                       <span className="text-[10px] text-fuchsia-600 font-bold animate-pulse">※印刷データの入稿が必要です</span>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">{order.title || '無題の案件'}</h3>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                      <i className="bi bi-calendar-event"></i> 発注日: {new Date(order.orderDate).toLocaleDateString('ja-JP')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {order.distributions?.map((d: any, idx: number) => (
                      <div key={idx} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-100 flex items-center gap-1.5">
                        <i className="bi bi-send-fill"></i> {d.method} : {d.plannedCount.toLocaleString()} 枚
                      </div>
                    ))}
                  </div>

                  {(printing?.frontDesignUrl || printing?.backDesignUrl) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-4">
                       {printing.frontDesignUrl && (
                         <div className="w-24 h-32 relative group">
                            <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg rounded-tl-xl z-10 backdrop-blur-sm">表面</div>
                            <PreviewElement url={printing.frontDesignUrl} />
                         </div>
                       )}
                       {printing.backDesignUrl && (
                         <div className="w-24 h-32 relative group">
                            <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg rounded-tl-xl z-10 backdrop-blur-sm">裏面</div>
                            <PreviewElement url={printing.backDesignUrl} />
                         </div>
                       )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 min-w-[200px]">
                  <div className="mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">合計金額 (税込)</div>
                    <div className="text-2xl font-black text-slate-800 tracking-tight">
                      ¥{order.totalAmount?.toLocaleString() || '---'}
                    </div>
                  </div>
                  
                  {/* ★ ボタンをLinkに変更 (専用ページへの遷移) */}
                  {order.status === 'PENDING_SUBMISSION' ? (
                    <Link href={`/portal/orders/${order.id}/submit`} className="w-full px-5 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group">
                      <i className="bi bi-cloud-arrow-up-fill group-hover:-translate-y-1 transition-transform"></i> データを入稿する
                    </Link>
                  ) : (
                    <Link href={`/portal/orders/${order.id}`} className="w-full text-center px-5 py-2.5 bg-slate-50 hover:bg-blue-50 text-blue-600 font-bold border border-slate-200 hover:border-blue-200 rounded-xl text-sm transition-colors">
                      詳細を確認
                    </Link>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}