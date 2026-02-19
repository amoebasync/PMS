'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const STATUS_MAP: Record<string, { label: string, color: string }> = {
  PLANNING: { label: '提案中', color: 'bg-slate-100 text-slate-600' },
  CONFIRMED: { label: '受注済', color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: '作業中', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: '完了', color: 'bg-emerald-100 text-emerald-700' },
  CANCELED: { label: 'キャンセル', color: 'bg-rose-100 text-rose-700' },
};

export default function OrdersListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">受注番号 / 受注日</th>
              <th className="px-6 py-4">顧客名</th>
              <th className="px-6 py-4">担当営業</th>
              <th className="px-6 py-4 text-right">受注総額</th>
              <th className="px-6 py-4">ステータス</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">読み込み中...</td></tr> : 
             orders.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">受注データがありません</td></tr> :
             orders.map(o => {
               const status = STATUS_MAP[o.status] || STATUS_MAP['PLANNING'];
               return (
                <tr key={o.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <Link href={`/orders/${o.id}`} className="font-mono font-bold text-indigo-600 hover:underline">{o.orderNo}</Link>
                    <div className="text-xs text-slate-400 mt-1">{new Date(o.orderDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{o.customer?.name}</td>
                  <td className="px-6 py-4 text-slate-600">{o.salesRep ? `${o.salesRep.lastNameJa} ${o.salesRep.firstNameJa}` : '未定'}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    {o.totalAmount ? `¥${o.totalAmount.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${status.color}`}>
                      {status.label}
                    </span>
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
    </div>
  );
}