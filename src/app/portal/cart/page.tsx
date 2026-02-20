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
      // ログイン済みなら実際の決済画面や確認画面へ（今回はダミーの完了画面などを想定）
      alert('決済機能 (Stripe連携など) へ進みます！');
      // router.push('/portal/checkout');
    } else {
      // 未ログインならログイン画面へ飛ばし、ログイン後にカートに戻す
      router.push('/portal/login?callbackUrl=/portal/cart');
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center text-4xl mb-6">
          <i className="bi bi-cart-x-fill"></i>
        </div>
        <h2 className="text-2xl font-bold text-slate-700 mb-2">カートは空です</h2>
        <p className="text-slate-500 mb-8">ご希望のエリアを選択して、見積もりを作成しましょう。</p>
        <Link href="/portal/orders/new" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all">
          発注シミュレーションを始める
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <i className="bi bi-cart-check-fill text-indigo-600"></i> ショッピングカート
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左側: 商品一覧 */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-6">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shrink-0 text-3xl">
                <i className={`bi ${item.type === 'PRINT_AND_POSTING' ? 'bi-printer-fill' : 'bi-send-fill'}`}></i>
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-white bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">
                    Item {index + 1}
                  </span>
                  <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <i className="bi bi-trash3-fill"></i>
                  </button>
                </div>
                
                <h3 className="font-bold text-lg text-slate-800 mb-3">{item.title}</h3>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm mb-4">
                  <div className="text-slate-500">対象エリア数</div>
                  <div className="font-medium text-right">{item.selectedAreas.length} ヶ所</div>
                  
                  <div className="text-slate-500">予定配布枚数</div>
                  <div className="font-medium text-right">{item.totalCount.toLocaleString()} 枚</div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-400">小計 (税抜)</span>
                  <span className="text-xl font-black text-slate-800">¥{item.price.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 右側: 決済サマリー */}
        <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-xl h-fit sticky top-24">
          <h3 className="font-bold text-lg mb-6 border-b border-white/20 pb-4">ご注文内容の確認</h3>
          
          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>小計 ({items.length}件)</span>
              <span>¥{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>消費税 (10%)</span>
              <span>¥{Math.floor(totalAmount * 0.1).toLocaleString()}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-baseline border-t border-white/20 pt-4 mb-8">
            <span className="font-bold">合計</span>
            <span className="text-3xl font-black text-emerald-400">¥{Math.floor(totalAmount * 1.1).toLocaleString()}</span>
          </div>

          <button 
            onClick={handleCheckout}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {status === 'authenticated' ? (
              <><i className="bi bi-credit-card-fill"></i> レジに進む (決済)</>
            ) : (
              <><i className="bi bi-box-arrow-in-right"></i> ログインしてレジに進む</>
            )}
          </button>
          
          {!session && (
            <p className="text-[10px] text-slate-400 text-center mt-3">
              ※購入にはアカウントが必要です。<br/>まだお持ちでない方はログイン画面から「無料で登録する」へお進みください。
            </p>
          )}
        </div>

      </div>
    </div>
  );
}