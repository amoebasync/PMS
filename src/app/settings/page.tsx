'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { handlePostalInput, handlePhoneChange } from '@/lib/formatters';
import DefaultSlotSettings from '@/components/settings/DefaultSlotSettings';
import DefaultTrainingSlotSettings from '@/components/settings/DefaultTrainingSlotSettings';

type Department = { id: number; code: string | null; name: string; _count: { employees: number } };
type Industry = { id: number; name: string; _count: { flyers: number } };
type Country = { id: number; code: string; name: string; nameEn: string | null; sortOrder: number; _count: { employees: number; distributors: number } };
type VisaType = { id: number; name: string; nameEn: string; sortOrder: number; canContract: boolean; canPartTime: boolean; workHourLimit: number | null; requiresDesignation: boolean; _count: { distributors: number } };
type Bank = { id: number; code: string; name: string; nameKana: string | null; sortOrder: number };
type DistributionMethod = { id: number; name: string; capacityType: string; priceAddon: number; sortOrder: number; isActive: boolean };
type TaskCategory = { id: number; name: string; code: string; icon: string | null; colorCls: string | null; sortOrder: number; isActive: boolean };
type RecruitingMedia = { id: number; nameJa: string; nameEn: string | null; code: string; isActive: boolean; sortOrder: number; _count?: { applicants: number } };
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
  const [tab, setTab] = useState<'general' | 'department' | 'industry' | 'country' | 'visaType' | 'bank' | 'distributionMethod' | 'company' | 'interviewSlot' | 'trainingSlot' | 'taskCategory' | 'recruitingMedia' | 'prohibitedReason' | 'complaintType' | 'alertCategory' | 'evaluation' | 'rankRates' | 'headerLinks' | 'legal'>('general');

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
  const [taskCategories, setTaskCategories] = useState<TaskCategory[]>([]);
  const [recruitingMedia, setRecruitingMedia] = useState<RecruitingMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // タスク種類管理
  const [tcModal, setTcModal] = useState<'create' | 'edit' | null>(null);
  const [tcForm, setTcForm] = useState<{ id?: number; name: string; code: string; icon: string; colorCls: string; sortOrder: number; isActive: boolean }>({ name: '', code: '', icon: '', colorCls: '', sortOrder: 100, isActive: true });
  const [tcSubmitting, setTcSubmitting] = useState(false);

  // 求人媒体管理
  const [rmModal, setRmModal] = useState<'create' | 'edit' | null>(null);
  const [rmForm, setRmForm] = useState<{ id?: number; nameJa: string; nameEn: string; code: string; sortOrder: number; isActive: boolean }>({ nameJa: '', nameEn: '', code: '', sortOrder: 100, isActive: true });
  const [rmSubmitting, setRmSubmitting] = useState(false);

  // 禁止理由管理
  const [prohibitedReasons, setProhibitedReasons] = useState<any[]>([]);
  const [prForm, setPrForm] = useState({ name: '', sortOrder: 100, isActive: true });
  const [prEditing, setPrEditing] = useState<number | null>(null);
  const [prSubmitting, setPrSubmitting] = useState(false);

  // クレーム種別管理
  const [complaintTypes, setComplaintTypes] = useState<any[]>([]);
  const [ctForm, setCtForm] = useState({ name: '', sortOrder: 100, isActive: true, penaltyScore: 10 });
  const [ctEditing, setCtEditing] = useState<number | null>(null);
  const [ctSubmitting, setCtSubmitting] = useState(false);

  // アラートカテゴリ管理
  const [alertCategories, setAlertCategories] = useState<any[]>([]);
  const [acForm, setAcForm] = useState({ name: '', icon: '', colorCls: '', sortOrder: 100, isActive: true });
  const [acEditing, setAcEditing] = useState<number | null>(null);
  const [acSubmitting, setAcSubmitting] = useState(false);

  const ICON_OPTIONS = [
    { value: 'bi-briefcase-fill', label: '💼 営業' },
    { value: 'bi-truck', label: '🚛 現場' },
    { value: 'bi-gear-fill', label: '⚙️ 管理' },
    { value: 'bi-clipboard-check', label: '📋 チェック' },
    { value: 'bi-calendar-event', label: '📅 予定' },
    { value: 'bi-megaphone-fill', label: '📢 広報' },
    { value: 'bi-people-fill', label: '👥 人事' },
    { value: 'bi-box-seam-fill', label: '📦 物流' },
    { value: 'bi-bicycle', label: '🚲 配布員' },
    { value: 'bi-shield-check', label: '🛡️ セキュリティ' },
    { value: 'bi-bell-fill', label: '🔔 通知' },
  ];
  const COLOR_OPTIONS = [
    { value: 'bg-blue-100 text-blue-700', label: '青' },
    { value: 'bg-green-100 text-green-700', label: '緑' },
    { value: 'bg-slate-100 text-slate-700', label: 'グレー' },
    { value: 'bg-amber-100 text-amber-700', label: 'オレンジ' },
    { value: 'bg-rose-100 text-rose-700', label: '赤' },
    { value: 'bg-purple-100 text-purple-700', label: '紫' },
    { value: 'bg-cyan-100 text-cyan-700', label: 'シアン' },
    { value: 'bg-pink-100 text-pink-700', label: 'ピンク' },
  ];

  const handleTcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTcSubmitting(true);
    try {
      const method = tcModal === 'create' ? 'POST' : 'PUT';
      const res = await fetch('/api/task-categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tcForm),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '保存に失敗しました', 'error');
        return;
      }
      showToast(tcModal === 'create' ? 'タスク種類を追加しました' : 'タスク種類を更新しました', 'success');
      setTcModal(null);
      // re-fetch
      const catRes = await fetch('/api/task-categories');
      if (catRes.ok) setTaskCategories(await catRes.json());
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setTcSubmitting(false);
    }
  };

  const handleTcDelete = async (cat: TaskCategory) => {
    const ok = await showConfirm(`「${cat.name}」を削除しますか？使用中のタスク・テンプレートがある場合は削除できません。`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/task-categories?id=${cat.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '削除に失敗しました', 'error');
        return;
      }
      showToast('削除しました', 'success');
      const catRes = await fetch('/api/task-categories');
      if (catRes.ok) setTaskCategories(await catRes.json());
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  const handleRmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRmSubmitting(true);
    try {
      const method = rmModal === 'create' ? 'POST' : 'PUT';
      const url = rmModal === 'edit' && rmForm.id ? `/api/recruiting-media?id=${rmForm.id}` : '/api/recruiting-media';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rmForm),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '保存に失敗しました', 'error');
        return;
      }
      showToast(rmModal === 'create' ? '求人媒体を追加しました' : '求人媒体を更新しました', 'success');
      setRmModal(null);
      const rmRes = await fetch('/api/recruiting-media');
      if (rmRes.ok) setRecruitingMedia(await rmRes.json());
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setRmSubmitting(false);
    }
  };

  const handleRmDelete = async (media: RecruitingMedia) => {
    const ok = await showConfirm(`「${media.nameJa}」を削除しますか？`, { variant: 'danger', confirmLabel: '削除する' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/recruiting-media?id=${media.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '削除に失敗しました', 'error');
        return;
      }
      showToast('削除しました', 'success');
      const rmRes = await fetch('/api/recruiting-media');
      if (rmRes.ok) setRecruitingMedia(await rmRes.json());
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  // 禁止理由 fetch & CRUD
  const fetchProhibitedReasons = useCallback(async () => {
    const res = await fetch('/api/prohibited-reasons');
    if (res.ok) setProhibitedReasons(await res.json());
  }, []);

  const handleSavePR = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrSubmitting(true);
    try {
      const method = prEditing ? 'PUT' : 'POST';
      const url = prEditing ? `/api/prohibited-reasons?id=${prEditing}` : '/api/prohibited-reasons';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prForm),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '保存に失敗しました', 'error');
        return;
      }
      showToast(prEditing ? '禁止理由を更新しました' : '禁止理由を追加しました', 'success');
      setPrEditing(null);
      setPrForm({ name: '', sortOrder: 100, isActive: true });
      await fetchProhibitedReasons();
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setPrSubmitting(false);
    }
  };

  const handleDeletePR = async (item: any) => {
    const ok = await showConfirm(`「${item.name}」を削除しますか？`, { variant: 'danger', confirmLabel: '削除する' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/prohibited-reasons?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '削除に失敗しました', 'error');
        return;
      }
      showToast('削除しました', 'success');
      await fetchProhibitedReasons();
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  // クレーム種別 fetch & CRUD
  const fetchComplaintTypes = useCallback(async () => {
    const res = await fetch('/api/complaint-types');
    if (res.ok) setComplaintTypes(await res.json());
  }, []);

  const handleSaveCT = async (e: React.FormEvent) => {
    e.preventDefault();
    setCtSubmitting(true);
    try {
      const method = ctEditing ? 'PUT' : 'POST';
      const url = ctEditing ? `/api/complaint-types?id=${ctEditing}` : '/api/complaint-types';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctForm),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '保存に失敗しました', 'error');
        return;
      }
      showToast(ctEditing ? 'クレーム種別を更新しました' : 'クレーム種別を追加しました', 'success');
      setCtEditing(null);
      setCtForm({ name: '', sortOrder: 100, isActive: true, penaltyScore: 10 });
      await fetchComplaintTypes();
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setCtSubmitting(false);
    }
  };

  const handleDeleteCT = async (item: any) => {
    const ok = await showConfirm(`「${item.name}」を削除しますか？`, { variant: 'danger', confirmLabel: '削除する' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/complaint-types?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '削除に失敗しました', 'error');
        return;
      }
      showToast('削除しました', 'success');
      await fetchComplaintTypes();
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  // アラートカテゴリ fetch & CRUD
  const fetchAlertCategories = useCallback(async () => {
    const res = await fetch('/api/alert-categories');
    if (res.ok) setAlertCategories(await res.json());
  }, []);

  const handleSaveAC = async (e: React.FormEvent) => {
    e.preventDefault();
    setAcSubmitting(true);
    try {
      const method = acEditing ? 'PUT' : 'POST';
      const url = acEditing ? `/api/alert-categories?id=${acEditing}` : '/api/alert-categories';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acForm),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '保存に失敗しました', 'error');
        return;
      }
      showToast(acEditing ? 'アラートカテゴリを更新しました' : 'アラートカテゴリを追加しました', 'success');
      setAcEditing(null);
      setAcForm({ name: '', icon: '', colorCls: '', sortOrder: 100, isActive: true });
      await fetchAlertCategories();
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setAcSubmitting(false);
    }
  };

  const handleDeleteAC = async (item: any) => {
    const ok = await showConfirm(`「${item.name}」を削除しますか？`, { variant: 'danger', confirmLabel: '削除する' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/alert-categories?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || '削除に失敗しました', 'error');
        return;
      }
      showToast('削除しました', 'success');
      await fetchAlertCategories();
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch('/api/settings/system');
      if (res.ok) setSystemSettings(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchData = async () => {
    try {
      const [mastersRes, pricingRes, taskCatRes, rmRes] = await Promise.all([
        fetch('/api/settings/masters'),
        fetch('/api/pricing'),
        fetch('/api/task-categories'),
        fetch('/api/recruiting-media'),
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
      if (taskCatRes.ok) {
        const d = await taskCatRes.json();
        setTaskCategories(d);
      }
      if (rmRes.ok) {
        setRecruitingMedia(await rmRes.json());
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
    if (tab === 'country') return { code: '', name: '', nameEn: '', aliases: '', sortOrder: 100 };
    if (tab === 'visaType') return { name: '', nameEn: '', sortOrder: 100, canContract: false, canPartTime: false, workHourLimit: '', requiresDesignation: false };
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
    else if (tab === 'country') setForm({ code: item.code, name: item.name, nameEn: item.nameEn || '', aliases: item.aliases || '', sortOrder: item.sortOrder });
    else if (tab === 'visaType') setForm({ name: item.name, nameEn: item.nameEn || '', sortOrder: item.sortOrder, canContract: item.canContract, canPartTime: item.canPartTime, workHourLimit: item.workHourLimit ?? '', requiresDesignation: item.requiresDesignation });
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
    { key: 'trainingSlot',       label: '研修スロット', icon: 'bi-mortarboard' },
    { key: 'taskCategory',        label: 'タスク種類',  icon: 'bi-list-check' },
    { key: 'recruitingMedia',     label: '求人媒体',    icon: 'bi-megaphone-fill' },
    { key: 'prohibitedReason',   label: '禁止理由',    icon: 'bi-shield-x' },
    { key: 'complaintType',      label: 'クレーム種別', icon: 'bi-exclamation-circle' },
    { key: 'alertCategory',      label: 'アラートカテゴリ', icon: 'bi-bell' },
    { key: 'evaluation',          label: '評価設定',    icon: 'bi-speedometer2' },
    { key: 'rankRates',            label: 'ランク別単価', icon: 'bi-currency-yen' },
    { key: 'headerLinks',          label: 'リンク集',     icon: 'bi-link-45deg' },
    { key: 'legal',                label: '法務',         icon: 'bi-file-earmark-text' },
  ] as const;

  const isMasterTab = tab !== 'general' && tab !== 'company' && tab !== 'interviewSlot' && tab !== 'trainingSlot' && tab !== 'taskCategory' && tab !== 'recruitingMedia' && tab !== 'prohibitedReason' && tab !== 'complaintType' && tab !== 'alertCategory' && tab !== 'evaluation' && tab !== 'rankRates' && tab !== 'headerLinks' && tab !== 'legal';

  // 法務コンテンツ
  const [legalContents, setLegalContents] = useState<Record<string, string>>({
    privacyPolicy: '',
    termsOfService: '',
    appPrivacyPolicy: '',
  });
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalSaving, setLegalSaving] = useState<string | null>(null);
  const [legalPreview, setLegalPreview] = useState<string | null>(null);

  const fetchLegalContents = async () => {
    setLegalLoading(true);
    try {
      const keys = ['privacyPolicy', 'termsOfService', 'appPrivacyPolicy'];
      const results = await Promise.all(
        keys.map(key => fetch(`/api/legal-content?key=${key}`).then(r => r.json()))
      );
      const newContents: Record<string, string> = {};
      keys.forEach((key, i) => { newContents[key] = results[i].content || ''; });
      setLegalContents(newContents);
    } catch (e) { console.error(e); }
    setLegalLoading(false);
  };

  const handleSaveLegal = async (key: string) => {
    setLegalSaving(key);
    try {
      const res = await fetch('/api/legal-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, content: legalContents[key] }),
      });
      if (!res.ok) throw new Error();
      showToast('保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setLegalSaving(null);
    }
  };

  // 評価設定
  const [evalSettings, setEvalSettings] = useState({
    evalBaseScore: '100', evalAttendanceBonus: '5', evalSheetsBonus: '1',
    evalSheetsBonusUnit: '1000', evalRankS: '120', evalRankA: '100',
    evalRankB: '80', evalRankC: '60', evalCycleDay: '0',
  });
  const [evalSaving, setEvalSaving] = useState(false);

  // ランク別単価設定
  const RANKS = ['S', 'A', 'B', 'C', 'D'] as const;
  const RANK_BADGE: Record<string, string> = { S: 'bg-yellow-500', A: 'bg-blue-500', B: 'bg-green-500', C: 'bg-gray-400', D: 'bg-red-400' };
  const emptyRankRates: Record<string, number[]> = { S: [0,0,0,0,0,0], A: [0,0,0,0,0,0], B: [0,0,0,0,0,0], C: [0,0,0,0,0,0], D: [0,0,0,0,0,0] };
  const [rankRates, setRankRates] = useState<Record<string, number[]>>(emptyRankRates);
  const [rankRatesSaving, setRankRatesSaving] = useState(false);

  const fetchRankRates = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/system');
      if (res.ok) {
        const d = await res.json();
        if (d.rankRates) {
          try { setRankRates(JSON.parse(d.rankRates)); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, []);

  const saveRankRates = async () => {
    setRankRatesSaving(true);
    try {
      await fetch('/api/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'rankRates', value: JSON.stringify(rankRates) }),
      });
      showToast('ランク別単価を保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    }
    setRankRatesSaving(false);
  };

  const updateRankRate = (rank: string, index: number, value: string) => {
    setRankRates(prev => ({
      ...prev,
      [rank]: prev[rank].map((v, i) => i === index ? (parseFloat(value) || 0) : v),
    }));
  };

  // リンク集設定
  type HeaderLink = { label: string; url: string; icon: string };
  const LINK_ICON_OPTIONS = [
    { value: 'bi-link-45deg', label: 'リンク' },
    { value: 'bi-globe', label: 'ウェブ' },
    { value: 'bi-folder-fill', label: 'フォルダ' },
    { value: 'bi-file-earmark-text', label: 'ドキュメント' },
    { value: 'bi-table', label: 'スプレッドシート' },
    { value: 'bi-bar-chart-fill', label: 'チャート' },
    { value: 'bi-chat-dots-fill', label: 'チャット' },
    { value: 'bi-camera-video-fill', label: 'ビデオ' },
    { value: 'bi-cloud-fill', label: 'クラウド' },
    { value: 'bi-database-fill', label: 'データベース' },
    { value: 'bi-shop', label: 'ショップ' },
    { value: 'bi-tools', label: 'ツール' },
    { value: 'bi-bookmark-fill', label: 'ブックマーク' },
    { value: 'bi-star-fill', label: 'お気に入り' },
  ];
  const [headerLinks, setHeaderLinks] = useState<HeaderLink[]>([]);
  const [headerLinksSaving, setHeaderLinksSaving] = useState(false);

  const fetchHeaderLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/system');
      if (res.ok) {
        const d = await res.json();
        if (d.headerLinks) {
          try { setHeaderLinks(JSON.parse(d.headerLinks)); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, []);

  const saveHeaderLinks = async () => {
    setHeaderLinksSaving(true);
    try {
      await fetch('/api/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'headerLinks', value: JSON.stringify(headerLinks) }),
      });
      showToast('リンク集を保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    }
    setHeaderLinksSaving(false);
  };

  const addHeaderLink = () => {
    setHeaderLinks(prev => [...prev, { label: '', url: '', icon: 'bi-link-45deg' }]);
  };

  const removeHeaderLink = (index: number) => {
    setHeaderLinks(prev => prev.filter((_, i) => i !== index));
  };

  const updateHeaderLink = (index: number, field: keyof HeaderLink, value: string) => {
    setHeaderLinks(prev => prev.map((link, i) => i === index ? { ...link, [field]: value } : link));
  };

  const moveHeaderLink = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= headerLinks.length) return;
    setHeaderLinks(prev => {
      const arr = [...prev];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr;
    });
  };

  const fetchEvalSettings = useCallback(async () => {
    const res = await fetch('/api/settings/system');
    if (res.ok) {
      const d = await res.json();
      setEvalSettings({
        evalBaseScore: d.evalBaseScore || '100',
        evalAttendanceBonus: d.evalAttendanceBonus || '5',
        evalSheetsBonus: d.evalSheetsBonus || '1',
        evalSheetsBonusUnit: d.evalSheetsBonusUnit || '1000',
        evalRankS: d.evalRankS || '120',
        evalRankA: d.evalRankA || '100',
        evalRankB: d.evalRankB || '80',
        evalRankC: d.evalRankC || '60',
        evalCycleDay: d.evalCycleDay || '0',
      });
    }
  }, []);

  const saveEvalSettings = async () => {
    setEvalSaving(true);
    try {
      for (const [key, value] of Object.entries(evalSettings)) {
        await fetch('/api/settings/system', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        });
      }
      showToast('評価設定を保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    }
    setEvalSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-10">
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
        <div className="flex flex-wrap gap-1 mb-6 bg-slate-200 p-1 rounded-xl">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setErrorMsg(''); if (t.key === 'company') fetchCompanySettings(); if (t.key === 'prohibitedReason') fetchProhibitedReasons(); if (t.key === 'complaintType') fetchComplaintTypes(); if (t.key === 'alertCategory') fetchAlertCategories(); if (t.key === 'evaluation') { fetchEvalSettings(); fetchComplaintTypes(); } if (t.key === 'rankRates') fetchRankRates(); if (t.key === 'headerLinks') fetchHeaderLinks(); if (t.key === 'legal') fetchLegalContents(); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${tab === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <i className={`bi ${t.icon}`}></i> {t.label}
            </button>
          ))}
        </div>

        {/* 全般設定タブ */}
        {tab === 'general' && (<>
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
              <div className="flex items-center justify-between gap-6 pt-6 pb-6">
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
            {/* GPS設定 */}
            <div className="p-5 border-t border-slate-200">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <i className="bi bi-geo-alt-fill text-emerald-500"></i>
                GPS トラッキング設定
              </h3>
              <p className="text-xs text-slate-500 mt-1">配布員のモバイルアプリで使用されるGPS関連の設定です。</p>
            </div>
            <div className="px-6 pb-6 divide-y divide-slate-100 space-y-0">
              <div className="flex items-center justify-between gap-6 pb-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-broadcast text-blue-500"></i>
                    GPS送信間隔（秒）
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">配布中にモバイルアプリがGPS座標を送信する間隔です。</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={systemSettings.gpsTrackingInterval ?? '10'}
                    onChange={e => setSystemSettings(prev => ({ ...prev, gpsTrackingInterval: e.target.value }))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white w-24 text-center"
                  />
                  <span className="text-sm text-slate-500">秒</span>
                  <button
                    onClick={() => handleSaveSystemSetting('gpsTrackingInterval', systemSettings.gpsTrackingInterval ?? '10')}
                    disabled={isSavingSystem}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {systemSaved ? <><i className="bi bi-check2"></i> 保存済</> : isSavingSystem ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-6 pt-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-flag-fill text-amber-500"></i>
                    進捗マイルストーン（枚）
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">配布員が進捗報告を行うポスト数の単位です（例: 500枚ごと）。</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    step="100"
                    value={systemSettings.progressMilestone ?? '500'}
                    onChange={e => setSystemSettings(prev => ({ ...prev, progressMilestone: e.target.value }))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white w-24 text-center"
                  />
                  <span className="text-sm text-slate-500">枚</span>
                  <button
                    onClick={() => handleSaveSystemSetting('progressMilestone', systemSettings.progressMilestone ?? '500')}
                    disabled={isSavingSystem}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {systemSaved ? <><i className="bi bi-check2"></i> 保存済</> : isSavingSystem ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
            {/* 在留カードAI検証設定 */}
            <div className="p-5 border-t border-slate-200">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <i className="bi bi-robot text-violet-500"></i>
                在留カード AI 検証
              </h3>
              <p className="text-xs text-slate-500 mt-1">配布員がアップロードした在留カード画像をAI（Gemini）で読み取り、DB情報と照合します。</p>
            </div>
            <div className="px-6 pb-6 divide-y divide-slate-100 space-y-0">
              <div className="flex items-center justify-between gap-6 pb-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-toggle-on text-violet-500"></i>
                    AI検証を有効にする
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">ONにすると、在留カードアップロード時に自動で検証が実行されます。</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      const newVal = systemSettings.residenceCardAiVerification === 'true' ? 'false' : 'true';
                      setSystemSettings(prev => ({ ...prev, residenceCardAiVerification: newVal }));
                      handleSaveSystemSetting('residenceCardAiVerification', newVal);
                    }}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      systemSettings.residenceCardAiVerification === 'true' ? 'bg-violet-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                      systemSettings.residenceCardAiVerification === 'true' ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="text-sm font-bold text-slate-600 w-8">
                    {systemSettings.residenceCardAiVerification === 'true' ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 応募者メール設定 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-envelope-fill text-emerald-500 mr-2"></i>応募者メール設定</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-send-check text-emerald-500"></i>
                    採用通知メールを自動送信する
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">OFFにすると、採用ステータスを「採用」に変更しても採用通知メールが送信されません。</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      const newVal = systemSettings.sendHiringEmail !== 'false' ? 'false' : 'true';
                      setSystemSettings(prev => ({ ...prev, sendHiringEmail: newVal }));
                      handleSaveSystemSetting('sendHiringEmail', newVal);
                    }}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      systemSettings.sendHiringEmail !== 'false' ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                      systemSettings.sendHiringEmail !== 'false' ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                  <span className="text-sm font-bold text-slate-600 w-8">
                    {systemSettings.sendHiringEmail !== 'false' ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>)}

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
                    {tab === 'visaType' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">在留資格名</th><th className="px-5 py-3 text-left font-bold text-slate-600">英語名</th><th className="px-5 py-3 text-center font-bold text-slate-600">委託</th><th className="px-5 py-3 text-center font-bold text-slate-600">バイト</th><th className="px-5 py-3 text-center font-bold text-slate-600">就労制限</th><th className="px-5 py-3 text-center font-bold text-slate-600">指定書</th><th className="px-5 py-3 text-center font-bold text-slate-600">順</th><th className="px-5 py-3 text-center font-bold text-slate-600">配布員数</th><th className="px-5 py-3"></th></>)}
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
                      <td className="px-5 py-3 text-xs text-slate-500">{item.nameEn || '—'}</td>
                      <td className="px-5 py-3 text-center">{item.canContract ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">可</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">不可</span>}</td>
                      <td className="px-5 py-3 text-center">{item.canPartTime ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">可</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">不可</span>}</td>
                      <td className="px-5 py-3 text-center text-xs text-slate-600">{item.workHourLimit ? `週${item.workHourLimit}h` : <span className="text-slate-400">なし</span>}</td>
                      <td className="px-5 py-3 text-center">{item.requiresDesignation ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">要確認</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">不要</span>}</td>
                      <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.distributors}名</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'visaType' && visaTypes.length === 0 && <tr><td colSpan={9} className="px-5 py-8 text-center text-slate-400">在留資格がありません</td></tr>}

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

        {/* 面接スロット設定タブ */}
        {tab === 'interviewSlot' && (
          <DefaultSlotSettings />
        )}

        {/* 研修スロット設定タブ */}
        {tab === 'trainingSlot' && (<DefaultTrainingSlotSettings />)}

        {/* タスク種類設定タブ */}
        {tab === 'taskCategory' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700"><i className="bi bi-list-check mr-2"></i>タスク種類マスタ</h2>
              <button onClick={() => { setTcForm({ name: '', code: '', icon: 'bi-briefcase-fill', colorCls: 'bg-blue-100 text-blue-700', sortOrder: 100, isActive: true }); setTcModal('create'); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                <i className="bi bi-plus-lg"></i>追加
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">名前</th>
                  <th className="px-5 py-3 text-left">コード</th>
                  <th className="px-5 py-3 text-left">プレビュー</th>
                  <th className="px-5 py-3 text-center">並び順</th>
                  <th className="px-5 py-3 text-center">有効</th>
                  <th className="px-5 py-3 text-center w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taskCategories.map(cat => (
                  <tr key={cat.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{cat.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{cat.code}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cat.colorCls || 'bg-slate-100 text-slate-700'}`}>
                        {cat.icon && <i className={`bi ${cat.icon}`}></i>}
                        {cat.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-slate-500">{cat.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {cat.isActive ? <span className="text-emerald-600 font-bold text-xs">✓ 有効</span> : <span className="text-slate-400 text-xs">無効</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => { setTcForm({ id: cat.id, name: cat.name, code: cat.code, icon: cat.icon || '', colorCls: cat.colorCls || '', sortOrder: cat.sortOrder, isActive: cat.isActive }); setTcModal('edit'); }} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                        <button onClick={() => handleTcDelete(cat)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {taskCategories.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">タスク種類がありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* タスク種類モーダル */}
        {tcModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-black text-slate-800 text-lg">
                  {tcModal === 'create' ? '追加' : '編集'} — タスク種類
                </h2>
                <button onClick={() => setTcModal(null)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                  <i className="bi bi-x text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleTcSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">名前 <span className="text-rose-500">*</span></label>
                  <input type="text" required value={tcForm.name} onChange={e => setTcForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 営業, 現場" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">コード <span className="text-rose-500">*</span></label>
                  <input type="text" required value={tcForm.code} onChange={e => setTcForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} className={inp + ' font-mono'} placeholder="例: SALES, FIELD" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">アイコン</label>
                  <div className="grid grid-cols-4 gap-2">
                    {ICON_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setTcForm(p => ({ ...p, icon: opt.value }))} className={`p-2 rounded-xl text-xs text-center border-2 transition ${tcForm.icon === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <i className={`bi ${opt.value} block text-lg mb-0.5`}></i>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">カラー</label>
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_OPTIONS.map(opt => (
                      <button key={opt.value} type="button" onClick={() => setTcForm(p => ({ ...p, colorCls: opt.value }))} className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${opt.value} ${tcForm.colorCls === opt.value ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-transparent'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1">並び順</label>
                    <input type="number" value={tcForm.sortOrder} onChange={e => setTcForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                  </div>
                  <div className="flex-1 flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={tcForm.isActive} onChange={e => setTcForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-bold text-slate-700">有効</span>
                    </label>
                  </div>
                </div>
                <div className="pt-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">プレビュー</label>
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${tcForm.colorCls || 'bg-slate-100 text-slate-700'}`}>
                    {tcForm.icon && <i className={`bi ${tcForm.icon}`}></i>}
                    {tcForm.name || 'タスク種類'}
                  </span>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setTcModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">キャンセル</button>
                  <button type="submit" disabled={tcSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition">
                    {tcSubmitting ? '保存中…' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 求人媒体設定タブ */}
        {tab === 'recruitingMedia' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700"><i className="bi bi-megaphone-fill mr-2"></i>求人媒体マスタ</h2>
              <button onClick={() => { setRmForm({ nameJa: '', nameEn: '', code: '', sortOrder: 100, isActive: true }); setRmModal('create'); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                <i className="bi bi-plus-lg"></i>追加
              </button>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-xs text-slate-500"><i className="bi bi-info-circle mr-1"></i>応募ページのURLに <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">?source=コード</code> を付けると、その媒体経由の応募として記録されます。</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">コード</th>
                  <th className="px-5 py-3 text-left">媒体名（日）</th>
                  <th className="px-5 py-3 text-left">媒体名（英）</th>
                  <th className="px-5 py-3 text-center">並び順</th>
                  <th className="px-5 py-3 text-center">有効</th>
                  <th className="px-5 py-3 text-center">応募数</th>
                  <th className="px-5 py-3 text-center w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recruitingMedia.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-indigo-600">{m.code}</td>
                    <td className="px-5 py-3 font-bold text-slate-800">{m.nameJa}</td>
                    <td className="px-5 py-3 text-slate-500">{m.nameEn || '-'}</td>
                    <td className="px-5 py-3 text-center text-slate-500">{m.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {m.isActive ? <span className="text-emerald-600 font-bold text-xs">✓ 有効</span> : <span className="text-slate-400 text-xs">無効</span>}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-500">{m._count?.applicants ?? 0}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => { setRmForm({ id: m.id, nameJa: m.nameJa, nameEn: m.nameEn || '', code: m.code, sortOrder: m.sortOrder, isActive: m.isActive }); setRmModal('edit'); }} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                        <button onClick={() => handleRmDelete(m)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recruitingMedia.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">求人媒体がありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 求人媒体モーダル */}
        {rmModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-black text-slate-800 text-lg">
                  {rmModal === 'create' ? '追加' : '編集'} — 求人媒体
                </h2>
                <button onClick={() => setRmModal(null)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                  <i className="bi bi-x text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleRmSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">媒体名（日本語） <span className="text-rose-500">*</span></label>
                  <input type="text" required value={rmForm.nameJa} onChange={e => setRmForm(p => ({ ...p, nameJa: e.target.value }))} className={inp} placeholder="例: Indeed, マイナビ" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">媒体名（英語）<span className="text-slate-400 font-normal text-xs ml-1">（任意）</span></label>
                  <input type="text" value={rmForm.nameEn} onChange={e => setRmForm(p => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="例: Indeed, MyNavi" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">コード <span className="text-rose-500">*</span></label>
                  <input type="text" required value={rmForm.code} onChange={e => setRmForm(p => ({ ...p, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))} className={inp + ' font-mono'} placeholder="例: indeed, mynavi" />
                  <p className="text-xs text-slate-400 mt-1">URLパラメータに使用（英数小文字・ハイフン・アンダースコアのみ）</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1">並び順</label>
                    <input type="number" value={rmForm.sortOrder} onChange={e => setRmForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                  </div>
                  <div className="flex-1 flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rmForm.isActive} onChange={e => setRmForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-bold text-slate-700">有効</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setRmModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">キャンセル</button>
                  <button type="submit" disabled={rmSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition">
                    {rmSubmitting ? '保存中…' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 禁止理由設定タブ */}
        {tab === 'prohibitedReason' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-shield-x mr-2"></i>禁止理由マスタ</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">名前</th>
                  <th className="px-5 py-3 text-center">表示順</th>
                  <th className="px-5 py-3 text-center">有効/無効</th>
                  <th className="px-5 py-3 text-center w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prohibitedReasons.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-center text-slate-500">{item.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {item.isActive ? <span className="text-emerald-600 font-bold text-xs">有効</span> : <span className="text-slate-400 text-xs">無効</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => { setPrEditing(item.id); setPrForm({ name: item.name, sortOrder: item.sortOrder, isActive: item.isActive }); }} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                        <button onClick={() => handleDeletePR(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {prohibitedReasons.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">禁止理由がありません</td></tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-6">
              <h3 className="font-bold text-slate-700 text-sm mb-3">{prEditing ? '禁止理由を編集' : '禁止理由を追加'}</h3>
              <form onSubmit={handleSavePR} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">名前 <span className="text-rose-500">*</span></label>
                  <input type="text" required value={prForm.name} onChange={e => setPrForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 入居者クレーム" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">表示順</label>
                  <input type="number" value={prForm.sortOrder} onChange={e => setPrForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prForm.isActive} onChange={e => setPrForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">有効</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  {prEditing && (
                    <button type="button" onClick={() => { setPrEditing(null); setPrForm({ name: '', sortOrder: 100, isActive: true }); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" disabled={prSubmitting} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition flex items-center gap-1.5">
                    {prSubmitting ? '保存中...' : prEditing ? '更新' : <><i className="bi bi-plus-lg"></i>追加</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* クレーム種別設定タブ */}
        {tab === 'complaintType' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-exclamation-circle mr-2"></i>クレーム種別マスタ</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">名前</th>
                  <th className="px-5 py-3 text-center">減点</th>
                  <th className="px-5 py-3 text-center">表示順</th>
                  <th className="px-5 py-3 text-center">有効/無効</th>
                  <th className="px-5 py-3 text-center w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaintTypes.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-center text-rose-600 font-bold">-{item.penaltyScore ?? 10}</td>
                    <td className="px-5 py-3 text-center text-slate-500">{item.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {item.isActive ? <span className="text-emerald-600 font-bold text-xs">有効</span> : <span className="text-slate-400 text-xs">無効</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => { setCtEditing(item.id); setCtForm({ name: item.name, sortOrder: item.sortOrder, isActive: item.isActive, penaltyScore: item.penaltyScore ?? 10 }); }} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                        <button onClick={() => handleDeleteCT(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {complaintTypes.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">クレーム種別がありません</td></tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-6">
              <h3 className="font-bold text-slate-700 text-sm mb-3">{ctEditing ? 'クレーム種別を編集' : 'クレーム種別を追加'}</h3>
              <form onSubmit={handleSaveCT} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">名前 <span className="text-rose-500">*</span></label>
                  <input type="text" required value={ctForm.name} onChange={e => setCtForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 投函ミス, 破損" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">減点</label>
                  <input type="number" min={0} value={ctForm.penaltyScore} onChange={e => setCtForm(p => ({ ...p, penaltyScore: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">表示順</label>
                  <input type="number" value={ctForm.sortOrder} onChange={e => setCtForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ctForm.isActive} onChange={e => setCtForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">有効</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  {ctEditing && (
                    <button type="button" onClick={() => { setCtEditing(null); setCtForm({ name: '', sortOrder: 100, isActive: true, penaltyScore: 10 }); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" disabled={ctSubmitting} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition flex items-center gap-1.5">
                    {ctSubmitting ? '保存中...' : ctEditing ? '更新' : <><i className="bi bi-plus-lg"></i>追加</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* アラートカテゴリ設定タブ */}
        {tab === 'alertCategory' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-bell mr-2"></i>アラートカテゴリマスタ</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">名前</th>
                  <th className="px-5 py-3 text-center">アイコン</th>
                  <th className="px-5 py-3 text-center">カラー</th>
                  <th className="px-5 py-3 text-center">表示順</th>
                  <th className="px-5 py-3 text-center">有効/無効</th>
                  <th className="px-5 py-3 text-center w-20">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alertCategories.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-center">{item.icon && <i className={`bi ${item.icon} text-lg`}></i>}</td>
                    <td className="px-5 py-3 text-center">
                      {item.colorCls && <span className={`text-xs font-bold px-2 py-1 rounded ${item.colorCls}`}>サンプル</span>}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-500">{item.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {item.isActive ? <span className="text-emerald-600 font-bold text-xs">有効</span> : <span className="text-slate-400 text-xs">無効</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => { setAcEditing(item.id); setAcForm({ name: item.name, icon: item.icon || '', colorCls: item.colorCls || '', sortOrder: item.sortOrder, isActive: item.isActive }); }} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                        <button onClick={() => handleDeleteAC(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {alertCategories.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">アラートカテゴリがありません</td></tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-6">
              <h3 className="font-bold text-slate-700 text-sm mb-3">{acEditing ? 'アラートカテゴリを編集' : 'アラートカテゴリを追加'}</h3>
              <form onSubmit={handleSaveAC} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">名前 <span className="text-rose-500">*</span></label>
                  <input type="text" required value={acForm.name} onChange={e => setAcForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 配布員, システム" />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-bold text-slate-500 mb-1">アイコン</label>
                  <select value={acForm.icon} onChange={e => setAcForm(p => ({ ...p, icon: e.target.value }))} className={inp}>
                    <option value="">なし</option>
                    {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="w-40">
                  <label className="block text-xs font-bold text-slate-500 mb-1">カラー</label>
                  <select value={acForm.colorCls} onChange={e => setAcForm(p => ({ ...p, colorCls: e.target.value }))} className={inp}>
                    <option value="">なし</option>
                    {COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">表示順</label>
                  <input type="number" value={acForm.sortOrder} onChange={e => setAcForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={acForm.isActive} onChange={e => setAcForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">有効</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  {acEditing && (
                    <button type="button" onClick={() => { setAcEditing(null); setAcForm({ name: '', icon: '', colorCls: '', sortOrder: 100, isActive: true }); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" disabled={acSubmitting} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition flex items-center gap-1.5">
                    {acSubmitting ? '保存中...' : acEditing ? '更新' : <><i className="bi bi-plus-lg"></i>追加</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* 評価設定タブ */}
        {tab === 'evaluation' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-speedometer2 mr-2"></i>評価設定</h2>
              <p className="text-xs text-slate-400 mt-1">配布員の週次評価で使用されるパラメータを設定します。</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Score Parameters */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-calculator text-indigo-500"></i> スコア計算パラメータ
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">基本スコア</label>
                    <input type="number" value={evalSettings.evalBaseScore}
                      onChange={e => setEvalSettings(p => ({ ...p, evalBaseScore: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">毎週の基準スコア (デフォルト: 100)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">出勤加点/日</label>
                    <input type="number" value={evalSettings.evalAttendanceBonus}
                      onChange={e => setEvalSettings(p => ({ ...p, evalAttendanceBonus: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">1日出勤ごとの加算ポイント</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">配布枚数加点</label>
                    <input type="number" value={evalSettings.evalSheetsBonus}
                      onChange={e => setEvalSettings(p => ({ ...p, evalSheetsBonus: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">枚数加点の加算ポイント</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">配布枚数加点単位</label>
                    <input type="number" value={evalSettings.evalSheetsBonusUnit}
                      onChange={e => setEvalSettings(p => ({ ...p, evalSheetsBonusUnit: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">何枚ごとに加算するか (デフォルト: 1000枚)</p>
                  </div>
                </div>
              </div>

              {/* Rank Thresholds */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-trophy text-amber-500"></i> ランク閾値
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-yellow-500 text-white text-[10px] font-black mr-1">S</span>
                      Sランク閾値
                    </label>
                    <input type="number" value={evalSettings.evalRankS}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankS: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-500 text-white text-[10px] font-black mr-1">A</span>
                      Aランク閾値
                    </label>
                    <input type="number" value={evalSettings.evalRankA}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankA: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500 text-white text-[10px] font-black mr-1">B</span>
                      Bランク閾値
                    </label>
                    <input type="number" value={evalSettings.evalRankB}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankB: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-400 text-white text-[10px] font-black mr-1">C</span>
                      Cランク閾値
                    </label>
                    <input type="number" value={evalSettings.evalRankC}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankC: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">これ未満はDランク</p>
                  </div>
                </div>
              </div>

              {/* Cycle Day */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-calendar-week text-emerald-500"></i> 評価サイクル
                </h3>
                <div className="max-w-xs">
                  <label className="block text-xs font-bold text-slate-500 mb-1">評価サイクル曜日</label>
                  <select
                    value={evalSettings.evalCycleDay}
                    onChange={e => setEvalSettings(p => ({ ...p, evalCycleDay: e.target.value }))}
                    className={inp + ' cursor-pointer'}
                  >
                    {WEEK_DAY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">週次評価の締め曜日 (CRONで自動実行)</p>
                </div>
              </div>

              {/* Complaint Type Penalties */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-exclamation-triangle text-red-500"></i> クレーム種別ごとの減点スコア
                </h3>
                <p className="text-[10px] text-slate-400 mb-3">各クレーム種別のデフォルト減点。個別クレームでオーバーライド可能です。</p>
                {complaintTypes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">クレーム種別が登録されていません</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs text-slate-500">
                          <th className="text-left px-4 py-2 font-bold">種別名</th>
                          <th className="text-right px-4 py-2 font-bold w-32">減点スコア</th>
                          <th className="text-center px-4 py-2 font-bold w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {complaintTypes.map((ct: any) => (
                          <tr key={ct.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium text-slate-700">{ct.name}</td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="number"
                                min="0"
                                defaultValue={ct.penaltyScore ?? 10}
                                onBlur={async (e) => {
                                  const val = parseInt(e.target.value) || 10;
                                  if (val === (ct.penaltyScore ?? 10)) return;
                                  try {
                                    await fetch(`/api/complaint-types?id=${ct.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ ...ct, penaltyScore: val }),
                                    });
                                    ct.penaltyScore = val;
                                    showToast(`${ct.name}の減点を${val}点に更新しました`, 'success');
                                  } catch {
                                    showToast('更新に失敗しました', 'error');
                                  }
                                }}
                                className="w-20 text-right px-2 py-1 border border-slate-200 rounded-lg text-sm font-bold text-red-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-2 text-center text-xs text-slate-400">点</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={saveEvalSettings}
                  disabled={evalSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {evalSaving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> 保存中...</>
                  ) : (
                    <><i className="bi bi-check2"></i> 評価設定を保存</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ランク別単価タブ ═══ */}
        {tab === 'rankRates' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-currency-yen mr-2"></i>ランク別配布単価</h2>
              <p className="text-xs text-slate-400 mt-1">各ランクの配布単価（円/枚）を設定します。配布員の「自動」モード時にランクに応じた単価が適用されます。</p>
            </div>
            <div className="p-6">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                      <th className="text-left px-4 py-3 font-bold w-24">ランク</th>
                      {[1,2,3,4,5,6].map(n => (
                        <th key={n} className="text-right px-3 py-3 font-bold">{n} Type</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {RANKS.map(rank => (
                      <tr key={rank} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-white text-sm ${RANK_BADGE[rank]}`}>{rank}</span>
                        </td>
                        {[0,1,2,3,4,5].map(i => (
                          <td key={i} className="px-3 py-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={rankRates[rank]?.[i] || 0}
                              onChange={e => updateRankRate(rank, i, e.target.value)}
                              className="w-full text-right px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">単位: 円/枚。配布員編集の「レート・評価」タブで「自動」を選択すると、ランクに対応した単価が自動入力されます。</p>
              <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={saveRankRates}
                  disabled={rankRatesSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {rankRatesSaving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> 保存中...</>
                  ) : (
                    <><i className="bi bi-check2"></i> ランク別単価を保存</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'headerLinks' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-link-45deg mr-2"></i>ヘッダーリンク集</h2>
              <p className="text-xs text-slate-400 mt-1">ヘッダーのリンク集ドロップダウンに表示するリンクを管理します。Gmail・Google Calendarは常時表示されます。</p>
            </div>
            <div className="p-6 space-y-3">
              {headerLinks.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <i className="bi bi-link-45deg text-3xl"></i>
                  <p className="mt-2 text-sm">リンクがまだ登録されていません</p>
                </div>
              )}
              {headerLinks.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveHeaderLink(idx, -1)}
                      disabled={idx === 0}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-30 text-[10px] leading-none"
                    >
                      <i className="bi bi-chevron-up"></i>
                    </button>
                    <button
                      onClick={() => moveHeaderLink(idx, 1)}
                      disabled={idx === headerLinks.length - 1}
                      className="text-slate-400 hover:text-slate-600 disabled:opacity-30 text-[10px] leading-none"
                    >
                      <i className="bi bi-chevron-down"></i>
                    </button>
                  </div>
                  <select
                    value={link.icon}
                    onChange={e => updateHeaderLink(idx, 'icon', e.target.value)}
                    className="w-36 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    {LINK_ICON_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="w-8 h-8 flex items-center justify-center text-slate-500">
                    <i className={`bi ${link.icon} text-lg`}></i>
                  </div>
                  <input
                    type="text"
                    placeholder="表示名"
                    value={link.label}
                    onChange={e => updateHeaderLink(idx, 'label', e.target.value)}
                    className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={link.url}
                    onChange={e => updateHeaderLink(idx, 'url', e.target.value)}
                    className="flex-[2] min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    onClick={() => removeHeaderLink(idx)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              ))}
              <button
                onClick={addHeaderLink}
                className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors flex items-center justify-center gap-1.5"
              >
                <i className="bi bi-plus-lg"></i> リンクを追加
              </button>
              <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
                <button
                  onClick={saveHeaderLinks}
                  disabled={headerLinksSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {headerLinksSaving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> 保存中...</>
                  ) : (
                    <><i className="bi bi-check2"></i> リンク集を保存</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 法務タブ */}
        {tab === 'legal' && (
          legalLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <i className="bi bi-hourglass-split text-2xl animate-spin mr-3" />読み込み中...
            </div>
          ) : (
            <div className="space-y-6">
              {([
                { key: 'privacyPolicy', label: 'プライバシーポリシー', icon: 'bi-shield-lock-fill', color: 'text-slate-600', desc: 'ECポータル・応募フォームに表示されるプライバシーポリシー', path: '/portal/privacy' },
                { key: 'termsOfService', label: '利用規約', icon: 'bi-file-earmark-check-fill', color: 'text-indigo-500', desc: 'ECポータルに表示される利用規約', path: '/portal/terms' },
                { key: 'appPrivacyPolicy', label: 'アプリプライバシーポリシー', icon: 'bi-phone-fill', color: 'text-emerald-500', desc: '配布スタッフ向けモバイルアプリのプライバシーポリシー', path: '/app-privacy' },
              ] as const).map(item => (
                <div key={item.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-slate-700 flex items-center gap-2">
                        <i className={`bi ${item.icon} ${item.color}`}></i>
                        {item.label}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLegalPreview(legalPreview === item.key ? null : item.key)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                          legalPreview === item.key
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <i className={`bi ${legalPreview === item.key ? 'bi-code-slash' : 'bi-eye'} mr-1`}></i>
                        {legalPreview === item.key ? '編集' : 'プレビュー'}
                      </button>
                      <a
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        <i className="bi bi-box-arrow-up-right mr-1"></i>表示確認
                      </a>
                    </div>
                  </div>
                  <div className="p-6">
                    {legalPreview === item.key ? (
                      <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 max-h-[500px] overflow-y-auto">
                        {legalContents[item.key] ? (
                          <div
                            className="legal-content space-y-6 text-sm leading-loose text-slate-700"
                            dangerouslySetInnerHTML={{ __html: legalContents[item.key] }}
                          />
                        ) : (
                          <p className="text-slate-400 text-sm text-center py-8">コンテンツが未設定です。HTMLを入力してください。</p>
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={legalContents[item.key]}
                        onChange={e => setLegalContents(prev => ({ ...prev, [item.key]: e.target.value }))}
                        rows={16}
                        className="w-full border border-slate-300 rounded-xl p-4 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
                        placeholder={`${item.label}のHTMLコンテンツを入力...\n\n例:\n<p>本文テキスト</p>\n<section>\n  <h4>1. 見出し</h4>\n  <p>内容</p>\n</section>`}
                      />
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-slate-400">
                        <i className="bi bi-info-circle mr-1"></i>
                        HTML形式で入力。h4, p, section, ul, ol, li, strong, table 等のタグが利用可能です。空の場合はデフォルトの内容が表示されます。
                      </p>
                      <button
                        onClick={() => handleSaveLegal(item.key)}
                        disabled={legalSaving === item.key}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {legalSaving === item.key ? (
                          <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> 保存中...</>
                        ) : (
                          <><i className="bi bi-check2"></i> 保存</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

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
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">別名（エイリアス）<span className="text-slate-400 font-normal text-xs ml-1">（任意）</span></label>
                    <input type="text" value={form.aliases || ''} onChange={e => setForm((p: any) => ({ ...p, aliases: e.target.value }))} className={inp} placeholder="韓国,大韓民国,Korea (カンマ区切り)" />
                    <p className="text-xs text-slate-400 mt-1">カンマ区切りで複数の別名を登録。応募ページの検索時にもマッチします。</p>
                  </div>
                </>
              )}

              {/* 在留資格 */}
              {tab === 'visaType' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">在留資格名 <span className="text-rose-500">*</span></label>
                      <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 特定技能1号" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">英語名</label>
                      <input type="text" value={form.nameEn || ''} onChange={e => setForm((p: any) => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="例: Specified Skilled Worker Type 1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">就労条件</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!form.canContract} onChange={e => setForm((p: any) => ({ ...p, canContract: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-slate-700">業務委託 可</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!form.canPartTime} onChange={e => setForm((p: any) => ({ ...p, canPartTime: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-slate-700">アルバイト・パート 可</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!form.requiresDesignation} onChange={e => setForm((p: any) => ({ ...p, requiresDesignation: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-slate-700">指定書 要確認</span>
                      </label>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">就労制限時間（空欄=なし）</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">週</span>
                          <input type="number" value={form.workHourLimit ?? ''} onChange={e => setForm((p: any) => ({ ...p, workHourLimit: e.target.value }))} className={inp + ' w-20'} min={1} max={168} placeholder="28" />
                          <span className="text-xs text-slate-500">時間まで</span>
                        </div>
                      </div>
                    </div>
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
