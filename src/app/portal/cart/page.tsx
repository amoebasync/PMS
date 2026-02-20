'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCart } from '@/components/portal/CartContext';

export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { items, removeItem, totalAmount } = useCart();

  const handleCheckout = () => {
    if (status === 'authenticated') {
      alert('決済機能 (Stripe連携など) へ進みます！');
      // router.push('/portal/checkout');
    } else {
      router.push('/portal/login?callbackUrl=/portal/cart');
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
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pt-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <i className="bi bi-cart3 text-indigo-600"></i> 
          ショッピングカート
        </h1>
        <Link href="/portal/orders/new" className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <i className="bi bi-plus-circle"></i> 発注を追加する
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* 左側: 商品一覧 */}
        <div className="lg:col-span-2 space-y-5">
          {items.map((item, index) => (
            <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-6 hover:shadow-md transition-shadow group">
              
              {/* アイコン */}
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 text-3xl shadow-inner ${item.type === 'PRINT_AND_POSTING' ? 'bg-indigo-50 text-indigo-500' : 'bg-fuchsia-50 text-fuchsia-500'}`}>
                <i className={`bi ${item.type === 'PRINT_AND_POSTING' ? 'bi-printer-fill' : 'bi-send-fill'}`}></i>
              </div>
              
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md uppercase tracking-widest mb-2 inline-block">
                      ITEM {index + 1}
                    </span>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{item.title}</h3>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0" title="削除">
                    <i className="bi bi-trash3-fill text-lg"></i>
                  </button>
                </div>
                
                {/* 詳細情報 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-5">
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <div className="w-5 flex justify-center"><i className="bi bi-calendar-event text-slate-400"></i></div>
                    {item.startDate ? item.startDate.replace(/-/g, '/') : '未定'} 〜 <span className="font-bold text-indigo-700">{item.endDate ? item.endDate.replace(/-/g, '/') : '未定'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <div className="w-5 flex justify-center"><i className="bi bi-geo-alt-fill text-slate-400"></i></div>
                    <span className="truncate" title={item.selectedAreas.map(a => a.name).join(', ')}>
                      {item.selectedAreas[0]?.name || '未指定'} <span className="text-[10px] text-slate-400">他 計{item.selectedAreas.length}ヶ所</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <div className="w-5 flex justify-center"><i className="bi bi-files text-slate-400"></i></div>
                    <span className="font-bold">{item.totalCount.toLocaleString()} <span className="text-[10px] font-normal">枚</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <div className="w-5 flex justify-center"><i className="bi bi-tag-fill text-slate-400"></i></div>
                    単価: ¥{(item.price / item.totalCount).toFixed(1)}
                  </div>
                </div>

                {/* 金額 */}
                <div className="pt-4 border-t border-slate-100 flex justify-end items-baseline gap-3">
                  <span className="text-xs font-bold text-slate-400">小計 (税抜)</span>
                  <span className="text-2xl font-black text-slate-800 tracking-tight">¥{item.price.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 右側: 決済サマリー (クリーンな白ベースに変更) */}
        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-fit sticky top-24">
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
          
          <div className="bg-slate-50 p-5 rounded-2xl mb-8 border border-slate-100">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-bold text-slate-700">合計</span>
              <span className="text-3xl font-black text-indigo-600 tracking-tighter">¥{Math.floor(totalAmount * 1.1).toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-right font-bold text-slate-400">税込</div>
          </div>

          <button 
            onClick={handleCheckout}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            {status === 'authenticated' ? (
              <>レジに進む (決済) <i className="bi bi-chevron-right"></i></>
            ) : (
              <>ログインしてレジに進む <i className="bi bi-box-arrow-in-right"></i></>
            )}
          </button>
          
          {!session && (
            <p className="text-[10px] text-slate-500 text-center mt-4 leading-relaxed font-medium">
              ※購入にはアカウントが必要です。<br/>まだお持ちでない方はログイン画面から<br/>「無料で登録する」へお進みください。
            </p>
          )}
        </div>

      </div>
    </div>
  );
}