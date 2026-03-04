'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

type Distributor = any;
type FormTab = 'basic' | 'contract' | 'bank' | 'rate';

const FORM_TABS: { key: FormTab; labelKey: string; icon: string }[] = [
  { key: 'basic',    labelKey: 'tab_basic',    icon: 'bi-person-fill' },
  { key: 'contract', labelKey: 'tab_contract',  icon: 'bi-file-earmark-text-fill' },
  { key: 'bank',     labelKey: 'tab_bank',    icon: 'bi-bank2' },
  { key: 'rate',     labelKey: 'tab_rate', icon: 'bi-graph-up' },
];

async function lookupPostalCode(digits: string): Promise<{ address: string } | null> {
  if (digits.length !== 7) return null;
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
    const data = await res.json();
    if (data.results?.[0]) {
      const r = data.results[0];
      return { address: `${r.address1}${r.address2}${r.address3}` };
    }
  } catch { /* ignore */ }
  return null;
}

function handlePostalInput(
  raw: string,
  setPostal: (v: string) => void,
  setAddress: (v: string) => void,
) {
  const digits = raw.replace(/[^\d]/g, '').slice(0, 7);
  if (digits.length < 7) {
    setPostal(digits.length >= 4 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits);
    return;
  }
  setPostal(`${digits.slice(0, 3)}-${digits.slice(3)}`);
  lookupPostalCode(digits).then(r => { if (r) setAddress(r.address); });
}

const todayStr = () => new Date().toISOString().split('T')[0];

// ゆうちょ銀行：記号番号 → 支店番号・口座番号 変換
function convertYuchoNumber(kigo: string, bango: string): { branchCode: string; accountNumber: string } | null {
  if (!kigo || kigo.length < 3) return null;
  const mid = parseInt(kigo.substring(1, 3), 10);
  if (isNaN(mid)) return null;
  const branchCode = String(mid * 10 + 8).padStart(3, '0');
  const accountNumber = kigo.startsWith('1') ? bango.slice(0, -1) : bango;
  return { branchCode, accountNumber };
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';
const selectCls = inputCls + ' cursor-pointer';
const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-xs font-bold text-slate-600 mb-1">
    {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
  </label>
);

export default function DistributorPage() {
  const { t } = useTranslation('distributors');
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [sortKey, setSortKey] = useState<'id' | 'code' | 'branch' | 'rank' | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formTab, setFormTab] = useState<FormTab>('basic');

  // コンボボックス用
  const [countryInputText, setCountryInputText] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [bankInputText, setBankInputText] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // ゆうちょ変換モーダル
  const [showYuchoModal, setShowYuchoModal] = useState(false);
  const [yuchoKigo, setYuchoKigo] = useState('');
  const [yuchoBango, setYuchoBango] = useState('');

  const initialForm = {
    staffId: '', name: '', branchId: '', phone: '', email: '',
    birthday: '', gender: '', countryId: '',
    postalCode: '', address: '', buildingName: '',
    visaTypeId: '', visaExpiryDate: '',
    hasAgreedPersonalInfo: false, hasSignedContract: false, hasResidenceCard: false,
    joinDate: todayStr(), leaveDate: '', leaveReason: '',
    paymentMethod: '現金', bankName: '', bankBranchCode: '',
    bankAccountType: '普通', bankAccountNumber: '', bankAccountName: '',
    bankAccountNameKana: '', transferNumber: '',
    equipmentBattery: '', equipmentBag: '', equipmentMobile: '',
    flyerDeliveryMethod: '', transportationMethod: '',
    ratePlan: '', rate1Type: '', rate2Type: '', rate3Type: '',
    rate4Type: '', rate5Type: '', rate6Type: '',
    transportationFee: '', trainingAllowance: '',
    rank: '', attendanceCount: '0',
    minTypes: '', maxTypes: '', minSheets: '', maxSheets: '',
    targetAmount: '', note: '',
  };
  const [formData, setFormData] = useState(initialForm);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [distRes, branchRes, countryRes, visaRes, bankRes] = await Promise.all([
        fetch('/api/distributors'),
        fetch('/api/branches'),
        fetch('/api/countries'),
        fetch('/api/visa-types'),
        fetch('/api/banks'),
      ]);
      const [distData, branchData, countryData, visaData, bankData] = await Promise.all([
        distRes.json(), branchRes.json(), countryRes.json(), visaRes.json(), bankRes.json(),
      ]);
      setDistributors(Array.isArray(distData) ? distData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
      setCountries(Array.isArray(countryData) ? countryData : []);
      setVisaTypes(Array.isArray(visaData) ? visaData : []);
      setBanks(Array.isArray(bankData) ? bankData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // 日本のcountryId を特定
  const japanId = useMemo(() => countries.find(c => c.code === 'JP')?.id?.toString() || '', [countries]);
  const isNonJapanese = !!formData.countryId && formData.countryId !== japanId;

  const filteredCountrySuggestions = useMemo(() => {
    if (!countryInputText.trim()) return [];
    const q = countryInputText.toLowerCase();
    return countries.filter(c =>
      c.name.toLowerCase().includes(q) || (c.nameEn && c.nameEn.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [countries, countryInputText]);

  const filteredBankSuggestions = useMemo(() => {
    if (!bankInputText.trim()) return [];
    const q = bankInputText.toLowerCase();
    return banks.filter(b =>
      b.name.toLowerCase().includes(q) || (b.nameKana && b.nameKana.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [banks, bankInputText]);

  const isYuchoSelected = formData.bankName.includes('ゆうちょ');
  const yuchoPreview = useMemo(
    () => yuchoKigo.length >= 3 && yuchoBango ? convertYuchoNumber(yuchoKigo, yuchoBango) : null,
    [yuchoKigo, yuchoBango],
  );

  const filteredDistributors = useMemo(() => {
    const RANK_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
    const list = distributors.filter(d => {
      if (filterStatus === 'ACTIVE' && d.leaveDate) return false;
      if (filterStatus === 'INACTIVE' && !d.leaveDate) return false;
      if (filterBranchId && d.branchId?.toString() !== filterBranchId) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!(d.name?.toLowerCase().includes(q) || d.staffId?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    if (sortKey) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'id') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        } else if (sortKey === 'code') {
          cmp = (a.staffId || '').localeCompare(b.staffId || '', 'ja');
        } else if (sortKey === 'branch') {
          const aName = a.branch?.nameJa || '';
          const bName = b.branch?.nameJa || '';
          cmp = aName.localeCompare(bName, 'ja');
        } else if (sortKey === 'rank') {
          const aR = RANK_ORDER[a.rank] ?? 99;
          const bR = RANK_ORDER[b.rank] ?? 99;
          cmp = aR - bR;
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return list;
  }, [distributors, searchTerm, filterStatus, filterBranchId, sortKey, sortDir]);

  const handleSort = (key: 'id' | 'code' | 'branch' | 'rank') => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <i className="bi bi-chevron-expand text-slate-300 ml-1 text-[10px]"></i>;
    return sortDir === 'asc'
      ? <i className="bi bi-caret-up-fill text-emerald-500 ml-1 text-[10px]"></i>
      : <i className="bi bi-caret-down-fill text-emerald-500 ml-1 text-[10px]"></i>;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setFormData(prev => ({ ...prev, [target.name]: value }));
  };

  const openForm = (d?: Distributor) => {
    setFormTab('basic');
    if (d) {
      setCurrentId(d.id);
      setFormData({
        ...initialForm,
        ...d,
        branchId: d.branchId?.toString() || '',
        countryId: d.countryId?.toString() || '',
        visaTypeId: d.visaTypeId?.toString() || '',
        postalCode: d.postalCode || '',
        address: d.address || '',
        buildingName: d.buildingName || '',
        birthday: d.birthday ? d.birthday.split('T')[0] : '',
        visaExpiryDate: d.visaExpiryDate ? d.visaExpiryDate.split('T')[0] : '',
        joinDate: d.joinDate ? d.joinDate.split('T')[0] : todayStr(),
        leaveDate: d.leaveDate ? d.leaveDate.split('T')[0] : '',
        rate1Type: d.rate1Type?.toString() || '',
        rate2Type: d.rate2Type?.toString() || '',
        rate3Type: d.rate3Type?.toString() || '',
        attendanceCount: d.attendanceCount?.toString() || '0',
        bankName: d.bankName || '',
      });
      setCountryInputText(d.country?.name || '');
      setBankInputText(d.bankName || '');
    } else {
      setCurrentId(null);
      setFormData(initialForm);
      setCountryInputText('');
      setBankInputText('');
    }
    setShowCountryDropdown(false);
    setShowBankDropdown(false);
    setIsFormModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // 外国籍の場合は在留資格必須
    if (isNonJapanese && !formData.visaTypeId) {
      setFormTab('contract');
      showToast(t('visa_required_warning'), 'warning'); return;
    }
    try {
      const method = currentId ? 'PUT' : 'POST';
      const url = currentId ? `/api/distributors/${currentId}` : '/api/distributors';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Error');
      setIsFormModalOpen(false);
      loadData();
    } catch { showToast(t('save_error'), 'error'); }
  };

  const resetPassword = async () => {
    if (!currentId) return;
    if (!formData.birthday) { showToast(t('password_reset_birthday_required'), 'warning'); return; }
    if (!await showConfirm(t('password_reset_confirm'), { variant: 'warning', title: t('password_reset_title'), confirmLabel: t('reset') })) return;
    try {
      const res = await fetch(`/api/distributors/${currentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, resetPassword: true }),
      });
      if (!res.ok) throw new Error();
      showToast(t('password_reset_success'), 'success');
    } catch { showToast(t('password_reset_error'), 'error'); }
  };

  const del = async () => {
    if (!currentId) return;
    try {
      await fetch(`/api/distributors/${currentId}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      loadData();
    } catch { showToast(t('delete_error'), 'error'); }
  };

  const curTabIdx = FORM_TABS.findIndex(t => t.key === formTab);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => openForm()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-colors"
        >
          <i className="bi bi-plus-lg"></i> {t('btn_new_staff')}
        </button>
      </div>

      {/* 検索フィルター */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_keyword')}</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
            <option value="ACTIVE">{t('status_active')}</option>
            <option value="INACTIVE">{t('status_inactive')}</option>
            <option value="ALL">{t('status_all')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_branch')}</label>
          <select value={filterBranchId} onChange={e => setFilterBranchId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
            <option value="">{t('status_all')}</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
          </select>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 cursor-pointer select-none hover:text-emerald-600 transition-colors" onClick={() => handleSort('code')}>{t('th_id_name')}<SortIcon col="code" /></th>
              <th className="px-5 py-3 cursor-pointer select-none hover:text-emerald-600 transition-colors" onClick={() => handleSort('branch')}>{t('th_branch')}<SortIcon col="branch" /></th>
              <th className="px-5 py-3 text-center cursor-pointer select-none hover:text-emerald-600 transition-colors" onClick={() => handleSort('rank')}>{t('th_rank')}<SortIcon col="rank" /></th>
              <th className="px-5 py-3 text-center">{t('th_score')}</th>
              <th className="px-5 py-3 text-center">{t('th_monthly_attendance')}</th>
              <th className="px-5 py-3">{t('th_nationality')}</th>
              <th className="px-5 py-3 text-center">{t('th_status')}</th>
              <th className="px-5 py-3 text-right">{t('th_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">{t('loading')}</td></tr>
            ) : filteredDistributors.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-400">{t('no_results')}</td></tr>
            ) : filteredDistributors.map(d => {
              const rankColorMap: Record<string, string> = { S: 'bg-yellow-500', A: 'bg-blue-500', B: 'bg-green-500', C: 'bg-slate-400', D: 'bg-red-400' };
              const monthlyAttendance = d._count?.schedules ?? 0;
              return (
              <tr
                key={d.id}
                onClick={() => router.push(`/distributors/${d.id}`)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-5 py-3">
                  <div className="font-mono text-[10px] text-slate-400">{d.staffId}</div>
                  <div className="font-bold text-sm text-slate-800">{d.name}</div>
                  {d.email && <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{d.email}</div>}
                </td>
                <td className="px-5 py-3 text-sm text-slate-700">
                  {d.branch ? d.branch.nameJa : '—'}
                </td>
                <td className="px-5 py-3 text-center">
                  {d.rank ? (
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black text-white ${rankColorMap[d.rank] || 'bg-slate-300'}`}>
                      {d.rank}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {d.currentScore != null ? (() => {
                    const score = d.currentScore as number;
                    const pct = Math.min(Math.max(score, 0), 100);
                    const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : pct >= 40 ? 'bg-orange-400' : 'bg-rose-500';
                    const textColor = pct >= 80 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : pct >= 40 ? 'text-orange-700' : 'text-rose-700';
                    return (
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${textColor} tabular-nums w-8 text-right`}>{score}</span>
                      </div>
                    );
                  })() : (
                    <span className="text-sm text-slate-400 text-center block">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  <span className="text-sm font-bold text-slate-700">{monthlyAttendance}</span>
                  <span className="text-[10px] text-slate-400 ml-0.5">{t('days_unit')}</span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-700">
                  {d.country ? d.country.name : '—'}
                </td>
                <td className="px-5 py-3 text-center">
                  {d.leaveDate
                    ? <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">{t('status_inactive')}</span>
                    : <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">{t('status_active')}</span>}
                </td>
                <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openForm(d)} className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors">
                    <i className="bi bi-pencil-square"></i>
                  </button>
                  <button onClick={() => { setCurrentId(d.id); setIsDeleteModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* ====== 登録・編集モーダル ====== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

            {/* ヘッダー */}
            <div className="px-6 pt-5 pb-0 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">
                    {currentId ? t('modal_edit_title') : t('modal_new_title')}
                  </h3>
                  {currentId && <p className="text-xs text-slate-400 mt-0.5">{formData.staffId} — {formData.name}</p>}
                </div>
                <button onClick={() => setIsFormModalOpen(false)}
                  className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors">
                  <i className="bi bi-x text-lg"></i>
                </button>
              </div>
              <div className="flex gap-0">
                {FORM_TABS.map(ft => (
                  <button key={ft.key} type="button" onClick={() => setFormTab(ft.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                      formTab === ft.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}>
                    <i className={`bi ${ft.icon}`}></i>{t(ft.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* ===== TAB 1: 基本情報 ===== */}
                {formTab === 'basic' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label required>{t('label_staff_id')}</Label>
                        <input required name="staffId" value={formData.staffId} onChange={handleInputChange}
                          className={inputCls} placeholder="例: MBF1001" />
                      </div>
                      <div>
                        <Label>{t('label_branch')}</Label>
                        <select name="branchId" value={formData.branchId} onChange={handleInputChange} className={selectCls}>
                          <option value="">{t('label_unselected')}</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label required>{t('label_name')}</Label>
                      <input required name="name" value={formData.name} onChange={handleInputChange}
                        className={inputCls} placeholder="例: 山田 太郎" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label required>{t('label_email')}</Label>
                        <input required type="email" name="email" value={formData.email} onChange={handleInputChange}
                          className={inputCls} placeholder="example@mail.com" />
                      </div>
                      <div>
                        <Label>{t('label_phone')}</Label>
                        <input name="phone" value={formData.phone}
                          onChange={e => handlePhoneChange(e.target.value, v => setFormData(p => ({ ...p, phone: v })))}
                          className={inputCls} placeholder="090-1234-5678" maxLength={13} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t('label_birthday')}</Label>
                        <input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange}
                          className={inputCls} />
                        {!formData.birthday && (
                          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                            <i className="bi bi-info-circle"></i>{t('birthday_password_hint')}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>{t('label_gender')}</Label>
                        <select name="gender" value={formData.gender} onChange={handleInputChange} className={selectCls}>
                          <option value="">{t('label_unselected')}</option>
                          <option value="男性">{t('gender_male')}</option>
                          <option value="女性">{t('gender_female')}</option>
                          <option value="その他">{t('gender_other')}</option>
                        </select>
                      </div>
                    </div>

                    {/* 国籍コンボボックス */}
                    <div>
                      <Label>{t('label_nationality')}</Label>
                      <div className="relative">
                        <input type="text" value={countryInputText}
                          onChange={e => {
                            setCountryInputText(e.target.value);
                            setShowCountryDropdown(true);
                            if (!e.target.value) setFormData(p => ({ ...p, countryId: '' }));
                          }}
                          onFocus={() => setShowCountryDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCountryDropdown(false), 150)}
                          className={inputCls} placeholder={t('country_search_placeholder')} autoComplete="off" />
                        {formData.countryId && (
                          <div className="absolute right-3 top-2.5 text-emerald-500 text-sm">
                            <i className="bi bi-check-circle-fill"></i>
                          </div>
                        )}
                        {showCountryDropdown && filteredCountrySuggestions.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                            {filteredCountrySuggestions.map(c => (
                              <button key={c.id} type="button"
                                onMouseDown={() => {
                                  setFormData(p => ({ ...p, countryId: c.id.toString() }));
                                  setCountryInputText(c.name);
                                  setShowCountryDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 text-sm flex items-center gap-3 border-b border-slate-50 last:border-0">
                                <span className="font-bold text-slate-800">{c.name}</span>
                                {c.nameEn && <span className="text-slate-400 text-xs">{c.nameEn}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {isNonJapanese && (
                        <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
                          <i className="bi bi-info-circle"></i>{t('foreign_visa_required')}
                        </p>
                      )}
                    </div>

                    {/* 住所 */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <i className="bi bi-geo-alt-fill text-emerald-500"></i>{t('label_address_section')}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t('label_postal_code')}</Label>
                          <input name="postalCode" value={formData.postalCode}
                            onChange={e => handlePostalInput(
                              e.target.value,
                              v => setFormData(p => ({ ...p, postalCode: v })),
                              v => setFormData(p => ({ ...p, address: v })),
                            )}
                            className={inputCls} placeholder="例: 104-0061" maxLength={8} />
                        </div>
                        <div className="flex items-end">
                          <p className="text-xs text-slate-400 pb-2">{t('postal_auto_fill')}</p>
                        </div>
                      </div>
                      <div>
                        <Label>{t('label_address')}</Label>
                        <input name="address" value={formData.address} onChange={handleInputChange}
                          className={inputCls} placeholder="例: 東京都中央区銀座1-1-1" />
                      </div>
                      <div>
                        <Label>{t('label_building')}</Label>
                        <input name="buildingName" value={formData.buildingName} onChange={handleInputChange}
                          className={inputCls} placeholder="例: ○○マンション 302号室" />
                      </div>
                    </div>
                  </>
                )}

                {/* ===== TAB 2: 在留・契約 ===== */}
                {formTab === 'contract' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label required={isNonJapanese}>
                          {t('label_visa_type')}{isNonJapanese && <span className="text-[10px] text-blue-600 font-normal ml-1">{t('visa_required_foreign')}</span>}
                        </Label>
                        <select
                          name="visaTypeId"
                          value={formData.visaTypeId}
                          onChange={handleInputChange}
                          className={selectCls}
                          required={isNonJapanese}
                        >
                          <option value="">{t('label_unselected')}</option>
                          {visaTypes.map(vt => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>{t('label_visa_expiry')}</Label>
                        <input type="date" name="visaExpiryDate" value={formData.visaExpiryDate} onChange={handleInputChange}
                          className={inputCls} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t('label_join_date')}</Label>
                        <input type="date" name="joinDate" value={formData.joinDate} onChange={handleInputChange}
                          className={inputCls} />
                      </div>
                      <div>
                        <Label>{t('label_leave_date')}</Label>
                        <input type="date" name="leaveDate" value={formData.leaveDate} onChange={handleInputChange}
                          className={inputCls} />
                      </div>
                    </div>

                    <div>
                      <Label>{t('label_leave_reason')}</Label>
                      <textarea name="leaveReason" value={formData.leaveReason} onChange={handleInputChange}
                        className={inputCls + ' resize-none'} rows={3} placeholder={t('leave_reason_placeholder')} />
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-slate-500 mb-3">{t('confirmation_items')}</p>
                      {[
                        { name: 'hasAgreedPersonalInfo', labelKey: 'check_personal_info' },
                        { name: 'hasSignedContract',     labelKey: 'check_contract' },
                        { name: 'hasResidenceCard',      labelKey: 'check_residence_card' },
                      ].map(item => (
                        <label key={item.name} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name={item.name} checked={(formData as any)[item.name]}
                            onChange={handleInputChange} className="w-4 h-4 accent-emerald-600" />
                          <span className="text-sm text-slate-700">{t(item.labelKey)}</span>
                        </label>
                      ))}
                    </div>

                    {/* パスワード情報 */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5 mb-2">
                        <i className="bi bi-shield-lock-fill"></i>{t('password_section')}
                      </p>
                      {!currentId ? (
                        <p className="text-xs text-blue-600" dangerouslySetInnerHTML={{ __html: t('password_new_hint') }} />
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-blue-600">
                            {t('password_reset_hint')}
                          </p>
                          <button type="button" onClick={resetPassword}
                            className="text-xs font-bold text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <i className="bi bi-arrow-clockwise"></i>{t('btn_password_reset')}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ===== TAB 3: 口座情報 ===== */}
                {formTab === 'bank' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t('label_payment_method')}</Label>
                        <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className={selectCls}>
                          <option value="現金">{t('payment_cash')}</option>
                          <option value="振込">{t('payment_transfer')}</option>
                        </select>
                      </div>
                      <div>
                        <Label>{t('label_transfer_number')}</Label>
                        <input name="transferNumber" value={formData.transferNumber} onChange={handleInputChange}
                          className={inputCls} placeholder="管理用振込番号" />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <i className="bi bi-bank2 text-indigo-500"></i>{t('bank_account_section')}
                      </p>

                      {/* 銀行名コンボボックス */}
                      <div>
                        <Label>{t('label_bank_name')}</Label>
                        <div className="relative">
                          <input type="text" value={bankInputText}
                            onChange={e => {
                              setBankInputText(e.target.value);
                              setFormData(p => ({ ...p, bankName: e.target.value }));
                              setShowBankDropdown(true);
                            }}
                            onFocus={() => setShowBankDropdown(true)}
                            onBlur={() => setTimeout(() => setShowBankDropdown(false), 150)}
                            className={inputCls} placeholder={t('bank_search_placeholder')} autoComplete="off" />
                          {showBankDropdown && filteredBankSuggestions.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                              {filteredBankSuggestions.map(b => (
                                <button key={b.id} type="button"
                                  onMouseDown={() => {
                                    setBankInputText(b.name);
                                    setFormData(p => ({ ...p, bankName: b.name }));
                                    setShowBankDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm flex items-center gap-3 border-b border-slate-50 last:border-0">
                                  <span className="font-bold text-slate-800">{b.name}</span>
                                  {b.code && <span className="text-slate-400 text-xs font-mono">{b.code}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* ゆうちょ変換ボタン */}
                        {isYuchoSelected && (
                          <button
                            type="button"
                            onClick={() => { setYuchoKigo(''); setYuchoBango(''); setShowYuchoModal(true); }}
                            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors w-full justify-center"
                          >
                            <i className="bi bi-calculator-fill"></i>
                            {t('yucho_convert_btn')}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t('label_branch_code')}</Label>
                          <input name="bankBranchCode" value={formData.bankBranchCode} onChange={handleInputChange}
                            className={inputCls} placeholder="例: 001" />
                        </div>
                        <div>
                          <Label>{t('label_account_type')}</Label>
                          <select name="bankAccountType" value={formData.bankAccountType} onChange={handleInputChange} className={selectCls}>
                            <option value="普通">{t('account_type_regular')}</option>
                            <option value="当座">{t('account_type_current')}</option>
                          </select>
                        </div>
                        <div>
                          <Label>{t('label_account_number')}</Label>
                          <input name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleInputChange}
                            className={inputCls} placeholder="例: 1234567" />
                        </div>
                        <div>
                          <Label>{t('label_account_name')}</Label>
                          <input name="bankAccountName" value={formData.bankAccountName} onChange={handleInputChange}
                            className={inputCls} placeholder="例: 山田太郎" />
                        </div>
                        <div className="col-span-2">
                          <Label>{t('label_account_name_kana')}</Label>
                          <input name="bankAccountNameKana" value={formData.bankAccountNameKana} onChange={handleInputChange}
                            className={inputCls} placeholder="例: ﾔﾏﾀﾞﾀﾛｳ" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ===== TAB 4: レート・評価 ===== */}
                {formTab === 'rate' && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>{t('label_rank')}</Label>
                        <input name="rank" value={formData.rank} onChange={handleInputChange}
                          className={inputCls} placeholder="例: A, B, C" />
                      </div>
                      <div>
                        <Label>{t('label_rate_plan')}</Label>
                        <input name="ratePlan" value={formData.ratePlan} onChange={handleInputChange}
                          className={inputCls} placeholder="例: Basic" />
                      </div>
                      <div>
                        <Label>{t('label_attendance_count')}</Label>
                        <input type="number" name="attendanceCount" value={formData.attendanceCount} onChange={handleInputChange}
                          className={inputCls} min={0} />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">{t('unit_rate_section')}</p>
                      <div className="grid grid-cols-3 gap-3">
                        {(['rate1Type', 'rate2Type', 'rate3Type'] as const).map((f, i) => (
                          <div key={f}>
                            <Label>{i + 1} Type Rate</Label>
                            <input type="number" step="0.01" name={f} value={(formData as any)[f]} onChange={handleInputChange}
                              className={inputCls} placeholder="0.00" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t('label_transportation_fee')}</Label>
                        <input name="transportationFee" value={formData.transportationFee} onChange={handleInputChange}
                          className={inputCls} placeholder="例: FULL, 1000" />
                      </div>
                      <div>
                        <Label>{t('label_training_allowance')}</Label>
                        <input name="trainingAllowance" value={formData.trainingAllowance} onChange={handleInputChange}
                          className={inputCls} placeholder="例: 500" />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">{t('kpi_targets')}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'minTypes', labelKey: 'label_min_types' }, { name: 'maxTypes', labelKey: 'label_max_types' },
                          { name: 'minSheets', labelKey: 'label_min_sheets' }, { name: 'maxSheets', labelKey: 'label_max_sheets' },
                        ].map(f => (
                          <div key={f.name}>
                            <Label>{t(f.labelKey)}</Label>
                            <input type="number" name={f.name} value={(formData as any)[f.name]} onChange={handleInputChange}
                              className={inputCls} placeholder="0" />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label>{t('label_target_amount')}</Label>
                        <input name="targetAmount" value={formData.targetAmount} onChange={handleInputChange}
                          className={inputCls} placeholder="例: ¥8,000〜¥9,999" />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">{t('operations_equipment')}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'transportationMethod', labelKey: 'label_transport_method', placeholder: '' },
                          { name: 'flyerDeliveryMethod', labelKey: 'label_flyer_delivery', placeholder: '' },
                          { name: 'equipmentBattery', labelKey: 'label_battery', placeholder: '' },
                          { name: 'equipmentBag', labelKey: 'label_bag', placeholder: '' },
                          { name: 'equipmentMobile', labelKey: 'label_mobile', placeholder: '' },
                        ].map(f => (
                          <div key={f.name}>
                            <Label>{t(f.labelKey)}</Label>
                            <input name={f.name} value={(formData as any)[f.name]} onChange={handleInputChange}
                              className={inputCls} placeholder={f.placeholder} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>{t('label_note')}</Label>
                      <textarea name="note" value={formData.note} onChange={handleInputChange}
                        className={inputCls + ' resize-none'} rows={3} placeholder={t('note_placeholder')} />
                    </div>
                  </>
                )}
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl">
                <div className="flex gap-1">
                  {FORM_TABS.map(ft => (
                    <button key={ft.key} type="button" onClick={() => setFormTab(ft.key)}
                      className={`h-2 rounded-full transition-all ${formTab === ft.key ? 'bg-emerald-500 w-5' : 'bg-slate-300 w-2'}`} />
                  ))}
                </div>
                <div className="flex gap-3">
                  {curTabIdx > 0 && (
                    <button type="button" onClick={() => setFormTab(FORM_TABS[curTabIdx - 1].key)}
                      className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5">
                      <i className="bi bi-chevron-left"></i> {t('btn_prev')}
                    </button>
                  )}
                  {curTabIdx < FORM_TABS.length - 1 ? (
                    <button type="button" onClick={() => setFormTab(FORM_TABS[curTabIdx + 1].key)}
                      className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5">
                      {t('btn_next')} <i className="bi bi-chevron-right"></i>
                    </button>
                  ) : (
                    <button type="submit"
                      className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5">
                      <i className="bi bi-check2"></i>{currentId ? t('btn_update') : t('btn_register')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ゆうちょ記号番号変換モーダル */}
      {showYuchoModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* ヘッダー */}
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-black text-amber-800 flex items-center gap-2 text-base">
                <i className="bi bi-calculator-fill text-amber-600"></i>
                {t('yucho_title')}
              </h2>
              <button
                type="button"
                onClick={() => setShowYuchoModal(false)}
                className="w-7 h-7 bg-amber-100 hover:bg-amber-200 rounded-full flex items-center justify-center transition-colors"
              >
                <i className="bi bi-x text-amber-700 text-lg"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('yucho_description') }} />

              {/* 入力欄 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {t('yucho_kigo')} <span className="text-rose-500">*</span>
                    <span className="font-normal text-slate-400 ml-1">{t('yucho_kigo_digits')}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={yuchoKigo}
                    onChange={e => setYuchoKigo(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                    className={inputCls + ' font-mono tracking-widest text-center'}
                    placeholder="10120"
                    maxLength={5}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {t('yucho_bango')} <span className="text-rose-500">*</span>
                    <span className="font-normal text-slate-400 ml-1">{t('yucho_bango_digits')}</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={yuchoBango}
                    onChange={e => setYuchoBango(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
                    className={inputCls + ' font-mono tracking-widest text-center'}
                    placeholder="12345678"
                    maxLength={8}
                  />
                </div>
              </div>

              {/* 変換結果プレビュー */}
              {yuchoPreview ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <i className="bi bi-check-circle-fill"></i>{t('yucho_result')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                      <p className="text-[10px] text-slate-400 mb-1">{t('yucho_result_branch')}</p>
                      <p className="text-2xl font-black text-slate-800 font-mono tracking-wider">{yuchoPreview.branchCode}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                      <p className="text-[10px] text-slate-400 mb-1">{t('yucho_result_account')}</p>
                      <p className="text-2xl font-black text-slate-800 font-mono tracking-wider">{yuchoPreview.accountNumber}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400">
                  <i className="bi bi-arrow-up text-slate-300 block text-lg mb-1"></i>
                  {t('yucho_input_hint')}
                </div>
              )}

              {/* ボタン */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowYuchoModal(false)}
                  className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={!yuchoPreview}
                  onClick={() => {
                    if (!yuchoPreview) return;
                    setFormData(p => ({
                      ...p,
                      bankBranchCode: yuchoPreview.branchCode,
                      bankAccountNumber: yuchoPreview.accountNumber,
                    }));
                    setShowYuchoModal(false);
                    setYuchoKigo('');
                    setYuchoBango('');
                  }}
                  className="flex-1 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <i className="bi bi-check2"></i>{t('btn_apply_form')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center max-w-sm w-full mx-4">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-rose-500 text-xl"></i>
            </div>
            <p className="font-bold text-slate-800 mb-1">{t('delete_confirm')}</p>
            <p className="text-sm text-slate-500 mb-5">{t('delete_irreversible')}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors">
                {t('cancel')}
              </button>
              <button onClick={del}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm transition-colors">
                {t('btn_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
