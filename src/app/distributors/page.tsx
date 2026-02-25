'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';

type Distributor = any;
type FormTab = 'basic' | 'contract' | 'bank' | 'rate';

const FORM_TABS: { key: FormTab; label: string; icon: string }[] = [
  { key: 'basic',    label: '基本情報',    icon: 'bi-person-fill' },
  { key: 'contract', label: '在留・契約',  icon: 'bi-file-earmark-text-fill' },
  { key: 'bank',     label: '口座情報',    icon: 'bi-bank2' },
  { key: 'rate',     label: 'レート・評価', icon: 'bi-graph-up' },
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

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';
const selectCls = inputCls + ' cursor-pointer';
const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-xs font-bold text-slate-600 mb-1">
    {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
  </label>
);

export default function DistributorPage() {
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

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formTab, setFormTab] = useState<FormTab>('basic');

  // コンボボックス用
  const [countryInputText, setCountryInputText] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [bankInputText, setBankInputText] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

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

  const filteredDistributors = useMemo(() => {
    return distributors.filter(d => {
      if (filterStatus === 'ACTIVE' && d.leaveDate) return false;
      if (filterStatus === 'INACTIVE' && !d.leaveDate) return false;
      if (filterBranchId && d.branchId?.toString() !== filterBranchId) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!(d.name?.toLowerCase().includes(q) || d.staffId?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [distributors, searchTerm, filterStatus, filterBranchId]);

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
      showToast('日本国籍以外の場合、在留資格は必須です', 'warning'); return;
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
    } catch { showToast('保存に失敗しました', 'error'); }
  };

  const resetPassword = async () => {
    if (!currentId) return;
    if (!formData.birthday) { showToast('パスワードリセットには生年月日の入力が必要です', 'warning'); return; }
    if (!await showConfirm('パスワードを生年月日（YYYYMMDD）にリセットしますか？', { variant: 'warning', title: 'パスワードリセット', confirmLabel: 'リセットする' })) return;
    try {
      const res = await fetch(`/api/distributors/${currentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, resetPassword: true }),
      });
      if (!res.ok) throw new Error();
      showToast('パスワードをリセットしました', 'success');
    } catch { showToast('リセットに失敗しました', 'error'); }
  };

  const del = async () => {
    if (!currentId) return;
    try {
      await fetch(`/api/distributors/${currentId}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      loadData();
    } catch { showToast('削除に失敗しました', 'error'); }
  };

  const curTabIdx = FORM_TABS.findIndex(t => t.key === formTab);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-bicycle text-emerald-600"></i> 配布員管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">ポスティングスタッフの情報と契約を管理します。</p>
        </div>
        <button
          onClick={() => openForm()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-md flex items-center gap-2 transition-colors"
        >
          <i className="bi bi-plus-lg"></i> 新規スタッフ登録
        </button>
      </div>

      {/* 検索フィルター */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">キーワード検索</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              placeholder="名前 または スタッフID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">ステータス</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
            <option value="ACTIVE">在籍中</option>
            <option value="INACTIVE">退社済</option>
            <option value="ALL">すべて</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">支店</label>
          <select value={filterBranchId} onChange={e => setFilterBranchId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
            <option value="">すべて</option>
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
              <th className="px-6 py-4">ID / 氏名</th>
              <th className="px-6 py-4">支店 / ランク</th>
              <th className="px-6 py-4">国籍 / 在留資格</th>
              <th className="px-6 py-4">在籍状態</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">読み込み中...</td></tr>
            ) : filteredDistributors.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">該当するスタッフがいません</td></tr>
            ) : filteredDistributors.map(d => (
              <tr
                key={d.id}
                onClick={() => router.push(`/distributors/${d.id}`)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="font-mono text-xs text-slate-400">{d.staffId}</div>
                  <div className="font-bold text-slate-800">{d.name}</div>
                  {d.email && <div className="text-xs text-slate-400">{d.email}</div>}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div>{d.branch ? d.branch.nameJa : '—'}</div>
                  <div className="text-xs font-bold text-emerald-600">Rank: {d.rank || '—'}</div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="font-bold text-slate-700">{d.country ? d.country.name : '—'}</div>
                  <div className="text-xs text-slate-500">{d.visaType ? d.visaType.name : 'ビザ未確認'}</div>
                </td>
                <td className="px-6 py-4">
                  {d.leaveDate
                    ? <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">退社済</span>
                    : <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">在籍中</span>}
                </td>
                <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openForm(d)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                    <i className="bi bi-pencil-square"></i>
                  </button>
                  <button onClick={() => { setCurrentId(d.id); setIsDeleteModalOpen(true); }} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* ====== 登録・編集モーダル ====== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

            {/* ヘッダー */}
            <div className="px-6 pt-5 pb-0 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">
                    {currentId ? 'スタッフ情報編集' : '新規スタッフ登録'}
                  </h3>
                  {currentId && <p className="text-xs text-slate-400 mt-0.5">{formData.staffId} — {formData.name}</p>}
                </div>
                <button onClick={() => setIsFormModalOpen(false)}
                  className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-colors">
                  <i className="bi bi-x text-lg"></i>
                </button>
              </div>
              <div className="flex gap-0">
                {FORM_TABS.map(t => (
                  <button key={t.key} type="button" onClick={() => setFormTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                      formTab === t.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}>
                    <i className={`bi ${t.icon}`}></i>{t.label}
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
                        <Label required>スタッフID</Label>
                        <input required name="staffId" value={formData.staffId} onChange={handleInputChange}
                          className={inputCls} placeholder="例: MBF1001" />
                      </div>
                      <div>
                        <Label>支店</Label>
                        <select name="branchId" value={formData.branchId} onChange={handleInputChange} className={selectCls}>
                          <option value="">— 未選択 —</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label required>氏名</Label>
                      <input required name="name" value={formData.name} onChange={handleInputChange}
                        className={inputCls} placeholder="例: 山田 太郎" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label required>メールアドレス</Label>
                        <input required type="email" name="email" value={formData.email} onChange={handleInputChange}
                          className={inputCls} placeholder="example@mail.com" />
                      </div>
                      <div>
                        <Label>電話番号</Label>
                        <input name="phone" value={formData.phone}
                          onChange={e => handlePhoneChange(e.target.value, v => setFormData(p => ({ ...p, phone: v })))}
                          className={inputCls} placeholder="090-1234-5678" maxLength={13} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>誕生日</Label>
                        <input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange}
                          className={inputCls} />
                        {!formData.birthday && (
                          <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                            <i className="bi bi-info-circle"></i>生年月日を設定するとパスワードが自動生成されます
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>性別</Label>
                        <select name="gender" value={formData.gender} onChange={handleInputChange} className={selectCls}>
                          <option value="">— 未選択 —</option>
                          <option value="男性">男性</option>
                          <option value="女性">女性</option>
                          <option value="その他">その他</option>
                        </select>
                      </div>
                    </div>

                    {/* 国籍コンボボックス */}
                    <div>
                      <Label>国籍</Label>
                      <div className="relative">
                        <input type="text" value={countryInputText}
                          onChange={e => {
                            setCountryInputText(e.target.value);
                            setShowCountryDropdown(true);
                            if (!e.target.value) setFormData(p => ({ ...p, countryId: '' }));
                          }}
                          onFocus={() => setShowCountryDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCountryDropdown(false), 150)}
                          className={inputCls} placeholder="国名を入力して検索..." autoComplete="off" />
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
                          <i className="bi bi-info-circle"></i>外国籍の場合、在留資格の入力が必須です（「在留・契約」タブ）
                        </p>
                      )}
                    </div>

                    {/* 住所 */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <i className="bi bi-geo-alt-fill text-emerald-500"></i>住所
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>郵便番号</Label>
                          <input name="postalCode" value={formData.postalCode}
                            onChange={e => handlePostalInput(
                              e.target.value,
                              v => setFormData(p => ({ ...p, postalCode: v })),
                              v => setFormData(p => ({ ...p, address: v })),
                            )}
                            className={inputCls} placeholder="例: 104-0061" maxLength={8} />
                        </div>
                        <div className="flex items-end">
                          <p className="text-xs text-slate-400 pb-2">7桁入力で自動入力</p>
                        </div>
                      </div>
                      <div>
                        <Label>都道府県・市区町村・番地</Label>
                        <input name="address" value={formData.address} onChange={handleInputChange}
                          className={inputCls} placeholder="例: 東京都中央区銀座1-1-1" />
                      </div>
                      <div>
                        <Label>建物名・部屋番号</Label>
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
                          在留資格{isNonJapanese && <span className="text-[10px] text-blue-600 font-normal ml-1">（外国籍のため必須）</span>}
                        </Label>
                        <select
                          name="visaTypeId"
                          value={formData.visaTypeId}
                          onChange={handleInputChange}
                          className={selectCls}
                          required={isNonJapanese}
                        >
                          <option value="">— 未選択 —</option>
                          {visaTypes.map(vt => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>ビザ有効期限</Label>
                        <input type="date" name="visaExpiryDate" value={formData.visaExpiryDate} onChange={handleInputChange}
                          className={inputCls} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>入社日</Label>
                        <input type="date" name="joinDate" value={formData.joinDate} onChange={handleInputChange}
                          className={inputCls} />
                      </div>
                      <div>
                        <Label>退社日</Label>
                        <input type="date" name="leaveDate" value={formData.leaveDate} onChange={handleInputChange}
                          className={inputCls} />
                      </div>
                    </div>

                    <div>
                      <Label>退社理由</Label>
                      <textarea name="leaveReason" value={formData.leaveReason} onChange={handleInputChange}
                        className={inputCls + ' resize-none'} rows={3} placeholder="退社の理由を入力..." />
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-slate-500 mb-3">確認事項</p>
                      {[
                        { name: 'hasAgreedPersonalInfo', label: '個人情報同意書を取得済み' },
                        { name: 'hasSignedContract',     label: '業務委託契約書を締結済み' },
                        { name: 'hasResidenceCard',      label: '在留カードを確認済み' },
                      ].map(item => (
                        <label key={item.name} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name={item.name} checked={(formData as any)[item.name]}
                            onChange={handleInputChange} className="w-4 h-4 accent-emerald-600" />
                          <span className="text-sm text-slate-700">{item.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* パスワード情報 */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5 mb-2">
                        <i className="bi bi-shield-lock-fill"></i>ログインパスワード
                      </p>
                      {!currentId ? (
                        <p className="text-xs text-blue-600">
                          登録時に生年月日が設定されている場合、<strong>生年月日（YYYYMMDD）</strong>が初期パスワードとして自動設定されます。
                          初回ログイン時に変更が必要です。
                        </p>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-blue-600">
                            パスワードを生年月日にリセットできます。
                          </p>
                          <button type="button" onClick={resetPassword}
                            className="text-xs font-bold text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <i className="bi bi-arrow-clockwise"></i>パスワードリセット
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
                        <Label>支払方法</Label>
                        <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className={selectCls}>
                          <option value="現金">現金</option>
                          <option value="振込">振込</option>
                        </select>
                      </div>
                      <div>
                        <Label>振込番号</Label>
                        <input name="transferNumber" value={formData.transferNumber} onChange={handleInputChange}
                          className={inputCls} placeholder="管理用振込番号" />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <i className="bi bi-bank2 text-indigo-500"></i>銀行口座
                      </p>

                      {/* 銀行名コンボボックス */}
                      <div>
                        <Label>銀行名</Label>
                        <div className="relative">
                          <input type="text" value={bankInputText}
                            onChange={e => {
                              setBankInputText(e.target.value);
                              setFormData(p => ({ ...p, bankName: e.target.value }));
                              setShowBankDropdown(true);
                            }}
                            onFocus={() => setShowBankDropdown(true)}
                            onBlur={() => setTimeout(() => setShowBankDropdown(false), 150)}
                            className={inputCls} placeholder="銀行名を入力して検索..." autoComplete="off" />
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
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>支店番号</Label>
                          <input name="bankBranchCode" value={formData.bankBranchCode} onChange={handleInputChange}
                            className={inputCls} placeholder="例: 001" />
                        </div>
                        <div>
                          <Label>口座種類</Label>
                          <select name="bankAccountType" value={formData.bankAccountType} onChange={handleInputChange} className={selectCls}>
                            <option value="普通">普通</option>
                            <option value="当座">当座</option>
                          </select>
                        </div>
                        <div>
                          <Label>口座番号</Label>
                          <input name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleInputChange}
                            className={inputCls} placeholder="例: 1234567" />
                        </div>
                        <div>
                          <Label>口座名義</Label>
                          <input name="bankAccountName" value={formData.bankAccountName} onChange={handleInputChange}
                            className={inputCls} placeholder="例: 山田太郎" />
                        </div>
                        <div className="col-span-2">
                          <Label>口座名義（半角カナ）</Label>
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
                        <Label>ランク</Label>
                        <input name="rank" value={formData.rank} onChange={handleInputChange}
                          className={inputCls} placeholder="例: A, B, C" />
                      </div>
                      <div>
                        <Label>レートプラン</Label>
                        <input name="ratePlan" value={formData.ratePlan} onChange={handleInputChange}
                          className={inputCls} placeholder="例: Basic" />
                      </div>
                      <div>
                        <Label>出勤回数</Label>
                        <input type="number" name="attendanceCount" value={formData.attendanceCount} onChange={handleInputChange}
                          className={inputCls} min={0} />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">単価レート（円/枚）</p>
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
                        <Label>交通費</Label>
                        <input name="transportationFee" value={formData.transportationFee} onChange={handleInputChange}
                          className={inputCls} placeholder="例: FULL, 1000" />
                      </div>
                      <div>
                        <Label>研修手当</Label>
                        <input name="trainingAllowance" value={formData.trainingAllowance} onChange={handleInputChange}
                          className={inputCls} placeholder="例: 500" />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">KPI目標</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'minTypes', label: '最低種類数' }, { name: 'maxTypes', label: '最高種類数' },
                          { name: 'minSheets', label: '最低枚数' }, { name: 'maxSheets', label: '最高枚数' },
                        ].map(f => (
                          <div key={f.name}>
                            <Label>{f.label}</Label>
                            <input type="number" name={f.name} value={(formData as any)[f.name]} onChange={handleInputChange}
                              className={inputCls} placeholder="0" />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label>目標金額</Label>
                        <input name="targetAmount" value={formData.targetAmount} onChange={handleInputChange}
                          className={inputCls} placeholder="例: ¥8,000〜¥9,999" />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">稼働・貸与品</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'transportationMethod', label: '移動方法', placeholder: '例: 徒歩、自転車' },
                          { name: 'flyerDeliveryMethod', label: 'チラシ受取方法', placeholder: '例: 事務所受取' },
                          { name: 'equipmentBattery', label: 'バッテリー', placeholder: '' },
                          { name: 'equipmentBag', label: 'カバン', placeholder: '' },
                          { name: 'equipmentMobile', label: '携帯', placeholder: '' },
                        ].map(f => (
                          <div key={f.name}>
                            <Label>{f.label}</Label>
                            <input name={f.name} value={(formData as any)[f.name]} onChange={handleInputChange}
                              className={inputCls} placeholder={f.placeholder} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>備考</Label>
                      <textarea name="note" value={formData.note} onChange={handleInputChange}
                        className={inputCls + ' resize-none'} rows={3} placeholder="特記事項があれば入力..." />
                    </div>
                  </>
                )}
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl">
                <div className="flex gap-1">
                  {FORM_TABS.map(t => (
                    <button key={t.key} type="button" onClick={() => setFormTab(t.key)}
                      className={`h-2 rounded-full transition-all ${formTab === t.key ? 'bg-emerald-500 w-5' : 'bg-slate-300 w-2'}`} />
                  ))}
                </div>
                <div className="flex gap-3">
                  {curTabIdx > 0 && (
                    <button type="button" onClick={() => setFormTab(FORM_TABS[curTabIdx - 1].key)}
                      className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5">
                      <i className="bi bi-chevron-left"></i> 前へ
                    </button>
                  )}
                  {curTabIdx < FORM_TABS.length - 1 ? (
                    <button type="button" onClick={() => setFormTab(FORM_TABS[curTabIdx + 1].key)}
                      className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5">
                      次へ <i className="bi bi-chevron-right"></i>
                    </button>
                  ) : (
                    <button type="submit"
                      className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5">
                      <i className="bi bi-check2"></i>{currentId ? '更新する' : '登録する'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center max-w-sm w-full mx-4">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-rose-500 text-xl"></i>
            </div>
            <p className="font-bold text-slate-800 mb-1">スタッフを削除しますか？</p>
            <p className="text-sm text-slate-500 mb-5">この操作は取り消せません。</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors">
                キャンセル
              </button>
              <button onClick={del}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm transition-colors">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
