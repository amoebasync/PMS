'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type ModalVariant = 'error' | 'warning' | 'success' | 'confirm';

type ModalConfig = {
  variant: ModalVariant;
  title: string;
  message: string;
  showPhone?: boolean;
  onConfirm?: () => void;
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4.0;

export default function SubmitDataPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const orderId = parseInt(resolvedParams.id);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const zoomAreaRef = useRef<HTMLDivElement>(null);

  // ---- zoom / pan ----
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ---- preview errors / live text ----
  const [previewErrors, setPreviewErrors] = useState({ front: false, back: false });
  const [liveTextWarnings, setLiveTextWarnings] = useState({ front: false, back: false });

  // ---- checklist ----
  const [showChecklist, setShowChecklist] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [supportPhone, setSupportPhone] = useState('');

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
    sampleRequired: false,
    sampleShippingAddress: '',
    remarks: ''
  });
  const [defaultDeliveryAddress, setDefaultDeliveryAddress] = useState('');

  // 発注時に確定済みの印刷仕様を表示するため取得
  const [printingSpec, setPrintingSpec] = useState<any>(null);

  // カスタマーセンター電話番号を取得
  useEffect(() => {
    fetch('/api/portal/settings')
      .then(r => r.json())
      .then(d => { if (d.supportPhone) setSupportPhone(d.supportPhone); })
      .catch(() => {});
  }, []);

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

  // ---- ホイールズームイベント（non-passive）----
  useEffect(() => {
    const el = zoomAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, currentZoom * factor));
      const scale = newZoom / currentZoom;
      const newPan = {
        x: cx * (1 - scale) + currentPan.x * scale,
        y: cy * (1 - scale) + currentPan.y * scale,
      };
      setZoom(newZoom);
      setPan(newPan);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- モーダルヘルパー ----
  const closeModal = () => setModal(null);

  const showError = (title: string, message: string, showPhone = true, onClose?: () => void) => {
    setModal({ variant: 'error', title, message, showPhone, onConfirm: onClose });
  };

  const showWarning = (title: string, message: string, showPhone = false, onClose?: () => void) => {
    setModal({ variant: 'warning', title, message, showPhone, onConfirm: onClose });
  };

  const showSuccess = (title: string, message: string, onClose?: () => void) => {
    setModal({ variant: 'success', title, message, onConfirm: onClose });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModal({ variant: 'confirm', title, message, onConfirm });
  };
  // -------------------------

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
            setIsLoading(false);
            showError('アクセスエラー', '不正なアクセス、または既に入稿済みの案件です。', false, () => router.push('/portal/orders'));
            return;
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
      showWarning(
        'ファイルサイズ超過',
        '50MB以上のファイルはアップロードできません。\nGigaFile便等のURLを備考欄へ貼り付けてください。',
        true
      );
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
        setPreviewErrors(prev => ({ ...prev, [side]: false }));
        setLiveTextWarnings(prev => ({ ...prev, [side]: data.hasLiveText ?? false }));
        // アップロード成功時にズームリセット
        if (side === activeSide) {
          setZoom(1.0);
          setPan({ x: 0, y: 0 });
        }
      } else {
        showError(
          'アップロード失敗',
          'ファイルのアップロードに失敗しました。\n時間をおいて再度お試しいただくか、カスタマーセンターまでご連絡ください。'
        );
      }
    } catch (err) {
      showError(
        '通信エラー',
        '通信エラーが発生しました。\nインターネット接続を確認してから再度お試しください。'
      );
    }
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

  const switchSide = (side: 'front' | 'back') => {
    setActiveSide(side);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const applyFrontToBack = () => {
    setSubmitForm(prev => ({ ...prev, backDesignUrl: prev.frontDesignUrl, backPageNum: prev.frontPageNum + 1 }));
    switchSide('back');
  };

  const handleSwapSides = () => {
    setSubmitForm(prev => ({
      ...prev, frontDesignUrl: prev.backDesignUrl, backDesignUrl: prev.frontDesignUrl,
      frontPageNum: prev.backPageNum, backPageNum: prev.frontPageNum,
    }));
    setPreviewSettings(prev => ({ front: prev.back, back: prev.front }));
    setLiveTextWarnings(prev => ({ front: prev.back, back: prev.front }));
    setPreviewErrors(prev => ({ front: prev.back, back: prev.front }));
  };

  const rotatePreview = () => {
    setPreviewSettings(prev => ({
      ...prev, [activeSide]: { rotate: (prev[activeSide].rotate + 90) % 360 }
    }));
  };

  const clearSide = (side: 'front' | 'back') => {
    setSubmitForm(prev => ({ ...prev, [side === 'front' ? 'frontDesignUrl' : 'backDesignUrl']: '' }));
    setPreviewSettings(prev => ({ ...prev, [side]: { rotate: 0 } }));
    setLiveTextWarnings(prev => ({ ...prev, [side]: false }));
    setPreviewErrors(prev => ({ ...prev, [side]: false }));
    if (activeSide === side) {
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
    }
  };

  // ---- ズームコントロール ----
  const adjustZoom = (factor: number) => {
    setZoom(prev => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * factor)));
  };

  const resetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // ---- パン操作 ----
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    setIsPanning(false);
  };

  const handleDoubleClick = () => {
    resetZoom();
  };

  // ---- チェックリスト ----
  const checklistItems = [
    { id: 'trim', text: '断裁線（赤枠）より内側に重要なテキスト・ロゴが収まっている' },
    { id: 'bleed', text: '背景色・画像は断裁線の外（塗り足し領域）まで伸びている' },
    { id: 'outline', text: 'テキストはすべてアウトライン化されている', warnIfLiveText: true },
    { id: 'front-correct', text: '表面の内容・向きが正しい' },
    ...(isDoubleSided ? [{ id: 'back-correct', text: '裏面の内容が正しく、表裏が逆になっていない' }] : []),
    { id: 'font-size', text: '文字は十分な大きさで読める' },
  ];

  const toggleCheckItem = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 実際の送信処理（confirmモーダルのコールバックからも呼ばれる）
  const doSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/orders/${orderId}/submit-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitForm)
      });
      if (res.ok) {
        showSuccess(
          '入稿完了！',
          'データを入稿しました。\n入金手続きへ進んでください。',
          () => router.push('/portal/orders')
        );
      } else {
        showError(
          '送信エラー',
          '送信に失敗しました。\n時間をおいて再度お試しいただくか、カスタマーセンターまでご連絡ください。'
        );
      }
    } catch (err) {
      showError(
        '通信エラー',
        '通信エラーが発生しました。\nインターネット接続を確認してから再度お試しください。'
      );
    }
    setIsSubmitting(false);
  };

  // チェックリストから呼ばれる送信（GigaFile確認フローを含む）
  const doSubmitFromChecklist = () => {
    setShowChecklist(false);
    const hasExternalUrl = submitForm.remarks.includes('http');
    if (!submitForm.frontDesignUrl && hasExternalUrl) {
      showConfirm(
        '入稿確認',
        '表面のデータがシステムに添付されていません。\n備考欄のURLにて手配済みとして入稿を進めますか？',
        doSubmit
      );
      return;
    }
    doSubmit();
  };

  const handleSubmitData = async () => {
    const hasExternalUrl = submitForm.remarks.includes('http');

    if (!submitForm.frontDesignUrl && !hasExternalUrl) {
      showWarning(
        'データ未添付',
        '表面のデータが添付されていません。\nファイルをアップロードするか、大容量の場合は備考欄にGigaFile便などのURLを記載してください。',
        false,
        () => switchSide('front')
      );
      return;
    }

    if (isDoubleSided && !submitForm.backDesignUrl && !hasExternalUrl) {
      showWarning(
        '裏面データ未添付',
        '「両面」印刷が指定されていますが、裏面のデータが未入稿です。\n裏面のデータをアップロードするか、備考欄にURLを記載してください。',
        false,
        () => switchSide('back')
      );
      return;
    }

    // バリデーション通過 → チェックリストを表示
    setShowChecklist(true);
  };

  const PreviewElement = ({
    url, pageNum, orientation, rotate, containerRef, hasIframeError, onIframeError
  }: {
    url: string;
    pageNum: number;
    orientation: string;
    rotate: number;
    containerRef: React.RefObject<HTMLDivElement>;
    hasIframeError: boolean;
    onIframeError: () => void;
  }) => {
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
    // PDF および AI ファイル（CS2以降はPDF互換）をiframeでプレビュー
    if (lower.match(/\.(pdf|ai)$/) && !hasIframeError) {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-white">
          <div style={innerStyle}>
            <iframe src={`${url}#page=${pageNum}&view=Fit&toolbar=0&navpanes=0&scrollbar=0`}
              className="absolute border-none pointer-events-none"
              style={{ width: '104%', height: '104%', top: '-2%', left: '-2%' }}
              scrolling="no" tabIndex={-1}
              onError={onIframeError} />
          </div>
        </div>
      );
    }
    // フォールバック（PSD / ZIP / 旧形式AI 等）
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-fuchsia-600 z-10 p-6 text-center">
        <i className="bi bi-filetype-ai text-6xl mb-4"></i>
        <span className="font-black text-lg">AI / PSD / ZIP データ</span>
        <span className="text-xs text-slate-500 mt-2 leading-relaxed">データを受け付けました。<br/>入稿後にスタッフがファイルの内容を確認します。</span>
      </div>
    );
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin"></div></div>;

  const currentUrl = activeSide === 'front' ? submitForm.frontDesignUrl : submitForm.backDesignUrl;
  const currentSettings = previewSettings[activeSide];
  const hasLiveTextOnCurrent = liveTextWarnings[activeSide];

  // モーダルのアイコン・カラー設定
  const modalVariantStyles = {
    error:   { bar: 'bg-rose-500',    icon: 'bg-rose-100 text-rose-500',    btn: 'bg-rose-500 hover:bg-rose-600',    iconClass: 'bi-exclamation-circle-fill' },
    warning: { bar: 'bg-amber-500',   icon: 'bg-amber-100 text-amber-600',  btn: 'bg-amber-500 hover:bg-amber-600',  iconClass: 'bi-exclamation-triangle-fill' },
    success: { bar: 'bg-emerald-500', icon: 'bg-emerald-100 text-emerald-500', btn: 'bg-emerald-500 hover:bg-emerald-600', iconClass: 'bi-check-circle-fill' },
    confirm: { bar: 'bg-fuchsia-600', icon: 'bg-fuchsia-100 text-fuchsia-600', btn: 'bg-fuchsia-600 hover:bg-fuchsia-700', iconClass: 'bi-question-circle-fill' },
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden text-slate-800 font-sans">

      {/* ヘッダー */}
      <div className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button onClick={() => router.back()} className="w-9 h-9 md:w-10 md:h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors text-slate-600 shrink-0">
            <i className="bi bi-arrow-left text-lg md:text-xl"></i>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 md:gap-3 mb-0.5">
              <span className="text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded border border-fuchsia-200 animate-pulse shrink-0">入稿手続き</span>
              <span className="text-[10px] md:text-xs font-bold text-slate-400 font-mono tracking-wider truncate">{order?.orderNo}</span>
            </div>
            <h1 className="font-black text-slate-800 text-base md:text-lg truncate max-w-[200px] sm:max-w-sm md:max-w-lg leading-tight">
              {order?.title || '名称未設定'}
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* 左カラム：プレビュー ＆ アップロード */}
        <div
          className={`w-full md:w-[60%] min-h-[50vh] md:min-h-0 flex flex-col relative overflow-hidden transition-colors duration-300 ${isDragOver ? 'bg-fuchsia-100/50' : 'bg-slate-200'}`}
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
          <div className="h-14 md:h-16 px-3 md:px-6 flex justify-between items-center bg-white/50 backdrop-blur-md border-b border-slate-300 z-30 shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-slate-200 p-1 rounded-xl flex gap-1 shadow-inner">
                <button type="button" onClick={() => switchSide('front')} className={`px-4 md:px-6 py-1.5 rounded-lg text-sm font-black transition-all relative ${activeSide === 'front' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  表面
                  {!submitForm.frontDesignUrl && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm"></span>
                  )}
                </button>
                <button type="button" onClick={() => switchSide('back')} disabled={!isDoubleSided} className={`px-6 py-1.5 rounded-lg text-sm font-black transition-all relative disabled:opacity-30 ${activeSide === 'back' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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

          {/* 中央：プレビューキャンバス（ズーム＆パン対応） */}
          <div
            ref={zoomAreaRef}
            className="flex-1 min-h-0 p-8 flex items-center justify-center relative overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
          >
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            <div
              ref={previewContainerRef}
              className={`relative bg-white shadow-2xl flex items-center justify-center z-10 overflow-hidden ${!currentUrl && 'border-4 border-dashed border-slate-300 bg-slate-100/50'}`}
              style={{
                containerType: 'size',
                aspectRatio: orientation === 'portrait' ? '1 / 1.4142' : '1.4142 / 1',
                maxHeight: '100%', maxWidth: '100%',
                height: orientation === 'portrait' ? '100%' : 'auto',
                width: orientation === 'landscape' ? '100%' : 'auto',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: zoom === 1 && pan.x === 0 && pan.y === 0 ? 'aspect-ratio 0.3s, height 0.3s, width 0.3s' : 'none',
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
                    containerRef={previewContainerRef}
                    hasIframeError={previewErrors[activeSide]}
                    onIframeError={() => setPreviewErrors(prev => ({ ...prev, [activeSide]: true }))}
                  />
                  <div className="absolute top-[2%] bottom-[2%] left-[2%] right-[2%] border-[1.5px] border-rose-500/80 pointer-events-none z-20">
                    <span className="absolute -top-[18px] left-0 text-rose-500 text-[10px] font-black bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">仕上がり位置 (断裁線)</span>
                  </div>
                  <div className="absolute top-[4%] bottom-[4%] left-[4%] right-[4%] border-[1px] border-blue-500/80 border-dashed pointer-events-none z-20">
                    <span className="absolute -top-[18px] left-28 text-blue-500 text-[10px] font-black bg-white/90 px-1.5 py-0.5 rounded-t-sm whitespace-nowrap">文字切れ安全圏</span>
                  </div>
                  {/* ライブテキスト警告バッジ */}
                  {hasLiveTextOnCurrent && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-[11px] font-black pointer-events-none whitespace-nowrap">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      テキストがアウトライン化されていない可能性があります
                    </div>
                  )}
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
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} accept=".pdf,.ai,.psd,.jpg,.jpeg,.png,.zip" onChange={(e) => handleFileUpload(e, activeSide)} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm shadow-sm">
                <i className="bi bi-cloud-arrow-up"></i> ファイルを選択
              </button>
              {/* ズームコントロール */}
              {currentUrl && (
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 ml-1">
                  <button type="button" onClick={() => adjustZoom(1 / 1.25)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg text-slate-600 font-bold text-base transition-colors" title="縮小">
                    <i className="bi bi-dash"></i>
                  </button>
                  <span className="w-12 text-center text-xs font-mono font-bold text-slate-700 select-none">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => adjustZoom(1.25)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg text-slate-600 font-bold text-base transition-colors" title="拡大">
                    <i className="bi bi-plus"></i>
                  </button>
                  <button type="button" onClick={resetZoom} className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors ${zoom !== 1 || pan.x !== 0 || pan.y !== 0 ? 'hover:bg-fuchsia-100 text-fuchsia-600' : 'text-slate-300'}`} title="リセット (ダブルクリックでもリセット)">
                    <i className="bi bi-arrows-angle-contract"></i>
                  </button>
                </div>
              )}
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
        <div className="w-full md:w-[40%] bg-white flex flex-col border-t md:border-t-0 md:border-l border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 space-y-6 md:space-y-8 pb-10">

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

            {/* サンプル送付 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">{printingSpec ? '2' : '1'}</span>
                <h2 className="text-lg font-black text-slate-800">サンプル送付</h2>
              </div>
              <label className="flex items-start gap-3 cursor-pointer group p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-fuchsia-200 transition-colors">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    className="peer w-5 h-5 appearance-none border-2 border-slate-300 rounded focus:ring-2 focus:ring-fuchsia-500 checked:bg-fuchsia-600 checked:border-fuchsia-600 transition-colors"
                    checked={submitForm.sampleRequired}
                    onChange={e => {
                      const checked = e.target.checked;
                      setSubmitForm(prev => ({
                        ...prev,
                        sampleRequired: checked,
                        sampleShippingAddress: checked && !prev.sampleShippingAddress && defaultDeliveryAddress ? defaultDeliveryAddress : prev.sampleShippingAddress,
                      }));
                    }}
                  />
                  <i className="bi bi-check text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 text-lg"></i>
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm group-hover:text-fuchsia-700 transition-colors">印刷見本（サンプル）の送付を希望する</div>
                  <div className="text-xs text-slate-500 mt-0.5">印刷完了後、ご指定の住所へ約50枚を無料でお送りします。</div>
                </div>
              </label>
              {submitForm.sampleRequired && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-slate-600 mb-2">サンプル送付先住所・宛名 <span className="text-rose-500">*</span></label>
                  <textarea
                    required
                    value={submitForm.sampleShippingAddress}
                    onChange={e => setSubmitForm({...submitForm, sampleShippingAddress: e.target.value})}
                    className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-fuchsia-500 outline-none text-sm bg-white shadow-sm"
                    rows={3}
                    placeholder="〒000-0000 東京都...&#10;株式会社〇〇 ご担当者様名"
                  />
                  {defaultDeliveryAddress && submitForm.sampleShippingAddress !== defaultDeliveryAddress && (
                    <button
                      type="button"
                      onClick={() => setSubmitForm(prev => ({ ...prev, sampleShippingAddress: defaultDeliveryAddress }))}
                      className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                    >
                      <i className="bi bi-arrow-repeat"></i> デフォルト住所を入力
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 備考 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs">{printingSpec ? '3' : '2'}</span>
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

      {/* ========== 通常モーダル ========== */}
      {modal && (() => {
        const s = modalVariantStyles[modal.variant];
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* バックドロップ */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={modal.variant !== 'confirm' ? () => { const cb = modal.onConfirm; closeModal(); cb?.(); } : closeModal}
            />
            {/* モーダルカード */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
              {/* 上部カラーバー */}
              <div className={`h-1.5 w-full ${s.bar}`} />

              <div className="p-8">
                {/* アイコン */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 ${s.icon}`}>
                  <i className={`bi ${s.iconClass}`} />
                </div>

                {/* タイトル */}
                <h3 className="text-xl font-black text-slate-800 text-center mb-3">{modal.title}</h3>

                {/* メッセージ */}
                <p className="text-sm text-slate-600 text-center leading-relaxed whitespace-pre-line">{modal.message}</p>

                {/* カスタマーセンター電話番号（エラー・警告で電話番号あり） */}
                {modal.showPhone && supportPhone && (
                  <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                    <p className="text-xs text-slate-500 mb-2">解決しない場合はお気軽にご連絡ください</p>
                    <a
                      href={`tel:${supportPhone.replace(/[-() ]/g, '')}`}
                      className="text-fuchsia-600 font-black text-2xl hover:text-fuchsia-700 flex items-center justify-center gap-2 transition-colors"
                    >
                      <i className="bi bi-telephone-fill text-xl" />
                      {supportPhone}
                    </a>
                    <p className="text-[10px] text-slate-400 mt-1">カスタマーセンター（受付時間内）</p>
                  </div>
                )}

                {/* ボタン */}
                <div className="mt-6 flex gap-3">
                  {modal.variant === 'confirm' && (
                    <button
                      onClick={closeModal}
                      className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-sm"
                    >
                      キャンセル
                    </button>
                  )}
                  <button
                    onClick={() => { const cb = modal.onConfirm; closeModal(); cb?.(); }}
                    className={`flex-1 py-3 font-black text-white rounded-xl transition-colors text-sm ${s.btn}`}
                  >
                    {modal.variant === 'confirm' ? '入稿する' : 'OK'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========== 入稿前チェックリストモーダル ========== */}
      {showChecklist && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowChecklist(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1.5 w-full bg-fuchsia-600" />
            <div className="p-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 bg-fuchsia-100 text-fuchsia-600">
                <i className="bi bi-clipboard2-check" />
              </div>
              <h3 className="text-xl font-black text-slate-800 text-center mb-1">入稿前チェックリスト</h3>
              <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">
                以下の項目を確認してから入稿してください。<br />チェックは任意です。確認なしでも入稿できます。
              </p>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {checklistItems.map((item) => {
                  const checked = checkedItems.has(item.id);
                  const showLiveTextBadge = 'warnIfLiveText' in item && item.warnIfLiveText && (liveTextWarnings.front || liveTextWarnings.back);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${checked ? 'bg-fuchsia-50 border-fuchsia-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                      onClick={() => toggleCheckItem(item.id)}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${checked ? 'bg-fuchsia-600 border-fuchsia-600' : 'border-slate-300 bg-white'}`}>
                        {checked && <i className="bi bi-check text-white text-sm" />}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 leading-relaxed">
                        {showLiveTextBadge && (
                          <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded mr-1.5 leading-tight">⚠ 要確認</span>
                        )}
                        {item.text}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowChecklist(false)}
                  className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-sm"
                >
                  戻る
                </button>
                <button
                  onClick={doSubmitFromChecklist}
                  className="flex-1 py-3 font-black text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <i className="bi bi-send-fill" /> 確認して入稿する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
