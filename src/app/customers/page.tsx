'use client';

import React, { useState, useEffect, useMemo } from 'react';

// --- 型定義 ---
// 社員型（担当営業用）
type Employee = { id: number; lastNameJa: string; firstNameJa: string; isActive: boolean; };// ★これを追加して、退職フラグを扱えるようにする };

// 顧客型
type Customer = {
  id: number;
  customerCode: string;
  name: string;
  nameKana: string;
  salesRepId: number | null;
  salesRep?: Employee; // 結合データ
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
};

export default function CustomerPage() {
  // --- State ---
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]); // 営業担当選択用
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // モーダル管理
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // 選択データ
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // フォーム初期値
  const initialForm = {
    customerCode: '',
    name: '', nameKana: '',
    salesRepId: '',
    parentCustomerId: '', billingCustomerId: '',
    invoiceRegistrationNumber: '',
    billingCutoffDay: '', paymentMonthDelay: '1', paymentDay: '',
    postalCode: '', address: '', addressBuilding: '',
    phone: '', fax: '',
    note: '',
    status: 'VALID'
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [custRes, empRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/employees')
      ]);

      if (!custRes.ok) throw new Error('Failed to fetch customers');
      if (!empRes.ok) throw new Error('Failed to fetch employees');
      
      const custData = await custRes.json();
      const empData = await empRes.json();

      setCustomers(Array.isArray(custData) ? custData : []);

      // ★ここを修正: 全社員データから「有効(isActive: true)」な人だけを抽出
      if (Array.isArray(empData)) {
        const activeOnly = empData.filter((e: any) => e.isActive === true);
        setEmployees(activeOnly);
      } else {
        setEmployees([]);
      }

    } catch (error) {
      console.error(error);
      setCustomers([]);
      setEmployees([]); // エラー時は空に
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 検索フィルタ ---
  const filteredCustomers = useMemo(() => {
    // ★ここを追加：customersが配列でない場合は空配列を返す
    if (!Array.isArray(customers)) return [];

    return customers.filter(c => 
      (c.name && c.name.includes(searchTerm)) || 
      (c.nameKana && c.nameKana.includes(searchTerm)) || 
      (c.customerCode && c.customerCode.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  // --- ハンドラ ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openFormModal = (customer?: Customer) => {
    if (customer) {
      setCurrentId(customer.id);
      setFormData({
        customerCode: customer.customerCode || '',
        name: customer.name,
        nameKana: customer.nameKana,
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
      const url = currentId ? `/api/customers/${currentId}` : '/api/customers';
      const method = currentId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Save failed');
      setIsFormModalOpen(false);
      fetchData();
    } catch (error) {
      alert('保存に失敗しました');
    }
  };

  const confirmDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setCurrentId(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/customers/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (error) {
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-buildings-fill text-blue-600"></i>
            顧客管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">取引先企業の情報を一元管理します。</p>
        </div>
        <button 
          onClick={() => openFormModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2"
        >
          <i className="bi bi-plus-lg"></i> 新規顧客登録
        </button>
      </div>

      {/* 検索バー */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="会社名、カナ、顧客コードで検索..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 顧客一覧テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">顧客コード / 会社名</th>
              <th className="px-6 py-4 font-semibold">電話番号 / 住所</th>
              <th className="px-6 py-4 font-semibold">担当営業</th>
              <th className="px-6 py-4 font-semibold">ステータス</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
               <tr><td colSpan={5} className="p-8 text-center text-slate-400">読み込み中...</td></tr>
            ) : filteredCustomers.length === 0 ? (
               <tr><td colSpan={5} className="p-8 text-center text-slate-400">該当する顧客が見つかりません</td></tr>
            ) : (
              filteredCustomers.map((cust) => (
                <tr 
                  key={cust.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => { setSelectedCustomer(cust); setIsDetailModalOpen(true); }}
                >
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-slate-400 mb-0.5">{cust.customerCode}</div>
                    <div className="font-bold text-slate-800">{cust.name}</div>
                    <div className="text-xs text-slate-400">{cust.nameKana}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-slate-700 mb-0.5"><i className="bi bi-telephone mr-1"></i>{cust.phone || '-'}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{cust.address}{cust.addressBuilding}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {cust.salesRep ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        <i className="bi bi-person-circle"></i>
                        {cust.salesRep.lastNameJa} {cust.salesRep.firstNameJa}
                      </span>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4">
                    {cust.status === 'VALID' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        有効
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        無効
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={(e) => { e.stopPropagation(); openFormModal(cust); }} className="p-2 text-slate-400 hover:text-blue-600">
                      <i className="bi bi-pencil-square text-lg"></i>
                    </button>
                    <button onClick={(e) => confirmDelete(e, cust.id)} className="p-2 text-slate-400 hover:text-rose-600">
                      <i className="bi bi-trash text-lg"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- 詳細モーダル --- */}
      {isDetailModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="bg-slate-800 p-6 text-white flex justify-between items-start">
              <div>
                <div className="text-xs font-mono opacity-60 mb-1">{selectedCustomer.customerCode}</div>
                <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                <p className="text-sm opacity-80">{selectedCustomer.nameKana}</p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-white/60 hover:text-white"><i className="bi bi-x-lg text-xl"></i></button>
            </div>
            
            <div className="p-8 overflow-y-auto bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 基本情報パネル */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b pb-2">基本情報</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="block text-xs text-slate-500">電話番号</span>
                      <span className="font-bold text-slate-800">{selectedCustomer.phone || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">FAX</span>
                      <span className="font-bold text-slate-800">{selectedCustomer.fax || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">住所</span>
                      <span className="font-bold text-slate-800">
                        〒{selectedCustomer.postalCode} <br/>
                        {selectedCustomer.address} {selectedCustomer.addressBuilding}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 取引条件パネル */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b pb-2">取引条件・インボイス</h4>
                   <div className="space-y-3 text-sm">
                    <div>
                      <span className="block text-xs text-slate-500">インボイス登録番号</span>
                      <span className="font-mono font-bold text-slate-800">{selectedCustomer.invoiceRegistrationNumber || '-'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       <div><span className="text-xs text-slate-500">締日</span><div className="font-bold">{selectedCustomer.billingCutoffDay ? `${selectedCustomer.billingCutoffDay}日` : '-'}</div></div>
                       <div><span className="text-xs text-slate-500">支払月</span><div className="font-bold">{selectedCustomer.paymentMonthDelay ? `${selectedCustomer.paymentMonthDelay}ヶ月後` : '-'}</div></div>
                       <div><span className="text-xs text-slate-500">支払日</span><div className="font-bold">{selectedCustomer.paymentDay ? `${selectedCustomer.paymentDay}日` : '-'}</div></div>
                    </div>
                    <div className="mt-4 pt-3 border-t">
                      <span className="block text-xs text-slate-500">担当営業</span>
                      <span className="font-bold text-blue-600">
                         {selectedCustomer.salesRep ? `${selectedCustomer.salesRep.lastNameJa} ${selectedCustomer.salesRep.firstNameJa}` : '未設定'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 備考パネル */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 md:col-span-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">備考</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedCustomer.note || 'なし'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t flex justify-end">
              <button onClick={() => { setIsDetailModalOpen(false); openFormModal(selectedCustomer); }} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700">編集する</button>
            </div>
          </div>
        </div>
      )}

      {/* --- 登録・編集モーダル --- */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh] animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{currentId ? '顧客情報を編集' : '新規顧客登録'}</h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-8 overflow-y-auto">
              
              {/* セクション1: 基本情報 */}
              <div>
                <h4 className="text-sm font-bold text-blue-600 mb-3 border-b border-blue-100 pb-1 flex items-center gap-2">
                  <i className="bi bi-building"></i> 基本情報
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="text-xs font-bold text-slate-600">顧客コード</label><input name="customerCode" value={formData.customerCode} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" required /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-600">会社名・屋号</label><input name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" required /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-600">会社名 (カナ)</label><input name="nameKana" value={formData.nameKana} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" required /></div>
                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-600">担当営業</label>
                    <select 
                        name="salesRepId" 
                        value={formData.salesRepId} 
                        onChange={handleInputChange} 
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                        <option value="">選択してください</option>
                        {/* employeesが空だと何も表示されません */}
                        {employees.map(e => (
                        <option key={e.id} value={e.id}>
                            {e.lastNameJa} {e.firstNameJa}
                        </option>
                        ))}
                    </select>
                    </div>
                </div>
              </div>

              {/* セクション2: 連絡先 */}
              <div>
                <h4 className="text-sm font-bold text-blue-600 mb-3 border-b border-blue-100 pb-1 flex items-center gap-2">
                  <i className="bi bi-geo-alt"></i> 所在地・連絡先
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><label className="text-xs font-bold text-slate-600">郵便番号</label><input name="postalCode" value={formData.postalCode} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="123-4567" /></div>
                  <div className="md:col-span-3"><label className="text-xs font-bold text-slate-600">住所</label><input name="address" value={formData.address} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="都道府県 市区町村 番地" /></div>
                  <div className="md:col-span-4"><label className="text-xs font-bold text-slate-600">建物名・階数</label><input name="addressBuilding" value={formData.addressBuilding} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="ビル名など" /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-600">電話番号</label><input name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-600">FAX</label><input name="fax" value={formData.fax} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" /></div>
                </div>
              </div>

              {/* セクション3: 取引条件 */}
              <div>
                <h4 className="text-sm font-bold text-blue-600 mb-3 border-b border-blue-100 pb-1 flex items-center gap-2">
                  <i className="bi bi-currency-yen"></i> 取引条件・インボイス
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-600">インボイス登録番号</label><input name="invoiceRegistrationNumber" value={formData.invoiceRegistrationNumber} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" placeholder="T1234567890123" /></div>
                  <div><label className="text-xs font-bold text-slate-600">締日 (99=末)</label><input type="number" name="billingCutoffDay" value={formData.billingCutoffDay} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="text-xs font-bold text-slate-600">支払日 (99=末)</label><input type="number" name="paymentDay" value={formData.paymentDay} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div><label className="text-xs font-bold text-slate-600">支払サイト (月)</label><input type="number" name="paymentMonthDelay" value={formData.paymentMonthDelay} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">ステータス</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                      <option value="VALID">有効</option><option value="INVALID">無効</option>
                    </select>
                  </div>
                </div>
              </div>

               {/* セクション4: 関係・備考 */}
              <div>
                <h4 className="text-sm font-bold text-blue-600 mb-3 border-b border-blue-100 pb-1 flex items-center gap-2">
                  <i className="bi bi-diagram-3"></i> 関係・備考
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                    <label className="text-xs font-bold text-slate-600">親顧客 (チェーン本部等)</label>
                    <select name="parentCustomerId" value={formData.parentCustomerId} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                      <option value="">なし</option>
                      {customers.filter(c => c.id !== currentId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                   <div>
                    <label className="text-xs font-bold text-slate-600">請求先 (自社以外へ請求の場合)</label>
                    <select name="billingCustomerId" value={formData.billingCustomerId} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-lg bg-white">
                      <option value="">自社へ請求</option>
                      {customers.filter(c => c.id !== currentId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">備考</label>
                    <textarea name="note" value={formData.note} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold text-sm">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all">
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
            <h3 className="font-bold text-slate-800 text-lg mb-2">顧客を削除しますか？</h3>
            <p className="text-slate-500 text-sm mb-6">ステータスが「無効」に変更されます。<br/>物理削除は行われません。</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm">キャンセル</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm shadow-md">削除実行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}