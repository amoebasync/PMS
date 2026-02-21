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
  lastNameEn: string | null;
  firstNameEn: string | null;
  email: string;
  hireDate: string;
  birthday: string | null;
  gender: 'male' | 'female' | 'other' | 'unknown';
  isActive: boolean;
  employmentType: string; 
  avatarUrl: string | null; 
  department?: Department;
  role?: Role;
  country?: Country;
  financial?: any; 
};

// --- 定数マッピング ---
const EMP_TYPE_MAP: Record<string, string> = { FULL_TIME: '正社員', PART_TIME: 'アルバイト・パート', OUTSOURCE: '業務委託' };
const SALARY_TYPE_MAP: Record<string, string> = { MONTHLY: '月給', DAILY: '日給', HOURLY: '時給' };
const PAY_METHOD_MAP: Record<string, string> = { BANK_TRANSFER: '銀行振込', CASH: '現金手渡し' };
const PAY_CYCLE_MAP: Record<string, string> = { MONTHLY: '月払い', WEEKLY: '週払い', DAILY: '日払い' };

// --- アバターコンポーネント ---
const Avatar = ({ name, url, size = 'md' }: { name: string, url?: string | null, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl'
  }[size];
  
  if (url) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden shadow-sm border-2 border-white shrink-0`}>
        <img src={url} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-violet-500'];
  const colorIndex = name ? name.length % colors.length : 0;
  
  return (
    <div className={`${sizeClass} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold shadow-sm border-2 border-white shrink-0`}>
      {name ? name.charAt(0) : 'U'}
    </div>
  );
};

// --- メインコンポーネント ---
export default function EmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const initialForm = {
    employeeCode: '', lastNameJa: '', firstNameJa: '', lastNameKana: '', firstNameKana: '',
    lastNameEn: '', firstNameEn: '', email: '', password: 'password123',
    hireDate: new Date().toISOString().split('T')[0], birthday: '', gender: 'unknown' as const,
    departmentId: '', roleId: '', countryId: '', status: 'ACTIVE',
    
    employmentType: 'FULL_TIME',
    salaryType: 'MONTHLY',
    baseSalary: '', hourlyRate: '', dailyRate: '',
    paymentMethod: 'BANK_TRANSFER', paymentCycle: 'MONTHLY'
  };
  
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
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

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openFormModal = (employee?: Employee) => {
    if (employee) {
      setCurrentId(employee.id);
      setFormData({
        employeeCode: employee.employeeCode || '',
        lastNameJa: employee.lastNameJa, firstNameJa: employee.firstNameJa,
        lastNameKana: employee.lastNameKana || '', firstNameKana: employee.firstNameKana || '',
        lastNameEn: employee.lastNameEn || '', firstNameEn: employee.firstNameEn || '',
        email: employee.email, password: '', 
        // ★ 修正: 日付が有効かどうかを判定してから変換する安全な処理に変更
        hireDate: employee.hireDate && !isNaN(new Date(employee.hireDate).getTime()) ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
        birthday: employee.birthday && !isNaN(new Date(employee.birthday).getTime()) ? new Date(employee.birthday).toISOString().split('T')[0] : '', 
        gender: employee.gender || 'unknown',
        departmentId: employee.department?.id.toString() || '',
        roleId: employee.role?.id.toString() || '',
        countryId: employee.country?.id.toString() || '',
        status: employee.isActive ? 'ACTIVE' : 'INACTIVE',

        employmentType: employee.employmentType || 'FULL_TIME',
        salaryType: employee.financial?.salaryType || 'MONTHLY',
        baseSalary: employee.financial?.baseSalary?.toString() || '',
        hourlyRate: employee.financial?.hourlyRate?.toString() || '',
        dailyRate: employee.financial?.dailyRate?.toString() || '',
        paymentMethod: employee.financial?.paymentMethod || 'BANK_TRANSFER',
        paymentCycle: employee.financial?.paymentCycle || 'MONTHLY',
      });
    } else {
      setCurrentId(null);
      setFormData(initialForm);
    }
    setIsFormModalOpen(true);
  };

  const openDetailModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      isActive: formData.status === 'ACTIVE',
      // 日付が空欄の場合はnullとして保存
      hireDate: formData.hireDate || null,
      birthday: formData.birthday || null,
      lastNameEn: formData.lastNameEn || null,
      firstNameEn: formData.firstNameEn || null,
    };

    try {
      const url = currentId ? `/api/employees/${currentId}` : '/api/employees';
      const method = currentId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitData) });
      if (!res.ok) throw new Error('Failed to save');

      setIsFormModalOpen(false);
      fetchData();
    } catch (error) {
      alert('保存に失敗しました');
    }
  };

  const handlePasswordReset = async () => {
    if (!currentId) return;
    if (!confirm('この社員のパスワードをリセットしますか？\n新しいパスワードが自動生成されます。')) return;

    try {
      const res = await fetch(`/api/employees/${currentId}/reset`, { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      const data = await res.json();
      alert(`パスワードをリセットしました。\n\n新しいパスワード: ${data.newPassword}\n\nこのパスワードを社員に伝えてください。画面を閉じると二度と表示されません。`);
    } catch (error) { alert('パスワードリセットに失敗しました'); }
  };

  const confirmDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); 
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
    } catch (error) { alert('削除に失敗しました'); }
  };

  return (
    <div className="space-y-6">
      {/* --- ヘッダー --- */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-person-vcard-fill text-blue-600"></i> 社員管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">人事マスタ、アカウント情報および契約・給与情報の管理。</p>
        </div>
        <button onClick={() => openFormModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2">
          <i className="bi bi-plus-lg"></i> 新規社員登録
        </button>
      </div>

      {/* --- 一覧テーブル --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">社員番号 / 氏名</th>
              <th className="px-6 py-4 font-semibold">雇用形態 / 役職</th>
              <th className="px-6 py-4 font-semibold">所属 / 国籍</th>
              <th className="px-6 py-4 font-semibold">ステータス</th>
              <th className="px-6 py-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (<tr><td colSpan={5} className="p-8 text-center text-slate-400">読み込み中...</td></tr>) : 
             employees.length === 0 ? (<tr><td colSpan={5} className="p-8 text-center text-slate-400">データがありません</td></tr>) : (
              employees.map((emp) => (
                <tr key={emp.id} onClick={() => openDetailModal(emp)} className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.firstNameJa} url={emp.avatarUrl} />
                      <div>
                        <div className="text-xs font-mono text-slate-400 mb-0.5">{emp.employeeCode || '-'}</div>
                        <div className="font-bold text-slate-800">{emp.lastNameJa} {emp.firstNameJa}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wide">
                          {emp.lastNameEn || emp.firstNameEn 
                            ? [emp.firstNameEn, emp.lastNameEn].filter(Boolean).join(' ') 
                            : [emp.lastNameKana, emp.firstNameKana].filter(Boolean).join(' ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-blue-700 font-bold text-xs bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block mb-1">
                      {EMP_TYPE_MAP[emp.employmentType] || '未設定'}
                    </div>
                    <div className="text-xs text-slate-500">{emp.role?.name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-slate-800 font-medium">{emp.department?.name || '未所属'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {emp.country ? `${emp.country.name} (${emp.country.code})` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {emp.isActive ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>在職中
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        退職済
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={(e) => { e.stopPropagation(); openFormModal(emp); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                      <i className="bi bi-pencil-square text-lg"></i>
                    </button>
                    <button onClick={(e) => confirmDelete(e, emp.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                      <i className="bi bi-trash text-lg"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- ★ 詳細表示モーダル --- */}
      {isDetailModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]">
            
            {/* 左側: プロフィールサマリー */}
            <div className="w-full md:w-1/3 bg-gradient-to-b from-blue-600 to-indigo-800 p-8 text-white flex flex-col items-center text-center relative overflow-y-auto">
               <button onClick={() => setIsDetailModalOpen(false)} className="md:hidden absolute top-4 right-4 text-white/70 hover:text-white">
                  <i className="bi bi-x-lg text-xl"></i>
               </button>

              <div className="relative mb-6 mt-4">
                <Avatar name={selectedEmployee.firstNameJa} url={selectedEmployee.avatarUrl} size="xl" />
                <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-indigo-800 ${selectedEmployee.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`}></div>
              </div>
              
              <div className="space-y-1 mb-6">
                <div className="text-xs font-mono opacity-70 tracking-tighter uppercase">{selectedEmployee.employeeCode || 'No Employee ID'}</div>
                <h2 className="text-2xl font-black">{selectedEmployee.lastNameJa} {selectedEmployee.firstNameJa}</h2>
                <div className="text-sm font-bold text-blue-200 mt-1">{EMP_TYPE_MAP[selectedEmployee.employmentType] || '未設定'}</div>
              </div>

              <div className="w-full space-y-3 pt-6 border-t border-white/10 text-left">
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-building text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.department?.name || '未所属'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-briefcase text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.role?.name || '役職なし'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-envelope text-blue-200"></i>
                  <span className="font-semibold truncate">{selectedEmployee.email}</span>
                </div>
              </div>
            </div>

            {/* 右側: 詳細データ */}
            <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
              <div className="flex justify-between items-center mb-6 hidden md:flex">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                  詳細・契約ステータス
                </h3>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors">
                  <i className="bi bi-x-lg text-xl"></i>
                </button>
              </div>

              {/* ★ 機密情報: 契約・給与情報 */}
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 mt-2"><i className="bi bi-cash-stack mr-1 text-indigo-500"></i> 契約・給与情報 (機密)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">給与形態</div>
                  <div className="text-sm font-bold text-slate-700 mt-1">{SALARY_TYPE_MAP[selectedEmployee.financial?.salaryType] || '-'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">給与単価</div>
                  <div className="text-lg font-mono font-black text-indigo-600 mt-1">
                    ¥{selectedEmployee.financial?.salaryType === 'MONTHLY' ? (selectedEmployee.financial?.baseSalary?.toLocaleString() || 0) : 
                      selectedEmployee.financial?.salaryType === 'DAILY' ? (selectedEmployee.financial?.dailyRate?.toLocaleString() || 0) : 
                      (selectedEmployee.financial?.hourlyRate?.toLocaleString() || 0)}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">支払方法・サイクル</div>
                  <div className="text-sm font-bold text-slate-700 mt-1">
                    {PAY_METHOD_MAP[selectedEmployee.financial?.paymentMethod] || '-'} / {PAY_CYCLE_MAP[selectedEmployee.financial?.paymentCycle] || '-'}
                  </div>
                </div>
              </div>

              {/* 個人情報 */}
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3"><i className="bi bi-person-lines-fill mr-1 text-blue-500"></i> 個人情報</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HIRE DATE</div>
                  <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-700">
                    <i className="bi bi-calendar-event text-blue-500"></i>{new Date(selectedEmployee.hireDate).toLocaleDateString('ja-JP')}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BIRTHDAY</div>
                   <div className="text-sm font-bold text-slate-700">
                      {selectedEmployee.birthday ? new Date(selectedEmployee.birthday).toLocaleDateString('ja-JP') : '-'}
                   </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GENDER</div>
                   <div className="text-sm font-bold text-slate-700 capitalize">{selectedEmployee.gender === 'male' ? 'Male (男性)' : selectedEmployee.gender === 'female' ? 'Female (女性)' : 'Other / Unknown'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COUNTRY / LOCATION</div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <i className="bi bi-globe-asia-australia text-indigo-500"></i>{selectedEmployee.country ? `${selectedEmployee.country.name} (${selectedEmployee.country.code})` : '未設定'}
                  </div>
                </div>
              </div>

              {/* フッターアクション */}
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => { setIsDetailModalOpen(false); openFormModal(selectedEmployee); }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <i className="bi bi-pencil-square"></i> 編集する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 登録・編集モーダル --- */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">
                {currentId ? '社員情報を編集' : '新規社員登録'}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-8 overflow-y-auto">
              
              {/* 基本情報 */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-blue-800 border-b-2 border-blue-100 pb-2"><i className="bi bi-person mr-2"></i>基本情報</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600">姓 (漢字) <span className="text-red-500">*</span></label><input name="lastNameJa" value={formData.lastNameJa} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600">名 (漢字) <span className="text-red-500">*</span></label><input name="firstNameJa" value={formData.firstNameJa} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600">セイ (カナ) </label><input name="lastNameKana" value={formData.lastNameKana} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600">メイ (カナ) </label><input name="firstNameKana" value={formData.firstNameKana} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600">メールアドレス <span className="text-red-500">*</span></label><input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600">社員コード</label><input name="employeeCode" value={formData.employeeCode} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600">入社日 <span className="text-red-500">*</span></label><input type="date" name="hireDate" value={formData.hireDate} onChange={handleInputChange} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
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
                <h4 className="text-sm font-bold text-blue-800 border-b-2 border-blue-100 pb-2"><i className="bi bi-diagram-3 mr-2"></i>所属・権限</h4>
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

              {/* ★ 契約・給与情報 */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-indigo-800 border-b-2 border-indigo-200 pb-2"><i className="bi bi-cash-stack mr-2"></i>契約・給与情報 <span className="text-[10px] text-slate-500 font-normal ml-2">(管理者のみ閲覧・編集可)</span></h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">雇用形態</label>
                    <select name="employmentType" value={formData.employmentType} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="FULL_TIME">正社員</option>
                      <option value="PART_TIME">アルバイト・パート</option>
                      <option value="OUTSOURCE">業務委託</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">給与形態</label>
                    <select name="salaryType" value={formData.salaryType} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="MONTHLY">月給</option>
                      <option value="DAILY">日給</option>
                      <option value="HOURLY">時給</option>
                    </select>
                  </div>

                  {/* 選択した給与形態に合わせて入力枠を切り替え */}
                  {formData.salaryType === 'MONTHLY' && (
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">基本給 (月額)</label><input type="number" name="baseSalary" value={formData.baseSalary} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: 300000" /></div>
                  )}
                  {formData.salaryType === 'DAILY' && (
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">日給単価</label><input type="number" name="dailyRate" value={formData.dailyRate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: 10000" /></div>
                  )}
                  {formData.salaryType === 'HOURLY' && (
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600">時給単価</label><input type="number" name="hourlyRate" value={formData.hourlyRate} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例: 1200" /></div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">支払サイクル</label>
                    <select name="paymentCycle" value={formData.paymentCycle} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="MONTHLY">月払い</option>
                      <option value="WEEKLY">週払い</option>
                      <option value="DAILY">日払い</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">支払方法</label>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="BANK_TRANSFER">銀行振込</option>
                      <option value="CASH">現金手渡し</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* その他 */}
              {!currentId && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                  <i className="bi bi-info-circle mr-1"></i> 初期パスワードは自動的に <code>password123</code> に設定されます。
                </div>
              )}

              {currentId && (
                <div className="pt-2">
                  <button type="button" onClick={handlePasswordReset} className="w-full py-2 border-2 border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center justify-center gap-2 text-sm">
                    <i className="bi bi-key-fill"></i> パスワードをリセット（再発行）
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1 text-center">※ボタンを押すと新しいパスワードが即座に発行されます。</p>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-4">
                <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm transition-colors">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all">
                  {currentId ? '更新を保存する' : '社員を登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 削除確認モーダル --- */}
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