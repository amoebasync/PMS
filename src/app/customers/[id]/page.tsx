'use client';

import React, { useState, useEffect, use, useMemo, useRef } from 'react';
import Link from 'next/link';
import { handlePostalInput, handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';

// ─── 型定義 ───────────────────────────────────────────────
type Employee = { id: number; lastNameJa: string; firstNameJa: string; isActive?: boolean };
type AcquisitionChannel = 'EC' | 'SALES' | 'REFERRAL' | 'INQUIRY';

const CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  EC: 'EC', SALES: '営業', REFERRAL: '紹介', INQUIRY: '問い合わせ',
};
const CHANNEL_COLORS: Record<AcquisitionChannel, string> = {
  EC: 'bg-violet-100 text-violet-700',
  SALES: 'bg-blue-100 text-blue-700',
  REFERRAL: 'bg-emerald-100 text-emerald-700',
  INQUIRY: 'bg-amber-100 text-amber-700',
};

type Customer = {
  id: number;
  customerCode: string;
  customerType: 'COMPANY' | 'INDIVIDUAL';
  name: string;
  nameKana: string | null;
  salesRepId: number | null;
  salesRep?: Employee;
  parentCustomerId: number | null;
  parentCustomer?: { id: number; name: string; customerCode: string } | null;
  billingCustomerId: number | null;
  billingCustomer?: { id: number; name: string; customerCode: string } | null;
  invoiceRegistrationNumber: string | null;
  billingCutoffDay: number | null;
  paymentMonthDelay: number | null;
  paymentDay: number | null;
  postalCode: string | null;
  address: string | null;
  addressBuilding: string | null;
  phone: string | null;
  fax: string | null;
  status: 'VALID' | 'INVALID';
  note: string | null;
  acquisitionChannel: AcquisitionChannel | null;
  campaignId: number | null;
  campaign?: { id: number; name: string } | null;
  contacts: Contact[];
  tasks: Task[];
};

type Contact = {
  id: number;
  lastName: string; firstName: string;
  lastNameKana: string | null; firstNameKana: string | null;
  department: string | null; position: string | null;
  email: string | null; mobilePhone: string | null; directLine: string | null;
  isPrimary: boolean; isBillingContact: boolean;
  mustChangePassword: boolean; lastLoginAt: string | null;
};

type Activity = {
  id: number; type: string; subject: string; body: string | null;
  activityAt: string; nextAction: string | null; employee: Employee | null;
};

type Task = {
  id: number; title: string; dueDate: string;
  priority: string; status: string; assignee: Employee | null;
};

// ─── 小コンポーネント ─────────────────────────────────────
const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white';
const labelCls = 'block text-xs font-bold text-slate-500 mb-1.5';

function SectionDivider({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3 first:mt-0">
      <span className="w-0.5 h-3.5 bg-blue-400 rounded-full"></span>
      <i className={`bi ${icon} text-xs text-slate-400`}></i>
      <span className="text-xs font-bold text-slate-500">{label}</span>
    </div>
  );
}

function InfoRow({ label, value, mono = false, badge }: {
  label: string; value?: React.ReactNode; mono?: boolean; badge?: React.ReactNode;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-slate-700 flex-1 leading-relaxed ${mono ? 'font-mono text-xs bg-slate-50 px-1.5 py-0.5 rounded' : ''}`}>
        {value}
      </span>
      {badge}
    </div>
  );
}

// ─── CustomerCombobox ──────────────────────────────────────
type ComboCustomer = { id: number; name: string; nameKana: string; customerCode: string };

function CustomerCombobox({
  value, onSelect, onClear, customers, excludeId,
  placeholder = '会社名・コードで検索...',
}: {
  value: string; onSelect: (id: string) => void; onClear: () => void;
  customers: ComboCustomer[]; excludeId?: number | null; placeholder?: string;
}) {
  const [inputText, setInputText] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = value ? customers.find(c => c.id.toString() === value) : null;

  const suggestions = useMemo(() => {
    if (!inputText.trim()) return [];
    const q = inputText.toLowerCase();
    return customers
      .filter(c => !excludeId || c.id !== excludeId)
      .filter(c => c.name.toLowerCase().includes(q) || (c.nameKana && c.nameKana.toLowerCase().includes(q)) || c.customerCode.toLowerCase().includes(q))
      .slice(0, 8);
  }, [inputText, customers, excludeId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 border border-blue-200 rounded-lg px-3 py-2 bg-blue-50">
        <span className="text-sm font-bold text-blue-800 flex-1 truncate">{selected.name}</span>
        <span className="text-[11px] text-blue-400 shrink-0">{selected.customerCode}</span>
        <button type="button" onClick={() => { onClear(); setInputText(''); }} className="text-slate-400 hover:text-slate-600 shrink-0 ml-1">
          <i className="bi bi-x"></i>
        </button>
      </div>
    );
  }
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none"></i>
        <input type="text" value={inputText}
          onChange={e => { setInputText(e.target.value); setOpen(true); }}
          onFocus={() => { if (inputText) setOpen(true); }}
          className={inputCls + ' pl-8'} placeholder={placeholder} autoComplete="off" />
      </div>
      {open && inputText.trim() !== '' && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {suggestions.length > 0 ? suggestions.map(c => (
            <li key={c.id}>
              <button type="button"
                onMouseDown={e => { e.preventDefault(); onSelect(c.id.toString()); setInputText(''); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between gap-2 border-b border-slate-50 last:border-0">
                <span className="font-bold text-slate-800 truncate">{c.name}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{c.customerCode}</span>
              </button>
            </li>
          )) : (
            <li className="px-4 py-3 text-sm text-slate-400">該当する顧客が見つかりません</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── 定数 ─────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { value: 'CALL', label: '電話', icon: 'bi-telephone-fill', color: 'bg-blue-100 text-blue-600' },
  { value: 'VISIT', label: '訪問', icon: 'bi-geo-alt-fill', color: 'bg-green-100 text-green-600' },
  { value: 'EMAIL', label: 'メール', icon: 'bi-envelope-fill', color: 'bg-yellow-100 text-yellow-600' },
  { value: 'ONLINE', label: 'オンライン', icon: 'bi-camera-video-fill', color: 'bg-purple-100 text-purple-600' },
  { value: 'NOTE', label: 'メモ', icon: 'bi-sticky-fill', color: 'bg-slate-100 text-slate-600' },
];
const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  HIGH: { label: '高', cls: 'bg-red-100 text-red-700' },
  MEDIUM: { label: '中', cls: 'bg-yellow-100 text-yellow-700' },
  LOW: { label: '低', cls: 'bg-green-100 text-green-700' },
};
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '未着手', cls: 'bg-slate-100 text-slate-700' },
  IN_PROGRESS: { label: '進行中', cls: 'bg-blue-100 text-blue-700' },
  DONE: { label: '完了', cls: 'bg-green-100 text-green-700' },
};
function getActivityConfig(type: string) {
  return ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[4];
}

const emptyContactForm = {
  lastName: '', firstName: '', lastNameKana: '', firstNameKana: '',
  department: '', position: '', email: '', mobilePhone: '', directLine: '',
  isPrimary: false, isBillingContact: false,
};

// ─── メインページ ──────────────────────────────────────────
export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { showToast, showConfirm } = useNotification();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'activities' | 'orders'>('info');

  // --- 活動フォーム ---
  const initialActivityForm = { type: 'CALL', subject: '', body: '', activityAt: new Date().toISOString().slice(0, 16), nextAction: '' };
  const [activityForm, setActivityForm] = useState(initialActivityForm);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);

  // --- 担当者モーダル ---
  const [contactModal, setContactModal] = useState<{ open: boolean; mode: 'add' | 'edit'; contact: typeof emptyContactForm & { id?: number } }>({ open: false, mode: 'add', contact: emptyContactForm });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState('');
  const [resendingId, setResendingId] = useState<number | null>(null);

  // --- 編集モーダル ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editCustomers, setEditCustomers] = useState<ComboCustomer[]>([]);
  const [editEmployees, setEditEmployees] = useState<Employee[]>([]);
  const [editCampaigns, setEditCampaigns] = useState<{ id: number; name: string }[]>([]);
  const [editForm, setEditForm] = useState({
    customerCode: '', name: '', nameKana: '', customerType: 'COMPANY',
    salesRepId: '', parentCustomerId: '', billingCustomerId: '',
    invoiceRegistrationNumber: '', billingCutoffDay: '', paymentMonthDelay: '1', paymentDay: '',
    postalCode: '', address: '', addressBuilding: '',
    phone: '', fax: '', note: '', status: 'VALID', acquisitionChannel: '', campaignId: '',
  });

  // ─── データ取得 ───
  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [custRes, actRes, contactsRes] = await Promise.all([
        fetch(`/api/customers/${id}`),
        fetch(`/api/customers/${id}/activities`),
        fetch(`/api/customers/${id}/contacts`),
      ]);
      if (custRes.ok) setCustomer(await custRes.json());
      if (actRes.ok) setActivities(await actRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  // ─── 編集モーダルを開く ───
  const openEditModal = async () => {
    if (!customer) return;
    setEditError('');
    setEditForm({
      customerCode: customer.customerCode,
      name: customer.name,
      nameKana: customer.nameKana || '',
      customerType: customer.customerType,
      salesRepId: customer.salesRepId?.toString() || '',
      parentCustomerId: customer.parentCustomerId?.toString() || '',
      billingCustomerId: customer.billingCustomerId?.toString() || '',
      invoiceRegistrationNumber: customer.invoiceRegistrationNumber || '',
      billingCutoffDay: customer.billingCutoffDay?.toString() || '',
      paymentMonthDelay: customer.paymentMonthDelay?.toString() || '1',
      paymentDay: customer.paymentDay?.toString() || '',
      postalCode: customer.postalCode || '',
      address: customer.address || '',
      addressBuilding: customer.addressBuilding || '',
      phone: customer.phone || '',
      fax: customer.fax || '',
      note: customer.note || '',
      status: customer.status,
      acquisitionChannel: customer.acquisitionChannel || '',
      campaignId: customer.campaignId?.toString() || '',
    });
    setIsEditModalOpen(true);

    setEditLoading(true);
    try {
      const [custRes, empRes, campRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/employees'),
        fetch('/api/campaigns'),
      ]);
      if (custRes.ok) { const d = await custRes.json(); setEditCustomers(Array.isArray(d) ? d : []); }
      if (empRes.ok) { const d = await empRes.json(); setEditEmployees(Array.isArray(d) ? d.filter((e: any) => e.isActive) : []); }
      if (campRes.ok) { const d = await campRes.json(); setEditCampaigns(Array.isArray(d) ? d.filter((c: any) => c.isActive) : []); }
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };
  const handleEditPostal = (raw: string) => {
    handlePostalInput(raw,
      v => setEditForm(prev => ({ ...prev, postalCode: v })),
      v => setEditForm(prev => ({ ...prev, address: v })),
    );
  };
  const handleEditPhone = (name: 'phone' | 'fax', raw: string) => {
    handlePhoneChange(raw, v => setEditForm(prev => ({ ...prev, [name]: v })));
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error || '保存に失敗しました');
        return;
      }
      setIsEditModalOpen(false);
      fetchAll();
    } finally {
      setEditSaving(false);
    }
  };

  // ─── 活動ハンドラ ───
  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.subject.trim()) return;
    setIsSubmittingActivity(true);
    try {
      const res = await fetch(`/api/customers/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityForm),
      });
      if (res.ok) { const newActivity = await res.json(); setActivities(prev => [newActivity, ...prev]); setActivityForm(initialActivityForm); }
    } finally {
      setIsSubmittingActivity(false);
    }
  };
  const handleDeleteActivity = async (activityId: number) => {
    if (!await showConfirm('この活動履歴を削除しますか？', { variant: 'danger', confirmLabel: '削除する' })) return;
    const res = await fetch(`/api/customers/${id}/activities/${activityId}`, { method: 'DELETE' });
    if (res.ok) setActivities(prev => prev.filter(a => a.id !== activityId));
  };

  // ─── 担当者ハンドラ ───
  const openAddContact = () => { setContactError(''); setContactModal({ open: true, mode: 'add', contact: emptyContactForm }); };
  const openEditContact = (c: Contact) => {
    setContactError('');
    setContactModal({ open: true, mode: 'edit', contact: { id: c.id, lastName: c.lastName, firstName: c.firstName, lastNameKana: c.lastNameKana || '', firstNameKana: c.firstNameKana || '', department: c.department || '', position: c.position || '', email: c.email || '', mobilePhone: c.mobilePhone || '', directLine: c.directLine || '', isPrimary: c.isPrimary, isBillingContact: c.isBillingContact } });
  };
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true); setContactError('');
    try {
      const { id: contactId, ...data } = contactModal.contact;
      const isEdit = contactModal.mode === 'edit' && contactId !== undefined;
      const url = isEdit ? `/api/customers/${id}/contacts/${contactId}` : `/api/customers/${id}/contacts`;
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { setContactError(result.error || 'エラーが発生しました'); return; }
      if (isEdit) setContacts(prev => prev.map(c => c.id === contactId ? result : c));
      else setContacts(prev => [...prev, result]);
      setContactModal({ open: false, mode: 'add', contact: emptyContactForm });
    } finally {
      setContactSubmitting(false);
    }
  };
  const handleDeleteContact = async (contactId: number) => {
    if (!await showConfirm('この担当者を削除しますか？', { variant: 'danger', confirmLabel: '削除する' })) return;
    const res = await fetch(`/api/customers/${id}/contacts/${contactId}`, { method: 'DELETE' });
    if (res.ok) setContacts(prev => prev.filter(c => c.id !== contactId));
    else { const d = await res.json(); showToast(d.error || '削除に失敗しました', 'error'); }
  };
  const handleResend = async (contactId: number) => {
    if (!await showConfirm('認証情報を再生成してメールを再送しますか？', { variant: 'primary', confirmLabel: '再送する', title: '認証情報の再送' })) return;
    setResendingId(contactId);
    try {
      const res = await fetch(`/api/customers/${id}/contacts/${contactId}/resend`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { showToast('認証情報を再送しました', 'success'); setContacts(prev => prev.map(c => c.id === contactId ? { ...c, mustChangePassword: true } : c)); }
      else showToast(data.error || '再送に失敗しました', 'error');
    } finally { setResendingId(null); }
  };

  // ─── ローディング / 404 ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">顧客が見つかりませんでした</p>
        <Link href="/customers" className="text-blue-600 hover:underline mt-2 inline-block">一覧に戻る</Link>
      </div>
    );
  }

  // ─── レンダリング ─────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12 max-w-7xl mx-auto animate-in fade-in duration-300">

      {/* パンくず */}
      <Link href="/customers" className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm w-fit">
        <i className="bi bi-arrow-left"></i> 顧客一覧
      </Link>

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            {/* アイコン */}
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
              <i className={`bi ${customer.customerType === 'COMPANY' ? 'bi-buildings-fill' : 'bi-person-fill'} text-2xl text-blue-500`}></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-slate-800">{customer.name}</h1>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${customer.status === 'VALID' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${customer.status === 'VALID' ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                  {customer.status === 'VALID' ? '有効' : '無効'}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {customer.customerType === 'COMPANY' ? '法人' : '個人'}
                </span>
                {customer.acquisitionChannel && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CHANNEL_COLORS[customer.acquisitionChannel]}`}>
                    {CHANNEL_LABELS[customer.acquisitionChannel]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{customer.customerCode}</span>
                {customer.nameKana && <span>{customer.nameKana}</span>}
                {customer.salesRep && (
                  <span className="flex items-center gap-1">
                    <i className="bi bi-person-circle text-blue-400"></i>
                    {customer.salesRep.lastNameJa} {customer.salesRep.firstNameJa}
                  </span>
                )}
                {customer.campaign && (
                  <span className="flex items-center gap-1">
                    <i className="bi bi-megaphone text-violet-400"></i>
                    {customer.campaign.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={openEditModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
          >
            <i className="bi bi-pencil-square"></i> 顧客情報を編集
          </button>
        </div>
      </div>

      {/* メインレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* 左カラム（2/3） */}
        <div className="lg:col-span-2 space-y-4">
          {/* タブ */}
          <div className="flex gap-0 border-b border-slate-200 bg-white rounded-t-xl">
            {([
              { key: 'info', icon: 'bi-building', label: '顧客情報' },
              { key: 'activities', icon: 'bi-clock-history', label: '活動履歴' },
              { key: 'orders', icon: 'bi-briefcase', label: '受注履歴' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <i className={`bi ${tab.icon}`}></i>{tab.label}
              </button>
            ))}
          </div>

          {/* ── 顧客情報タブ ── */}
          {activeTab === 'info' && (
            <div className="bg-white rounded-b-xl rounded-tr-xl border border-slate-200 shadow-sm p-6 space-y-1">

              <SectionDivider icon="bi-building" label="会社情報" />
              <InfoRow label="顧客コード" value={customer.customerCode} mono />
              <InfoRow label="会社名（カナ）" value={customer.nameKana} />
              <InfoRow label="顧客区分" value={customer.customerType === 'COMPANY' ? '法人' : '個人'} />
              <InfoRow label="担当営業" value={customer.salesRep ? `${customer.salesRep.lastNameJa} ${customer.salesRep.firstNameJa}` : undefined} />
              <InfoRow label="流入経路" value={
                customer.acquisitionChannel
                  ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${CHANNEL_COLORS[customer.acquisitionChannel]}`}>{CHANNEL_LABELS[customer.acquisitionChannel]}</span>
                  : undefined
              } />
              <InfoRow label="キャンペーン" value={customer.campaign?.name} />
              <InfoRow label="ステータス" value={
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${customer.status === 'VALID' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${customer.status === 'VALID' ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                  {customer.status === 'VALID' ? '有効' : '無効'}
                </span>
              } />

              <SectionDivider icon="bi-geo-alt" label="所在地・連絡先" />
              {(customer.postalCode || customer.address) && (
                <InfoRow label="住所" value={
                  <span>
                    {customer.postalCode && <span className="text-slate-400 mr-1">〒{customer.postalCode}</span>}
                    {customer.address}
                    {customer.addressBuilding && <span className="text-slate-500"> {customer.addressBuilding}</span>}
                  </span>
                } />
              )}
              <InfoRow label="電話番号" value={customer.phone} />
              <InfoRow label="FAX" value={customer.fax} />

              <SectionDivider icon="bi-currency-yen" label="取引条件・インボイス" />
              <InfoRow label="インボイス番号" value={customer.invoiceRegistrationNumber} mono />
              <InfoRow label="締日" value={customer.billingCutoffDay != null ? (customer.billingCutoffDay === 99 ? '月末' : `${customer.billingCutoffDay}日`) : undefined} />
              <InfoRow label="支払サイト" value={customer.paymentMonthDelay != null ? `翌${customer.paymentMonthDelay}ヶ月` : undefined} />
              <InfoRow label="支払日" value={customer.paymentDay != null ? (customer.paymentDay === 99 ? '月末' : `${customer.paymentDay}日`) : undefined} />

              <SectionDivider icon="bi-diagram-3" label="関係" />
              <InfoRow label="親顧客" value={
                customer.parentCustomer
                  ? <Link href={`/customers/${customer.parentCustomer.id}`} className="text-blue-600 hover:underline flex items-center gap-1 w-fit">
                      {customer.parentCustomer.name}
                      <span className="text-[11px] text-slate-400 font-mono">({customer.parentCustomer.customerCode})</span>
                    </Link>
                  : undefined
              } />
              <InfoRow label="請求先" value={
                customer.billingCustomer
                  ? <Link href={`/customers/${customer.billingCustomer.id}`} className="text-blue-600 hover:underline flex items-center gap-1 w-fit">
                      {customer.billingCustomer.name}
                      <span className="text-[11px] text-slate-400 font-mono">({customer.billingCustomer.customerCode})</span>
                    </Link>
                  : undefined
              } />

              {customer.note && (
                <>
                  <SectionDivider icon="bi-sticky" label="備考" />
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-4">{customer.note}</p>
                </>
              )}

              {/* 全項目が空の場合 */}
              {!customer.postalCode && !customer.address && !customer.phone && !customer.fax
                && !customer.invoiceRegistrationNumber && !customer.billingCutoffDay
                && !customer.parentCustomer && !customer.billingCustomer && !customer.note && (
                <p className="text-slate-400 text-sm text-center py-4">追加情報は未登録です</p>
              )}
            </div>
          )}

          {/* ── 活動履歴タブ ── */}
          {activeTab === 'activities' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                  <i className="bi bi-plus-circle-fill text-blue-500"></i> 活動を記録
                </h3>
                <form onSubmit={handleSubmitActivity} className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {ACTIVITY_TYPES.map(t => (
                      <button key={t.value} type="button"
                        onClick={() => setActivityForm(f => ({ ...f, type: t.value }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${activityForm.type === t.value ? `${t.color} border-current` : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                        <i className={`bi ${t.icon}`}></i> {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>件名 <span className="text-red-500">*</span></label>
                      <input type="text" value={activityForm.subject} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))} placeholder="例: 提案内容のフォローアップ" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                    </div>
                    <div>
                      <label className={labelCls}>日時 <span className="text-red-500">*</span></label>
                      <input type="datetime-local" value={activityForm.activityAt} onChange={e => setActivityForm(f => ({ ...f, activityAt: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>詳細</label>
                    <textarea value={activityForm.body} onChange={e => setActivityForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="活動の詳細を記録..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className={labelCls}>次のアクション</label>
                    <input type="text" value={activityForm.nextAction} onChange={e => setActivityForm(f => ({ ...f, nextAction: e.target.value }))} placeholder="例: 来週再度フォローアップ" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={isSubmittingActivity} className="bg-blue-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                      {isSubmittingActivity ? '登録中...' : '登録'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-3">
                {activities.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    <i className="bi bi-clock-history text-3xl mb-2 block"></i>活動履歴がありません
                  </div>
                ) : activities.map(activity => {
                  const cfg = getActivityConfig(activity.type);
                  const date = new Date(activity.activityAt);
                  return (
                    <div key={activity.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex gap-4 group">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${cfg.color}`}>
                        <i className={`bi ${cfg.icon}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{activity.subject}</span>
                            <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <button onClick={() => handleDeleteActivity(activity.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 text-sm">
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {date.toLocaleDateString('ja-JP')} {date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          {activity.employee && ` · ${activity.employee.lastNameJa} ${activity.employee.firstNameJa}`}
                        </div>
                        {activity.body && <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">{activity.body}</p>}
                        {activity.nextAction && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg w-fit">
                            <i className="bi bi-arrow-right-circle-fill"></i>{activity.nextAction}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 受注履歴タブ ── */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
              <i className="bi bi-briefcase text-3xl mb-2 block"></i>
              <p className="text-sm">受注履歴は受注管理ページで確認できます</p>
              <Link href={`/orders?customerId=${customer.id}`} className="mt-2 inline-block text-blue-600 hover:underline text-sm">
                受注管理を開く →
              </Link>
            </div>
          )}
        </div>

        {/* 右カラム（1/3） */}
        <div className="space-y-4">

          {/* 担当者パネル */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="bi bi-people-fill text-slate-500"></i> 担当者
                <span className="text-[11px] font-normal text-slate-400">({contacts.length}名)</span>
              </h3>
              <button onClick={openAddContact} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                <i className="bi bi-plus-lg"></i> 追加
              </button>
            </div>
            {contacts.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-4">担当者が登録されていません</p>
            ) : (
              <div className="space-y-3">
                {contacts.map(contact => (
                  <div key={contact.id} className="group border border-slate-100 rounded-xl p-3 hover:border-slate-200 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0">
                          <i className="bi bi-person text-sm"></i>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 text-sm flex items-center gap-1 flex-wrap">
                            {contact.lastName} {contact.firstName}
                            {contact.isPrimary && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">主</span>}
                            {contact.isBillingContact && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-bold">請求</span>}
                            {contact.mustChangePassword && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">PW未変更</span>}
                            {!contact.lastLoginAt && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">未ログイン</span>}
                          </div>
                          {(contact.department || contact.position) && <div className="text-xs text-slate-500 mt-0.5">{contact.department}{contact.department && contact.position ? ' / ' : ''}{contact.position}</div>}
                          {contact.email && <div className="text-xs text-slate-500 truncate">{contact.email}</div>}
                          {contact.mobilePhone && <div className="text-xs text-slate-500">{contact.mobilePhone}</div>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditContact(contact)} className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1"><i className="bi bi-pencil"></i> 編集</button>
                        {contact.email && (
                          <button onClick={() => handleResend(contact.id)} disabled={resendingId === contact.id} className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 disabled:opacity-50">
                            <i className="bi bi-envelope-arrow-up"></i> 再送
                          </button>
                        )}
                        <button onClick={() => handleDeleteContact(contact.id)} className="text-[11px] text-slate-500 hover:text-red-600 flex items-center gap-1"><i className="bi bi-trash"></i> 削除</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* タスクパネル */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i className="bi bi-check2-all text-slate-500"></i> 関連タスク
              </h3>
              <Link href={`/crm/tasks?customerId=${customer.id}`} className="text-xs text-blue-600 hover:underline">すべて見る</Link>
            </div>
            {customer.tasks && customer.tasks.length > 0 ? (
              <div className="space-y-2">
                {customer.tasks.slice(0, 5).map(task => {
                  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
                  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
                  const isOverdue = task.status !== 'DONE' && new Date(task.dueDate) < new Date();
                  return (
                    <div key={task.id} className="flex items-start gap-2 text-sm py-1.5 border-b border-slate-50 last:border-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${priorityCfg.cls}`}>{priorityCfg.label}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${task.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.title}</p>
                        <p className={`text-[11px] ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                          {new Date(task.dueDate).toLocaleDateString('ja-JP')}{isOverdue && ' ⚠ 期限超過'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${statusCfg.cls}`}>{statusCfg.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-xs text-center py-3">タスクなし</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== 顧客情報編集モーダル ===== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <i className="bi bi-pencil-square text-blue-600"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">顧客情報を編集</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{customer.name}</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {editLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <form onSubmit={handleEditSave} className="p-6 space-y-7">
                {editError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold flex items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-rose-500"></i>{editError}
                  </div>
                )}

                {/* 基本情報 */}
                <section>
                  <div className="flex items-center gap-2 mb-4"><span className="w-0.5 h-4 bg-blue-500 rounded-full"></span><i className="bi bi-building text-sm text-slate-400"></i><h4 className="text-sm font-bold text-slate-700">基本情報</h4></div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4">
                      <label className={labelCls}>顧客コード <span className="text-red-500">*</span></label>
                      <input name="customerCode" required value={editForm.customerCode} onChange={handleEditInput} className={inputCls} />
                    </div>
                    <div className="col-span-8">
                      <label className={labelCls}>会社名・屋号 <span className="text-red-500">*</span></label>
                      <input name="name" required value={editForm.name} onChange={handleEditInput} className={inputCls} />
                    </div>
                    <div className="col-span-8">
                      <label className={labelCls}>会社名（カナ）</label>
                      <input name="nameKana" value={editForm.nameKana} onChange={handleEditInput} className={inputCls} />
                    </div>
                    <div className="col-span-4">
                      <label className={labelCls}>ステータス</label>
                      <select name="status" value={editForm.status} onChange={handleEditInput} className={inputCls}>
                        <option value="VALID">有効</option><option value="INVALID">無効</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className={labelCls}>担当営業</label>
                      <select name="salesRepId" value={editForm.salesRepId} onChange={handleEditInput} className={inputCls}>
                        <option value="">未設定</option>
                        {editEmployees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className={labelCls}>流入経路</label>
                      <select name="acquisitionChannel" value={editForm.acquisitionChannel} onChange={handleEditInput} className={inputCls}>
                        <option value="">未設定</option>
                        <option value="EC">EC</option><option value="SALES">営業</option>
                        <option value="REFERRAL">紹介</option><option value="INQUIRY">問い合わせ</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      <label className={labelCls}>キャンペーン</label>
                      <select name="campaignId" value={editForm.campaignId} onChange={handleEditInput} className={inputCls}>
                        <option value="">なし</option>
                        {editCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </section>

                {/* 所在地 */}
                <section>
                  <div className="flex items-center gap-2 mb-4"><span className="w-0.5 h-4 bg-blue-500 rounded-full"></span><i className="bi bi-geo-alt text-sm text-slate-400"></i><h4 className="text-sm font-bold text-slate-700">所在地・連絡先</h4></div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className={labelCls}>郵便番号</label>
                      <input name="postalCode" value={editForm.postalCode} onChange={e => handleEditPostal(e.target.value)} className={inputCls} placeholder="123-4567" maxLength={8} />
                    </div>
                    <div className="col-span-9">
                      <label className={labelCls}>住所</label>
                      <input name="address" value={editForm.address} onChange={handleEditInput} className={inputCls} placeholder="郵便番号入力で自動補完" />
                    </div>
                    <div className="col-span-12">
                      <label className={labelCls}>建物名・階数</label>
                      <input name="addressBuilding" value={editForm.addressBuilding} onChange={handleEditInput} className={inputCls} placeholder="〇〇ビル 3F" />
                    </div>
                    <div className="col-span-6">
                      <label className={labelCls}>電話番号</label>
                      <input name="phone" value={editForm.phone} onChange={e => handleEditPhone('phone', e.target.value)} className={inputCls} placeholder="03-0000-0000" maxLength={13} />
                    </div>
                    <div className="col-span-6">
                      <label className={labelCls}>FAX</label>
                      <input name="fax" value={editForm.fax} onChange={e => handleEditPhone('fax', e.target.value)} className={inputCls} placeholder="03-0000-0001" maxLength={13} />
                    </div>
                  </div>
                </section>

                {/* 取引条件 */}
                <section>
                  <div className="flex items-center gap-2 mb-4"><span className="w-0.5 h-4 bg-blue-500 rounded-full"></span><i className="bi bi-currency-yen text-sm text-slate-400"></i><h4 className="text-sm font-bold text-slate-700">取引条件・インボイス</h4></div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-5">
                      <label className={labelCls}>インボイス登録番号</label>
                      <input name="invoiceRegistrationNumber" value={editForm.invoiceRegistrationNumber} onChange={handleEditInput} className={inputCls} placeholder="T1234567890123" />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>締日 <span className="text-[10px] font-normal text-slate-400">(99=末)</span></label>
                      <input type="number" name="billingCutoffDay" value={editForm.billingCutoffDay} onChange={handleEditInput} className={inputCls} min={1} max={99} />
                    </div>
                    <div className="col-span-3">
                      <label className={labelCls}>支払サイト <span className="text-[10px] font-normal text-slate-400">(月)</span></label>
                      <input type="number" name="paymentMonthDelay" value={editForm.paymentMonthDelay} onChange={handleEditInput} className={inputCls} min={0} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>支払日 <span className="text-[10px] font-normal text-slate-400">(99=末)</span></label>
                      <input type="number" name="paymentDay" value={editForm.paymentDay} onChange={handleEditInput} className={inputCls} min={1} max={99} />
                    </div>
                  </div>
                </section>

                {/* 関係・備考 */}
                <section>
                  <div className="flex items-center gap-2 mb-4"><span className="w-0.5 h-4 bg-blue-500 rounded-full"></span><i className="bi bi-diagram-3 text-sm text-slate-400"></i><h4 className="text-sm font-bold text-slate-700">関係・備考</h4></div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <label className={labelCls}>親顧客 <span className="text-[10px] font-normal text-slate-400">(チェーン本部など)</span></label>
                      <CustomerCombobox
                        value={editForm.parentCustomerId}
                        onSelect={v => setEditForm(prev => ({ ...prev, parentCustomerId: v }))}
                        onClear={() => setEditForm(prev => ({ ...prev, parentCustomerId: '' }))}
                        customers={editCustomers}
                        excludeId={customer.id}
                      />
                    </div>
                    <div className="col-span-6">
                      <label className={labelCls}>請求先 <span className="text-[10px] font-normal text-slate-400">(他社に請求する場合)</span></label>
                      <CustomerCombobox
                        value={editForm.billingCustomerId}
                        onSelect={v => setEditForm(prev => ({ ...prev, billingCustomerId: v }))}
                        onClear={() => setEditForm(prev => ({ ...prev, billingCustomerId: '' }))}
                        customers={editCustomers}
                        excludeId={customer.id}
                      />
                    </div>
                    <div className="col-span-12">
                      <label className={labelCls}>備考</label>
                      <textarea name="note" value={editForm.note} onChange={handleEditInput} rows={3} className={inputCls + ' resize-none'} placeholder="特記事項など..." />
                    </div>
                  </div>
                </section>

                <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
                  <button type="submit" disabled={editSaving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all disabled:opacity-60 flex items-center gap-2">
                    {editSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>保存中...</> : <><i className="bi bi-check-lg"></i>変更を保存</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== 担当者追加/編集モーダル ===== */}
      {contactModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-base">{contactModal.mode === 'add' ? '担当者を追加' : '担当者を編集'}</h2>
              <button onClick={() => setContactModal({ open: false, mode: 'add', contact: emptyContactForm })} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg text-lg"></i></button>
            </div>
            <form onSubmit={handleContactSubmit} className="p-5 space-y-4">
              {contactError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold"><i className="bi bi-exclamation-triangle-fill mr-2"></i>{contactError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>姓 <span className="text-red-500">*</span></label><input type="text" required value={contactModal.contact.lastName} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, lastName: e.target.value } }))} className={inputCls} placeholder="山田" /></div>
                <div><label className={labelCls}>名 <span className="text-red-500">*</span></label><input type="text" required value={contactModal.contact.firstName} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, firstName: e.target.value } }))} className={inputCls} placeholder="太郎" /></div>
                <div><label className={labelCls}>姓（カナ）</label><input type="text" value={contactModal.contact.lastNameKana} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, lastNameKana: e.target.value } }))} className={inputCls} placeholder="ヤマダ" /></div>
                <div><label className={labelCls}>名（カナ）</label><input type="text" value={contactModal.contact.firstNameKana} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, firstNameKana: e.target.value } }))} className={inputCls} placeholder="タロウ" /></div>
                <div><label className={labelCls}>部署</label><input type="text" value={contactModal.contact.department} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, department: e.target.value } }))} className={inputCls} placeholder="営業部" /></div>
                <div><label className={labelCls}>役職</label><input type="text" value={contactModal.contact.position} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, position: e.target.value } }))} className={inputCls} placeholder="課長" /></div>
              </div>
              <div><label className={labelCls}>メールアドレス</label><input type="email" value={contactModal.contact.email} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, email: e.target.value } }))} className={inputCls} placeholder="taro@example.com" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>携帯電話</label><input type="tel" value={contactModal.contact.mobilePhone} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, mobilePhone: e.target.value } }))} className={inputCls} placeholder="090-0000-0000" /></div>
                <div><label className={labelCls}>直通電話</label><input type="tel" value={contactModal.contact.directLine} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, directLine: e.target.value } }))} className={inputCls} placeholder="03-0000-0000" /></div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={contactModal.contact.isPrimary} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, isPrimary: e.target.checked } }))} className="w-4 h-4 rounded accent-blue-600" /><span className="text-sm text-slate-700">主担当</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={contactModal.contact.isBillingContact} onChange={e => setContactModal(m => ({ ...m, contact: { ...m.contact, isBillingContact: e.target.checked } }))} className="w-4 h-4 rounded accent-emerald-600" /><span className="text-sm text-slate-700">請求先担当</span></label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setContactModal({ open: false, mode: 'add', contact: emptyContactForm })} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors">キャンセル</button>
                <button type="submit" disabled={contactSubmitting} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-60">
                  {contactSubmitting ? '保存中...' : (contactModal.mode === 'add' ? '追加する' : '更新する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
