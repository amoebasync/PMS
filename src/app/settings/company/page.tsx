'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';

type CompanySetting = {
  companyName: string;
  companyNameKana: string;
  postalCode: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  invoiceRegistrationNumber: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  logoUrl: string;
};

const DEFAULTS: CompanySetting = {
  companyName: '', companyNameKana: '', postalCode: '', address: '',
  phone: '', fax: '', email: '', website: '',
  invoiceRegistrationNumber: '', bankName: '', bankBranch: '',
  bankAccountType: '普通', bankAccountNumber: '', bankAccountHolder: '', logoUrl: '',
};

function Field({
  label, name, value, onChange, placeholder, hint, required,
}: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  placeholder?: string; hint?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        name={name} value={value} onChange={onChange} placeholder={placeholder}
        required={required}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CompanySettingPage() {
  const { showToast } = useNotification();
  const [form, setForm] = useState<CompanySetting>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/company')
      .then(r => r.json())
      .then(data => {
        if (data && data.companyName !== undefined) {
          setForm({ ...DEFAULTS, ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, v ?? ''])
          )});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      showToast('自社情報を保存しました', 'success');
    } catch {
      showToast('保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <i className="bi bi-hourglass-split text-3xl animate-spin mr-3" />読み込み中...
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="bi bi-info-circle text-indigo-500"></i> 基本情報
            </h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="会社名" name="companyName" value={form.companyName} onChange={handleChange}
              placeholder="株式会社ティラミス" required />
            <Field label="会社名（カナ）" name="companyNameKana" value={form.companyNameKana} onChange={handleChange}
              placeholder="カブシキガイシャティラミス" />
            <Field label="郵便番号" name="postalCode" value={form.postalCode} onChange={handleChange}
              placeholder="100-0001" />
            <Field label="電話番号" name="phone" value={form.phone} onChange={handleChange}
              placeholder="03-0000-0000" />
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1">住所</label>
              <input
                name="address" value={form.address} onChange={handleChange}
                placeholder="東京都千代田区〇〇 1-2-3"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <Field label="FAX番号" name="fax" value={form.fax} onChange={handleChange}
              placeholder="03-0000-0001" />
            <Field label="メールアドレス" name="email" value={form.email} onChange={handleChange}
              placeholder="info@example.co.jp" />
            <Field label="ウェブサイト" name="website" value={form.website} onChange={handleChange}
              placeholder="https://example.co.jp" />
          </div>
        </div>

        {/* インボイス情報 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="bi bi-receipt text-indigo-500"></i> インボイス・税務情報
            </h2>
          </div>
          <div className="p-5">
            <Field label="適格請求書発行事業者登録番号" name="invoiceRegistrationNumber"
              value={form.invoiceRegistrationNumber} onChange={handleChange}
              placeholder="T1234567890123"
              hint="Tから始まる13桁の番号を入力してください" />
          </div>
        </div>

        {/* 銀行口座 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="bi bi-bank text-indigo-500"></i> 振込先口座
            </h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="銀行名" name="bankName" value={form.bankName} onChange={handleChange}
              placeholder="〇〇銀行" />
            <Field label="支店名" name="bankBranch" value={form.bankBranch} onChange={handleChange}
              placeholder="〇〇支店" />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">口座種別</label>
              <select name="bankAccountType" value={form.bankAccountType} onChange={handleChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                <option value="普通">普通</option>
                <option value="当座">当座</option>
              </select>
            </div>
            <Field label="口座番号" name="bankAccountNumber" value={form.bankAccountNumber} onChange={handleChange}
              placeholder="1234567" />
            <div className="md:col-span-2">
              <Field label="口座名義（カナ）" name="bankAccountHolder" value={form.bankAccountHolder}
                onChange={handleChange} placeholder="カブシキガイシャティラミス" />
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50">
            {saving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
