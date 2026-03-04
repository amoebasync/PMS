'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

type Employee = { id: number; lastNameJa: string; firstNameJa: string; isActive: boolean };
type Branch = any; 

export default function BranchPage() {
  const { showToast } = useNotification();
  const { t } = useTranslation('branches');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const initialForm = {
    nameJa: '', nameEn: '', prefix: '', staffIdSeq: '0', address: '', googleMapUrl: '',
    openingTime: '', closedDays: '', alternateBranchId: '',
    manager1Id: '', manager2Id: '', manager3Id: '', manager4Id: ''
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [branchRes, empRes] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/employees')
      ]);
      const branchData = await branchRes.json();
      const empData = await empRes.json();
      
      setBranches(Array.isArray(branchData) ? branchData : []);
      // 有効な社員のみを店長候補とする
      setEmployees(Array.isArray(empData) ? empData.filter((e: any) => e.isActive) : []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const DAY_OPTIONS = [
    { label: t('day_mon'), value: '月曜日' },
    { label: t('day_tue'), value: '火曜日' },
    { label: t('day_wed'), value: '水曜日' },
    { label: t('day_thu'), value: '木曜日' },
    { label: t('day_fri'), value: '金曜日' },
    { label: t('day_sat'), value: '土曜日' },
    { label: t('day_sun'), value: '日曜日' },
    { label: t('day_holiday'), value: '祝日' },
  ];

  const toggleClosedDay = (dayValue: string) => {
    const current = formData.closedDays ? formData.closedDays.split(',').map(s => s.trim()).filter(Boolean) : [];
    const updated = current.includes(dayValue)
      ? current.filter(d => d !== dayValue)
      : [...current, dayValue];
    setFormData(prev => ({ ...prev, closedDays: updated.join(',') }));
  };

  const openForm = (branch?: Branch) => {
    if (branch) {
      setCurrentId(branch.id);
      setFormData({
        nameJa: branch.nameJa || '',
        nameEn: branch.nameEn || '',
        prefix: branch.prefix || '',
        staffIdSeq: String(branch.staffIdSeq ?? 0),
        address: branch.address || '',
        googleMapUrl: branch.googleMapUrl || '',
        openingTime: branch.openingTime || '',
        closedDays: branch.closedDays || '',
        alternateBranchId: branch.alternateBranchId?.toString() || '',
        manager1Id: branch.manager1Id?.toString() || '',
        manager2Id: branch.manager2Id?.toString() || '',
        manager3Id: branch.manager3Id?.toString() || '',
        manager4Id: branch.manager4Id?.toString() || ''
      });
    } else {
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = currentId ? 'PUT' : 'POST';
      const url = currentId ? `/api/branches/${currentId}` : '/api/branches';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Error saving branch');
      setIsFormModalOpen(false);
      fetchData();
    } catch (e) { showToast(t('save_error'), 'error'); }
  };

  const del = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/branches/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting branch');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (e) { showToast(t('delete_error'), 'error'); }
  };

  // 店長名を表示するためのヘルパー関数
  const getManagerName = (manager: any) => {
    return manager ? `${manager.lastNameJa} ${manager.firstNameJa}` : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => openForm()} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">
          <i className="bi bi-plus-lg"></i> {t('btn_new_branch')}
        </button>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">{t('table_branch_name')}</th>
              <th className="px-6 py-4">{t('table_hours_holidays')}</th>
              <th className="px-6 py-4">{t('table_managers')}</th>
              <th className="px-6 py-4">{t('table_address_map')}</th>
              <th className="px-6 py-4 text-right">{t('table_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center">{t('loading')}</td></tr> :
             branches.map(b => {
               const managers = [getManagerName(b.manager1), getManagerName(b.manager2), getManagerName(b.manager3), getManagerName(b.manager4)].filter(Boolean);
               
               return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-base">{b.nameJa}</div>
                    <div className="font-mono text-xs text-slate-400">{b.nameEn}</div>
                    {b.prefix && (
                      <span className="inline-block mt-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                        {b.prefix} — {t('next_id')}{b.prefix}{String((b.staffIdSeq ?? 0) + 1).padStart(3, '0')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-slate-700"><i className="bi bi-clock mr-1 text-slate-400"></i> {b.openingTime || '-'}</div>
                    <div className="text-slate-500 text-xs mt-1 flex items-center gap-1 flex-wrap">
                      <i className="bi bi-calendar-x text-rose-400"></i>
                      {b.closedDays ? b.closedDays.split(',').map((d: string) => d.trim()).filter(Boolean).map((d: string, i: number) => (
                        <span key={i} className="bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded text-[10px] font-bold">{d}</span>
                      )) : <span>-</span>}
                    </div>
                    {b.alternateBranch && (
                      <div className="text-slate-500 text-xs mt-1"><i className="bi bi-arrow-right-circle mr-1 text-amber-500"></i> {t('alternate_branch')}{b.alternateBranch.nameJa}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {managers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {managers.map((m, idx) => (
                          <span key={idx} className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-[10px] font-bold">
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="truncate max-w-[200px] text-xs text-slate-600 mb-1">{b.address || '-'}</div>
                    {b.googleMapUrl && (
                      <a href={b.googleMapUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                        <i className="bi bi-geo-alt-fill"></i> {t('open_map')}
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openForm(b)} className="p-2 text-slate-400 hover:text-orange-600"><i className="bi bi-pencil-square"></i></button>
                    <button onClick={() => { setCurrentId(b.id); setIsDeleteModalOpen(true); }} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash"></i></button>
                  </td>
                </tr>
               );
             })}
          </tbody>
        </table>
        </div>
      </div>

      {/* 登録・編集モーダル */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? t('form_title_edit') : t('form_title_new')}</h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-6">
              {/* 基本情報 */}
              <div>
                <h4 className="font-bold text-sm text-orange-600 border-b border-orange-100 pb-2 mb-4">{t('section_basic')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-600">{t('form_name_ja')} *</label><input required name="nameJa" value={formData.nameJa} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder={t('form_name_ja_placeholder')} /></div>
                  <div><label className="text-xs font-bold text-slate-600">{t('form_name_en')} *</label><input required name="nameEn" value={formData.nameEn} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm font-mono" placeholder={t('form_name_en_placeholder')} /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">{t('form_prefix')}</label>
                    <input name="prefix" value={(formData as any).prefix} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm font-mono uppercase" placeholder={t('form_prefix_placeholder')} maxLength={10} />
                    <p className="text-[10px] text-slate-400 mt-1">{t('form_prefix_hint')}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">{t('form_seq_number')}</label>
                    <input
                      type="number"
                      name="staffIdSeq"
                      min={0}
                      value={(formData as any).staffIdSeq}
                      onChange={handleInputChange}
                      className="w-full border p-2 rounded-lg text-sm font-mono"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      {t('form_next_id_hint', { prefix: (formData as any).prefix || 'PREFIX', nextId: String(Number((formData as any).staffIdSeq ?? 0) + 1).padStart(3, '0') })}
                    </p>
                  </div>
                  <div className="col-span-2"><label className="text-xs font-bold text-slate-600">{t('form_address')}</label><input name="address" value={formData.address} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-slate-600">{t('form_google_map_url')}</label><input name="googleMapUrl" value={formData.googleMapUrl} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder="https://maps.app.goo.gl/..." /></div>
                  <div><label className="text-xs font-bold text-slate-600">{t('form_opening_time')}</label><input type="time" name="openingTime" value={formData.openingTime} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">{t('form_closed_days')}</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {DAY_OPTIONS.map(day => {
                        const selected = formData.closedDays ? formData.closedDays.split(',').map(s => s.trim()).includes(day.value) : false;
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleClosedDay(day.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                              selected
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-rose-300 hover:text-rose-600'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">{t('form_alternate_branch')}</label>
                    <select name="alternateBranchId" value={(formData as any).alternateBranchId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                      <option value="">{t('form_none')}</option>
                      {branches.filter((br: any) => br.id !== currentId).map((br: any) => <option key={br.id} value={br.id}>{br.nameJa}</option>)}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">{t('form_alternate_hint')}</p>
                  </div>
                </div>
              </div>

              {/* 店長設定 */}
              <div>
                <h4 className="font-bold text-sm text-orange-600 border-b border-orange-100 pb-2 mb-4">{t('section_managers')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(num => (
                    <div key={num}>
                      <label className="text-xs font-bold text-slate-600">{t('form_manager_label', { num })}</label>
                      <select name={`manager${num}Id`} value={(formData as any)[`manager${num}Id`]} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                        <option value="">{t('form_unselected')}</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold">{t('btn_cancel')}</button>
                <button type="submit" className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold shadow-md">{currentId ? t('btn_update') : t('btn_register')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl text-center max-w-sm w-full">
            <h3 className="font-bold text-lg mb-2 text-slate-800">{t('delete_confirm')}</h3>
            <p className="text-sm text-slate-500 mb-6">{t('delete_warning')}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold">{t('btn_cancel')}</button>
              <button onClick={del} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold">{t('btn_delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}