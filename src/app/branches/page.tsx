'use client';

import React, { useState, useEffect } from 'react';

type Employee = { id: number; lastNameJa: string; firstNameJa: string; isActive: boolean };
type Branch = any; 

export default function BranchPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const initialForm = {
    nameJa: '', nameEn: '', address: '', googleMapUrl: '', 
    openingTime: '', closedDays: '',
    manager1Id: '', manager2Id: '', manager3Id: '', manager4Id: ''
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [branchRes, empRes] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/employees')
      ]);
      const branchData = await branchRes.json();
      const empData = await empRes.json();
      
      setBranches(Array.isArray(branchData) ? branchData : []);
      // 有効な社員のみを店長候補とする
      setEmployees(Array.isArray(empData) ? empData.filter((e: any) => e.isActive) : []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openForm = (branch?: Branch) => {
    if (branch) {
      setCurrentId(branch.id);
      setFormData({
        nameJa: branch.nameJa || '',
        nameEn: branch.nameEn || '',
        address: branch.address || '',
        googleMapUrl: branch.googleMapUrl || '',
        openingTime: branch.openingTime || '',
        closedDays: branch.closedDays || '',
        manager1Id: branch.manager1Id?.toString() || '',
        manager2Id: branch.manager2Id?.toString() || '',
        manager3Id: branch.manager3Id?.toString() || '',
        manager4Id: branch.manager4Id?.toString() || ''
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
      const url = currentId ? `/api/branches/${currentId}` : '/api/branches';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Error saving branch');
      setIsFormModalOpen(false);
      fetchData();
    } catch (e) { alert('保存に失敗しました'); }
  };

  const del = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/branches/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error deleting branch');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (e) { alert('削除に失敗しました（※配布員が紐付いている場合は削除できません）'); }
  };

  // 店長名を表示するためのヘルパー関数
  const getManagerName = (manager: any) => {
    return manager ? `${manager.lastNameJa} ${manager.firstNameJa}` : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-shop text-orange-600"></i> 支店管理 (Branches)
          </h1>
          <p className="text-slate-500 text-sm mt-1">店舗の基本情報や担当店長を設定します。</p>
        </div>
        <button onClick={() => openForm()} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold shadow-md">
          <i className="bi bi-plus-lg"></i> 新規支店登録
        </button>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">支店名</th>
              <th className="px-6 py-4">営業時間 / 定休日</th>
              <th className="px-6 py-4">店長体制</th>
              <th className="px-6 py-4">住所 / Map</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center">読み込み中...</td></tr> : 
             branches.map(b => {
               const managers = [getManagerName(b.manager1), getManagerName(b.manager2), getManagerName(b.manager3), getManagerName(b.manager4)].filter(Boolean);
               
               return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-base">{b.nameJa}</div>
                    <div className="font-mono text-xs text-slate-400">{b.nameEn}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-slate-700"><i className="bi bi-clock mr-1 text-slate-400"></i> {b.openingTime || '-'}</div>
                    <div className="text-slate-500 text-xs mt-1"><i className="bi bi-calendar-x mr-1 text-rose-400"></i> {b.closedDays || '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {managers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {managers.map((m, idx) => (
                          <span key={idx} className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-[10px] font-bold">
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="truncate max-w-[200px] text-xs text-slate-600 mb-1">{b.address || '-'}</div>
                    {b.googleMapUrl && (
                      <a href={b.googleMapUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                        <i className="bi bi-geo-alt-fill"></i> Mapを開く
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openForm(b)} className="p-2 text-slate-400 hover:text-orange-600"><i className="bi bi-pencil-square"></i></button>
                    <button onClick={() => { setCurrentId(b.id); setIsDeleteModalOpen(true); }} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash"></i></button>
                  </td>
                </tr>
               );
             })}
          </tbody>
        </table>
      </div>

      {/* 登録・編集モーダル */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? '支店情報を編集' : '新規支店登録'}</h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-6">
              {/* 基本情報 */}
              <div>
                <h4 className="font-bold text-sm text-orange-600 border-b border-orange-100 pb-2 mb-4">基本情報</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-600">支店名 (日本語) *</label><input required name="nameJa" value={formData.nameJa} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder="例: 高田馬場" /></div>
                  <div><label className="text-xs font-bold text-slate-600">支店名 (英語) *</label><input required name="nameEn" value={formData.nameEn} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm font-mono" placeholder="例: Takadanobaba" /></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-slate-600">住所</label><input name="address" value={formData.address} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" /></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-slate-600">Google Map URL</label><input name="googleMapUrl" value={formData.googleMapUrl} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder="https://maps.app.goo.gl/..." /></div>
                  <div><label className="text-xs font-bold text-slate-600">開店時間</label><input type="time" name="openingTime" value={formData.openingTime} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" /></div>
                  <div><label className="text-xs font-bold text-slate-600">定休日</label><input name="closedDays" value={formData.closedDays} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm" placeholder="例: 火曜日" /></div>
                </div>
              </div>

              {/* 店長設定 */}
              <div>
                <h4 className="font-bold text-sm text-orange-600 border-b border-orange-100 pb-2 mb-4">店長設定 (最大4名)</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(num => (
                    <div key={num}>
                      <label className="text-xs font-bold text-slate-600">店長 {num}</label>
                      <select name={`manager${num}Id`} value={(formData as any)[`manager${num}Id`]} onChange={handleInputChange} className="w-full border p-2 rounded-lg text-sm bg-white">
                        <option value="">未設定</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-bold shadow-md">{currentId ? '更新する' : '登録する'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl text-center max-w-sm w-full">
            <h3 className="font-bold text-lg mb-2 text-slate-800">支店を削除しますか？</h3>
            <p className="text-sm text-slate-500 mb-6">この操作は元に戻せません。</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold">キャンセル</button>
              <button onClick={del} className="px-4 py-2 bg-rose-600 text-white rounded-lg font-bold">削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}