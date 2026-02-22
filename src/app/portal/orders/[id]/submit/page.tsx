'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// --- 設定項目の定義 ---
const PAPER_TYPES = [
  { id: 'コート紙', label: 'コート紙', desc: '写真が綺麗に発色。一般的なチラシに。', icon: <i className="bi bi-stars text-3xl mb-2 block text-fuchsia-400"></i> },
  { id: 'マット紙', label: 'マット紙', desc: '光沢を抑えた落ち着いた質感。', icon: <i className="bi bi-moon-stars-fill text-3xl mb-2 block text-indigo-400"></i> },
  { id: '上質紙', label: '上質紙', desc: '光沢ゼロ。鉛筆等での書き込みに。', icon: <i className="bi bi-pencil-fill text-3xl mb-2 block text-emerald-400"></i> },
];

const PAPER_WEIGHTS = [
  { id: '73kg (標準)', label: '73kg', desc: 'ポスティングで標準的な厚さ。', icon: <span className="font-black text-2xl mb-1 block text-slate-400">薄</span> },
  { id: '90kg (少し厚め)', label: '90kg', desc: '会社案内やパンフレットに。', icon: <span className="font-black text-2xl mb-1 block text-slate-500">普</span> },
  { id: '110kg (厚手)', label: '110kg', desc: 'ペラペラしない。ポスター等に。', icon: <span className="font-black text-2xl mb-1 block text-slate-600">厚</span> },
  { id: '135kg (ハガキ厚)', label: '135kg', desc: 'ハガキと同等のしっかり感。', icon: <span className="font-black text-2xl mb-1 block text-slate-800">極</span> },
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
  const resolvedParams = React.use(params);
  const orderId = parseInt(resolvedParams.id);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI・プレビュー状態
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isUploading, setIsUploading] = useState<'front' | 'back' | false>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // プレビューの回転状態 (0, 90, 180, 270)
  const [previewSettings, setPreviewSettings] = useState({
    front: { rotate: 0 },
    back: { rotate: 0 }
  });

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

  const processFile = async (file: File, side: 'front' | 'back') => {
    if (file.size > 50 * 1024 * 1024) { 
      alert('50MB以上のファイルはアップロードできません。GigaFile便等のURLを備考欄へ貼り付けてください。');
      return;
    }

    setIsUploading(side);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        if (side === 'front') {
          setSubmitForm(prev => ({ ...prev, frontDesignUrl: data.url }));
        } else {
          setSubmitForm(prev => ({ ...prev, backDesignUrl: data.url }));
        }
        setPreviewSettings(prev => ({ ...prev, [side]: { rotate: 0 } }));
      } else { alert('アップロードに失敗しました。'); }
    } catch (err) { alert('通信エラーが発生しました。'); }
    setIsUploading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) processFile(file, side);
    e.target.value = ''; 
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => { setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file, activeSide);
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

  const clearSide = (side: 'front' | 'back') => {
    setSubmitForm(prev => ({ ...prev, [side === 'front' ? 'frontDesignUrl' : 'backDesignUrl']: '' }));
    setPreviewSettings(prev => ({ ...prev, [side]: { rotate: 0 } }));
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

  // ★ 完璧な数学的計算に基づくプレビュー要素 (縦横のズレ解消版)
  const PreviewElement = ({ url, pageNum, orientation, rotate }: { url: string, pageNum: number, orientation: string, rotate: number }) => {
    if (!url) return null;
    const lower = url.toLowerCase();
    
    const isPortrait = orientation === 'portrait';
    // 横長(landscape)の時はベースとして-90度回転させる
    const baseRotate = isPortrait ? 0 : -90;
    const totalRotate = baseRotate + rotate;

    // ★ 縦横比が逆転する場合、はみ出さないようにサイズを調整する計算
    let innerWidth = '100%';
    let innerHeight = '100%';

    // 横向き(-90度)の時は、100cqh / 100cqw を使って親枠にピッタリフィットさせる
    if (!isPortrait) {
      innerWidth = '100cqh';
      innerHeight = '100cqw';
    }

    const innerStyle: React.CSSProperties = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: innerWidth,
      height: innerHeight,
      transform: `translate(-50%, -50%) rotate(${totalRotate}deg)`,
      transformOrigin: 'center center',
      transition: 'transform 0.3s ease-in-out, width 0.3s, height 0.3s',
    };
    
    if (lower.match(/\.(jpeg|jpg|png|webp|gif)$/)) {
      return (
        <div className="pointer-events-none overflow-hidden" style={innerStyle}>
          <img src={url} alt="Preview" className="w-full h-full object-fill" />
        </div>
      );
    }
    
    if (lower.endsWith('.pdf')) {
      return (
        <div className="pointer-events-none overflow-hidden bg-white" style={innerStyle}>
          {/* iframe自体を106%に拡大してスクロールバーを隠す (clip-pathは親枠に適用される) */}
          <iframe 
            src={`${url}#page=${pageNum}&view=Fit&toolbar=0&navpanes=0&scrollbar=0`} 
            className="absolute border-none pointer-events-none"
            style={{ width: '106%', height: '106%', top: '-3%', left: '-3%' }}
            scrolling="no"
            tabIndex={-1}
          />
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-fuchsia-600 z-10">
        <i className="bi bi-filetype-ai text-6xl mb-4"></i>
        <span className="font-black text-lg">AI / ZIP データ</span>
        <span className="text-xs opacity-70 mt-1">※プレビュー非対応形式です</span>
      </div>
    );
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin"></div></div>;
  
  const isDoubleSided = submitForm.colorType.includes('両面');
  const currentUrl = activeSide === 'front' ? submitForm.frontDesignUrl : submitForm.backDesignUrl;
  const currentSettings = previewSettings[activeSide];

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden text-slate-800 font-sans">
      
      {/* ヘッダー */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors text-slate-600">
            <i className="bi bi-arrow-left text-xl"></i>
          </button>
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <span className="text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded border border-fuchsia-200 animate-pulse">入稿手続き</span>
              <span className="text-xs font-bold text-slate-400 font-mono tracking-wider">{order?.orderNo}</span>
            </div>
            <h1 className="font-black text-slate-800 text-lg truncate max-w-lg leading-tight">
              {order?.title || '名称未設定'}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* ==================================================== */}
        {/* 左カラム：プレビュー ＆ アップロード (ドラッグ＆ドロップ対応) */}
        {/* ==================================================== */}
        <div 
          className={`w-[55%] flex flex-col relative overflow-hidden transition-colors duration-300 ${isDragOver ? 'bg-fuchsia-100/50' : 'bg-slate-200'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-fuchsia-600/10 backdrop-blur-sm m-4 rounded-3xl border-4 border-fuchsia-500 border-dashed">
              <div className="bg-white px-10 py-8 rounded-3xl shadow-2xl text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-fuchsia-100 text-fuchsia-600 rounded-full flex items-center justify-center text-4xl mb-4 animate-bounce">
                  <i className="bi bi-cloud-arrow-up-fill"></i>
                </div>
                <h2 className="text-2xl font-black text-slate-800">ファイルをドロップ</h2>
                <p className="text-sm font-bold text-slate-500 mt-2">{activeSide === 'front' ? '表面' : '裏面'}としてアップロードします</p>
              </div>
            </div>
          )}

          {/* 上部：表裏タブ と 向き切替 */}
          <div className="h-16 px-6 flex justify-between items-center bg-white/50 backdrop-blur-md border-b border-slate-300 z-30 shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-slate-200 p-1 rounded-xl flex gap-1 shadow-inner">
                <button type="button" onClick={() => setActiveSide('front')} className={`px-6 py-1.5 rounded-lg text-sm font-black transition-all ${activeSide === 'front' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  表面
                </button>
                <button type="button" onClick={() => setActiveSide('back')} disabled={!isDoubleSided} className={`px-6 py-1.5 rounded-lg text-sm font-black transition-all disabled:opacity-30 ${activeSide === 'back' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  裏面
                </button>
              </div>
              
              {(submitForm.frontDesignUrl || submitForm.backDesignUrl) && (
                <button type="button" onClick={handleSwapSides} className="bg-white hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 shadow-sm transition-all ml-2">
                  <i className="bi bi-arrow-left-right mr-1"></i> 表裏入替
                </button>
              )}
            </div>

            <div className="bg-slate-200 p-1 rounded-xl flex gap-1 shadow-inner">
              <button type="button" onClick={() => setOrientation('portrait')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${orientation === 'portrait' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <i className="bi bi-file-earmark"></i> 縦向き
              </button>
              <button type="button" onClick={() => setOrientation('landscape')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${orientation === 'landscape' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <i className="bi bi-file-earmark rotate-90"></i> 横向き
              </button>
            </div>
          </div>

          {/* ★ 中央：プレビューキャンバス (アスペクト比固定 ＆ スクロール排除) */}
          <div className="flex-1 min-h-0 p-8 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            {/* 仕上がりサイズのアスペクト比コンテナ */}
            <div 
              className={`relative bg-white shadow-2xl flex items-center justify-center z-10 transition-all duration-300 overflow-hidden ${!currentUrl && 'border-4 border-dashed border-slate-300 bg-slate-100/50'}`}
              style={{
                containerType: 'size', // 子要素のCQ計算に必須
                aspectRatio: orientation === 'portrait' ? '1 / 1.414' : '1.414 / 1',
                // Flexbox内で画面に収まる最大サイズになるようにする
                maxHeight: '100%',
                maxWidth: '100%',
                height: orientation === 'portrait' ? '100%' : 'auto',
                width: orientation === 'landscape' ? '100%' : 'auto',
              }}
            >
              {isUploading === activeSide ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-fuchsia-600 bg-white/80 backdrop-blur-sm z-30">
                   <div className="w-12 h-12 border-4 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin mb-4"></div>
                   <p className="font-bold text-sm">アップロード中...</p>
                 </div>
              ) : currentUrl ? (
                 <>
                   <PreviewElement 
                     url={currentUrl} 
                     pageNum={activeSide === 'front' ? submitForm.frontPageNum : submitForm.backPageNum} 
                     orientation={orientation}
                     rotate={currentSettings.rotate}
                   />
                   
                   {/* 断裁線＆安全圏ガイド */}
                   <div className="absolute top-[2%] bottom-[2%] left-[2%] right-[2%] border-[1.5px] border-rose-500/80 pointer-events-none z-20">
                      <span className="absolute -top-[18px] left-0 text-rose-500 text-[9px] font-black bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">仕上がり位置 (断裁線)</span>
                   </div>
                   <div className="absolute top-[4%] bottom-[4%] left-[4%] right-[4%] border-[1px] border-blue-500/80 border-dashed pointer-events-none z-20">
                      <span className="absolute -top-[18px] left-24 text-blue-500 text-[9px] font-black bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">文字切れ安全圏</span>
                   </div>
                 </>
              ) : (
                 <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center z-10 pointer-events-none">
                   <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center text-3xl mb-4 text-slate-300">
                     <i className="bi bi-cloud-arrow-up"></i>
                   </div>
                   <p className="font-black text-slate-600 text-lg mb-2">{activeSide === 'front' ? '表面' : '裏面'}のデータをアップロード</p>
                   <p className="text-xs font-bold mb-6">ここにファイルをドラッグ＆ドロップ、または下のボタンから選択</p>
                   
                   <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 pointer-events-auto">
                     <p className="text-[10px] font-black text-slate-500 mb-2">対応フォーマット (上限 50MB)</p>
                     <div className="flex flex-wrap justify-center gap-2">
                       {['PDF', 'AI', 'PSD', 'JPG', 'PNG', 'ZIP'].map(ext => (
                         <span key={ext} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{ext}</span>
                       ))}
                     </div>
                   </div>

                   {/* 裏面が空で、表面にPDF/AIがある場合のショートカットボタン */}
                   {activeSide === 'back' && submitForm.frontDesignUrl && submitForm.frontDesignUrl.match(/\.(pdf|ai)$/i) && (
                     <button 
                       type="button" 
                       onClick={applyFrontToBack}
                       className="mt-8 px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all pointer-events-auto"
                     >
                       <i className="bi bi-file-earmark-plus"></i>
                       表面の「2ページ目」を裏面として使う
                     </button>
                   )}
                 </div>
              )}
            </div>
          </div>

          {/* 下部：ツールバー */}
          <div className="bg-white p-4 border-t border-slate-200 shrink-0 z-20 flex items-center justify-between gap-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            <div className="relative">
              <input type="file" ref={fileInputRef} accept=".pdf,.ai,.psd,.jpg,.jpeg,.png,.zip" onChange={(e) => handleFileUpload(e, activeSide)} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm shadow-sm">
                <i className="bi bi-cloud-arrow-up"></i> ファイルを選択
              </button>
            </div>

            {currentUrl && (
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                {currentUrl.match(/\.(pdf|ai)$/i) && (
                  <div className="flex items-center px-3 py-1 border-r border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold mr-2">Page</span>
                    <input 
                      type="number" min="1" 
                      value={activeSide === 'front' ? submitForm.frontPageNum : submitForm.backPageNum} 
                      onChange={e => setSubmitForm(prev => activeSide === 'front' ? {...prev, frontPageNum: parseInt(e.target.value)} : {...prev, backPageNum: parseInt(e.target.value)})} 
                      className="w-12 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-xs outline-none focus:border-fuchsia-500" 
                    />
                  </div>
                )}
                
                <button type="button" onClick={() => clearSide(activeSide)} className="hover:bg-rose-100 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                  <i className="bi bi-trash-fill text-sm"></i> 削除
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================== */}
        {/* 右カラム：仕様設定フォーム */}
        {/* ==================================================== */}
        <div className="w-[45%] bg-white flex flex-col border-l border-slate-200 overflow-hidden">
          
          {/* 設定フォーム本体 (スクロール領域) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-10 space-y-12 pb-10">
            
            {/* 1. 印刷カラー */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">1</span>
                <h2 className="text-lg font-black text-slate-800">印刷カラー</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {COLOR_TYPES.map(color => (
                  <label key={color.id} className={`cursor-pointer border-2 rounded-2xl p-4 transition-all relative overflow-hidden group ${submitForm.colorType === color.id ? 'border-fuchsia-500 bg-white shadow-md' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                    <input type="radio" name="colorType" className="hidden" checked={submitForm.colorType === color.id} onChange={() => setSubmitForm({...submitForm, colorType: color.id})} />
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${color.colorClass}`}></div>
                    <div className="font-black text-slate-800 text-sm mb-1">{color.label}</div>
                    <div className="text-[10px] text-slate-500 font-bold">{color.desc}</div>
                    {submitForm.colorType === color.id && <i className="bi bi-check-circle-fill absolute bottom-3 right-4 text-fuchsia-500 text-xl"></i>}
                  </label>
                ))}
              </div>
            </div>

            {/* 2. 用紙の種類 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">2</span>
                <h2 className="text-lg font-black text-slate-800">用紙の種類</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {PAPER_TYPES.map(paper => (
                  <label key={paper.id} className={`cursor-pointer border-2 rounded-2xl p-4 text-center transition-all relative flex flex-col items-center justify-center ${submitForm.paperType === paper.id ? 'border-fuchsia-500 bg-fuchsia-50 shadow-md' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                    <input type="radio" name="paperType" className="hidden" checked={submitForm.paperType === paper.id} onChange={() => setSubmitForm({...submitForm, paperType: paper.id})} />
                    <div className={`flex justify-center ${submitForm.paperType !== paper.id && 'grayscale opacity-50'}`}>{paper.icon}</div>
                    <div className="font-black text-sm mb-1 text-slate-800">{paper.label}</div>
                    <div className="text-[9px] text-slate-500 font-bold leading-tight">{paper.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. 用紙の厚さ */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">3</span>
                <h2 className="text-lg font-black text-slate-800">用紙の厚さ</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {PAPER_WEIGHTS.map(weight => (
                  <label key={weight.id} className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all relative flex flex-col items-center justify-center ${submitForm.paperWeight === weight.id ? 'border-fuchsia-500 bg-fuchsia-50 shadow-md' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                    <input type="radio" name="paperWeight" className="hidden" checked={submitForm.paperWeight === weight.id} onChange={() => setSubmitForm({...submitForm, paperWeight: weight.id})} />
                    <div className={`flex justify-center ${submitForm.paperWeight !== weight.id && 'opacity-40'}`}>{weight.icon}</div>
                    <div className="font-black text-[11px] mb-1 text-slate-800">{weight.label}</div>
                    <div className="text-[9px] text-slate-500 font-bold leading-tight hidden lg:block">{weight.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. 印刷部数・オプション */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">4</span>
                <h2 className="text-lg font-black text-slate-800">部数と加工オプション</h2>
              </div>
              
              <div className="space-y-8">
                
                <div>
                  <label className="block text-sm font-black text-slate-800 mb-2">印刷部数 (枚) <span className="text-rose-500">*</span></label>
                  <input type="number" required min="100" step="100" value={submitForm.printCount} onChange={e => setSubmitForm({...submitForm, printCount: parseInt(e.target.value)})} className="w-full p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none font-mono font-black text-2xl bg-white shadow-sm" />
                  <p className="text-[10px] text-slate-500 font-bold mt-2">※配布予定枚数に対して、少し多め（予備）の部数を設定してください。</p>
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-800 mb-2">特殊折り加工</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FOLDING_OPTIONS.map(opt => (
                      <label key={opt.id} className={`cursor-pointer border-2 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 transition-all ${submitForm.foldingOption === opt.id ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <input type="radio" className="hidden" checked={submitForm.foldingOption === opt.id} onChange={() => setSubmitForm({...submitForm, foldingOption: opt.id})} />
                        <i className={`bi ${opt.icon} text-xl opacity-80`}></i>
                        <div className="font-bold text-[10px] text-center">{opt.label}</div>
                      </label>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 mt-3">
                    <i className="bi bi-exclamation-triangle-fill text-amber-500 text-sm mt-0.5"></i>
                    <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                      自動折り加工について：<br/>B4/A3サイズ以上のチラシで「折らない」を選択しても、ポスティング配送の都合上、自動的に「2つ折り」加工が適用されます。
                    </p>
                  </div>
                </div>

                <div>
                  <label className="flex items-start gap-3 cursor-pointer group bg-slate-50 hover:bg-slate-100 p-4 rounded-xl border border-slate-200 transition-colors">
                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                      <input type="checkbox" className="peer w-5 h-5 appearance-none border-2 border-slate-300 rounded focus:ring-2 focus:ring-fuchsia-500 checked:bg-fuchsia-600 checked:border-fuchsia-600 transition-colors bg-white cursor-pointer" checked={submitForm.sampleRequired} onChange={e => setSubmitForm({...submitForm, sampleRequired: e.target.checked})} />
                      <i className="bi bi-check text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 text-lg"></i>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm transition-colors">印刷見本(サンプル)の送付を希望</div>
                      <div className="text-[10px] text-slate-500 font-bold mt-1">印刷完了後、ご指定の住所へ約50枚を無料でお送りします。</div>
                    </div>
                  </label>

                  {submitForm.sampleRequired && (
                    <div className="mt-3 pl-8 animate-in slide-in-from-top-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">サンプル送付先住所・宛名 <span className="text-rose-500">*</span></label>
                      <textarea required value={submitForm.sampleShippingAddress} onChange={e => setSubmitForm({...submitForm, sampleShippingAddress: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none text-xs bg-white shadow-sm" rows={2} placeholder="〒000-0000 東京都...&#10;株式会社〇〇 ご担当者様名"></textarea>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-black text-slate-800 mb-2">その他 備考・特記事項</label>
                  <textarea value={submitForm.remarks} onChange={e => setSubmitForm({...submitForm, remarks: e.target.value})} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none text-sm bg-white shadow-sm" rows={3} placeholder="・GigaFile便のURL: https://...&#10;・色の濃さについて要望など"></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* ★ 送信ボタンエリア */}
          <div className="bg-slate-50 border-t border-slate-200 p-5 shrink-0 z-20 flex justify-end gap-3 items-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            <span className="text-[10px] font-bold text-slate-400 hidden lg:block mr-auto">内容に問題がなければ入稿してください。</span>
            <button type="button" onClick={() => router.back()} className="px-5 py-2.5 font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors text-sm shadow-sm">
              キャンセル
            </button>
            <button 
              type="button" 
              onClick={handleSubmitData}
              disabled={isSubmitting || !!isUploading || (!submitForm.frontDesignUrl && submitForm.remarks.length === 0)}
              className="px-8 py-2.5 font-black text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg shadow-md shadow-fuchsia-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {isSubmitting ? '送信中...' : <><i className="bi bi-send-fill text-lg"></i> この内容で入稿を完了する</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}