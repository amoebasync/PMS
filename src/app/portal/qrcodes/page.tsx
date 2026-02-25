'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useNotification } from '@/components/ui/NotificationProvider';

export default function QrCodesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();

  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState({ redirectUrl: '', memo: '' });
  const [editForm, setEditForm] = useState({ redirectUrl: '', memo: '', isActive: true });
  const [qrTransparent, setQrTransparent] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/portal/login');
  }, [status, router]);

  const fetchQrCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/qrcodes');
      if (res.ok) {
        const data = await res.json();
        setQrCodes(data.qrCodes || []);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchQrCodes();
  }, [status, fetchQrCodes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.redirectUrl) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/portal/qrcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({ redirectUrl: '', memo: '' });
        await fetchQrCodes();
      } else { showToast('作成に失敗しました', 'error'); }
    } catch (e) { showToast('通信エラーが発生しました', 'error'); }
    setIsSubmitting(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/portal/qrcodes/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setShowEditModal(false);
        setEditTarget(null);
        await fetchQrCodes();
      } else { showToast('更新に失敗しました', 'error'); }
    } catch (e) { showToast('通信エラーが発生しました', 'error'); }
    setIsSubmitting(false);
  };

  const handleDelete = async (qr: any) => {
    if (!await showConfirm(`「${qr.memo || qr.alias}」を削除しますか？`, { variant: 'danger', detail: 'スキャンログも削除されます。', confirmLabel: '削除する' })) return;
    try {
      const res = await fetch(`/api/portal/qrcodes/${qr.id}`, { method: 'DELETE' });
      if (res.ok) { await fetchQrCodes(); }
      else { showToast('削除に失敗しました', 'error'); }
    } catch (e) { showToast('通信エラーが発生しました', 'error'); }
  };

  const handleDownloadQr = async (qr: any, format: 'png' | 'svg') => {
    const qrUrl = `${window.location.origin}/q/${qr.alias}`;
    const transparent = qrTransparent[qr.id] || false;
    try {
      if (format === 'png') {
        const dataUrl = await QRCode.toDataURL(qrUrl, {
          width: 512,
          margin: 2,
          color: { light: transparent ? '#00000000' : '#ffffff' },
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `qr-${qr.alias}.png`;
        link.click();
      } else {
        const svgString = await QRCode.toString(qrUrl, {
          type: 'svg',
          margin: 2,
          color: { light: transparent ? '#00000000' : '#ffffff' },
        });
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-${qr.alias}.svg`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { showToast('ダウンロードに失敗しました', 'error'); }
  };

  const openEditModal = (qr: any) => {
    setEditTarget(qr);
    setEditForm({ redirectUrl: qr.redirectUrl, memo: qr.memo || '', isActive: qr.isActive });
    setShowEditModal(true);
  };

  const getQrImageUrl = (alias: string) => {
    const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${alias}`;
    return qrUrl;
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-800">QRコード管理</h1>
            <p className="text-sm text-slate-500 mt-1">チラシに埋め込むQRコードを作成・管理できます。発注前でも作成可能です。</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md shadow-indigo-200 transition-all"
          >
            <i className="bi bi-qr-code-scan text-lg"></i> 新規QR作成
          </button>
        </div>

        {/* QRコード一覧 */}
        {qrCodes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-qr-code text-4xl text-indigo-300"></i>
            </div>
            <h3 className="font-black text-slate-700 text-lg mb-2">QRコードがありません</h3>
            <p className="text-sm text-slate-500 mb-6">チラシに使うQRコードを今すぐ作成しましょう。</p>
            <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">
              最初のQRを作成
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {qrCodes.map(qr => (
              <div key={qr.id} className={`bg-white rounded-2xl border ${qr.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'} shadow-sm p-5`}>
                <div className="flex items-start gap-5">

                  {/* QRプレビュー */}
                  <div className="shrink-0">
                    <QrPreview url={`${typeof window !== 'undefined' ? window.location.origin : ''}/q/${qr.alias}`} />
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {qr.flyerId ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                          <i className="bi bi-link-45deg mr-1"></i>{qr.flyer?.name || 'チラシ紐付き'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                          <i className="bi bi-qr-code mr-1"></i>スタンドアロン
                        </span>
                      )}
                      {!qr.isActive && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">無効</span>}
                    </div>

                    <h3 className="font-bold text-slate-800 text-base mb-1 truncate">
                      {qr.memo || '(メモなし)'}
                    </h3>

                    <div className="text-xs text-slate-500 font-mono mb-2 truncate">
                      <i className="bi bi-arrow-right-circle mr-1"></i>
                      {qr.redirectUrl}
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500">
                      <span className="font-bold"><i className="bi bi-qr-code mr-1 text-indigo-400"></i>{window.location.origin}/q/{qr.alias}</span>
                      <span><i className="bi bi-cursor mr-1"></i>合計 <strong className="text-slate-700">{qr.totalScans}</strong> スキャン</span>
                      <span><i className="bi bi-person mr-1"></i>ユニーク <strong className="text-slate-700">{qr.uniqueScans}</strong></span>
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-500 hover:text-indigo-600 transition-colors justify-end">
                      <input
                        type="checkbox"
                        checked={qrTransparent[qr.id] || false}
                        onChange={e => setQrTransparent(prev => ({ ...prev, [qr.id]: e.target.checked }))}
                        className="accent-indigo-600 w-3.5 h-3.5"
                      />
                      背景透過
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownloadQr(qr, 'png')} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                        <i className="bi bi-download"></i> PNG
                      </button>
                      <button onClick={() => handleDownloadQr(qr, 'svg')} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                        <i className="bi bi-download"></i> SVG
                      </button>
                    </div>
                    <button onClick={() => openEditModal(qr)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors justify-center">
                      <i className="bi bi-pencil-fill"></i> 編集
                    </button>
                    <button onClick={() => handleDelete(qr)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors justify-center">
                      <i className="bi bi-trash-fill"></i> 削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-slate-800 text-lg">新規QRコード作成</h2>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                <i className="bi bi-x text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">転送先URL <span className="text-rose-500">*</span></label>
                <input
                  type="url"
                  required
                  value={createForm.redirectUrl}
                  onChange={e => setCreateForm(p => ({ ...p, redirectUrl: e.target.value }))}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="https://example.com/campaign"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">メモ (管理用)</label>
                <input
                  type="text"
                  value={createForm.memo}
                  onChange={e => setCreateForm(p => ({ ...p, memo: e.target.value }))}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="例: 春のキャンペーン用"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-bold">
                <i className="bi bi-info-circle mr-1"></i>
                スタンドアロンQRとして作成されます。後から発注のチラシに紐付けることができます。
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm disabled:opacity-50">
                  {isSubmitting ? '作成中...' : 'QRを作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {showEditModal && editTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-slate-800 text-lg">QRコード編集</h2>
              <button onClick={() => setShowEditModal(false)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                <i className="bi bi-x text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">転送先URL <span className="text-rose-500">*</span></label>
                <input
                  type="url"
                  required
                  value={editForm.redirectUrl}
                  onChange={e => setEditForm(p => ({ ...p, redirectUrl: e.target.value }))}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">メモ</label>
                <input
                  type="text"
                  value={editForm.memo}
                  onChange={e => setEditForm(p => ({ ...p, memo: e.target.value }))}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="relative flex items-center justify-center shrink-0">
                  <input type="checkbox" className="peer w-5 h-5 appearance-none border-2 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 checked:bg-indigo-600 checked:border-indigo-600 transition-colors bg-white cursor-pointer"
                    checked={editForm.isActive}
                    onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))}
                  />
                  <i className="bi bi-check text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 text-lg"></i>
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">QRコードを有効にする</div>
                  <div className="text-[10px] text-slate-500">無効にするとスキャン時にエラーページが表示されます</div>
                </div>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm disabled:opacity-50">
                  {isSubmitting ? '保存中...' : '変更を保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// QRコードのプレビューコンポーネント
function QrPreview({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 80, margin: 1 })
      .then(setDataUrl)
      .catch(console.error);
  }, [url]);

  if (!dataUrl) {
    return <div className="w-20 h-20 bg-slate-100 rounded-xl animate-pulse"></div>;
  }
  return <img src={dataUrl} alt="QR" className="w-20 h-20 rounded-xl border border-slate-200" />;
}
