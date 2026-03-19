'use client';

import React, { useState, useEffect, useRef } from 'react';
import { handlePhoneChange } from '@/lib/formatters';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';
import SkeletonRow from '@/components/ui/SkeletonRow';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';

// --- 型定義 ---
type Department = { id: number; code: string; name: string };
type Role = { id: number; code: string; name: string; permissionLevel: string };
type Country = { id: number; code: string; name: string; nameEn: string };
type Branch = { id: number; nameJa: string; nameEn: string };

type VisaType = { id: number; name: string; nameEn: string };

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
  personalEmail: string | null;
  workspaceNotifiedAt: string | null;
  phone: string | null;
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
  roles?: any[];
  managerId?: number | null;
  manager?: { id: number; lastNameJa: string; firstNameJa: string };
  country?: Country;
  financial?: any;
  visaTypeId?: number | null;
  visaType?: VisaType | null;
  visaExpiryDate?: string | null;
  hasResidenceCard?: boolean;
  residenceCardFrontUrl?: string | null;
  residenceCardBackUrl?: string | null;
  residenceCardVerificationStatus?: string | null;
  residenceCardVerificationResult?: any;
  bankCardImageUrl?: string | null;
  postalCode?: string | null;
  address?: string | null;
  buildingName?: string | null;
  language?: string | null;
};

const EMP_TYPE_LABEL_KEYS: Record<string, string> = { FULL_TIME: 'emp_type_full_time', PART_TIME: 'emp_type_part_time', OUTSOURCE: 'emp_type_outsource' };
const SALARY_TYPE_LABEL_KEYS: Record<string, string> = { MONTHLY: 'salary_type_monthly', DAILY: 'salary_type_daily', HOURLY: 'salary_type_hourly' };
const PAY_METHOD_LABEL_KEYS: Record<string, string> = { BANK_TRANSFER: 'payment_bank', CASH: 'payment_cash' };
const PAY_CYCLE_LABEL_KEYS: Record<string, string> = { MONTHLY: 'payment_monthly', WEEKLY: 'payment_weekly', DAILY: 'payment_daily' };

const RANK_LABEL_KEYS: Record<string, string> = {
  EXECUTIVE: 'rank_executive', DIRECTOR: 'rank_director', MANAGER: 'rank_manager', LEADER: 'rank_leader', ASSOCIATE: 'rank_associate',
};

const LEAVE_TYPE_STYLE: Record<string, string> = {
  GRANTED: 'bg-emerald-100 text-emerald-700',
  USED: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
  ADJUSTED: 'bg-amber-100 text-amber-700',
};
const LEAVE_TYPE_LABEL_KEYS: Record<string, string> = {
  GRANTED: 'leave_type_granted',
  USED: 'leave_type_used',
  EXPIRED: 'leave_type_expired',
  ADJUSTED: 'leave_type_adjusted',
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
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);

  const [currentUser, setCurrentUser] = useState<any>(null);

  // 在留カード・銀行カードアップロード
  const [isUploadingCard, setIsUploadingCard] = useState<string | null>(null); // 'front' | 'back' | 'bank' | null
  const [bankCardAnalyzing, setBankCardAnalyzing] = useState(false);
  const residenceCardInputRef = useRef<HTMLInputElement>(null);
  const bankCardInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sortKey, setSortKey] = useState<'name' | 'hireDate' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [leaveLedgers, setLeaveLedgers] = useState<any[]>([]);
  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);

  const [sendingWelcomeId, setSendingWelcomeId] = useState<number | null>(null);
  const [welcomeToast, setWelcomeToast] = useState<{ id: number; name: string } | null>(null);
  const [isToastExiting, setIsToastExiting] = useState(false);
  const [pendingWelcomeEmp, setPendingWelcomeEmp] = useState<Employee | null>(null);
  const [sendingWorkspaceNotify, setSendingWorkspaceNotify] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    date: new Date().toISOString().split('T')[0], type: 'GRANTED', days: '', validUntil: '', note: ''
  });

  const initialForm = {
    employeeCode: '', lastNameJa: '', firstNameJa: '', lastNameKana: '', firstNameKana: '',
    lastNameEn: '', firstNameEn: '', email: '', personalEmail: '', phone: '',
    postalCode: '', address: '', buildingName: '',
    createWorkspaceAccount: false,
    hireDate: new Date().toISOString().split('T')[0], birthday: '', gender: 'unknown' as 'male' | 'female' | 'other' | 'unknown',
    branchId: '', departmentId: '', countryId: '', status: 'ACTIVE',
    visaTypeId: '', visaExpiryDate: '',
    rank: 'ASSOCIATE', jobTitle: '', managerId: '',
    language: 'ja',
    roleIds: [] as string[],
    employmentType: 'FULL_TIME', salaryType: 'MONTHLY',
    baseSalary: '', hourlyRate: '', dailyRate: '',
    paymentMethod: 'BANK_TRANSFER', paymentCycle: 'MONTHLY',
    workingWeekdays: '1,2,3,4,5'
  };
  
  const [formData, setFormData] = useState(initialForm);

  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('employees');

  const buildEmpQuery = (overrides: Record<string, unknown> = {}) => {
    const params = new URLSearchParams();
    const st = (overrides.filterStatus ?? filterStatus) as string;
    const bid = (overrides.filterBranchId ?? filterBranchId) as string;
    const did = (overrides.filterDepartmentId ?? filterDepartmentId) as string;
    const q = (overrides.searchTerm ?? searchTerm) as string;
    const p = (overrides.page ?? page) as number;
    params.set('page', String(p));
    params.set('limit', String(LIMIT));
    params.set('status', st);
    if (bid) params.set('branchId', bid);
    if (did) params.set('departmentId', did);
    if (q) params.set('search', q);
    return params.toString();
  };

  const fetchEmployees = async (query: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/employees?${query}`);
      const data = await res.json();
      if (data.data) {
        setEmployees(data.data);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const fetchData = async () => {
    try {
      const [masterRes, branchRes, profileRes, visaTypeRes] = await Promise.all([
        fetch('/api/masters'),
        fetch('/api/branches'),
        fetch('/api/profile'),
        fetch('/api/visa-types/public'),
      ]);
      const masterData = await masterRes.json();
      const branchData = await branchRes.json();
      const profileData = await profileRes.json();

      setDepartments(masterData.departments || []);
      setRoles(masterData.roles || []);
      setCountries(masterData.countries || []);
      if (Array.isArray(branchData)) setBranches(branchData);
      if (profileData && profileData.id) setCurrentUser(profileData);
      if (visaTypeRes.ok) {
        const vtData = await visaTypeRes.json();
        setVisaTypes(Array.isArray(vtData) ? vtData : []);
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    fetchData();
    fetchEmployees(buildEmpQuery({ page: 1 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmpFilterChange = (overrides: Record<string, unknown>) => {
    const newPage = 1;
    const merged = { page: newPage, ...overrides };
    setPage(newPage);
    if ('filterStatus' in overrides) setFilterStatus(overrides.filterStatus as 'ACTIVE' | 'INACTIVE' | 'ALL');
    if ('filterBranchId' in overrides) setFilterBranchId(overrides.filterBranchId as string);
    if ('filterDepartmentId' in overrides) setFilterDepartmentId(overrides.filterDepartmentId as string);
    fetchEmployees(buildEmpQuery(merged));
  };

  const handleEmpSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchEmployees(buildEmpQuery({ searchTerm: value, page: 1 }));
    }, 400);
  };

  const handleEmpPageChange = (newPage: number) => {
    setPage(newPage);
    fetchEmployees(buildEmpQuery({ page: newPage }));
  };

  const handleEmpSort = (key: 'name' | 'hireDate') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedEmployees = sortKey ? [...employees].sort((a, b) => {
    if (sortKey === 'name') {
      const aName = `${a.lastNameJa}${a.firstNameJa}`;
      const bName = `${b.lastNameJa}${b.firstNameJa}`;
      return sortDir === 'asc' ? aName.localeCompare(bName, 'ja') : bName.localeCompare(aName, 'ja');
    }
    const aDate = a.hireDate ? new Date(a.hireDate).getTime() : 0;
    const bDate = b.hireDate ? new Date(b.hireDate).getTime() : 0;
    return sortDir === 'asc' ? aDate - bDate : bDate - aDate;
  }) : employees;

  const EmpSortIcon = ({ col }: { col: 'name' | 'hireDate' }) => (
    <i className={`bi ml-1 ${sortKey === col ? (sortDir === 'asc' ? 'bi-arrow-up text-blue-500' : 'bi-arrow-down text-blue-500') : 'bi-arrow-down-up text-slate-300'}`} />
  );

  const currentUserRoles = currentUser?.roles?.map((r: any) => r.role?.code) || [];
  const isSuperAdmin = currentUserRoles.includes('SUPER_ADMIN');
  const isHrAdmin = isSuperAdmin || currentUserRoles.includes('HR_ADMIN');
  const isHrViewer = isHrAdmin || currentUserRoles.includes('HR_VIEWER');
  const canEdit = isHrAdmin; 
  const canViewSensitiveInfo = isHrViewer; 

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (roleIdStr: string, checked: boolean) => {
    setFormData(prev => {
      const newRoleIds = new Set(prev.roleIds);
      if (checked) newRoleIds.add(roleIdStr);
      else newRoleIds.delete(roleIdStr);
      return { ...prev, roleIds: Array.from(newRoleIds) };
    });
  };

  const openFormModal = (employee?: Employee) => {
    if (employee) {
      setCurrentId(employee.id);
      setFormData({
        employeeCode: employee.employeeCode || '',
        lastNameJa: employee.lastNameJa, firstNameJa: employee.firstNameJa,
        lastNameKana: employee.lastNameKana || '', firstNameKana: employee.firstNameKana || '',
        lastNameEn: employee.lastNameEn || '', firstNameEn: employee.firstNameEn || '',
        email: employee.email, personalEmail: employee.personalEmail || '', phone: employee.phone || '',
        postalCode: employee.postalCode || '', address: employee.address || '', buildingName: employee.buildingName || '',
        createWorkspaceAccount: false,
        hireDate: employee.hireDate && !isNaN(new Date(employee.hireDate).getTime()) ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
        birthday: employee.birthday && !isNaN(new Date(employee.birthday).getTime()) ? new Date(employee.birthday).toISOString().split('T')[0] : '', 
        gender: employee.gender || 'unknown',
        status: employee.isActive ? 'ACTIVE' : 'INACTIVE',

        branchId: employee.branchId?.toString() || '',
        departmentId: employee.department?.id.toString() || '',
        countryId: employee.country?.id.toString() || '',
        visaTypeId: employee.visaTypeId?.toString() || employee.visaType?.id.toString() || '',
        visaExpiryDate: employee.visaExpiryDate && !isNaN(new Date(employee.visaExpiryDate).getTime()) ? new Date(employee.visaExpiryDate).toISOString().split('T')[0] : '',
        rank: employee.rank || 'ASSOCIATE',
        jobTitle: employee.jobTitle || '',
        managerId: employee.managerId?.toString() || '', // ★ 上司情報を復元
        language: employee.language || 'ja',
        
        roleIds: employee.roles?.map(r => r.roleId.toString()) || [],

        employmentType: employee.employmentType || 'FULL_TIME',
        salaryType: employee.financial?.salaryType || 'MONTHLY',
        baseSalary: employee.financial?.baseSalary?.toString() || '',
        hourlyRate: employee.financial?.hourlyRate?.toString() || '',
        dailyRate: employee.financial?.dailyRate?.toString() || '',
        paymentMethod: employee.financial?.paymentMethod || 'BANK_TRANSFER',
        paymentCycle: employee.financial?.paymentCycle || 'MONTHLY',
        workingWeekdays: employee.financial?.workingWeekdays || '1,2,3,4,5',
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

    if (canViewSensitiveInfo && employee.employmentType === 'FULL_TIME') {
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

    // Workspace アカウント作成時のバリデーション
    if (formData.createWorkspaceAccount && !currentId) {
      if (!formData.firstNameEn || !formData.lastNameEn) {
        showToast(t('form_workspace_en_required'), 'error');
        return;
      }
    }

    const submitData = {
      ...formData,
      isActive: formData.status === 'ACTIVE',
      hireDate: formData.hireDate || null,
      birthday: formData.birthday || null,
      lastNameEn: formData.lastNameEn || null,
      firstNameEn: formData.firstNameEn || null,
      phone: formData.phone || null,
      personalEmail: formData.personalEmail || null,
      employeeCode: formData.employeeCode || null,
      managerId: formData.managerId || null,
      visaTypeId: formData.visaTypeId || null,
      visaExpiryDate: formData.visaExpiryDate || null,
      // 新規作成時のみ Workspace フラグを送信
      createWorkspaceAccount: !currentId ? formData.createWorkspaceAccount : undefined,
      // Workspace 作成時は email を空にする（API側で自動生成）
      email: (formData.createWorkspaceAccount && !currentId) ? '' : formData.email,
    };

    try {
      const url = currentId ? `/api/employees/${currentId}` : '/api/employees';
      const method = currentId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitData) });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || t('save_error'), 'error');
        return;
      }

      setIsFormModalOpen(false);
      fetchEmployees(buildEmpQuery());
    } catch (error) { showToast(t('save_error'), 'error'); }
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
        showToast(t('leave_registered'), 'success');
        setSelectedEmployee(prev => prev ? { ...prev, financial: { ...prev.financial, paidLeaveBalance: data.newBalance } } : prev);
        const ledgersRes = await fetch(`/api/employees/${selectedEmployee.id}/leave`);
        if (ledgersRes.ok) setLeaveLedgers(await ledgersRes.json());
        setIsLeaveFormOpen(false);
      } else {
        const data = await res.json();
        showToast(t('leave_register_error', { error: data.error }), 'error');
      }
    } catch (error) { showToast(t('comm_error'), 'error'); }
    setIsLeaveSubmitting(false);
  };

  const handlePasswordReset = async () => {
    if (!currentId) return;
    if (!await showConfirm(t('password_reset_confirm'), { variant: 'warning', confirmLabel: t('password_reset_btn') })) return;
    try {
      const res = await fetch(`/api/employees/${currentId}/reset`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || t('password_reset_error'), 'error');
        return;
      }
      showToast(t('password_reset_success'), 'success');
    } catch (error) { showToast(t('password_reset_error'), 'error'); }
  };

  const confirmDelete = (e: React.MouseEvent, id: number) => { e.stopPropagation(); setCurrentId(id); setIsDeleteModalOpen(true); };

  const handleSendWelcome = (e: React.MouseEvent, emp: Employee) => {
    e.stopPropagation();
    setPendingWelcomeEmp(emp);
  };

  const dismissWelcomeToast = () => {
    setIsToastExiting(true);
    setTimeout(() => {
      setWelcomeToast(null);
      setIsToastExiting(false);
    }, 350);
  };

  const executeSendWelcome = async () => {
    if (!pendingWelcomeEmp) return;
    const emp = pendingWelcomeEmp;
    setPendingWelcomeEmp(null);
    setSendingWelcomeId(emp.id);
    try {
      const res = await fetch(`/api/employees/${emp.id}/send-welcome`, { method: 'POST' });
      if (res.ok) {
        setIsToastExiting(false);
        setWelcomeToast({ id: emp.id, name: `${emp.lastNameJa} ${emp.firstNameJa}` });
        setTimeout(() => dismissWelcomeToast(), 4000);
      } else {
        const data = await res.json();
        showToast(data.error || t('mail_send_error'), 'error');
      }
    } catch {
      showToast(t('comm_error'), 'error');
    }
    setSendingWelcomeId(null);
  };

  const handleCreateWorkspace = async () => {
    if (!selectedEmployee) return;
    if (!selectedEmployee.lastNameEn || !selectedEmployee.firstNameEn) {
      showToast(t('workspace_en_required'), 'error');
      return;
    }
    const preview = `${selectedEmployee.firstNameEn.toLowerCase()}.${selectedEmployee.lastNameEn.toLowerCase()}@tiramis.co.jp`;
    const confirmed = await showConfirm(
      t('workspace_create_confirm', { name: `${selectedEmployee.lastNameJa} ${selectedEmployee.firstNameJa}`, email: preview, currentEmail: selectedEmployee.email }),
      { variant: 'primary', confirmLabel: t('workspace_create_btn') },
    );
    if (!confirmed) return;
    setCreatingWorkspace(true);
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}/create-workspace`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(t('workspace_created', { email: data.email }), 'success');
        setSelectedEmployee(prev => prev ? { ...prev, email: data.email, personalEmail: data.personalEmail } : prev);
        fetchEmployees(buildEmpQuery());
      } else {
        showToast(data.error || t('workspace_create_error'), 'error');
      }
    } catch {
      showToast(t('comm_error'), 'error');
    }
    setCreatingWorkspace(false);
  };

  const handleWorkspaceNotify = async () => {
    if (!selectedEmployee) return;
    const isAlreadyNotified = !!selectedEmployee.workspaceNotifiedAt;
    if (isAlreadyNotified) {
      const confirmed = await showConfirm(t('workspace_notify_resend_confirm'), { variant: 'warning', confirmLabel: t('workspace_notify_resend_btn') });
      if (!confirmed) return;
    }
    setSendingWorkspaceNotify(true);
    try {
      const res = await fetch(`/api/employees/${selectedEmployee.id}/notify-workspace`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(t('workspace_notify_success'), 'success');
        setSelectedEmployee(prev => prev ? { ...prev, workspaceNotifiedAt: data.notifiedAt } : prev);
      } else {
        showToast(data.error || t('workspace_notify_error'), 'error');
      }
    } catch {
      showToast(t('comm_error'), 'error');
    }
    setSendingWorkspaceNotify(false);
  };

  const executeDelete = async () => {
    if (!currentId) return;
    try {
      const res = await fetch(`/api/employees/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setIsDeleteModalOpen(false);
      fetchEmployees(buildEmpQuery());
    } catch (error) { showToast(t('delete_error'), 'error'); }
  };


  // --- 在留カードアップロード ---
  const handleResidenceCardUpload = async (side: 'front' | 'back') => {
    if (!currentId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsUploadingCard(side);
      try {
        const presignRes = await fetch(`/api/employees/${currentId}/residence-card?side=${side}`);
        if (!presignRes.ok) throw new Error('Failed to get presigned URL');
        const { uploadUrl, s3Key } = await presignRes.json();
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'image/jpeg' } });
        const saveRes = await fetch(`/api/employees/${currentId}/residence-card`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ s3Key, side }),
        });
        if (!saveRes.ok) throw new Error('Failed to save');
        const data = await saveRes.json();
        // Update the employee in the list
        setEmployees(prev => prev.map(emp => emp.id === currentId ? {
          ...emp,
          ...(side === 'front' ? { residenceCardFrontUrl: data.url } : { residenceCardBackUrl: data.url }),
          hasResidenceCard: true,
          ...(side === 'front' ? { residenceCardVerificationStatus: 'PENDING' } : {}),
        } : emp));
        showToast(t('form_residence_card_upload') + ' OK', 'success');
      } catch (err) {
        showToast(t('comm_error'), 'error');
      }
      setIsUploadingCard(null);
    };
    input.click();
  };

  // --- 銀行カードアップロード ---
  const handleBankCardUpload = async () => {
    if (!currentId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setBankCardAnalyzing(true);
      try {
        const presignRes = await fetch(`/api/employees/${currentId}/bank-card`);
        if (!presignRes.ok) throw new Error('Failed to get presigned URL');
        const { uploadUrl, s3Key } = await presignRes.json();
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'image/jpeg' } });
        const analyzeRes = await fetch(`/api/employees/${currentId}/bank-card`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ s3Key }),
        });
        const result = await analyzeRes.json();
        if (result.success && result.data) {
          // Auto-save to EmployeeFinancial via PUT
          const matchedBank = banks.find((b: any) =>
            b.name === result.data.bankName || b.nameEn === result.data.bankName
          );
          await fetch(`/api/employees/${currentId}/bank-card`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bankId: matchedBank?.id || null,
              branchName: result.data.branchName || null,
              branchCode: result.data.branchCode || null,
              accountType: result.data.accountType === '当座' ? 'CURRENT' : result.data.accountType === '貯蓄' ? 'SAVINGS' : 'ORDINARY',
              accountNumber: result.data.accountNumber || null,
              accountName: result.data.accountHolder || null,
              accountNameKana: result.data.accountHolderKana || null,
            }),
          });
          showToast(t('form_bank_card_scan_success'), 'success');
        } else {
          showToast(result.error || t('form_bank_card_scan_error'), 'error');
        }
      } catch (err) {
        showToast(t('comm_error'), 'error');
      }
      setBankCardAnalyzing(false);
    };
    input.click();
  };

  // banks state for bank card auto-fill
  const [banks, setBanks] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/banks').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? setBanks(d) : null).catch(() => {});
  }, []);

  const getVerificationBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'VERIFIED': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><i className="bi bi-check-circle-fill"></i> {t('form_verification_verified')}</span>;
      case 'MISMATCH': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700"><i className="bi bi-x-circle-fill"></i> {t('form_verification_mismatch')}</span>;
      case 'PENDING': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"><i className="bi bi-hourglass-split"></i> {t('form_verification_pending')}</span>;
      case 'ERROR': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600"><i className="bi bi-exclamation-triangle-fill"></i> {t('form_verification_error')}</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">{t('form_verification_not_verified')}</span>;
    }
  };

  const sectionClass = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4";
  const sectionHeaderClass = "text-sm font-black text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
  const inputClass = "w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all";


  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={() => openFormModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2">
            <i className="bi bi-plus-lg"></i> {t('btn_new_employee')}
          </button>
        </div>
      )}

      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
        <div className="w-full md:flex-1 md:min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_keyword')}</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              placeholder={t('filter_keyword_placeholder')}
              value={searchTerm}
              onChange={(e) => handleEmpSearchChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap md:flex-nowrap md:gap-4">
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
            <select
              value={filterStatus}
              onChange={(e) => handleEmpFilterChange({ filterStatus: e.target.value })}
              className="w-full md:w-auto border border-slate-300 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-0 md:min-w-[120px] bg-white cursor-pointer"
            >
              <option value="ACTIVE">{t('filter_status_active')}</option>
              <option value="INACTIVE">{t('filter_status_inactive')}</option>
              <option value="ALL">{t('filter_all')}</option>
            </select>
          </div>
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_branch')}</label>
            <select
              value={filterBranchId}
              onChange={(e) => handleEmpFilterChange({ filterBranchId: e.target.value })}
              className="w-full md:w-auto border border-slate-300 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-0 md:min-w-[120px] bg-white cursor-pointer"
            >
              <option value="">{t('filter_all')}</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.nameJa}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_department')}</label>
            <select
              value={filterDepartmentId}
              onChange={(e) => handleEmpFilterChange({ filterDepartmentId: e.target.value })}
              className="w-full md:w-auto border border-slate-300 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-0 md:min-w-[120px] bg-white cursor-pointer"
            >
              <option value="">{t('filter_all')}</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Desktop テーブル */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold cursor-pointer select-none hover:bg-slate-100" onClick={() => handleEmpSort('name')}>
                {t('table_id_name')} <EmpSortIcon col="name" />
              </th>
              <th className="px-6 py-4 font-semibold">{t('table_emp_type_role')}</th>
              <th className="px-6 py-4 font-semibold">{t('table_affiliation')}</th>
              <th className="px-6 py-4 font-semibold">{t('filter_status')}</th>
              <th className="px-6 py-4 font-semibold text-right">{t('table_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <SkeletonRow rows={8} cols={5} />
            ) : employees.length === 0 ? (
              <EmptyState icon="bi-person-x" title={t('no_match_title')} description={t('no_match_description')} />
            ) : (
              sortedEmployees.map((emp) => (
                <tr key={emp.id} onClick={() => openDetailModal(emp)} className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.firstNameJa} url={emp.avatarUrl} />
                      <div>
                        <div className="text-xs font-mono text-slate-400 mb-0.5">{emp.employeeCode || '-'}</div>
                        <div className="font-bold text-slate-800">{emp.lastNameJa} {emp.firstNameJa}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                          {emp.lastNameEn || emp.firstNameEn 
                            ? [emp.firstNameEn, emp.lastNameEn].filter(Boolean).join(' ') 
                            : [emp.lastNameKana, emp.firstNameKana].filter(Boolean).join(' ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-blue-700 font-bold text-xs bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block mb-1">
                      {t(EMP_TYPE_LABEL_KEYS[emp.employmentType] || 'emp_type_not_set')}
                    </div>
                    <div className="text-xs text-slate-500 font-bold mb-1">{emp.jobTitle || t('job_title_not_set')}</div>
                    
                    <div className="flex flex-wrap gap-1 mt-1">
                      {emp.roles && emp.roles.length > 0 ? (
                        emp.roles.map((r: any) => (
                          <span key={r.id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-bold rounded">
                            {r.role?.name}
                          </span>
                        ))
                      ) : (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-bold rounded">
                          {t('role_default')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-slate-800 font-medium">
                      {emp.branch?.nameJa ? `${emp.branch.nameJa}${t('branch_suffix')}` : ''}
                      {emp.department?.name ? ` ${emp.department.name}` : ''}
                      {!emp.branch && !emp.department && t('not_assigned')}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{emp.country ? `${emp.country.name} (${emp.country.code})` : '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {emp.isActive ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>{t('status_active')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        {t('status_inactive')}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    {canEdit ? (
                      <div className="space-x-2">
                        <button
                          onClick={(e) => handleSendWelcome(e, emp)}
                          disabled={sendingWelcomeId === emp.id}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                          title={t('send_welcome_tooltip')}
                        >
                          {sendingWelcomeId === emp.id
                            ? <span className="inline-block w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin"></span>
                            : <i className="bi bi-envelope-arrow-up text-lg"></i>
                          }
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openFormModal(emp); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                          <i className="bi bi-pencil-square text-lg"></i>
                        </button>
                        <button onClick={(e) => confirmDelete(e, emp.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                          <i className="bi bi-trash text-lg"></i>
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {/* Mobile カードレイアウト */}
        <div className="md:hidden">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 space-y-2 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : sortedEmployees.length === 0 ? (
            <div className="flex flex-col items-center gap-3 text-slate-400 py-16">
              <i className="bi bi-person-x text-4xl"></i>
              <p className="text-sm font-medium">{t('no_match_title')}</p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {sortedEmployees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => openDetailModal(emp)}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar name={emp.firstNameJa} url={emp.avatarUrl} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate">{emp.lastNameJa} {emp.firstNameJa}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{emp.employeeCode || '-'}</div>
                    </div>
                    {emp.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>{t('status_active')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 shrink-0">
                        {t('status_inactive')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                      {t(EMP_TYPE_LABEL_KEYS[emp.employmentType] || 'emp_type_not_set')}
                    </span>
                    <span className="text-slate-500 truncate">
                      {emp.branch?.nameJa ? `${emp.branch.nameJa}${t('branch_suffix')}` : ''}
                      {emp.department?.name ? ` ${emp.department.name}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={handleEmpPageChange} />
      </div>

      {/* --- ★ 詳細表示モーダル --- */}
      {isDetailModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-none md:rounded-3xl shadow-2xl w-full md:max-w-5xl overflow-hidden flex flex-col md:flex-row h-full md:h-auto md:max-h-[90vh]">
            
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
                <div className="text-sm font-bold text-blue-200 mt-1">{t(EMP_TYPE_LABEL_KEYS[selectedEmployee.employmentType] || 'emp_type_not_set')}</div>
              </div>

              <div className="w-full space-y-3 pt-6 border-t border-white/10 text-left">
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-person-up text-blue-200"></i>
                  <span className="font-semibold">{t('detail_supervisor')}{selectedEmployee.manager ? `${selectedEmployee.manager.lastNameJa} ${selectedEmployee.manager.firstNameJa}` : t('detail_supervisor_not_set')}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-shop text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.branch?.nameJa ? `${selectedEmployee.branch.nameJa}${t('branch_suffix')}` : t('detail_branch_not_set')}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-building text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.department?.name || t('detail_dept_not_set')}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-briefcase text-blue-200"></i>
                  <span className="font-semibold">{selectedEmployee.jobTitle || t('detail_job_not_set')}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-star text-blue-200"></i>
                  <span className="font-semibold">{t(RANK_LABEL_KEYS[selectedEmployee.rank || 'ASSOCIATE'])}</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                  <i className="bi bi-envelope text-blue-200"></i>
                  <span className="font-semibold truncate">{selectedEmployee.email}</span>
                </div>
                {selectedEmployee.personalEmail && (
                  <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl text-sm">
                    <i className="bi bi-envelope-heart text-blue-200"></i>
                    <span className="font-semibold truncate">{selectedEmployee.personalEmail}</span>
                  </div>
                )}

                {isHrAdmin && selectedEmployee.email.endsWith('@tiramis.co.jp') && (
                  <button
                    onClick={handleWorkspaceNotify}
                    disabled={sendingWorkspaceNotify}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-400/50 text-white p-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {sendingWorkspaceNotify ? (
                      <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> {t('workspace_sending')}</>
                    ) : selectedEmployee.workspaceNotifiedAt ? (
                      <><i className="bi bi-check-circle-fill text-emerald-200"></i> {t('workspace_notified')}<span className="text-[10px] opacity-80 ml-1">{t('workspace_resend')}</span></>
                    ) : (
                      <><i className="bi bi-envelope-arrow-up"></i> {t('workspace_notify_btn')}</>
                    )}
                  </button>
                )}
                {isHrAdmin && !selectedEmployee.email.endsWith('@tiramis.co.jp') && (
                  <button
                    onClick={handleCreateWorkspace}
                    disabled={creatingWorkspace}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-amber-500/80 hover:bg-amber-500 border border-amber-400/50 text-white p-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {creatingWorkspace ? (
                      <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> {t('workspace_creating')}</>
                    ) : (
                      <><i className="bi bi-google"></i> {t('workspace_create_account')}</>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 bg-slate-50 p-8 overflow-y-auto custom-scrollbar relative">
              <div className="flex justify-between items-center mb-6 hidden md:flex">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-6 bg-blue-600 rounded-full"></span>{t('detail_title')}
                </h3>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors"><i className="bi bi-x-lg text-xl"></i></button>
              </div>

              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3"><i className="bi bi-person-lines-fill mr-1 text-blue-500"></i> {t('detail_personal_info')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HIRE DATE</div><div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-700"><i className="bi bi-calendar-event text-blue-500"></i>{selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</div></div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BIRTHDAY</div><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><i className="bi bi-cake text-rose-400"></i>{selectedEmployee.birthday ? new Date(selectedEmployee.birthday).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-'}</div></div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GENDER</div><div className="text-sm font-bold text-slate-700 capitalize">{selectedEmployee.gender === 'male' ? t('detail_gender_male') : selectedEmployee.gender === 'female' ? t('detail_gender_female') : t('detail_gender_other')}</div></div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PHONE NUMBER</div><div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-700"><i className="bi bi-telephone text-emerald-500"></i>{selectedEmployee.phone || t('detail_phone_not_set')}</div></div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1 sm:col-span-2"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COUNTRY / LOCATION</div><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><i className="bi bi-globe-asia-australia text-indigo-500"></i>{selectedEmployee.country ? `${selectedEmployee.country.name} (${selectedEmployee.country.code})` : t('detail_country_not_set')}</div></div>
                {(selectedEmployee.postalCode || selectedEmployee.address) && (
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-1 sm:col-span-3"><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('form_section_address').toUpperCase()}</div><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><i className="bi bi-geo-alt text-rose-500"></i>{[selectedEmployee.postalCode && `〒${selectedEmployee.postalCode}`, selectedEmployee.address, selectedEmployee.buildingName].filter(Boolean).join(' ')}</div></div>
                )}
              </div>

              {canViewSensitiveInfo ? (
                <>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3"><i className="bi bi-cash-stack mr-1 text-indigo-500"></i> {t('detail_salary_info')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{t('salary_type')}</div>
                      <div className="text-sm font-bold text-slate-700 mt-1">{t(SALARY_TYPE_LABEL_KEYS[selectedEmployee.financial?.salaryType] || '') || '-'}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{t('salary_amount')}</div>
                      <div className="text-lg font-mono font-black text-indigo-600 mt-1">
                        ¥{selectedEmployee.financial?.salaryType === 'MONTHLY' ? (selectedEmployee.financial?.baseSalary?.toLocaleString() || 0) : 
                          selectedEmployee.financial?.salaryType === 'DAILY' ? (selectedEmployee.financial?.dailyRate?.toLocaleString() || 0) : 
                          (selectedEmployee.financial?.hourlyRate?.toLocaleString() || 0)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{t('payment_method_cycle')}</div>
                      <div className="text-sm font-bold text-slate-700 mt-1">{t(PAY_METHOD_LABEL_KEYS[selectedEmployee.financial?.paymentMethod] || '') || '-'} / {t(PAY_CYCLE_LABEL_KEYS[selectedEmployee.financial?.paymentCycle] || '') || '-'}</div>
                    </div>
                  </div>

                  {selectedEmployee.employmentType === 'FULL_TIME' && (
                    <div className="mt-10 border-t border-slate-200 pt-8">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                          {t('leave_management')}
                        </h3>
                        <div className="text-sm font-bold text-slate-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 flex items-center gap-2">
                          {t('leave_balance')}<span className="text-2xl text-emerald-600 font-black">{selectedEmployee.financial?.paidLeaveBalance || 0}</span> {t('leave_days_unit')}
                        </div>
                      </div>

                      {canEdit ? (
                        isLeaveFormOpen ? (
                          <form onSubmit={handleLeaveSubmit} className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 mb-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-emerald-800 text-sm border-b border-emerald-200 pb-2 flex items-center gap-2"><i className="bi bi-plus-circle-fill"></i> {t('leave_form_title')}</h4>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-emerald-700 mb-1">{t('leave_form_date')}</label>
                                <input type="date" required value={leaveForm.date} onChange={e => setLeaveForm({...leaveForm, date: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-emerald-700 mb-1">{t('leave_form_type')}</label>
                                <select required value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                                  <option value="GRANTED">{t('leave_form_type_granted')}</option>
                                  <option value="ADJUSTED">{t('leave_form_type_adjusted')}</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-emerald-700 mb-1">{t('leave_form_days')} <span className="text-rose-500">*</span></label>
                                <input type="number" step="0.5" required value={leaveForm.days} onChange={e => setLeaveForm({...leaveForm, days: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder={t('leave_form_days_placeholder')} />
                              </div>
                              {leaveForm.type === 'GRANTED' && (
                                <div>
                                  <label className="block text-[10px] font-bold text-emerald-700 mb-1">{t('leave_form_valid_until')}</label>
                                  <input type="date" required value={leaveForm.validUntil} onChange={e => setLeaveForm({...leaveForm, validUntil: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-[10px] font-bold text-emerald-700 mb-1">{t('leave_form_note_label')}</label>
                              <input type="text" value={leaveForm.note} onChange={e => setLeaveForm({...leaveForm, note: e.target.value})} className="w-full border border-emerald-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder={t('leave_form_note_placeholder')} />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <button type="button" onClick={() => setIsLeaveFormOpen(false)} className="px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors">{t('btn_cancel')}</button>
                              <button type="submit" disabled={isLeaveSubmitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors disabled:opacity-50">
                                {isLeaveSubmitting ? t('leave_form_registering') : t('leave_form_register')}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="mb-4">
                            <button onClick={() => setIsLeaveFormOpen(true)} className="px-4 py-2.5 bg-white border border-emerald-200 text-emerald-600 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-colors shadow-sm flex items-center gap-1.5">
                              <i className="bi bi-plus-lg"></i> {t('leave_add_btn')}
                            </button>
                          </div>
                        )
                      ) : null}

                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3 font-semibold">{t('leave_table_date')}</th>
                              <th className="px-4 py-3 font-semibold text-center">{t('leave_table_type')}</th>
                              <th className="px-4 py-3 font-semibold text-right">{t('leave_table_days')}</th>
                              <th className="px-4 py-3 font-semibold">{t('leave_table_note')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {leaveLedgers.length === 0 ? (
                              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t('leave_table_empty')}</td></tr>
                            ) : (
                              leaveLedgers.map((l: any) => (
                                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 font-mono font-bold text-slate-600">{new Date(l.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${LEAVE_TYPE_STYLE[l.type] || 'bg-slate-100 border-slate-200'}`}>
                                      {t(LEAVE_TYPE_LABEL_KEYS[l.type] || '') || l.type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`font-black text-base ${l.days > 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                      {l.days > 0 ? `+${l.days}` : l.days}
                                    </span> 
                                    <span className="text-[10px] text-slate-400 ml-1">{t('leave_days_unit')}</span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">
                                    <div className="truncate max-w-[250px] font-medium text-slate-700" title={l.note}>{l.note || '-'}</div>
                                    {l.type === 'GRANTED' && l.validUntil && (
                                      <div className="text-[10px] text-emerald-600 font-mono mt-1 font-bold">
                                        <i className="bi bi-clock-history"></i> {t('leave_valid_until')}{new Date(l.validUntil).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
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
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-8 p-6 bg-slate-100 border border-slate-200 rounded-xl text-center text-sm font-bold text-slate-500">
                  <i className="bi bi-lock-fill text-2xl block mb-2 opacity-50"></i>
                  {t('detail_no_permission')}<br/>{t('detail_no_permission_sub')}
                </div>
              )}

              {canEdit && (
                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => { setIsDetailModalOpen(false); openFormModal(selectedEmployee); }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                  >
                    <i className="bi bi-pencil-square"></i> {t('detail_btn_edit')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ★ 登録・編集モーダル --- */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh] overflow-hidden">
            
            <div className="px-6 py-5 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 z-10 shadow-sm">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <i className="bi bi-person-vcard text-blue-600"></i>
                {currentId ? t('form_title_edit') : t('form_title_new')}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-shield-lock text-blue-600"></i> {t('form_section_account')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>{t('form_employee_code')}</label>
                    <input name="employeeCode" value={formData.employeeCode} onChange={handleInputChange} className={`${inputClass} font-mono`} placeholder={t('form_employee_code_placeholder')} />
                  </div>
                  <div>
                    <label className={labelClass}>{t('filter_status')}</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className={`${inputClass} font-bold ${formData.status === 'ACTIVE' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500'}`}>
                      <option value="ACTIVE">{t('form_status_active')}</option>
                      <option value="INACTIVE">{t('form_status_inactive')}</option>
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className={labelClass}>{t('form_personal_email')}</label>
                    <input type="email" name="personalEmail" value={formData.personalEmail} onChange={handleInputChange} className={inputClass} placeholder="private@example.com" />
                  </div>

                  {!currentId && (
                    <div className="lg:col-span-4">
                      <label className="flex items-center gap-3 cursor-pointer select-none bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl hover:bg-indigo-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.createWorkspaceAccount}
                          onChange={(e) => setFormData(prev => ({ ...prev, createWorkspaceAccount: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 accent-indigo-600"
                        />
                        <div>
                          <span className="text-sm font-bold text-indigo-900">{t('form_create_workspace')}</span>
                          <span className="text-[10px] text-indigo-500 ml-2">(@tiramis.co.jp)</span>
                        </div>
                      </label>
                      {formData.createWorkspaceAccount && (
                        <div className="mt-2 space-y-2">
                          {(!formData.firstNameEn || !formData.lastNameEn) && (
                            <p className="text-xs text-amber-600 font-bold flex items-center gap-1">
                              <i className="bi bi-exclamation-triangle-fill"></i>
                              {t('form_workspace_en_required')}
                            </p>
                          )}
                          {formData.firstNameEn && formData.lastNameEn && (
                            <p className="text-xs text-indigo-600 font-bold flex items-center gap-1">
                              <i className="bi bi-google"></i>
                              {t('form_workspace_preview', { email: `${formData.firstNameEn.toLowerCase()}.${formData.lastNameEn.toLowerCase()}@tiramis.co.jp` })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`${currentId ? 'lg:col-span-4' : 'lg:col-span-4'}`}>
                    <label className={labelClass}>{t('form_login_email')} {!(formData.createWorkspaceAccount && !currentId) && <span className="text-rose-500">*</span>}</label>
                    {formData.createWorkspaceAccount && !currentId ? (
                      <div className={`${inputClass} bg-slate-100 text-slate-500 cursor-not-allowed`}>
                        <i className="bi bi-robot text-indigo-500 mr-1"></i>
                        {t('form_workspace_auto_generate')}
                      </div>
                    ) : (
                      <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className={inputClass} placeholder="mail@example.com" />
                    )}
                  </div>
                </div>
              </div>

              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-person text-blue-600"></i> {t('form_section_profile')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>{t('form_last_name_kanji')} <span className="text-rose-500">*</span></label><input required name="lastNameJa" value={formData.lastNameJa} onChange={handleInputChange} className={inputClass} placeholder="山田" /></div>
                    <div><label className={labelClass}>{t('form_first_name_kanji')} <span className="text-rose-500">*</span></label><input required name="firstNameJa" value={formData.firstNameJa} onChange={handleInputChange} className={inputClass} placeholder="太郎" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>{t('form_last_name_kana_label')}</label><input name="lastNameKana" value={formData.lastNameKana} onChange={handleInputChange} className={inputClass} placeholder="ヤマダ" /></div>
                    <div><label className={labelClass}>{t('form_first_name_kana_label')}</label><input name="firstNameKana" value={formData.firstNameKana} onChange={handleInputChange} className={inputClass} placeholder="タロウ" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>Last Name (En)</label><input name="lastNameEn" value={formData.lastNameEn} onChange={handleInputChange} className={inputClass} placeholder="Yamada" /></div>
                    <div><label className={labelClass}>First Name (En)</label><input name="firstNameEn" value={formData.firstNameEn} onChange={handleInputChange} className={inputClass} placeholder="Taro" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass}>{t('form_birthday')}</label><input type="date" name="birthday" value={formData.birthday} onChange={handleInputChange} className={inputClass} /></div>
                    <div>
                      <label className={labelClass}>{t('form_gender')}</label>
                      <select name="gender" value={formData.gender} onChange={handleInputChange} className={inputClass}>
                        <option value="unknown">{t('form_gender_unknown')}</option><option value="male">{t('form_gender_male')}</option><option value="female">{t('form_gender_female')}</option><option value="other">{t('form_gender_other')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>{t('form_phone')}</label>
                    <div className="relative">
                      <i className="bi bi-telephone absolute left-3 top-3 text-slate-400"></i>
                      <input type="tel" name="phone" value={formData.phone} onChange={e => handlePhoneChange(e.target.value, v => setFormData(prev => ({ ...prev, phone: v })))} className={`${inputClass} pl-9`} placeholder="090-1234-5678" maxLength={13} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-geo-alt text-blue-600"></i> {t('form_section_address')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>{t('form_postal_code')}</label>
                    <input name="postalCode" value={formData.postalCode} onChange={handleInputChange} className={inputClass} placeholder="123-4567" maxLength={8} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>{t('form_address')}</label>
                    <input name="address" value={formData.address} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div className="md:col-span-3">
                    <label className={labelClass}>{t('form_building_name')}</label>
                    <input name="buildingName" value={formData.buildingName} onChange={handleInputChange} className={inputClass} maxLength={100} />
                  </div>
                </div>
              </div>

              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-diagram-3 text-blue-600"></i> {t('form_section_org_roles')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className={labelClass}>{t('form_hire_date')} <span className="text-rose-500">*</span></label><input type="date" required name="hireDate" value={formData.hireDate} onChange={handleInputChange} className={inputClass} /></div>
                  
                  <div className="md:col-span-2">
                    <label className={labelClass}>{t('form_manager_label')}</label>
                    <select name="managerId" value={formData.managerId} onChange={handleInputChange} className={inputClass}>
                      <option value="">{t('form_not_set')}</option>
                      {employees.filter(e => e.id !== currentId && e.isActive).map(e => (
                        <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa} ({e.jobTitle || t('form_no_job_title')})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>{t('form_branch')}</label>
                    <select name="branchId" value={formData.branchId} onChange={handleInputChange} className={inputClass}>
                      <option value="">{t('form_not_set')}</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('form_department')}</label>
                    <select name="departmentId" value={formData.departmentId} onChange={handleInputChange} className={inputClass}>
                      <option value="">{t('form_not_set')}</option>
                      {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('form_rank_label')}</label>
                    <select name="rank" value={formData.rank} onChange={handleInputChange} className={inputClass}>
                      {Object.entries(RANK_LABEL_KEYS).map(([key, labelKey]) => <option key={key} value={key}>{t(labelKey)}</option>)}
                    </select>
                  </div>
                  
                  <div><label className={labelClass}>{t('form_job_title_label')}</label><input name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} className={inputClass} placeholder={t('form_job_title_placeholder')} /></div>
                  
                  <div>
                    <label className={labelClass}>{t('form_country')}</label>
                    <select name="countryId" value={formData.countryId} onChange={handleInputChange} className={inputClass}>
                      <option value="">{t('form_not_set')}</option>
                      {countries.map(country => <option key={country.id} value={country.id}>{country.name} ({country.code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('form_language')}</label>
                    <select name="language" value={formData.language} onChange={handleInputChange} className={inputClass}>
                      <option value="ja">{t('form_language_ja')}</option>
                      <option value="en">{t('form_language_en')}</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 pt-4 border-t border-slate-100">
                    <label className={labelClass}>{t('form_roles_label')}</label>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {roles.map(role => (
                        <label key={role.id} className={`flex items-center gap-2 cursor-pointer border px-4 py-2.5 rounded-xl transition-all ${formData.roleIds.includes(role.id.toString()) ? 'bg-indigo-50 border-indigo-400 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                          <input 
                            type="checkbox" 
                            checked={formData.roleIds.includes(role.id.toString())}
                            onChange={(e) => handleRoleChange(role.id.toString(), e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 accent-indigo-600"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{role.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{role.code}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">{t('form_roles_hint')}</p>
                  </div>
                </div>
              </div>

              {/* --- ビザ・書類セクション --- */}
              <div className={sectionClass}>
                <h4 className={sectionHeaderClass}><i className="bi bi-card-heading text-blue-600"></i> {t('form_section_visa_docs')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>{t('form_visa_type')}</label>
                    <select name="visaTypeId" value={formData.visaTypeId} onChange={handleInputChange} className={inputClass}>
                      <option value="">{t('form_not_set')}</option>
                      {visaTypes.map(vt => <option key={vt.id} value={vt.id}>{vt.name} ({vt.nameEn})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('form_visa_expiry')}</label>
                    <input type="date" name="visaExpiryDate" value={formData.visaExpiryDate} onChange={handleInputChange} className={inputClass} />
                  </div>
                </div>

                {/* 在留カード（編集時のみ表示） */}
                {currentId && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <label className={labelClass + ' mb-0'}>{t('form_residence_card')}</label>
                      {getVerificationBadge(employees.find(e => e.id === currentId)?.residenceCardVerificationStatus)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 表面 */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">{t('form_residence_card_front')}</div>
                        {employees.find(e => e.id === currentId)?.residenceCardFrontUrl ? (
                          <div className="space-y-2">
                            <img src={employees.find(e => e.id === currentId)?.residenceCardFrontUrl || ''} alt="Front" className="w-full h-32 object-cover rounded-lg border" />
                            <button type="button" onClick={() => handleResidenceCardUpload('front')} disabled={isUploadingCard === 'front'} className="w-full text-xs font-bold text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                              {isUploadingCard === 'front' ? <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-1"></span> : <i className="bi bi-arrow-repeat mr-1"></i>}
                              {t('form_residence_card_replace')}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => handleResidenceCardUpload('front')} disabled={isUploadingCard === 'front'} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50">
                            {isUploadingCard === 'front' ? <span className="inline-block w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></span> : <><i className="bi bi-cloud-arrow-up text-xl"></i><span className="text-xs mt-1">{t('form_residence_card_upload')}</span></>}
                          </button>
                        )}
                      </div>
                      {/* 裏面 */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">{t('form_residence_card_back')}</div>
                        {employees.find(e => e.id === currentId)?.residenceCardBackUrl ? (
                          <div className="space-y-2">
                            <img src={employees.find(e => e.id === currentId)?.residenceCardBackUrl || ''} alt="Back" className="w-full h-32 object-cover rounded-lg border" />
                            <button type="button" onClick={() => handleResidenceCardUpload('back')} disabled={isUploadingCard === 'back'} className="w-full text-xs font-bold text-blue-600 hover:bg-blue-50 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                              {isUploadingCard === 'back' ? <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mr-1"></span> : <i className="bi bi-arrow-repeat mr-1"></i>}
                              {t('form_residence_card_replace')}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => handleResidenceCardUpload('back')} disabled={isUploadingCard === 'back'} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50">
                            {isUploadingCard === 'back' ? <span className="inline-block w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></span> : <><i className="bi bi-cloud-arrow-up text-xl"></i><span className="text-xs mt-1">{t('form_residence_card_upload')}</span></>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 銀行カード（編集時のみ表示） */}
                {currentId && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <label className={labelClass + ' mb-0'}>{t('form_bank_card')}</label>
                      <button type="button" onClick={handleBankCardUpload} disabled={bankCardAnalyzing} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
                        {bankCardAnalyzing ? (
                          <><span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></span> {t('form_bank_card_analyzing')}</>
                        ) : (
                          <><i className="bi bi-camera"></i> {t('form_bank_card_upload')}</>
                        )}
                      </button>
                    </div>
                    {employees.find(e => e.id === currentId)?.bankCardImageUrl && (
                      <img src={employees.find(e => e.id === currentId)?.bankCardImageUrl || ''} alt="Bank Card" className="w-full max-w-sm h-32 object-cover rounded-lg border" />
                    )}
                  </div>
                )}
              </div>

              <div className="bg-indigo-50/40 p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
                <h4 className="text-sm font-black text-indigo-900 border-b border-indigo-100 pb-3 mb-4 flex items-center gap-2">
                  <i className="bi bi-cash-stack text-indigo-600"></i> {t('form_salary_info')} <span className="text-[10px] text-indigo-500/70 font-medium ml-2">{t('form_salary_info_admin_only')}</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>{t('form_emp_type')}</label>
                    <select name="employmentType" value={formData.employmentType} onChange={handleInputChange} className={inputClass}>
                      <option value="FULL_TIME">{t('emp_type_full_time')}</option>
                      <option value="PART_TIME">{t('emp_type_part_time')}</option>
                      <option value="OUTSOURCE">{t('emp_type_outsource')}</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('form_salary_type')}</label>
                    <select name="salaryType" value={formData.salaryType} onChange={handleInputChange} className={inputClass}>
                      <option value="MONTHLY">{t('salary_type_monthly')}</option>
                      <option value="DAILY">{t('salary_type_daily')}</option>
                      <option value="HOURLY">{t('salary_type_hourly')}</option>
                    </select>
                  </div>

                  {formData.salaryType === 'MONTHLY' && (
                    <div><label className={labelClass}>{t('form_base_salary')}</label><input type="number" name="baseSalary" value={formData.baseSalary} onChange={handleInputChange} className={`${inputClass} font-mono font-bold text-indigo-700`} placeholder={t('form_base_salary_placeholder')} /></div>
                  )}
                  {formData.salaryType === 'DAILY' && (
                    <div><label className={labelClass}>{t('form_daily_rate_label')}</label><input type="number" name="dailyRate" value={formData.dailyRate} onChange={handleInputChange} className={`${inputClass} font-mono font-bold text-indigo-700`} placeholder={t('form_daily_rate_placeholder')} /></div>
                  )}
                  {formData.salaryType === 'HOURLY' && (
                    <div><label className={labelClass}>{t('form_hourly_rate_label')}</label><input type="number" name="hourlyRate" value={formData.hourlyRate} onChange={handleInputChange} className={`${inputClass} font-mono font-bold text-indigo-700`} placeholder={t('form_hourly_rate_placeholder')} /></div>
                  )}

                  <div>
                    <label className={labelClass}>{t('form_payment_cycle')}</label>
                    <select name="paymentCycle" value={formData.paymentCycle} onChange={handleInputChange} className={inputClass}>
                      <option value="MONTHLY">{t('payment_monthly')}</option><option value="WEEKLY">{t('payment_weekly')}</option><option value="DAILY">{t('payment_daily')}</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t('form_payment_method')}</label>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className={inputClass}>
                      <option value="BANK_TRANSFER">{t('payment_bank')}</option><option value="CASH">{t('payment_cash')}</option>
                    </select>
                  </div>
                  {formData.employmentType === 'FULL_TIME' && (
                    <div className="col-span-2">
                      <label className={labelClass}>{t('form_working_weekdays_label')}</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {[{d:1,l:t('form_weekday_mon')},{d:2,l:t('form_weekday_tue')},{d:3,l:t('form_weekday_wed')},{d:4,l:t('form_weekday_thu')},{d:5,l:t('form_weekday_fri')},{d:6,l:t('form_weekday_sat')},{d:7,l:t('form_weekday_sun')}].map(({d,l}) => {
                          const days = (formData.workingWeekdays || '').split(',').filter(Boolean);
                          const checked = days.includes(String(d));
                          return (
                            <label key={d} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-bold transition-colors ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300 hover:border-blue-400'}`}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={checked}
                                onChange={(e) => {
                                  const cur = (formData.workingWeekdays || '').split(',').filter(Boolean);
                                  const next = e.target.checked ? [...cur, String(d)] : cur.filter(x => x !== String(d));
                                  next.sort((a,b) => Number(a)-Number(b));
                                  setFormData(prev => ({ ...prev, workingWeekdays: next.join(',') }));
                                }}
                              />
                              {l}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {currentId ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-sm">
                  <button type="button" onClick={handlePasswordReset} className="text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto">
                    <i className="bi bi-key-fill"></i> {t('password_reset_link')}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-2">{t('password_reset_hint')}</p>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-2 text-xs text-blue-800">
                  <i className="bi bi-info-circle-fill mt-0.5 shrink-0"></i>
                  <p dangerouslySetInnerHTML={{ __html: t('initial_password_info') }} />
                </div>
              )}

            </form>

            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors">{t('btn_cancel')}</button>
              <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                <i className="bi bi-cloud-arrow-up-fill"></i>
                {currentId ? t('btn_save_update') : t('btn_register_employee')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="font-black text-slate-800 text-lg mb-2">{t('delete_confirm_title')}</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('delete_confirm_message') }} />
            <div className="flex justify-center gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors">{t('btn_cancel')}</button>
              <button onClick={executeDelete} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors">{t('delete_execute')}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ウェルカムメール送信確認モーダル --- */}
      {pendingWelcomeEmp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* アイコンヘッダー */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 px-6 pt-8 pb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <i className="bi bi-envelope-arrow-up-fill text-white text-3xl"></i>
              </div>
              <h3 className="text-white font-black text-lg">{t('welcome_mail_title')}</h3>
              <p className="text-indigo-200 text-sm mt-1">
                {t('welcome_mail_to', { name: `${pendingWelcomeEmp.lastNameJa} ${pendingWelcomeEmp.firstNameJa}` })}
              </p>
            </div>

            <div className="p-6">
              {/* 送信内容サマリー */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <i className="bi bi-person text-slate-400 w-4 text-center"></i>
                  <span>{t('welcome_mail_emp_code')}<span className="font-bold text-slate-800">{pendingWelcomeEmp.employeeCode}</span></span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <i className="bi bi-envelope text-slate-400 w-4 text-center"></i>
                  <span className="font-bold text-slate-800 break-all">{pendingWelcomeEmp.email}</span>
                </div>
              </div>

              {/* 注意書き */}
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
                <i className="bi bi-exclamation-triangle-fill text-amber-500 text-sm mt-0.5 shrink-0"></i>
                <p className="text-amber-700 text-xs leading-relaxed">
                  <span dangerouslySetInnerHTML={{ __html: t('welcome_mail_warning') }} />
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPendingWelcomeEmp(null)}
                  className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  onClick={executeSendWelcome}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <i className="bi bi-send-fill text-xs"></i> {t('welcome_mail_send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ウェルカムメール送信完了トースト --- */}
      {welcomeToast && (
        <div
          className={`fixed bottom-6 right-6 z-[300] flex items-center gap-3 bg-indigo-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl transition-all duration-350 ease-in-out ${
            isToastExiting
              ? 'opacity-0 translate-y-3 scale-95'
              : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom-4 fade-in duration-300'
          }`}
        >
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <i className="bi bi-envelope-check-fill text-sm"></i>
          </div>
          <div>
            <p className="font-bold text-sm">{t('welcome_toast_sent', { name: welcomeToast.name })}</p>
            <p className="text-indigo-200 text-xs mt-0.5">{t('welcome_toast_message')}</p>
          </div>
          <button onClick={dismissWelcomeToast} className="ml-2 text-white/60 hover:text-white transition-colors">
            <i className="bi bi-x-lg text-sm"></i>
          </button>
        </div>
      )}
    </div>
  );
}