'use client';

import React, { useState, useEffect, useMemo } from 'react';

type Distributor = any; // 項目が多いため、anyで一旦簡略化（必要に応じて厳密な型定義に変更）

export default function DistributorPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  // ★ 追加：支店と国のリストを保持するState
  const [branches, setBranches] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // 初期フォーム値（branch と nationality を branchId と countryId に変更）
  const initialForm = {
    staffId: '', name: '', branchId: '', phone: '', email: '', birthday: '', gender: '', countryId: '', address: '',
    visaType: '', visaExpiryDate: '', hasAgreedPersonalInfo: false, hasSignedContract: false, hasResidenceCard: false,
    joinDate: '', leaveDate: '', leaveReason: '',
    paymentMethod: '振込', bankName: '', bankBranchCode: '', bankAccountType: '普通', bankAccountNumber: '', bankAccountName: '', bankAccountNameKana: '', transferNumber: '',
    equipmentBattery: '', equipmentBag: '', equipmentMobile: '', flyerDeliveryMethod: '', transportationMethod: '',
    ratePlan: '', rate1Type: '', rate2Type: '', rate3Type: '', rate4Type: '', rate5Type: '', rate6Type: '', transportationFee: '', trainingAllowance: '',
    rank: '', attendanceCount: '0', minTypes: '', maxTypes: '', minSheets: '', maxSheets: '', targetAmount: '', note: ''
  };
  const [formData, setFormData] = useState(initialForm);

  // ★ 修正：配布員だけでなく、支店と国のデータも同時に取得する
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [distRes, branchRes, countryRes] = await Promise.all([
        fetch('/api/distributors'),
        fetch('/api/branches'),
        fetch('/api/countries')
      ]);
      const distData = await distRes.json();
      const branchData = await branchRes.json();
      const countryData = await countryRes.json();

      setDistributors(Array.isArray(distData) ? distData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
      setCountries(Array.isArray(countryData) ? countryData : []);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredDistributors = useMemo(() => {
    return distributors.filter(d => 
      (d.name && d.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (d.staffId && d.staffId.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [distributors, searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    setFormData(prev => ({ ...prev, [target.name]: value }));
  };

  const openForm = (d?: Distributor) => {
    if (d) {
      setCurrentId(d.id);
      setFormData({
        ...d,
        // ★ 修正：branchId と countryId を文字列としてセット
        branchId: d.branchId?.toString() || '',
        countryId: d.countryId?.toString() || '',
        
        birthday: d.birthday ? d.birthday.split('T')[0] : '',
        visaExpiryDate: d.visaExpiryDate ? d.visaExpiryDate.split('T')[0] : '',
        joinDate: d.joinDate ? d.joinDate.split('T')[0] : '',
        leaveDate: d.leaveDate ? d.leaveDate.split('T')[0] : '',
        rate1Type: d.rate1Type || '', rate2Type: d.rate2Type || '', rate3Type: d.rate3Type || '',
        attendanceCount: d.attendanceCount?.toString() || '0',
      });
    } else {
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = currentId ? 'PUT' : 'POST';
      const url = currentId ? `/api/distributors/${currentId}` : '/api/distributors';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Error');
      setIsFormModalOpen(false);
      fetchData();
    } catch (e) { alert('保存失敗'); }
  };

  const del = async () => {
    if (!currentId) return;
    try {
      await fetch(`/api/distributors/${currentId}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (e) { alert('削除失敗'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-bicycle text-emerald-600"></i> 配布員管理 (Distributors)
          </h1>
          <p className="text-slate-500 text-sm mt-1">ポスティングスタッフの情報と契約を管理します。</p>
        </div>
        <button onClick={() => openForm()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">
          <i className="bi bi-plus-lg"></i> 新規スタッフ登録
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder="名前 または スタッフID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">ID / 氏名</th>
              <th className="px-6 py-4">支店 / ランク</th>
              <th className="px-6 py-4">国籍 / ビザ</th>
              <th className="px-6 py-4">在籍状態</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center">読み込み中...</td></tr> : 
             filteredDistributors.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-mono text-xs text-slate-400">{d.staffId}</div>
                  <div className="font-bold text-slate-800">{d.name}</div>
                </td>
                <td className="px-6 py-4 text-sm">
                  {/* ★ 修正：リレーション先の支店名を表示 */}
                  <div>{d.branch ? d.branch.nameJa : '-'}</div>
                  <div className="text-xs font-bold text-emerald-600">Rank: {d.rank || '-'}</div>
                </td>
                <td className="px-6 py-4 text-sm">
                  {/* ★ 修正：リレーション先の国名を表示 */}
                  <div className="font-bold text-slate-700">{d.country ? d.country.name : '-'}</div>
                  <div className="text-xs text-slate-500">{d.visaType || 'ビザ未確認'}</div>
                </td>
                <td className="px-6 py-4">
                  {d.leaveDate ? 
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded">退社済</span> : 
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded">在籍中</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openForm(d)} className="p-2 text-slate-400 hover:text-emerald-600"><i className="bi bi-pencil-square"></i></button>
                  <button onClick={() => { setCurrentId(d.id); setIsDeleteModalOpen(true); }} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 登録・編集モーダル */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold">{currentId ? 'スタッフ情報編集' : '新規スタッフ登録'}</h3>
              <button onClick={() => setIsFormModalOpen(false)}><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 左カラム：基本＆契約 */}
                <div className="space-y-6">
                  <section>
                    <h4 className="font-bold text-sm text-emerald-600 border-b pb-2 mb-3">基本情報</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs">スタッフID *</label><input required name="staffId" value={formData.staffId} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      
                      {/* ★ 修正：支店をセレクトボックスに */}
                      <div>
                        <label className="text-xs">支店</label>
                        <select name="branchId" value={formData.branchId} onChange={handleInputChange} className="w-full border p-2 rounded text-sm bg-white">
                          <option value="">選択してください</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.nameJa}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2"><label className="text-xs">氏名 *</label><input required name="name" value={formData.name} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      
                      {/* ★ 修正：国籍をセレクトボックスに */}
                      <div>
                        <label className="text-xs">国籍</label>
                        <select name="countryId" value={formData.countryId} onChange={handleInputChange} className="w-full border p-2 rounded text-sm bg-white">
                          <option value="">選択してください</option>
                          {countries.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div><label className="text-xs">誕生日</label><input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                    </div>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-emerald-600 border-b pb-2 mb-3">在留・契約情報</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs">ビザ種類</label><input name="visaType" value={formData.visaType} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">ビザ期限</label><input type="date" name="visaExpiryDate" value={formData.visaExpiryDate} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">入社日</label><input type="date" name="joinDate" value={formData.joinDate} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">退社日</label><input type="date" name="leaveDate" value={formData.leaveDate} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                    </div>
                    <div className="mt-3 flex gap-4 text-sm">
                      <label className="flex items-center gap-1"><input type="checkbox" name="hasAgreedPersonalInfo" checked={formData.hasAgreedPersonalInfo} onChange={handleInputChange} /> 個人情報同意</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="hasSignedContract" checked={formData.hasSignedContract} onChange={handleInputChange} /> 契約締結済</label>
                      <label className="flex items-center gap-1"><input type="checkbox" name="hasResidenceCard" checked={formData.hasResidenceCard} onChange={handleInputChange} /> 在留カード確認</label>
                    </div>
                  </section>
                </div>

                {/* 右カラム：口座＆レート */}
                <div className="space-y-6">
                  <section>
                    <h4 className="font-bold text-sm text-emerald-600 border-b pb-2 mb-3">口座情報</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs">銀行名</label><input name="bankName" value={formData.bankName} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">支店番号</label><input name="bankBranchCode" value={formData.bankBranchCode} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">口座番号</label><input name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">名義 (カナ)</label><input name="bankAccountNameKana" value={formData.bankAccountNameKana} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                    </div>
                  </section>

                  <section>
                    <h4 className="font-bold text-sm text-emerald-600 border-b pb-2 mb-3">レート・目標</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-xs">Rank</label><input name="rank" value={formData.rank} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" placeholder="A, B, C..."/></div>
                      <div><label className="text-xs">Rate Plan</label><input name="ratePlan" value={formData.ratePlan} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">出勤回数</label><input type="number" name="attendanceCount" value={formData.attendanceCount} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      
                      <div><label className="text-xs">1 Type Rate</label><input type="number" step="0.01" name="rate1Type" value={formData.rate1Type} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">2 Type Rate</label><input type="number" step="0.01" name="rate2Type" value={formData.rate2Type} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                      <div><label className="text-xs">3 Type Rate</label><input type="number" step="0.01" name="rate3Type" value={formData.rate3Type} onChange={handleInputChange} className="w-full border p-2 rounded text-sm" /></div>
                    </div>
                  </section>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2 text-slate-600">キャンセル</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white rounded font-bold">{currentId ? '更新する' : '登録する'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded text-center">
            <p className="mb-4">本当に削除しますか？</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-slate-200 rounded">キャンセル</button>
              <button onClick={del} className="px-4 py-2 bg-rose-600 text-white rounded">削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}