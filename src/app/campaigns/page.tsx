'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

type Campaign = {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
};

const initialForm = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  isActive: true,
};

export default function CampaignsPage() {
  const { t } = useTranslation('campaigns');
  const { showToast } = useNotification();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/campaigns');
      const data = res.ok ? await res.json() : [];
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const openFormModal = (campaign?: Campaign) => {
    if (campaign) {
      setCurrentId(campaign.id);
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        startDate: campaign.startDate ? campaign.startDate.split('T')[0] : '',
        endDate: campaign.endDate ? campaign.endDate.split('T')[0] : '',
        isActive: campaign.isActive,
      });
    } else {
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = currentId ? `/api/campaigns/${currentId}` : '/api/campaigns';
      const method = currentId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Save failed');
      setIsFormModalOpen(false);
      fetchData();
    } catch {
      showToast(t('save_error'), 'error');
    }
  };

  const confirmDelete = (id: number) => {
    setCurrentId(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/campaigns/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch {
      showToast(t('delete_error'), 'error');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => openFormModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2"
        >
          <i className="bi bi-plus-lg"></i> {t('btn_create')}
        </button>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">{t('col_name')}</th>
              <th className="px-6 py-4 font-semibold">{t('col_description')}</th>
              <th className="px-6 py-4 font-semibold">{t('col_start_date')}</th>
              <th className="px-6 py-4 font-semibold">{t('col_end_date')}</th>
              <th className="px-6 py-4 font-semibold">{t('col_status')}</th>
              <th className="px-6 py-4 font-semibold text-right">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('loading')}</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('empty')}</td></tr>
            ) : (
              campaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800">{camp.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-[200px] truncate">{camp.description || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatDate(camp.startDate)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatDate(camp.endDate)}</td>
                  <td className="px-6 py-4">
                    {camp.isActive ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">{t('active')}</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">{t('inactive')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openFormModal(camp)} className="p-2 text-slate-400 hover:text-indigo-600">
                      <i className="bi bi-pencil-square text-lg"></i>
                    </button>
                    <button onClick={() => confirmDelete(camp.id)} className="p-2 text-slate-400 hover:text-rose-600">
                      <i className="bi bi-trash text-lg"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* 登録・編集モーダル */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? t('modal_title_edit') : t('modal_title_create')}</h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600">{t('label_name')} <span className="text-rose-500">*</span></label>
                <input name="name" value={formData.name} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg mt-1" placeholder={t('placeholder_name')} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">{t('label_description')}</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border rounded-lg mt-1" placeholder={t('placeholder_description')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">{t('label_start_date')}</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">{t('label_end_date')}</label>
                  <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                />
                <label htmlFor="isActive" className="text-sm font-bold text-slate-600">{t('label_active')}</label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold text-sm">{t('cancel')}</button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md">
                  {currentId ? t('btn_update') : t('btn_create_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-2">{t('delete_title')}</h3>
            <p className="text-slate-500 text-sm mb-6">{t('delete_message')}</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm">{t('cancel')}</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm shadow-md">{t('btn_deactivate')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
