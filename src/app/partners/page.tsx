'use client';

import React, { useState, useEffect } from 'react';

export default function PartnerPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [partnerTypes, setPartnerTypes] = useState<any[]>([]); // ★ マスタデータ用State
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const initialForm = { name: '', partnerTypeId: '', contactInfo: '' };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // パートナー一覧と、パートナータイプマスタを同時に取得
      const [partnersRes, typesRes] = await Promise.all([
        fetch('/api/partners'),
        fetch('/api/partners/types')
      ]);
      
      if (partnersRes.ok) setPartners(await partnersRes.json());
      if (typesRes.ok) setPartnerTypes(await typesRes.json());
      
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openForm = (partner?: any) => {
    if (partner) {
      setCurrentId(partner.id);
      setFormData({
        name: partner.name,
        partnerTypeId: partner.partnerTypeId.toString(),
        contactInfo: partner.contactInfo || ''
      });
    } else {
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(currentId ? `/api/partners/${currentId}` : '/api/partners', {
        method: currentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      setIsFormOpen(false);
      fetchData();
    } catch (e) { alert('保存に失敗しました'); }
  };

  const del = async (id: number) => {
    if (!confirm('この外注先を削除しますか？\n(※すでに受注データに紐づいている場合は削除できません)')) return;
    try {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchData();
    } catch (e) { alert('削除に失敗しました。関連する受注データが存在する可能性があります。'); }
  };

  const filteredPartners = partners.filter(p => 
    p.name.includes(searchTerm) || (p.contactInfo || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-truck text-teal-600"></i> 外注先 (パートナー) マスタ
          </h1>
          <p className="text-slate-500 text-sm mt-1">印刷会社や折込手配会社などの協力会社を管理します。</p>
        </div>
        <button onClick={() => openForm()} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all">
          <i className="bi bi-plus-lg"></i> 新規パートナー登録
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder="会社名や連絡先で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">パートナー名</th>
              <th className="px-6 py-4">パートナータイプ</th>
              <th className="px-6 py-4">連絡先・備考</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={4} className="p-8 text-center text-slate-400">読み込み中...</td></tr> : 
             filteredPartners.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400">データがありません</td></tr> :
             filteredPartners.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold text-slate-800 text-base">{p.name}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border rounded-md bg-slate-100 text-slate-700 border-slate-200">
                    {p.partnerType?.name || '不明'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 whitespace-pre-wrap">{p.contactInfo || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openForm(p)} className="p-2 text-slate-400 hover:text-teal-600"><i className="bi bi-pencil-square text-lg"></i></button>
                  <button onClick={() => del(p.id)} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash text-lg"></i></button>
                </td>
              </tr>
             ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? 'パートナー情報の編集' : '新規パートナー登録'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">外注先企業名 <span className="text-rose-500">*</span></label>
                <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="例: 株式会社プリントパック" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">パートナータイプ <span className="text-rose-500">*</span></label>
                <select required name="partnerTypeId" value={formData.partnerTypeId} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                  <option value="">選択してください</option>
                  {partnerTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">連絡先・担当者・備考</label>
                <textarea name="contactInfo" value={formData.contactInfo} onChange={handleInputChange} rows={4} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="担当者名、電話番号、メールアドレスなど" />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all">
                  {currentId ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}