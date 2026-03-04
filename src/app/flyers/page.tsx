'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link'; // ★ 追加: これがないとエラーになります
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

const FOLD_STATUS_MAP: Record<string, { label: string, color: string }> = {
  NEEDS_FOLDING: { label: '要折', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  NO_FOLDING_REQUIRED: { label: '折無し', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  FOLDED: { label: '折済', color: 'bg-blue-100 text-blue-700 border-blue-200' }
};

export default function FlyerPage() {
  const { t } = useTranslation('flyers');
  const { showToast, showConfirm } = useNotification();
  const [flyers, setFlyers] = useState<any[]>([]);
  const [masters, setMasters] = useState({ industries: [], sizes: [], customers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // QRコード管理用State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrFlyer, setQrFlyer] = useState<any>(null);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [qrForm, setQrForm] = useState({ alias: '', redirectUrl: '', memo: '', notifyOnScan: false, notificationEmails: '' });
  const [isQrSaving, setIsQrSaving] = useState(false);

  // QRコード編集用State
  const [editingQrId, setEditingQrId] = useState<number | null>(null);
  const [editQrForm, setEditQrForm] = useState({ redirectUrl: '', memo: '', notifyOnScan: false, notificationEmails: '' });
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
        throw new Error(errData?.error || t('error_save'));
      }
      setIsFormOpen(false);
      fetchData();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const del = async (id: number) => {
    if (!await showConfirm(t('confirm_delete'), { variant: 'danger', title: t('confirm_delete_title'), detail: t('confirm_delete_detail'), confirmLabel: t('confirm_delete_btn') })) return;
    try {
      const res = await fetch(`/api/flyers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchData();
    } catch (e) { showToast(t('error_delete'), 'error'); }
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
        throw new Error(errData?.error || t('qr_error_issue'));
      }
      
      const listRes = await fetch(`/api/flyers/${qrFlyer.id}/qrcodes`);
      if (listRes.ok) setQrCodes(await listRes.json());
      
      setQrForm({ alias: '', redirectUrl: '', memo: '', notifyOnScan: false, notificationEmails: '' });
    } catch (e: any) {
      showToast(e.message, 'error');
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
    } catch (e) { showToast(t('qr_error_update'), 'error'); }
  };

  const toggleQrActive = async (qr: any) => {
    const newStatus = !qr.isActive;
    const confirmMsg = newStatus
      ? t('qr_confirm_activate')
      : t('qr_confirm_deactivate');

    if (!await showConfirm(confirmMsg, { variant: 'warning', confirmLabel: t('qr_confirm_change') })) return;

    try {
      const res = await fetch(`/api/qrcodes/${qr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus })
      });
      if (!res.ok) throw new Error();
      setQrCodes(prev => prev.map(q => q.id === qr.id ? { ...q, isActive: newStatus } : q));
    } catch (e) { showToast(t('qr_error_status'), 'error'); }
  };

  const deleteQrCode = async (qrId: number) => {
    if (!await showConfirm(t('qr_confirm_physical_delete'), { variant: 'danger', title: t('qr_physical_delete_title'), detail: t('qr_physical_delete_detail'), confirmLabel: t('qr_physical_delete_btn') })) return;
    try {
      const res = await fetch(`/api/qrcodes/${qrId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setQrCodes(prev => prev.filter(q => q.id !== qrId));
    } catch (e) { showToast(t('qr_error_delete'), 'error'); }
  };

  const filteredFlyers = flyers.filter(f => 
    f.name.includes(searchTerm) || 
    (f.customer?.name || '').includes(searchTerm) || 
    (f.flyerCode || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        <button onClick={() => openForm()} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">
          <i className="bi bi-plus-lg"></i> {t('btn_new')}
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder={t('search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-fuchsia-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">{t('table_name_code')}</th>
              <th className="px-6 py-4">{t('table_customer_industry')}</th>
              <th className="px-6 py-4">{t('table_size_fold')}</th>
              <th className="px-6 py-4">{t('table_bundle_count')}</th>
              <th className="px-6 py-4">{t('table_valid_period')}</th>
              <th className="px-6 py-4 text-right bg-slate-100">{t('table_current_stock')}</th>
              <th className="px-6 py-4 text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center">{t('loading')}</td></tr> :
             filteredFlyers.map(f => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800 text-base">{f.name}</div>
                  <div className="font-mono text-xs text-slate-400 mt-1"><i className="bi bi-upc-scan text-slate-300"></i> {f.flyerCode || t('no_code')}</div>
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
                    <span className="font-bold text-slate-700">{f.bundleCount.toLocaleString()} <span className="text-xs font-normal">{t('sheets')}</span></span>
                  ) : <span className="text-slate-400">-</span>}
                </td>
                <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                  {f.startDate ? new Date(f.startDate).toLocaleDateString() : t('undecided')} <br/>
                  〜 {f.endDate ? new Date(f.endDate).toLocaleDateString() : t('undecided')}
                </td>
                <td className="px-6 py-4 text-right bg-slate-50">
                  <div className="font-bold text-lg text-fuchsia-600">{f.stockCount.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{t('sheets')}</span></div>
                  <Link href="/transactions" className="text-[10px] font-bold text-blue-600 hover:underline mt-1 block">{t('stock_management_link')}</Link>
                </td>
                <td className="px-6 py-4 text-center space-x-1">
                  <button onClick={() => openQrModal(f)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title={t('qr_title')}><i className="bi bi-qr-code text-lg"></i></button>
                  <button onClick={() => openForm(f)} className="p-2 text-slate-400 hover:text-fuchsia-600 transition-colors"><i className="bi bi-pencil-square text-lg"></i></button>
                  <button onClick={() => del(f.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><i className="bi bi-trash text-lg"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* --- QRコード管理モーダル --- */}
      {isQrModalOpen && qrFlyer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col md:flex-row max-h-[95vh] overflow-hidden">
            
            {/* 左側：新規発行フォーム */}
            <div className="w-full md:w-[360px] bg-slate-50 p-6 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800"><i className="bi bi-qr-code text-indigo-600 mr-2"></i>{t('qr_issue_title')}</h3>
                <button onClick={() => setIsQrModalOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
              </div>

              <form onSubmit={saveQrCode} className="space-y-5 flex-1">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('qr_redirect_url')} <span className="text-rose-500">*</span></label>
                  <input type="url" required value={qrForm.redirectUrl} onChange={e => setQrForm({...qrForm, redirectUrl: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={t('qr_redirect_placeholder')} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('qr_alias')} <span className="text-rose-500">*</span></label>
                  <div className="flex items-center text-sm border border-slate-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                    <span className="bg-slate-100 text-slate-500 px-3 py-2.5 text-xs font-mono border-r border-slate-300 shrink-0">/q/</span>
                    <input type="text" required value={qrForm.alias} onChange={e => setQrForm({...qrForm, alias: e.target.value})} className="w-full p-2.5 outline-none font-mono text-sm" placeholder={t('qr_alias_placeholder')} pattern="[a-zA-Z0-9-_]+" title={t('qr_alias_pattern_title')} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{t('qr_alias_note')}<br/>{t('qr_alias_example')}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('qr_memo')}</label>
                  <input type="text" value={qrForm.memo} onChange={e => setQrForm({...qrForm, memo: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={t('qr_memo_placeholder')} />
                </div>

                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg mt-3">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" checked={qrForm.notifyOnScan} onChange={e => setQrForm({...qrForm, notifyOnScan: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <span className="text-xs font-bold text-indigo-900">{t('qr_notify_on_scan')}</span>
                  </label>
                  {qrForm.notifyOnScan && (
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">{t('qr_notify_emails_label')}</label>
                      <textarea value={qrForm.notificationEmails} onChange={e => setQrForm({...qrForm, notificationEmails: e.target.value})} rows={2} className="w-full text-xs border border-indigo-200 rounded p-2 outline-none focus:ring-1 focus:ring-indigo-500" placeholder={t('qr_notify_emails_placeholder')} />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={isQrSaving} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all mt-4 disabled:opacity-50">
                  {isQrSaving ? t('qr_issuing') : t('qr_issue_btn')}
                </button>
              </form>
            </div>

            {/* 右側：発行済みQRコード一覧 */}
            <div className="flex-1 bg-white p-6 overflow-y-auto custom-scrollbar relative">
              <div className="flex justify-between items-center mb-6 hidden md:flex pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">{qrFlyer.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{t('qr_list_title')}</p>
                </div>
                <button onClick={() => setIsQrModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors p-2"><i className="bi bi-x-lg text-xl"></i></button>
              </div>

              {qrCodes.length === 0 ? (
                <div className="text-center py-20 text-slate-400 flex flex-col items-center">
                  <i className="bi bi-qr-code text-6xl mb-4 text-slate-200"></i>
                  <p>{t('qr_empty')}<br/>{t('qr_empty_hint')}</p>
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
                      <div key={qr.id} className={`flex flex-col sm:flex-row gap-5 p-5 border rounded-2xl transition-all shadow-sm ${qr.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-80 grayscale-[30%]'}`}>
                        
                        {/* 左側: QR画像とダウンロードアクション */}
                        <div className="shrink-0 flex flex-col items-center w-full sm:w-[130px]">
                          <div className={`p-2 rounded-xl mb-3 ${isTransparent ? 'bg-transparent border border-slate-200' : 'bg-white border border-slate-200 shadow-sm'}`}>
                            <img src={qrImageSrc} alt="QR Code" className="w-[100px] h-[100px] object-contain" style={{ mixBlendMode: isTransparent ? 'multiply' : 'normal' }} />
                          </div>
                          
                          <div className="w-full space-y-2">
                            <label className="flex items-center justify-center gap-1.5 cursor-pointer text-[10px] text-slate-600 hover:text-indigo-600 transition-colors bg-white border border-slate-200 rounded py-1">
                              <input 
                                type="checkbox" 
                                checked={isTransparent} 
                                onChange={e => setQrOptions({...qrOptions, [qr.id]: { transparent: e.target.checked }})} 
                                className="accent-indigo-600"
                              />
                              {t('qr_transparent_bg')}
                            </label>
                            
                            <div className="flex gap-1.5 w-full">
                              <a href={dlUrlPng} className="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white text-[10px] font-bold py-1.5 rounded text-center transition-colors shadow-sm" download={`QR_${qr.alias}.png`}>
                                <i className="bi bi-download"></i> PNG
                              </a>
                              <a href={dlUrlSvg} className="flex-1 bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 hover:bg-fuchsia-600 hover:text-white text-[10px] font-bold py-1.5 rounded text-center transition-colors shadow-sm" download={`QR_${qr.alias}.svg`}>
                                <i className="bi bi-download"></i> SVG
                              </a>
                            </div>
                          </div>
                        </div>
                        
                        {/* 右側: 情報と編集フォーム */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          {editingQrId === qr.id ? (
                            <div className="flex flex-col gap-3 h-full bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                              <div className="font-bold text-xs text-indigo-700 border-b border-indigo-200 pb-2 mb-1">
                                <i className="bi bi-pencil-square mr-1"></i>{t('qr_edit_title')}
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('qr_edit_redirect')}</label>
                                <input type="url" value={editQrForm.redirectUrl} onChange={e => setEditQrForm({...editQrForm, redirectUrl: e.target.value})} className="w-full text-xs border border-indigo-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner bg-white" />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('qr_edit_memo')}</label>
                                <input type="text" value={editQrForm.memo} onChange={e => setEditQrForm({...editQrForm, memo: e.target.value})} className="w-full text-xs border border-indigo-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner bg-white" />
                              </div>
                              
                              <div className="p-3 bg-white border border-indigo-100 rounded-lg shadow-sm">
                                <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                                  <input type="checkbox" checked={editQrForm.notifyOnScan} onChange={e => setEditQrForm({...editQrForm, notifyOnScan: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                                  <span className="text-[10px] font-bold text-indigo-900">{t('qr_notify_on_scan')}</span>
                                </label>
                                {editQrForm.notifyOnScan && (
                                  <div className="mt-2">
                                    <label className="text-[9px] text-slate-500 block mb-0.5">{t('qr_edit_notify_emails')}</label>
                                    <textarea value={editQrForm.notificationEmails} onChange={e => setEditQrForm({...editQrForm, notificationEmails: e.target.value})} rows={2} className="w-full text-[10px] border border-indigo-200 rounded p-1.5 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50" placeholder="client@example.com" />
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-end gap-2 mt-auto pt-3 border-t border-indigo-100">
                                <button onClick={() => setEditingQrId(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] rounded-lg font-bold hover:bg-slate-50 transition-colors">{t('cancel')}</button>
                                <button onClick={() => saveEditQr(qr.id)} className="px-4 py-2 bg-indigo-600 text-white text-[10px] rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors">{t('qr_save_btn')}</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                                <button 
                                  onClick={() => toggleQrActive(qr)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors shadow-sm border ${qr.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${qr.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                  {qr.isActive ? t('qr_active') : t('qr_archived')}
                                </button>
                                
                                <div className="flex gap-2">
                                  <button onClick={() => startEditQr(qr)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors shadow-sm" title="編集">
                                    <i className="bi bi-pencil-square"></i> {t('edit')}
                                  </button>
                                  <button onClick={() => deleteQrCode(qr.id)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-300 px-3 py-1.5 rounded-lg transition-colors shadow-sm" title={t('delete')}>
                                    <i className="bi bi-trash"></i> {t('delete')}
                                  </button>
                                </div>
                              </div>

                              {qr.memo && <div className="text-xs font-bold text-slate-700 mb-3 truncate bg-slate-100 inline-block px-2 py-1 rounded-md border border-slate-200" title={qr.memo}><i className="bi bi-tag-fill text-slate-400 mr-1"></i>{qr.memo}</div>}
                              
                              <div className="mb-3">
                                <div className="text-[10px] text-slate-500 font-bold mb-1">{t('qr_print_url')}</div>
                                <div className="font-mono text-xs text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg truncate" title={qrUrl}>
                                  {qrUrl}
                                </div>
                              </div>
                              
                              <div className="mb-4">
                                <div className="text-[10px] text-slate-500 font-bold mb-1">{t('qr_redirect_url_label')}</div>
                                <a href={qr.redirectUrl} target="_blank" className="text-xs text-blue-600 hover:underline truncate block w-full" title={qr.redirectUrl}>
                                  <i className="bi bi-link-45deg"></i> {qr.redirectUrl}
                                </a>
                              </div>

                              {qr.notifyOnScan && (
                                <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1.5 rounded-md flex items-center gap-1.5 mb-3 self-start truncate max-w-full font-medium">
                                  <i className="bi bi-envelope-check-fill text-indigo-500"></i> {t('qr_notify_on', { count: qr.notificationEmails?.split(',').length || 0 })}
                                </div>
                              )}
                              
                              <div className="mt-auto flex flex-wrap items-center justify-between pt-4 border-t border-slate-100 gap-4">
                                <div className="text-[10px] text-slate-400 font-medium">{t('qr_created', { date: new Date(qr.createdAt).toLocaleDateString() })}</div>
                                
                                <div className="flex gap-5">
                                  <div className="flex flex-col items-end" title="総スキャン回数 (延べアクセス数)">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Scans</span>
                                    <div className="text-slate-700 font-black flex items-center gap-1.5">
                                      <i className="bi bi-qr-code-scan text-slate-400"></i>
                                      <span className="text-2xl leading-none">{qr._count?.scanLogs || 0}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="w-px h-8 bg-slate-200"></div>

                                  <div className="flex flex-col items-end" title="ユニークアクセス数 (読み取った人数)">
                                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Unique</span>
                                    <div className="text-emerald-600 font-black flex items-center gap-1.5">
                                      <i className="bi bi-person-check-fill text-emerald-400"></i>
                                      <span className="text-2xl leading-none">{qr.uniqueScans || 0}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* チラシ登録・編集モーダル */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? t('modal_title_edit') : t('modal_title_new')}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-slate-600">{t('form_name')}</label>
                  <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder={t('form_name_placeholder')} />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-slate-600">{t('form_code')}</label>
                  <input name="flyerCode" value={formData.flyerCode} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-blue-50 focus:bg-white" placeholder={t('form_code_placeholder')} />
                </div>
                
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">{t('form_customer')}</label>
                  <select required name="customerId" value={formData.customerId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">{t('form_select_placeholder')}</option>
                    {(masters.customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">{t('form_industry')}</label>
                  <select required name="industryId" value={formData.industryId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">{t('form_select_placeholder')}</option>
                    {(masters.industries || []).map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">{t('form_size')}</label>
                  <select required name="sizeId" value={formData.sizeId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">{t('form_select_placeholder')}</option>
                    {(masters.sizes || []).map((s: any) => <option key={s.id} value={s.id}>{s.name} {s.isFoldRequired ? t('form_size_fold_required') : ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">{t('form_start_date')}</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">{t('form_end_date')}</label>
                  <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" />
                </div>

                <div className="col-span-2 p-4 bg-fuchsia-50/50 border border-fuchsia-100 rounded-lg">
                  <label className="text-xs font-bold text-slate-600">{t('form_bundle_count')}</label>
                  <div className="relative mt-1 max-w-xs">
                    <input type="number" min="1" name="bundleCount" value={formData.bundleCount} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white pr-8 text-right font-bold text-slate-700" placeholder={t('form_bundle_placeholder')} />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">{t('sheets')}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{t('form_bundle_note')}</p>
                </div>

                <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="text-xs font-bold text-slate-600 block mb-2">{t('form_fold_status')}</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="NO_FOLDING_REQUIRED" checked={formData.foldStatus === 'NO_FOLDING_REQUIRED'} onChange={handleInputChange} />
                      <span className="text-sm">{t('form_fold_none')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="NEEDS_FOLDING" checked={formData.foldStatus === 'NEEDS_FOLDING'} onChange={handleInputChange} />
                      <span className="text-sm font-bold text-rose-600">{t('form_fold_needs')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="FOLDED" checked={formData.foldStatus === 'FOLDED'} onChange={handleInputChange} />
                      <span className="text-sm font-bold text-blue-600">{t('form_fold_done')}</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">{t('form_remarks')}</label>
                  <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={2} className="w-full border p-2 rounded-lg text-sm" placeholder={t('form_remarks_placeholder')} />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold">{t('cancel')}</button>
                <button type="submit" className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-bold shadow-md">
                  {currentId ? t('btn_update') : t('btn_register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}