'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SubmitDataPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const orderId = parseInt(resolvedParams.id);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isUploading, setIsUploading] = useState<'front' | 'back' | false>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [previewSettings, setPreviewSettings] = useState({
    front: { rotate: 0 },
    back: { rotate: 0 }
  });

  const [submitForm, setSubmitForm] = useState({
    frontDesignUrl: '',
    backDesignUrl: '',
    frontPageNum: 1,
    backPageNum: 2,
    remarks: ''
  });

  // 発注時に確定済みの印刷仕様を表示するため取得
  const [printingSpec, setPrintingSpec] = useState<any>(null);

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
          // 印刷仕様を取得
          if (targetOrder.printings && targetOrder.printings.length > 0) {
            setPrintingSpec(targetOrder.printings[0]);
          }
        }
      } catch (e) { console.error(e); }
      setIsLoading(false);
    };
    fetchOrder();
  }, [orderId, router]);

  const isDoubleSided = printingSpec?.colorType?.includes('両面') ?? true;

  const processFile = async (file: File, side: 'front' | 'back') => {
    if (file.size > 50 * 1024 * 1024) {
      alert('50MB以上のファイルはアップロードできません。GigaFile便等のURLを備考欄へ貼り付けてください。');
      return;
    }

    setIsUploading(side);
    const formData = new FormData();
    formData.append('file', file);
    if (order?.orderNo) formData.append('orderNo', order.orderNo);
    if (order?.title) formData.append('title', order.title);
    formData.append('sideName', side === 'front' ? '表面' : '裏面');

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
    setSubmitForm(prev => ({ ...prev, backDesignUrl: prev.frontDesignUrl, backPageNum: prev.frontPageNum + 1 }));
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
      ...prev, [activeSide]: { rotate: (prev[activeSide].rotate + 90) % 360 }
    }));
  };

  const clearSide = (side: 'front' | 'back') => {
    setSubmitForm(prev => ({ ...prev, [side === 'front' ? 'frontDesignUrl' : 'backDesignUrl']: '' }));
    setPreviewSettings(prev => ({ ...prev, [side]: { rotate: 0 } }));
  };

  const handleSubmitData = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasExternalUrl = submitForm.remarks.includes('http');

    if (!submitForm.frontDesignUrl && !hasExternalUrl) {
      alert('表面のデータが添付されていません。\nファイルをアップロードするか、大容量の場合は備考欄にGigaFile便などのURLを記載してください。');
      setActiveSide('front');
      return;
    }

    if (isDoubleSided && !submitForm.backDesignUrl && !hasExternalUrl) {
      alert('「両面」印刷が指定されていますが、裏面のデータが未入稿です。\n裏面のデータをアップロードするか、備考欄にURLを記載してください。');
      setActiveSide('back');
      return;
    }

    if (!submitForm.frontDesignUrl && hasExternalUrl) {
      if (!confirm('表面のデータがシステムに添付されていません。\n備考欄のURLにて手配済みとして入稿を進めますか？')) return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/orders/${orderId}/submit-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitForm)
      });
      if (res.ok) {
        alert('データを入稿しました！入金手続きへ進んでください。');
        router.push('/portal/orders');
      } else { alert('エラーが発生しました'); }
    } catch (err) { alert('通信エラーが発生しました'); }
    setIsSubmitting(false);
  };

  const PreviewElement = ({ url, pageNum, orientation, rotate, containerRef }: { url: string, pageNum: number, orientation: string, rotate: number, containerRef: React.RefObject<HTMLDivElement> }) => {
    const [dim, setDim] = useState({ w: 0, h: 0 });

    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver((entries) => {
        if (entries[0]) setDim({ w: entries[0].contentRect.width, h: entries[0].contentRect.height });
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [containerRef]);

    if (!url || dim.w === 0) return null;
    const lower = url.toLowerCase();
    const isPortrait = orientation === 'portrait';
    const baseRotate = isPortrait ? 0 : -90;
    const totalRotate = baseRotate + rotate;

    let innerWidth = '100%';
    let innerHeight = '100%';
    if (!isPortrait) { innerWidth = '100cqh'; innerHeight = '100cqw'; }

    const innerStyle: React.CSSProperties = {
      position: 'absolute', top: '50%', left: '50%',
      width: innerWidth, height: innerHeight,
      transform: `translate(-50%, -50%) rotate(${totalRotate}deg)`,
      transformOrigin: 'center center',
      transition: 'transform 0.3s ease-in-out, width 0.3s, height 0.3s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    };

    if (lower.match(/\.(jpeg|jpg|png|webp|gif)$/)) {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div style={innerStyle}><img src={url} alt="Preview" className="w-full h-full object-fill" /></div>
        </div>
      );
    }
    if (lower.endsWith('.pdf')) {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-white">
          <div style={innerStyle}>
            <iframe src={`${url}#page=${pageNum}&view=Fit&toolbar=0&navpanes=0&scrollbar=0`}
              className="absolute border-none pointer-events-none"
              style={{ width: '104%', height: '104%', top: '-2%', left: '-2%' }}
              scrolling="no" tabIndex={-1} />
          </div>
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

        {/* 左カラム：プレビュー ＆ アップロード */}
        <div
          className={`w-[60%] flex flex-col relative overflow-hidden transition-colors duration-300 ${isDragOver ? 'bg-fuchsia-100/50' : 'bg-slate-200'}`}
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
                <button type="button" onClick={() => setActiveSide('front')} className={`px-6 py-1.5 rounded-lg text-sm font-black transition-all relative ${activeSide === 'front' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  表面
                  {!submitForm.frontDesignUrl && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm"></span>
                  )}
                </button>
                <button type="button" onClick={() => setActiveSide('back')} disabled={!isDoubleSided} className={`px-6 py-1.5 rounded-lg text-sm font-black transition-all relative disabled:opacity-30 ${activeSide === 'back' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  裏面
                  {isDoubleSided && !submitForm.backDesignUrl && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm"></span>
                  )}
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
                <i className="bi bi-file-earmark"></i> 縦長
              </button>
              <button type="button" onClick={() => setOrientation('landscape')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${orientation === 'landscape' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <i className="bi bi-file-earmark rotate-90"></i> 横長
              </button>
            </div>
          </div>

          {/* 中央：プレビューキャンバス */}
          <div className="flex-1 min-h-0 p-8 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            <div
              ref={previewContainerRef}
              className={`relative bg-white shadow-2xl flex items-center justify-center z-10 transition-all duration-300 overflow-hidden ${!currentUrl && 'border-4 border-dashed border-slate-300 bg-slate-100/50'}`}
              style={{
                containerType: 'size',
                aspectRatio: orientation === 'portrait' ? '1 / 1.4142' : '1.4142 / 1',
                maxHeight: '100%', maxWidth: '100%',
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
                  <PreviewElement url={currentUrl} pageNum={activeSide === 'front' ? submitForm.frontPageNum : submitForm.backPageNum} orientation={orientation} rotate={currentSettings.rotate} containerRef={previewContainerRef} />
                  <div className="absolute top-[2%] bottom-[2%] left-[2%] right-[2%] border-[1.5px] border-rose-500/80 pointer-events-none z-20">
                    <span className="absolute -top-[18px] left-0 text-rose-500 text-[10px] font-black bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">仕上がり位置 (断裁線)</span>
                  </div>
                  <div className="absolute top-[4%] bottom-[4%] left-[4%] right-[4%] border-[1px] border-blue-500/80 border-dashed pointer-events-none z-20">
                    <span className="absolute -top-[18px] left-28 text-blue-500 text-[10px] font-black bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">文字切れ安全圏</span>
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
                  {activeSide === 'back' && submitForm.frontDesignUrl && submitForm.frontDesignUrl.match(/\.(pdf|ai)$/i) && (
                    <button type="button" onClick={applyFrontToBack} className="mt-8 px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all pointer-events-auto">
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
                    <input type="number" min="1"
                      value={activeSide === 'front' ? submitForm.frontPageNum : submitForm.backPageNum}
                      onChange={e => setSubmitForm(prev => activeSide === 'front' ? {...prev, frontPageNum: parseInt(e.target.value)} : {...prev, backPageNum: parseInt(e.target.value)})}
                      className="w-12 bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-xs outline-none focus:border-fuchsia-500" />
                  </div>
                )}
                <button type="button" onClick={rotatePreview} className="hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                  <i className="bi bi-arrow-clockwise text-sm"></i> 回転
                </button>
                <button type="button" onClick={() => clearSide(activeSide)} className="hover:bg-rose-100 text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                  <i className="bi bi-trash-fill text-sm"></i> 削除
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右カラム：確定済み印刷仕様 + 備考 */}
        <div className="w-[40%] bg-white flex flex-col border-l border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 pb-10">

            {/* 確定済み印刷仕様（読み取り専用） */}
            {printingSpec && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">1</span>
                  <h2 className="text-lg font-black text-slate-800">確定済み印刷仕様</h2>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
                  <p className="text-[10px] font-bold text-indigo-500 mb-3">発注時に確定された仕様です。変更はご連絡ください。</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: '用紙', value: printingSpec.paperType },
                      { label: '厚さ', value: printingSpec.paperWeight },
                      { label: 'カラー', value: printingSpec.colorType },
                      { label: '折り加工', value: printingSpec.foldingOption || 'なし' },
                      { label: '印刷枚数', value: `${printingSpec.printCount?.toLocaleString()} 枚` },
                    ].map(item => (
                      <div key={item.label} className="bg-white rounded-xl p-3 border border-indigo-100">
                        <div className="text-[10px] font-bold text-slate-400 mb-1">{item.label}</div>
                        <div className="font-black text-slate-800">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 備考 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">{printingSpec ? '2' : '1'}</span>
                <h2 className="text-lg font-black text-slate-800">備考・特記事項</h2>
              </div>
              <textarea
                value={submitForm.remarks}
                onChange={e => setSubmitForm({...submitForm, remarks: e.target.value})}
                className="w-full p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none text-sm bg-white shadow-sm"
                rows={6}
                placeholder="・GigaFile便のURL: https://...&#10;・色の濃さについて要望など&#10;・その他ご指示事項"
              />
            </div>
          </div>

          <div className="bg-slate-50 border-t border-slate-200 p-5 shrink-0 z-20 flex justify-end gap-3 items-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            <span className="text-[10px] font-bold text-slate-400 hidden lg:block mr-auto">ファイルをアップロードして入稿してください</span>
            <button type="button" onClick={() => router.back()} className="px-6 py-3 font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors text-sm shadow-sm">
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmitData}
              disabled={isSubmitting || !!isUploading}
              className="px-10 py-3 font-black text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl shadow-md shadow-fuchsia-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {isSubmitting ? '送信中...' : <><i className="bi bi-send-fill text-lg"></i> この内容で入稿する</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
