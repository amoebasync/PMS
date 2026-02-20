'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSalesRep, setFilterSalesRep] = useState('ALL');

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
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const target = `${o.orderNo} ${o.customer?.name || ''} ${o.customer?.nameKana || ''}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filterStatus, filterSalesRep, searchQuery]);


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

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">キーワード検索</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="受注番号、顧客名など..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
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
            {/* ★ 修正: この行のコメントを削除してHydration Errorを解消しました */}
            <tr>
              <th className="px-6 py-4">受注番号 / 受注日</th>
              <th className="px-6 py-4">顧客名</th>
              <th className="px-6 py-4">担当営業</th>
              <th className="px-6 py-4">依頼内訳</th>
              <th className="px-6 py-4 text-right">受注総額</th>
              <th className="px-6 py-4">ステータス</th>
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

               return (
                <tr key={o.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <Link href={`/orders/${o.id}`} className="font-mono font-bold text-indigo-600 hover:underline">{o.orderNo}</Link>
                    <div className="text-xs text-slate-400 mt-1">{new Date(o.orderDate).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{o.customer?.name}</td>
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