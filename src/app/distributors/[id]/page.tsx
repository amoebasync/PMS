'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AnalyticsTab from '@/components/distributors/AnalyticsTab';
import InspectionsTab from '@/components/distributors/InspectionsTab';

const RANK_COLORS: Record<string, { bg: string; text: string }> = {
  S: { bg: 'bg-yellow-500', text: 'text-white' },
  A: { bg: 'bg-blue-500', text: 'text-white' },
  B: { bg: 'bg-green-500', text: 'text-white' },
  C: { bg: 'bg-slate-400', text: 'text-white' },
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
type DetailTab = 'overview' | 'finance' | 'analytics' | 'inspections' | 'schedules' | 'tasks' | 'complaints' | 'payroll';
const DETAIL_TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: 'overview',    label: '概要',     icon: 'bi-person-fill' },
  { key: 'finance',     label: '口座・レート', icon: 'bi-bank2' },
  { key: 'payroll',     label: '給与履歴', icon: 'bi-wallet2' },
  { key: 'analytics',   label: '分析',     icon: 'bi-graph-up-arrow' },
  { key: 'inspections', label: '現地確認',  icon: 'bi-clipboard-check' },
  { key: 'schedules',   label: '配布履歴', icon: 'bi-calendar-check' },
  { key: 'tasks',       label: 'タスク',   icon: 'bi-list-task' },
  { key: 'complaints',  label: 'クレーム', icon: 'bi-exclamation-triangle' },
];

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';
const selectCls = inputCls + ' cursor-pointer';
const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-xs font-bold text-slate-600 mb-1">
    {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
  </label>
);

function InfoRow({ label, value, copyable }: { label: string; value?: string | number | null | boolean; copyable?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    if (value == null || value === '' || typeof value === 'boolean') return;
    navigator.clipboard.writeText(String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
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
    <div className="group flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-slate-800 break-words flex-1">{value ?? '—'}</span>
      {copyable && value != null && value !== '' && (
        <button
          onClick={handleCopy}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 p-0.5"
          title="コピー"
        >
          <i className={`bi ${copied ? 'bi-check-lg text-emerald-500' : 'bi-clipboard'} text-sm`}></i>
        </button>
      )}
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
  const searchParams = useSearchParams();
  const { showToast, showConfirm } = useNotification();

  const [distributor, setDistributor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // 詳細タブ（URLパラメータから初期値）
  const initialTab = (searchParams.get('tab') as DetailTab) || 'overview';
  const [activeTab, setActiveTab] = useState<DetailTab>(
    DETAIL_TABS.some(t => t.key === initialTab) ? initialTab : 'overview'
  );

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

  // 給与履歴
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollLoaded, setPayrollLoaded] = useState(false);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [expandedPayrollWeek, setExpandedPayrollWeek] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  // 得意エリアランキング
  const [areaRankings, setAreaRankings] = useState<any[]>([]);
  const [areaRankingsLoading, setAreaRankingsLoading] = useState(false);

  const initialForm = {
    staffId: '', name: '', branchId: '', phone: '', email: '',
    language: 'ja',
    birthday: '', gender: '', countryId: '',
    postalCode: '', address: '', buildingName: '',
    visaTypeId: '', visaExpiryDate: '',
    hasAgreedPersonalInfo: false, hasSignedContract: false, hasResidenceCard: false,
    joinDate: todayStr(), leaveDate: '', leaveReason: '',
    paymentMethod: '現金', excludeFromPayroll: 'false', bankName: '', bankBranchCode: '',
    bankAccountType: '普通', bankAccountNumber: '', bankAccountName: '',
    bankAccountNameKana: '', transferNumber: '',
    equipmentBattery: '', equipmentBag: '', equipmentMobile: '',
    flyerDeliveryMethod: '', transportationMethod: '',
    ratePlan: '', rateMode: 'manual',
    rate1Type: '', rate2Type: '', rate3Type: '',
    rate4Type: '', rate5Type: '', rate6Type: '',
    transportationFee: '', transportationFee1Type: '', defaultDailyTransportation: '500', trainingAllowance: '',
    inspectionInterval: '',
    rank: '', attendanceCount: '0',
    minTypes: '', maxTypes: '', minSheets: '', maxSheets: '',
    targetAmount: '', note: '',
  };
  const [formData, setFormData] = useState(initialForm);

  // AI検証
  const [verifying, setVerifying] = useState(false);
  const [verificationExpanded, setVerificationExpanded] = useState(false);

  const verifyResidenceCard = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/distributors/${id}/verify-residence-card`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '検証に失敗しました', 'error');
        setVerifying(false);
        return;
      }
      setDistributor((prev: any) => ({
        ...prev,
        residenceCardVerificationStatus: data.status,
        residenceCardVerificationResult: data.result,
        residenceCardVerifiedAt: data.verifiedAt,
      }));
      showToast(data.status === 'VERIFIED' ? 'AI検証: 一致しました' : data.status === 'MISMATCH' ? 'AI検証: 不一致があります' : '検証完了', data.status === 'VERIFIED' ? 'success' : 'warning');
    } catch {
      showToast('検証に失敗しました', 'error');
    }
    setVerifying(false);
  };

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

  const loadAreaRankings = async () => {
    setAreaRankingsLoading(true);
    try {
      const res = await fetch(`/api/distributors/${id}/area-rankings`);
      if (res.ok) setAreaRankings(await res.json());
    } catch { /* ignore */ }
    setAreaRankingsLoading(false);
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

  const loadPayroll = async (year?: number) => {
    const y = year ?? payrollYear;
    setPayrollLoading(true);
    setExpandedPayrollWeek(null);
    try {
      // 12ヶ月分を並列取得
      const promises = Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/distributor-payroll?distributorId=${id}&year=${y}&month=${i + 1}`)
          .then(r => r.ok ? r.json() : { records: [] })
          .then(j => j.records || [])
          .catch(() => [])
      );
      const results = await Promise.all(promises);
      // 重複除去（週が月をまたぐ場合）
      const seen = new Set<number>();
      const allRecords: any[] = [];
      for (const recs of results) {
        for (const rec of recs) {
          if (!seen.has(rec.id)) { seen.add(rec.id); allRecords.push(rec); }
        }
      }
      setPayrollRecords(allRecords);
    } catch { /* ignore */ }
    setPayrollLoading(false);
    setPayrollLoaded(true);
  };

  const downloadPayrollPdf = async (month?: number) => {
    setDownloadingPdf(true);
    try {
      const params = new URLSearchParams({ distributorId: id, year: payrollYear.toString() });
      if (month) params.set('month', month.toString());
      const res = await fetch(`/api/distributor-payroll/statement?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = month ? `支払明細書_${payrollYear}年${month}月.pdf` : `支払明細書_${payrollYear}年度.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
    setDownloadingPdf(false);
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

  const handleSendPortalInfo = async () => {
    if (!d) return;
    if (!d.email) { showToast('メールアドレスが登録されていません', 'error'); return; }
    if (!d.birthday) { showToast('生年月日が登録されていません', 'error'); return; }
    const confirmed = await showConfirm(`${d.name} にポータル案内メールを送信しますか？\n送信先: ${d.email}`, { confirmLabel: '送信', variant: 'primary' });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/distributors/${d.id}/send-portal-info`, { method: 'POST' });
      if (res.ok) {
        showToast('ポータル案内メールを送信しました', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || '送信に失敗しました', 'error');
      }
    } catch { showToast('送信に失敗しました', 'error'); }
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
    loadAreaRankings();
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
    if (activeTab === 'payroll' && !payrollLoaded) loadPayroll();
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
      rate1Type: distributor.rate1Type != null ? Number(distributor.rate1Type).toFixed(2) : '',
      rate2Type: distributor.rate2Type != null ? Number(distributor.rate2Type).toFixed(2) : '',
      rate3Type: distributor.rate3Type != null ? Number(distributor.rate3Type).toFixed(2) : '',
      rate4Type: distributor.rate4Type != null ? Number(distributor.rate4Type).toFixed(2) : '',
      rate5Type: distributor.rate5Type != null ? Number(distributor.rate5Type).toFixed(2) : '',
      rate6Type: distributor.rate6Type != null ? Number(distributor.rate6Type).toFixed(2) : '',
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
      transportationFee1Type: distributor.transportationFee1Type || '',
      defaultDailyTransportation: String(distributor.defaultDailyTransportation ?? 500),
      trainingAllowance: distributor.trainingAllowance || '',
      inspectionInterval: distributor.inspectionInterval != null ? String(distributor.inspectionInterval) : '',
      paymentMethod: distributor.paymentMethod || '現金',
      excludeFromPayroll: distributor.excludeFromPayroll ? 'true' : 'false',
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

  // レートプラン取得
  const [availableRatePlans, setAvailableRatePlans] = useState<{ name: string; rates: number[] }[]>([]);
  useEffect(() => {
    fetch('/api/settings/system').then(r => r.ok ? r.json() : {}).then((data: any) => {
      if (data.ratePlans) {
        try { setAvailableRatePlans(JSON.parse(data.ratePlans)); } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  const handleRatePlanChange = (planName: string) => {
    setFormData(prev => {
      const updated = { ...prev, ratePlan: planName };
      if (planName === 'Custom') {
        updated.rateMode = 'manual';
      } else {
        const plan = availableRatePlans.find(p => p.name === planName);
        if (plan) {
          updated.rateMode = 'manual';
          updated.rate1Type = String(plan.rates[0] || '');
          updated.rate2Type = String(plan.rates[1] || '');
          updated.rate3Type = String(plan.rates[2] || '');
          updated.rate4Type = String(plan.rates[3] || '');
          updated.rate5Type = String(plan.rates[4] || '');
          updated.rate6Type = String(plan.rates[5] || '');
        }
      }
      return updated;
    });
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || '保存に失敗しました', 'error');
        return;
      }
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
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={handleSendPortalInfo} title="ポータル案内メール送信"
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-300 px-3 py-2 rounded-lg font-bold text-xs transition-colors whitespace-nowrap">
            <i className="bi bi-envelope-fill"></i><span className="hidden lg:inline">ポータル通知</span>
          </button>
          <button onClick={openAppDist} title="配布アプリ配信"
            className="flex items-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-300 px-3 py-2 rounded-lg font-bold text-xs transition-colors whitespace-nowrap">
            <i className="bi bi-phone-fill"></i><span className="hidden lg:inline">アプリ配信</span>
          </button>
          <button onClick={() => { setResetPwMsg(null); setIsResetPasswordOpen(true); }} title="PWリセット"
            className="flex items-center gap-1.5 bg-white hover:bg-amber-50 text-amber-600 border border-amber-300 px-3 py-2 rounded-lg font-bold text-xs transition-colors whitespace-nowrap">
            <i className="bi bi-key-fill"></i><span className="hidden lg:inline">PW</span>
          </button>
          <button onClick={openEdit} title="編集"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition-colors whitespace-nowrap">
            <i className="bi bi-pencil-square"></i><span className="hidden lg:inline">編集</span>
          </button>
          <button onClick={() => setIsDeleteOpen(true)} title="削除"
            className="flex items-center bg-white hover:bg-rose-50 text-rose-500 border border-rose-200 px-2.5 py-2 rounded-lg text-xs transition-colors">
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
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">累計出勤</p>
            <p className="text-lg font-black text-slate-800">{d.totalWorkDays ?? 0}<span className="text-xs text-slate-400 ml-0.5">日</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-violet-50 rounded-lg flex items-center justify-center">
            <i className="bi bi-pie-chart-fill text-violet-500 text-xl"></i>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">平均配布率</p>
            <p className="text-lg font-black text-slate-800">{d.avgDistributionRate != null ? <>{d.avgDistributionRate}<span className="text-xs text-slate-400 ml-0.5">%</span></> : '—'}</p>
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
            <InfoRow label="氏名" value={d.name} copyable />
            <InfoRow label="スタッフID" value={d.staffId} />
            <InfoRow label="支店" value={d.branch?.nameJa} />
            <InfoRow label="メール" value={d.email} copyable />
            <InfoRow label="電話番号" value={d.phone} copyable />
            <InfoRow label="生年月日" value={d.birthday ? d.birthday.slice(0, 10) : null} />
            <InfoRow label="性別" value={d.gender} />
            <InfoRow label="国籍" value={d.country?.name} />
            <InfoRow label="ポータル言語" value={d.language === 'en' ? 'English' : '日本語'} />
            {d.passwordInfo && (
              <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
                <span className="text-xs text-slate-400 w-24 shrink-0">パスワード</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-800">{d.passwordInfo}</span>
                  {d.isPasswordTemp && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">初期PW</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                <i className="bi bi-geo-alt-fill text-emerald-500"></i> 住所
              </h2>
              <InfoRow label="郵便番号" value={d.postalCode} copyable />
              <InfoRow label="住所" value={d.address} copyable />
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
              {/* 業務委託契約 — DocuSeal連携 */}
              <div className="flex items-start gap-2 py-2 border-b border-slate-100">
                <span className="text-xs text-slate-500 w-32 shrink-0 pt-0.5">業務委託契約</span>
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  {d.contractStatus === 'SIGNED' ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">署名済 ✓</span>
                  ) : d.contractStatus === 'SENT' ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">送信済（未署名）</span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">未送信</span>
                  )}
                  {d.contractDate && (
                    <span className="text-[10px] text-slate-400">{d.contractDate.slice(0, 10)}</span>
                  )}
                  {d.contractPdfUrl && (
                    <a
                      href={`/api/s3-proxy?key=${encodeURIComponent(d.contractPdfUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      <i className="bi bi-file-earmark-pdf mr-0.5"></i>PDF
                    </a>
                  )}
                  {d.contractStatus !== 'SIGNED' && d.email && (
                    <button
                      onClick={async () => {
                        if (!confirm(`${d.name} に業務委託契約書を送信しますか？\n送信先: ${d.email}`)) return;
                        try {
                          const res = await fetch(`/api/distributors/${d.id}/contract`, { method: 'POST' });
                          const json = await res.json();
                          if (res.ok) {
                            showToast('契約書を送信しました', 'success');
                            loadDistributor();
                          } else {
                            showToast(json.error || '送信に失敗しました', 'error');
                          }
                        } catch {
                          showToast('送信に失敗しました', 'error');
                        }
                      }}
                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <i className="bi bi-send mr-1"></i>
                      {d.contractStatus === 'SENT' ? '再送信' : '契約書送信'}
                    </button>
                  )}
                </div>
              </div>
              <InfoRow label="在留カード確認" value={d.hasResidenceCard} />
              {/* AI検証ステータス */}
              {d.residenceCardFrontUrl && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-500 min-w-[100px]">AI検証</span>
                  <div className="flex items-center gap-2">
                    {d.residenceCardVerificationStatus === 'VERIFIED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><i className="bi bi-check-circle-fill"></i> 一致</span>
                    )}
                    {d.residenceCardVerificationStatus === 'MISMATCH' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"><i className="bi bi-exclamation-triangle-fill"></i> 不一致</span>
                    )}
                    {d.residenceCardVerificationStatus === 'PENDING' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700"><i className="bi bi-hourglass-split"></i> 検証中...</span>
                    )}
                    {d.residenceCardVerificationStatus === 'ERROR' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"><i className="bi bi-x-circle-fill"></i> エラー</span>
                    )}
                    {!d.residenceCardVerificationStatus && (
                      <span className="text-[10px] text-slate-400">未検証</span>
                    )}
                  </div>
                </div>
              )}

              {/* 在留カード画像 */}
              {(d.residenceCardFrontUrl || d.residenceCardBackUrl) && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-500">在留カード画像</p>
                    {d.aiVerificationEnabled && d.residenceCardFrontUrl && (
                      <button
                        onClick={verifyResidenceCard}
                        disabled={verifying}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                      >
                        {verifying ? (
                          <><i className="bi bi-hourglass-split animate-spin"></i> 検証中...</>
                        ) : (
                          <><i className="bi bi-robot"></i> AI検証</>
                        )}
                      </button>
                    )}
                  </div>
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
                  {/* AI検証詳細 */}
                  {d.residenceCardVerificationResult && d.residenceCardVerificationStatus && d.residenceCardVerificationStatus !== 'PENDING' && (
                    <div className="mt-3">
                      <button
                        onClick={() => setVerificationExpanded(!verificationExpanded)}
                        className="text-[11px] text-violet-600 hover:text-violet-800 font-bold flex items-center gap-1"
                      >
                        <i className={`bi bi-chevron-${verificationExpanded ? 'up' : 'down'}`}></i>
                        AI検証詳細 {verificationExpanded ? '非表示' : '表示'}
                      </button>
                      {verificationExpanded && (
                        <div className="mt-2 bg-slate-50 rounded-lg p-3 text-[11px]">
                          {d.residenceCardVerifiedAt && (
                            <p className="text-slate-400 mb-2">検証日時: {new Date(d.residenceCardVerifiedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</p>
                          )}
                          {d.residenceCardVerificationResult?.comparisons ? (
                            <table className="w-full">
                              <thead>
                                <tr className="text-slate-500 border-b border-slate-200">
                                  <th className="text-left py-1 font-bold">項目</th>
                                  <th className="text-left py-1 font-bold">カード記載</th>
                                  <th className="text-left py-1 font-bold">DB登録値</th>
                                  <th className="text-center py-1 font-bold">結果</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[
                                  { key: 'name', label: '氏名' },
                                  { key: 'nationality', label: '国籍' },
                                  { key: 'visaType', label: '在留資格' },
                                  { key: 'expiryDate', label: '有効期限' },
                                ].map(({ key, label }) => {
                                  const comp = (d.residenceCardVerificationResult as any).comparisons[key];
                                  if (!comp) return null;
                                  return (
                                    <tr key={key} className="border-b border-slate-100">
                                      <td className="py-1.5 font-bold text-slate-700">{label}</td>
                                      <td className="py-1.5 text-slate-600">{comp.cardValue || '-'}</td>
                                      <td className="py-1.5 text-slate-600">{comp.dbValue || '-'}</td>
                                      <td className="py-1.5 text-center">
                                        {comp.match ? (
                                          <span className="text-emerald-600"><i className="bi bi-check-circle-fill"></i></span>
                                        ) : (
                                          <span className="text-red-500"><i className="bi bi-x-circle-fill"></i></span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : d.residenceCardVerificationResult?.error ? (
                            <p className="text-red-500">エラー: {(d.residenceCardVerificationResult as any).error}</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─── 得意エリアランキング ─── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:col-span-2">
            <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
              <i className="bi bi-trophy-fill text-amber-500"></i> 得意エリアランキング
            </h2>
            {areaRankingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : areaRankings.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">配布データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 w-14">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500">エリア</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">配布回数</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">平均配布率</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500">スコア</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {areaRankings.map((r: any) => (
                      <tr key={r.areaId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-center">
                          {r.rank <= 3 ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black text-white ${
                              r.rank === 1 ? 'bg-amber-400' : r.rank === 2 ? 'bg-slate-400' : 'bg-amber-700'
                            }`}>{r.rank}</span>
                          ) : (
                            <span className="text-slate-400 font-bold">{r.rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 font-medium">{r.areaName}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{r.distributionCount}<span className="text-xs text-slate-400 ml-0.5">回</span></td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{r.avgDistributionRate != null ? <>{r.avgDistributionRate}<span className="text-xs text-slate-400 ml-0.5">%</span></> : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-800">{r.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            {d.excludeFromPayroll && (
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">給与計算対象外</span>
              </div>
            )}
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
              <InfoRow label="出勤回数" value={d.totalWorkDays ?? d.attendanceCount} />
              <InfoRow label="単価モード" value={d.rateMode === 'auto' ? '自動（ランク連動）' : '手動'} />
              <InfoRow label="1 Type Rate" value={d.rate1Type != null ? Number(d.rate1Type).toFixed(2) : null} />
              <InfoRow label="2 Type Rate" value={d.rate2Type != null ? Number(d.rate2Type).toFixed(2) : null} />
              <InfoRow label="3 Type Rate" value={d.rate3Type != null ? Number(d.rate3Type).toFixed(2) : null} />
              <InfoRow label="4 Type Rate" value={d.rate4Type != null ? Number(d.rate4Type).toFixed(2) : null} />
              <InfoRow label="5 Type Rate" value={d.rate5Type != null ? Number(d.rate5Type).toFixed(2) : null} />
              <InfoRow label="6 Type Rate" value={d.rate6Type != null ? Number(d.rate6Type).toFixed(2) : null} />
              <InfoRow label="交通費上限" value={d.transportationFee} />
              <InfoRow label="交通費上限(1種)" value={d.transportationFee1Type} />
              <InfoRow label="デフォルト日額交通費" value={d.defaultDailyTransportation != null ? `¥${d.defaultDailyTransportation}` : '¥500'} />
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

      {/* ─── 分析タブ ─── */}
      {activeTab === 'analytics' && (
        <AnalyticsTab
          distributorId={id}
          evalData={evalData}
          evalLoading={evalLoading}
          evalRankForm={evalRankForm}
          setEvalRankForm={setEvalRankForm}
          saveEvalRank={saveEvalRank}
          evalSaving={evalSaving}
        />
      )}

      {/* ─── 巡回タブ ─── */}
      {activeTab === 'inspections' && (
        <InspectionsTab distributorId={id} />
      )}

      {/* ─── 配布履歴タブ ─── */}
      {activeTab === 'schedules' && (() => {
        // エリア別にグループ化: 日付→エリア(chome_name)単位で行を生成
        type GroupedRow = { dateKey: string; date: string; areaName: string; scheduleIds: number[]; statuses: string[]; slots: Record<number, { name: string; planned: number; actual: number | null }[]>; totalPlanned: number; totalActual: number | null };
        const grouped = schedules.reduce((acc: GroupedRow[], s: any) => {
          const dateKey = s.date ? new Date(s.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—';
          const areaName = s.area?.chome_name || s.area?.town_name || '—';
          let row = acc.find(r => r.dateKey === dateKey && r.areaName === areaName);
          if (!row) {
            row = { dateKey, date: s.date, areaName, scheduleIds: [], statuses: [], slots: {}, totalPlanned: 0, totalActual: null };
            acc.push(row);
          }
          row.scheduleIds.push(s.id);
          if (!row.statuses.includes(s.status)) row.statuses.push(s.status);
          (s.items || []).forEach((it: any) => {
            const idx = it.slotIndex || 1;
            if (!row!.slots[idx]) row!.slots[idx] = [];
            row!.slots[idx].push({ name: it.flyerName || '', planned: it.plannedCount || 0, actual: it.actualCount });
            row!.totalPlanned += it.plannedCount || 0;
            if (it.actualCount != null) row!.totalActual = (row!.totalActual ?? 0) + it.actualCount;
          });
          return acc;
        }, []);
        grouped.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const dateRowCounts = new Map<string, number>();
        grouped.forEach(r => dateRowCounts.set(r.dateKey, (dateRowCounts.get(r.dateKey) || 0) + 1));
        let prevDateKey = '';

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            {schedulesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : grouped.length === 0 ? (
              <div className="p-8 text-center">
                <i className="bi bi-calendar-x text-4xl text-slate-200 block mb-2"></i>
                <p className="text-sm text-slate-400">配布履歴がありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 sticky left-0 bg-slate-50 z-10">日付</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">エリア</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">ステータス</th>
                      {[1,2,3,4,5,6].map(i => (
                        <th key={i} className="px-3 py-3 text-left text-xs font-bold text-slate-500 min-w-[160px]">チラシ{i}</th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">予定枚数</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-500">実績枚数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grouped.map((row, idx) => {
                      const showDate = row.dateKey !== prevDateKey;
                      const rowSpan = showDate ? dateRowCounts.get(row.dateKey) || 1 : 0;
                      prevDateKey = row.dateKey;
                      const bestStatus = row.statuses.includes('COMPLETED') ? 'COMPLETED'
                        : row.statuses.includes('DISTRIBUTING') ? 'DISTRIBUTING'
                        : row.statuses.includes('IN_PROGRESS') ? 'IN_PROGRESS' : 'UNSTARTED';
                      return (
                        <tr key={`${row.dateKey}-${row.areaName}-${idx}`} className="hover:bg-slate-50 transition-colors">
                          {showDate && (
                            <td className="px-4 py-3 text-slate-700 font-medium align-top border-r border-slate-100 sticky left-0 bg-white z-10" rowSpan={rowSpan}>
                              {row.dateKey}
                            </td>
                          )}
                          <td className="px-4 py-3 text-slate-600">{row.areaName}</td>
                          <td className="px-4 py-3"><ScheduleStatusBadge status={bestStatus} /></td>
                          {[1,2,3,4,5,6].map(i => {
                            const items = row.slots[i];
                            if (!items || items.length === 0) return <td key={i} className="px-3 py-3 text-slate-300">—</td>;
                            const name = items.map(it => it.name).filter(Boolean).join(', ');
                            return <td key={i} className="px-3 py-3 text-slate-600 text-xs truncate max-w-[200px]" title={name}>{name || '—'}</td>;
                          })}
                          <td className="px-4 py-3 text-right text-slate-600">{row.totalPlanned.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {row.totalActual != null ? row.totalActual.toLocaleString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

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
                      <td className="px-4 py-3 text-slate-600">{t.dueDate ? new Date(t.dueDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—'}</td>
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
                      <td className="px-4 py-3 text-slate-600">{c.occurredAt ? new Date(c.occurredAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—'}</td>
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

      {/* ====== 給与履歴タブ ====== */}
      {activeTab === 'payroll' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {/* Year selector + PDF download */}
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => { const y = payrollYear - 1; setPayrollYear(y); setPayrollLoaded(false); loadPayroll(y); }}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                <i className="bi bi-chevron-left text-sm"></i>
              </button>
              <span className="text-sm font-bold text-slate-700 min-w-[60px] text-center">{payrollYear}年</span>
              <button onClick={() => { const y = payrollYear + 1; setPayrollYear(y); setPayrollLoaded(false); loadPayroll(y); }}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                disabled={payrollYear >= new Date().getFullYear()}>
                <i className="bi bi-chevron-right text-sm"></i>
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => downloadPayrollPdf()} disabled={downloadingPdf || payrollRecords.length === 0}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors">
                <i className="bi bi-file-earmark-pdf"></i>
                {downloadingPdf ? '生成中...' : '年間明細PDF'}
              </button>
            </div>
          </div>

          {payrollLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : payrollRecords.length === 0 ? (
            <div className="p-8 text-center">
              <i className="bi bi-wallet2 text-4xl text-slate-200 block mb-2"></i>
              <p className="text-sm text-slate-400">{payrollYear}年の給与データはありません</p>
            </div>
          ) : (() => {
            // 月別にグループ化
            const monthMap = new Map<number, { records: any[]; totalSchedule: number; totalExpense: number; totalGross: number }>();
            for (const rec of payrollRecords) {
              const m = new Date(rec.periodStart).getMonth() + 1;
              if (!monthMap.has(m)) monthMap.set(m, { records: [], totalSchedule: 0, totalExpense: 0, totalGross: 0 });
              const entry = monthMap.get(m)!;
              entry.records.push(rec);
              entry.totalSchedule += rec.schedulePay;
              entry.totalExpense += rec.expensePay;
              entry.totalGross += rec.grossPay;
            }
            const yearTotal = payrollRecords.reduce((s, r) => s + r.grossPay, 0);
            const yearSchedule = payrollRecords.reduce((s, r) => s + r.schedulePay, 0);
            const yearExpense = payrollRecords.reduce((s, r) => s + r.expensePay, 0);

            return (
              <div>
                {/* Year summary */}
                <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700">{payrollYear}年 合計</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-500">配布報酬 <b className="text-slate-700">¥{yearSchedule.toLocaleString()}</b></span>
                    <span className="text-slate-500">交通費 <b className="text-slate-700">¥{yearExpense.toLocaleString()}</b></span>
                    <span className="text-emerald-700 font-black text-sm">¥{yearTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Month rows */}
                {Array.from(monthMap.entries()).sort((a, b) => b[0] - a[0]).map(([month, data]) => (
                  <div key={month} className="border-b border-slate-100 last:border-0">
                    {/* Month header */}
                    <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedPayrollWeek(expandedPayrollWeek === month ? null : month)}>
                      <div className="flex items-center gap-3">
                        <i className={`bi ${expandedPayrollWeek === month ? 'bi-chevron-down' : 'bi-chevron-right'} text-slate-400 text-xs`}></i>
                        <span className="text-sm font-bold text-slate-700">{month}月</span>
                        <span className="text-[10px] text-slate-400">{data.records.length}週分</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">配布報酬</div>
                          <div className="text-sm font-bold text-slate-700">¥{data.totalSchedule.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">交通費</div>
                          <div className="text-sm font-bold text-slate-700">¥{data.totalExpense.toLocaleString()}</div>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <div className="text-xs text-slate-400">合計</div>
                          <div className="text-sm font-black text-emerald-600">¥{data.totalGross.toLocaleString()}</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); downloadPayrollPdf(month); }}
                          disabled={downloadingPdf}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-colors"
                          title="月間PDF">
                          <i className="bi bi-file-earmark-pdf text-sm"></i>
                        </button>
                      </div>
                    </div>

                    {/* Expanded weekly details */}
                    {expandedPayrollWeek === month && (
                      <div className="bg-slate-50 border-t border-slate-200">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-2 text-left font-bold text-slate-500">期間</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-500">配布報酬</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-500">交通費</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-500">合計</th>
                              <th className="px-4 py-2 text-center font-bold text-slate-500">ステータス</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {data.records.sort((a: any, b: any) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()).map((rec: any) => {
                              const ps = new Date(rec.periodStart);
                              const pe = new Date(rec.periodEnd);
                              const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
                              const statusMap: Record<string, { cls: string; label: string }> = {
                                DRAFT:     { cls: 'bg-slate-100 text-slate-500', label: '下書き' },
                                CONFIRMED: { cls: 'bg-blue-100 text-blue-700', label: '確定' },
                                PAID:      { cls: 'bg-emerald-100 text-emerald-700', label: '支払済' },
                              };
                              const st = statusMap[rec.status] || statusMap.DRAFT;
                              return (
                                <tr key={rec.id} className="hover:bg-white transition-colors">
                                  <td className="px-4 py-2.5 text-slate-600">{fmt(ps)}〜{fmt(pe)}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-700 font-medium">¥{rec.schedulePay.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-700 font-medium">¥{rec.expensePay.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right font-bold text-slate-800">¥{rec.grossPay.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ====== 編集モーダル（4タブ: 基本情報 / 在留・契約 / 口座情報 / レート・評価） ====== */}
      {isEditOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
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
                      {distributor?.passwordInfo && (
                        <div className="flex items-center gap-2 mb-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
                          <span className="text-xs text-slate-500">現在のパスワード:</span>
                          <span className="text-sm font-mono font-bold text-slate-800">{distributor.passwordInfo}</span>
                          {distributor.isPasswordTemp && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">初期PW</span>
                          )}
                        </div>
                      )}
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
                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" name="excludeFromPayroll" checked={formData.excludeFromPayroll === 'true' || formData.excludeFromPayroll === true as any}
                            onChange={e => setFormData(prev => ({ ...prev, excludeFromPayroll: e.target.checked ? 'true' : 'false' }))}
                            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                          <span className="text-xs font-bold text-red-600">給与計算対象外</span>
                        </label>
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
                      <div>
                        <Label>レートプラン</Label>
                        <select value={formData.ratePlan} onChange={e => handleRatePlanChange(e.target.value)} className={selectCls}>
                          <option value="">— 未選択 —</option>
                          {availableRatePlans.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                          ))}
                          <option value="Custom">Custom（手動設定）</option>
                        </select>
                      </div>
                      <div><Label>出勤回数</Label><input type="number" name="attendanceCount" value={formData.attendanceCount} onChange={handleInputChange} className={inputCls} min={0} /></div>
                    </div>

                    {/* 配布単価セクション */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500">配布単価（円/枚）</p>
                        {formData.ratePlan && formData.ratePlan !== 'Custom' && (
                          <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                            <i className="bi bi-info-circle-fill"></i>
                            {formData.ratePlan} プランの単価が適用されています
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {(['rate1Type', 'rate2Type', 'rate3Type', 'rate4Type', 'rate5Type', 'rate6Type'] as const).map((f, i) => {
                          const isReadOnly = formData.ratePlan !== '' && formData.ratePlan !== 'Custom' && formData.rateMode !== 'auto';
                          return (
                            <div key={f}>
                              <Label>{i + 1}種</Label>
                              <input type="number" step="0.01" name={f} value={(formData as any)[f]} onChange={handleInputChange}
                                className={inputCls + (isReadOnly ? ' bg-indigo-50 border-indigo-200' : '')}
                                placeholder="0.00"
                                readOnly={isReadOnly}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div><Label>交通費上限</Label><input name="transportationFee" value={formData.transportationFee} onChange={handleInputChange} className={inputCls} placeholder="例: FULL, 1000" /></div>
                      <div><Label>交通費上限(1種)</Label><input name="transportationFee1Type" value={formData.transportationFee1Type} onChange={handleInputChange} className={inputCls} placeholder="例: 500" /></div>
                      <div><Label>デフォルト日額交通費</Label><input name="defaultDailyTransportation" type="number" value={formData.defaultDailyTransportation} onChange={handleInputChange} className={inputCls} placeholder="500" /></div>
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
                      <p className="text-xs font-bold text-slate-500">チェック周期</p>
                      <select
                        name="inspectionInterval"
                        value={formData.inspectionInterval ?? ''}
                        onChange={handleInputChange}
                        className={inputCls}
                      >
                        <option value="">デフォルト（システム設定）</option>
                        <option value="1">毎日</option>
                        <option value="3">3日</option>
                        <option value="7">1週間</option>
                        <option value="14">2週間</option>
                        <option value="30">1ヶ月</option>
                        <option value="60">2ヶ月</option>
                        <option value="90">3ヶ月</option>
                        <option value="180">半年</option>
                        <option value="365">1年</option>
                        <option value="-1">不要</option>
                      </select>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setIsAppDistOpen(false)}>
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
                    : 'Google Playからのインストール案内メールが送信されます'}
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
