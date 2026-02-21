'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCart } from '@/components/portal/CartContext';

export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { items, updateItem, removeItem, totalAmount, clearCart } = useCart();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [myFlyers, setMyFlyers] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT'); // 決済方法

  // チラシ一覧を取得
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/portal/flyers').then(res => res.json()).then(data => {
        if(Array.isArray(data)) setMyFlyers(data);
      }).catch(console.error);
    }
  }, [status]);

  const handleCheckout = async () => {
    if (status !== 'authenticated') {
      router.push('/portal/login?callbackUrl=/portal/cart');
      return;
    }

    // 全アイテムに案件名とチラシが設定されているかチェック
    const isReady = items.every(item => item.projectName && item.flyerId);
    if (!isReady) {
      alert('すべての発注アイテムに対して、「案件名」の入力と「チラシ」の選択を行ってください。');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/portal/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, paymentMethod })
      });
      
      if (res.ok) {
        clearCart();
        router.push('/portal/orders');
      } else {
        const data = await res.json();
        alert(`エラー: ${data.error || '決済処理に失敗しました。'}`);
        setIsProcessing(false);
      }
    } catch (e) {
      alert('通信エラーが発生しました。');
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="w-32 h-32 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">
          <i className="bi bi-cart-x-fill"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-700 mb-2 tracking-tight">カートは空です</h2>
        <p className="text-slate-500 mb-8 font-medium">ご希望のエリアを選択して、見積もりを作成しましょう。</p>
        <Link href="/portal/orders/new" className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2">
          <i className="bi bi-map-fill"></i> 発注シミュレーションを始める
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pt-4 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <i className="bi bi-cart3 text-indigo-600"></i> ショッピングカート
        </h1>
        <Link href="/portal/orders/new" className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <i className="bi bi-plus-circle"></i> 発注を追加する
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* 左側: 商品一覧 */}
        <div className="lg:col-span-2 space-y-6">
          {items.map((item, index) => (
            <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-6 hover:shadow-md transition-shadow">
              
              {/* アイテムヘッダー */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-inner ${item.type === 'PRINT_AND_POSTING' ? 'bg-indigo-50 text-indigo-500' : 'bg-fuchsia-50 text-fuchsia-500'}`}>
                    <i className={`bi ${item.type === 'PRINT_AND_POSTING' ? 'bi-printer-fill' : 'bi-send-fill'}`}></i>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md uppercase tracking-widest mb-1.5 inline-block">
                      ITEM {index + 1}
                    </span>
                    <h3 className="font-bold text-slate-800">{item.title}</h3>
                  </div>
                </div>
                <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0" title="削除">
                  <i className="bi bi-trash3-fill text-lg"></i>
                </button>
              </div>

              {/* ★ 追加: 案件名とチラシの選択フォーム */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1.5">案件名 (必須) <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="例: 春のキャンペーン第1弾" 
                    value={item.projectName || ''} 
                    onChange={e => updateItem(item.id, { projectName: e.target.value })}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1.5">使用するチラシ (必須) <span className="text-rose-500">*</span></label>
                  <div className="flex gap-2">
                    <select 
                      value={item.flyerId || ''} 
                      onChange={e => updateItem(item.id, { flyerId: e.target.value })}
                      className="flex-1 border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer"
                    >
                      <option value="">選択してください</option>
                      {myFlyers.map(f => <option key={f.id} value={f.id}>{f.name} (在庫: {f.stockCount})</option>)}
                      <option value="NEW">✨ 新しくチラシを入稿・登録する</option>
                    </select>
                  </div>
                  {item.flyerId === 'NEW' && <p className="text-[10px] text-fuchsia-600 font-bold mt-1.5"><i className="bi bi-info-circle-fill"></i> 決済完了後に入稿画面へご案内します。</p>}
                </div>
              </div>

              {/* 詳細情報 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs text-slate-600 font-medium px-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 text-center"><i className="bi bi-calendar-event text-slate-400"></i></div>
                  <span className="truncate">{item.startDate ? item.startDate.replace(/-/g, '/') : '未定'} 〜 {item.endDate ? item.endDate.replace(/-/g, '/') : '未定'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 text-center"><i className="bi bi-geo-alt-fill text-slate-400"></i></div>
                  <span className="truncate" title={item.selectedAreas.map(a => a.name).join(', ')}>
                    {item.selectedAreas[0]?.name || '未指定'} <span className="text-[10px] text-slate-400">他 計{item.selectedAreas.length}ヶ所</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 text-center"><i className="bi bi-files text-slate-400"></i></div>
                  <span className="font-bold">{item.totalCount.toLocaleString()} 枚</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end items-baseline gap-3">
                <span className="text-xs font-bold text-slate-400">小計 (税抜)</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight">¥{item.price.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 右側: 決済サマリー */}
        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-fit lg:sticky lg:top-24">
          <h3 className="font-black text-slate-800 text-lg mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
            <i className="bi bi-receipt-cutoff text-indigo-600"></i> ご注文内容
          </h3>
          
          <div className="space-y-4 mb-6 text-sm font-medium">
            <div className="flex justify-between text-slate-600">
              <span>小計 ({items.length}件)</span>
              <span className="font-bold text-slate-800">¥{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>消費税 (10%)</span>
              <span className="font-bold text-slate-800">¥{Math.floor(totalAmount * 0.1).toLocaleString()}</span>
            </div>
          </div>
          
          <div className="bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-100">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-bold text-slate-700">合計</span>
              <span className="text-3xl font-black text-indigo-600 tracking-tighter">¥{Math.floor(totalAmount * 1.1).toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-right font-bold text-slate-400">税込</div>
          </div>

          {/* ★ 追加: 決済方法の選択 */}
          <div className="mb-8">
             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">お支払い方法</label>
             <div className="space-y-2">
               <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'CREDIT' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                 <input type="radio" name="payment" value="CREDIT" checked={paymentMethod === 'CREDIT'} onChange={() => setPaymentMethod('CREDIT')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                 <div className="flex-1">
                   <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><i className="bi bi-credit-card-2-front text-indigo-600"></i>クレジットカード</div>
                   <div className="text-[10px] text-slate-500 mt-0.5">即時で発注が確定します</div>
                 </div>
               </label>
               <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'INVOICE' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                 <input type="radio" name="payment" value="INVOICE" checked={paymentMethod === 'INVOICE'} onChange={() => setPaymentMethod('INVOICE')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                 <div className="flex-1">
                   <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><i className="bi bi-file-earmark-text text-amber-600"></i>請求書払い (掛け払い)</div>
                   <div className="text-[10px] text-slate-500 mt-0.5">与信審査後に発注確定となります</div>
                 </div>
               </label>
             </div>
          </div>

          <button 
            onClick={handleCheckout}
            disabled={isProcessing}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> 処理中...</>
            ) : status === 'authenticated' ? (
              <>注文を確定する <i className="bi bi-chevron-right"></i></>
            ) : (
              <>ログインしてレジに進む <i className="bi bi-box-arrow-in-right"></i></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}