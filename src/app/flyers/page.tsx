'use client';

import React, { useState, useEffect } from 'react';

const FOLD_STATUS_MAP: Record<string, { label: string, color: string }> = {
  NEEDS_FOLDING: { label: '要折', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  NO_FOLDING_REQUIRED: { label: '折無し', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  FOLDED: { label: '折済', color: 'bg-blue-100 text-blue-700 border-blue-200' }
};

export default function FlyerPage() {
  const [flyers, setFlyers] = useState<any[]>([]);
  const [masters, setMasters] = useState({ industries: [], sizes: [], customers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
  const [selectedFlyer, setSelectedFlyer] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [deliveryForm, setDeliveryForm] = useState({ expectedAt: '', count: '', status: 'COMPLETED', note: '' });
  const [isDeliverySaving, setIsDeliverySaving] = useState(false);

  // QRコード管理用State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrFlyer, setQrFlyer] = useState<any>(null);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [qrForm, setQrForm] = useState({ alias: '', redirectUrl: '', memo: '', notifyOnScan: false, notificationEmails: '' });
  const [isQrSaving, setIsQrSaving] = useState(false);

  // QRコード編集用State
  const [editingQrId, setEditingQrId] = useState<number | null>(null);
  const [editQrForm, setEditQrForm] = useState({ redirectUrl: '', memo: '', notifyOnScan: false, notificationEmails: '' });
  // ダウンロードオプション用 (QR IDをキーに透過設定を保持)
  const [qrOptions, setQrOptions] = useState<Record<number, { transparent: boolean }>>({});

  const initialForm = {
    name: '', flyerCode: '', bundleCount: '', customerId: '', industryId: '', sizeId: '',
    startDate: '', endDate: '', foldStatus: 'NO_FOLDING_REQUIRED', remarks: ''
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [flyerRes, masterRes] = await Promise.all([
        fetch('/api/flyers'),
        fetch('/api/flyers/masters')
      ]);
      const flyerData = await flyerRes.json();
      const masterData = await masterRes.json();

      setFlyers(Array.isArray(flyerData) ? flyerData : []);
      if (masterData && Array.isArray(masterData.customers)) {
        setMasters(masterData);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openForm = (flyer?: any) => {
    if (flyer) {
      setCurrentId(flyer.id);
      setFormData({
        name: flyer.name,
        flyerCode: flyer.flyerCode || '',
        bundleCount: flyer.bundleCount?.toString() || '',
        customerId: flyer.customerId.toString(),
        industryId: flyer.industryId.toString(),
        sizeId: flyer.sizeId.toString(),
        startDate: flyer.startDate ? flyer.startDate.split('T')[0] : '',
        endDate: flyer.endDate ? flyer.endDate.split('T')[0] : '',
        foldStatus: flyer.foldStatus,
        remarks: flyer.remarks || ''
      });
    } else {
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(currentId ? `/api/flyers/${currentId}` : '/api/flyers', {
        method: currentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || '保存に失敗しました。チラシコードが重複している可能性があります。');
      }
      setIsFormOpen(false);
      fetchData();
    } catch (e: any) { alert(e.message); }
  };

  const del = async (id: number) => {
    if (!confirm('このチラシを削除しますか？\n(※すでにスケジュールに登録されている場合は削除できません)')) return;
    try {
      const res = await fetch(`/api/flyers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchData();
    } catch (e) { alert('削除に失敗しました。関連データが存在する可能性があります。'); }
  };

  const openDeliveryModal = async (flyer: any) => {
    setSelectedFlyer(flyer);
    setDeliveries([]);
    setIsDeliveryOpen(true);

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setDeliveryForm({ expectedAt: now.toISOString().slice(0, 16), count: '', status: 'COMPLETED', note: '' });

    try {
      const res = await fetch(`/api/flyers/${flyer.id}/deliveries`);
      if (res.ok) setDeliveries(await res.json());
    } catch (e) { console.error(e); }
  };

  const saveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlyer) return;
    setIsDeliverySaving(true);
    try {
      const res = await fetch(`/api/flyers/${selectedFlyer.id}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryForm),
      });
      if (!res.ok) throw new Error();
      setIsDeliveryOpen(false);
      fetchData();
    } catch (e) { alert('納品登録に失敗しました'); }
    setIsDeliverySaving(false);
  };

  const openQrModal = async (flyer: any) => {
    setQrFlyer(flyer);
    setQrCodes([]);
    setQrForm({ alias: '', redirectUrl: '', memo: '', notifyOnScan: false, notificationEmails: '' });
    setEditingQrId(null);
    setIsQrModalOpen(true);

    try {
      const res = await fetch(`/api/flyers/${flyer.id}/qrcodes`);
      if (res.ok) setQrCodes(await res.json());
    } catch (e) { console.error(e); }
  };

  const saveQrCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrFlyer) return;
    setIsQrSaving(true);
    try {
      const res = await fetch(`/api/flyers/${qrFlyer.id}/qrcodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qrForm),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'QRコードの発行に失敗しました。');
      }
      
      const listRes = await fetch(`/api/flyers/${qrFlyer.id}/qrcodes`);
      if (listRes.ok) setQrCodes(await listRes.json());
      
      setQrForm({ alias: '', redirectUrl: '', memo: '', notifyOnScan: false, notificationEmails: '' });
    } catch (e: any) {
      alert(e.message);
    }
    setIsQrSaving(false);
  };

  const startEditQr = (qr: any) => {
    setEditingQrId(qr.id);
    setEditQrForm({ redirectUrl: qr.redirectUrl, memo: qr.memo || '', notifyOnScan: qr.notifyOnScan || false, notificationEmails: qr.notificationEmails || '' });
  };

  const saveEditQr = async (qrId: number) => {
    try {
      const res = await fetch(`/api/qrcodes/${qrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editQrForm)
      });
      if (!res.ok) throw new Error();
      setQrCodes(prev => prev.map(q => q.id === qrId ? { ...q, ...editQrForm } : q));
      setEditingQrId(null);
    } catch (e) { alert('更新に失敗しました。'); }
  };

  const toggleQrActive = async (qr: any) => {
    const newStatus = !qr.isActive;
    const confirmMsg = newStatus 
      ? 'このQRコードを「有効」にしますか？' 
      : 'このQRコードを「無効（アーカイブ）」にしますか？\n無効にすると、スキャンしたユーザーはデフォルトページへ転送されます。';
    
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/qrcodes/${qr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus })
      });
      if (!res.ok) throw new Error();
      setQrCodes(prev => prev.map(q => q.id === qr.id ? { ...q, isActive: newStatus } : q));
    } catch (e) { alert('ステータスの更新に失敗しました。'); }
  };

  const deleteQrCode = async (qrId: number) => {
    if (!confirm('【警告】このQRコードを物理削除しますか？\nすでに印刷・配布されている場合、スキャンしても404エラーになってしまいます。\n\n※通常は「無効化」ボタンを使用してアーカイブすることを推奨します。')) return;
    try {
      const res = await fetch(`/api/qrcodes/${qrId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setQrCodes(prev => prev.filter(q => q.id !== qrId));
    } catch (e) { alert('削除に失敗しました。'); }
  };

  const filteredFlyers = flyers.filter(f => 
    f.name.includes(searchTerm) || 
    (f.customer?.name || '').includes(searchTerm) || 
    (f.flyerCode || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-file-earmark-richtext text-fuchsia-600"></i> チラシ案件・在庫管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">配布するチラシ情報の登録と、納品履歴・現在庫の管理を行います。</p>
        </div>
        <button onClick={() => openForm()} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">
          <i className="bi bi-plus-lg"></i> 新規チラシ登録
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder="チラシ名、コード、顧客名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-fuchsia-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">チラシ名 / コード</th>
              <th className="px-6 py-4">顧客 / 業種</th>
              <th className="px-6 py-4">サイズ / 折ステータス</th>
              <th className="px-6 py-4">1束の枚数</th>
              <th className="px-6 py-4">有効期間</th>
              <th className="px-6 py-4 text-right bg-slate-100">現在庫</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center">読み込み中...</td></tr> : 
             filteredFlyers.map(f => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800 text-base">{f.name}</div>
                  <div className="font-mono text-xs text-slate-400 mt-1"><i className="bi bi-upc-scan text-slate-300"></i> {f.flyerCode || 'コードなし'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700">{f.customer?.name}</div>
                  <div className="text-xs text-slate-500 mt-1"><i className="bi bi-tag-fill text-slate-300"></i> {f.industry?.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700 mb-1">{f.size?.name}</div>
                  <span className={`px-2 py-1 text-[10px] font-bold border rounded-md ${FOLD_STATUS_MAP[f.foldStatus].color}`}>
                    {FOLD_STATUS_MAP[f.foldStatus].label}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {f.bundleCount ? (
                    <span className="font-bold text-slate-700">{f.bundleCount.toLocaleString()} <span className="text-xs font-normal">枚</span></span>
                  ) : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                  {f.startDate ? new Date(f.startDate).toLocaleDateString() : '未定'} <br/>
                  〜 {f.endDate ? new Date(f.endDate).toLocaleDateString() : '未定'}
                </td>
                <td className="px-6 py-4 text-right bg-slate-50">
                  <div className="font-bold text-lg text-fuchsia-600">{f.stockCount.toLocaleString()} <span className="text-xs text-slate-500 font-normal">枚</span></div>
                  <button onClick={() => openDeliveryModal(f)} className="text-[10px] font-bold text-blue-600 hover:underline mt-1">納品履歴・追加 &gt;</button>
                </td>
                <td className="px-6 py-4 text-center space-x-1">
                  <button onClick={() => openQrModal(f)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="QRコード発行・管理"><i className="bi bi-qr-code text-lg"></i></button>
                  <button onClick={() => openForm(f)} className="p-2 text-slate-400 hover:text-fuchsia-600 transition-colors"><i className="bi bi-pencil-square text-lg"></i></button>
                  <button onClick={() => del(f.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><i className="bi bi-trash text-lg"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- QRコード管理モーダル --- */}
      {isQrModalOpen && qrFlyer && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col md:flex-row max-h-[95vh] overflow-hidden">
            
            {/* 左側：新規発行フォーム */}
            <div className="w-full md:w-[360px] bg-slate-50 p-6 border-r border-slate-200 flex flex-col shrink-0">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800"><i className="bi bi-qr-code text-indigo-600 mr-2"></i>QRコード発行</h3>
                <button onClick={() => setIsQrModalOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
              </div>

              <form onSubmit={saveQrCode} className="space-y-5 flex-1">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">転送先URL (LPなど) <span className="text-rose-500">*</span></label>
                  <input type="url" required value={qrForm.redirectUrl} onChange={e => setQrForm({...qrForm, redirectUrl: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://example.com/campaign" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">エイリアス (URLの一部) <span className="text-rose-500">*</span></label>
                  <div className="flex items-center text-sm border border-slate-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                    <span className="bg-slate-100 text-slate-500 px-3 py-2.5 text-xs font-mono border-r border-slate-300 shrink-0">/q/</span>
                    <input type="text" required value={qrForm.alias} onChange={e => setQrForm({...qrForm, alias: e.target.value})} className="w-full p-2.5 outline-none font-mono text-sm" placeholder="azabu-sp" pattern="[a-zA-Z0-9-_]+" title="半角英数字、ハイフン、アンダースコアのみ" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">※チラシに印字されるURLです。<br/>例: pms.tiramis.co.jp/q/azabu-sp</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">識別用メモ</label>
                  <input type="text" value={qrForm.memo} onChange={e => setQrForm({...qrForm, memo: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="表面 右下用 など" />
                </div>

                {/* メール通知設定 (新規) */}
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg mt-3">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" checked={qrForm.notifyOnScan} onChange={e => setQrForm({...qrForm, notifyOnScan: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <span className="text-xs font-bold text-indigo-900">スキャン時にメール通知する</span>
                  </label>
                  {qrForm.notifyOnScan && (
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">送信先メールアドレス (カンマ区切りで複数可)</label>
                      <textarea value={qrForm.notificationEmails} onChange={e => setQrForm({...qrForm, notificationEmails: e.target.value})} rows={2} className="w-full text-xs border border-indigo-200 rounded p-2 outline-none focus:ring-1 focus:ring-indigo-500" placeholder="client@example.com, boss@example.com" />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={isQrSaving} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all mt-4 disabled:opacity-50">
                  {isQrSaving ? '発行中...' : 'QRコードを発行する'}
                </button>
              </form>
            </div>

            {/* 右側：発行済みQRコード一覧 */}
            <div className="flex-1 bg-white p-6 overflow-y-auto custom-scrollbar relative">
              <div className="flex justify-between items-center mb-6 hidden md:flex pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">{qrFlyer.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">発行済みQRコード一覧とダウンロード</p>
                </div>
                <button onClick={() => setIsQrModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors p-2"><i className="bi bi-x-lg text-xl"></i></button>
              </div>

              {qrCodes.length === 0 ? (
                <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                  <i className="bi bi-qr-code text-6xl mb-4 text-slate-200"></i>
                  <p>QRコードはまだ発行されていません。<br/>左のフォームから作成してください。</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
                  {qrCodes.map(qr => {
                    const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/q/${qr.alias}` : `/q/${qr.alias}`;
                    const qrImageSrc = `https://quickchart.io/qr?text=${encodeURIComponent(qrUrl)}&size=300&margin=0`;
                    
                    const isTransparent = qrOptions[qr.id]?.transparent || false;
                    const dlUrlPng = `/api/qrcodes/download?data=${encodeURIComponent(qrUrl)}&format=png&transparent=${isTransparent}`;
                    const dlUrlSvg = `/api/qrcodes/download?data=${encodeURIComponent(qrUrl)}&format=svg&transparent=${isTransparent}`;

                    return (
                      <div key={qr.id} className={`flex gap-5 p-5 border rounded-2xl transition-all shadow-sm relative ${qr.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-75 grayscale-[50%]'}`}>
                        
                        {/* 編集・削除アクション */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditQr(qr)} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-white rounded shadow-sm border border-slate-100" title="編集">
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button onClick={() => deleteQrCode(qr.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-white rounded shadow-sm border border-slate-100" title="削除">
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                        
                        {/* 左側: QR画像とダウンロードアクション */}
                        <div className="shrink-0 flex flex-col items-center w-[120px]">
                          <div className={`p-2 rounded-xl mb-3 ${isTransparent ? 'bg-transparent border border-slate-200' : 'bg-white border border-slate-200 shadow-sm'}`}>
                            <img src={qrImageSrc} alt="QR Code" className="w-[100px] h-[100px]" style={{ mixBlendMode: isTransparent ? 'multiply' : 'normal' }} />
                          </div>
                          
                          <div className="w-full space-y-2">
                            <label className="flex items-center justify-center gap-1.5 cursor-pointer text-[10px] text-slate-600 hover:text-indigo-600 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={isTransparent} 
                                onChange={e => setQrOptions({...qrOptions, [qr.id]: { transparent: e.target.checked }})} 
                                className="accent-indigo-600"
                              />
                              背景を透過する
                            </label>
                            
                            <div className="flex gap-1.5 w-full">
                              <a href={dlUrlPng} className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 text-[10px] font-bold py-1.5 rounded text-center transition-colors">
                                PNG
                              </a>
                              <a href={dlUrlSvg} className="flex-1 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-600 hover:text-white border border-fuchsia-200 text-[10px] font-bold py-1.5 rounded text-center transition-colors">
                                SVG
                              </a>
                            </div>
                          </div>
                        </div>
                        
                        {/* 右側: 情報と編集フォーム */}
                        {editingQrId === qr.id ? (
                          <div className="flex-1 min-w-0 flex flex-col gap-2 z-10 bg-white p-2 rounded border border-indigo-200 shadow-lg absolute inset-0 m-1 overflow-y-auto custom-scrollbar">
                            <div className="font-bold text-xs text-indigo-700 mb-1 border-b pb-1">QRコード情報の編集</div>
                            <div>
                              <label className="text-[9px] text-slate-500 font-bold block mb-0.5">エイリアス (※変更不可)</label>
                              <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-500 cursor-not-allowed truncate">{qr.alias}</div>
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-500 font-bold block mb-0.5">転送先URL</label>
                              <input type="url" value={editQrForm.redirectUrl} onChange={e => setEditQrForm({...editQrForm, redirectUrl: e.target.value})} className="w-full text-xs border border-indigo-300 rounded p-1.5 outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                              <label className="text-[9px] text-slate-500 font-bold block mb-0.5">メモ</label>
                              <input type="text" value={editQrForm.memo} onChange={e => setEditQrForm({...editQrForm, memo: e.target.value})} className="w-full text-xs border border-indigo-300 rounded p-1.5 outline-none focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            
                            {/* メール通知設定 (編集) */}
                            <div className="p-2 bg-indigo-50/50 border border-indigo-100 rounded">
                              <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                                <input type="checkbox" checked={editQrForm.notifyOnScan} onChange={e => setEditQrForm({...editQrForm, notifyOnScan: e.target.checked})} className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                <span className="text-[10px] font-bold text-indigo-900">スキャン時にメール通知する</span>
                              </label>
                              {editQrForm.notifyOnScan && (
                                <div>
                                  <label className="text-[9px] text-slate-500 block mb-0.5">送信先メールアドレス</label>
                                  <textarea value={editQrForm.notificationEmails} onChange={e => setEditQrForm({...editQrForm, notificationEmails: e.target.value})} rows={2} className="w-full text-[10px] border border-indigo-200 rounded p-1.5 outline-none focus:ring-1 focus:ring-indigo-500" placeholder="client@example.com" />
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 mt-auto pt-1">
                              <button onClick={() => saveEditQr(qr.id)} className="flex-1 bg-indigo-600 text-white text-[10px] px-2 py-1.5 rounded font-bold shadow hover:bg-indigo-700 transition-colors">保存</button>
                              <button onClick={() => setEditingQrId(null)} className="flex-1 bg-slate-200 text-slate-600 text-[10px] px-2 py-1.5 rounded font-bold hover:bg-slate-300 transition-colors">キャンセル</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0 flex flex-col">
                            {/* 有効・無効トグル */}
                            <div className="flex justify-between items-start mb-2">
                              <button 
                                onClick={() => toggleQrActive(qr)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-colors ${qr.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${qr.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                {qr.isActive ? '有効 (Active)' : '無効 (Archived)'}
                              </button>
                            </div>

                            {qr.memo && <div className="text-xs font-bold text-slate-700 mb-2 truncate" title={qr.memo}>{qr.memo}</div>}
                            
                            <div className="mb-2">
                              <div className="text-[9px] text-slate-400 font-bold mb-0.5">印刷用URL (エイリアス):</div>
                              <div className="font-mono text-xs text-indigo-700 font-bold bg-indigo-50/50 border border-indigo-100 px-2 py-1.5 rounded truncate" title={qrUrl}>
                                {qrUrl}
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <div className="text-[9px] text-slate-400 font-bold mb-0.5">転送先URL:</div>
                              <a href={qr.redirectUrl} target="_blank" className="text-[10px] text-blue-500 hover:underline truncate block" title={qr.redirectUrl}>
                                {qr.redirectUrl}
                              </a>
                            </div>

                            {qr.notifyOnScan && (
                              <div className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-1 mb-2 self-start truncate max-w-full">
                                <i className="bi bi-envelope-check-fill"></i> 通知ON ({qr.notificationEmails?.split(',').length || 0}件)
                              </div>
                            )}
                            
                            <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                              <div className="text-[10px] text-slate-400">作成: {new Date(qr.createdAt).toLocaleDateString()}</div>
                              
                              <div className="flex gap-4">
                                <div className="text-slate-600 font-black flex items-center gap-1.5" title="総スキャン回数 (延べアクセス数)">
                                  <i className="bi bi-qr-code-scan"></i>
                                  <span className="text-xl leading-none">{qr._count?.scanLogs || 0}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Total</span>
                                </div>
                                
                                <div className="text-emerald-600 font-black flex items-center gap-1.5" title="ユニークアクセス数 (読み取った人数)">
                                  <i className="bi bi-person-check-fill"></i>
                                  <span className="text-xl leading-none">{qr.uniqueScans || 0}</span>
                                  <span className="text-[9px] font-bold text-emerald-400 uppercase">Unique</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 納品履歴モーダルはそのまま... */}
      {isDeliveryOpen && selectedFlyer && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row max-h-[90vh] overflow-hidden">
            <div className="w-full md:w-1/3 bg-slate-50 p-6 border-r border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800"><i className="bi bi-box-seam-fill text-blue-600 mr-2"></i>納品の追加</h3>
                <button onClick={() => setIsDeliveryOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
              </div>

              <form onSubmit={saveDelivery} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">納品日時 (予定/実績) *</label>
                  <input type="datetime-local" required value={deliveryForm.expectedAt} onChange={e => setDeliveryForm({...deliveryForm, expectedAt: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">納品枚数 *</label>
                  <div className="relative">
                    <input type="number" required min="1" value={deliveryForm.count} onChange={e => setDeliveryForm({...deliveryForm, count: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-white pr-8 text-right font-bold text-lg text-fuchsia-600" placeholder="10000" />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">枚</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">ステータス *</label>
                  <select required value={deliveryForm.status} onChange={e => setDeliveryForm({...deliveryForm, status: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="COMPLETED">納品完了 (すぐ在庫に追加)</option>
                    <option value="PENDING">納品予定 (まだ在庫にしない)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">備考メモ</label>
                  <input type="text" value={deliveryForm.note} onChange={e => setDeliveryForm({...deliveryForm, note: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-white" placeholder="例: 段ボール10箱" />
                </div>
                <button type="submit" disabled={isDeliverySaving} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all mt-4 disabled:opacity-50">
                  {isDeliverySaving ? '処理中...' : '在庫に追加する'}
                </button>
              </form>
            </div>

            <div className="flex-1 bg-white p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6 hidden md:flex">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{selectedFlyer.name}</h3>
                  <p className="text-sm text-slate-500">現在の有効在庫: <span className="font-bold text-fuchsia-600">{selectedFlyer.stockCount.toLocaleString()} 枚</span></p>
                </div>
                <button onClick={() => setIsDeliveryOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg text-xl"></i></button>
              </div>

              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">納品履歴</h4>
              {deliveries.length === 0 ? (
                <div className="text-center py-10 text-slate-400">納品履歴がありません。左のフォームから追加してください。</div>
              ) : (
                <div className="space-y-3">
                  {deliveries.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${d.status === 'COMPLETED' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                          <i className={`bi ${d.status === 'COMPLETED' ? 'bi-check-lg' : 'bi-clock-history'}`}></i>
                        </div>
                        <div>
                          <div className="font-bold text-slate-700">{new Date(d.expectedAt).toLocaleString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
                          <div className="text-xs text-slate-500">{d.note || '備考なし'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-slate-800">+{d.count.toLocaleString()} <span className="text-xs font-normal text-slate-500">枚</span></div>
                        <div className={`text-[10px] font-bold ${d.status === 'COMPLETED' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {d.status === 'COMPLETED' ? '在庫反映済' : '入荷待ち'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* チラシ登録・編集モーダルはそのまま... */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? 'チラシ情報の編集' : '新規チラシ登録'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-slate-600">チラシ名 *</label>
                  <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder="例: 春の入会キャンペーン" />
                </div>
                
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-slate-600">チラシコード (UNIQUE)</label>
                  <input name="flyerCode" value={formData.flyerCode} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-blue-50 focus:bg-white" placeholder="クライアント独自のIDなど" />
                </div>
                
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">顧客 (クライアント) *</label>
                  <select required name="customerId" value={formData.customerId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">選択してください</option>
                    {(masters.customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">業種 (併配NGチェック用) *</label>
                  <select required name="industryId" value={formData.industryId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">選択してください</option>
                    {(masters.industries || []).map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">サイズ *</label>
                  <select required name="sizeId" value={formData.sizeId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">選択してください</option>
                    {(masters.sizes || []).map((s: any) => <option key={s.id} value={s.id}>{s.name} {s.isFoldRequired ? '(折必須)' : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">配布開始可能日</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">配布完了期限</label>
                  <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" />
                </div>

                <div className="col-span-2 p-4 bg-fuchsia-50/50 border border-fuchsia-100 rounded-lg">
                  <label className="text-xs font-bold text-slate-600">1束の枚数 (結束用)</label>
                  <div className="relative mt-1 max-w-xs">
                    <input type="number" min="1" name="bundleCount" value={formData.bundleCount} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white pr-8 text-right font-bold text-slate-700" placeholder="例: 500" />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">枚</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">※この枚数単位で在庫の持ち出し計算が行われます</p>
                </div>

                <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="text-xs font-bold text-slate-600 block mb-2">折りステータス (現在の状態)</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="NO_FOLDING_REQUIRED" checked={formData.foldStatus === 'NO_FOLDING_REQUIRED'} onChange={handleInputChange} />
                      <span className="text-sm">折無し (そのまま配布可)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="NEEDS_FOLDING" checked={formData.foldStatus === 'NEEDS_FOLDING'} onChange={handleInputChange} />
                      <span className="text-sm font-bold text-rose-600">要折 (自社作業が必要/配布不可)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="FOLDED" checked={formData.foldStatus === 'FOLDED'} onChange={handleInputChange} />
                      <span className="text-sm font-bold text-blue-600">折済 (作業完了/配布可)</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">備考</label>
                  <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={2} className="w-full border p-2 rounded-lg text-sm" placeholder="注意事項など" />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-bold shadow-md">
                  {currentId ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}