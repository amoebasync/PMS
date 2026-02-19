'use client';

import React, { useState, useEffect } from 'react';

// --- 型定義 (DB構造に準拠) ---
type Department = { id: number; code: string; name: string };
type Role = { id: number; name: string; permissionLevel: string };
type Country = { id: number; code: string; name: string; nameEn: string };

type Employee = {
  id: number;
  employeeCode: string | null;
  lastNameJa: string;
  firstNameJa: string;
  lastNameKana: string;
  firstNameKana: string;
  lastNameEn: string | null; // 追加
  firstNameEn: string | null; // 追加
  email: string;
  hireDate: string;
  birthday: string | null; // 追加
  gender: 'male' | 'female' | 'other' | 'unknown'; // 追加
  isActive: boolean;
  department?: Department;
  role?: Role;
  country?: Country;
};

// --- アバターコンポーネント ---
const Avatar = ({ name, size = 'md' }: { name: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl'
  }[size];
  
  // 色を名前からランダム風に決定
  const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-violet-500'];
  const colorIndex = name ? name.length % colors.length : 0;
  
  return (
    <div className={`${sizeClass} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold shadow-sm border-2 border-white`}>
      {name ? name.charAt(0) : 'U'}
    </div>
  );
};

// --- メインコンポーネント ---
export default function EmployeePage() {
  // データ管理
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  
  // UI状態
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);   // 登録・編集用
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false); // 詳細表示用
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // 削除確認用
  
  // 選択中のデータ
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // フォーム初期値
  const initialForm = {
    employeeCode: '',
    lastNameJa: '', firstNameJa: '',
    lastNameKana: '', firstNameKana: '',
    lastNameEn: '', firstNameEn: '', // 追加
    email: '',
    password: 'password123', // 初期パスワード
    hireDate: new Date().toISOString().split('T')[0], // 今日
    birthday: '', // 追加
    gender: 'unknown' as const, // 型アサーション
    departmentId: '',
    roleId: '',
    countryId: '',
    status: 'ACTIVE' // UI操作用
  };
  
  const [formData, setFormData] = useState(initialForm);

  // --- データ取得 (社員一覧 + 各マスタ) ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // API並行リクエスト
      const [empRes, masterRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/masters')
      ]);
      
      const empData = await empRes.json();
      const masterData = await masterRes.json();

      setEmployees(empData);
      setDepartments(masterData.departments || []);
      setRoles(masterData.roles || []);
      setCountries(masterData.countries || []);
    } catch (error) {
      console.error('Data fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- ハンドラ関数 ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // フォームモーダルを開く（新規・編集）
  const openFormModal = (employee?: Employee) => {
    if (employee) {
      // 編集モード：既存データをフォームにセット
      setCurrentId(employee.id);
      setFormData({
        employeeCode: employee.employeeCode || '',
        lastNameJa: employee.lastNameJa,
        firstNameJa: employee.firstNameJa,
        lastNameKana: employee.lastNameKana,
        firstNameKana: employee.firstNameKana,
        lastNameEn: employee.lastNameEn || '', // 追加
        firstNameEn: employee.firstNameEn || '', // 追加
        email: employee.email,
        password: '', // パスワードは編集時は空（変更しない）
        hireDate: new Date(employee.hireDate).toISOString().split('T')[0],
        birthday: employee.birthday ? new Date(employee.birthday).toISOString().split('T')[0] : '', // 追加
        gender: employee.gender || 'unknown',
        departmentId: employee.department?.id.toString() || '',
        roleId: employee.role?.id.toString() || '',
        countryId: employee.country?.id.toString() || '',
        status: employee.isActive ? 'ACTIVE' : 'INACTIVE'
      });
    } else {
      // 新規モード：リセット
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormModalOpen(true);
  };

  // 詳細モーダルを開く
  const openDetailModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  };

  // 保存処理
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 送信データの整形（isActiveの変換など）
    const submitData = {
      ...formData,
      isActive: formData.status === 'ACTIVE',
      // 空文字の場合はnullにする
      birthday: formData.birthday || null,
      lastNameEn: formData.lastNameEn || null,
      firstNameEn: formData.firstNameEn || null,
    };

    try {
      let res;
      if (currentId) {
        // 更新 (PUT)
        res = await fetch(`/api/employees/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        });
      } else {
        // 新規登録 (POST)
        res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        });
      }

      if (!res.ok) throw new Error('Failed to save');

      setIsFormModalOpen(false);
      fetchData(); // リスト更新
    } catch (error) {
      console.error(error);
      alert('保存に失敗しました');
    }
  };

  // パスワードリセット処理
  const handlePasswordReset = async () => {
    if (!currentId) return;
    
    if (!confirm('この社員のパスワードをリセットしますか？\n新しいパスワードが自動生成されます。')) {
      return;
    }

    try {
      const res = await fetch(`/api/employees/${currentId}/reset`, {
        method: 'POST',
      });
      
      if (!res.ok) throw new Error('Reset failed');

      const data = await res.json();
      
      // 新しいパスワードをアラートで表示（本来はモーダルなどで綺麗に見せるのがベター）
      alert(`パスワードをリセットしました。\n\n新しいパスワード: ${data.newPassword}\n\nこのパスワードを社員に伝えてください。画面を閉じると二度と表示されません。`);
      
    } catch (error) {
      alert('パスワードリセットに失敗しました');
    }
  };

  // 削除処理
  const confirmDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // 行クリックイベントを止める
    setCurrentId(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/employees/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (error) {
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="space-y-6">
      {/* --- ヘッダー --- */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-person-vcard-fill text-blue-600"></i>
            社員管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">人事マスタおよびアカウント情報の管理。</p>
        </div>
        <button 
          onClick={() => openFormModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2"
        >
          <i className="bi bi-plus-lg"></i> 新規社員登録
        </button>
      </div>

      {/* --- 一覧テーブル --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">社員番号 / 氏名</th>
              <th className="px-6 py-4 font-semibold">所属 / 役職</th>
              <th className="px-6 py-4 font-semibold">国籍</th>
              <th className="px-6 py-4 font-semibold">入社日</th>
              <th className="px-6 py-4 font-semibold">ステータス</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">読み込み中...</td></tr>
            ) : employees.length === 0 ? (
               <tr><td colSpan={6} className="p-8 text-center text-slate-400">データがありません</td></tr>
            ) : (
              employees.map((emp) => (
                <tr 
                  key={emp.id} 
                  onClick={() => openDetailModal(emp)} // ★行クリックで詳細へ
                  className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.firstNameJa} />
                      <div>
                        <div className="text-xs font-mono text-slate-400 mb-0.5">{emp.employeeCode || '-'}</div>
                        <div className="font-bold text-slate-800">{emp.lastNameJa} {emp.firstNameJa}</div>
                        <div className="text-xs text-slate-400">
                          {emp.lastNameEn ? `${emp.firstNameEn} ${emp.lastNameEn}` : `${emp.lastNameKana} ${emp.firstNameKana}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-slate-800 font-medium">{emp.department?.name || '未所属'}</div>
                    <div className="text-xs text-slate-500">{emp.role?.name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {emp.country ? (
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs">
                        <span className="font-bold text-slate-600">{emp.country.code}</span>
                        <span className="text-slate-500">{emp.country.name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(emp.hireDate).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4">
                    {emp.isActive ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                        在職中
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        退職済
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openFormModal(emp); }} // 行クリックイベントを止めて編集
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <i className="bi bi-pencil-square text-lg"></i>
                    </button>
                    <button 
                      onClick={(e) => confirmDelete(e, emp.id)} // 行クリックイベントを止めて削除
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <i className="bi bi-trash text-lg"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- ★ 詳細表示モーダル (リデザイン版) --- */}
      {isDetailModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]">
            
            {/* 左側: プロフィールサマリー (Blue Section) */}
            <div className="w-full md:w-1/3 bg-gradient-to-b from-blue-600 to-indigo-800 p-8 text-white flex flex-col items-center text-center relative">
               {/* 閉じるボタン（スマホ用） */}
               <button onClick={() => setIsDetailModalOpen(false)} className="md:hidden absolute top-4 right-4 text-white/70 hover:text-white">
                  <i className="bi bi-x-lg text-xl"></i>
               </button>

              <div className="relative mb-6 mt-4">
                <Avatar name={selectedEmployee.firstNameJa} size="xl" />
                <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-indigo-800 ${selectedEmployee.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`}></div>
              </div>
              
              <div className="space-y-1 mb-6">
                <div className="text-xs font-mono opacity-70 tracking-tighter uppercase">{selectedEmployee.employeeCode || 'No Employee ID'}</div>
                <h2 className="text-2xl font-black">{selectedEmployee.lastNameJa} {selectedEmployee.firstNameJa}</h2>
                <div className="text-sm opacity-80">{selectedEmployee.lastNameKana} {selectedEmployee.firstNameKana}</div>
                {selectedEmployee.lastNameEn && (
                   <div className="text-xs opacity-60 mt-1 font-medium">{selectedEmployee.firstNameEn} {selectedEmployee.lastNameEn}</div>
                )}
              </div>

              <div className="w-full space-y-3 pt-6 border-t border-white/10">
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-building text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.department?.name || '未所属'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-briefcase text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.role?.name || '役職なし'}</span>
                </div>
              </div>
            </div>

            {/* 右側: 詳細データ (White Section) */}
            <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
              <div className="flex justify-between items-center mb-6 hidden md:flex">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                  詳細ステータス
                </h3>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors">
                  <i className="bi bi-x-lg text-xl"></i>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ステータス */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">STATUS</div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${selectedEmployee.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${selectedEmployee.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      {selectedEmployee.isActive ? 'Active (在職中)' : 'Inactive (退職済)'}
                    </span>
                  </div>
                </div>

                {/* 入社日 */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HIRE DATE</div>
                  <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-700">
                    <i className="bi bi-calendar-event text-blue-500"></i>
                    {new Date(selectedEmployee.hireDate).toLocaleDateString('ja-JP')}
                  </div>
                </div>

                {/* 性別 */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GENDER</div>
                   <div className="text-sm font-bold text-slate-700 capitalize">
                      {selectedEmployee.gender === 'male' ? 'Male (男性)' : 
                       selectedEmployee.gender === 'female' ? 'Female (女性)' : 
                       'Other / Unknown'}
                   </div>
                </div>

                {/* 誕生日 */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BIRTHDAY</div>
                   <div className="text-sm font-bold text-slate-700">
                      {selectedEmployee.birthday ? new Date(selectedEmployee.birthday).toLocaleDateString('ja-JP') : '-'}
                   </div>
                </div>

                {/* メールアドレス */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1 col-span-1 sm:col-span-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EMAIL ADDRESS</div>
                  <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <i className="bi bi-envelope-fill text-slate-400"></i>
                    {selectedEmployee.email}
                  </div>
                </div>

                {/* 国籍 */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1 col-span-1 sm:col-span-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COUNTRY / LOCATION</div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <i className="bi bi-globe-asia-australia text-indigo-500"></i>
                    {selectedEmployee.country ? `${selectedEmployee.country.name} (${selectedEmployee.country.code})` : '未設定'}
                  </div>
                </div>
              </div>

              {/* フッターアクション */}
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => { setIsDetailModalOpen(false); openFormModal(selectedEmployee); }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <i className="bi bi-pencil-square"></i>
                  編集する
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- 登録・編集モーダル --- */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">
                {currentId ? '社員情報を編集' : '新規社員登録'}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto">
              {/* 基本情報 */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">氏名情報</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">姓 (漢字) <span className="text-red-500">*</span></label>
                    <input name="lastNameJa" value={formData.lastNameJa} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: 山田" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">名 (漢字) <span className="text-red-500">*</span></label>
                    <input name="firstNameJa" value={formData.firstNameJa} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: 太郎" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">セイ (カナ) <span className="text-red-500">*</span></label>
                    <input name="lastNameKana" value={formData.lastNameKana} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">メイ (カナ) <span className="text-red-500">*</span></label>
                    <input name="firstNameKana" value={formData.firstNameKana} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  {/* ★英語名 */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Last Name (English)</label>
                    <input name="lastNameEn" value={formData.lastNameEn} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: Yamada" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">First Name (English)</label>
                    <input name="firstNameEn" value={formData.firstNameEn} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: Taro" />
                  </div>
                </div>
              </div>

              {/* 基本属性 */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">基本属性</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">社員コード</label>
                    <input name="employeeCode" value={formData.employeeCode} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: 10001" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">入社日 <span className="text-red-500">*</span></label>
                    <input type="date" name="hireDate" value={formData.hireDate} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  {/* ★誕生日 */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">誕生日</label>
                    <input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   {/* ★性別 */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">性別</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="unknown">不明</option>
                      <option value="male">男性</option>
                      <option value="female">女性</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">ステータス</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="ACTIVE">在職中 (Active)</option>
                      <option value="INACTIVE">退職済 (Inactive)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 所属・権限 */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">所属・権限・国籍</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">部署</label>
                    <select name="departmentId" value={formData.departmentId} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="">選択してください</option>
                      {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">役職</label>
                    <select name="roleId" value={formData.roleId} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="">選択してください</option>
                      {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">国籍</label>
                    <select name="countryId" value={formData.countryId} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="">選択してください</option>
                      {countries.map(country => <option key={country.id} value={country.id}>{country.name} ({country.code})</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* アカウント情報 */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">アカウント情報</h4>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">メールアドレス <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                
                {!currentId && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                    <i className="bi bi-info-circle mr-1"></i> 初期パスワードは自動的に <code>password123</code> に設定されます。
                  </div>
                )}

                {/* ★編集時のみ表示するリセットボタン */}
                {currentId && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="w-full py-2 border-2 border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <i className="bi bi-key-fill"></i> パスワードをリセット（再発行）
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1 text-center">
                      ※ボタンを押すと新しいパスワードが即座に発行されます。
                    </p>
                  </div>
                )}
                
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm transition-colors">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all">
                  {currentId ? '更新する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 削除確認モーダル (省略せず記述) --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center animate-fade-in-up">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-2">本当に削除しますか？</h3>
            <p className="text-slate-500 text-sm mb-6">この操作は取り消せません。<br/>論理削除としてステータスが更新されます。</p>
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