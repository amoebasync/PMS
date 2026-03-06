'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

export default function PartnerPage() {
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('partners');
  const [partners, setPartners] = useState<any[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const initialForm = { name: '', partnerTypeId: '', contactInfo: '' };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterActive !== 'all') params.append('isActive', filterActive);
      if (filterType) params.append('typeId', filterType);

      const [partnersRes, typesRes] = await Promise.all([
        fetch(`/api/partners?${params}`),
        fetch('/api/partners/types')
      ]);

      if (partnersRes.ok) setPartners(await partnersRes.json());
      if (typesRes.ok) setPartnerTypes(await typesRes.json());

    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  }, [filterActive, filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openForm = () => {
    setFormData(initialForm);
    setIsFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      setIsFormOpen(false);
      fetchData();
    } catch (e) { showToast(t('save_error'), 'error'); }
  };

  const del = async (id: number) => {
    if (!await showConfirm(t('confirm_delete'), { variant: 'danger', detail: t('confirm_delete_detail'), confirmLabel: t('confirm_delete_btn') })) return;
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchData();
    } catch (e) { showToast(t('error_delete'), 'error'); }
  };

  const filteredPartners = partners.filter(p =>
    p.name.includes(searchTerm) || (p.contactInfo || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => openForm()} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all">
          <i className="bi bi-plus-lg"></i> {t('btn_new')}
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <div className="relative max-w-md">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder={t('search_placeholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(['all', 'true', 'false'] as const).map(val => (
              <button key={val} onClick={() => setFilterActive(val)}
                className={`px-3 py-1.5 text-xs font-bold ${filterActive === val ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {val === 'all' ? t('filter_all') : val === 'true' ? t('filter_active') : t('filter_inactive')}
              </button>
            ))}
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm outline-none">
            <option value="">{t('filter_type')}</option>
            {partnerTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">{t('table_name')}</th>
              <th className="px-6 py-4">{t('table_type')}</th>
              <th className="px-6 py-4">{t('table_gps')}</th>
              <th className="px-6 py-4">{t('table_areas')}</th>
              <th className="px-6 py-4">{t('table_incidents')}</th>
              <th className="px-6 py-4">{t('table_status')}</th>
              <th className="px-6 py-4 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('loading')}</td></tr> :
             filteredPartners.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('no_data')}</td></tr> :
             filteredPartners.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/partners/${p.id}`)}>
                <td className="px-6 py-4 font-bold text-slate-800 text-base">{p.name}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border rounded-md bg-slate-100 text-slate-700 border-slate-200">
                    {p.partnerType?.name || t('type_unknown')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {p.hasGpsTracking ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">
                      <i className="bi bi-geo-alt-fill"></i> {t('has_gps')}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">{t('no_gps')}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{p._count?.coverageAreas ?? 0}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full ${
                    (p._count?.incidents ?? 0) > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {p._count?.incidents ?? 0}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {p.isActive ? (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">{t('status_active')}</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-400">{t('status_inactive')}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => del(p.id)} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash text-lg"></i></button>
                </td>
              </tr>
             ))}
          </tbody>
        </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{t('modal_title_new')}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>

            <form onSubmit={save} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_company_name')} <span className="text-rose-500">*</span></label>
                <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder={t('form_company_placeholder')} />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_type')} <span className="text-rose-500">*</span></label>
                <select required name="partnerTypeId" value={formData.partnerTypeId} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                  <option value="">{t('form_select_placeholder')}</option>
                  {partnerTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_contact')}</label>
                <textarea name="contactInfo" value={formData.contactInfo} onChange={handleInputChange} rows={4} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder={t('form_contact_placeholder')} />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-100 rounded-lg transition-colors">{t('cancel')}</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all">
                  {t('btn_register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
