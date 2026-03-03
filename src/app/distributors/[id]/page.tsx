'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const RANK_COLORS: Record<string, { bg: string; text: string }> = {
  S: { bg: 'bg-yellow-500', text: 'text-white' },
  A: { bg: 'bg-blue-500', text: 'text-white' },
  B: { bg: 'bg-green-500', text: 'text-white' },
  C: { bg: 'bg-gray-400', text: 'text-white' },
  D: { bg: 'bg-red-400', text: 'text-white' },
};

function EvalRankBadge({ rank, size = 'md' }: { rank: string; size?: 'sm' | 'md' | 'lg' }) {
  const c = RANK_COLORS[rank] || RANK_COLORS.C;
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : size === 'lg' ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg';
  return <span className={`inline-flex items-center justify-center rounded-lg font-black ${c.bg} ${c.text} ${sizeClass}`}>{rank}</span>;
}

/* ─── 編集モーダル用（evaluationタブ削除：4タブ構成） ─── */
type FormTab = 'basic' | 'contract' | 'bank' | 'rate';
const FORM_TABS: { key: FormTab; label: string; icon: string }[] = [
  { key: 'basic',    label: '基本情報',     icon: 'bi-person-fill' },
  { key: 'contract', label: '在留・契約',   icon: 'bi-file-earmark-text-fill' },
  { key: 'bank',     label: '口座情報',     icon: 'bi-bank2' },
  { key: 'rate',     label: 'レート・評価', icon: 'bi-graph-up' },
];

/* ─── 詳細画面タブ ─── */
type DetailTab = 'overview' | 'finance' | 'evaluation' | 'schedules' | 'tasks' | 'complaints';
const DETAIL_TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: 'overview',   label: '概要',     icon: 'bi-person-fill' },
  { key: 'finance',    label: '口座・レート', icon: 'bi-bank2' },
  { key: 'evaluation', label: '評価',     icon: 'bi-award' },
  { key: 'schedules',  label: '配布履歴', icon: 'bi-calendar-check' },
  { key: 'tasks',      label: 'タスク',   icon: 'bi-list-task' },
  { key: 'complaints', label: 'クレーム', icon: 'bi-exclamation-triangle' },
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

/* ─── ステータスバッジヘルパー ─── */
function ScheduleStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    UNSTARTED:    { cls: 'bg-slate-100 text-slate-500', label: '未開始' },
    IN_PROGRESS:  { cls: 'bg-amber-100 text-amber-700', label: '進行中' },
    DISTRIBUTING: { cls: 'bg-blue-100 text-blue-700 animate-pulse', label: '配布中' },
    COMPLETED:    { cls: 'bg-emerald-100 text-emerald-700', label: '完了' },
  };
  const m = map[status] || map.UNSTARTED;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PENDING:     { cls: 'bg-slate-100 text-slate-500', label: '未着手' },
    IN_PROGRESS: { cls: 'bg-blue-100 text-blue-700', label: '進行中' },
    DONE:        { cls: 'bg-emerald-100 text-emerald-700', label: '完了' },
  };
  const m = map[status] || map.PENDING;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

function ComplaintStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    UNRESOLVED:  { cls: 'bg-rose-100 text-rose-700', label: '未対応' },
    IN_PROGRESS: { cls: 'bg-amber-100 text-amber-700', label: '対応中' },
    RESOLVED:    { cls: 'bg-emerald-100 text-emerald-700', label: '解決済' },
  };
  const m = map[status] || map.UNRESOLVED;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

export default function DistributorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();

  const [distributor, setDistributor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 詳細タブ
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // 遅延ロード用
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsLoaded, setComplaintsLoaded] = useState(false);

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

  // ランク別単価マスタ（自動モード用）
  const [rankRatesMap, setRankRatesMap] = useState<Record<string, number[]>>({});

  // アプリ配信モーダル
  const [isAppDistOpen, setIsAppDistOpen] = useState(false);
  const [appDistEmail, setAppDistEmail] = useState('');
  const [appDistPlatform, setAppDistPlatform] = useState<'APPLE' | 'ANDROID'>('APPLE');
  const [appDistSending, setAppDistSending] = useState(false);
  const [appDistHistory, setAppDistHistory] = useState<any[]>([]);
  const [appDistHistoryLoading, setAppDistHistoryLoading] = useState(false);
  const [hasAppDistributed, setHasAppDistributed] = useState(false);

  // 評価データ
  const [evalData, setEvalData] = useState<any>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalRankForm, setEvalRankForm] = useState({ determinedRank: '', note: '' });
  const [evalSaving, setEvalSaving] = useState(false);

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
    ratePlan: '', rateMode: 'manual',
    rate1Type: '', rate2Type: '', rate3Type: '',
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

  const loadEvaluation = async () => {
    setEvalLoading(true);
    try {
      const res = await fetch(`/api/distributors/${id}/evaluations`);
      if (res.ok) {
        const data = await res.json();
        setEvalData(data);
        if (data.evaluations?.length > 0) {
          const latest = data.evaluations[0];
          setEvalRankForm({ determinedRank: latest.determinedRank || '', note: '' });
        }
      }
    } catch { /* ignore */ }
    setEvalLoading(false);
  };

  const loadSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const res = await fetch(`/api/schedules?distributorId=${id}`);
      if (res.ok) setSchedules(await res.json());
    } catch { /* ignore */ }
    setSchedulesLoading(false);
    setSchedulesLoaded(true);
  };

  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/tasks?distributorId=${id}`);
      if (res.ok) setTasks(await res.json());
    } catch { /* ignore */ }
    setTasksLoading(false);
    setTasksLoaded(true);
  };

  const loadComplaints = async () => {
    setComplaintsLoading(true);
    try {
      const res = await fetch(`/api/complaints?distributorId=${id}`);
      if (res.ok) {
        const json = await res.json();
        setComplaints(json.data || []);
      }
    } catch { /* ignore */ }
    setComplaintsLoading(false);
    setComplaintsLoaded(true);
  };

  const saveEvalRank = async () => {
    if (!evalRankForm.determinedRank) return;
    setEvalSaving(true);
    try {
      const res = await fetch(`/api/distributors/${id}/evaluations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalRankForm),
      });
      if (!res.ok) throw new Error();
      showToast('ランクを更新しました', 'success');
      loadEvaluation();
    } catch { showToast('更新に失敗しました', 'error'); }
    setEvalSaving(false);
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
    loadEvaluation();
    // ランク別単価マスタ読み込み
    fetch('/api/settings/system').then(r => r.json()).then(d => {
      if (d.rankRates) {
        try { setRankRatesMap(JSON.parse(d.rankRates)); } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, [id]);

  // 遅延ロード
  useEffect(() => {
    if (activeTab === 'schedules' && !schedulesLoaded) loadSchedules();
    if (activeTab === 'tasks' && !tasksLoaded) loadTasks();
    if (activeTab === 'complaints' && !complaintsLoaded) loadComplaints();
  }, [activeTab]);

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
      rateMode: distributor.rateMode || 'manual',
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

  const applyRankRates = (rank: string) => {
    const rates = rankRatesMap[rank];
    if (!rates) return;
    setFormData(prev => ({
      ...prev,
      rate1Type: rates[0]?.toString() || '',
      rate2Type: rates[1]?.toString() || '',
      rate3Type: rates[2]?.toString() || '',
      rate4Type: rates[3]?.toString() || '',
      rate5Type: rates[4]?.toString() || '',
      rate6Type: rates[5]?.toString() || '',
    }));
  };

  const handleRankChange = (newRank: string) => {
    setFormData(prev => ({ ...prev, rank: newRank }));
    if (formData.rateMode === 'auto' && newRank) {
      applyRankRates(newRank);
    }
  };

  const handleRateModeChange = (mode: string) => {
    setFormData(prev => ({ ...prev, rateMode: mode }));
    if (mode === 'auto' && formData.rank) {
      applyRankRates(formData.rank);
    }
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

  const deleteResidenceCard = async (side: 'front' | 'back') => {
    const label = side === 'front' ? '表面' : '裏面';
    const confirmed = await showConfirm(`在留カード画像（${label}）を削除しますか？`, {
      variant: 'warning',
      title: '在留カード画像削除',
      confirmLabel: '削除する',
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/distributors/${id}/residence-card`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || '削除に失敗しました', 'error');
        return;
      }
      const data = await res.json();
      setDistributor((prev: any) => ({
        ...prev,
        residenceCardFrontUrl: data.residenceCardFrontUrl,
        residenceCardBackUrl: data.residenceCardBackUrl,
        hasResidenceCard: data.hasResidenceCard,
      }));
      showToast(`在留カード画像（${label}）を削除しました`, 'success');
    } catch {
      showToast('削除に失敗しました', 'error');
    }
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
    <div className="space-y-0 max-w-5xl">
      {/* ═══════ ページヘッダー ═══════ */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/distributors" className="text-slate-400 hover:text-slate-700 transition-colors">
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
          <button onClick={openAppDist}
            className="flex items-center gap-2 bg-white hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 border border-indigo-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
            <i className="bi bi-phone-fill"></i> 配布アプリ配信
          </button>
          <button onClick={() => { setResetPwMsg(null); setIsResetPasswordOpen(true); }}
            className="flex items-center gap-2 bg-white hover:bg-amber-50 text-amber-600 hover:text-amber-700 border border-amber-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
            <i className="bi bi-key-fill"></i> PW リセット
          </button>
          <button onClick={openEdit}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">
            <i className="bi bi-pencil-square"></i> 編集
          </button>
          <button onClick={() => setIsDeleteOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-500 hover:text-rose-600 border border-rose-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>

      {/* パスワードリセット結果メッセージ */}
      {resetPwMsg && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
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

      {/* ═══════ KPIカード行 ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          {d.rank ? <EvalRankBadge rank={d.rank} size="lg" /> : <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300"><i className="bi bi-dash text-xl"></i></div>}
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ランク</p>
            <p className="text-lg font-black text-slate-800">{d.rank || '—'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            <i className="bi bi-speedometer2 text-blue-500 text-xl"></i>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">スコア</p>
            <p className="text-lg font-black text-slate-800">{evalData?.evaluations?.[0]?.totalScore ?? '—'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
            <i className="bi bi-calendar-check text-emerald-500 text-xl"></i>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">今月出勤</p>
            <p className="text-lg font-black text-slate-800">{d._count?.schedules ?? 0}<span className="text-xs text-slate-400 ml-0.5">回</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center">
            <i className="bi bi-exclamation-triangle text-rose-500 text-xl"></i>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">未対応クレーム</p>
            <p className="text-lg font-black text-slate-800">{d._count?.complaints ?? 0}<span className="text-xs text-slate-400 ml-0.5">件</span></p>
          </div>
        </div>
      </div>

      {/* ═══════ タブバー ═══════ */}
      <div className="border-b border-slate-200 mb-5">
        <div className="flex gap-0 overflow-x-auto">
          {DETAIL_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === t.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ タブコンテンツ ═══════ */}

      {/* ─── 概要タブ ─── */}
      {activeTab === 'overview' && (
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
            <InfoRow label="ポータル言語" value={d.language === 'en' ? 'English' : '日本語'} />
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <i className="bi bi-geo-alt-fill text-emerald-500"></i> 住所
              </h2>
              <InfoRow label="郵便番号" value={d.postalCode} />
              <InfoRow label="住所" value={d.address} />
              <InfoRow label="建物名" value={d.buildingName} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <i className="bi bi-file-earmark-text-fill text-emerald-500"></i> 在留・契約
              </h2>
              <InfoRow label="在留資格" value={d.visaType?.name} />
              <InfoRow label="ビザ有効期限" value={d.visaExpiryDate ? d.visaExpiryDate.slice(0, 10) : null} />
              <InfoRow label="入社日" value={d.joinDate ? d.joinDate.slice(0, 10) : null} />
              <InfoRow label="退社日" value={d.leaveDate ? d.leaveDate.slice(0, 10) : null} />
              <InfoRow label="個人情報同意" value={d.hasAgreedPersonalInfo} />
              <InfoRow label="業務委託契約" value={d.hasSignedContract} />
              <InfoRow label="在留カード確認" value={d.hasResidenceCard} />

              {/* 在留カード画像 */}
              {(d.residenceCardFrontUrl || d.residenceCardBackUrl) && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 mb-2">在留カード画像</p>
                  <div className="grid grid-cols-2 gap-3">
                    {d.residenceCardFrontUrl && (
                      <div className="relative">
                        <p className="text-[10px] text-slate-400 mb-1">表面</p>
                        <div className="relative group">
                          <a href={d.residenceCardFrontUrl} target="_blank" rel="noopener noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={d.residenceCardFrontUrl} alt="在留カード表面" className="w-full rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                          </a>
                          <button
                            onClick={() => deleteResidenceCard('front')}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="表面を削除"
                          >
                            <i className="bi bi-trash text-xs"></i>
                          </button>
                        </div>
                      </div>
                    )}
                    {d.residenceCardBackUrl && (
                      <div className="relative">
                        <p className="text-[10px] text-slate-400 mb-1">裏面</p>
                        <div className="relative group">
                          <a href={d.residenceCardBackUrl} target="_blank" rel="noopener noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={d.residenceCardBackUrl} alt="在留カード裏面" className="w-full rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                          </a>
                          <button
                            onClick={() => deleteResidenceCard('back')}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            title="裏面を削除"
                          >
                            <i className="bi bi-trash text-xs"></i>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 口座・レートタブ ─── */}
      {activeTab === 'finance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
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

          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <i className="bi bi-graph-up text-emerald-500"></i> レート・評価
              </h2>
              <InfoRow label="ランク" value={d.rank} />
              <InfoRow label="レートプラン" value={d.ratePlan} />
              <InfoRow label="出勤回数" value={d.attendanceCount} />
              <InfoRow label="単価モード" value={d.rateMode === 'auto' ? '自動（ランク連動）' : '手動'} />
              <InfoRow label="1 Type Rate" value={d.rate1Type} />
              <InfoRow label="2 Type Rate" value={d.rate2Type} />
              <InfoRow label="3 Type Rate" value={d.rate3Type} />
              <InfoRow label="4 Type Rate" value={d.rate4Type} />
              <InfoRow label="5 Type Rate" value={d.rate5Type} />
              <InfoRow label="6 Type Rate" value={d.rate6Type} />
              <InfoRow label="交通費" value={d.transportationFee} />
              <InfoRow label="研修手当" value={d.trainingAllowance} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
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
            <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                <i className="bi bi-sticky-fill"></i> 備考
              </p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{d.note}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── 評価タブ ─── */}
      {activeTab === 'evaluation' && (
        <div className="space-y-5">
          {evalLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !evalData ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <i className="bi bi-award text-4xl text-slate-200 block mb-2"></i>
              <p className="text-sm text-slate-400">評価データがありません</p>
            </div>
          ) : (
            <>
              {/* Score Summary */}
              {evalData.evaluations?.length > 0 && (() => {
                const latest = evalData.evaluations[0];
                const prev = evalData.evaluations[1];
                const change = prev ? latest.totalScore - prev.totalScore : 0;
                return (
                  <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <EvalRankBadge rank={latest.determinedRank} size="lg" />
                    <div>
                      <p className="text-2xl font-black text-slate-800">{latest.totalScore} <span className="text-sm text-slate-400">点</span></p>
                      {change !== 0 && (
                        <p className={`text-xs font-bold ${change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {change > 0 ? '+' : ''}{change} (先週比)
                        </p>
                      )}
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-slate-400">パフォーマンス</p>
                      <p className="text-sm font-bold text-emerald-600">{latest.performanceScore}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">品質</p>
                      <p className="text-sm font-bold text-rose-600">{latest.qualityScore}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Chart */}
              {evalData.evaluations?.length > 1 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500 mb-3">スコア推移</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={[...evalData.evaluations].reverse().map((e: any) => ({
                      week: `${new Date(e.periodStart).getMonth() + 1}/${new Date(e.periodStart).getDate()}`,
                      totalScore: e.totalScore,
                      performanceScore: e.performanceScore,
                      qualityScore: e.qualityScore,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="totalScore" stroke="#3b82f6" name="総合" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="performanceScore" stroke="#22c55e" name="パフォーマンス" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="qualityScore" stroke="#ef4444" name="品質" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Complaints in eval */}
              {evalData.complaints?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500 mb-3">クレーム履歴</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-500">日付</th>
                          <th className="px-3 py-2 text-left text-slate-500">種別</th>
                          <th className="px-3 py-2 text-left text-slate-500">内容</th>
                          <th className="px-3 py-2 text-right text-slate-500">減点</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {evalData.complaints.map((c: any) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600">{new Date(c.occurredAt).toLocaleDateString('ja-JP')}</td>
                            <td className="px-3 py-2 text-slate-700 font-bold">{c.complaintType?.name || '-'}</td>
                            <td className="px-3 py-2 text-slate-600 truncate max-w-[160px]">{c.title}</td>
                            <td className="px-3 py-2 text-right text-rose-600 font-bold">-{c.penaltyScore ?? c.complaintType?.penaltyScore ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Manual Rank Adjustment */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
                <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <i className="bi bi-pencil-square"></i> ランク手動調整
                </p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">ランク</label>
                    <select
                      value={evalRankForm.determinedRank}
                      onChange={e => setEvalRankForm(p => ({ ...p, determinedRank: e.target.value }))}
                      className={selectCls}
                    >
                      <option value="">-- 選択 --</option>
                      <option value="S">S</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-xs font-bold text-slate-600 mb-1">コメント</label>
                    <input
                      value={evalRankForm.note}
                      onChange={e => setEvalRankForm(p => ({ ...p, note: e.target.value }))}
                      className={inputCls}
                      placeholder="調整理由を入力..."
                    />
                  </div>
                  <button
                    onClick={saveEvalRank}
                    disabled={evalSaving || !evalRankForm.determinedRank}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {evalSaving ? '保存中...' : <><i className="bi bi-check2"></i> 更新</>}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── 配布履歴タブ ─── */}
      {activeTab === 'schedules' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {schedulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-8 text-center">
              <i className="bi bi-calendar-x text-4xl text-slate-200 block mb-2"></i>
              <p className="text-sm text-slate-400">配布履歴がありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">日付</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">エリア</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">ステータス</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">チラシ</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">予定枚数</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">実績枚数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedules.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-700 font-medium">{s.date ? new Date(s.date).toLocaleDateString('ja-JP') : '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{s.area?.name || s.city?.name || '—'}</td>
                      <td className="px-4 py-3"><ScheduleStatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">
                        {s.items?.map((it: any) => it.flyerName).filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {s.items?.reduce((sum: number, it: any) => sum + (it.plannedCount || 0), 0).toLocaleString() || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {s.items?.some((it: any) => it.actualCount != null)
                          ? s.items.reduce((sum: number, it: any) => sum + (it.actualCount || 0), 0).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── タスクタブ ─── */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center">
              <i className="bi bi-list-task text-4xl text-slate-200 block mb-2"></i>
              <p className="text-sm text-slate-400">タスクがありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">ステータス</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">タイトル</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">カテゴリ</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">期日</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">担当者</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3"><TaskStatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{t.title}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.taskCategory ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            {t.taskCategory.icon && <i className={`bi ${t.taskCategory.icon}`}></i>}
                            {t.taskCategory.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.dueDate ? new Date(t.dueDate).toLocaleDateString('ja-JP') : '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.assignee ? `${t.assignee.lastNameJa}${t.assignee.firstNameJa}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── クレームタブ ─── */}
      {activeTab === 'complaints' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {complaintsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : complaints.length === 0 ? (
            <div className="p-8 text-center">
              <i className="bi bi-exclamation-triangle text-4xl text-slate-200 block mb-2"></i>
              <p className="text-sm text-slate-400">クレームがありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">ステータス</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">日付</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">種別</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">タイトル</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">住所</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">減点</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3"><ComplaintStatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-slate-600">{c.occurredAt ? new Date(c.occurredAt).toLocaleDateString('ja-JP') : '—'}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{c.complaintType?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{c.title}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[180px]">{c.address || '—'}</td>
                      <td className="px-4 py-3 text-right text-rose-600 font-bold">
                        -{c.penaltyScore ?? c.complaintType?.penaltyScore ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====== 編集モーダル（4タブ: 基本情報 / 在留・契約 / 口座情報 / レート・評価） ====== */}
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
                        <option value="ja">日本語</option>
                        <option value="en">English</option>
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
                      <div>
                        <Label>ランク</Label>
                        <select value={formData.rank} onChange={e => handleRankChange(e.target.value)} className={selectCls}>
                          <option value="">— 未選択 —</option>
                          <option value="S">S</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </div>
                      <div><Label>レートプラン</Label><input name="ratePlan" value={formData.ratePlan} onChange={handleInputChange} className={inputCls} placeholder="例: Basic" /></div>
                      <div><Label>出勤回数</Label><input type="number" name="attendanceCount" value={formData.attendanceCount} onChange={handleInputChange} className={inputCls} min={0} /></div>
                    </div>

                    {/* 配布単価セクション */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500">配布単価（円/枚）</p>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <button type="button"
                            onClick={() => handleRateModeChange('auto')}
                            className={`px-3 py-1 text-xs font-bold transition-colors ${formData.rateMode === 'auto' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            <i className="bi bi-lightning-fill mr-1"></i>自動
                          </button>
                          <button type="button"
                            onClick={() => handleRateModeChange('manual')}
                            className={`px-3 py-1 text-xs font-bold transition-colors ${formData.rateMode === 'manual' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            <i className="bi bi-pencil-fill mr-1"></i>手動
                          </button>
                        </div>
                      </div>
                      {formData.rateMode === 'auto' && (
                        <p className="text-[10px] text-indigo-600 flex items-center gap-1">
                          <i className="bi bi-info-circle-fill"></i>
                          ランクを変更すると、システム設定のランク別単価が自動反映されます
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        {(['rate1Type', 'rate2Type', 'rate3Type', 'rate4Type', 'rate5Type', 'rate6Type'] as const).map((f, i) => (
                          <div key={f}>
                            <Label>{i + 1} Type Rate</Label>
                            <input type="number" step="0.01" name={f} value={(formData as any)[f]} onChange={handleInputChange}
                              className={inputCls + (formData.rateMode === 'auto' ? ' bg-indigo-50 border-indigo-200' : '')}
                              placeholder="0.00"
                              readOnly={formData.rateMode === 'auto'}
                            />
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
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-phone-fill text-indigo-500"></i> 配布アプリ配信
              </h3>
              <button onClick={() => setIsAppDistOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
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
