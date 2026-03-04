'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/ui/NotificationProvider';

const STATUS_MAP: Record<string, { label: string, color: string, icon: string }> = {
  DRAFT: { label: '一時保存', color: 'bg-slate-100 text-slate-600', icon: 'bi-save' },
  PLANNING: { label: '提案中', color: 'bg-blue-100 text-blue-700', icon: 'bi-lightbulb' },
  PENDING_PAYMENT: { label: '入金待ち', color: 'bg-amber-100 text-amber-700', icon: 'bi-wallet2' },
  PENDING_SUBMISSION: { label: 'データ入稿待ち', color: 'bg-fuchsia-100 text-fuchsia-700', icon: 'bi-cloud-arrow-up' }, // ★ 新規追加
  PENDING_REVIEW: { label: '審査待ち', color: 'bg-orange-100 text-orange-700', icon: 'bi-hourglass-split' },
  ADJUSTING: { label: '調整中', color: 'bg-indigo-100 text-indigo-700', icon: 'bi-tools' },
  CONFIRMED: { label: '受注確定', color: 'bg-emerald-100 text-emerald-700', icon: 'bi-check-circle' },
  IN_PROGRESS: { label: '作業中/配布中', color: 'bg-blue-100 text-blue-700', icon: 'bi-bicycle' },
  COMPLETED: { label: '完了', color: 'bg-slate-800 text-white', icon: 'bi-flag-fill' },
  CANCELED: { label: 'キャンセル', color: 'bg-rose-100 text-rose-700', icon: 'bi-x-circle' },
};

// 選択肢の定義
const PAPER_TYPES = ['コート紙', 'マット紙', '上質紙'];
const PAPER_WEIGHTS = ['73kg (標準)', '90kg (少し厚め)', '110kg (厚手)', '135kg (カード・ハガキ厚)'];
const COLOR_TYPES = ['両面カラー', '片面カラー (裏面白紙)', '両面モノクロ', '片面モノクロ'];
const FOLDING_OPTIONS = ['なし', '2つ折り', '3つ折り (巻き)', '3つ折り (Z)', '十字折り', 'ずらし折り', 'その他 (備考欄へ)'];

export default function PortalMyPage() {
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 入稿モーダル用 State ---
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultDeliveryAddress, setDefaultDeliveryAddress] = useState('');

  const [submitForm, setSubmitForm] = useState({
    designFileUrl: '',
    paperType: 'コート紙',
    paperWeight: '73kg (標準)',
    colorType: '両面カラー',
    printCount: 0,
    foldingOption: 'なし',
    sampleRequired: false,
    sampleShippingAddress: '',
    remarks: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/orders');
      if (res.status === 401) {
        router.push('/portal/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.customer);
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [router]);

  // デフォルト納品先住所を取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portal/settings/delivery-addresses');
        if (res.ok) {
          const data = await res.json();
          const defaultId = data.myDefaultDeliveryAddressId;
          if (defaultId && data.addresses) {
            const addr = data.addresses.find((a: any) => a.id === defaultId);
            if (addr) {
              const parts = [
                addr.postalCode ? `〒${addr.postalCode}` : '',
                addr.address || '',
                addr.addressBuilding || '',
                addr.phone ? `TEL: ${addr.phone}` : '',
              ].filter(Boolean);
              setDefaultDeliveryAddress(parts.join('\n'));
            }
          }
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const openSubmitModal = (order: any) => {
    setActiveOrderId(order.id);
    // 配布枚数の合計をデフォルトの印刷部数に設定（少し多めに設定してもらう前提）
    const totalDist = order.distributions?.reduce((sum: number, d: any) => sum + d.plannedCount, 0) || 0;
    setSubmitForm(prev => ({ ...prev, printCount: totalDist + (Math.floor(totalDist * 0.05)) })); // 予備として+5%
    setIsSubmitModalOpen(true);
  };

  // ファイルアップロード処理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB以上
      showToast('ファイルサイズが大きすぎます。10MB以上はGigaFile便などのURLを備考欄に貼り付けてください', 'warning'); return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setSubmitForm(prev => ({ ...prev, designFileUrl: data.url }));
        showToast('アップロードが完了しました', 'success');
      } else {
        showToast('アップロードに失敗しました', 'error');
      }
    } catch (err) { showToast('通信エラーが発生しました', 'error'); }
    setIsUploading(false);
  };

  const handleSubmitData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrderId) return;
    
    // URLもファイルもない場合は警告
    if (!submitForm.designFileUrl && !submitForm.remarks.includes('http')) {
      if (!await showConfirm('入稿データが添付されていません。備考欄のURLから入稿しますか？', { variant: 'warning', detail: 'データがない場合は後からメール等で送付をお願いします', confirmLabel: '入稿する' })) return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/orders/${activeOrderId}/submit-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitForm)
      });
      if (res.ok) {
        showToast('データを入稿しました。審査へ進みます', 'success');
        setIsSubmitModalOpen(false);
        fetchData();
      } else {
        showToast('エラーが発生しました', 'error');
      }
    } catch (err) { showToast('通信エラーが発生しました', 'error'); }
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    await fetch('/api/portal/auth/login', { method: 'DELETE' });
    router.push('/portal/login');
  };

  if (isLoading) return <div className="p-20 text-center text-slate-500">読み込み中...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
      
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <div className="relative z-10">
          <div className="text-sm font-bold text-blue-600 mb-1">Welcome Back</div>
          <h1 className="text-2xl font-black text-slate-800">{user?.name} 様</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            <i className="bi bi-envelope"></i> {user?.email}
          </p>
        </div>
        <button onClick={handleLogout} className="relative z-10 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors flex items-center gap-2">
          <i className="bi bi-box-arrow-right"></i> ログアウト
        </button>
      </div>

      <div>
        <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <i className="bi bi-card-list text-blue-600"></i> 発注履歴・ステータス
        </h2>

        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-slate-200">
              <i className="bi bi-inbox text-4xl text-slate-300 mb-3 block"></i>
              <p className="text-slate-500 font-bold">まだ発注履歴がありません。</p>
              <Link href="/portal/orders/new" className="inline-block mt-4 text-blue-600 hover:underline font-bold text-sm">新しい発注を作成する</Link>
            </div>
          ) : (
            orders.map(order => {
              const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-600', icon: 'bi-circle' };
              
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
                  </div>

                  <div className="flex flex-col items-start md:items-end justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 min-w-[200px]">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">合計金額 (税込)</div>
                      <div className="text-2xl font-black text-slate-800 tracking-tight">
                        ¥{order.totalAmount?.toLocaleString() || '---'}
                      </div>
                    </div>
                    
                    {/* ★ 入稿待ちステータスの場合は目立つ入稿ボタンを表示 */}
                    {order.status === 'PENDING_SUBMISSION' ? (
                      <button onClick={() => openSubmitModal(order)} className="w-full px-5 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group">
                        <i className="bi bi-cloud-arrow-up-fill group-hover:-translate-y-1 transition-transform"></i> データを入稿する
                      </button>
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

      {/* ========================================== */}
      {/* ★ 新規追加: データ入稿・印刷オプション設定モーダル */}
      {/* ========================================== */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* ヘッダー */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <i className="bi bi-printer-fill text-fuchsia-600"></i> 印刷データ入稿 ＆ オプション設定
              </h3>
              <button onClick={() => setIsSubmitModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* スクロールエリア */}
            <form onSubmit={handleSubmitData} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
              
              {/* 1. ファイルアップロード */}
              <div className="space-y-3">
                <label className="block text-sm font-black text-slate-800 border-l-4 border-fuchsia-500 pl-2">
                  1. デザインデータのアップロード
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-fuchsia-50 hover:border-fuchsia-300 transition-colors relative group">
                  <input 
                    type="file" 
                    accept=".pdf,.ai,.psd,.jpg,.jpeg,.png,.zip" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="space-y-3 pointer-events-none">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto text-fuchsia-500 text-3xl group-hover:scale-110 transition-transform">
                      {isUploading ? <i className="bi bi-arrow-repeat animate-spin"></i> : <i className="bi bi-cloud-arrow-up"></i>}
                    </div>
                    <p className="font-bold text-slate-700">
                      {submitForm.designFileUrl ? '✓ ファイル添付済み' : isUploading ? 'アップロード中...' : 'クリックまたはドラッグ＆ドロップでファイルを選択'}
                    </p>
                    <p className="text-xs text-slate-500">対応形式: PDF, AI, PSD, JPG, PNG, ZIP (上限10MB)</p>
                  </div>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex gap-3 mt-2">
                  <i className="bi bi-info-circle-fill text-amber-500 text-base"></i>
                  <p>10MBを超える大容量データ（Illustrator等）の場合は、このフォームでのアップロードをスキップし、<br/>
                  <span className="font-bold border-b border-amber-400">GigaFile便やGoogle Driveなどの共有URLを発行して、最下部の「備考欄」に貼り付けてください。</span></p>
                </div>
              </div>

              {/* 2. 用紙・カラー指定 */}
              <div className="space-y-5">
                <label className="block text-sm font-black text-slate-800 border-l-4 border-fuchsia-500 pl-2">
                  2. 印刷の仕様設定
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600">用紙の種類</label>
                    <select value={submitForm.paperType} onChange={e => setSubmitForm({...submitForm, paperType: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none font-bold text-sm bg-white">
                      {PAPER_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600">用紙の厚さ</label>
                    <select value={submitForm.paperWeight} onChange={e => setSubmitForm({...submitForm, paperWeight: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none font-bold text-sm bg-white">
                      {PAPER_WEIGHTS.map(pw => <option key={pw} value={pw}>{pw}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600">印刷カラー</label>
                    <select value={submitForm.colorType} onChange={e => setSubmitForm({...submitForm, colorType: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none font-bold text-sm bg-white">
                      {COLOR_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600">印刷部数 (枚)</label>
                    <input type="number" required min="100" step="100" value={submitForm.printCount} onChange={e => setSubmitForm({...submitForm, printCount: parseInt(e.target.value)})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none font-mono font-black text-lg bg-white" />
                    <p className="text-[10px] text-slate-400">※配布枚数に対して少し多め（予備）の部数を設定してください。</p>
                  </div>
                </div>
              </div>

              {/* 3. 加工・オプション */}
              <div className="space-y-5">
                <label className="block text-sm font-black text-slate-800 border-l-4 border-fuchsia-500 pl-2">
                  3. 折り加工・その他オプション
                </label>
                
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                  
                  {/* 特殊折りラジオボタン */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-3">特殊折り加工</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {FOLDING_OPTIONS.map(opt => (
                        <label key={opt} className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all ${submitForm.foldingOption === opt ? 'bg-fuchsia-50 border-fuchsia-500 text-fuchsia-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                          <input type="radio" name="folding" className="hidden" checked={submitForm.foldingOption === opt} onChange={() => setSubmitForm({...submitForm, foldingOption: opt})} />
                          <div className="font-bold text-xs">{opt}</div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  {/* サンプル要否 */}
                  <div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input type="checkbox" className="peer w-5 h-5 appearance-none border-2 border-slate-300 rounded focus:ring-2 focus:ring-fuchsia-500 checked:bg-fuchsia-600 checked:border-fuchsia-600 transition-colors" checked={submitForm.sampleRequired} onChange={e => {
                          const checked = e.target.checked;
                          setSubmitForm(prev => ({
                            ...prev,
                            sampleRequired: checked,
                            sampleShippingAddress: checked && !prev.sampleShippingAddress && defaultDeliveryAddress ? defaultDeliveryAddress : prev.sampleShippingAddress,
                          }));
                        }} />
                        <i className="bi bi-check text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 text-lg"></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-fuchsia-700 transition-colors">印刷見本（サンプル）の送付を希望する</div>
                        <div className="text-xs text-slate-500 mt-1">印刷完了後、ご指定の住所へ約50枚を無料でお送りします。</div>
                      </div>
                    </label>

                    {submitForm.sampleRequired && (
                      <div className="mt-4 pl-8 animate-in slide-in-from-top-2">
                        <label className="block text-xs font-bold text-slate-600 mb-2">サンプル送付先住所・宛名 <span className="text-rose-500">*</span></label>
                        <textarea required value={submitForm.sampleShippingAddress} onChange={e => setSubmitForm({...submitForm, sampleShippingAddress: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none text-sm bg-white" rows={3} placeholder="〒000-0000 東京都...&#10;株式会社〇〇 ご担当者様名"></textarea>
                      </div>
                    )}
                  </div>

                  <hr className="border-slate-200" />

                  {/* 備考欄 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">その他 備考・特記事項 (データ共有URLもこちらへ)</label>
                    <textarea value={submitForm.remarks} onChange={e => setSubmitForm({...submitForm, remarks: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none text-sm bg-white" rows={4} placeholder="・GigaFile便のURL: https://...&#10;・〇〇の部分は少し明るめで印刷希望、など"></textarea>
                  </div>

                </div>
              </div>

            </form>

            {/* フッターアクション */}
            <div className="p-6 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsSubmitModalOpen(false)} className="px-6 py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                キャンセル
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || isUploading || (!submitForm.designFileUrl && submitForm.remarks.length === 0)}
                onClick={handleSubmitData}
                className="px-8 py-3 font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl shadow-lg shadow-fuchsia-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? '送信中...' : <><i className="bi bi-send-fill"></i> データを入稿して審査へ</>}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}