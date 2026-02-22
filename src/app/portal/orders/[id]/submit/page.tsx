'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PAPER_TYPES = [
  { id: 'コート紙', label: 'コート紙', desc: '写真が綺麗に発色。一般的なチラシに。', icon: <i className="bi bi-stars text-2xl mb-1 block"></i> },
  { id: 'マット紙', label: 'マット紙', desc: '光沢を抑えた落ち着いた質感。', icon: <i className="bi bi-moon-stars-fill text-2xl mb-1 block"></i> },
  { id: '上質紙', label: '上質紙', desc: '光沢ゼロ。鉛筆等での書き込みに。', icon: <i className="bi bi-pencil-fill text-2xl mb-1 block"></i> },
];

const PAPER_WEIGHTS = [
  { id: '73kg (標準)', label: '73kg', desc: 'ポスティングで最も標準的な厚さ。', icon: <span className="font-black text-xl mb-1 block">薄</span> },
  { id: '90kg (少し厚め)', label: '90kg', desc: '少ししっかりした厚み。会社案内等に。', icon: <span className="font-black text-xl mb-1 block">普</span> },
  { id: '110kg (厚手)', label: '110kg', desc: 'ペラペラしない厚み。ポスター等に。', icon: <span className="font-black text-xl mb-1 block">厚</span> },
  { id: '135kg (ハガキ厚)', label: '135kg', desc: 'ハガキと同等のしっかりとした厚み。', icon: <span className="font-black text-xl mb-1 block">極</span> },
];

const COLOR_TYPES = [
  { id: '両面カラー', label: '両面カラー', desc: '表も裏もフルカラー', colorClass: 'bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400' },
  { id: '片面カラー (裏面白紙)', label: '片面カラー', desc: '表面カラー / 裏面白紙', colorClass: 'bg-gradient-to-r from-pink-400 to-indigo-400' },
  { id: '両面モノクロ', label: '両面モノクロ', desc: '表も裏も白黒印刷', colorClass: 'bg-gradient-to-r from-slate-400 to-slate-600' },
  { id: '片面モノクロ', label: '片面モノクロ', desc: '表面白黒 / 裏面白紙', colorClass: 'bg-slate-400' },
];

const FOLDING_OPTIONS = [
  { id: 'なし', label: '折らない', icon: 'bi-file-earmark' },
  { id: '2つ折り', label: '2つ折り', icon: 'bi-book' },
  { id: '3つ折り (巻き)', label: '3つ折り(巻)', icon: 'bi-map' },
  { id: '3つ折り (Z)', label: '3つ折り(Z)', icon: 'bi-signpost-split' },
  { id: '十字折り', label: '十字折り', icon: 'bi-grid' },
  { id: 'その他', label: 'その他(備考へ)', icon: 'bi-three-dots' },
];

export default function SubmitDataPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const orderId = parseInt(resolvedParams.id);
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI・プレビュー状態
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isUploading, setIsUploading] = useState<'front' | 'back' | false>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // プレビュー調整用ステート（回転とフィット）
  const [previewSettings, setPreviewSettings] = useState({
    front: { rotate: 0, fit: 'contain' as 'contain' | 'cover' },
    back: { rotate: 0, fit: 'contain' as 'contain' | 'cover' }
  });

  // PDFの複数ページアップ時のダイアログ用
  const [pdfSetupModal, setPdfSetupModal] = useState<{ url: string, side: 'front'|'back', filename: string } | null>(null);

  const [submitForm, setSubmitForm] = useState({
    frontDesignUrl: '', backDesignUrl: '',
    frontPageNum: 1, backPageNum: 2,
    paperType: 'コート紙', paperWeight: '73kg (標準)', colorType: '両面カラー',
    printCount: 0, foldingOption: 'なし', sampleRequired: false, sampleShippingAddress: '', remarks: ''
  });

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/portal/orders');
        if (res.status === 401) { router.push('/portal/login'); return; }
        if (res.ok) {
          const data = await res.json();
          const targetOrder = data.orders?.find((o: any) => o.id === orderId);
          if (!targetOrder || targetOrder.status !== 'PENDING_SUBMISSION') {
            alert('不正なアクセス、または既に入稿済みの案件です。');
            router.push('/portal/orders'); return;
          }
          setOrder(targetOrder);
          const totalDist = targetOrder.distributions?.reduce((sum: number, d: any) => sum + d.plannedCount, 0) || 0;
          setSubmitForm(prev => ({ ...prev, printCount: totalDist + (Math.floor(totalDist * 0.05)) }));
        }
      } catch (e) { console.error(e); }
      setIsLoading(false);
    };
    fetchOrder();
  }, [orderId, router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) { 
      alert('20MB以上のファイルは外部ストレージのURLを備考欄へ貼り付けてください。');
      e.target.value = ''; return;
    }

    setIsUploading(side);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        if (file.name.toLowerCase().match(/\.(pdf|ai)$/)) {
          setPdfSetupModal({ url: data.url, side, filename: file.name });
        } else {
          if (side === 'front') setSubmitForm(prev => ({ ...prev, frontDesignUrl: data.url }));
          else setSubmitForm(prev => ({ ...prev, backDesignUrl: data.url }));
        }
        setPreviewSettings(prev => ({ ...prev, [side]: { rotate: 0, fit: 'contain' } }));
      } else { alert('アップロードに失敗しました。'); }
    } catch (err) { alert('通信エラーが発生しました。'); }
    setIsUploading(false);
    e.target.value = ''; 
  };

  const handlePdfSetup = (pages: number) => {
    if (!pdfSetupModal) return;
    const { url, side } = pdfSetupModal;

    if (pages === 1) {
      if (side === 'front') setSubmitForm(prev => ({ ...prev, frontDesignUrl: url, frontPageNum: 1 }));
      if (side === 'back') setSubmitForm(prev => ({ ...prev, backDesignUrl: url, backPageNum: 1 }));
    } else if (pages === 2) {
      setSubmitForm(prev => ({ 
        ...prev, 
        frontDesignUrl: url, frontPageNum: 1, 
        backDesignUrl: url, backPageNum: 2, 
        colorType: '両面カラー' 
      }));
      setActiveSide('front'); 
    } else if (pages >= 3) {
      if (side === 'front') setSubmitForm(prev => ({ ...prev, frontDesignUrl: url, frontPageNum: 1 }));
      if (side === 'back') setSubmitForm(prev => ({ ...prev, backDesignUrl: url, backPageNum: 1 }));
    }
    setPdfSetupModal(null);
  };

  const applyFrontToBack = () => {
    setSubmitForm(prev => ({
      ...prev, backDesignUrl: prev.frontDesignUrl, backPageNum: prev.frontPageNum + 1, colorType: '両面カラー'
    }));
    setActiveSide('back');
  };

  const handleSwapSides = () => {
    setSubmitForm(prev => ({
      ...prev, frontDesignUrl: prev.backDesignUrl, backDesignUrl: prev.frontDesignUrl,
      frontPageNum: prev.backPageNum, backPageNum: prev.frontPageNum,
    }));
    setPreviewSettings(prev => ({ front: prev.back, back: prev.front }));
  };

  const rotatePreview = () => {
    setPreviewSettings(prev => ({
      ...prev, [activeSide]: { ...prev[activeSide], rotate: (prev[activeSide].rotate + 90) % 360 }
    }));
  };

  const toggleFit = () => {
    setPreviewSettings(prev => ({
      ...prev, [activeSide]: { ...prev[activeSide], fit: prev[activeSide].fit === 'contain' ? 'cover' : 'contain' }
    }));
  };

  const clearSide = (side: 'front' | 'back') => {
    setSubmitForm(prev => ({ ...prev, [side === 'front' ? 'frontDesignUrl' : 'backDesignUrl']: '' }));
  };

  const handleSubmitData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.frontDesignUrl && !submitForm.remarks.includes('http')) {
      if (!confirm('データが添付されていません。備考欄のURL等で手配済みですか？')) return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/orders/${orderId}/submit-data`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitForm)
      });
      if (res.ok) {
        alert('データを入稿しました！審査へ進みます。');
        router.push('/portal/orders');
      } else { alert('エラーが発生しました'); }
    } catch (err) { alert('通信エラーが発生しました'); }
    setIsSubmitting(false);
  };

  // プレビューコンポーネント
  const PreviewElement = ({ url, pageNum, rotate, fit }: { url: string, pageNum: number, rotate: number, fit: string }) => {
    if (!url) return null;
    const lower = url.toLowerCase();
    
    // 画像の場合
    if (lower.match(/\.(jpeg|jpg|png|webp|gif)$/)) {
      return (
        <img 
          src={url} alt="Preview" 
          className="w-full h-full transition-transform duration-300 pointer-events-none" 
          style={{ objectFit: fit as any, transform: `rotate(${rotate}deg)` }} 
        />
      );
    }
    
    // PDFの場合 (iframe を回転させる)
    if (lower.endsWith('.pdf')) {
      return (
        <div 
          className="w-full h-full flex items-center justify-center transition-transform duration-300"
          style={{ transform: `rotate(${rotate}deg)` }}
        >
          <iframe 
            src={`${url}#page=${pageNum}&view=Fit&toolbar=0&navpanes=0&scrollbar=0`} 
            className="w-full h-full border-none pointer-events-none"
          />
        </div>
      );
    }

    // AIなどの場合
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-fuchsia-600">
        <i className="bi bi-filetype-ai text-6xl mb-4"></i>
        <span className="font-black text-lg">Illustratorデータ</span>
        <span className="text-xs opacity-70 mt-1">※プレビュー非対応</span>
      </div>
    );
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin"></div></div>;
  
  const isDoubleSided = submitForm.colorType.includes('両面');
  const currentUrl = activeSide === 'front' ? submitForm.frontDesignUrl : submitForm.backDesignUrl;
  const currentSettings = previewSettings[activeSide];

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden text-slate-800">
      
      {/* --- ヘッダー --- */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors">
            <i className="bi bi-arrow-left text-lg"></i>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-full border border-fuchsia-200 animate-pulse whitespace-nowrap">入稿待ち</span>
              <span className="text-[11px] font-bold text-slate-400 font-mono">{order?.orderNo}</span>
            </div>
            <h1 className="font-black text-slate-800 text-base truncate max-w-[200px] md:max-w-md mt-0.5">
              {order?.title || '名称未設定'}
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmitData} className="flex-1 flex overflow-hidden">
        
        {/* ==================================================== */}
        {/* 左カラム：プレビューエリア */}
        {/* ==================================================== */}
        <div className="w-[55%] bg-[#1a202c] flex flex-col relative overflow-hidden">
          
          {/* 上部コントロール (改行防止の whitespace-nowrap を徹底) */}
          <div className="absolute top-4 left-0 w-full px-6 flex justify-between z-30 pointer-events-none">
            
            {/* 表裏トグル ＆ 入れ替え */}
            <div className="flex gap-2 pointer-events-auto">
              <div className="bg-slate-900/80 p-1 rounded-lg flex gap-1 border border-slate-700 shadow-md">
                <button type="button" onClick={() => setActiveSide('front')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeSide === 'front' ? 'bg-fuchsia-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  表面
                </button>
                <button type="button" onClick={() => setActiveSide('back')} disabled={!isDoubleSided} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap disabled:opacity-30 ${activeSide === 'back' ? 'bg-fuchsia-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  裏面
                </button>
              </div>
              {(submitForm.frontDesignUrl || submitForm.backDesignUrl) && (
                <button type="button" onClick={handleSwapSides} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 shadow-md transition-all whitespace-nowrap flex items-center gap-1.5">
                  <i className="bi bi-arrow-left-right"></i> 入替
                </button>
              )}
            </div>

            {/* 用紙の向き */}
            <div className="bg-slate-900/80 p-1 rounded-lg flex gap-1 border border-slate-700 shadow-md pointer-events-auto">
              <button type="button" onClick={() => setOrientation('portrait')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${orientation === 'portrait' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                <i className="bi bi-file-earmark"></i> 縦長
              </button>
              <button type="button" onClick={() => setOrientation('landscape')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${orientation === 'landscape' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                <i className="bi bi-file-earmark rotate-90"></i> 横長
              </button>
            </div>
          </div>

          {/* ★ プレビューキャンバス (アスペクト比を維持し、余白なく最大化) */}
          <div className="flex-1 min-h-0 p-8 pt-20 pb-20 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            {/* A4/B4比率のコンテナ (白銀比) */}
            <div 
              className="relative bg-white shadow-2xl transition-all duration-300 flex items-center justify-center z-10 overflow-hidden"
              style={{
                aspectRatio: orientation === 'portrait' ? '1 / 1.414' : '1.414 / 1',
                // 親のflexコンテナ内に最大化して収まるように設定
                maxHeight: '100%',
                maxWidth: '100%',
                height: orientation === 'portrait' ? '100%' : 'auto',
                width: orientation === 'landscape' ? '100%' : 'auto',
              }}
            >
              {currentUrl ? (
                 <PreviewElement 
                   url={currentUrl} 
                   pageNum={activeSide === 'front' ? submitForm.frontPageNum : submitForm.backPageNum} 
                   rotate={currentSettings.rotate}
                   fit={currentSettings.fit}
                 />
              ) : (
                <div className="text-slate-300 flex flex-col items-center justify-center h-full w-full bg-slate-100/30">
                  <i className="bi bi-image text-5xl mb-3 block opacity-30"></i>
                  <p className="font-bold text-sm">{activeSide === 'front' ? '表面' : '裏面'}が未入稿です</p>
                  
                  {/* ★ 復活機能: 表面にPDFがあり、裏面が空の場合、2ページ目を抽出するボタンを表示 */}
                  {activeSide === 'back' && submitForm.frontDesignUrl && submitForm.frontDesignUrl.match(/\.(pdf|ai)$/i) && (
                     <button 
                       type="button" 
                       onClick={applyFrontToBack}
                       className="mt-6 px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg font-bold shadow-md flex items-center gap-2 pointer-events-auto"
                     >
                       <i className="bi bi-file-earmark-plus"></i>
                       表面の「2ページ目」を使う
                     </button>
                  )}
                </div>
              )}

              {/* 断裁線＆安全圏ガイド */}
              {currentUrl && (
                <>
                  <div className="absolute top-[2%] bottom-[2%] left-[2%] right-[2%] border-2 border-rose-500/80 pointer-events-none z-20">
                     <span className="absolute -top-5 left-0 text-rose-500 text-[10px] font-bold bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">仕上がり位置</span>
                  </div>
                  <div className="absolute top-[4%] bottom-[4%] left-[4%] right-[4%] border-[1.5px] border-blue-500/80 border-dashed pointer-events-none z-20">
                     <span className="absolute -top-5 left-0 text-blue-500 text-[10px] font-bold bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">安全圏</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 下部アップロード＆調整バー */}
          <div className="absolute bottom-0 left-0 w-full bg-slate-900 border-t border-slate-700 p-4 z-30 flex items-center justify-between gap-4">
            
            {/* ファイル選択 */}
            <div className="flex-1 relative max-w-sm">
              <input type="file" accept=".pdf,.ai,.psd,.jpg,.jpeg,.png,.zip" onChange={(e) => handleFileUpload(e, activeSide)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <button type="button" className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded-lg py-2.5 font-bold transition-colors flex items-center justify-center gap-2 text-xs shadow-inner">
                {isUploading === activeSide ? <i className="bi bi-arrow-repeat animate-spin text-fuchsia-400"></i> : <i className="bi bi-cloud-arrow-up"></i>}
                {isUploading === activeSide ? 'アップロード中...' : `${activeSide === 'front' ? '表面' : '裏面'}のファイルを選択`}
              </button>
            </div>

            {/* 表示調整ツール */}
            {currentUrl && (
              <div className="flex items-center gap-2">
                {currentUrl.match(/\.(pdf|ai)$/i) && (
                  <div className="flex items-center bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 shadow-inner">
                    <span className="text-[10px] text-slate-400 mr-1 font-bold">Page</span>
                    <input 
                      type="number" min="1" 
                      value={activeSide === 'front' ? submitForm.frontPageNum : submitForm.backPageNum} 
                      onChange={e => setSubmitForm(prev => activeSide === 'front' ? {...prev, frontPageNum: parseInt(e.target.value)} : {...prev, backPageNum: parseInt(e.target.value)})} 
                      className="w-10 bg-transparent text-white text-center font-mono text-xs outline-none" 
                    />
                  </div>
                )}
                <button type="button" onClick={rotatePreview} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap">
                  <i className="bi bi-arrow-clockwise"></i> 回転
                </button>
                {/* PDF以外はFit設定ボタンを表示 */}
                {!currentUrl.match(/\.(pdf|ai)$/i) && (
                  <button type="button" onClick={toggleFit} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap">
                    <i className={currentSettings.fit === 'contain' ? 'bi-arrows-expand' : 'bi-arrows-collapse'}></i> {currentSettings.fit === 'contain' ? '枠を埋める' : '全体表示'}
                  </button>
                )}
                <button type="button" onClick={() => clearSide(activeSide)} className="bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white px-3 py-2 rounded-lg border border-rose-500/50 transition-colors shadow-sm" title="削除">
                  <i className="bi bi-trash-fill text-sm"></i>
                </button>
              </div>
            )}
          </div>

          {/* PDF複数ページ割り当て用モーダル */}
          {pdfSetupModal && (
            <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
                <i className="bi bi-file-earmark-pdf text-5xl text-rose-400 mb-3 block"></i>
                <h3 className="text-white font-black text-lg mb-2">複数ページのPDFですか？</h3>
                <p className="text-xs text-slate-400 mb-6 font-medium leading-relaxed">
                  ページ割り当てを選択してください。
                </p>
                <div className="space-y-2">
                  <button type="button" onClick={() => handlePdfSetup(1)} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold text-xs transition-colors border border-slate-600">
                    1ページのみ (この面だけに適用)
                  </button>
                  <button type="button" onClick={() => handlePdfSetup(2)} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-3 rounded-xl font-black text-xs transition-all shadow-md">
                    2ページ (表と裏に自動割り当て)
                  </button>
                  <button type="button" onClick={() => handlePdfSetup(3)} className="w-full text-slate-400 hover:text-white py-2 rounded-xl font-bold text-xs transition-colors mt-2">
                    後で手動で指定する
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ==================================================== */}
        {/* 右カラム：仕様設定フォーム (スクロール可) */}
        {/* ==================================================== */}
        <div className="w-[45%] bg-slate-50 flex flex-col relative">
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 space-y-8 pb-32">
            
            {/* 1. 印刷カラー */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-800 border-l-4 border-fuchsia-500 pl-2">1. 印刷カラー</h2>
              <div className="grid grid-cols-2 gap-3">
                {COLOR_TYPES.map(color => (
                  <label key={color.id} className={`cursor-pointer border-2 rounded-xl p-3 transition-all relative overflow-hidden group ${submitForm.colorType === color.id ? 'border-fuchsia-500 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input type="radio" name="colorType" className="hidden" checked={submitForm.colorType === color.id} onChange={() => setSubmitForm({...submitForm, colorType: color.id})} />
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${color.colorClass}`}></div>
                    <div className="font-black text-slate-800 text-xs mb-0.5">{color.label}</div>
                    <div className="text-[9px] text-slate-500">{color.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. 用紙の種類 */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-800 border-l-4 border-fuchsia-500 pl-2">2. 用紙の種類</h2>
              <div className="grid grid-cols-3 gap-3">
                {PAPER_TYPES.map(paper => (
                  <label key={paper.id} className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all relative flex flex-col items-center justify-center ${submitForm.paperType === paper.id ? 'border-fuchsia-500 bg-fuchsia-50/50 shadow-sm text-fuchsia-700' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'}`}>
                    <input type="radio" name="paperType" className="hidden" checked={submitForm.paperType === paper.id} onChange={() => setSubmitForm({...submitForm, paperType: paper.id})} />
                    <div className="flex justify-center opacity-80">{paper.icon}</div>
                    <div className="font-bold text-xs mb-1">{paper.label}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. 用紙の厚さ */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-800 border-l-4 border-fuchsia-500 pl-2">3. 用紙の厚さ</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {PAPER_WEIGHTS.map(weight => (
                  <label key={weight.id} className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all relative flex flex-col items-center justify-center ${submitForm.paperWeight === weight.id ? 'border-fuchsia-500 bg-fuchsia-50/50 shadow-sm text-fuchsia-700' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'}`}>
                    <input type="radio" name="paperWeight" className="hidden" checked={submitForm.paperWeight === weight.id} onChange={() => setSubmitForm({...submitForm, paperWeight: weight.id})} />
                    <div className="flex justify-center opacity-40">{weight.icon}</div>
                    <div className="font-bold text-[10px] leading-tight">{weight.label}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. 印刷部数・オプション */}
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-800 border-l-4 border-fuchsia-500 pl-2">4. 部数と加工オプション</h2>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-2">印刷部数 (枚) <span className="text-rose-500">*</span></label>
                  <input type="number" required min="100" step="100" value={submitForm.printCount} onChange={e => setSubmitForm({...submitForm, printCount: parseInt(e.target.value)})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none font-mono font-black text-2xl bg-slate-50" />
                  <p className="text-[9px] text-slate-500 font-bold mt-1">※配布予定枚数に対して、少し多め（予備）の部数を設定してください。</p>
                </div>

                <hr className="border-slate-100" />

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-2">特殊折り加工</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FOLDING_OPTIONS.map(opt => (
                      <label key={opt.id} className={`cursor-pointer border-2 rounded-xl p-2 flex flex-col items-center justify-center gap-1 transition-all ${submitForm.foldingOption === opt.id ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                        <input type="radio" className="hidden" checked={submitForm.foldingOption === opt.id} onChange={() => setSubmitForm({...submitForm, foldingOption: opt.id})} />
                        <i className={`bi ${opt.icon} text-lg opacity-80`}></i>
                        <div className="font-bold text-[9px] text-center">{opt.label}</div>
                      </label>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 mt-3">
                    <i className="bi bi-exclamation-triangle-fill text-amber-500 text-sm mt-0.5"></i>
                    <p className="text-[10px] text-amber-800 leading-relaxed">
                      <span className="font-bold">自動折り加工について：</span><br/>B4/A3サイズ以上のチラシで「折らない」を選択しても、ポスティング配送の都合上、自動的に「2つ折り」加工が適用されます。
                    </p>
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div>
                  <label className="flex items-start gap-3 cursor-pointer group bg-fuchsia-50/50 p-3 rounded-xl border border-fuchsia-100 transition-colors">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input type="checkbox" className="peer w-5 h-5 appearance-none border-2 border-slate-300 rounded focus:ring-2 focus:ring-fuchsia-500 checked:bg-fuchsia-600 checked:border-fuchsia-600 transition-colors bg-white cursor-pointer" checked={submitForm.sampleRequired} onChange={e => setSubmitForm({...submitForm, sampleRequired: e.target.checked})} />
                      <i className="bi bi-check text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 text-lg"></i>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm group-hover:text-fuchsia-700 transition-colors">印刷見本(サンプル)の送付を希望</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">印刷完了後、ご指定の住所へ約50枚を無料でお送りします。</div>
                    </div>
                  </label>

                  {submitForm.sampleRequired && (
                    <div className="mt-3 pl-8 animate-in slide-in-from-top-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">サンプル送付先住所・宛名 <span className="text-rose-500">*</span></label>
                      <textarea required value={submitForm.sampleShippingAddress} onChange={e => setSubmitForm({...submitForm, sampleShippingAddress: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none text-xs bg-slate-50" rows={2} placeholder="〒000-0000 東京都...&#10;株式会社〇〇 ご担当者様名"></textarea>
                    </div>
                  )}
                </div>
                
                <hr className="border-slate-100" />

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-2">その他 備考・特記事項</label>
                  <textarea value={submitForm.remarks} onChange={e => setSubmitForm({...submitForm, remarks: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500 outline-none text-xs bg-slate-50" rows={3} placeholder="・GigaFile便のURL: https://...&#10;・色の濃さについて要望など"></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* ★ 送信ボタンエリア (サイズを最適化し、下部に固定) */}
          <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-20 flex justify-end gap-3 items-center">
            <span className="text-[10px] font-bold text-slate-400 hidden lg:block">内容に問題がなければ入稿してください。</span>
            <button type="button" onClick={() => router.back()} className="px-5 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm">
              キャンセル
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !!isUploading || (!submitForm.frontDesignUrl && submitForm.remarks.length === 0)}
              className="px-8 py-2.5 font-black text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg shadow-md shadow-fuchsia-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {isSubmitting ? '送信中...' : <><i className="bi bi-send-fill"></i> この内容で入稿を完了する</>}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}