'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { handlePostalInput, handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';

// --- 型定義 ---
type Employee = { id: number; lastNameJa: string; firstNameJa: string; isActive: boolean; };
type Campaign = { id: number; name: string; };
type AcquisitionChannel = 'EC' | 'SALES' | 'REFERRAL' | 'INQUIRY';

type Customer = {
  id: number;
  customerCode: string;
  name: string;
  nameKana: string;
  salesRepId: number | null;
  salesRep?: Employee;
  parentCustomerId: number | null;
  billingCustomerId: number | null;
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
};

const CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  EC: 'EC', SALES: '営業', REFERRAL: '紹介', INQUIRY: '問い合わせ',
};
const CHANNEL_COLORS: Record<AcquisitionChannel, string> = {
  EC: 'bg-violet-100 text-violet-700',
  SALES: 'bg-blue-100 text-blue-700',
  REFERRAL: 'bg-emerald-100 text-emerald-700',
  INQUIRY: 'bg-amber-100 text-amber-700',
};

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white';
const labelCls = 'block text-xs font-bold text-slate-500 mb-1.5';

// ─── 顧客インクリメンタル検索コンボボックス ───
function CustomerCombobox({
  value,
  onSelect,
  onClear,
  customers,
  excludeId,
  placeholder = '会社名・コードで検索...',
}: {
  value: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  customers: Customer[];
  excludeId?: number | null;
  placeholder?: string;
}) {
  const [inputText, setInputText] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = value ? customers.find(c => c.id.toString() === value) : null;

  const suggestions = useMemo(() => {
    if (!inputText.trim()) return [];
    const q = inputText.toLowerCase();
    return customers
      .filter(c => (!excludeId || c.id !== excludeId))
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.nameKana && c.nameKana.toLowerCase().includes(q)) ||
        c.customerCode.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [inputText, customers, excludeId]);

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 border border-blue-200 rounded-lg px-3 py-2 bg-blue-50">
        <span className="text-sm font-bold text-blue-800 flex-1 truncate">{selected.name}</span>
        <span className="text-[11px] text-blue-400 shrink-0">{selected.customerCode}</span>
        <button
          type="button"
          onClick={() => { onClear(); setInputText(''); }}
          className="text-slate-400 hover:text-slate-600 shrink-0 ml-1"
        >
          <i className="bi bi-x"></i>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs pointer-events-none"></i>
        <input
          type="text"
          value={inputText}
          onChange={e => { setInputText(e.target.value); setOpen(true); }}
          onFocus={() => { if (inputText) setOpen(true); }}
          className={inputCls + ' pl-8'}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      {open && inputText.trim() !== '' && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {suggestions.length > 0 ? (
            suggestions.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    onSelect(c.id.toString());
                    setInputText('');
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between gap-2 border-b border-slate-50 last:border-0"
                >
                  <span className="font-bold text-slate-800 truncate">{c.name}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{c.customerCode}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-slate-400">該当する顧客が見つかりません</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── セクションヘッダー ───
function SectionHeader({ icon, label, color = 'default' }: { icon: string; label: string; color?: 'default' | 'indigo' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={`w-0.5 h-4 rounded-full ${color === 'indigo' ? 'bg-indigo-500' : 'bg-blue-500'}`}></span>
      <i className={`bi ${icon} text-sm ${color === 'indigo' ? 'text-indigo-400' : 'text-slate-400'}`}></i>
      <h4 className={`text-sm font-bold ${color === 'indigo' ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</h4>
    </div>
  );
}

// ─── フォーム初期値 ───
const initialCustomerForm = {
  customerCode: '', name: '', nameKana: '',
  salesRepId: '', parentCustomerId: '', billingCustomerId: '',
  invoiceRegistrationNumber: '',
  billingCutoffDay: '', paymentMonthDelay: '1', paymentDay: '',
  postalCode: '', address: '', addressBuilding: '',
  phone: '', fax: '', note: '',
  status: 'VALID', acquisitionChannel: '', campaignId: '',
};

const initialContactForm = {
  lastName: '', firstName: '', lastNameKana: '', firstNameKana: '',
  department: '', position: '', email: '', mobilePhone: '', directLine: '',
};

// ─── メインページ ───
export default function CustomerPage() {
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルタ
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSalesRepId, setFilterSalesRepId] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterCampaignId, setFilterCampaignId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // モーダル
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialCustomerForm);
  const [contactForm, setContactForm] = useState(initialContactForm);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  // ─── データ取得 ───
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [custRes, empRes, campRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/employees'),
        fetch('/api/campaigns'),
      ]);
      const custData = await custRes.json();
      const empData = await empRes.json();
      const campData = campRes.ok ? await campRes.json() : [];
      setCustomers(Array.isArray(custData) ? custData : []);
      setEmployees(Array.isArray(empData) ? empData.filter((e: any) => e.isActive === true) : []);
      setCampaigns(Array.isArray(campData) ? campData.filter((c: any) => c.isActive) : []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNextCode = async () => {
    setIsLoadingCode(true);
    try {
      const res = await fetch('/api/customers/next-code');
      if (res.ok) {
        const { code } = await res.json();
        setFormData(prev => ({ ...prev, customerCode: code }));
      }
    } finally {
      setIsLoadingCode(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── フィルタリング ───
  const filteredCustomers = useMemo(() => {
    if (!Array.isArray(customers)) return [];
    return customers.filter(c => {
      const matchSearch = !searchTerm ||
        c.name.includes(searchTerm) || (c.nameKana && c.nameKana.includes(searchTerm)) ||
        c.customerCode.includes(searchTerm);
      const matchSales = !filterSalesRepId || String(c.salesRepId) === filterSalesRepId;
      const matchChannel = !filterChannel || c.acquisitionChannel === filterChannel;
      const matchCampaign = !filterCampaignId || String(c.campaignId) === filterCampaignId;
      const matchStatus = !filterStatus || c.status === filterStatus;
      return matchSearch && matchSales && matchChannel && matchCampaign && matchStatus;
    });
  }, [customers, searchTerm, filterSalesRepId, filterChannel, filterCampaignId, filterStatus]);

  // ─── 入力ハンドラ ───
  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 郵便番号（自動ハイフン + 住所補完）
  const handlePostalChange = (raw: string) => {
    handlePostalInput(
      raw,
      v => setFormData(prev => ({ ...prev, postalCode: v })),
      v => setFormData(prev => ({ ...prev, address: v })),
    );
  };

  // 電話・FAX（自動ハイフン）
  const handleCustomerPhone = (name: 'phone' | 'fax', raw: string) => {
    handlePhoneChange(raw, v => setFormData(prev => ({ ...prev, [name]: v })));
  };

  // 担当者電話（自動ハイフン）
  const handleContactPhone = (name: 'mobilePhone' | 'directLine', raw: string) => {
    handlePhoneChange(raw, v => setContactForm(prev => ({ ...prev, [name]: v })));
  };

  const handleContactInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  // ─── モーダル開閉 ───
  const openFormModal = (customer?: Customer) => {
    setSaveError('');
    if (customer) {
      setCurrentId(customer.id);
      setFormData({
        customerCode: customer.customerCode || '',
        name: customer.name,
        nameKana: customer.nameKana || '',
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
        status: customer.status || 'VALID',
        acquisitionChannel: customer.acquisitionChannel || '',
        campaignId: customer.campaignId?.toString() || '',
      });
    } else {
      setCurrentId(null);
      setFormData(initialCustomerForm);
      setContactForm(initialContactForm);
      fetchNextCode();
    }
    setIsFormModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setIsSaving(true);
    try {
      const url = currentId ? `/api/customers/${currentId}` : '/api/customers';
      const method = currentId ? 'PUT' : 'POST';
      const payload = currentId ? formData : { ...formData, contact: contactForm };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || '保存に失敗しました');
        return;
      }

      setIsFormModalOpen(false);
      fetchData();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setCurrentId(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!currentId) return;
    const res = await fetch(`/api/customers/${currentId}`, { method: 'DELETE' });
    if (res.ok) { setIsDeleteModalOpen(false); fetchData(); }
    else showToast('削除に失敗しました', 'error');
  };

  // ─── レンダリング ───
  return (
    <div className="space-y-6">

      {/* ページヘッダー */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-buildings-fill text-blue-600"></i> 顧客管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">取引先企業の情報を一元管理します。</p>
        </div>
        <button
          onClick={() => openFormModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-colors"
        >
          <i className="bi bi-plus-lg"></i> 新規顧客登録
        </button>
      </div>

      {/* 検索・フィルタパネル */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className={labelCls}>キーワード検索</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-sm"></i>
            <input
              type="text"
              placeholder="会社名・カナ・顧客コード..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>担当営業</label>
          <select value={filterSalesRepId} onChange={e => setFilterSalesRepId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white min-w-[120px]">
            <option value="">すべて</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>流入経路</label>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white min-w-[110px]">
            <option value="">すべて</option>
            <option value="EC">EC</option>
            <option value="SALES">営業</option>
            <option value="REFERRAL">紹介</option>
            <option value="INQUIRY">問い合わせ</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>キャンペーン</label>
          <select value={filterCampaignId} onChange={e => setFilterCampaignId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white min-w-[130px]">
            <option value="">すべて</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>ステータス</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white min-w-[110px]">
            <option value="">すべて</option>
            <option value="VALID">有効</option>
            <option value="INVALID">無効</option>
          </select>
        </div>
        {(searchTerm || filterSalesRepId || filterChannel || filterCampaignId || filterStatus) && (
          <button
            onClick={() => { setSearchTerm(''); setFilterSalesRepId(''); setFilterChannel(''); setFilterCampaignId(''); setFilterStatus(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 pb-0.5"
          >
            <i className="bi bi-x-circle"></i> クリア
          </button>
        )}
      </div>

      <div>
        <span className="text-xs text-slate-400">
          {isLoading ? '読み込み中...' : `${filteredCustomers.length} 件`}
          {!isLoading && filteredCustomers.length !== customers.length && ` / 全 ${customers.length} 件`}
        </span>
      </div>

      {/* 顧客一覧テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">顧客コード / 会社名</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">電話 / 住所</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">担当営業</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">流入</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">キャンペーン</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">状態</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <div className="inline-block animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              </td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <i className="bi bi-buildings text-3xl text-slate-200 block mb-2"></i>
                <p className="text-slate-400 text-sm">該当する顧客が見つかりません</p>
              </td></tr>
            ) : (
              filteredCustomers.map(cust => (
                <tr
                  key={cust.id}
                  className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/customers/${cust.id}`)}
                >
                  <td className="px-5 py-3.5">
                    <div className="text-[11px] font-mono text-slate-400 mb-0.5">{cust.customerCode}</div>
                    <div className="font-bold text-slate-800 text-sm">{cust.name}</div>
                    {cust.nameKana && <div className="text-[11px] text-slate-400">{cust.nameKana}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    <div className="text-slate-700 font-medium text-xs mb-0.5">
                      <i className="bi bi-telephone text-slate-400 mr-1"></i>{cust.phone || <span className="text-slate-300">-</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                      {cust.address ? `${cust.postalCode ? `〒${cust.postalCode} ` : ''}${cust.address}` : '-'}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {cust.salesRep ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        <i className="bi bi-person-circle text-blue-400"></i>
                        {cust.salesRep.lastNameJa} {cust.salesRep.firstNameJa}
                      </span>
                    ) : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {cust.acquisitionChannel ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${CHANNEL_COLORS[cust.acquisitionChannel]}`}>
                        {CHANNEL_LABELS[cust.acquisitionChannel]}
                      </span>
                    ) : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">
                    {cust.campaign?.name || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {cust.status === 'VALID' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>有効
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>無効
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); openFormModal(cust); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編集">
                        <i className="bi bi-pencil-square"></i>
                      </button>
                      <button onClick={e => confirmDelete(e, cust.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="削除">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* ===== 登録・編集モーダル ===== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-8 animate-in fade-in zoom-in-95 duration-200">

            {/* ヘッダー */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${currentId ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                  <i className={`bi ${currentId ? 'bi-pencil-square text-blue-600' : 'bi-building-add text-emerald-600'}`}></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">{currentId ? '顧客情報を編集' : '新規顧客登録'}</h3>
                  {!currentId && <p className="text-[11px] text-slate-400 mt-0.5">会社情報と主担当者を登録します</p>}
                </div>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-7">

              {saveError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold flex items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill text-rose-500"></i>
                  {saveError}
                </div>
              )}

              {/* ── Section 1: 基本情報 ── */}
              <section>
                <SectionHeader icon="bi-building" label="基本情報" />
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4">
                    <label className={labelCls}>
                      顧客コード <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        name="customerCode"
                        required
                        value={formData.customerCode}
                        onChange={handleInput}
                        className={inputCls + (isLoadingCode ? ' text-slate-400' : '')}
                        placeholder={isLoadingCode ? '生成中...' : 'TS00000001'}
                        readOnly={!currentId && isLoadingCode}
                      />
                      {!currentId && isLoadingCode && (
                        <div className="absolute right-3 top-2.5">
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-8">
                    <label className={labelCls}>会社名・屋号 <span className="text-red-500">*</span></label>
                    <input name="name" required value={formData.name} onChange={handleInput} className={inputCls} placeholder="例: 株式会社サンプル" />
                  </div>
                  <div className="col-span-8">
                    <label className={labelCls}>会社名（カナ）</label>
                    <input name="nameKana" value={formData.nameKana} onChange={handleInput} className={inputCls} placeholder="カブシキガイシャサンプル" />
                  </div>
                  <div className="col-span-4">
                    <label className={labelCls}>ステータス</label>
                    <select name="status" value={formData.status} onChange={handleInput} className={inputCls}>
                      <option value="VALID">有効</option>
                      <option value="INVALID">無効</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className={labelCls}>担当営業</label>
                    <select name="salesRepId" value={formData.salesRepId} onChange={handleInput} className={inputCls}>
                      <option value="">未設定</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className={labelCls}>流入経路</label>
                    <select name="acquisitionChannel" value={formData.acquisitionChannel} onChange={handleInput} className={inputCls}>
                      <option value="">未設定</option>
                      <option value="EC">EC</option>
                      <option value="SALES">営業</option>
                      <option value="REFERRAL">紹介</option>
                      <option value="INQUIRY">問い合わせ</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className={labelCls}>キャンペーン</label>
                    <select name="campaignId" value={formData.campaignId} onChange={handleInput} className={inputCls}>
                      <option value="">なし</option>
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* ── Section 2: 所在地・連絡先 ── */}
              <section>
                <SectionHeader icon="bi-geo-alt" label="所在地・連絡先" />
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className={labelCls}>郵便番号</label>
                    <input
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={e => handlePostalChange(e.target.value)}
                      className={inputCls}
                      placeholder="123-4567"
                      maxLength={8}
                    />
                  </div>
                  <div className="col-span-9">
                    <label className={labelCls}>住所（都道府県〜番地）</label>
                    <input
                      name="address"
                      value={formData.address}
                      onChange={handleInput}
                      className={inputCls}
                      placeholder="郵便番号入力で自動補完"
                    />
                  </div>
                  <div className="col-span-12">
                    <label className={labelCls}>建物名・階数</label>
                    <input name="addressBuilding" value={formData.addressBuilding} onChange={handleInput} className={inputCls} placeholder="〇〇ビル 3F" />
                  </div>
                  <div className="col-span-6">
                    <label className={labelCls}>電話番号</label>
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={e => handleCustomerPhone('phone', e.target.value)}
                      className={inputCls}
                      placeholder="03-0000-0000"
                      maxLength={13}
                    />
                  </div>
                  <div className="col-span-6">
                    <label className={labelCls}>FAX</label>
                    <input
                      name="fax"
                      value={formData.fax}
                      onChange={e => handleCustomerPhone('fax', e.target.value)}
                      className={inputCls}
                      placeholder="03-0000-0001"
                      maxLength={13}
                    />
                  </div>
                </div>
              </section>

              {/* ── Section 3: 取引条件 ── */}
              <section>
                <SectionHeader icon="bi-currency-yen" label="取引条件・インボイス" />
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-5">
                    <label className={labelCls}>インボイス登録番号</label>
                    <input name="invoiceRegistrationNumber" value={formData.invoiceRegistrationNumber} onChange={handleInput} className={inputCls} placeholder="T1234567890123" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>締日 <span className="text-slate-400 font-normal text-[10px]">(99=末)</span></label>
                    <input type="number" name="billingCutoffDay" value={formData.billingCutoffDay} onChange={handleInput} className={inputCls} min={1} max={99} />
                  </div>
                  <div className="col-span-3">
                    <label className={labelCls}>支払サイト <span className="text-slate-400 font-normal text-[10px]">(月数)</span></label>
                    <input type="number" name="paymentMonthDelay" value={formData.paymentMonthDelay} onChange={handleInput} className={inputCls} min={0} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>支払日 <span className="text-slate-400 font-normal text-[10px]">(99=末)</span></label>
                    <input type="number" name="paymentDay" value={formData.paymentDay} onChange={handleInput} className={inputCls} min={1} max={99} />
                  </div>
                </div>
              </section>

              {/* ── Section 4: 関係・備考 ── */}
              <section>
                <SectionHeader icon="bi-diagram-3" label="関係・備考" />
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6">
                    <label className={labelCls}>親顧客 <span className="text-slate-400 font-normal text-[10px]">(チェーン本部など)</span></label>
                    <CustomerCombobox
                      value={formData.parentCustomerId}
                      onSelect={id => setFormData(prev => ({ ...prev, parentCustomerId: id }))}
                      onClear={() => setFormData(prev => ({ ...prev, parentCustomerId: '' }))}
                      customers={customers}
                      excludeId={currentId}
                      placeholder="会社名・コードで検索..."
                    />
                  </div>
                  <div className="col-span-6">
                    <label className={labelCls}>請求先 <span className="text-slate-400 font-normal text-[10px]">(他社に請求する場合)</span></label>
                    <CustomerCombobox
                      value={formData.billingCustomerId}
                      onSelect={id => setFormData(prev => ({ ...prev, billingCustomerId: id }))}
                      onClear={() => setFormData(prev => ({ ...prev, billingCustomerId: '' }))}
                      customers={customers}
                      excludeId={currentId}
                      placeholder="会社名・コードで検索..."
                    />
                  </div>
                  <div className="col-span-12">
                    <label className={labelCls}>備考</label>
                    <textarea name="note" value={formData.note} onChange={handleInput} rows={2} className={inputCls + ' resize-none'} placeholder="特記事項など..." />
                  </div>
                </div>
              </section>

              {/* ── Section 5: 主担当者（新規登録時のみ） ── */}
              {!currentId && (
                <section>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <SectionHeader icon="bi-person-fill" label="主担当者" color="indigo" />
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded font-bold -mt-4">必須</span>
                      </div>
                      {contactForm.email && (
                        <span className="text-[11px] text-indigo-500 flex items-center gap-1 -mt-4">
                          <i className="bi bi-envelope-check"></i> 登録後にログイン情報をメール送信
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      {/* 氏名 */}
                      <div className="col-span-3">
                        <label className={labelCls + ' !text-indigo-600'}>姓 <span className="text-red-500">*</span></label>
                        <input type="text" name="lastName" required value={contactForm.lastName} onChange={handleContactInput}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'} placeholder="山田" />
                      </div>
                      <div className="col-span-3">
                        <label className={labelCls + ' !text-indigo-600'}>名 <span className="text-red-500">*</span></label>
                        <input type="text" name="firstName" required value={contactForm.firstName} onChange={handleContactInput}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'} placeholder="太郎" />
                      </div>
                      <div className="col-span-3">
                        <label className={labelCls + ' !text-indigo-600'}>姓（カナ）</label>
                        <input type="text" name="lastNameKana" value={contactForm.lastNameKana} onChange={handleContactInput}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'} placeholder="ヤマダ" />
                      </div>
                      <div className="col-span-3">
                        <label className={labelCls + ' !text-indigo-600'}>名（カナ）</label>
                        <input type="text" name="firstNameKana" value={contactForm.firstNameKana} onChange={handleContactInput}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'} placeholder="タロウ" />
                      </div>

                      {/* 部署・役職 */}
                      <div className="col-span-6">
                        <label className={labelCls + ' !text-indigo-600'}>部署</label>
                        <input type="text" name="department" value={contactForm.department} onChange={handleContactInput}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'} placeholder="営業部" />
                      </div>
                      <div className="col-span-6">
                        <label className={labelCls + ' !text-indigo-600'}>役職</label>
                        <input type="text" name="position" value={contactForm.position} onChange={handleContactInput}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'} placeholder="課長" />
                      </div>

                      {/* メール（必須） */}
                      <div className="col-span-12">
                        <label className={labelCls + ' !text-indigo-600'}>
                          メールアドレス <span className="text-red-500">*</span>
                          <span className="text-[10px] font-normal text-indigo-400 ml-1">（ポータルログインIDになります）</span>
                        </label>
                        <input type="email" name="email" required value={contactForm.email} onChange={handleContactInput}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'} placeholder="taro@example.com" />
                      </div>

                      {/* 電話番号 */}
                      <div className="col-span-6">
                        <label className={labelCls + ' !text-indigo-600'}>携帯電話</label>
                        <input
                          type="tel"
                          name="mobilePhone"
                          value={contactForm.mobilePhone}
                          onChange={e => handleContactPhone('mobilePhone', e.target.value)}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'}
                          placeholder="090-0000-0000"
                          maxLength={13}
                        />
                      </div>
                      <div className="col-span-6">
                        <label className={labelCls + ' !text-indigo-600'}>直通電話</label>
                        <input
                          type="tel"
                          name="directLine"
                          value={contactForm.directLine}
                          onChange={e => handleContactPhone('directLine', e.target.value)}
                          className={inputCls + ' border-indigo-200 focus:ring-indigo-400'}
                          placeholder="03-0000-0000"
                          maxLength={13}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* フッター */}
              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors">
                  キャンセル
                </button>
                <button type="submit" disabled={isSaving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all disabled:opacity-60 flex items-center gap-2">
                  {isSaving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>保存中...</>
                  ) : (
                    <><i className="bi bi-check-lg"></i>{currentId ? '変更を保存' : '顧客を登録'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-2">顧客を削除しますか？</h3>
            <p className="text-slate-500 text-sm mb-6">ステータスが「無効」に変更されます。<br />物理削除は行われません。</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm transition-colors">キャンセル</button>
              <button onClick={executeDelete} className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm shadow-md transition-colors">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
