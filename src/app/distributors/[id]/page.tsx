'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';

type FormTab = 'basic' | 'contract' | 'bank' | 'rate';
const FORM_TABS: { key: FormTab; label: string; icon: string }[] = [
  { key: 'basic',    label: '基本情報',    icon: 'bi-person-fill' },
  { key: 'contract', label: '在留・契約',  icon: 'bi-file-earmark-text-fill' },
  { key: 'bank',     label: '口座情報',    icon: 'bi-bank2' },
  { key: 'rate',     label: 'レート・評価', icon: 'bi-graph-up' },
];

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';
const selectCls = inputCls + ' cursor-pointer';
const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-xs font-bold text-slate-600 mb-1">
    {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
  </label>
);

function InfoRow({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (typeof value === 'boolean') {
    return (
      <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
        <span className="text-xs text-slate-500 w-32 shrink-0 pt-0.5">{label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
          {value ? '確認済 ✓' : '未確認'}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-slate-800 break-words flex-1">{value ?? '—'}</span>
    </div>
  );
}

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
function handlePostalInput(raw: string, setPostal: (v: string) => void, setAddress: (v: string) => void) {
  const digits = raw.replace(/[^\d]/g, '').slice(0, 7);
  if (digits.length < 7) {
    setPostal(digits.length >= 4 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits);
    return;
  }
  setPostal(`${digits.slice(0, 3)}-${digits.slice(3)}`);
  lookupPostalCode(digits).then(r => { if (r) setAddress(r.address); });
}
const todayStr = () => new Date().toISOString().split('T')[0];

export default function DistributorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();

  const [distributor, setDistributor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Master data for edit modal
  const [branches, setBranches] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [resetPwMsg, setResetPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formTab, setFormTab] = useState<FormTab>('basic');
  const [countryInputText, setCountryInputText] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [bankInputText, setBankInputText] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // アプリ配信モーダル
  const [isAppDistOpen, setIsAppDistOpen] = useState(false);
  const [appDistEmail, setAppDistEmail] = useState('');
  const [appDistPlatform, setAppDistPlatform] = useState<'APPLE' | 'ANDROID'>('APPLE');
  const [appDistSending, setAppDistSending] = useState(false);
  const [appDistHistory, setAppDistHistory] = useState<any[]>([]);
  const [appDistHistoryLoading, setAppDistHistoryLoading] = useState(false);
  const [hasAppDistributed, setHasAppDistributed] = useState(false);

  const initialForm = {
    staffId: '', name: '', branchId: '', phone: '', email: '',
    language: 'ja',
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

  const loadDistributor = async () => {
    const res = await fetch(`/api/distributors/${id}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    setDistributor(data);
    setLoading(false);
  };

  // アプリ配信履歴読み込み
  const loadDistHistory = async () => {
    setAppDistHistoryLoading(true);
    try {
      const res = await fetch(`/api/distributors/${id}/app-distribution`);
      if (res.ok) {
        const data = await res.json();
        setAppDistHistory(data);
        setHasAppDistributed(data.some((l: any) => l.status === 'SENT'));
      }
    } catch { /* ignore */ }
    setAppDistHistoryLoading(false);
  };

  const openAppDist = () => {
    setAppDistEmail(distributor?.email || '');
    setAppDistPlatform('APPLE');
    setIsAppDistOpen(true);
    loadDistHistory();
  };

  const sendAppDistribution = async () => {
    if (!appDistEmail) {
      showToast('メールアドレスを入力してください', 'warning');
      return;
    }
    setAppDistSending(true);
    try {
      const res = await fetch(`/api/distributors/${id}/app-distribution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: appDistPlatform, email: appDistEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      showToast(data.message || '送信しました', 'success');
      loadDistHistory();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '送信に失敗しました', 'error');
    }
    setAppDistSending(false);
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/branches').then(r => r.json()),
      fetch('/api/countries').then(r => r.json()),
      fetch('/api/visa-types').then(r => r.json()),
      fetch('/api/banks').then(r => r.json()),
    ]).then(([b, c, v, bk]) => {
      setBranches(Array.isArray(b) ? b : []);
      setCountries(Array.isArray(c) ? c : []);
      setVisaTypes(Array.isArray(v) ? v : []);
      setBanks(Array.isArray(bk) ? bk : []);
    });
    loadDistributor();
    loadDistHistory();
  }, [id]);

  const japanId = useMemo(() => countries.find((c: any) => c.code === 'JP')?.id?.toString() || '', [countries]);
  const isNonJapanese = !!formData.countryId && formData.countryId !== japanId;

  const filteredCountrySuggestions = useMemo(() => {
    if (!countryInputText.trim()) return [];
    const q = countryInputText.toLowerCase();
    return countries.filter((c: any) =>
      c.name.toLowerCase().includes(q) || (c.nameEn && c.nameEn.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [countries, countryInputText]);

  const filteredBankSuggestions = useMemo(() => {
    if (!bankInputText.trim()) return [];
    const q = bankInputText.toLowerCase();
    return banks.filter((b: any) =>
      b.name.toLowerCase().includes(q) || (b.nameKana && b.nameKana.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [banks, bankInputText]);

  const openEdit = () => {
    if (!distributor) return;
    setFormTab('basic');
    setFormData({
      ...initialForm,
      ...distributor,
      branchId: distributor.branchId?.toString() || '',
      language: distributor.language || 'ja',
      countryId: distributor.countryId?.toString() || '',
      visaTypeId: distributor.visaTypeId?.toString() || '',
      postalCode: distributor.postalCode || '',
      address: distributor.address || '',
      buildingName: distributor.buildingName || '',
      birthday: distributor.birthday ? distributor.birthday.split('T')[0] : '',
      visaExpiryDate: distributor.visaExpiryDate ? distributor.visaExpiryDate.split('T')[0] : '',
      joinDate: distributor.joinDate ? distributor.joinDate.split('T')[0] : todayStr(),
      leaveDate: distributor.leaveDate ? distributor.leaveDate.split('T')[0] : '',
      rate1Type: distributor.rate1Type?.toString() || '',
      rate2Type: distributor.rate2Type?.toString() || '',
      rate3Type: distributor.rate3Type?.toString() || '',
      rate4Type: distributor.rate4Type?.toString() || '',
      rate5Type: distributor.rate5Type?.toString() || '',
      rate6Type: distributor.rate6Type?.toString() || '',
      attendanceCount: distributor.attendanceCount?.toString() || '0',
      minTypes: distributor.minTypes?.toString() || '',
      maxTypes: distributor.maxTypes?.toString() || '',
      minSheets: distributor.minSheets?.toString() || '',
      maxSheets: distributor.maxSheets?.toString() || '',
      bankName: distributor.bankName || '',
      phone: distributor.phone || '',
      email: distributor.email || '',
      gender: distributor.gender || '',
      rank: distributor.rank || '',
      ratePlan: distributor.ratePlan || '',
      targetAmount: distributor.targetAmount || '',
      note: distributor.note || '',
      leaveReason: distributor.leaveReason || '',
      transportationFee: distributor.transportationFee || '',
      trainingAllowance: distributor.trainingAllowance || '',
      paymentMethod: distributor.paymentMethod || '現金',
      bankBranchCode: distributor.bankBranchCode || '',
      bankAccountType: distributor.bankAccountType || '普通',
      bankAccountNumber: distributor.bankAccountNumber || '',
      bankAccountName: distributor.bankAccountName || '',
      bankAccountNameKana: distributor.bankAccountNameKana || '',
      transferNumber: distributor.transferNumber || '',
      equipmentBattery: distributor.equipmentBattery || '',
      equipmentBag: distributor.equipmentBag || '',
      equipmentMobile: distributor.equipmentMobile || '',
      flyerDeliveryMethod: distributor.flyerDeliveryMethod || '',
      transportationMethod: distributor.transportationMethod || '',
    });
    setCountryInputText(distributor.country?.name || '');
    setBankInputText(distributor.bankName || '');
    setShowCountryDropdown(false);
    setShowBankDropdown(false);
    setIsEditOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setFormData(prev => ({ ...prev, [target.name]: value }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNonJapanese && !formData.visaTypeId) {
      setFormTab('contract');
      showToast('日本国籍以外の場合、在留資格は必須です', 'warning'); return;
    }
    try {
      const res = await fetch(`/api/distributors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      setIsEditOpen(false);
      loadDistributor();
    } catch { showToast('保存に失敗しました', 'error'); }
  };

  const resetPassword = async () => {
    if (!formData.birthday) { showToast('パスワードリセットには生年月日の入力が必要です', 'warning'); return; }
    if (!await showConfirm('パスワードを生年月日（YYYYMMDD）にリセットしますか？', { variant: 'warning', title: 'パスワードリセット', confirmLabel: 'リセットする' })) return;
    try {
      const res = await fetch(`/api/distributors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, resetPassword: true }),
      });
      if (!res.ok) throw new Error();
      showToast('パスワードをリセットしました', 'success');
    } catch { showToast('リセットに失敗しました', 'error'); }
  };

  const handleResetPassword = async () => {
    setResettingPw(true);
    setResetPwMsg(null);
    try {
      const res = await fetch(`/api/distributors/${id}/reset-password`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setResetPwMsg({ type: 'error', text: data.error || 'リセットに失敗しました' });
      } else {
        setResetPwMsg({ type: 'success', text: 'パスワードをリセットしました。次回ログイン時に新しいパスワードの設定を求めます。' });
        loadDistributor();
      }
    } catch {
      setResetPwMsg({ type: 'error', text: 'リセットに失敗しました' });
    }
    setResettingPw(false);
    setIsResetPasswordOpen(false);
  };

  const del = async () => {
    try {
      await fetch(`/api/distributors/${id}`, { method: 'DELETE' });
      router.push('/distributors');
    } catch { showToast('削除に失敗しました', 'error'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (notFound || !distributor) {
    return (
      <div className="text-center py-20 text-slate-400">
        <i className="bi bi-person-x text-5xl mb-3 block"></i>
        <p className="font-bold text-lg">スタッフが見つかりません</p>
        <Link href="/distributors" className="mt-4 inline-block text-sm text-emerald-600 hover:underline">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  const d = distributor;
  const isActive = !d.leaveDate;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/distributors"
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <i className="bi bi-arrow-left text-xl"></i>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{d.name}</h1>
              {isActive
                ? <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">在籍中</span>
                : <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">退社済</span>}
              {d.isPasswordTemp && (
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-full flex items-center gap-1">
                  <i className="bi bi-key-fill"></i> PW未変更
                </span>
              )}
              {hasAppDistributed && (
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full flex items-center gap-1">
                  <i className="bi bi-phone-fill"></i> アプリ配信済
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 font-mono mt-0.5">{d.staffId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAppDist}
            className="flex items-center gap-2 bg-white hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 border border-indigo-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            <i className="bi bi-phone-fill"></i> 配布アプリ配信
          </button>
          <button
            onClick={() => { setResetPwMsg(null); setIsResetPasswordOpen(true); }}
            className="flex items-center gap-2 bg-white hover:bg-amber-50 text-amber-600 hover:text-amber-700 border border-amber-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            <i className="bi bi-key-fill"></i> PW リセット
          </button>
          <button
            onClick={openEdit}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors"
          >
            <i className="bi bi-pencil-square"></i> 編集
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-500 hover:text-rose-600 border border-rose-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>

      {/* パスワードリセット結果メッセージ */}
      {resetPwMsg && (
        <div className={`p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
          resetPwMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          <i className={`bi ${resetPwMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}></i>
          {resetPwMsg.text}
          <button onClick={() => setResetPwMsg(null)} className="ml-auto text-slate-400 hover:text-slate-600">
            <i className="bi bi-x-lg text-xs"></i>
          </button>
        </div>
      )}

      {/* ─── 基本情報 ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
            <i className="bi bi-person-fill text-emerald-500"></i> 基本情報
          </h2>
          <InfoRow label="氏名" value={d.name} />
          <InfoRow label="スタッフID" value={d.staffId} />
          <InfoRow label="支店" value={d.branch?.nameJa} />
          <InfoRow label="メール" value={d.email} />
          <InfoRow label="電話番号" value={d.phone} />
          <InfoRow label="生年月日" value={d.birthday ? d.birthday.slice(0, 10) : null} />
          <InfoRow label="性別" value={d.gender} />
          <InfoRow label="国籍" value={d.country?.name} />
          <InfoRow label="ポータル言語" value={d.language === 'en' ? '🇬🇧 English' : '🇯🇵 日本語'} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
            <i className="bi bi-geo-alt-fill text-emerald-500"></i> 住所
          </h2>
          <InfoRow label="郵便番号" value={d.postalCode} />
          <InfoRow label="住所" value={d.address} />
          <InfoRow label="建物名" value={d.buildingName} />

          <h2 className="text-sm font-bold text-slate-500 mt-5 mb-3 flex items-center gap-1.5">
            <i className="bi bi-file-earmark-text-fill text-emerald-500"></i> 在留・契約
          </h2>
          <InfoRow label="在留資格" value={d.visaType?.name} />
          <InfoRow label="ビザ有効期限" value={d.visaExpiryDate ? d.visaExpiryDate.slice(0, 10) : null} />
          <InfoRow label="入社日" value={d.joinDate ? d.joinDate.slice(0, 10) : null} />
          <InfoRow label="退社日" value={d.leaveDate ? d.leaveDate.slice(0, 10) : null} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
            <i className="bi bi-shield-check-fill text-emerald-500"></i> 確認事項
          </h2>
          <InfoRow label="個人情報同意" value={d.hasAgreedPersonalInfo} />
          <InfoRow label="業務委託契約" value={d.hasSignedContract} />
          <InfoRow label="在留カード確認" value={d.hasResidenceCard} />

          <h2 className="text-sm font-bold text-slate-500 mt-5 mb-3 flex items-center gap-1.5">
            <i className="bi bi-bank2 text-emerald-500"></i> 口座情報
          </h2>
          <InfoRow label="支払方法" value={d.paymentMethod} />
          <InfoRow label="銀行名" value={d.bankName} />
          <InfoRow label="支店番号" value={d.bankBranchCode} />
          <InfoRow label="口座種類" value={d.bankAccountType} />
          <InfoRow label="口座番号" value={d.bankAccountNumber} />
          <InfoRow label="口座名義" value={d.bankAccountName} />
          <InfoRow label="口座名義(カナ)" value={d.bankAccountNameKana} />
          <InfoRow label="振込番号" value={d.transferNumber} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
            <i className="bi bi-graph-up text-emerald-500"></i> レート・評価
          </h2>
          <InfoRow label="ランク" value={d.rank} />
          <InfoRow label="レートプラン" value={d.ratePlan} />
          <InfoRow label="出勤回数" value={d.attendanceCount} />
          <InfoRow label="1 Type Rate" value={d.rate1Type} />
          <InfoRow label="2 Type Rate" value={d.rate2Type} />
          <InfoRow label="3 Type Rate" value={d.rate3Type} />
          <InfoRow label="交通費" value={d.transportationFee} />
          <InfoRow label="研修手当" value={d.trainingAllowance} />

          <h2 className="text-sm font-bold text-slate-500 mt-5 mb-3 flex items-center gap-1.5">
            <i className="bi bi-tools text-emerald-500"></i> 稼働・貸与品
          </h2>
          <InfoRow label="移動方法" value={d.transportationMethod} />
          <InfoRow label="チラシ受取" value={d.flyerDeliveryMethod} />
          <InfoRow label="バッテリー" value={d.equipmentBattery} />
          <InfoRow label="カバン" value={d.equipmentBag} />
          <InfoRow label="携帯" value={d.equipmentMobile} />
        </div>
      </div>

      {d.note && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
            <i className="bi bi-sticky-fill"></i> 備考
          </p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{d.note}</p>
        </div>
      )}

      {/* ====== 編集モーダル ====== */}
      {isEditOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="px-6 pt-5 pb-0 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">スタッフ情報編集</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{formData.staffId} — {formData.name}</p>
                </div>
                <button onClick={() => setIsEditOpen(false)}
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

                {/* TAB 1: 基本情報 */}
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
                          {branches.map((b: any) => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
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
                        <input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange} className={inputCls} />
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
                    <div>
                      <Label>ポータル言語</Label>
                      <select name="language" value={formData.language} onChange={handleInputChange} className={selectCls}>
                        <option value="ja">🇯🇵 日本語</option>
                        <option value="en">🇬🇧 English</option>
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1 ml-1">ログイン後に誘導されるポータルの言語</p>
                    </div>
                    <div>
                      <Label>国籍</Label>
                      <div className="relative">
                        <input type="text" value={countryInputText}
                          onChange={e => { setCountryInputText(e.target.value); setShowCountryDropdown(true); if (!e.target.value) setFormData(p => ({ ...p, countryId: '' })); }}
                          onFocus={() => setShowCountryDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCountryDropdown(false), 150)}
                          className={inputCls} placeholder="国名を入力して検索..." autoComplete="off" />
                        {formData.countryId && <div className="absolute right-3 top-2.5 text-emerald-500 text-sm"><i className="bi bi-check-circle-fill"></i></div>}
                        {showCountryDropdown && filteredCountrySuggestions.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                            {filteredCountrySuggestions.map((c: any) => (
                              <button key={c.id} type="button"
                                onMouseDown={() => { setFormData(p => ({ ...p, countryId: c.id.toString() })); setCountryInputText(c.name); setShowCountryDropdown(false); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 text-sm flex items-center gap-3 border-b border-slate-50 last:border-0">
                                <span className="font-bold text-slate-800">{c.name}</span>
                                {c.nameEn && <span className="text-slate-400 text-xs">{c.nameEn}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><i className="bi bi-geo-alt-fill text-emerald-500"></i>住所</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>郵便番号</Label>
                          <input name="postalCode" value={formData.postalCode}
                            onChange={e => handlePostalInput(e.target.value, v => setFormData(p => ({ ...p, postalCode: v })), v => setFormData(p => ({ ...p, address: v })))}
                            className={inputCls} placeholder="例: 104-0061" maxLength={8} />
                        </div>
                        <div className="flex items-end"><p className="text-xs text-slate-400 pb-2">7桁入力で自動入力</p></div>
                      </div>
                      <div>
                        <Label>都道府県・市区町村・番地</Label>
                        <input name="address" value={formData.address} onChange={handleInputChange} className={inputCls} />
                      </div>
                      <div>
                        <Label>建物名・部屋番号</Label>
                        <input name="buildingName" value={formData.buildingName} onChange={handleInputChange} className={inputCls} />
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 2: 在留・契約 */}
                {formTab === 'contract' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label required={isNonJapanese}>在留資格{isNonJapanese && <span className="text-[10px] text-blue-600 font-normal ml-1">（外国籍のため必須）</span>}</Label>
                        <select name="visaTypeId" value={formData.visaTypeId} onChange={handleInputChange} className={selectCls} required={isNonJapanese}>
                          <option value="">— 未選択 —</option>
                          {visaTypes.map((vt: any) => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>ビザ有効期限</Label>
                        <input type="date" name="visaExpiryDate" value={formData.visaExpiryDate} onChange={handleInputChange} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>入社日</Label>
                        <input type="date" name="joinDate" value={formData.joinDate} onChange={handleInputChange} className={inputCls} />
                      </div>
                      <div>
                        <Label>退社日</Label>
                        <input type="date" name="leaveDate" value={formData.leaveDate} onChange={handleInputChange} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <Label>退社理由</Label>
                      <textarea name="leaveReason" value={formData.leaveReason} onChange={handleInputChange}
                        className={inputCls + ' resize-none'} rows={3} />
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-slate-500 mb-3">確認事項</p>
                      {[
                        { name: 'hasAgreedPersonalInfo', label: '個人情報同意書を取得済み' },
                        { name: 'hasSignedContract', label: '業務委託契約書を締結済み' },
                        { name: 'hasResidenceCard', label: '在留カードを確認済み' },
                      ].map(item => (
                        <label key={item.name} className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" name={item.name} checked={(formData as any)[item.name]} onChange={handleInputChange} className="w-4 h-4 accent-emerald-600" />
                          <span className="text-sm text-slate-700">{item.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5 mb-2"><i className="bi bi-shield-lock-fill"></i>ログインパスワード</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-600">パスワードを生年月日にリセットできます。</p>
                        <button type="button" onClick={resetPassword}
                          className="text-xs font-bold text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                          <i className="bi bi-arrow-clockwise"></i>パスワードリセット
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 3: 口座情報 */}
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
                        <input name="transferNumber" value={formData.transferNumber} onChange={handleInputChange} className={inputCls} />
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><i className="bi bi-bank2 text-indigo-500"></i>銀行口座</p>
                      <div>
                        <Label>銀行名</Label>
                        <div className="relative">
                          <input type="text" value={bankInputText}
                            onChange={e => { setBankInputText(e.target.value); setFormData(p => ({ ...p, bankName: e.target.value })); setShowBankDropdown(true); }}
                            onFocus={() => setShowBankDropdown(true)}
                            onBlur={() => setTimeout(() => setShowBankDropdown(false), 150)}
                            className={inputCls} placeholder="銀行名を入力して検索..." autoComplete="off" />
                          {showBankDropdown && filteredBankSuggestions.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                              {filteredBankSuggestions.map((b: any) => (
                                <button key={b.id} type="button"
                                  onMouseDown={() => { setBankInputText(b.name); setFormData(p => ({ ...p, bankName: b.name })); setShowBankDropdown(false); }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-sm flex items-center gap-3 border-b border-slate-50 last:border-0">
                                  <span className="font-bold">{b.name}</span>
                                  {b.code && <span className="text-slate-400 text-xs font-mono">{b.code}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>支店番号</Label><input name="bankBranchCode" value={formData.bankBranchCode} onChange={handleInputChange} className={inputCls} /></div>
                        <div>
                          <Label>口座種類</Label>
                          <select name="bankAccountType" value={formData.bankAccountType} onChange={handleInputChange} className={selectCls}>
                            <option value="普通">普通</option><option value="当座">当座</option>
                          </select>
                        </div>
                        <div><Label>口座番号</Label><input name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleInputChange} className={inputCls} /></div>
                        <div><Label>口座名義</Label><input name="bankAccountName" value={formData.bankAccountName} onChange={handleInputChange} className={inputCls} /></div>
                        <div className="col-span-2"><Label>口座名義（半角カナ）</Label><input name="bankAccountNameKana" value={formData.bankAccountNameKana} onChange={handleInputChange} className={inputCls} /></div>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 4: レート・評価 */}
                {formTab === 'rate' && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label>ランク</Label><input name="rank" value={formData.rank} onChange={handleInputChange} className={inputCls} placeholder="例: A, B, C" /></div>
                      <div><Label>レートプラン</Label><input name="ratePlan" value={formData.ratePlan} onChange={handleInputChange} className={inputCls} placeholder="例: Basic" /></div>
                      <div><Label>出勤回数</Label><input type="number" name="attendanceCount" value={formData.attendanceCount} onChange={handleInputChange} className={inputCls} min={0} /></div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">単価レート（円/枚）</p>
                      <div className="grid grid-cols-3 gap-3">
                        {(['rate1Type', 'rate2Type', 'rate3Type'] as const).map((f, i) => (
                          <div key={f}>
                            <Label>{i + 1} Type Rate</Label>
                            <input type="number" step="0.01" name={f} value={(formData as any)[f]} onChange={handleInputChange} className={inputCls} placeholder="0.00" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>交通費</Label><input name="transportationFee" value={formData.transportationFee} onChange={handleInputChange} className={inputCls} placeholder="例: FULL, 1000" /></div>
                      <div><Label>研修手当</Label><input name="trainingAllowance" value={formData.trainingAllowance} onChange={handleInputChange} className={inputCls} /></div>
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
                            <input type="number" name={f.name} value={(formData as any)[f.name] ?? ''} onChange={handleInputChange} className={inputCls} placeholder="0" />
                          </div>
                        ))}
                      </div>
                      <div><Label>目標金額</Label><input name="targetAmount" value={formData.targetAmount} onChange={handleInputChange} className={inputCls} /></div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-slate-500">稼働・貸与品</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'transportationMethod', label: '移動方法' },
                          { name: 'flyerDeliveryMethod', label: 'チラシ受取方法' },
                          { name: 'equipmentBattery', label: 'バッテリー' },
                          { name: 'equipmentBag', label: 'カバン' },
                          { name: 'equipmentMobile', label: '携帯' },
                        ].map(f => (
                          <div key={f.name}>
                            <Label>{f.label}</Label>
                            <input name={f.name} value={(formData as any)[f.name]} onChange={handleInputChange} className={inputCls} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>備考</Label>
                      <textarea name="note" value={formData.note} onChange={handleInputChange}
                        className={inputCls + ' resize-none'} rows={3} />
                    </div>
                  </>
                )}
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 rounded-b-2xl">
                <button type="button" onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
                  キャンセル
                </button>
                <button type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5">
                  <i className="bi bi-check2"></i> 更新する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* パスワードリセット確認モーダル */}
      {isResetPasswordOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center max-w-sm w-full mx-4">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-key-fill text-amber-500 text-xl"></i>
            </div>
            <p className="font-bold text-slate-800 mb-1">パスワードをリセットしますか？</p>
            <p className="text-sm text-slate-500 mb-1">
              パスワードを <span className="font-bold text-slate-700">生年月日（YYYYMMDD）</span> にリセットします。
            </p>
            <p className="text-xs text-slate-400 mb-5">
              次回ログイン時に新しいパスワードの設定を求めます。
            </p>
            {!d.birthday && (
              <p className="text-xs text-rose-500 font-bold mb-4">
                <i className="bi bi-exclamation-triangle-fill mr-1"></i>
                生年月日が未登録です。先に編集画面から登録してください。
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsResetPasswordOpen(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resettingPw || !d.birthday}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {resettingPw ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> リセット中...</>
                ) : (
                  <><i className="bi bi-key-fill"></i> リセットする</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center max-w-sm w-full mx-4">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-rose-500 text-xl"></i>
            </div>
            <p className="font-bold text-slate-800 mb-1">スタッフを削除しますか？</p>
            <p className="text-sm text-slate-500 mb-5">この操作は取り消せません。</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setIsDeleteOpen(false)}
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

      {/* アプリ配信モーダル */}
      {isAppDistOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50" onClick={() => setIsAppDistOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-phone-fill text-indigo-500"></i> 配布アプリ配信
              </h3>
              <button onClick={() => setIsAppDistOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
              {/* プラットフォーム選択 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">プラットフォーム</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAppDistPlatform('APPLE')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                      appDistPlatform === 'APPLE'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <i className="bi bi-apple"></i> Apple (TestFlight)
                  </button>
                  <button
                    onClick={() => setAppDistPlatform('ANDROID')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                      appDistPlatform === 'ANDROID'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <i className="bi bi-google-play"></i> Android (Google Play)
                  </button>
                </div>
              </div>

              {/* メールアドレス入力 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={appDistEmail}
                  onChange={e => setAppDistEmail(e.target.value)}
                  placeholder="tester@example.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {appDistPlatform === 'APPLE'
                    ? 'TestFlight招待メールがこのアドレスに送信されます'
                    : 'Googleグループに追加され、Play Storeから内部テスト版をインストールできます'}
                </p>
              </div>

              {/* 送信ボタン */}
              <button
                onClick={sendAppDistribution}
                disabled={appDistSending || !appDistEmail}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {appDistSending ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 送信中...</>
                ) : (
                  <><i className="bi bi-send-fill"></i> 招待を送信</>
                )}
              </button>

              {/* 配信履歴 */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                  <i className="bi bi-clock-history"></i> 配信履歴
                </h4>
                {appDistHistoryLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : appDistHistory.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">配信履歴はありません</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {appDistHistory.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg text-sm">
                        <div className="shrink-0">
                          {log.status === 'SENT' ? (
                            <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                              <i className="bi bi-check-lg text-xs"></i>
                            </span>
                          ) : log.status === 'FAILED' ? (
                            <span className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                              <i className="bi bi-x-lg text-xs"></i>
                            </span>
                          ) : (
                            <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                              <i className="bi bi-hourglass-split text-xs"></i>
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700 truncate">{log.email}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              log.platform === 'APPLE' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-600'
                            }`}>
                              {log.platform === 'APPLE' ? 'iOS' : 'Android'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span>{new Date(log.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {log.sentBy && <span>by {log.sentBy.lastNameJa}{log.sentBy.firstNameJa}</span>}
                            {log.errorMessage && <span className="text-rose-400 truncate">{log.errorMessage}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
