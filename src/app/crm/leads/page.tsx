'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/ui/NotificationProvider';

type Employee = { id: number; lastNameJa: string; firstNameJa: string; isActive: boolean; };
type Campaign = { id: number; name: string; };
type AcquisitionChannel = 'EC' | 'SALES' | 'REFERRAL' | 'INQUIRY';
type LeadStage = 'APPROACH' | 'PROPOSAL' | 'QUOTATION' | 'NEGOTIATION' | 'LOST' | 'ON_HOLD';

type Lead = {
  id: number;
  name: string;
  nameKana: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  stage: LeadStage;
  acquisitionChannel: AcquisitionChannel | null;
  salesRepId: number | null;
  salesRep?: { id: number; lastNameJa: string; firstNameJa: string } | null;
  campaignId: number | null;
  campaign?: { id: number; name: string } | null;
  note: string | null;
  nextAction: string | null;
  expectedCloseDate: string | null;
  convertedCustomerId: number | null;
  convertedAt: string | null;
  createdAt: string;
};

const STAGE_LABELS: Record<LeadStage, string> = {
  APPROACH: 'アプローチ中',
  PROPOSAL: '提案中',
  QUOTATION: '見積中',
  NEGOTIATION: '交渉中',
  LOST: '失注',
  ON_HOLD: '保留',
};

const STAGE_COLORS: Record<LeadStage, string> = {
  APPROACH: 'bg-sky-100 text-sky-700',
  PROPOSAL: 'bg-blue-100 text-blue-700',
  QUOTATION: 'bg-indigo-100 text-indigo-700',
  NEGOTIATION: 'bg-amber-100 text-amber-700',
  LOST: 'bg-rose-100 text-rose-700',
  ON_HOLD: 'bg-slate-100 text-slate-600',
};

const CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  EC: 'EC',
  SALES: '営業',
  REFERRAL: '紹介',
  INQUIRY: '問い合わせ',
};

const CHANNEL_COLORS: Record<AcquisitionChannel, string> = {
  EC: 'bg-violet-100 text-violet-700',
  SALES: 'bg-blue-100 text-blue-700',
  REFERRAL: 'bg-emerald-100 text-emerald-700',
  INQUIRY: 'bg-amber-100 text-amber-700',
};

const initialForm = {
  name: '',
  nameKana: '',
  contactName: '',
  contactEmail: '',
  phone: '',
  postalCode: '',
  address: '',
  stage: 'APPROACH' as LeadStage,
  acquisitionChannel: '' as AcquisitionChannel | '',
  salesRepId: '',
  campaignId: '',
  note: '',
  nextAction: '',
  expectedCloseDate: '',
};

export default function LeadsPage() {
  const router = useRouter();
  const { showToast } = useNotification();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルタ
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterSalesRepId, setFilterSalesRepId] = useState('');
  const [filterChannel, setFilterChannel] = useState('');

  // モーダル
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [leadsRes, empRes, campRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/employees'),
        fetch('/api/campaigns'),
      ]);
      const leadsData = leadsRes.ok ? await leadsRes.json() : [];
      const empData = empRes.ok ? await empRes.json() : [];
      const campData = campRes.ok ? await campRes.json() : [];

      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setEmployees(Array.isArray(empData) ? empData.filter((e: any) => e.isActive) : []);
      setCampaigns(Array.isArray(campData) ? campData.filter((c: any) => c.isActive) : []);
    } catch {
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !searchTerm ||
        l.name.includes(searchTerm) ||
        (l.contactName && l.contactName.includes(searchTerm));
      const matchStage = !filterStage || l.stage === filterStage;
      const matchSales = !filterSalesRepId || String(l.salesRepId) === filterSalesRepId;
      const matchChannel = !filterChannel || l.acquisitionChannel === filterChannel;
      return matchSearch && matchStage && matchSales && matchChannel;
    });
  }, [leads, searchTerm, filterStage, filterSalesRepId, filterChannel]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openFormModal = (lead?: Lead) => {
    if (lead) {
      setCurrentId(lead.id);
      setFormData({
        name: lead.name,
        nameKana: lead.nameKana || '',
        contactName: lead.contactName || '',
        contactEmail: lead.contactEmail || '',
        phone: lead.phone || '',
        postalCode: lead.postalCode || '',
        address: lead.address || '',
        stage: lead.stage,
        acquisitionChannel: lead.acquisitionChannel || '',
        salesRepId: lead.salesRepId?.toString() || '',
        campaignId: lead.campaignId?.toString() || '',
        note: lead.note || '',
        nextAction: lead.nextAction || '',
        expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.split('T')[0] : '',
      });
    } else {
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = currentId ? `/api/leads/${currentId}` : '/api/leads';
      const method = currentId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Save failed');
      setIsFormModalOpen(false);
      fetchData();
    } catch {
      showToast('保存に失敗しました', 'error');
    }
  };

  const confirmDelete = (id: number) => {
    setCurrentId(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!currentId) return;
    try {
      await fetch(`/api/leads/${currentId}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      fetchData();
    } catch {
      showToast('削除に失敗しました', 'error');
    }
  };

  const openConvertModal = (id: number) => {
    setCurrentId(id);
    setIsConvertModalOpen(true);
  };

  const executeConvert = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/leads/${currentId}/convert`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Convert failed');
      setIsConvertModalOpen(false);
      router.push(`/customers/${data.customerId}`);
    } catch (err: any) {
      showToast(err.message || '転換に失敗しました', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => openFormModal()}
          className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2"
        >
          <i className="bi bi-plus-lg"></i> 新規見込み客登録
        </button>
      </div>

      {/* フィルタ */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="会社名・担当者名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">ステージ: 全て</option>
            {(Object.keys(STAGE_LABELS) as LeadStage[]).map(s => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
          <select value={filterSalesRepId} onChange={(e) => setFilterSalesRepId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">担当営業: 全て</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>
            ))}
          </select>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">流入経路: 全て</option>
            <option value="EC">EC</option>
            <option value="SALES">営業</option>
            <option value="REFERRAL">紹介</option>
            <option value="INQUIRY">問い合わせ</option>
          </select>
        </div>
        <div className="text-xs text-slate-400 mt-2">{filteredLeads.length} 件表示</div>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-4 font-semibold">会社名 / 担当者</th>
              <th className="px-5 py-4 font-semibold">流入経路</th>
              <th className="px-5 py-4 font-semibold">ステージ</th>
              <th className="px-5 py-4 font-semibold">担当営業</th>
              <th className="px-5 py-4 font-semibold">キャンペーン</th>
              <th className="px-5 py-4 font-semibold">次アクション</th>
              <th className="px-5 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">読み込み中...</td></tr>
            ) : filteredLeads.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">見込み客が登録されていません</td></tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-slate-50 transition-colors ${lead.convertedCustomerId ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      {lead.name}
                      {lead.convertedCustomerId && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">転換済</span>
                      )}
                    </div>
                    {lead.contactName && <div className="text-xs text-slate-400 mt-0.5"><i className="bi bi-person mr-1"></i>{lead.contactName}</div>}
                  </td>
                  <td className="px-5 py-4">
                    {lead.acquisitionChannel ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${CHANNEL_COLORS[lead.acquisitionChannel]}`}>
                        {CHANNEL_LABELS[lead.acquisitionChannel]}
                      </span>
                    ) : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${STAGE_COLORS[lead.stage]}`}>
                      {STAGE_LABELS[lead.stage]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {lead.salesRep ? (
                      <span className="text-xs text-blue-700">
                        {lead.salesRep.lastNameJa} {lead.salesRep.firstNameJa}
                      </span>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-600">
                    {lead.campaign?.name || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 max-w-[160px] truncate">
                    {lead.nextAction || '-'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!lead.convertedCustomerId && (
                        <button
                          onClick={() => openConvertModal(lead.id)}
                          title="顧客に転換"
                          className="p-2 text-slate-400 hover:text-emerald-600"
                        >
                          <i className="bi bi-arrow-right-circle text-lg"></i>
                        </button>
                      )}
                      {lead.convertedCustomerId && (
                        <button
                          onClick={() => router.push(`/customers/${lead.convertedCustomerId}`)}
                          title="顧客ページへ"
                          className="p-2 text-emerald-500 hover:text-emerald-700"
                        >
                          <i className="bi bi-box-arrow-up-right text-lg"></i>
                        </button>
                      )}
                      <button onClick={() => openFormModal(lead)} className="p-2 text-slate-400 hover:text-sky-600">
                        <i className="bi bi-pencil-square text-lg"></i>
                      </button>
                      <button onClick={() => confirmDelete(lead.id)} className="p-2 text-slate-400 hover:text-rose-600">
                        <i className="bi bi-trash text-lg"></i>
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

      {/* 登録・編集モーダル */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? '見込み客を編集' : '新規見込み客登録'}</h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto">

              {/* 基本情報 */}
              <div>
                <h4 className="text-sm font-bold text-sky-600 mb-3 border-b border-sky-100 pb-1 flex items-center gap-2">
                  <i className="bi bi-building"></i> 基本情報
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-600">会社名 <span className="text-rose-500">*</span></label><input name="name" value={formData.name} onChange={handleInputChange} required className="w-full px-3 py-2 border rounded-lg mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-600">会社名（カナ）</label><input name="nameKana" value={formData.nameKana} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-600">担当者名</label><input name="contactName" value={formData.contactName} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-600">担当者メール</label><input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-600">電話番号</label><input name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-600">郵便番号</label><input name="postalCode" value={formData.postalCode} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" placeholder="123-4567" /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-600">住所</label><input name="address" value={formData.address} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" /></div>
                </div>
              </div>

              {/* 営業情報 */}
              <div>
                <h4 className="text-sm font-bold text-sky-600 mb-3 border-b border-sky-100 pb-1 flex items-center gap-2">
                  <i className="bi bi-bar-chart"></i> 営業情報
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600">ステージ</label>
                    <select name="stage" value={formData.stage} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white mt-1">
                      {(Object.keys(STAGE_LABELS) as LeadStage[]).map(s => (
                        <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">流入経路</label>
                    <select name="acquisitionChannel" value={formData.acquisitionChannel} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white mt-1">
                      <option value="">未設定</option>
                      <option value="EC">EC</option>
                      <option value="SALES">営業</option>
                      <option value="REFERRAL">紹介</option>
                      <option value="INQUIRY">問い合わせ</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">担当営業</label>
                    <select name="salesRepId" value={formData.salesRepId} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white mt-1">
                      <option value="">未設定</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">キャンペーン</label>
                    <select name="campaignId" value={formData.campaignId} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white mt-1">
                      <option value="">なし</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">クロージング予定日</label>
                    <input type="date" name="expectedCloseDate" value={formData.expectedCloseDate} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">次アクション</label>
                    <input name="nextAction" value={formData.nextAction} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg mt-1" placeholder="例: 来週月曜に提案書送付" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">備考</label>
                    <textarea name="note" value={formData.note} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border rounded-lg mt-1" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold text-sm">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-sm shadow-md">
                  {currentId ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-2">見込み客を削除しますか？</h3>
            <p className="text-slate-500 text-sm mb-6">この操作は元に戻せません。</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm">キャンセル</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm shadow-md">削除実行</button>
            </div>
          </div>
        </div>
      )}

      {/* 転換確認モーダル */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-arrow-right-circle-fill text-2xl"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-2">顧客に転換しますか？</h3>
            <p className="text-slate-500 text-sm mb-6">見込み客の情報を元に顧客レコードが新規作成され、<br/>顧客管理ページに遷移します。</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsConvertModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm">キャンセル</button>
              <button onClick={executeConvert} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-md">転換する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
