'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { handlePostalInput, handlePhoneChange } from '@/lib/formatters';
import InterviewSlotMasterSettings from '@/components/settings/InterviewSlotMasterSettings';
import DefaultTrainingSlotSettings from '@/components/settings/DefaultTrainingSlotSettings';
import { useTranslation } from '@/i18n/useTranslation';

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
  representativeName: string; sealImageUrl: string;
};
const COMPANY_DEFAULTS: CompanySetting = {
  companyName: '', companyNameKana: '', postalCode: '', address: '',
  phone: '', fax: '', email: '', website: '',
  invoiceRegistrationNumber: '', bankName: '', bankBranch: '',
  bankAccountType: '普通', bankAccountNumber: '', bankAccountHolder: '', logoUrl: '',
  representativeName: '', sealImageUrl: '',
};

const WEEK_DAY_KEYS = [
  { value: '0', labelKey: 'day_sunday' },
  { value: '1', labelKey: 'day_monday' },
  { value: '2', labelKey: 'day_tuesday' },
  { value: '3', labelKey: 'day_wednesday' },
  { value: '4', labelKey: 'day_thursday' },
  { value: '5', labelKey: 'day_friday' },
  { value: '6', labelKey: 'day_saturday' },
];

const inp = 'w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500';

export default function SettingsPage() {
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('settings');

  const WEEK_DAY_OPTIONS = useMemo(() => WEEK_DAY_KEYS.map(k => ({ value: k.value, label: t(k.labelKey) })), [t]);

  const [tab, setTab] = useState<'general' | 'department' | 'industry' | 'country' | 'visaType' | 'bank' | 'distributionMethod' | 'company' | 'interviewSlot' | 'trainingSlot' | 'taskCategory' | 'recruitingMedia' | 'prohibitedReason' | 'complaintType' | 'alertCategory' | 'alertDefinition' | 'evaluation' | 'rankRates' | 'headerLinks' | 'legal'>('general');

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
      showToast(t('toast_company_saved'), 'success');
    } catch {
      showToast(t('toast_save_error'), 'error');
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

  // アラート定義管理
  const [alertDefinitions, setAlertDefinitions] = useState<any[]>([]);
  const [adSaving, setAdSaving] = useState<number | null>(null);
  const [roles, setRoles] = useState<{ id: number; code: string; name: string }[]>([]);
  const [deptList, setDeptList] = useState<{ id: number; name: string }[]>([]);
  const [empList, setEmpList] = useState<{ id: number; name: string }[]>([]);

  const ICON_OPTIONS = useMemo(() => [
    { value: 'bi-briefcase-fill', label: t('icon_sales') },
    { value: 'bi-truck', label: t('icon_field') },
    { value: 'bi-gear-fill', label: t('icon_admin') },
    { value: 'bi-clipboard-check', label: t('icon_check') },
    { value: 'bi-calendar-event', label: t('icon_schedule') },
    { value: 'bi-megaphone-fill', label: t('icon_pr') },
    { value: 'bi-people-fill', label: t('icon_hr') },
    { value: 'bi-box-seam-fill', label: t('icon_logistics') },
    { value: 'bi-bicycle', label: t('icon_distributor') },
    { value: 'bi-shield-check', label: t('icon_security') },
    { value: 'bi-bell-fill', label: t('icon_notification') },
  ], [t]);
  const COLOR_OPTIONS = useMemo(() => [
    { value: 'bg-blue-100 text-blue-700', label: t('color_blue') },
    { value: 'bg-green-100 text-green-700', label: t('color_green') },
    { value: 'bg-slate-100 text-slate-700', label: t('color_gray') },
    { value: 'bg-amber-100 text-amber-700', label: t('color_orange') },
    { value: 'bg-rose-100 text-rose-700', label: t('color_red') },
    { value: 'bg-purple-100 text-purple-700', label: t('color_purple') },
    { value: 'bg-cyan-100 text-cyan-700', label: t('color_cyan') },
    { value: 'bg-pink-100 text-pink-700', label: t('color_pink') },
  ], [t]);

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
        showToast(d.error || t('toast_save_error'), 'error');
        return;
      }
      showToast(tcModal === 'create' ? t('toast_tc_added') : t('toast_tc_updated'), 'success');
      setTcModal(null);
      // re-fetch
      const catRes = await fetch('/api/task-categories');
      if (catRes.ok) setTaskCategories(await catRes.json());
    } catch {
      showToast(t('toast_save_error'), 'error');
    } finally {
      setTcSubmitting(false);
    }
  };

  const handleTcDelete = async (cat: TaskCategory) => {
    const ok = await showConfirm(t('toast_tc_delete_confirm', { name: cat.name }));
    if (!ok) return;
    try {
      const res = await fetch(`/api/task-categories?id=${cat.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || t('toast_delete_error'), 'error');
        return;
      }
      showToast(t('toast_deleted'), 'success');
      const catRes = await fetch('/api/task-categories');
      if (catRes.ok) setTaskCategories(await catRes.json());
    } catch {
      showToast(t('toast_delete_error'), 'error');
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
        showToast(d.error || t('toast_save_error'), 'error');
        return;
      }
      showToast(rmModal === 'create' ? t('toast_rm_added') : t('toast_rm_updated'), 'success');
      setRmModal(null);
      const rmRes = await fetch('/api/recruiting-media');
      if (rmRes.ok) setRecruitingMedia(await rmRes.json());
    } catch {
      showToast(t('toast_save_error'), 'error');
    } finally {
      setRmSubmitting(false);
    }
  };

  const handleRmDelete = async (media: RecruitingMedia) => {
    const ok = await showConfirm(t('confirm_delete', { name: media.nameJa }), { variant: 'danger', confirmLabel: t('btn_delete_confirm') });
    if (!ok) return;
    try {
      const res = await fetch(`/api/recruiting-media?id=${media.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || t('toast_delete_error'), 'error');
        return;
      }
      showToast(t('toast_deleted'), 'success');
      const rmRes = await fetch('/api/recruiting-media');
      if (rmRes.ok) setRecruitingMedia(await rmRes.json());
    } catch {
      showToast(t('toast_delete_error'), 'error');
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
        showToast(d.error || t('toast_save_error'), 'error');
        return;
      }
      showToast(prEditing ? t('toast_pr_updated') : t('toast_pr_added'), 'success');
      setPrEditing(null);
      setPrForm({ name: '', sortOrder: 100, isActive: true });
      await fetchProhibitedReasons();
    } catch {
      showToast(t('toast_save_error'), 'error');
    } finally {
      setPrSubmitting(false);
    }
  };

  const handleDeletePR = async (item: any) => {
    const ok = await showConfirm(t('confirm_delete', { name: item.name }), { variant: 'danger', confirmLabel: t('btn_delete_confirm') });
    if (!ok) return;
    try {
      const res = await fetch(`/api/prohibited-reasons?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || t('toast_delete_error'), 'error');
        return;
      }
      showToast(t('toast_deleted'), 'success');
      await fetchProhibitedReasons();
    } catch {
      showToast(t('toast_delete_error'), 'error');
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
        showToast(d.error || t('toast_save_error'), 'error');
        return;
      }
      showToast(ctEditing ? t('toast_ct_updated') : t('toast_ct_added'), 'success');
      setCtEditing(null);
      setCtForm({ name: '', sortOrder: 100, isActive: true, penaltyScore: 10 });
      await fetchComplaintTypes();
    } catch {
      showToast(t('toast_save_error'), 'error');
    } finally {
      setCtSubmitting(false);
    }
  };

  const handleDeleteCT = async (item: any) => {
    const ok = await showConfirm(t('confirm_delete', { name: item.name }), { variant: 'danger', confirmLabel: t('btn_delete_confirm') });
    if (!ok) return;
    try {
      const res = await fetch(`/api/complaint-types?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || t('toast_delete_error'), 'error');
        return;
      }
      showToast(t('toast_deleted'), 'success');
      await fetchComplaintTypes();
    } catch {
      showToast(t('toast_delete_error'), 'error');
    }
  };

  // アラートカテゴリ fetch & CRUD
  const fetchAlertCategories = useCallback(async () => {
    const res = await fetch('/api/alert-categories');
    if (res.ok) setAlertCategories(await res.json());
  }, []);

  const fetchAlertDefinitions = useCallback(async () => {
    const [defRes, catRes, mastersRes, empRes] = await Promise.all([
      fetch('/api/alert-definitions'),
      fetch('/api/alert-categories'),
      fetch('/api/settings/masters'),
      fetch('/api/employees?simple=true'),
    ]);
    if (defRes.ok) setAlertDefinitions(await defRes.json());
    if (catRes.ok) setAlertCategories(await catRes.json());
    if (mastersRes.ok) {
      const d = await mastersRes.json();
      if (d.departments) setDeptList(d.departments.map((dept: any) => ({ id: dept.id, name: dept.name })));
      if (d.roles) setRoles(d.roles);
    }
    if (empRes.ok) {
      const data = await empRes.json();
      const list = Array.isArray(data) ? data : data.employees || [];
      setEmpList(list.map((emp: any) => ({ id: emp.id, name: `${emp.lastNameJa || ''} ${emp.firstNameJa || ''}`.trim() })));
    }
  }, []);

  const handleSaveAlertDefinition = async (defId: number, data: any) => {
    setAdSaving(defId);
    try {
      const res = await fetch(`/api/alert-definitions/${defId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAlertDefinitions(prev => prev.map(d => d.id === defId ? updated : d));
      showToast(t('toast_ad_updated'), 'success');
    } catch {
      showToast(t('toast_update_error'), 'error');
    }
    setAdSaving(null);
  };

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
        showToast(d.error || t('toast_save_error'), 'error');
        return;
      }
      showToast(acEditing ? t('toast_ac_updated') : t('toast_ac_added'), 'success');
      setAcEditing(null);
      setAcForm({ name: '', icon: '', colorCls: '', sortOrder: 100, isActive: true });
      await fetchAlertCategories();
    } catch {
      showToast(t('toast_save_error'), 'error');
    } finally {
      setAcSubmitting(false);
    }
  };

  const handleDeleteAC = async (item: any) => {
    const ok = await showConfirm(t('confirm_delete', { name: item.name }), { variant: 'danger', confirmLabel: t('btn_delete_confirm') });
    if (!ok) return;
    try {
      const res = await fetch(`/api/alert-categories?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || t('toast_delete_error'), 'error');
        return;
      }
      showToast(t('toast_deleted'), 'success');
      await fetchAlertCategories();
    } catch {
      showToast(t('toast_delete_error'), 'error');
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
    } catch (e) { showToast(t('toast_save_error'), 'error'); }
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
    } catch (e) { showToast(t('toast_error_occurred'), 'error'); }
    setIsSubmitting(false);
  };

  const handleDelete = async (item: any) => {
    if (!await showConfirm(t('confirm_delete', { name: item.name }), { variant: 'danger', confirmLabel: t('btn_delete_confirm') })) return;
    const apiBase = isPricingTab ? '/api/pricing' : '/api/settings/masters';
    const res = await fetch(`${apiBase}?type=${tab}&id=${item.id}`, { method: 'DELETE' });
    if (res.status === 409) {
      const d = await res.json();
      setErrorMsg(d.error || t('toast_cannot_delete'));
    } else if (!res.ok) {
      setErrorMsg(t('toast_delete_failed'));
    } else {
      await fetchData();
    }
  };

  const tabs = useMemo(() => [
    { key: 'general' as const,            label: t('tab_general'),       icon: 'bi-gear-fill' },
    { key: 'department' as const,         label: t('tab_department'),        icon: 'bi-diagram-3' },
    { key: 'industry' as const,           label: t('tab_industry'),        icon: 'bi-tag' },
    { key: 'country' as const,            label: t('tab_country'),          icon: 'bi-globe2' },
    { key: 'visaType' as const,           label: t('tab_visaType'),    icon: 'bi-card-checklist' },
    { key: 'bank' as const,               label: t('tab_bank'),        icon: 'bi-bank2' },
    { key: 'distributionMethod' as const, label: t('tab_distributionMethod'),    icon: 'bi-signpost-2' },
    { key: 'company' as const,            label: t('tab_company'),    icon: 'bi-building' },
    { key: 'interviewSlot' as const,      label: t('tab_interviewSlot'), icon: 'bi-calendar-check' },
    { key: 'trainingSlot' as const,       label: t('tab_trainingSlot'), icon: 'bi-mortarboard' },
    { key: 'taskCategory' as const,        label: t('tab_taskCategory'),  icon: 'bi-list-check' },
    { key: 'recruitingMedia' as const,     label: t('tab_recruitingMedia'),    icon: 'bi-megaphone-fill' },
    { key: 'prohibitedReason' as const,   label: t('tab_prohibitedReason'),    icon: 'bi-shield-x' },
    { key: 'complaintType' as const,      label: t('tab_complaintType'), icon: 'bi-exclamation-circle' },
    { key: 'alertCategory' as const,      label: t('tab_alertCategory'), icon: 'bi-bell' },
    { key: 'alertDefinition' as const,    label: t('tab_alertDefinition'),     icon: 'bi-bell-fill' },
    { key: 'evaluation' as const,          label: t('tab_evaluation'),    icon: 'bi-speedometer2' },
    { key: 'rankRates' as const,            label: t('tab_rankRates'), icon: 'bi-currency-yen' },
    { key: 'headerLinks' as const,          label: t('tab_headerLinks'),     icon: 'bi-link-45deg' },
    { key: 'legal' as const,                label: t('tab_legal'),         icon: 'bi-file-earmark-text' },
  ], [t]);

  const isMasterTab = tab !== 'general' && tab !== 'company' && tab !== 'interviewSlot' && tab !== 'trainingSlot' && tab !== 'taskCategory' && tab !== 'recruitingMedia' && tab !== 'prohibitedReason' && tab !== 'complaintType' && tab !== 'alertCategory' && tab !== 'alertDefinition' && tab !== 'evaluation' && tab !== 'rankRates' && tab !== 'headerLinks' && tab !== 'legal';

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
      showToast(t('toast_legal_saved'), 'success');
    } catch {
      showToast(t('toast_save_error'), 'error');
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
  const RANK_BADGE: Record<string, string> = { S: 'bg-yellow-500', A: 'bg-blue-500', B: 'bg-green-500', C: 'bg-slate-400', D: 'bg-red-400' };
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
      showToast(t('toast_rank_rates_saved'), 'success');
    } catch {
      showToast(t('toast_save_error'), 'error');
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
  const LINK_ICON_OPTIONS = useMemo(() => [
    { value: 'bi-link-45deg', label: t('link_icon_link') },
    { value: 'bi-globe', label: t('link_icon_web') },
    { value: 'bi-folder-fill', label: t('link_icon_folder') },
    { value: 'bi-file-earmark-text', label: t('link_icon_document') },
    { value: 'bi-table', label: t('link_icon_spreadsheet') },
    { value: 'bi-bar-chart-fill', label: t('link_icon_chart') },
    { value: 'bi-chat-dots-fill', label: t('link_icon_chat') },
    { value: 'bi-camera-video-fill', label: t('link_icon_video') },
    { value: 'bi-cloud-fill', label: t('link_icon_cloud') },
    { value: 'bi-database-fill', label: t('link_icon_database') },
    { value: 'bi-shop', label: t('link_icon_shop') },
    { value: 'bi-tools', label: t('link_icon_tool') },
    { value: 'bi-bookmark-fill', label: t('link_icon_bookmark') },
    { value: 'bi-star-fill', label: t('link_icon_favorite') },
  ], [t]);
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
      showToast(t('toast_links_saved'), 'success');
    } catch {
      showToast(t('toast_save_error'), 'error');
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
      showToast(t('toast_eval_saved'), 'success');
    } catch {
      showToast(t('toast_save_error'), 'error');
    }
    setEvalSaving(false);
  };

  return (
    <div className="font-sans">
      <div className="max-w-5xl mx-auto py-6">
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
        <div className="flex overflow-x-auto scrollbar-hide gap-1 mb-6 bg-slate-200/60 p-1 rounded-xl -mx-4 px-4 md:mx-0 md:px-1 md:overflow-visible md:flex-wrap">
          {tabs.map(tb => (
            <button
              key={tb.key}
              onClick={() => { setTab(tb.key); setErrorMsg(''); if (tb.key === 'company') fetchCompanySettings(); if (tb.key === 'prohibitedReason') fetchProhibitedReasons(); if (tb.key === 'complaintType') fetchComplaintTypes(); if (tb.key === 'alertCategory') fetchAlertCategories(); if (tb.key === 'alertDefinition') fetchAlertDefinitions(); if (tb.key === 'evaluation') { fetchEvalSettings(); fetchComplaintTypes(); } if (tb.key === 'rankRates') fetchRankRates(); if (tb.key === 'headerLinks') fetchHeaderLinks(); if (tb.key === 'legal') fetchLegalContents(); }}
              className={`shrink-0 whitespace-nowrap px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all ${tab === tb.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <i className={`bi ${tb.icon}`}></i> {tb.label}
            </button>
          ))}
        </div>

        {/* 全般設定タブ */}
        {tab === 'general' && (<>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-700">{t('general_settings')}</h2>
            </div>
            <div className="p-6 divide-y divide-slate-100 space-y-0">
              <div className="flex items-center justify-between gap-6 pb-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-telephone-fill text-fuchsia-500"></i>
                    {t('support_phone')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('support_phone_desc')}</p>
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
                    {systemSaved ? <><i className="bi bi-check2"></i> {t('saved')}</> : isSavingSystem ? t('saving') : t('btn_save')}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-6 pt-6 pb-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{t('week_start_day')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('week_start_day_desc')}</p>
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
                    {systemSaved ? <><i className="bi bi-check2"></i> {t('saved')}</> : isSavingSystem ? t('saving') : t('btn_save')}
                  </button>
                </div>
              </div>
            </div>
            {/* GPS設定 */}
            <div className="p-5 border-t border-slate-200">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <i className="bi bi-geo-alt-fill text-emerald-500"></i>
                {t('gps_tracking')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{t('gps_tracking_desc')}</p>
            </div>
            <div className="px-6 pb-6 divide-y divide-slate-100 space-y-0">
              <div className="flex items-center justify-between gap-6 pb-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-broadcast text-blue-500"></i>
                    {t('gps_interval')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('gps_interval_desc')}</p>
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
                  <span className="text-sm text-slate-500">{t('unit_seconds')}</span>
                  <button
                    onClick={() => handleSaveSystemSetting('gpsTrackingInterval', systemSettings.gpsTrackingInterval ?? '10')}
                    disabled={isSavingSystem}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {systemSaved ? <><i className="bi bi-check2"></i> {t('saved')}</> : isSavingSystem ? t('saving') : t('btn_save')}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-6 pt-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-flag-fill text-amber-500"></i>
                    {t('progress_milestone')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('progress_milestone_desc')}</p>
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
                  <span className="text-sm text-slate-500">{t('unit_sheets')}</span>
                  <button
                    onClick={() => handleSaveSystemSetting('progressMilestone', systemSettings.progressMilestone ?? '500')}
                    disabled={isSavingSystem}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {systemSaved ? <><i className="bi bi-check2"></i> {t('saved')}</> : isSavingSystem ? t('saving') : t('btn_save')}
                  </button>
                </div>
              </div>
            </div>
            {/* 在留カードAI検証設定 */}
            <div className="p-5 border-t border-slate-200">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <i className="bi bi-robot text-violet-500"></i>
                {t('ai_verification')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{t('ai_verification_desc')}</p>
            </div>
            <div className="px-6 pb-6 divide-y divide-slate-100 space-y-0">
              <div className="flex items-center justify-between gap-6 pb-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-toggle-on text-violet-500"></i>
                    {t('ai_enable')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('ai_enable_desc')}</p>
                </div>
                <button
                  onClick={() => {
                    const newVal = systemSettings.residenceCardAiVerification === 'true' ? 'false' : 'true';
                    setSystemSettings(prev => ({ ...prev, residenceCardAiVerification: newVal }));
                    handleSaveSystemSetting('residenceCardAiVerification', newVal);
                  }}
                  className={`shrink-0 relative inline-flex h-8 w-[52px] items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 ${
                    systemSettings.residenceCardAiVerification === 'true' ? 'bg-violet-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ${
                    systemSettings.residenceCardAiVerification === 'true' ? 'translate-x-[26px]' : 'translate-x-[2px]'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* 応募者メール設定 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-envelope-fill text-emerald-500 mr-2"></i>{t('applicant_email_settings')}</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-send-check text-emerald-500"></i>
                    {t('auto_send_hiring_email')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('auto_send_hiring_email_desc')}</p>
                </div>
                <button
                  onClick={() => {
                    const newVal = systemSettings.sendHiringEmail !== 'false' ? 'false' : 'true';
                    setSystemSettings(prev => ({ ...prev, sendHiringEmail: newVal }));
                    handleSaveSystemSetting('sendHiringEmail', newVal);
                  }}
                  className={`shrink-0 relative inline-flex h-8 w-[52px] items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${
                    systemSettings.sendHiringEmail !== 'false' ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ${
                    systemSettings.sendHiringEmail !== 'false' ? 'translate-x-[26px]' : 'translate-x-[2px]'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-6 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="bi bi-x-circle text-rose-500"></i>
                    {t('auto_send_rejection_email')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('auto_send_rejection_email_desc')}</p>
                </div>
                <button
                  onClick={() => {
                    const newVal = systemSettings.sendRejectionEmail === 'true' ? 'false' : 'true';
                    setSystemSettings(prev => ({ ...prev, sendRejectionEmail: newVal }));
                    handleSaveSystemSetting('sendRejectionEmail', newVal);
                  }}
                  className={`shrink-0 relative inline-flex h-8 w-[52px] items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 ${
                    systemSettings.sendRejectionEmail === 'true' ? 'bg-rose-600' : 'bg-slate-200'
                  }`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ${
                    systemSettings.sendRejectionEmail === 'true' ? 'translate-x-[26px]' : 'translate-x-[2px]'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </>)}

        {/* 自社情報タブ */}
        {tab === 'company' && (
          isLoadingCompany ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <i className="bi bi-hourglass-split text-2xl animate-spin mr-3" />{t('loading')}
            </div>
          ) : (
            <form onSubmit={handleSaveCompany} className="space-y-6">
              {/* 基本情報 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="bi bi-info-circle text-indigo-500"></i> {t('basic_info')}
                  </h2>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 会社名 */}
                  {[
                    { label: t('company_name'), name: 'companyName', placeholder: '株式会社ティラミス', required: true },
                    { label: t('company_name_kana'), name: 'companyNameKana', placeholder: 'カブシキガイシャティラミス' },
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
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('postal_code')}</label>
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
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('phone_number')}</label>
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
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('address_label')}</label>
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
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('fax_number')}</label>
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
                    { label: t('email_address'), name: 'email', placeholder: 'info@example.co.jp' },
                    { label: t('website'), name: 'website', placeholder: 'https://example.co.jp' },
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

              {/* 代表者・印鑑 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="bi bi-person-badge text-indigo-500"></i> {t('representative_seal') || '代表者・印鑑'}
                  </h2>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('representative_name') || '代表者名'}</label>
                    <input
                      name="representativeName"
                      value={companyForm.representativeName}
                      onChange={e => setCompanyForm(prev => ({ ...prev, representativeName: e.target.value }))}
                      placeholder="山田 太郎"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('seal_image') || '法人印鑑画像'}</label>
                    {companyForm.sealImageUrl && (
                      <div className="mb-2 flex items-center gap-3">
                        <img src={companyForm.sealImageUrl} alt="印鑑" className="w-16 h-16 object-contain border border-slate-200 rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setCompanyForm(prev => ({ ...prev, sealImageUrl: '' }))}
                          className="text-xs text-rose-500 hover:text-rose-700"
                        >
                          <i className="bi bi-trash mr-1"></i>{t('delete') || '削除'}
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('type', 'seal');
                        try {
                          const res = await fetch('/api/settings/company/upload', { method: 'POST', body: formData });
                          if (res.ok) {
                            const { url } = await res.json();
                            setCompanyForm(prev => ({ ...prev, sealImageUrl: url }));
                          }
                        } catch {}
                      }}
                      className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                    />
                    <p className="text-xs text-slate-400 mt-1">{t('seal_hint') || 'PNG / JPEG（透過推奨・正方形）'}</p>
                  </div>
                </div>
              </div>

              {/* インボイス情報 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="bi bi-receipt text-indigo-500"></i> {t('invoice_tax_info')}
                  </h2>
                </div>
                <div className="p-5">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('invoice_registration_number')}</label>
                  <input
                    name="invoiceRegistrationNumber"
                    value={companyForm.invoiceRegistrationNumber}
                    onChange={e => setCompanyForm(prev => ({ ...prev, invoiceRegistrationNumber: e.target.value }))}
                    placeholder="T1234567890123"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none max-w-xs"
                  />
                  <p className="text-xs text-slate-400 mt-1">{t('invoice_hint')}</p>
                </div>
              </div>

              {/* 振込先口座 */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <i className="bi bi-bank text-indigo-500"></i> {t('bank_transfer_account')}
                  </h2>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: t('bank_name'), name: 'bankName', placeholder: '〇〇銀行' },
                    { label: t('bank_branch_name'), name: 'bankBranch', placeholder: '〇〇支店' },
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
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('account_type')}</label>
                    <select
                      name="bankAccountType"
                      value={companyForm.bankAccountType}
                      onChange={e => setCompanyForm(prev => ({ ...prev, bankAccountType: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="普通">{t('account_type_ordinary')}</option>
                      <option value="当座">{t('account_type_current')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('account_number')}</label>
                    <input
                      name="bankAccountNumber"
                      value={companyForm.bankAccountNumber}
                      onChange={e => setCompanyForm(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                      placeholder="1234567"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('account_holder_kana')}</label>
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
                  {isSavingCompany ? <><i className="bi bi-hourglass-split animate-spin"></i> {t('saving_ellipsis')}</> : <><i className="bi bi-check2-circle"></i> {t('save_settings')}</>}
                </button>
              </div>
            </form>
          )
        )}

        {/* マスタタブ共通 */}
        {isMasterTab && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700">{tabs.find(tb => tb.key === tab)?.label}{t('master_suffix')}</h2>
              <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 shadow-sm">
                <i className="bi bi-plus-lg"></i> {t('btn_add')}
              </button>
            </div>

            {isLoading ? (
              <div className="p-10 text-center text-slate-400">{t('loading')}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {tab === 'department' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_code')}</th><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_dept_name')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_employee_count')}</th><th className="px-5 py-3"></th></>)}
                    {tab === 'industry' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_industry_name')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_flyer_count')}</th><th className="px-5 py-3"></th></>)}
                    {tab === 'country' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_code')}</th><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_country_ja')}</th><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_country_en')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_order')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_usage')}</th><th className="px-5 py-3"></th></>)}
                    {tab === 'visaType' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_visa_name')}</th><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_country_en')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_contract')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_parttime')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_work_limit')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_designation')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_order')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_distributor_count')}</th><th className="px-5 py-3"></th></>)}
                    {tab === 'bank' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_code')}</th><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_bank_name')}</th><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_kana')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_order')}</th><th className="px-5 py-3"></th></>)}
                    {tab === 'distributionMethod' && (<><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_method_name')}</th><th className="px-5 py-3 text-left font-bold text-slate-600">{t('col_capacity_target')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_price_addon')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('col_order')}</th><th className="px-5 py-3 text-center font-bold text-slate-600">{t('active')}</th><th className="px-5 py-3"></th></>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tab === 'department' && departments.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-slate-400 text-xs">{item.code || '—'}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.employees}{t('count_people')}</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'department' && departments.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">{t('empty_department')}</td></tr>}

                  {tab === 'industry' && industries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.flyers}{t('count_items')}</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'industry' && industries.length === 0 && <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">{t('empty_industry')}</td></tr>}

                  {tab === 'country' && countries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-indigo-600">{item.code}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-slate-500 text-sm">{item.nameEn || '—'}</td>
                      <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.employees + item._count.distributors}{t('count_items')}</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'country' && countries.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">{t('empty_country')}</td></tr>}

                  {tab === 'visaType' && visaTypes.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{item.nameEn || '—'}</td>
                      <td className="px-5 py-3 text-center">{item.canContract ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('can')}</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">{t('cannot')}</span>}</td>
                      <td className="px-5 py-3 text-center">{item.canPartTime ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('can')}</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">{t('cannot')}</span>}</td>
                      <td className="px-5 py-3 text-center text-xs text-slate-600">{item.workHourLimit ? `${t('week_prefix')}${item.workHourLimit}${t('hour_suffix')}` : <span className="text-slate-400">{t('none_option')}</span>}</td>
                      <td className="px-5 py-3 text-center">{item.requiresDesignation ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('requires_check')}</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">{t('not_required')}</span>}</td>
                      <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{item._count.distributors}{t('count_people')}</span></td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'visaType' && visaTypes.length === 0 && <tr><td colSpan={9} className="px-5 py-8 text-center text-slate-400">{t('empty_visa')}</td></tr>}

                  {tab === 'bank' && banks.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{item.code || '—'}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{item.nameKana || '—'}</td>
                      <td className="px-5 py-3 text-center text-sm text-slate-600">{item.sortOrder}</td>
                      <td className="px-5 py-3 text-right"><button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button><button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button></td>
                    </tr>
                  ))}
                  {tab === 'bank' && banks.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">{t('empty_bank')}</td></tr>}

                  {tab === 'distributionMethod' && distributionMethods.map(item => {
                    const capacityLabel = item.capacityType === 'all' ? t('capacity_all') : item.capacityType === 'detached' ? t('capacity_detached') : t('capacity_apartment');
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
                            {item.isActive ? t('active') : t('inactive')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                          <button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                        </td>
                      </tr>
                    );
                  })}
                  {tab === 'distributionMethod' && distributionMethods.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">{t('empty_method')}</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* 面接スロット設定タブ */}
        {tab === 'interviewSlot' && (
          <InterviewSlotMasterSettings />
        )}

        {/* 研修スロット設定タブ */}
        {tab === 'trainingSlot' && (<DefaultTrainingSlotSettings />)}

        {/* タスク種類設定タブ */}
        {tab === 'taskCategory' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700"><i className="bi bi-list-check mr-2"></i>{t('tc_master_title')}</h2>
              <button onClick={() => { setTcForm({ name: '', code: '', icon: 'bi-briefcase-fill', colorCls: 'bg-blue-100 text-blue-700', sortOrder: 100, isActive: true }); setTcModal('create'); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                <i className="bi bi-plus-lg"></i>{t('btn_add')}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('label_name')}</th>
                  <th className="px-5 py-3 text-left">{t('label_code')}</th>
                  <th className="px-5 py-3 text-left">{t('label_preview')}</th>
                  <th className="px-5 py-3 text-center">{t('label_sort_order')}</th>
                  <th className="px-5 py-3 text-center">{t('active')}</th>
                  <th className="px-5 py-3 text-center w-20">{t('label_operations')}</th>
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
                      {cat.isActive ? <span className="text-emerald-600 font-bold text-xs">{t('active_check')}</span> : <span className="text-slate-400 text-xs">{t('inactive')}</span>}
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
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">{t('empty_tc')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* タスク種類モーダル */}
        {tcModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center md:p-4">
            <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
              {/* Mobile drag handle */}
              <div className="md:hidden flex justify-center -mt-4 mb-3">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-black text-slate-800 text-lg">
                  {tcModal === 'create' ? t('tc_modal_add') : t('tc_modal_edit')}
                </h2>
                <button onClick={() => setTcModal(null)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                  <i className="bi bi-x text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleTcSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_name')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={tcForm.name} onChange={e => setTcForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 営業, 現場" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_code')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={tcForm.code} onChange={e => setTcForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} className={inp + ' font-mono'} placeholder="例: SALES, FIELD" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_icon')}</label>
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
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_color')}</label>
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
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_sort_order')}</label>
                    <input type="number" value={tcForm.sortOrder} onChange={e => setTcForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                  </div>
                  <div className="flex-1 flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={tcForm.isActive} onChange={e => setTcForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-bold text-slate-700">{t('active')}</span>
                    </label>
                  </div>
                </div>
                <div className="pt-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_preview')}</label>
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${tcForm.colorCls || 'bg-slate-100 text-slate-700'}`}>
                    {tcForm.icon && <i className={`bi ${tcForm.icon}`}></i>}
                    {tcForm.name || t('tc_preview_default')}
                  </span>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setTcModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">{t('btn_cancel')}</button>
                  <button type="submit" disabled={tcSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition">
                    {tcSubmitting ? t('saving_ellipsis') : t('btn_save')}
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
              <h2 className="font-bold text-slate-700"><i className="bi bi-megaphone-fill mr-2"></i>{t('rm_master_title')}</h2>
              <button onClick={() => { setRmForm({ nameJa: '', nameEn: '', code: '', sortOrder: 100, isActive: true }); setRmModal('create'); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                <i className="bi bi-plus-lg"></i>{t('btn_add')}
              </button>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: `<i class="bi bi-info-circle mr-1"></i>${t('rm_source_hint')}` }} />
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('label_code')}</th>
                  <th className="px-5 py-3 text-left">{t('label_media_name_ja_col')}</th>
                  <th className="px-5 py-3 text-left">{t('label_media_name_en_col')}</th>
                  <th className="px-5 py-3 text-center">{t('label_sort_order')}</th>
                  <th className="px-5 py-3 text-center">{t('active')}</th>
                  <th className="px-5 py-3 text-center">{t('label_applicant_count')}</th>
                  <th className="px-5 py-3 text-center w-20">{t('label_operations')}</th>
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
                      {m.isActive ? <span className="text-emerald-600 font-bold text-xs">{t('active_check')}</span> : <span className="text-slate-400 text-xs">{t('inactive')}</span>}
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
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">{t('empty_rm')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 求人媒体モーダル */}
        {rmModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center md:p-4">
            <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
              {/* Mobile drag handle */}
              <div className="md:hidden flex justify-center -mt-4 mb-3">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-black text-slate-800 text-lg">
                  {rmModal === 'create' ? t('rm_modal_add') : t('rm_modal_edit')}
                </h2>
                <button onClick={() => setRmModal(null)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                  <i className="bi bi-x text-xl"></i>
                </button>
              </div>
              <form onSubmit={handleRmSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_media_name_ja')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={rmForm.nameJa} onChange={e => setRmForm(p => ({ ...p, nameJa: e.target.value }))} className={inp} placeholder="例: Indeed, マイナビ" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_media_name_en')}<span className="text-slate-400 font-normal text-xs ml-1">{t('label_optional')}</span></label>
                  <input type="text" value={rmForm.nameEn} onChange={e => setRmForm(p => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="例: Indeed, MyNavi" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_code')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={rmForm.code} onChange={e => setRmForm(p => ({ ...p, code: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))} className={inp + ' font-mono'} placeholder="例: indeed, mynavi" />
                  <p className="text-xs text-slate-400 mt-1">{t('url_param_hint')}</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_sort_order')}</label>
                    <input type="number" value={rmForm.sortOrder} onChange={e => setRmForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                  </div>
                  <div className="flex-1 flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rmForm.isActive} onChange={e => setRmForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-bold text-slate-700">{t('active')}</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setRmModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">{t('btn_cancel')}</button>
                  <button type="submit" disabled={rmSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition">
                    {rmSubmitting ? t('saving_ellipsis') : t('btn_save')}
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
              <h2 className="font-bold text-slate-700"><i className="bi bi-shield-x mr-2"></i>{t('pr_master_title')}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('label_name')}</th>
                  <th className="px-5 py-3 text-center">{t('label_display_order')}</th>
                  <th className="px-5 py-3 text-center">{t('label_active_inactive')}</th>
                  <th className="px-5 py-3 text-center w-20">{t('label_operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prohibitedReasons.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-center text-slate-500">{item.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {item.isActive ? <span className="text-emerald-600 font-bold text-xs">{t('active')}</span> : <span className="text-slate-400 text-xs">{t('inactive')}</span>}
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
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">{t('empty_pr')}</td></tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-6">
              <h3 className="font-bold text-slate-700 text-sm mb-3">{prEditing ? t('pr_edit_title') : t('pr_add_title')}</h3>
              <form onSubmit={handleSavePR} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_name')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={prForm.name} onChange={e => setPrForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 入居者クレーム" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_display_order')}</label>
                  <input type="number" value={prForm.sortOrder} onChange={e => setPrForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prForm.isActive} onChange={e => setPrForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">{t('active')}</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  {prEditing && (
                    <button type="button" onClick={() => { setPrEditing(null); setPrForm({ name: '', sortOrder: 100, isActive: true }); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                      {t('btn_cancel')}
                    </button>
                  )}
                  <button type="submit" disabled={prSubmitting} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition flex items-center gap-1.5">
                    {prSubmitting ? t('saving') : prEditing ? t('btn_update') : <><i className="bi bi-plus-lg"></i>{t('btn_add')}</>}
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
              <h2 className="font-bold text-slate-700"><i className="bi bi-exclamation-circle mr-2"></i>{t('ct_master_title')}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('label_name')}</th>
                  <th className="px-5 py-3 text-center">{t('label_penalty')}</th>
                  <th className="px-5 py-3 text-center">{t('label_display_order')}</th>
                  <th className="px-5 py-3 text-center">{t('label_active_inactive')}</th>
                  <th className="px-5 py-3 text-center w-20">{t('label_operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaintTypes.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-center text-rose-600 font-bold">-{item.penaltyScore ?? 10}</td>
                    <td className="px-5 py-3 text-center text-slate-500">{item.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {item.isActive ? <span className="text-emerald-600 font-bold text-xs">{t('active')}</span> : <span className="text-slate-400 text-xs">{t('inactive')}</span>}
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
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">{t('empty_ct')}</td></tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-6">
              <h3 className="font-bold text-slate-700 text-sm mb-3">{ctEditing ? t('ct_edit_title') : t('ct_add_title')}</h3>
              <form onSubmit={handleSaveCT} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_name')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={ctForm.name} onChange={e => setCtForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 投函ミス, 破損" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_penalty')}</label>
                  <input type="number" min={0} value={ctForm.penaltyScore} onChange={e => setCtForm(p => ({ ...p, penaltyScore: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_display_order')}</label>
                  <input type="number" value={ctForm.sortOrder} onChange={e => setCtForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ctForm.isActive} onChange={e => setCtForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">{t('active')}</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  {ctEditing && (
                    <button type="button" onClick={() => { setCtEditing(null); setCtForm({ name: '', sortOrder: 100, isActive: true, penaltyScore: 10 }); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                      {t('btn_cancel')}
                    </button>
                  )}
                  <button type="submit" disabled={ctSubmitting} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition flex items-center gap-1.5">
                    {ctSubmitting ? t('saving') : ctEditing ? t('btn_update') : <><i className="bi bi-plus-lg"></i>{t('btn_add')}</>}
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
              <h2 className="font-bold text-slate-700"><i className="bi bi-bell mr-2"></i>{t('ac_master_title')}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">{t('label_name')}</th>
                  <th className="px-5 py-3 text-center">{t('label_icon')}</th>
                  <th className="px-5 py-3 text-center">{t('label_color')}</th>
                  <th className="px-5 py-3 text-center">{t('label_display_order')}</th>
                  <th className="px-5 py-3 text-center">{t('label_active_inactive')}</th>
                  <th className="px-5 py-3 text-center w-20">{t('label_operations')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alertCategories.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-center">{item.icon && <i className={`bi ${item.icon} text-lg`}></i>}</td>
                    <td className="px-5 py-3 text-center">
                      {item.colorCls && <span className={`text-xs font-bold px-2 py-1 rounded ${item.colorCls}`}>{t('label_sample')}</span>}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-500">{item.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      {item.isActive ? <span className="text-emerald-600 font-bold text-xs">{t('active')}</span> : <span className="text-slate-400 text-xs">{t('inactive')}</span>}
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
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">{t('empty_ac')}</td></tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-6">
              <h3 className="font-bold text-slate-700 text-sm mb-3">{acEditing ? t('ac_edit_title') : t('ac_add_title')}</h3>
              <form onSubmit={handleSaveAC} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_name')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={acForm.name} onChange={e => setAcForm(p => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 配布員, システム" />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_icon')}</label>
                  <select value={acForm.icon} onChange={e => setAcForm(p => ({ ...p, icon: e.target.value }))} className={inp}>
                    <option value="">{t('none_option')}</option>
                    {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="w-40">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_color')}</label>
                  <select value={acForm.colorCls} onChange={e => setAcForm(p => ({ ...p, colorCls: e.target.value }))} className={inp}>
                    <option value="">{t('none_option')}</option>
                    {COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('label_display_order')}</label>
                  <input type="number" value={acForm.sortOrder} onChange={e => setAcForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inp} />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={acForm.isActive} onChange={e => setAcForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-slate-700">{t('active')}</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  {acEditing && (
                    <button type="button" onClick={() => { setAcEditing(null); setAcForm({ name: '', icon: '', colorCls: '', sortOrder: 100, isActive: true }); }} className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                      {t('btn_cancel')}
                    </button>
                  )}
                  <button type="submit" disabled={acSubmitting} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition flex items-center gap-1.5">
                    {acSubmitting ? t('saving') : acEditing ? t('btn_update') : <><i className="bi bi-plus-lg"></i>{t('btn_add')}</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* アラート定義タブ */}
        {tab === 'alertDefinition' && (() => {
          const DOW_KEYS = ['dow_sun','dow_mon','dow_tue','dow_wed','dow_thu','dow_fri','dow_sat'] as const;
          const SEVERITY_COLORS: Record<string, string> = {
            INFO: 'bg-sky-100 text-sky-700',
            WARNING: 'bg-amber-100 text-amber-700',
            CRITICAL: 'bg-rose-100 text-rose-700',
          };
          return (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-700"><i className="bi bi-bell-fill mr-2"></i>{t('ad_title')}</h2>
                <p className="text-xs text-slate-400 mt-1">{t('ad_desc')}</p>
              </div>
            </div>
            {alertDefinitions.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-400 text-sm">
                {t('empty_ad')}
              </div>
            )}
            {alertDefinitions.map(def => {
              const localTargetIds: number[] = (() => {
                if (!def.targetIds) return [];
                try { const p = JSON.parse(def.targetIds); return Array.isArray(p) ? p : []; } catch { return []; }
              })();
              const monthlyMode = def.scheduleWeekOrdinal != null ? 'weekday' : 'date';
              const selSm = 'border border-slate-200 rounded-lg text-sm px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white';
              return (
                <div key={def.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-opacity ${def.isEnabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                  {/* ── ヘッダー: 名前 + トグル + 保存中 ── */}
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" checked={def.isEnabled} onChange={e => handleSaveAlertDefinition(def.id, { isEnabled: e.target.checked })} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 text-[15px] truncate">{def.name}</h3>
                        {def.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{def.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded">{def.code}</span>
                      {adSaving === def.id && <span className="text-xs text-indigo-500 animate-pulse">{t('saving_ellipsis')}</span>}
                    </div>
                  </div>

                  {/* ── ボディ: 2段構成 ── */}
                  <div className="px-5 py-4 space-y-4">
                    {/* 上段: カテゴリ・重要度・通知 — インライン */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      {/* カテゴリ */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">{t('label_category')}</span>
                        <select value={def.categoryId} onChange={e => handleSaveAlertDefinition(def.id, { categoryId: parseInt(e.target.value) })} className={selSm}>
                          {alertCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {/* 重要度 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">{t('label_severity')}</span>
                        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                          {(['INFO','WARNING','CRITICAL'] as const).map(sev => (
                            <button key={sev} type="button"
                              onClick={() => handleSaveAlertDefinition(def.id, { severity: sev })}
                              className={`px-2.5 py-1 text-xs font-bold transition-colors ${def.severity === sev ? SEVERITY_COLORS[sev] : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                            >{sev}</button>
                          ))}
                        </div>
                      </div>
                      {/* 通知 */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={def.notifyEnabled} onChange={e => handleSaveAlertDefinition(def.id, { notifyEnabled: e.target.checked })} className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-xs text-slate-600">{t('browser_notification')}</span>
                      </label>
                    </div>

                    {/* 下段: スケジュール + 対象 — 2カラム */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* スケジュールセクション */}
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <div className="text-xs font-bold text-slate-500 mb-2.5"><i className="bi bi-clock mr-1"></i>{t('label_schedule')}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {/* 周期 */}
                          <select value={def.frequency} onChange={e => {
                            const freq = e.target.value;
                            const updates: any = { frequency: freq };
                            if (freq === 'DAILY') {
                              updates.scheduleDayOfWeek = null;
                              updates.scheduleDayOfMonth = null;
                              updates.scheduleWeekOrdinal = null;
                            } else if (freq === 'WEEKLY') {
                              updates.scheduleDayOfWeek = def.scheduleDayOfWeek ?? 1;
                              updates.scheduleDayOfMonth = null;
                              updates.scheduleWeekOrdinal = null;
                            } else if (freq === 'MONTHLY') {
                              updates.scheduleDayOfWeek = null;
                              updates.scheduleDayOfMonth = 1;
                              updates.scheduleWeekOrdinal = null;
                            }
                            handleSaveAlertDefinition(def.id, updates);
                          }} className={`${selSm} font-semibold`}>
                            <option value="DAILY">{t('freq_daily')}</option>
                            <option value="WEEKLY">{t('freq_weekly')}</option>
                            <option value="MONTHLY">{t('freq_monthly')}</option>
                          </select>

                          {/* WEEKLY: 曜日ボタン */}
                          {def.frequency === 'WEEKLY' && (
                            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                              {DOW_KEYS.map((key, i) => (
                                <button key={i} type="button"
                                  onClick={() => handleSaveAlertDefinition(def.id, { scheduleDayOfWeek: i })}
                                  className={`w-8 py-1 text-xs font-bold transition-colors ${(def.scheduleDayOfWeek ?? 1) === i ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                >{t(key)}</button>
                              ))}
                            </div>
                          )}

                          {/* MONTHLY: 日付 or 第n X曜日 切替 */}
                          {def.frequency === 'MONTHLY' && (
                            <>
                              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                <button type="button"
                                  onClick={() => {
                                    handleSaveAlertDefinition(def.id, { scheduleDayOfMonth: 1, scheduleWeekOrdinal: null, scheduleDayOfWeek: null });
                                  }}
                                  className={`px-2.5 py-1 text-xs font-bold transition-colors ${monthlyMode === 'date' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                >{t('monthly_by_date')}</button>
                                <button type="button"
                                  onClick={() => {
                                    handleSaveAlertDefinition(def.id, { scheduleDayOfMonth: null, scheduleWeekOrdinal: 1, scheduleDayOfWeek: def.scheduleDayOfWeek ?? 1 });
                                  }}
                                  className={`px-2.5 py-1 text-xs font-bold transition-colors ${monthlyMode === 'weekday' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                >{t('monthly_by_weekday')}</button>
                              </div>
                              {monthlyMode === 'date' ? (
                                <select value={def.scheduleDayOfMonth ?? 1} onChange={e => handleSaveAlertDefinition(def.id, { scheduleDayOfMonth: parseInt(e.target.value) })} className={selSm}>
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                    <option key={d} value={d}>{d}{t('label_day_of_month')}</option>
                                  ))}
                                </select>
                              ) : (
                                <>
                                  <select value={def.scheduleWeekOrdinal ?? 1} onChange={e => handleSaveAlertDefinition(def.id, { scheduleWeekOrdinal: parseInt(e.target.value) })} className={selSm}>
                                    <option value={1}>{t('week_1st')}</option>
                                    <option value={2}>{t('week_2nd')}</option>
                                    <option value={3}>{t('week_3rd')}</option>
                                    <option value={4}>{t('week_4th')}</option>
                                    <option value={-1}>{t('week_last')}</option>
                                  </select>
                                  <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                    {DOW_KEYS.map((key, i) => (
                                      <button key={i} type="button"
                                        onClick={() => handleSaveAlertDefinition(def.id, { scheduleDayOfWeek: i })}
                                        className={`w-8 py-1 text-xs font-bold transition-colors ${(def.scheduleDayOfWeek ?? 1) === i ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                      >{t(key)}</button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </>
                          )}

                          {/* 時刻 (共通) */}
                          <div className="flex items-center gap-1.5">
                            <i className="bi bi-clock text-slate-400 text-xs"></i>
                            <select value={def.scheduleHour ?? 9} onChange={e => handleSaveAlertDefinition(def.id, { scheduleHour: parseInt(e.target.value) })} className={selSm}>
                              {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* 対象セクション */}
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <div className="text-xs font-bold text-slate-500 mb-2.5"><i className="bi bi-people mr-1"></i>{t('label_target_type')}</div>
                        <div className="space-y-2">
                          <select value={def.targetType} onChange={e => handleSaveAlertDefinition(def.id, { targetType: e.target.value, targetIds: null })} className={selSm}>
                            <option value="ALL">{t('target_all')}</option>
                            <option value="ROLE">{t('target_role')}</option>
                            <option value="DEPARTMENT">{t('target_department')}</option>
                            <option value="EMPLOYEE">{t('target_employee')}</option>
                          </select>
                          {def.targetType === 'ROLE' && (
                            <select multiple value={localTargetIds.map(String)} onChange={e => {
                              const selected = Array.from(e.target.selectedOptions, o => parseInt(o.value));
                              handleSaveAlertDefinition(def.id, { targetIds: JSON.stringify(selected) });
                            }} className={`${selSm} w-full min-h-[60px]`}>
                              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          )}
                          {def.targetType === 'DEPARTMENT' && (
                            <select multiple value={localTargetIds.map(String)} onChange={e => {
                              const selected = Array.from(e.target.selectedOptions, o => parseInt(o.value));
                              handleSaveAlertDefinition(def.id, { targetIds: JSON.stringify(selected) });
                            }} className={`${selSm} w-full min-h-[60px]`}>
                              {deptList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          )}
                          {def.targetType === 'EMPLOYEE' && (
                            <select multiple value={localTargetIds.map(String)} onChange={e => {
                              const selected = Array.from(e.target.selectedOptions, o => parseInt(o.value));
                              handleSaveAlertDefinition(def.id, { targetIds: JSON.stringify(selected) });
                            }} className={`${selSm} w-full min-h-[60px]`}>
                              {empList.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          );
        })()}
        {/* 評価設定タブ */}
        {tab === 'evaluation' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-speedometer2 mr-2"></i>{t('eval_title')}</h2>
              <p className="text-xs text-slate-400 mt-1">{t('eval_desc')}</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Score Parameters */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-calculator text-indigo-500"></i> {t('eval_score_params')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('eval_base_score')}</label>
                    <input type="number" value={evalSettings.evalBaseScore}
                      onChange={e => setEvalSettings(p => ({ ...p, evalBaseScore: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('eval_base_score_hint')}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('eval_attendance_bonus')}</label>
                    <input type="number" value={evalSettings.evalAttendanceBonus}
                      onChange={e => setEvalSettings(p => ({ ...p, evalAttendanceBonus: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('eval_attendance_hint')}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('eval_sheets_bonus')}</label>
                    <input type="number" value={evalSettings.evalSheetsBonus}
                      onChange={e => setEvalSettings(p => ({ ...p, evalSheetsBonus: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('eval_sheets_bonus_hint')}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('eval_sheets_unit')}</label>
                    <input type="number" value={evalSettings.evalSheetsBonusUnit}
                      onChange={e => setEvalSettings(p => ({ ...p, evalSheetsBonusUnit: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('eval_sheets_unit_hint')}</p>
                  </div>
                </div>
              </div>

              {/* Rank Thresholds */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-trophy text-amber-500"></i> {t('eval_rank_thresholds')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-yellow-500 text-white text-[10px] font-black mr-1">S</span>
                      {t('eval_rank_s')}
                    </label>
                    <input type="number" value={evalSettings.evalRankS}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankS: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-500 text-white text-[10px] font-black mr-1">A</span>
                      {t('eval_rank_a')}
                    </label>
                    <input type="number" value={evalSettings.evalRankA}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankA: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500 text-white text-[10px] font-black mr-1">B</span>
                      {t('eval_rank_b')}
                    </label>
                    <input type="number" value={evalSettings.evalRankB}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankB: e.target.value }))}
                      className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-400 text-white text-[10px] font-black mr-1">C</span>
                      {t('eval_rank_c')}
                    </label>
                    <input type="number" value={evalSettings.evalRankC}
                      onChange={e => setEvalSettings(p => ({ ...p, evalRankC: e.target.value }))}
                      className={inp} />
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('eval_below_d')}</p>
                  </div>
                </div>
              </div>

              {/* Cycle Day */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-calendar-week text-emerald-500"></i> {t('eval_cycle')}
                </h3>
                <div className="max-w-xs">
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('eval_cycle_day')}</label>
                  <select
                    value={evalSettings.evalCycleDay}
                    onChange={e => setEvalSettings(p => ({ ...p, evalCycleDay: e.target.value }))}
                    className={inp + ' cursor-pointer'}
                  >
                    {WEEK_DAY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t('eval_cycle_hint')}</p>
                </div>
              </div>

              {/* Complaint Type Penalties */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <i className="bi bi-exclamation-triangle text-red-500"></i> {t('eval_penalty_title')}
                </h3>
                <p className="text-[10px] text-slate-400 mb-3">{t('eval_penalty_desc')}</p>
                {complaintTypes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">{t('eval_no_complaint_types')}</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs text-slate-500">
                          <th className="text-left px-4 py-2 font-bold">{t('eval_type_name')}</th>
                          <th className="text-right px-4 py-2 font-bold w-32">{t('eval_penalty_score')}</th>
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
                                    showToast(t('toast_ct_updated'), 'success');
                                  } catch {
                                    showToast(t('toast_update_error'), 'error');
                                  }
                                }}
                                className="w-20 text-right px-2 py-1 border border-slate-200 rounded-lg text-sm font-bold text-red-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-2 text-center text-xs text-slate-400">{t('eval_unit_points')}</td>
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
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> {t('saving_ellipsis')}</>
                  ) : (
                    <><i className="bi bi-check2"></i> {t('eval_save_btn')}</>
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
              <h2 className="font-bold text-slate-700"><i className="bi bi-currency-yen mr-2"></i>{t('rank_rates_title')}</h2>
              <p className="text-xs text-slate-400 mt-1">{t('rank_rates_desc')}</p>
            </div>
            <div className="p-6">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500">
                      <th className="text-left px-4 py-3 font-bold w-24">{t('rank_label')}</th>
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
              <p className="text-[10px] text-slate-400 mt-2">{t('rank_rates_note')}</p>
              <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={saveRankRates}
                  disabled={rankRatesSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {rankRatesSaving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> {t('saving_ellipsis')}</>
                  ) : (
                    <><i className="bi bi-check2"></i> {t('rank_rates_save_btn')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'headerLinks' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-700"><i className="bi bi-link-45deg mr-2"></i>{t('links_title')}</h2>
              <p className="text-xs text-slate-400 mt-1">{t('links_desc')}</p>
            </div>
            <div className="p-6 space-y-3">
              {headerLinks.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <i className="bi bi-link-45deg text-3xl"></i>
                  <p className="mt-2 text-sm">{t('links_empty')}</p>
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
                    placeholder={t('links_display_name')}
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
                <i className="bi bi-plus-lg"></i> {t('links_add_btn')}
              </button>
              <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
                <button
                  onClick={saveHeaderLinks}
                  disabled={headerLinksSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {headerLinksSaving ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> {t('saving_ellipsis')}</>
                  ) : (
                    <><i className="bi bi-check2"></i> {t('links_save_btn')}</>
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
              <i className="bi bi-hourglass-split text-2xl animate-spin mr-3" />{t('loading')}
            </div>
          ) : (
            <div className="space-y-6">
              {([
                { key: 'privacyPolicy', label: t('legal_privacy_policy'), icon: 'bi-shield-lock-fill', color: 'text-slate-600', desc: t('legal_privacy_desc'), path: '/portal/privacy' },
                { key: 'termsOfService', label: t('legal_terms'), icon: 'bi-file-earmark-check-fill', color: 'text-indigo-500', desc: t('legal_terms_desc'), path: '/portal/terms' },
                { key: 'appPrivacyPolicy', label: t('legal_app_privacy'), icon: 'bi-phone-fill', color: 'text-emerald-500', desc: t('legal_app_privacy_desc'), path: '/app-privacy' },
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
                        {legalPreview === item.key ? t('legal_edit') : t('legal_preview')}
                      </button>
                      <a
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        <i className="bi bi-box-arrow-up-right mr-1"></i>{t('legal_view')}
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
                          <p className="text-slate-400 text-sm text-center py-8">{t('legal_no_content')}</p>
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
                        {t('legal_html_hint')}
                      </p>
                      <button
                        onClick={() => handleSaveLegal(item.key)}
                        disabled={legalSaving === item.key}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {legalSaving === item.key ? (
                          <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> {t('saving_ellipsis')}</>
                        ) : (
                          <><i className="bi bi-check2"></i> {t('btn_save')}</>
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
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center -mt-4 mb-3">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-slate-800 text-lg">
                {showModal === 'create' ? t('modal_add') : t('modal_edit')} — {tabs.find(tb => tb.key === tab)?.label}
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
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_code')} <span className="text-slate-400 font-normal text-xs">{t('label_optional')}</span></label>
                    <input type="text" value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value }))} className={inp + ' font-mono'} placeholder="例: DEV, SALES" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_dept_name')} <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 営業部, 開発部" />
                  </div>
                </>
              )}

              {/* 業種 */}
              {tab === 'industry' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_industry_name')} <span className="text-rose-500">*</span></label>
                  <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 飲食, 不動産, 医療" />
                </div>
              )}

              {/* 国 */}
              {tab === 'country' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_code')} <span className="text-rose-500">*</span></label>
                      <input type="text" required maxLength={2} value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value.toUpperCase() }))} className={inp + ' font-mono uppercase'} placeholder="JP, US" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_sort_order')}</label>
                      <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_country_ja')} <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 日本" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_country_en')}<span className="text-slate-400 font-normal text-xs ml-1">{t('label_optional')}</span></label>
                    <input type="text" value={form.nameEn || ''} onChange={e => setForm((p: any) => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="例: Japan" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_aliases')}<span className="text-slate-400 font-normal text-xs ml-1">{t('label_optional')}</span></label>
                    <input type="text" value={form.aliases || ''} onChange={e => setForm((p: any) => ({ ...p, aliases: e.target.value }))} className={inp} placeholder="韓国,大韓民国,Korea" />
                    <p className="text-xs text-slate-400 mt-1">{t('aliases_hint')}</p>
                  </div>
                </>
              )}

              {/* 在留資格 */}
              {tab === 'visaType' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_visa_name')} <span className="text-rose-500">*</span></label>
                      <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 特定技能1号" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_country_en')}</label>
                      <input type="text" value={form.nameEn || ''} onChange={e => setForm((p: any) => ({ ...p, nameEn: e.target.value }))} className={inp} placeholder="例: Specified Skilled Worker Type 1" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('col_work_limit')}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!form.canContract} onChange={e => setForm((p: any) => ({ ...p, canContract: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-slate-700">{t('col_contract')} {t('can')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!form.canPartTime} onChange={e => setForm((p: any) => ({ ...p, canPartTime: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-slate-700">{t('col_parttime')} {t('can')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!form.requiresDesignation} onChange={e => setForm((p: any) => ({ ...p, requiresDesignation: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-slate-700">{t('col_designation')} {t('requires_check')}</span>
                      </label>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">{t('col_work_limit')}</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">{t('week_prefix')}</span>
                          <input type="number" value={form.workHourLimit ?? ''} onChange={e => setForm((p: any) => ({ ...p, workHourLimit: e.target.value }))} className={inp + ' w-20'} min={1} max={168} placeholder="28" />
                          <span className="text-xs text-slate-500">{t('hour_suffix')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_sort_order')}</label>
                    <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                  </div>
                </>
              )}

              {/* 銀行 */}
              {tab === 'bank' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_code')} <span className="text-rose-500">*</span></label>
                      <input type="text" required value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value }))} className={inp + ' font-mono'} placeholder="例: 0001" maxLength={10} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_sort_order')}</label>
                      <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_bank_name')} <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: みずほ銀行" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_kana')}<span className="text-slate-400 font-normal text-xs ml-1">{t('label_optional')}</span></label>
                    <input type="text" value={form.nameKana || ''} onChange={e => setForm((p: any) => ({ ...p, nameKana: e.target.value }))} className={inp} placeholder="例: ミズホギンコウ" />
                  </div>
                </>
              )}

              {/* 配布方法 */}
              {tab === 'distributionMethod' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_method_name')} <span className="text-rose-500">*</span></label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} placeholder="例: 軒並み配布" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_capacity_target')} <span className="text-rose-500">*</span></label>
                    <select value={form.capacityType || 'all'} onChange={e => setForm((p: any) => ({ ...p, capacityType: e.target.value }))} className={inp}>
                      <option value="all">{t('capacity_all')}</option>
                      <option value="detached">{t('capacity_detached')}</option>
                      <option value="apartment">{t('capacity_apartment')}</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">配布可能世帯数の算出に使う世帯の種類を指定します。</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('col_price_addon')}</label>
                      <input type="number" step="0.01" value={form.priceAddon ?? 0} onChange={e => setForm((p: any) => ({ ...p, priceAddon: e.target.value }))} className={inp} placeholder="0.00" />
                      <p className="text-[10px] text-slate-400 mt-1">エリア単価への加算額。0で加算なし。</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">{t('label_sort_order')}</label>
                      <input type="number" value={form.sortOrder ?? 100} onChange={e => setForm((p: any) => ({ ...p, sortOrder: e.target.value }))} className={inp} min={1} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="isActive" checked={form.isActive ?? true} onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                    <label htmlFor="isActive" className="text-sm font-bold text-slate-700 cursor-pointer">{t('active')}</label>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(null)} className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm">{t('btn_cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm disabled:opacity-50">
                  {isSubmitting ? t('saving') : t('btn_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
