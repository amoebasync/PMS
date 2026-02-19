'use client';

import React, { useState, useEffect } from 'react';

// 折りステータスの表示用マッピング
const FOLD_STATUS_MAP: Record<string, { label: string, color: string }> = {
  NEEDS_FOLDING: { label: '要折', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  NO_FOLDING_REQUIRED: { label: '折無し', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  FOLDED: { label: '折済', color: 'bg-blue-100 text-blue-700 border-blue-200' }
};

export default function FlyerPage() {
  const [flyers, setFlyers] = useState<any[]>([]);
  const [masters, setMasters] = useState({ industries: [], sizes: [], customers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const initialForm = {
    name: '', flyerCode: '', customerId: '', industryId: '', sizeId: '',
    startDate: '', endDate: '', foldStatus: 'NO_FOLDING_REQUIRED', remarks: ''
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [flyerRes, masterRes] = await Promise.all([
        fetch('/api/flyers'),
        fetch('/api/flyers/masters')
      ]);
      const flyerData = await flyerRes.json();
      const masterData = await masterRes.json();

      setFlyers(Array.isArray(flyerData) ? flyerData : []);
      if (masterData && Array.isArray(masterData.customers)) {
        setMasters(masterData);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openForm = (flyer?: any) => {
    if (flyer) {
      setCurrentId(flyer.id);
      setFormData({
        name: flyer.name,
        flyerCode: flyer.flyerCode || '',
        customerId: flyer.customerId.toString(),
        industryId: flyer.industryId.toString(),
        sizeId: flyer.sizeId.toString(),
        startDate: flyer.startDate ? flyer.startDate.split('T')[0] : '',
        endDate: flyer.endDate ? flyer.endDate.split('T')[0] : '',
        foldStatus: flyer.foldStatus,
        remarks: flyer.remarks || ''
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
      const res = await fetch(currentId ? `/api/flyers/${currentId}` : '/api/flyers', {
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
    if (!confirm('このチラシを削除しますか？\n(※すでにスケジュールに登録されている場合は削除できません)')) return;
    try {
      const res = await fetch(`/api/flyers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      fetchData();
    } catch (e) { alert('削除に失敗しました。関連データが存在する可能性があります。'); }
  };

  const filteredFlyers = flyers.filter(f => 
    f.name.includes(searchTerm) || (f.customer?.name || '').includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-file-earmark-richtext text-fuchsia-600"></i> チラシ案件管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">配布するチラシ情報の登録と、折りステータス・在庫の確認を行います。</p>
        </div>
        <button onClick={() => openForm()} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">
          <i className="bi bi-plus-lg"></i> 新規チラシ登録
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input type="text" placeholder="チラシ名、顧客名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-fuchsia-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">チラシ名 / コード</th>
              <th className="px-6 py-4">顧客 / 業種</th>
              <th className="px-6 py-4">サイズ / 折ステータス</th>
              <th className="px-6 py-4">有効期間</th>
              <th className="px-6 py-4 text-right bg-slate-100">現在庫</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={6} className="p-8 text-center">読み込み中...</td></tr> : 
             filteredFlyers.map(f => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800 text-base">{f.name}</div>
                  <div className="font-mono text-xs text-slate-400 mt-1">{f.flyerCode || 'コード未設定'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700">{f.customer?.name}</div>
                  <div className="text-xs text-slate-500 mt-1"><i className="bi bi-tag-fill text-slate-300"></i> {f.industry?.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700 mb-1">{f.size?.name}</div>
                  <span className={`px-2 py-1 text-[10px] font-bold border rounded-md ${FOLD_STATUS_MAP[f.foldStatus].color}`}>
                    {FOLD_STATUS_MAP[f.foldStatus].label}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                  {f.startDate ? new Date(f.startDate).toLocaleDateString() : '未定'} <br/>
                  〜 {f.endDate ? new Date(f.endDate).toLocaleDateString() : '未定'}
                </td>
                <td className="px-6 py-4 text-right bg-slate-50">
                  <div className="font-bold text-lg text-fuchsia-600">{f.stockCount.toLocaleString()} <span className="text-xs text-slate-500 font-normal">枚</span></div>
                  <button className="text-[10px] font-bold text-blue-600 hover:underline mt-1">納品履歴・追加 &gt;</button>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openForm(f)} className="p-2 text-slate-400 hover:text-fuchsia-600"><i className="bi bi-pencil-square"></i></button>
                  <button onClick={() => del(f.id)} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? 'チラシ情報の編集' : '新規チラシ登録'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">チラシ名 *</label>
                  <input required name="name" value={formData.name} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder="例: 春の入会キャンペーンチラシ" />
                </div>
                
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">顧客 (クライアント) *</label>
                  <select required name="customerId" value={formData.customerId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">選択してください</option>
                    {(masters.customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">業種 (併配NGチェック用) *</label>
                  <select required name="industryId" value={formData.industryId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">選択してください</option>
                    {(masters.industries || []).map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">サイズ *</label>
                  <select required name="sizeId" value={formData.sizeId} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                    <option value="">選択してください</option>
                    {(masters.sizes || []).map((s: any) => <option key={s.id} value={s.id}>{s.name} {s.isFoldRequired ? '(折必須)' : ''}</option>)}                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600">配布開始可能日</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">配布完了期限</label>
                  <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" />
                </div>

                <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="text-xs font-bold text-slate-600 block mb-2">折りステータス (現在の状態)</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="NO_FOLDING_REQUIRED" checked={formData.foldStatus === 'NO_FOLDING_REQUIRED'} onChange={handleInputChange} />
                      <span className="text-sm">折無し (そのまま配布可)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="NEEDS_FOLDING" checked={formData.foldStatus === 'NEEDS_FOLDING'} onChange={handleInputChange} />
                      <span className="text-sm font-bold text-rose-600">要折 (自社作業が必要/配布不可)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="foldStatus" value="FOLDED" checked={formData.foldStatus === 'FOLDED'} onChange={handleInputChange} />
                      <span className="text-sm font-bold text-blue-600">折済 (作業完了/配布可)</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600">備考</label>
                  <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={2} className="w-full border p-2 rounded-lg text-sm" placeholder="注意事項など" />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-bold shadow-md">
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