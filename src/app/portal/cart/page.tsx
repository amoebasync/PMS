'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCart, CartItem } from '@/components/portal/CartContext';
import { useNotification } from '@/components/ui/NotificationProvider';

export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { items, updateItem, removeItem, totalAmount, clearCart } = useCart();
  const { showToast } = useNotification();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [myFlyers, setMyFlyers] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);
  const [customerIndustryId, setCustomerIndustryId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT');

  // 全エリア表示モーダル用のState
  const [viewAreasItem, setViewAreasItem] = useState<CartItem | null>(null);

  // チラシ選択モーダル用のState
  const [flyerSizes, setFlyerSizes] = useState<any[]>([]);
  const [foldingTypes, setFoldingTypes] = useState<any[]>([]);
  const [flyerModalItemId, setFlyerModalItemId] = useState<string | null>(null);
  const [flyerSearch, setFlyerSearch] = useState('');
  const [flyerModalTab, setFlyerModalTab] = useState<'select' | 'new'>('select');
  const [newFlyerName, setNewFlyerName] = useState('');
  const [newFlyerIndustryId, setNewFlyerIndustryId] = useState<number | undefined>(undefined);
  const [newFlyerSizeName, setNewFlyerSizeName] = useState('');
  const [newFlyerFoldingTypeId, setNewFlyerFoldingTypeId] = useState<number | undefined>(undefined);
  const [priceConfirm, setPriceConfirm] = useState<{ oldPrice: number; newPrice: number; updates: Partial<CartItem> } | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/portal/flyers').then(res => res.json()).then(data => {
        if (data.flyers) {
          setMyFlyers(data.flyers);
          setIndustries(data.industries || []);
          setFlyerSizes(data.flyerSizes || []);
          setFoldingTypes(data.foldingTypes || []);
          if (data.customerIndustryId) setCustomerIndustryId(data.customerIndustryId);
        } else if (Array.isArray(data)) {
          setMyFlyers(data);
        }
      }).catch(console.error);
    }
  }, [status]);

  // 折りステータスのラベル
  const foldStatusLabel = (s: string) => {
    switch (s) {
      case 'NEEDS_FOLDING': return '要折り';
      case 'FOLDED': return '折り済み';
      case 'NO_FOLDING_REQUIRED': return '折りなし';
      default: return s;
    }
  };

  // チラシモーダルを開く
  const openFlyerModal = (itemId: string, tab: 'select' | 'new') => {
    const item = items.find(i => i.id === itemId);
    setFlyerModalItemId(itemId);
    setFlyerSearch('');
    setFlyerModalTab(tab);
    setPriceConfirm(null);
    if (item) {
      setNewFlyerName(item.flyerName || item.projectName || '');
      setNewFlyerIndustryId(item.industryId ?? customerIndustryId ?? undefined);
      setNewFlyerSizeName(item.size);
      setNewFlyerFoldingTypeId(item.foldingTypeId);
    }
  };

  // 新規チラシの価格再計算
  const calcNewPrice = (item: CartItem, sizeName: string, foldingTypeId?: number) => {
    const oldSize = flyerSizes.find((s: any) => s.name === item.size);
    const newSize = flyerSizes.find((s: any) => s.name === sizeName);
    if (!oldSize || !newSize) return { price: item.price, unitPrice: item.unitPrice };

    const newUnitPrice = item.unitPrice - (oldSize.basePriceAddon ?? 0) + (newSize.basePriceAddon ?? 0);
    const distTotal = item.totalCount * newUnitPrice;

    let printTotal = 0;
    let foldingFee = 0;
    const folding = foldingTypes.find((f: any) => f.id === foldingTypeId);
    const foldingPrice = folding?.unitPrice ?? 0;

    if (item.type === 'PRINT_AND_POSTING') {
      const printCount = item.printCount || item.totalCount;
      printTotal = printCount * (newSize.printUnitPrice + foldingPrice);
    } else if (foldingTypeId && foldingPrice > 0) {
      // POSTING_ONLY: 折り加工は別途費用
      foldingFee = item.totalCount * foldingPrice;
    }

    return { price: Math.floor(distTotal + printTotal + foldingFee), unitPrice: newUnitPrice };
  };

  // 新規チラシ確定ハンドラ
  const handleNewFlyerConfirm = () => {
    if (!flyerModalItemId) return;
    const item = items.find(i => i.id === flyerModalItemId);
    if (!item) return;

    const newFolding = foldingTypes.find((f: any) => f.id === newFlyerFoldingTypeId);
    const { price: newPrice, unitPrice: newUnitPrice } = calcNewPrice(item, newFlyerSizeName, newFlyerFoldingTypeId);

    const updates: Partial<CartItem> = {
      flyerId: 'NEW',
      flyerName: newFlyerName || undefined,
      industryId: newFlyerIndustryId,
      size: newFlyerSizeName,
    };

    updates.foldingTypeId = newFlyerFoldingTypeId;
    updates.foldingTypeName = newFolding?.name;
    updates.foldingUnitPrice = newFolding?.unitPrice ?? 0;

    if (newPrice !== item.price) {
      updates.price = newPrice;
      updates.unitPrice = newUnitPrice;
      setPriceConfirm({ oldPrice: item.price, newPrice, updates });
      return;
    }

    updateItem(flyerModalItemId, updates);
    setFlyerModalItemId(null);
  };

  // 価格変更確認の承認
  const handlePriceConfirmAccept = () => {
    if (!flyerModalItemId || !priceConfirm) return;
    updateItem(flyerModalItemId, priceConfirm.updates);
    setPriceConfirm(null);
    setFlyerModalItemId(null);
  };

  // 発注を確定する (一括決済)
  const handleCheckout = async () => {
    if (status !== 'authenticated') {
      router.push('/portal/login?callbackUrl=/portal/cart');
      return;
    }

    const isReady = items.every(item => item.projectName && item.flyerId);
    if (!isReady) {
      showToast('すべての発注アイテムに対して、案件名の入力とチラシの選択を行ってください', 'warning'); return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/portal/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, paymentMethod, isDraft: false })
      });
      
      if (res.ok) {
        clearCart();
        router.push('/portal/orders');
      } else {
        const data = await res.json();
        showToast(data.error || '決済処理に失敗しました', 'error');
        setIsProcessing(false);
      }
    } catch (e) {
      showToast('通信エラーが発生しました', 'error');
      setIsProcessing(false);
    }
  };

  // 各アイテム毎の一時保存（下書き）する
  const handleSaveDraftItem = async (item: CartItem) => {
    if (!item.projectName || !item.flyerId) {
      showToast('案件名を入力し、使用するチラシを選択してから保存してください', 'warning'); return;
    }

    setProcessingItemId(item.id);
    try {
      // paymentMethod は一時保存時は CREDIT 固定（あとで変更可能にするため影響なし）
      const res = await fetch('/api/portal/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [item], paymentMethod: 'CREDIT', isDraft: true })
      });
      
      if (res.ok) {
        const data = await res.json();
        // APIから返ってきた orderId を保存しておく（二重作成防止用）
        const savedData = data.orderIds?.find((o: any) => o.cartItemId === item.id);
        if (savedData) {
          updateItem(item.id, { savedOrderId: savedData.orderId });
        }
        showToast('一時保存しました。発注履歴画面からも確認できます', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || '保存に失敗しました', 'error');
      }
    } catch (e) {
      showToast('通信エラーが発生しました', 'error');
    }
    setProcessingItemId(null);
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
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pt-4 pb-20 relative">
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
            <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-5 hover:shadow-md transition-shadow">
              
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
                
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => router.push(`/portal/orders/new?editItemId=${item.id}`)} 
                    className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-indigo-200 flex items-center gap-1.5" 
                    title="発注画面に戻って内容を編集"
                  >
                    <i className="bi bi-pencil-square text-sm"></i> 内容を修正
                  </button>
                  <button 
                    onClick={() => removeItem(item.id)} 
                    className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 w-8 h-8 flex items-center justify-center rounded-lg transition-colors" 
                    title="削除"
                  >
                    <i className="bi bi-trash3-fill text-base"></i>
                  </button>
                </div>
              </div>

              {/* ログイン時のみ表示される「案件名」と「チラシ」 */}
              {status === 'authenticated' && (
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1.5">案件名 (必須) <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" 
                      placeholder="例: 春のキャンペーン第1弾" 
                      value={item.projectName || ''} 
                      onChange={e => updateItem(item.id, { projectName: e.target.value })}
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1.5">使用するチラシ (必須) <span className="text-rose-500">*</span></label>
                    {!item.flyerId ? (
                      <button
                        onClick={() => openFlyerModal(item.id, 'select')}
                        className="w-full bg-indigo-50 border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-100 p-3.5 rounded-xl text-sm text-indigo-600 hover:text-indigo-700 transition-all flex items-center justify-center gap-2.5 font-bold group animate-pulse hover:animate-none"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-200 group-hover:bg-indigo-300 flex items-center justify-center transition-colors">
                          <i className="bi bi-folder-plus text-indigo-600"></i>
                        </div>
                        チラシを選択してください
                        <i className="bi bi-chevron-right text-xs opacity-50"></i>
                      </button>
                    ) : item.flyerId === 'NEW' ? (
                      <div className="bg-fuchsia-50 border border-fuchsia-200 p-3 rounded-xl flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center shrink-0 text-lg"><i className="bi bi-stars"></i></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-fuchsia-700 truncate">{item.flyerName || '新しくチラシを登録'}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {item.industryId && industries.find(ind => ind.id === item.industryId) && (
                              <span className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-100 px-1.5 py-0.5 rounded">{industries.find(ind => ind.id === item.industryId)?.name}</span>
                            )}
                            <span className="text-[10px] font-bold text-fuchsia-500 bg-fuchsia-100/60 px-1.5 py-0.5 rounded">{item.size}</span>
                            {item.foldingTypeName && (
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{item.foldingTypeName}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => openFlyerModal(item.id, 'new')}
                          className="text-[10px] font-bold text-fuchsia-600 hover:bg-fuchsia-100 px-2.5 py-1.5 rounded-lg transition-colors border border-fuchsia-200 shrink-0"
                        >変更</button>
                      </div>
                    ) : (() => {
                      const selectedFlyer = myFlyers.find(f => String(f.id) === String(item.flyerId));
                      const stock = selectedFlyer?.stockCount ?? 0;
                      const stockColor = stock >= 5000 ? 'text-emerald-600 bg-emerald-50' : stock >= 1000 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50';
                      return (
                        <div className="bg-white border border-slate-200 p-3 rounded-xl flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 text-lg"><i className="bi bi-file-earmark-text"></i></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-800 truncate">{selectedFlyer?.name || item.flyerName || `チラシ #${item.flyerId}`}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {selectedFlyer?.industry?.name && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{selectedFlyer.industry.name}</span>
                              )}
                              {selectedFlyer?.size?.name && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{selectedFlyer.size.name}</span>
                              )}
                              {selectedFlyer?.foldStatus && (
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{foldStatusLabel(selectedFlyer.foldStatus)}</span>
                              )}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stockColor}`}>在庫: {stock.toLocaleString()}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => openFlyerModal(item.id, 'select')}
                            className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-200 shrink-0"
                          >変更</button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 詳細情報 (表示専用) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 mb-1">希望配布枚数</div>
                  <div className="text-sm font-black text-indigo-600">{item.totalCount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">枚</span></div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 mb-1">開始予定日</div>
                  <div className="text-sm font-bold text-slate-700">{item.startDate ? item.startDate.replace(/-/g, '/') : '未定'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 mb-1">完了期限日</div>
                  <div className="text-sm font-bold text-indigo-700">{item.endDate ? item.endDate.replace(/-/g, '/') : '未定'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 mb-1">予備期限</div>
                  <div className="text-sm font-bold text-slate-700">{item.spareDate ? item.spareDate.replace(/-/g, '/') : 'なし'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium px-2">
                <div className="w-5 text-center"><i className="bi bi-geo-alt-fill text-slate-400"></i></div>
                <span className="truncate" title={item.selectedAreas.map(a => a.name).join(', ')}>
                  エリア: {item.selectedAreas[0]?.name || '未指定'} <span className="text-[10px] text-slate-400">他 計{item.selectedAreas.length}ヶ所</span>
                </span>
                
                <button 
                  onClick={() => setViewAreasItem(item)}
                  className="ml-auto text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors border border-indigo-100 shrink-0 flex items-center gap-1.5"
                >
                  <i className="bi bi-list-ul"></i> 全てのエリアを表示
                </button>
              </div>

              {/* 明細 + 小計 */}
              {(() => {
                const distTotal = Math.floor(item.totalCount * item.unitPrice);
                const remaining = item.price - distTotal;
                const isPP = item.type === 'PRINT_AND_POSTING';
                const hasFolding = (item.foldingUnitPrice ?? 0) > 0 && item.foldingTypeId;
                const pCount = item.printCount || item.totalCount;
                let printOnly = 0;
                let foldingTotal = 0;
                if (isPP && remaining > 0) {
                  if (hasFolding) {
                    foldingTotal = Math.floor(pCount * (item.foldingUnitPrice ?? 0));
                    printOnly = remaining - foldingTotal;
                  } else {
                    printOnly = remaining;
                  }
                } else if (!isPP && hasFolding) {
                  foldingTotal = Math.floor(item.totalCount * (item.foldingUnitPrice ?? 0));
                }
                return (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><i className="bi bi-truck text-indigo-500"></i> 配布代 <span className="text-slate-400 text-xs">({item.totalCount.toLocaleString()}枚 × ¥{item.unitPrice.toFixed(1)})</span></span>
                        <span className="text-sm font-bold text-slate-800 tabular-nums">¥{distTotal.toLocaleString()}</span>
                      </div>
                      {isPP && printOnly > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><i className="bi bi-printer text-indigo-500"></i> 印刷代 <span className="text-slate-400 text-xs">({pCount.toLocaleString()}枚)</span></span>
                          <span className="text-sm font-bold text-slate-800 tabular-nums">¥{printOnly.toLocaleString()}</span>
                        </div>
                      )}
                      {hasFolding && foldingTotal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><i className="bi bi-layers text-indigo-500"></i> 折り加工代 <span className="text-slate-400 text-xs">({(isPP ? pCount : item.totalCount).toLocaleString()}枚 × ¥{item.foldingUnitPrice})</span></span>
                          <span className="text-sm font-bold text-slate-800 tabular-nums">¥{foldingTotal.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      {status === 'authenticated' ? (
                        <button
                          onClick={() => handleSaveDraftItem(item)}
                          disabled={processingItemId === item.id}
                          className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                          {processingItemId === item.id ? <i className="bi bi-arrow-repeat animate-spin"></i> : <i className="bi bi-floppy"></i>}
                          {item.savedOrderId ? '一時保存を更新' : 'この発注を一時保存'}
                        </button>
                      ) : <div></div>}
                      <div className="flex items-baseline gap-3 ml-auto">
                        <span className="text-xs font-bold text-slate-400">小計 (税抜)</span>
                        <span className="text-2xl font-black text-slate-800 tracking-tight">¥{item.price.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
               <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'BANK_TRANSFER' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 hover:bg-slate-50'}`}>
                 <input type="radio" name="payment" value="BANK_TRANSFER" checked={paymentMethod === 'BANK_TRANSFER'} onChange={() => setPaymentMethod('BANK_TRANSFER')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                 <div className="flex-1">
                   <div className="text-sm font-bold text-slate-800 flex items-center gap-2"><i className="bi bi-bank text-amber-600"></i>銀行振込 (前払)</div>
                   <div className="text-[10px] text-slate-500 mt-0.5">入金確認後に発注確定となります</div>
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
          
          {!session && (
            <p className="text-[10px] text-slate-500 text-center mt-4 leading-relaxed font-medium">
              ※購入にはアカウントが必要です。<br/>まだお持ちでない方はログイン画面から<br/>「無料で登録する」へお進みください。
            </p>
          )}
        </div>
      </div>

      {/* チラシ選択モーダル */}
      {flyerModalItemId && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 md:p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden">
            {/* ヘッダー */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><i className="bi bi-folder2-open text-indigo-600"></i> チラシを選択</h3>
                  <p className="text-xs text-slate-500 mt-1">登録済みのチラシから選択するか、新しく登録してください</p>
                </div>
                <button onClick={() => setFlyerModalItemId(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"><i className="bi bi-x-lg"></i></button>
              </div>
            </div>

            {/* タブ */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setFlyerModalTab('select')}
                className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${flyerModalTab === 'select' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                <i className="bi bi-collection mr-1.5"></i>既存のチラシから選択
              </button>
              <button
                onClick={() => setFlyerModalTab('new')}
                className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${flyerModalTab === 'new' ? 'text-fuchsia-600 border-b-2 border-fuchsia-600 bg-fuchsia-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                <i className="bi bi-plus-circle mr-1.5"></i>新しく登録
              </button>
            </div>

            {/* タブコンテンツ */}
            {flyerModalTab === 'select' ? (
              <>
                {/* 検索バー */}
                <div className="p-3 border-b border-slate-100">
                  <div className="relative">
                    <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input
                      type="text"
                      placeholder="チラシ名で検索..."
                      value={flyerSearch}
                      onChange={e => setFlyerSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    />
                  </div>
                </div>

                {/* チラシ一覧 */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {myFlyers
                    .filter(f => !flyerSearch || f.name.toLowerCase().includes(flyerSearch.toLowerCase()))
                    .map(f => {
                      const stock = f.stockCount ?? 0;
                      const stockColor = stock >= 5000 ? 'text-emerald-600' : stock >= 1000 ? 'text-amber-600' : 'text-rose-600';
                      const stockBg = stock >= 5000 ? 'bg-emerald-50' : stock >= 1000 ? 'bg-amber-50' : 'bg-rose-50';
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            updateItem(flyerModalItemId, { flyerId: String(f.id), flyerName: f.name, industryId: undefined });
                            setFlyerModalItemId(null);
                          }}
                          className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex items-center gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-indigo-100 text-slate-400 group-hover:text-indigo-500 flex items-center justify-center shrink-0 transition-colors text-lg">
                            <i className="bi bi-file-earmark-text"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700">{f.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {f.industry?.name && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{f.industry.name}</span>
                              )}
                              {f.size?.name && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{f.size.name}</span>
                              )}
                              {f.foldStatus && (
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{foldStatusLabel(f.foldStatus)}</span>
                              )}
                            </div>
                          </div>
                          <div className={`text-right shrink-0 px-2 py-1 rounded-lg ${stockBg}`}>
                            <div className={`text-sm font-black ${stockColor}`}>{stock.toLocaleString()}</div>
                            <div className="text-[9px] text-slate-400 font-bold">在庫</div>
                          </div>
                        </button>
                      );
                    })}
                  {myFlyers.filter(f => !flyerSearch || f.name.toLowerCase().includes(flyerSearch.toLowerCase())).length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                      <i className="bi bi-inbox text-3xl block mb-2"></i>
                      <p className="text-sm font-medium">{flyerSearch ? '検索結果がありません' : '登録済みのチラシがありません'}</p>
                      <button onClick={() => setFlyerModalTab('new')} className="mt-3 text-xs font-bold text-fuchsia-600 hover:underline">新しく登録する →</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* 新規登録タブ */
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* 価格変更確認ダイアログ */}
                {priceConfirm ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <i className="bi bi-exclamation-triangle-fill text-amber-500 text-lg"></i>
                        <p className="text-sm font-bold text-amber-800">価格が変更されます</p>
                      </div>
                      <p className="text-xs text-amber-700 mb-4">配布発注画面で指定したサイズ・折り加工と異なるため、価格が変更されます。</p>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-white rounded-xl p-4 border border-amber-100">
                        <div className="text-center">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">変更前</div>
                          <div className="text-xl font-black text-slate-400 line-through">¥{priceConfirm.oldPrice.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">税込 ¥{Math.floor(priceConfirm.oldPrice * 1.1).toLocaleString()}</div>
                        </div>
                        <i className="bi bi-arrow-right text-xl text-amber-400"></i>
                        <div className="text-center">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">変更後</div>
                          <div className={`text-xl font-black ${priceConfirm.newPrice > priceConfirm.oldPrice ? 'text-rose-600' : 'text-emerald-600'}`}>¥{priceConfirm.newPrice.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">税込 ¥{Math.floor(priceConfirm.newPrice * 1.1).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="text-center mt-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${priceConfirm.newPrice > priceConfirm.oldPrice ? 'text-rose-700 bg-rose-100' : 'text-emerald-700 bg-emerald-100'}`}>
                          差額: {priceConfirm.newPrice > priceConfirm.oldPrice ? '+' : ''}¥{(priceConfirm.newPrice - priceConfirm.oldPrice).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setPriceConfirm(null)}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
                      ><i className="bi bi-arrow-left mr-1.5"></i>戻る</button>
                      <button
                        onClick={handlePriceConfirmAccept}
                        className="flex-1 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-bold text-sm shadow-md shadow-fuchsia-200 transition-all flex items-center justify-center gap-1.5"
                      ><i className="bi bi-check-lg"></i> この価格で確定</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-gradient-to-r from-fuchsia-50 to-purple-50 border border-fuchsia-100 rounded-xl p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-fuchsia-100 text-fuchsia-500 flex items-center justify-center shrink-0"><i className="bi bi-stars"></i></div>
                      <div>
                        <p className="text-sm font-bold text-fuchsia-700">新しくチラシを登録します</p>
                        <p className="text-[10px] text-fuchsia-500">決済完了後に入稿画面へご案内します</p>
                      </div>
                    </div>

                    {/* チラシ名 */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1.5">チラシ名</label>
                      <input
                        type="text"
                        placeholder="例: 春キャンペーン第1弾チラシ"
                        value={newFlyerName}
                        onChange={e => setNewFlyerName(e.target.value)}
                        className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none bg-white"
                      />
                    </div>

                    {/* 業種 + サイズ + 折り加工 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1.5">業種</label>
                        <select
                          value={newFlyerIndustryId ?? ''}
                          onChange={e => setNewFlyerIndustryId(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none bg-white cursor-pointer"
                        >
                          <option value="">選択してください</option>
                          {industries.map(ind => (
                            <option key={ind.id} value={ind.id}>{ind.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1.5">サイズ</label>
                        <select
                          value={newFlyerSizeName}
                          onChange={e => setNewFlyerSizeName(e.target.value)}
                          className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none bg-white cursor-pointer"
                        >
                          {flyerSizes.map((s: any) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1.5">
                          {items.find(i => i.id === flyerModalItemId)?.type === 'PRINT_AND_POSTING' ? '折り加工' : '納品時の折り加工'}
                        </label>
                        <select
                          value={newFlyerFoldingTypeId ?? ''}
                          onChange={e => setNewFlyerFoldingTypeId(e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none bg-white cursor-pointer"
                        >
                          <option value="">なし</option>
                          {foldingTypes.map((ft: any) => (
                            <option key={ft.id} value={ft.id}>{ft.name} (+¥{ft.unitPrice}/枚)</option>
                          ))}
                        </select>
                        {items.find(i => i.id === flyerModalItemId)?.type === 'POSTING_ONLY' && (
                          <p className="text-[10px] text-slate-400 mt-1">納品時のチラシの折り状態を選択してください</p>
                        )}
                      </div>
                    </div>

                    {/* isFoldRequired 警告 */}
                    {(() => {
                      const selectedSize = flyerSizes.find((s: any) => s.name === newFlyerSizeName);
                      if (!selectedSize?.isFoldRequired || newFlyerFoldingTypeId) return null;
                      const cheapest = foldingTypes.length > 0 ? foldingTypes.reduce((min: any, ft: any) => ft.unitPrice < min.unitPrice ? ft : min, foldingTypes[0]) : null;
                      const modalItem = items.find(i => i.id === flyerModalItemId);
                      const totalFoldingCost = cheapest && modalItem ? modalItem.totalCount * cheapest.unitPrice : 0;
                      return (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <i className="bi bi-exclamation-triangle-fill text-orange-500 text-base mt-0.5 shrink-0"></i>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-orange-800">{newFlyerSizeName}サイズは折り加工が必須です</p>
                              <p className="text-xs text-orange-700 mt-1">このサイズのチラシはポストに入りにくいため、折り加工を推奨します。</p>
                              {cheapest && (
                                <div className="mt-3 flex items-center gap-3">
                                  <button
                                    onClick={() => setNewFlyerFoldingTypeId(cheapest.id)}
                                    className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg transition-colors shadow-sm"
                                  >
                                    {cheapest.name}を追加する（+¥{totalFoldingCost.toLocaleString()}）
                                  </button>
                                  <span className="text-[10px] text-orange-500">¥{cheapest.unitPrice}/枚 × {modalItem?.totalCount.toLocaleString()}枚</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 価格プレビュー */}
                    {(() => {
                      const modalItem = items.find(i => i.id === flyerModalItemId);
                      if (!modalItem) return null;
                      const { price: previewPrice } = calcNewPrice(modalItem, newFlyerSizeName, newFlyerFoldingTypeId);
                      if (previewPrice === modalItem.price) return null;
                      return (
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                          <i className="bi bi-info-circle-fill text-amber-500 shrink-0"></i>
                          <div className="text-xs text-amber-700 flex items-center gap-2 flex-wrap">
                            <span className="font-bold">価格が変更されます:</span>
                            <span className="line-through text-slate-400">¥{modalItem.price.toLocaleString()}</span>
                            <i className="bi bi-arrow-right text-amber-400"></i>
                            <span className={`font-black ${previewPrice > modalItem.price ? 'text-rose-600' : 'text-emerald-600'}`}>¥{previewPrice.toLocaleString()}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${previewPrice > modalItem.price ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {previewPrice > modalItem.price ? '+' : ''}¥{(previewPrice - modalItem.price).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleNewFlyerConfirm}
                      className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold rounded-xl shadow-md shadow-fuchsia-200 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <i className="bi bi-check-lg"></i> 新規チラシで確定する
                    </button>
                  </>
                )}
              </div>
            )}

            {/* フッター */}
            {!priceConfirm && (
              <div className="px-6 py-4 border-t border-slate-100 bg-white text-right">
                <button onClick={() => setFlyerModalItemId(null)} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all">閉じる</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 全エリア表示用モーダル */}
      {viewAreasItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">選択中の全エリア</h3>
                <p className="text-xs text-slate-500 mt-1">合計: <span className="font-bold text-indigo-600">{viewAreasItem.selectedAreas.length}</span> ヶ所</p>
              </div>
              <button onClick={() => setViewAreasItem(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1.5">
              {viewAreasItem.selectedAreas.map((a, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium mb-0.5">{a.prefName} {a.cityName}</div>
                    <div className="text-sm font-bold text-slate-700">{a.name.replace(`${a.cityName} `, '')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-indigo-600">{a.count.toLocaleString()}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase">枚</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white text-right">
              <button onClick={() => setViewAreasItem(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm shadow-md transition-all">閉じる</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}