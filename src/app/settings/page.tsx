'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { handlePostalInput, handlePhoneChange } from '@/lib/formatters';
import DefaultSlotSettings from '@/components/settings/DefaultSlotSettings';

type Department = { id: number; code: string | null; name: string; _count: { employees: number } };
type Industry = { id: number; name: string; _count: { flyers: number } };
type Country = { id: number; code: string; name: string; nameEn: string | null; sortOrder: number; _count: { employees: number; distributors: number } };
type VisaType = { id: number; name: string; sortOrder: number; _count: { distributors: number } };
type Bank = { id: number; code: string; name: string; nameKana: string | null; sortOrder: number };
type DistributionMethod = { id: number; name: string; capacityType: string; priceAddon: number; sortOrder: number; isActive: boolean };
type CompanySetting = {
  companyName: string; companyNameKana: string; postalCode: string; address: string;
  phone: string; fax: string; email: string; website: string;
  invoiceRegistrationNumber: string; bankName: string; bankBranch: string;
  bankAccountType: string; bankAccountNumber: string; bankAccountHolder: string; logoUrl: string;
};
const COMPANY_DEFAULTS: CompanySetting = {
  companyName: '', companyNameKana: '', postalCode: '', address: '',
  phone: '', fax: '', email: '', website: '',
  invoiceRegistrationNumber: '', bankName: '', bankBranch: '',
  bankAccountType: '普通', bankAccountNumber: '', bankAccountHolder: '', logoUrl: '',
};

const WEEK_DAY_OPTIONS = [
  { value: '0', label: '日曜日' },
  { value: '1', label: '月曜日' },
  { value: '2', label: '火曜日' },
  { value: '3', label: '水曜日' },
  { value: '4', label: '木曜日' },
  { value: '5', label: '金曜日' },
  { value: '6', label: '土曜日' },
];

const inp = 'w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500';

export default function SettingsPage() {
  const { showToast, showConfirm } = useNotification();
  const [tab, setTab] = useState<'general' | 'department' | 'industry' | 'country' | 'visaType' | 'bank' | 'distributionMethod' | 'company' | 'interviewSlot'>('general');

  // 自社情報
  const [companyForm, setCompanyForm] = useState<CompanySetting>(COMPANY_DEFAULTS);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  const fetchCompanySettings = async () => {
    setIsLoadingCompany(true);
    try {
      const res = await fetch('/api/settings/company');
      if (res.ok) {
        const data = await res.json();
        if (data?.companyName !== undefined) {
          setCompanyForm({ ...COMPANY_DEFAULTS, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ''])) });
        }
      }
    } catch (e) { console.error(e); }
    setIsLoadingCompany(false);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCompany(true);
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });
      if (!res.ok) throw new Error();
      showToast('自社情報を保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setIsSavingCompany(false);
    }
  };

  // 全般設定
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({ weekStartDay: '1' });
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [systemSaved, setSystemSaved] = useState(false);

  // マスタ
  const [departments, setDepartments] = useState<Department[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [distributionMethods, setDistributionMethods] = useState<DistributionMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch('/api/settings/system');
      if (res.ok) setSystemSettings(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchData = async () => {
    try {
      const [mastersRes, pricingRes] = await Promise.all([
        fetch('/api/settings/masters'),
        fetch('/api/pricing'),
      ]);
      if (mastersRes.ok) {
        const d = await mastersRes.json();
        setDepartments(d.departments);
        setIndustries(d.industries);
        setCountries(d.countries);
        setVisaTypes(d.visaTypes);
        setBanks(d.banks);
      }
      if (pricingRes.ok) {
        const d = await pricingRes.json();
        setDistributionMethods(d.distributionMethods ?? []);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSystemSettings();
    fetchData();
  }, []);

  const handleSaveSystemSetting = async (key: string, value: string) => {
    setIsSavingSystem(true);
    try {
      await fetch('/api/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      setSystemSettings(prev => ({ ...prev, [key]: value }));
      setSystemSaved(true);
      setTimeout(() => setSystemSaved(false), 2000);
    } catch (e) { showToast('保存に失敗しました', 'error'); }
    setIsSavingSystem(false);
  };

  const getDefaultForm = () => {
    if (tab === 'department') return { code: '', name: '' };
    if (tab === 'industry') return { name: '' };
    if (tab === 'country') return { code: '', name: '', nameEn: '', sortOrder: 100 };
    if (tab === 'visaType') return { name: '', sortOrder: 100 };
    if (tab === 'bank') return { code: '', name: '', nameKana: '', sortOrder: 100 };
    if (tab === 'distributionMethod') return { name: '', capacityType: 'all', priceAddon: 0, sortOrder: 100, isActive: true };
    return {};
  };

  const openCreate = () => {
    setForm(getDefaultForm());
    setEditTarget(null);
    setShowModal('create');
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    if (tab === 'department') setForm({ code: item.code || '', name: item.name });
    else if (tab === 'industry') setForm({ name: item.name });
    else if (tab === 'country') setForm({ code: item.code, name: item.name, nameEn: item.nameEn || '', sortOrder: item.sortOrder });
    else if (tab === 'visaType') setForm({ name: item.name, sortOrder: item.sortOrder });
    else if (tab === 'bank') setForm({ code: item.code || '', name: item.name, nameKana: item.nameKana || '', sortOrder: item.sortOrder });
    else if (tab === 'distributionMethod') setForm({ name: item.name, capacityType: item.capacityType, priceAddon: item.priceAddon, sortOrder: item.sortOrder, isActive: item.isActive });
    setShowModal('edit');
  };

  const isPricingTab = tab === 'distributionMethod';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const apiBase = isPricingTab ? '/api/pricing' : '/api/settings/masters';
    try {
      if (showModal === 'create') {
        await fetch(apiBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: tab, data: form }),
        });
      } else if (showModal === 'edit' && editTarget) {
        await fetch(apiBase, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: tab, id: editTarget.id, data: form }),
        });
      }
      setShowModal(null);
      await fetchData();
    } catch (e) { showToast('エラーが発生しました', 'error'); }
    setIsSubmitting(false);
  };

  const handleDelete = async (item: any) => {
    if (!await showConfirm(`「${item.name}」を削除しますか？`, { variant: 'danger', confirmLabel: '削除する' })) return;
    const apiBase = isPricingTab ? '/api/pricing' : '/api/settings/masters';
    const res = await fetch(`${apiBase}?type=${tab}&id=${item.id}`, { method: 'DELETE' });
    if (res.status === 409) {
      const d = await res.json();
      setErrorMsg(d.error || '削除できません');
    } else if (!res.ok) {
      setErrorMsg('削除に失敗しました。');
    } else {
      await fetchData();
    }
  };

  const tabs = [
    { key: 'general',            label: '全般',       icon: 'bi-gear-fill' },
    { key: 'department',         label: '部署',        icon: 'bi-diagram-3' },
    { key: 'industry',           label: '業種',        icon: 'bi-tag' },
    { key: 'country',            label: '国',          icon: 'bi-globe2' },
    { key: 'visaType',           label: '在留資格',    icon: 'bi-card-checklist' },
    { key: 'bank',               label: '銀行',        icon: 'bi-bank2' },
    { key: 'distributionMethod', label: '配布方法',    icon: 'bi-signpost-2' },
    { key: 'company',            label: '自社情報',    icon: 'bi-building' },
    { key: 'interviewSlot',      label: '面接スロット', icon: 'bi-calendar-check' },
  ] as const;

  const isMasterTab = tab !== 'general' && tab !== 'company' && tab !== 'interviewSlot';

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-800">システム設定</h1>
          <p className="text-sm text-slate-500 mt-1">各種マスタデータと全般設定を管理します。</p>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-bold">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="ml-auto text-rose-400 hover:text-rose-600">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        )}

        {/* タブ */}
        <div className="flex flex-wrap gap-1 mb-6 bg-slate-200 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setErrorMsg(''); if (t.key === 'company') fetchCompanySettings(); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${tab === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <i className={`bi ${t.icon}`}></i> {t.label}
            </button>
          ))}
        </div>

        {/* 全般設定タブ */}
        {tab === 'general' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">全般設定</h2>
            </div>
            <div className="p-6 divide-y divide-slate-100 space-y-0">
              <div className="flex items-center justify-between gap-6 pb-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-telephone-fill text-fuchsia-500"></i>
                    カスタマーセンター電話番号
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">ECポータルのエラー画面等に表示される問い合わせ先の電話番号です。</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="tel"
                    value={systemSettings.supportPhone ?? ''}
                    onChange={e => setSystemSettings(prev => ({ ...prev, supportPhone: e.target.value }))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white w-44"
                    placeholder="例: 03-1234-5678"
                  />
                  <button
                    onClick={() => handleSaveSystemSetting('supportPhone', systemSettings.supportPhone ?? '')}
                    disabled={isSavingSystem}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {systemSaved ? <><i className="bi bi-check2"></i> 保存済</> : isSavingSystem ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-6 pt-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm">週の開始曜日</p>
                  <p className="text-xs text-slate-500 mt-0.5">給与計算（週次）の集計期間の開始曜日を設定します。</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={systemSettings.weekStartDay ?? '1'}
                    onChange={e => setSystemSettings(prev => ({ ...prev, weekStartDay: e.target.value }))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {WEEK_DAY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSaveSystemSetting('weekStartDay', systemSettings.weekStartDay ?? '1')}
                    disabled={isSavingSystem}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {systemSaved ? <><i className="bi bi-check2"></i> 保存済</> : isSavingSystem ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 自社情報タブ */}
        {tab === 'company' && (
          isLoadingCompany ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <i className="bi bi-hourglass-split text-2xl animate-spin mr-3" />読み込み中...
            </div>
          ) : (
            <form onSubmit={handleSaveCompany} className="space-y-6">
              {/* 基本情報 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="bi bi-info-circle text-indigo-500"></i> 基本情報
                  </h2>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 会社名 */}
                  {[
                    { label: '会社名', name: 'companyName', placeholder: '株式会社ティラミス', required: true },
                    { label: '会社名（カナ）', name: 'companyNameKana', placeholder: 'カブシキガイシャティラミス' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-xs font-bold text-slate-500 mb-1">
                        {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input
                        name={f.name}
                        value={(companyForm as any)[f.name]}
                        onChange={e => setCompanyForm(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                        placeholder={f.placeholder}
                        required={f.required}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  ))}

                  {/* 郵便番号（自動ハイフン＋住所補完） */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">郵便番号</label>
                    <input
                      name="postalCode"
                      value={companyForm.postalCode}
                      onChange={e => handlePostalInput(
                        e.target.value,
                        v => setCompanyForm(prev => ({ ...prev, postalCode: v })),
                        v => setCompanyForm(prev => ({ ...prev, address: v })),
                      )}
                      placeholder="100-0001"
                      maxLength={8}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* 電話番号（自動ハイフン） */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">電話番号</label>
                    <input
                      name="phone"
                      value={companyForm.phone}
                      onChange={e => handlePhoneChange(
                        e.target.value,
                        v => setCompanyForm(prev => ({ ...prev, phone: v })),
                      )}
                      placeholder="03-0000-0000"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* 住所（郵便番号入力で自動補完） */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">住所</label>
                    <input
                      name="address"
                      value={companyForm.address}
                      onChange={e => setCompanyForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="東京都千代田区〇〇 1-2-3"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* FAX番号（自動ハイフン） */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">FAX番号</label>
                    <input
                      name="fax"
                      value={companyForm.fax}
                      onChange={e => handlePhoneChange(
                        e.target.value,
                        v => setCompanyForm(prev => ({ ...prev, fax: v })),
                      )}
                      placeholder="03-0000-0001"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* メール・ウェブサイト */}
                  {[
                    { label: 'メールアドレス', name: 'email', placeholder: 'info@example.co.jp' },
                    { label: 'ウェブサイト', name: 'website', placeholder: 'https://example.co.jp' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{f.label}</label>
                      <input
                        name={f.name}
                        value={(companyForm as any)[f.name]}
                        onChange={e => setCompanyForm(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* インボイス情報 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="bi bi-receipt text-indigo-500"></i> インボイス・税務情報
                  </h2>
                </div>
                <div className="p-5">
                  <label className="block text-xs font-bold text-slate-500 mb-1">適格請求書発行事業者登録番号</label>
                  <input
                    name="invoiceRegistrationNumber"
                    value={companyForm.invoiceRegistrationNumber}
                    onChange={e => setCompanyForm(prev => ({ ...prev, invoiceRegistrationNumber: e.target.value }))}
                    placeholder="T1234567890123"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none max-w-xs"
                  />
                  <p className="text-xs text-slate-400 mt-1">Tから始まる13桁の番号を入力してください</p>
                </div>
              </div>

              {/* 振込先口座 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="bi bi-bank text-indigo-500"></i> 振込先口座
                  </h2>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: '銀行名', name: 'bankName', placeholder: '〇〇銀行' },
                    { label: '支店名', name: 'bankBranch', placeholder: '〇〇支店' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{f.label}</label>
                      <input
                        name={f.name}
                        value={(companyForm as any)[f.name]}
                        onChange={e => setCompanyForm(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">口座種別</label>
                    <select
                      name="bankAccountType"
                      value={companyForm.bankAccountType}
                      onChange={e => setCompanyForm(prev => ({ ...prev, bankAccountType: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="普通">普通</option>
                      <option value="当座">当座</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">口座番号</label>
                    <input
                      name="bankAccountNumber"
                      value={companyForm.bankAccountNumber}
                      onChange={e => setCompanyForm(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                      placeholder="1234567"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">口座名義（カナ）</label>
                    <input
                      name="bankAccountHolder"
                      value={companyForm.bankAccountHolder}
                      onChange={e => setCompanyForm(prev => ({ ...prev, bankAccountHolder: e.target.value }))}
                      placeholder="カブシキガイシャティラミス"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 保存ボタン */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingCompany}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingCompany ? <><i className="bi bi-hourglass-split animate-spin"></i> 保存中...</> : <><i className="bi bi-check2-circle"></i> 設定を保存</>}
                </button>
              </div>
            </form>
          )
        )}

        {/* マスタタブ共通 */}
        {isMasterTab && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700">{tabs.find(t => t.key === tab)?.label}マスタ</h2>
              <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 shadow-sm">
                <i className="bi bi-plus-lg"></i> 追加
              </button>
            </div>

            {isLoading ? (
              <div className="p-10 text-center text-slate-400">読み込み中...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {tab === 'department' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">コード</th><th className="px-5 py-3 text-left font-bold text-slate-600">部署名</th><th className="px-5 py-3 text-center font-bold text-slate-600">社員数</th><th className="px-5 py-3"></th></>)}
                    {tab === 'industry' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">業種名</th><th className="px-5 py-3 text-center font-bold text-slate-600">チラシ数</th><th className="px-5 py-3"></th></>)}
                    {tab === 'country' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">コード</th><th className="px-5 py-3 text-left font-bold text-slate-600">国名（日本語）</th><th className="px-5 py-3 text-left font-bold text-slate-600">英語名</th><th className="px-5 py-3 text-center font-bold text-slate-600">順</th><th className="px-5 py-3 text-center font-bold text-slate-600">利用</th><th className="px-5 py-3"></th></>)}
                    {tab === 'visaType' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">在留資格名</th><th className="px-5 py-3 text-center font-bold text-slate-600">順</th><th className="px-5 py-3 text-center font-bold text-slate-600">配布員数</th><th className="px-5 py-3"></th></>)}
                    {tab === 'bank' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">コード</th><th className="px-5 py-3 text-left font-bold text-slate-600">銀行名</th><th className="px-5 py-3 text-left font-bold text-slate-600">カナ</th><th className="px-5 py-3 text-center font-bold text-slate-600">順</th><th className="px-5 py-3"></th></>)}
                    {tab === 'distributionMethod' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">配布方法名</th><th className="px-5 py-3 text-left font-bold text-slate-600">集計対象</th><th className="px-5 py-3 text-center font-bold text-slate-600">単価加算</th><th className="px-5 py-3 text-center font-bold text-slate-600">順</th><th className="px-5 py-3 text-center font-bold text-slate-600">有効</th><th className="px-5 py-3"></th></>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tab === 'department' && departments.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-slate-400 text-xs">{item.code || '—'}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.employees}名</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'department' && departments.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">部署がありません</td></tr>}

                  {tab === 'industry' && industries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.flyers}件</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'industry' && industries.length === 0 && <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">業種がありません</td></tr>}

                  {tab === 'country' && countries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-indigo-600">{item.code}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-slate-500 text-sm">{item.nameEn || '—'}</td>
                      <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.employees + item._count.distributors}件</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'country' && countries.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">国がありません</td></tr>}

                  {tab === 'visaType' && visaTypes.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.distributors}名</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'visaType' && visaTypes.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">在留資格がありません</td></tr>}

                  {tab === 'bank' && banks.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{item.code || '—'}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{item.nameKana || '—'}</td>
                      <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'bank' && banks.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">銀行がありません</td></tr>}

                  {tab === 'distributionMethod' && distributionMethods.map(item => {
                    const capacityLabel = item.capacityType === 'all' ? '全世帯' : item.capacityType === 'detached' ? '戸建のみ' : '集合住宅のみ';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{capacityLabel}</td>
                        <td className="px-5 py-3 text-center text-sm font-mono text-indigo-600">
                          {item.priceAddon > 0 ? `+¥${item.priceAddon.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                            {item.isActive ? '有効' : '無効'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                          <button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                        </td>
                      </tr>
                    );
                  })}
                  {tab === 'distributionMethod' && distributionMethods.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">配布方法がありません</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

        {/* 面接スロット設定タブ */}
        {tab === 'interviewSlot' && (<DefaultSlotSettings />)}

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-slate-800 text-lg">
                {showModal === 'create' ? '追加' : '編集'} — {tabs.find(t => t.key === tab)?.label}
              </h2>
              <button onClick={() => setShowModal(null)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                <i className="bi bi-x text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* 部署 */}
              {tab === 'department' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">コード <span className="text-slate-400 font-normal text-xs">（任意）</span></label>
                    <input type="text" value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value }))} className={inp + ' font-mono'} placeholder="例: DEV, SALES" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">部署名 <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 営業部, 開発部" />
                  </div>
                </>
              )}

              {/* 業種 */}
              {tab === 'industry' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">業種名 <span className="text-rose-500">*</span></label>
                  <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 飲食, 不動産, 医療" />
                </div>
              )}

              {/* 国 */}
              {tab === 'country' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">国コード <span className="text-rose-500">*</span></label>
                      <input type="text" required maxLength={2} value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value.toUpperCase() }))} className={inp + ' font-mono uppercase'} placeholder="JP, US" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">表示順</label>
                      <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">国名（日本語） <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 日本" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">国名（英語）<span className="text-slate-400 font-normal text-xs ml-1">（任意）</span></label>
                    <input type="text" value={form.nameEn || ''} onChange={e => setForm((p: any) => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="例: Japan" />
                  </div>
                </>
              )}

              {/* 在留資格 */}
              {tab === 'visaType' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">在留資格名 <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 特定技能1号" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">表示順</label>
                    <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                  </div>
                </>
              )}

              {/* 銀行 */}
              {tab === 'bank' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">金融機関コード <span className="text-rose-500">*</span></label>
                      <input type="text" required value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value }))} className={inp + ' font-mono'} placeholder="例: 0001" maxLength={10} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">表示順</label>
                      <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">銀行名 <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: みずほ銀行" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">銀行名（カナ）<span className="text-slate-400 font-normal text-xs ml-1">（任意）</span></label>
                    <input type="text" value={form.nameKana || ''} onChange={e => setForm((p: any) => ({ ...p, nameKana: e.target.value }))} className={inp} placeholder="例: ミズホギンコウ" />
                  </div>
                </>
              )}

              {/* 配布方法 */}
              {tab === 'distributionMethod' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">配布方法名 <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 軒並み配布" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">集計対象世帯 <span className="text-rose-500">*</span></label>
                    <select value={form.capacityType || 'all'} onChange={e => setForm((p: any) => ({ ...p, capacityType: e.target.value }))} className={inp}>
                      <option value="all">全世帯（軒並み）</option>
                      <option value="detached">戸建のみ</option>
                      <option value="apartment">集合住宅のみ</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">配布可能世帯数の算出に使う世帯の種類を指定します。</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">単価加算（円/枚）</label>
                      <input type="number" step="0.01" value={form.priceAddon ?? 0} onChange={e => setForm((p: any) => ({ ...p, priceAddon: e.target.value }))} className={inp} placeholder="0.00" />
                      <p className="text-[10px] text-slate-400 mt-1">エリア単価への加算額。0で加算なし。</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">表示順</label>
                      <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="isActive" checked={form.isActive ?? true} onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                    <label htmlFor="isActive" className="text-sm font-bold text-slate-700 cursor-pointer">有効（ポータルで選択可能）</label>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(null)} className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm disabled:opacity-50">
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
