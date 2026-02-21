'use client';

import React, { useState, useEffect } from 'react';

// --- 型定義 ---
type Department = { id: number; code: string; name: string };
type Role = { id: number; name: string; permissionLevel: string };
type Country = { id: number; code: string; name: string; nameEn: string };
type Branch = { id: number; nameJa: string; nameEn: string };

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
  branchId?: number | null;
  branch?: Branch;
  rank?: string;
  jobTitle?: string | null;
  role?: Role;
  country?: Country;
  financial?: any; 
};

const EMP_TYPE_MAP: Record<string, string> = { FULL_TIME: '正社員', PART_TIME: 'アルバイト・パート', OUTSOURCE: '業務委託' };
const SALARY_TYPE_MAP: Record<string, string> = { MONTHLY: '月給', DAILY: '日給', HOURLY: '時給' };
const PAY_METHOD_MAP: Record<string, string> = { BANK_TRANSFER: '銀行振込', CASH: '現金手渡し' };
const PAY_CYCLE_MAP: Record<string, string> = { MONTHLY: '月払い', WEEKLY: '週払い', DAILY: '日払い' };

const RANK_MAP: Record<string, string> = {
  EXECUTIVE: '役員', DIRECTOR: '本部長・事業部長', MANAGER: 'マネージャー', LEADER: 'リーダー', ASSOCIATE: 'アソシエイト(一般)',
};

const LEAVE_TYPE_MAP: Record<string, { label: string, color: string }> = {
  GRANTED: { label: '付与', color: 'bg-emerald-100 text-emerald-700' },
  USED: { label: '消化', color: 'bg-blue-100 text-blue-700' },
  EXPIRED: { label: '消滅', color: 'bg-slate-100 text-slate-600' },
  ADJUSTED: { label: '調整', color: 'bg-amber-100 text-amber-700' },
};

const Avatar = ({ name, url, size = 'md' }: { name: string, url?: string | null, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClass = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl', xl: 'w-24 h-24 text-3xl' }[size];
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

export default function EmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]); 
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [leaveLedgers, setLeaveLedgers] = useState<any[]>([]);
  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    date: new Date().toISOString().split('T')[0], type: 'GRANTED', days: '', validUntil: '', note: ''
  });

  const initialForm = {
    employeeCode: '', lastNameJa: '', firstNameJa: '', lastNameKana: '', firstNameKana: '',
    lastNameEn: '', firstNameEn: '', email: '', password: 'password123',
    hireDate: new Date().toISOString().split('T')[0], birthday: '', gender: 'unknown' as const,
    
    branchId: '', departmentId: '', roleId: '', countryId: '', status: 'ACTIVE',
    rank: 'ASSOCIATE', jobTitle: '',
    
    employmentType: 'FULL_TIME', salaryType: 'MONTHLY',
    baseSalary: '', hourlyRate: '', dailyRate: '',
    paymentMethod: 'BANK_TRANSFER', paymentCycle: 'MONTHLY'
  };
  
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [empRes, masterRes, branchRes] = await Promise.all([ 
        fetch('/api/employees'), 
        fetch('/api/masters'),
        fetch('/api/branches') 
      ]);
      const empData = await empRes.json();
      const masterData = await masterRes.json();
      const branchData = await branchRes.json();

      if (Array.isArray(empData)) { setEmployees(empData); } else { setEmployees([]); }

      setDepartments(masterData.departments || []);
      setRoles(masterData.roles || []);
      setCountries(masterData.countries || []);
      if (Array.isArray(branchData)) { setBranches(branchData); }
    } catch (error) { setEmployees([]); } 
    finally { setIsLoading(false); }
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
        hireDate: employee.hireDate && !isNaN(new Date(employee.hireDate).getTime()) ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
        birthday: employee.birthday && !isNaN(new Date(employee.birthday).getTime()) ? new Date(employee.birthday).toISOString().split('T')[0] : '', 
        gender: employee.gender || 'unknown',
        status: employee.isActive ? 'ACTIVE' : 'INACTIVE',

        branchId: employee.branchId?.toString() || '',
        departmentId: employee.department?.id.toString() || '',
        roleId: employee.role?.id.toString() || '',
        countryId: employee.country?.id.toString() || '',
        rank: employee.rank || 'ASSOCIATE',
        jobTitle: employee.jobTitle || '',

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

  const openDetailModal = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
    setIsLeaveFormOpen(false);

    if (employee.employmentType === 'FULL_TIME') {
      try {
        const res = await fetch(`/api/employees/${employee.id}/leave`);
        if (res.ok) setLeaveLedgers(await res.json());
      } catch (e) { console.error(e); }
      
      const today = new Date();
      today.setFullYear(today.getFullYear() + 2);
      setLeaveForm(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0], type: 'GRANTED', days: '', note: '',
        validUntil: today.toISOString().split('T')[0]
      }));
    } else {
      setLeaveLedgers([]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      isActive: formData.status === 'ACTIVE',
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
    } catch (error) { alert('保存に失敗しました'); }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setIsLeaveSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}/leave`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(leaveForm)
      });
      if (res.ok) {
        const data = await res.json();
        alert('有給休暇を登録しました');
        setSelectedEmployee(prev => prev ? { ...prev, financial: { ...prev.financial, paidLeaveBalance: data.newBalance } } : prev);
        const ledgersRes = await fetch(`/api/employees/${selectedEmployee.id}/leave`);
        if (ledgersRes.ok) setLeaveLedgers(await ledgersRes.json());
        setIsLeaveFormOpen(false);
      } else {
        const data = await res.json();
        alert(`登録エラー: ${data.error}`);
      }
    } catch (error) { alert('通信エラーが発生しました'); }
    setIsLeaveSubmitting(false);
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

  const confirmDelete = (e: React.MouseEvent, id: number) => { e.stopPropagation(); setCurrentId(id); setIsDeleteModalOpen(true); };
  const executeDelete = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/employees/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (error) { alert('削除に失敗しました'); }
  };

  // --- モーダル用共通スタイル ---
  const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4";
  const sectionHeaderClass = "text-sm font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all";


  return (
    <div className="space-y-6">
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
                    <div className="text-xs text-slate-500 font-bold">{emp.jobTitle || '役職未設定'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-slate-800 font-medium">
                      {emp.branch?.nameJa ? `${emp.branch.nameJa}支店` : ''} 
                      {emp.department?.name ? ` ${emp.department.name}` : ''}
                      {!emp.branch && !emp.department && '未所属'}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{emp.country ? `${emp.country.name} (${emp.country.code})` : '-'}</div>
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
            
            <div className="w-full md:w-1/3 bg-gradient-to-b from-blue-600 to-indigo-800 p-8 text-white flex flex-col items-center text-center relative overflow-y-auto custom-scrollbar">
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
                  <i className="bi bi-shop text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.branch?.nameJa ? `${selectedEmployee.branch.nameJa}支店` : '支店未設定'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-building text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.department?.name || '部署未設定'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-briefcase text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.jobTitle || '職種未設定'}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-star text-blue-200"></i>
                  <span className="font-semibold">{RANK_MAP[selectedEmployee.rank || 'ASSOCIATE']}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-envelope text-blue-200"></i>
                  <span className="font-semibold truncate">{selectedEmployee.email}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 p-8 overflow-y-auto custom-scrollbar relative">
              <div className="flex justify-between items-center mb-6 hidden md:flex">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-6 bg-blue-600 rounded-full"></span>詳細・契約ステータス
                </h3>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors"><i className="bi bi-x-lg text-xl"></i></button>
              </div>

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
                  <div className="text-sm font-bold text-slate-700 mt-1">{PAY_METHOD_MAP[selectedEmployee.financial?.paymentMethod] || '-'} / {PAY_CYCLE_MAP[selectedEmployee.financial?.paymentCycle] || '-'}</div>
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3"><i className="bi bi-person-lines-fill mr-1 text-blue-500"></i> 個人情報</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HIRE DATE</div><div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-700"><i className="bi bi-calendar-event text-blue-500"></i>{selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toLocaleDateString('ja-JP') : '-'}</div></div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BIRTHDAY</div><div className="text-sm font-bold text-slate-700">{selectedEmployee.birthday ? new Date(selectedEmployee.birthday).toLocaleDateString('ja-JP') : '-'}</div></div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GENDER</div><div className="text-sm font-bold text-slate-700 capitalize">{selectedEmployee.gender === 'male' ? 'Male (男性)' : selectedEmployee.gender === 'female' ? 'Female (女性)' : 'Other / Unknown'}</div></div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COUNTRY / LOCATION</div><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><i className="bi bi-globe-asia-australia text-indigo-500"></i>{selectedEmployee.country ? `${selectedEmployee.country.name} (${selectedEmployee.country.code})` : '未設定'}</div></div>
              </div>

              {selectedEmployee.employmentType === 'FULL_TIME' && (
                <div className="mt-10 border-t border-slate-200 pt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                      有給休暇の管理
                    </h3>
                    <div className="text-sm font-bold text-slate-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2">
                      現在の残日数: <span className="text-2xl text-emerald-600 font-black">{selectedEmployee.financial?.paidLeaveBalance || 0}</span> 日
                    </div>
                  </div>

                  {isLeaveFormOpen ? (
                    <form onSubmit={handleLeaveSubmit} className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 mb-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <h4 className="font-bold text-emerald-800 text-sm border-b border-emerald-200 pb-2 flex items-center gap-2"><i className="bi bi-plus-circle-fill"></i> 有給日数の付与・手動調整</h4>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-700 mb-1">発生日</label>
                          <input type="date" required value={leaveForm.date} onChange={e => setLeaveForm({...leaveForm, date: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-700 mb-1">処理種別</label>
                          <select required value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                            <option value="GRANTED">付与する (+)</option>
                            <option value="ADJUSTED">手動で調整する (+/-)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-700 mb-1">日数 (半休は0.5) <span className="text-rose-500">*</span></label>
                          <input type="number" step="0.5" required value={leaveForm.days} onChange={e => setLeaveForm({...leaveForm, days: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder="例: 10" />
                        </div>
                        {leaveForm.type === 'GRANTED' && (
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-700 mb-1">有効期限 (原則2年後)</label>
                            <input type="date" required value={leaveForm.validUntil} onChange={e => setLeaveForm({...leaveForm, validUntil: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 mb-1">備考</label>
                        <input type="text" value={leaveForm.note} onChange={e => setLeaveForm({...leaveForm, note: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="例: 入社半年経過による法定付与" />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setIsLeaveFormOpen(false)} className="px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors">キャンセル</button>
                        <button type="submit" disabled={isLeaveSubmitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors disabled:opacity-50">
                          {isLeaveSubmitting ? '登録中...' : '登録を確定する'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mb-4">
                      <button onClick={() => setIsLeaveFormOpen(true)} className="px-4 py-2.5 bg-white border border-emerald-200 text-emerald-600 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-colors shadow-sm flex items-center gap-1.5">
                        <i className="bi bi-plus-lg"></i> 新しく有給を付与・調整する
                      </button>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">発生日</th>
                          <th className="px-4 py-3 font-semibold text-center">処理内容</th>
                          <th className="px-4 py-3 font-semibold text-right">増減日数</th>
                          <th className="px-4 py-3 font-semibold">備考 / 有効期限</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leaveLedgers.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">有給休暇の履歴がありません</td></tr>
                        ) : (
                          leaveLedgers.map((l: any) => (
                            <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-mono font-bold text-slate-600">{new Date(l.date).toLocaleDateString('ja-JP')}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${LEAVE_TYPE_MAP[l.type]?.color || 'bg-slate-100 border-slate-200'}`}>
                                  {LEAVE_TYPE_MAP[l.type]?.label || l.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-black text-base ${l.days > 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                  {l.days > 0 ? `+${l.days}` : l.days}
                                </span> 
                                <span className="text-[10px] text-slate-400 ml-1">日</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                <div className="truncate max-w-[250px] font-medium text-slate-700" title={l.note}>{l.note || '-'}</div>
                                {l.type === 'GRANTED' && l.validUntil && (
                                  <div className="text-[10px] text-emerald-600 font-mono mt-1 font-bold">
                                    <i className="bi bi-clock-history"></i> 有効期限: {new Date(l.validUntil).toLocaleDateString('ja-JP')}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

      {/* --- ★ 登録・編集モーダル (デザイン改善版) --- */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh] overflow-hidden">
            
            {/* モーダルヘッダー */}
            <div className="px-6 py-5 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 z-10 shadow-sm">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <i className="bi bi-person-vcard text-blue-600"></i>
                {currentId ? '社員情報の編集' : '新規社員登録'}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            {/* スクロールするフォームエリア */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* --- 1. アカウント情報 --- */}
              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-shield-lock text-blue-600"></i> アカウント＆ステータス</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>社員コード</label>
                    <input name="employeeCode" value={formData.employeeCode} onChange={handleInputChange} className={`${inputClass} font-mono`} placeholder="EMP-001" />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={labelClass}>ログイン用メールアドレス <span className="text-rose-500">*</span></label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className={inputClass} placeholder="mail@example.com" />
                  </div>
                  <div>
                    <label className={labelClass}>ステータス</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className={`${inputClass} font-bold ${formData.status === 'ACTIVE' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500'}`}>
                      <option value="ACTIVE">在職中 (Active)</option>
                      <option value="INACTIVE">退職済 (Inactive)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* --- 2. プロフィール情報 --- */}
              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-person text-blue-600"></i> プロフィール情報</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>姓 (漢字) <span className="text-rose-500">*</span></label><input required name="lastNameJa" value={formData.lastNameJa} onChange={handleInputChange} className={inputClass} placeholder="山田" /></div>
                    <div><label className={labelClass}>名 (漢字) <span className="text-rose-500">*</span></label><input required name="firstNameJa" value={formData.firstNameJa} onChange={handleInputChange} className={inputClass} placeholder="太郎" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>セイ (カナ)</label><input name="lastNameKana" value={formData.lastNameKana} onChange={handleInputChange} className={inputClass} placeholder="ヤマダ" /></div>
                    <div><label className={labelClass}>メイ (カナ)</label><input name="firstNameKana" value={formData.firstNameKana} onChange={handleInputChange} className={inputClass} placeholder="タロウ" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>Last Name (En)</label><input name="lastNameEn" value={formData.lastNameEn} onChange={handleInputChange} className={inputClass} placeholder="Yamada" /></div>
                    <div><label className={labelClass}>First Name (En)</label><input name="firstNameEn" value={formData.firstNameEn} onChange={handleInputChange} className={inputClass} placeholder="Taro" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>誕生日</label><input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange} className={inputClass} /></div>
                    <div>
                      <label className={labelClass}>性別</label>
                      <select name="gender" value={formData.gender} onChange={handleInputChange} className={inputClass}>
                        <option value="unknown">未設定</option><option value="male">男性</option><option value="female">女性</option><option value="other">その他</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- 3. 組織・権限情報 --- */}
              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-diagram-3 text-blue-600"></i> 組織・権限情報</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className={labelClass}>入社日 <span className="text-rose-500">*</span></label><input type="date" required name="hireDate" value={formData.hireDate} onChange={handleInputChange} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>所属支店</label>
                    <select name="branchId" value={formData.branchId} onChange={handleInputChange} className={inputClass}>
                      <option value="">未設定</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>所属部署</label>
                    <select name="departmentId" value={formData.departmentId} onChange={handleInputChange} className={inputClass}>
                      <option value="">未設定</option>
                      {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                    </select>
                  </div>
                  <div><label className={labelClass}>職種</label><input name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} className={inputClass} placeholder="例: セールス" /></div>
                  <div>
                    <label className={labelClass}>階級 (等級)</label>
                    <select name="rank" value={formData.rank} onChange={handleInputChange} className={inputClass}>
                      {Object.entries(RANK_MAP).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>国籍</label>
                    <select name="countryId" value={formData.countryId} onChange={handleInputChange} className={inputClass}>
                      <option value="">未設定</option>
                      {countries.map(country => <option key={country.id} value={country.id}>{country.name} ({country.code})</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3 pt-4 border-t border-slate-100">
                    <label className={labelClass}>システム権限</label>
                    <select name="roleId" value={formData.roleId} onChange={handleInputChange} className={`${inputClass} max-w-xs font-bold text-slate-700`}>
                      <option value="">一般ユーザー</option>
                      {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1.5">※システムでアクセスできるメニューや操作権限を制御します。</p>
                  </div>
                </div>
              </div>

              {/* --- 4. 契約・給与情報 --- */}
              <div className="bg-indigo-50/40 p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
                <h4 className="text-sm font-black text-indigo-900 border-b border-indigo-100 pb-3 mb-4 flex items-center gap-2">
                  <i className="bi bi-cash-stack text-indigo-600"></i> 契約・給与情報 <span className="text-[10px] text-indigo-500/70 font-medium ml-2">(管理者のみ閲覧・編集可)</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>雇用形態</label>
                    <select name="employmentType" value={formData.employmentType} onChange={handleInputChange} className={inputClass}>
                      <option value="FULL_TIME">正社員</option>
                      <option value="PART_TIME">アルバイト・パート</option>
                      <option value="OUTSOURCE">業務委託</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>給与形態</label>
                    <select name="salaryType" value={formData.salaryType} onChange={handleInputChange} className={inputClass}>
                      <option value="MONTHLY">月給</option>
                      <option value="DAILY">日給</option>
                      <option value="HOURLY">時給</option>
                    </select>
                  </div>

                  {formData.salaryType === 'MONTHLY' && (
                    <div><label className={labelClass}>基本給 (月額)</label><input type="number" name="baseSalary" value={formData.baseSalary} onChange={handleInputChange} className={`${inputClass} font-mono font-bold text-indigo-700`} placeholder="例: 300000" /></div>
                  )}
                  {formData.salaryType === 'DAILY' && (
                    <div><label className={labelClass}>日給単価</label><input type="number" name="dailyRate" value={formData.dailyRate} onChange={handleInputChange} className={`${inputClass} font-mono font-bold text-indigo-700`} placeholder="例: 10000" /></div>
                  )}
                  {formData.salaryType === 'HOURLY' && (
                    <div><label className={labelClass}>時給単価</label><input type="number" name="hourlyRate" value={formData.hourlyRate} onChange={handleInputChange} className={`${inputClass} font-mono font-bold text-indigo-700`} placeholder="例: 1200" /></div>
                  )}

                  <div>
                    <label className={labelClass}>支払サイクル</label>
                    <select name="paymentCycle" value={formData.paymentCycle} onChange={handleInputChange} className={inputClass}>
                      <option value="MONTHLY">月払い</option><option value="WEEKLY">週払い</option><option value="DAILY">日払い</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>支払方法</label>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className={inputClass}>
                      <option value="BANK_TRANSFER">銀行振込</option><option value="CASH">現金手渡し</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* --- パスワードリセット領域 --- */}
              {currentId ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-sm">
                  <button type="button" onClick={handlePasswordReset} className="text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto">
                    <i className="bi bi-key-fill"></i> パスワードをリセット（再発行）する
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2">※クリックすると新しいパスワードが即座に発行され、画面に表示されます。</p>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-2 text-xs text-blue-800">
                  <i className="bi bi-info-circle-fill mt-0.5"></i>
                  <p>初期パスワードは自動的に <code>password123</code> に設定されます。ログイン後に変更するよう伝えてください。</p>
                </div>
              )}

            </form>

            {/* モーダルフッター (固定) */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors">キャンセル</button>
              <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                <i className="bi bi-cloud-arrow-up-fill"></i>
                {currentId ? '更新を保存する' : '社員を登録する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 削除確認モーダル --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="font-black text-slate-800 text-lg mb-2">本当に削除しますか？</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">この操作は取り消せません。<br/>（論理削除としてステータスが更新されます）</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors">キャンセル</button>
              <button onClick={executeDelete} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors">削除実行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}