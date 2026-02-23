'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { handlePhoneChange } from '@/lib/formatters';

// ===========================
// Types
// ===========================
interface ContactData {
  id: number;
  lastName: string;
  firstName: string;
  lastNameKana: string | null;
  firstNameKana: string | null;
  department: string | null;
  position: string | null;
  email: string | null;
  mobilePhone: string | null;
  directLine: string | null;
  isPrimary: boolean;
  isBillingContact: boolean;
  notifyOrderStatus: boolean;
  notifyQrScan: boolean;
  defaultDeliveryAddressId: number | null;
}

interface DeliveryAddressData {
  id: number;
  label: string;
  organizationName: string | null;
  recipientName: string | null;
  postalCode: string | null;
  address: string | null;
  addressBuilding: string | null;
  phone: string | null;
}

type CustomerType = 'COMPANY' | 'INDIVIDUAL';

// ===========================
// Section IDs & Tab Config
// ===========================
type SectionId = 'company' | 'contacts' | 'delivery' | 'notifications' | 'billing' | 'security';

interface SectionConfig {
  id: SectionId;
  label: string;
  icon: string;
}

function getSections(customerType: CustomerType): SectionConfig[] {
  if (customerType === 'INDIVIDUAL') {
    return [
      { id: 'company', label: '基本情報', icon: 'bi-person' },
      { id: 'delivery', label: '納品先住所', icon: 'bi-geo-alt' },
      { id: 'notifications', label: '通知設定', icon: 'bi-bell' },
      { id: 'billing', label: '請求設定', icon: 'bi-credit-card' },
      { id: 'security', label: 'セキュリティ', icon: 'bi-shield-lock' },
    ];
  }
  return [
    { id: 'company', label: '会社情報', icon: 'bi-building' },
    { id: 'contacts', label: '担当者', icon: 'bi-people' },
    { id: 'delivery', label: '納品先住所', icon: 'bi-geo-alt' },
    { id: 'notifications', label: '通知設定', icon: 'bi-bell' },
    { id: 'billing', label: '請求設定', icon: 'bi-credit-card' },
    { id: 'security', label: 'セキュリティ', icon: 'bi-shield-lock' },
  ];
}

// ===========================
// Main Page
// ===========================
export default function PortalSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionId>('company');
  const [customerType, setCustomerType] = useState<CustomerType>('COMPANY');
  const [isPrimary, setIsPrimary] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/portal/login');
  }, [status, router]);

  // Fetch customerType and isPrimary once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portal/settings/contacts');
        if (res.ok) {
          const data = await res.json();
          setCustomerType(data.customerType || 'COMPANY');
          setIsPrimary(data.currentContactIsPrimary || false);
        }
      } catch (e) { console.error(e); }
      setMetaLoading(false);
    })();
  }, []);

  if (status === 'loading' || metaLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }
  if (!session) return null;

  const sections = getSections(customerType);

  // Ensure activeSection is valid for this customerType
  if (!sections.find(s => s.id === activeSection)) {
    setActiveSection(sections[0].id);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <i className="bi bi-gear-fill text-indigo-600"></i> 設定
          </h1>
          <p className="text-sm text-slate-500 mt-1">アカウント・{customerType === 'INDIVIDUAL' ? '基本' : '会社'}情報の管理</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar (desktop) / Horizontal tabs (mobile) */}
          <nav className="md:w-56 shrink-0">
            {/* Mobile: horizontal scroll */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                    activeSection === s.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <i className={`bi ${s.icon} mr-1.5`}></i>{s.label}
                </button>
              ))}
            </div>
            {/* Desktop: vertical sidebar */}
            <div className="hidden md:flex flex-col gap-1 bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors text-left ${
                    activeSection === s.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <i className={`bi ${s.icon} text-lg`}></i>{s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeSection === 'company' && <CompanySection customerType={customerType} />}
            {activeSection === 'contacts' && <ContactsSection customerType={customerType} isPrimary={isPrimary} />}
            {activeSection === 'delivery' && <DeliveryAddressesSection />}
            {activeSection === 'notifications' && <NotificationsSection />}
            {activeSection === 'billing' && <BillingSection />}
            {activeSection === 'security' && <SecuritySection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================
// Postal Code Utility
// ===========================
async function lookupPostalCode(digits: string): Promise<{ formatted: string; address: string } | null> {
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 200 || !data.results?.length) return null;
    const r = data.results[0];
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    const address = `${r.address1}${r.address2}${r.address3}`;
    return { formatted, address };
  } catch {
    return null;
  }
}

function handlePostalCodeInput(
  raw: string,
  setPostalCode: (v: string) => void,
  setAddress: (v: string) => void
) {
  // Allow only digits and hyphens
  const cleaned = raw.replace(/[^\d-]/g, '');
  const digits = cleaned.replace(/-/g, '');

  if (digits.length <= 3) {
    setPostalCode(digits);
  } else if (digits.length <= 7) {
    setPostalCode(`${digits.slice(0, 3)}-${digits.slice(3)}`);
  } else {
    setPostalCode(`${digits.slice(0, 3)}-${digits.slice(3, 7)}`);
  }

  if (digits.length === 7) {
    lookupPostalCode(digits).then(result => {
      if (result) {
        setPostalCode(result.formatted);
        setAddress(result.address);
      }
    });
  }
}

// ===========================
// Shared Components
// ===========================
function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-lg font-black text-slate-800">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2"
    >
      {loading ? (
        <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>保存中...</>
      ) : (
        <><i className="bi bi-check-lg"></i>保存</>
      )}
    </button>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-4 ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
    }`}>
      <i className={`bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}></i>
      {message}
    </div>
  );
}

const inputClass = 'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white';
const inputCompactClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white';
const selectClass = 'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white appearance-none';

// ===========================
// 1. Company Section
// ===========================
function CompanySection({ customerType }: { customerType: CustomerType }) {
  const isIndividual = customerType === 'INDIVIDUAL';
  const [form, setForm] = useState({ name: '', nameKana: '', postalCode: '', address: '', addressBuilding: '', phone: '', fax: '', industryId: '' });
  const [industries, setIndustries] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portal/settings/company');
        if (res.ok) {
          const data = await res.json();
          const c = data.customer;
          if (c) {
            setForm({
              name: c.name || '',
              nameKana: c.nameKana || '',
              postalCode: c.postalCode || '',
              address: c.address || '',
              addressBuilding: c.addressBuilding || '',
              phone: c.phone || '',
              fax: c.fax || '',
              industryId: c.industryId?.toString() || '',
            });
          }
          setIndustries(data.industries || []);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/portal/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: isIndividual ? '基本情報を保存しました' : '会社情報を保存しました', type: 'success' });
      } else {
        setToast({ message: data.error || 'エラーが発生しました', type: 'error' });
      }
    } catch { setToast({ message: 'エラーが発生しました', type: 'error' }); }
    setSaving(false);
  };

  if (loading) return <SectionSkeleton />;

  return (
    <>
      <SectionCard
        title={isIndividual ? '基本情報' : '会社情報'}
        description={isIndividual ? '基本情報を管理します' : '会社の基本情報を管理します'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <FormField label={isIndividual ? 'お名前' : '会社名'} required>
              <input className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label={isIndividual ? 'お名前（カナ）' : '会社名（カナ）'}>
              <input className={inputClass} value={form.nameKana} onChange={e => setForm({ ...form, nameKana: e.target.value })} placeholder={isIndividual ? 'ヤマダ タロウ' : 'カブシキガイシャ...'} />
            </FormField>
          </div>
          {!isIndividual && (
            <FormField label="業種">
              <select className={selectClass} value={form.industryId} onChange={e => setForm({ ...form, industryId: e.target.value })}>
                <option value="">選択してください</option>
                {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="郵便番号">
            <input
              className={inputClass}
              value={form.postalCode}
              onChange={e => handlePostalCodeInput(
                e.target.value,
                v => setForm(f => ({ ...f, postalCode: v })),
                v => setForm(f => ({ ...f, address: v }))
              )}
              placeholder="123-4567"
              maxLength={8}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="住所">
              <input className={inputClass} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="建物名">
              <input className={inputClass} value={form.addressBuilding} onChange={e => setForm({ ...form, addressBuilding: e.target.value })} />
            </FormField>
          </div>
          <FormField label="電話番号">
            <input className={inputClass} value={form.phone} onChange={e => handlePhoneChange(e.target.value, v => setForm(f => ({ ...f, phone: v })))} placeholder="03-1234-5678" maxLength={13} />
          </FormField>
          {!isIndividual && (
            <FormField label="FAX番号">
              <input className={inputClass} value={form.fax} onChange={e => handlePhoneChange(e.target.value, v => setForm(f => ({ ...f, fax: v })))} placeholder="03-1234-5679" maxLength={13} />
            </FormField>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <SaveButton loading={saving} onClick={handleSave} />
        </div>
      </SectionCard>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

// ===========================
// 2. Contacts Section
// ===========================
function ContactsSection({ customerType, isPrimary }: { customerType: CustomerType; isPrimary: boolean }) {
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [currentContactId, setCurrentContactId] = useState<number | null>(null);
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ContactData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const [contactsRes, addrRes] = await Promise.all([
        fetch('/api/portal/settings/contacts'),
        fetch('/api/portal/settings/delivery-addresses'),
      ]);
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        setContacts(data.contacts || []);
        setCurrentContactId(data.currentContactId);
      }
      if (addrRes.ok) {
        const data = await addrRes.json();
        setDeliveryAddresses(data.addresses || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleDelete = async (id: number) => {
    if (!confirm('この担当者を削除してよろしいですか？')) return;
    try {
      const res = await fetch(`/api/portal/settings/contacts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: '担当者を削除しました', type: 'success' });
        fetchContacts();
      } else {
        setToast({ message: data.error || '削除に失敗しました', type: 'error' });
      }
    } catch { setToast({ message: 'エラーが発生しました', type: 'error' }); }
  };

  if (loading) return <SectionSkeleton />;

  return (
    <>
      <SectionCard title="担当者管理" description="ポータルにログインできる担当者を管理します">
        {/* 権限なしの場合の注意メッセージ */}
        {!isPrimary && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
            <i className="bi bi-info-circle-fill text-amber-500"></i>
            担当者の追加・編集・削除は主担当のみ操作できます。
          </div>
        )}

        {isPrimary && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditTarget(null); setShowModal(true); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <i className="bi bi-plus-lg"></i>担当者を追加
            </button>
          </div>
        )}
        <div className="space-y-3">
          {contacts.map(c => (
            <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                  {c.lastName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{c.lastName} {c.firstName}</span>
                    {c.isPrimary && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full">主担当</span>}
                    {c.isBillingContact && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full">請求担当</span>}
                    {c.id === currentContactId && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full">自分</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {[c.department, c.position].filter(Boolean).join(' / ') || '—'}
                    {c.email && <span className="ml-2">{c.email}</span>}
                  </div>
                </div>
              </div>
              {isPrimary && (
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={() => { setEditTarget(c); setShowModal(true); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="編集"
                  >
                    <i className="bi bi-pencil-square"></i>
                  </button>
                  {c.id !== currentContactId && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <i className="bi bi-trash3"></i>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-8">担当者が登録されていません</div>
          )}
        </div>
      </SectionCard>

      {showModal && (
        <ContactModal
          editTarget={editTarget}
          customerType={customerType}
          deliveryAddresses={deliveryAddresses}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchContacts(); setToast({ message: editTarget ? '担当者を更新しました' : '担当者を追加しました', type: 'success' }); }}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

function ContactModal({ editTarget, customerType, deliveryAddresses, onClose, onSaved, onError }: {
  editTarget: ContactData | null;
  customerType: CustomerType;
  deliveryAddresses: DeliveryAddressData[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!editTarget;
  const isCompany = customerType === 'COMPANY';
  const [form, setForm] = useState({
    lastName: editTarget?.lastName || '',
    firstName: editTarget?.firstName || '',
    lastNameKana: editTarget?.lastNameKana || '',
    firstNameKana: editTarget?.firstNameKana || '',
    department: editTarget?.department || '',
    position: editTarget?.position || '',
    email: editTarget?.email || '',
    mobilePhone: editTarget?.mobilePhone || '',
    directLine: editTarget?.directLine || '',
    isPrimary: editTarget?.isPrimary || false,
    isBillingContact: editTarget?.isBillingContact || false,
    defaultDeliveryAddressId: editTarget?.defaultDeliveryAddressId?.toString() || '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/portal/settings/contacts/${editTarget.id}` : '/api/portal/settings/contacts';
      const method = isEdit ? 'PUT' : 'POST';
      const payload: Record<string, unknown> = { ...form };
      if (isEdit) delete payload.password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved();
      } else {
        onError(data.error || 'エラーが発生しました');
      }
    } catch { onError('エラーが発生しました'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-800">{isEdit ? '担当者を編集' : '担当者を追加'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg text-lg"></i></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {/* Row 1: 姓 名 */}
          <div className="grid grid-cols-2 gap-3">
            <FormFieldCompact label="姓" required>
              <input className={inputCompactClass} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </FormFieldCompact>
            <FormFieldCompact label="名" required>
              <input className={inputCompactClass} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </FormFieldCompact>
          </div>
          {/* Row 2: 姓カナ 名カナ */}
          <div className="grid grid-cols-2 gap-3">
            <FormFieldCompact label="姓（カナ）">
              <input className={inputCompactClass} value={form.lastNameKana} onChange={e => setForm({ ...form, lastNameKana: e.target.value })} />
            </FormFieldCompact>
            <FormFieldCompact label="名（カナ）">
              <input className={inputCompactClass} value={form.firstNameKana} onChange={e => setForm({ ...form, firstNameKana: e.target.value })} />
            </FormFieldCompact>
          </div>
          {/* Row 3: メールアドレス */}
          <FormFieldCompact label="メールアドレス" required>
            <input type="email" className={inputCompactClass} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </FormFieldCompact>
          {/* Row 4: 携帯電話 直通電話 */}
          <div className="grid grid-cols-2 gap-3">
            <FormFieldCompact label="携帯電話">
              <input className={inputCompactClass} value={form.mobilePhone} onChange={e => handlePhoneChange(e.target.value, v => setForm(f => ({ ...f, mobilePhone: v })))} placeholder="090-1234-5678" maxLength={13} />
            </FormFieldCompact>
            <FormFieldCompact label="直通電話">
              <input className={inputCompactClass} value={form.directLine} onChange={e => handlePhoneChange(e.target.value, v => setForm(f => ({ ...f, directLine: v })))} placeholder="03-1234-5678" maxLength={13} />
            </FormFieldCompact>
          </div>
          {/* Row 5: 部署 役職 (COMPANYのみ) */}
          {isCompany && (
            <div className="grid grid-cols-2 gap-3">
              <FormFieldCompact label="部署">
                <input className={inputCompactClass} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
              </FormFieldCompact>
              <FormFieldCompact label="役職">
                <input className={inputCompactClass} value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
              </FormFieldCompact>
            </div>
          )}
          {/* Row 6: チェックボックス */}
          <div className="flex gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={form.isPrimary} onChange={e => setForm({ ...form, isPrimary: e.target.checked })} />
              主担当
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={form.isBillingContact} onChange={e => setForm({ ...form, isBillingContact: e.target.checked })} />
              請求担当
            </label>
          </div>
          {/* Row 7: デフォルト納品先 (編集時のみ、住所あれば) */}
          {isEdit && deliveryAddresses.length > 0 && (
            <FormFieldCompact label="デフォルト納品先">
              <select
                className={inputCompactClass + ' appearance-none'}
                value={form.defaultDeliveryAddressId}
                onChange={e => setForm({ ...form, defaultDeliveryAddressId: e.target.value })}
              >
                <option value="">未設定</option>
                {deliveryAddresses.map(a => (
                  <option key={a.id} value={a.id}>{a.label}{a.address ? ` (${a.address})` : ''}</option>
                ))}
              </select>
            </FormFieldCompact>
          )}
          {/* Row 8: 初期パスワード (新規時のみ) */}
          {!isEdit && (
            <FormFieldCompact label="初期パスワード" required>
              <input type="password" className={inputCompactClass} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="8文字以上" />
            </FormFieldCompact>
          )}
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">キャンセル</button>
          <SaveButton loading={saving} onClick={handleSubmit} />
        </div>
      </div>
    </div>
  );
}

function FormFieldCompact({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ===========================
// 2.5 Delivery Addresses Section
// ===========================
function DeliveryAddressesSection() {
  const [addresses, setAddresses] = useState<DeliveryAddressData[]>([]);
  const [myDefaultId, setMyDefaultId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<DeliveryAddressData | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [defaultOrganizationName, setDefaultOrganizationName] = useState('');
  const [defaultRecipientName, setDefaultRecipientName] = useState('');

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/settings/delivery-addresses');
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
        setMyDefaultId(data.myDefaultDeliveryAddressId || null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  // 新規追加時のデフォルト値を取得（担当者名・会社名）
  useEffect(() => {
    (async () => {
      try {
        const [contactsRes, companyRes] = await Promise.all([
          fetch('/api/portal/settings/contacts'),
          fetch('/api/portal/settings/company'),
        ]);
        if (contactsRes.ok) {
          const contactsData = await contactsRes.json();
          const currentId = contactsData.currentContactId;
          const currentContact = contactsData.contacts?.find((c: any) => c.id === currentId);
          if (currentContact) {
            setDefaultRecipientName(`${currentContact.lastName} ${currentContact.firstName}`);
          }
          if (contactsData.customerType === 'COMPANY' && companyRes.ok) {
            const companyData = await companyRes.json();
            setDefaultOrganizationName(companyData.customer?.name || '');
          }
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const handleDelete = async (id: number) => {
    if (!confirm('この納品先住所を削除してよろしいですか？')) return;
    try {
      const res = await fetch(`/api/portal/settings/delivery-addresses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: '納品先住所を削除しました', type: 'success' });
        fetchAddresses();
      } else {
        setToast({ message: data.error || '削除に失敗しました', type: 'error' });
      }
    } catch { setToast({ message: 'エラーが発生しました', type: 'error' }); }
  };

  const handleSetDefault = async (id: number) => {
    try {
      const addr = addresses.find(a => a.id === id);
      if (!addr) return;
      const res = await fetch(`/api/portal/settings/delivery-addresses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addr, setAsMyDefault: true }),
      });
      if (res.ok) {
        setMyDefaultId(id);
        setToast({ message: 'デフォルト納品先を設定しました', type: 'success' });
      }
    } catch { setToast({ message: 'エラーが発生しました', type: 'error' }); }
  };

  if (loading) return <SectionSkeleton />;

  return (
    <>
      <SectionCard title="納品先住所" description="サンプル送付先などの納品先住所を管理します">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <i className="bi bi-plus-lg"></i>住所を追加
          </button>
        </div>
        <div className="space-y-3">
          {addresses.map(a => (
            <div key={a.id} className={`p-4 rounded-xl border ${myDefaultId === a.id ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-800 text-sm">{a.label}</span>
                    {myDefaultId === a.id && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full">デフォルト</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    {(a.organizationName || a.recipientName) && (
                      <div className="font-medium text-slate-600">
                        {[a.organizationName, a.recipientName].filter(Boolean).join('　')}
                      </div>
                    )}
                    {a.postalCode && <div>〒{a.postalCode}</div>}
                    {a.address && <div>{a.address}{a.addressBuilding ? ` ${a.addressBuilding}` : ''}</div>}
                    {a.phone && <div><i className="bi bi-telephone text-[10px] mr-1"></i>{a.phone}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {myDefaultId !== a.id && (
                    <button
                      onClick={() => handleSetDefault(a.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs"
                      title="デフォルトに設定"
                    >
                      <i className="bi bi-star"></i>
                    </button>
                  )}
                  <button
                    onClick={() => { setEditTarget(a); setShowModal(true); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="編集"
                  >
                    <i className="bi bi-pencil-square"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="削除"
                  >
                    <i className="bi bi-trash3"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
          {addresses.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-8">
              <i className="bi bi-geo-alt text-2xl text-slate-300 block mb-2"></i>
              納品先住所が登録されていません
            </div>
          )}
        </div>
      </SectionCard>

      {showModal && (
        <DeliveryAddressModal
          editTarget={editTarget}
          defaultOrganizationName={defaultOrganizationName}
          defaultRecipientName={defaultRecipientName}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAddresses(); setToast({ message: editTarget ? '住所を更新しました' : '住所を追加しました', type: 'success' }); }}
          onError={(msg) => setToast({ message: msg, type: 'error' })}
        />
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

function DeliveryAddressModal({ editTarget, defaultOrganizationName, defaultRecipientName, onClose, onSaved, onError }: {
  editTarget: DeliveryAddressData | null;
  defaultOrganizationName: string;
  defaultRecipientName: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!editTarget;
  const [form, setForm] = useState({
    label: editTarget?.label || '',
    organizationName: editTarget ? (editTarget.organizationName || '') : defaultOrganizationName,
    recipientName: editTarget ? (editTarget.recipientName || '') : defaultRecipientName,
    postalCode: editTarget?.postalCode || '',
    address: editTarget?.address || '',
    addressBuilding: editTarget?.addressBuilding || '',
    phone: editTarget?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.recipientName.trim()) {
      onError('宛先名は必須です');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? `/api/portal/settings/delivery-addresses/${editTarget.id}` : '/api/portal/settings/delivery-addresses';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved();
      } else {
        onError(data.error || 'エラーが発生しました');
      }
    } catch { onError('エラーが発生しました'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-800">{isEdit ? '納品先住所を編集' : '納品先住所を追加'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg text-lg"></i></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <FormFieldCompact label="ラベル名" required>
            <input className={inputCompactClass} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="本社、支社A、自宅 など" />
          </FormFieldCompact>
          <div className="grid grid-cols-2 gap-3">
            <FormFieldCompact label="組織名">
              <input className={inputCompactClass} value={form.organizationName} onChange={e => setForm({ ...form, organizationName: e.target.value })} placeholder="株式会社〇〇" />
            </FormFieldCompact>
            <FormFieldCompact label="宛先名" required>
              <input className={inputCompactClass} value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} placeholder="山田 太郎" />
            </FormFieldCompact>
          </div>
          <FormFieldCompact label="郵便番号">
            <input
              className={inputCompactClass}
              value={form.postalCode}
              onChange={e => handlePostalCodeInput(
                e.target.value,
                v => setForm(f => ({ ...f, postalCode: v })),
                v => setForm(f => ({ ...f, address: v }))
              )}
              placeholder="123-4567"
              maxLength={8}
            />
          </FormFieldCompact>
          <FormFieldCompact label="住所">
            <input className={inputCompactClass} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="東京都新宿区..." />
          </FormFieldCompact>
          <FormFieldCompact label="建物名">
            <input className={inputCompactClass} value={form.addressBuilding} onChange={e => setForm({ ...form, addressBuilding: e.target.value })} placeholder="〇〇ビル 3F" />
          </FormFieldCompact>
          <FormFieldCompact label="電話番号">
            <input className={inputCompactClass} value={form.phone} onChange={e => handlePhoneChange(e.target.value, v => setForm(f => ({ ...f, phone: v })))} placeholder="03-1234-5678" maxLength={13} />
          </FormFieldCompact>
        </div>
        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">キャンセル</button>
          <SaveButton loading={saving} onClick={handleSubmit} />
        </div>
      </div>
    </div>
  );
}

// ===========================
// 3. Notifications Section
// ===========================
function NotificationsSection() {
  const [wantsNewsletter, setWantsNewsletter] = useState(true);
  const [notifyOrderStatus, setNotifyOrderStatus] = useState(true);
  const [notifyQrScan, setNotifyQrScan] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portal/settings/notifications');
        if (res.ok) {
          const data = await res.json();
          setWantsNewsletter(data.wantsNewsletter);
          setNotifyOrderStatus(data.notifyOrderStatus);
          setNotifyQrScan(data.notifyQrScan);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/portal/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wantsNewsletter, notifyOrderStatus, notifyQrScan }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: '通知設定を保存しました', type: 'success' });
      } else {
        setToast({ message: data.error || 'エラーが発生しました', type: 'error' });
      }
    } catch { setToast({ message: 'エラーが発生しました', type: 'error' }); }
    setSaving(false);
  };

  if (loading) return <SectionSkeleton />;

  return (
    <>
      <SectionCard title="メルマガ・通知設定" description="メールマガジンや各種通知の受信設定を管理します">
        <div className="space-y-4">
          <ToggleCard
            icon="bi-envelope-paper"
            title="メールマガジン"
            description="キャンペーンや新サービスの情報をメールでお届けします"
            checked={wantsNewsletter}
            onChange={setWantsNewsletter}
          />
          <ToggleCard
            icon="bi-box-seam"
            title="発注ステータス変更通知"
            description="発注のステータスが更新された際にメールで通知します"
            checked={notifyOrderStatus}
            onChange={setNotifyOrderStatus}
          />
          <ToggleCard
            icon="bi-qr-code-scan"
            title="QRコードスキャン通知"
            description="QRコードがスキャンされた際にメールで通知します"
            checked={notifyQrScan}
            onChange={setNotifyQrScan}
          />
        </div>
        <div className="mt-6 flex justify-end">
          <SaveButton loading={saving} onClick={handleSave} />
        </div>
      </SectionCard>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

function ToggleCard({ icon, title, description, checked, onChange }: {
  icon: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <i className={`bi ${icon} text-lg`}></i>
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500 mt-0.5">{description}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 ml-3 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// ===========================
// 4. Billing Section
// ===========================
function BillingSection() {
  const [form, setForm] = useState({
    invoiceRegistrationNumber: '',
    billingCutoffDay: '',
    paymentMonthDelay: '',
    paymentDay: '',
    defaultPaymentMethod: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portal/settings/billing');
        if (res.ok) {
          const data = await res.json();
          const b = data.billing;
          if (b) {
            setForm({
              invoiceRegistrationNumber: b.invoiceRegistrationNumber || '',
              billingCutoffDay: b.billingCutoffDay?.toString() || '',
              paymentMonthDelay: b.paymentMonthDelay?.toString() || '',
              paymentDay: b.paymentDay?.toString() || '',
              defaultPaymentMethod: b.defaultPaymentMethod || '',
            });
          }
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/portal/settings/billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: '請求設定を保存しました', type: 'success' });
      } else {
        setToast({ message: data.error || 'エラーが発生しました', type: 'error' });
      }
    } catch { setToast({ message: 'エラーが発生しました', type: 'error' }); }
    setSaving(false);
  };

  if (loading) return <SectionSkeleton />;

  const cutoffOptions = [
    { value: '', label: '選択してください' },
    { value: '15', label: '15日' },
    { value: '20', label: '20日' },
    { value: '25', label: '25日' },
    { value: '99', label: '末日' },
  ];
  const paymentDayOptions = [
    { value: '', label: '選択してください' },
    { value: '15', label: '15日' },
    { value: '20', label: '20日' },
    { value: '25', label: '25日' },
    { value: '99', label: '末日' },
  ];
  const delayOptions = [
    { value: '', label: '選択してください' },
    { value: '0', label: '当月' },
    { value: '1', label: '翌月' },
    { value: '2', label: '翌々月' },
  ];

  return (
    <>
      <SectionCard title="請求・支払い設定" description="インボイス登録番号や支払い条件を設定します">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <FormField label="インボイス登録番号">
              <input
                className={inputClass}
                value={form.invoiceRegistrationNumber}
                onChange={e => setForm({ ...form, invoiceRegistrationNumber: e.target.value })}
                placeholder="T1234567890123"
                maxLength={14}
              />
              <p className="text-xs text-slate-400 mt-1">T + 13桁の数字（例: T1234567890123）</p>
            </FormField>
          </div>
          <FormField label="締め日">
            <select className={selectClass} value={form.billingCutoffDay} onChange={e => setForm({ ...form, billingCutoffDay: e.target.value })}>
              {cutoffOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="支払月">
            <select className={selectClass} value={form.paymentMonthDelay} onChange={e => setForm({ ...form, paymentMonthDelay: e.target.value })}>
              {delayOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="支払日">
            <select className={selectClass} value={form.paymentDay} onChange={e => setForm({ ...form, paymentDay: e.target.value })}>
              {paymentDayOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="デフォルト支払方法">
            <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  checked={form.defaultPaymentMethod === 'credit_card'}
                  onChange={() => setForm({ ...form, defaultPaymentMethod: 'credit_card' })}
                />
                クレジットカード
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  checked={form.defaultPaymentMethod === 'bank_transfer'}
                  onChange={() => setForm({ ...form, defaultPaymentMethod: 'bank_transfer' })}
                />
                銀行振込
              </label>
            </div>
          </FormField>
        </div>
        <div className="mt-6 flex justify-end">
          <SaveButton loading={saving} onClick={handleSave} />
        </div>
      </SectionCard>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

// ===========================
// 5. Security Section
// ===========================
function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/portal/settings/password');
        if (res.ok) {
          const data = await res.json();
          setHasPassword(data.hasPassword);
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[\d\W_]/.test(pw)) score++;
    return score;
  };

  const strength = passwordStrength(form.newPassword);
  const strengthLabel = ['', '弱い', 'やや弱い', '普通', '強い'][strength] || '';
  const strengthColor = ['', 'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500'][strength] || '';

  const handleSave = async () => {
    if (form.newPassword !== form.confirmPassword) {
      setToast({ message: '新しいパスワードが一致しません', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/portal/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ message: 'パスワードを変更しました', type: 'success' });
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setToast({ message: data.error || 'エラーが発生しました', type: 'error' });
      }
    } catch { setToast({ message: 'エラーが発生しました', type: 'error' }); }
    setSaving(false);
  };

  if (hasPassword === null) return <SectionSkeleton />;

  if (!hasPassword) {
    return (
      <SectionCard title="パスワード変更" description="ログインパスワードを変更します">
        <div className="flex items-start gap-4 p-4 bg-sky-50 border border-sky-200 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <i className="bi bi-google text-lg"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-sky-800">Googleアカウントでサインインしています</p>
            <p className="text-xs text-sky-600 mt-1">パスワードの設定・変更はGoogleアカウントの設定から行ってください。</p>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard title="パスワード変更" description="ログインパスワードを変更します">
        <div className="max-w-md space-y-5">
          <FormField label="現在のパスワード" required>
            <input type="password" className={inputClass} value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} />
          </FormField>
          <FormField label="新しいパスワード" required>
            <input type="password" className={inputClass} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
            {form.newPassword && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">強度: {strengthLabel}</p>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">8文字以上、大文字・小文字・数字または記号を含む</p>
          </FormField>
          <FormField label="新しいパスワード（確認）" required>
            <input type="password" className={inputClass} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-rose-500 mt-1">パスワードが一致しません</p>
            )}
          </FormField>
        </div>
        <div className="mt-6 flex justify-end">
          <SaveButton loading={saving} onClick={handleSave} />
        </div>
      </SectionCard>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

// ===========================
// Loading Skeleton
// ===========================
function SectionSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse">
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="h-5 bg-slate-200 rounded w-32"></div>
        <div className="h-3 bg-slate-100 rounded w-48 mt-2"></div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="h-10 bg-slate-100 rounded-xl"></div>
        <div className="h-10 bg-slate-100 rounded-xl"></div>
        <div className="h-10 bg-slate-100 rounded-xl"></div>
      </div>
    </div>
  );
}
