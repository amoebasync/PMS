'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  AssigneeMultiSelect,
  AutocompleteInput,
  type SelectedAssignee,
  type TaskCategoryInfo,
} from '@/components/TaskCreateModal';

// ===== 型定義 =====
type Employee = { id: number; lastNameJa: string; firstNameJa: string };
type Customer = { id: number; name: string };
type Distributor = { id: number; name: string; staffId: string };
type DeptInfo = { id: number; name: string };
type BranchInfo = { id: number; nameJa: string };

type TaskAssigneeData = {
  employee: { id: number; lastNameJa: string; firstNameJa: string } | null;
  department: { id: number; name: string } | null;
  branch: { id: number; nameJa: string } | null;
};

type Task = {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  priority: string;
  status: string;
  categoryId: number | null;
  taskCategory: TaskCategoryInfo | null;
  customer: Customer | null;
  distributor: Distributor | null;
  assignee: Employee | null;
  createdBy: Employee | null;
  branch: BranchInfo | null;
  schedule: { id: number; jobNumber: string } | null;
  template: { id: number; title: string } | null;
  complaint: { id: number; title: string } | null;
  inspectionFollowUp: { id: number; category: string; schedule: { id: number; date: string; distributor: { name: string } | null } | null } | null;
  inspectionFeedback: { id: number; category: string; schedule: { id: number; date: string; distributor: { name: string } | null } | null } | null;
  assignees: TaskAssigneeData[];
};

type TaskTemplate = {
  id: number;
  title: string;
  description: string | null;
  categoryId: number | null;
  taskCategory: TaskCategoryInfo | null;
  priority: string;
  completionRule: string;
  customerId: number | null;
  customer: Customer | null;
  distributorId: number | null;
  distributor: Distributor | null;
  branchId: number | null;
  branch: BranchInfo | null;
  scheduleId: number | null;
  schedule: { id: number; jobNumber: string } | null;
  recurrenceType: string;
  recurrenceValue: string | null;
  dueTime: string | null;
  targetEmployeeIds: number[] | null;
  targetDepartmentIds: number[] | null;
  targetBranchIds: number[] | null;
  isActive: boolean;
  lastGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ===== 定数（スタイル情報のみ、ラベルはt()で解決） =====
const PRIORITY_STYLE: Record<string, { labelKey: string; cls: string }> = {
  HIGH:   { labelKey: 'priority_high', cls: 'bg-red-100 text-red-700 border border-red-200' },
  MEDIUM: { labelKey: 'priority_medium', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  LOW:    { labelKey: 'priority_low', cls: 'bg-green-100 text-green-700 border border-green-200' },
};

const STATUS_STYLE: Record<string, { labelKey: string; cls: string }> = {
  PENDING:     { labelKey: 'status_pending', cls: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { labelKey: 'status_in_progress', cls: 'bg-blue-100 text-blue-700' },
  DONE:        { labelKey: 'status_done',   cls: 'bg-green-100 text-green-700' },
};

const RECURRENCE_KEYS: Record<string, string> = {
  ONCE: 'recurrence_once', DAILY: 'recurrence_daily', WEEKLY: 'recurrence_weekly', MONTHLY: 'recurrence_monthly', YEARLY: 'recurrence_yearly',
};

const DAY_LABEL_KEYS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'];

// ===== ヘルパー =====
function formatRecurrence(type: string, value: string | null, t: (key: string) => string): string {
  const key = RECURRENCE_KEYS[type];
  const base = key ? t(key) : type;
  if (!value) return base;
  switch (type) {
    case 'WEEKLY': {
      const days = value.split(',').map(s => parseInt(s.trim()));
      const dayLabels = DAY_LABEL_KEYS.map(k => t(k));
      return `${base}（${days.map(d => dayLabels[d] || d).join('・')}）`;
    }
    case 'MONTHLY':
      return `${base} ${value.trim()}${t('day_suffix')}`;
    case 'YEARLY': {
      const [m, d] = value.split('-');
      return `${base} ${parseInt(m)}${t('month_suffix')}${parseInt(d)}${t('day_suffix')}`;
    }
    default:
      return base;
  }
}

function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  const dateStr = d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const hasTime = jst.getHours() !== 0 || jst.getMinutes() !== 0;
  if (hasTime) {
    return `${dateStr} ${String(jst.getHours()).padStart(2, '0')}:${String(jst.getMinutes()).padStart(2, '0')}`;
  }
  return dateStr;
}

function countAssignees(tmpl: TaskTemplate): number {
  return ((tmpl.targetEmployeeIds as number[]) || []).length
    + ((tmpl.targetDepartmentIds as number[]) || []).length
    + ((tmpl.targetBranchIds as number[]) || []).length;
}

// ===== メインページ =====
export default function CrmTasksPage() {
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('tasks');
  const [activeTab, setActiveTab] = useState<'tasks' | 'templates'>('tasks');

  const PRIORITY_CONFIG = useMemo<Record<string, { label: string; cls: string }>>(() => ({
    HIGH:   { label: t('priority_high'), cls: PRIORITY_STYLE.HIGH.cls },
    MEDIUM: { label: t('priority_medium'), cls: PRIORITY_STYLE.MEDIUM.cls },
    LOW:    { label: t('priority_low'), cls: PRIORITY_STYLE.LOW.cls },
  }), [t]);

  const STATUS_CONFIG = useMemo<Record<string, { label: string; cls: string }>>(() => ({
    PENDING:     { label: t('status_pending'), cls: STATUS_STYLE.PENDING.cls },
    IN_PROGRESS: { label: t('status_in_progress'), cls: STATUS_STYLE.IN_PROGRESS.cls },
    DONE:        { label: t('status_done'), cls: STATUS_STYLE.DONE.cls },
  }), [t]);

  const DAY_LABELS = useMemo(() => DAY_LABEL_KEYS.map(k => t(k)), [t]);

  // 共通マスタ
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deptMap, setDeptMap] = useState<Record<number, string>>({});
  const [branchMap, setBranchMap] = useState<Record<number, string>>({});
  const [branchList, setBranchList] = useState<BranchInfo[]>([]);
  const [taskCategories, setTaskCategories] = useState<TaskCategoryInfo[]>([]);

  // ----- タスク一覧 -----
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [filterStatus, setFilterStatus] = useState('NOT_DONE');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDue, setFilterDue] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterMyTasks, setFilterMyTasks] = useState(false);

  // タスク詳細モーダル（読み取り専用）
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // タスク編集モーダル（インライン）
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', dueDate: new Date().toISOString().slice(0, 10),
    dueTime: '' as string, isAllDay: true,
    priority: 'MEDIUM', status: 'PENDING', categoryId: '' as string,
    customerId: '' as string, distributorId: '' as string, branchId: '' as string,
  });
  const [taskAssignees, setTaskAssignees] = useState<SelectedAssignee[]>([]);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formDistributorName, setFormDistributorName] = useState('');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // ----- テンプレート -----
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // テンプレートモーダル
  const [isTmplModalOpen, setIsTmplModalOpen] = useState(false);
  const [editingTmpl, setEditingTmpl] = useState<TaskTemplate | null>(null);
  const [tmplForm, setTmplForm] = useState({
    title: '', description: '', categoryId: '' as string,
    priority: 'MEDIUM', completionRule: 'SHARED',
    customerId: '' as string, distributorId: '' as string, branchId: '' as string,
    recurrenceType: 'ONCE', weeklyDays: [] as number[],
    monthlyDay: '1', yearlyMonth: '01', yearlyDay: '01',
    dueTime: '' as string, isActive: true,
  });
  const [tmplAssignees, setTmplAssignees] = useState<SelectedAssignee[]>([]);
  const [tmplCustomerName, setTmplCustomerName] = useState('');
  const [tmplDistributorName, setTmplDistributorName] = useState('');
  const [isSubmittingTmpl, setIsSubmittingTmpl] = useState(false);

  // ===== データフェッチ =====
  useEffect(() => {
    // 社員（マスタ）
    fetch('/api/employees').then(r => r.ok ? r.json() : []).then(data => {
      const list = Array.isArray(data) ? data : [];
      setEmployees(list.filter((e: any) => e.isActive).map((e: any) => ({
        id: e.id, lastNameJa: e.lastNameJa, firstNameJa: e.firstNameJa,
      })));
      // 部署マップ構築
      const dm: Record<number, string> = {};
      list.forEach((e: any) => {
        if (e.department?.id && e.department?.name) dm[e.department.id] = e.department.name;
      });
      setDeptMap(dm);
      // 支店マップ（employees経由）
      const bm: Record<number, string> = {};
      list.forEach((e: any) => {
        if (e.branch?.id && e.branch?.nameJa) bm[e.branch.id] = e.branch.nameJa;
      });
      setBranchMap(bm);
    });
    // タスク種類（DB）
    fetch('/api/task-categories').then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setTaskCategories(data.filter((c: any) => c.isActive));
    });
    // 支店一覧（ドロップダウン用）
    fetch('/api/branches').then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) {
        setBranchList(data.map((b: any) => ({ id: b.id, nameJa: b.nameJa })));
        // branchMap 補完
        setBranchMap(prev => {
          const next = { ...prev };
          data.forEach((b: any) => { if (b.id && b.nameJa) next[b.id] = b.nameJa; });
          return next;
        });
      }
    });
  }, []);

  // タスク一覧フェッチ
  const fetchTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    const p = new URLSearchParams();
    if (filterStatus) p.set('status', filterStatus);
    if (filterAssignee) p.set('assigneeId', filterAssignee);
    if (filterDue) p.set('dueDate', filterDue);
    if (filterCategoryId) p.set('category', filterCategoryId);
    if (filterMyTasks) p.set('myTasks', 'true');
    const res = await fetch(`/api/tasks?${p.toString()}`);
    if (res.ok) {
      let data: Task[] = await res.json();
      if (filterPriority) data = data.filter(t => t.priority === filterPriority);
      setTasks(data);
    }
    setIsLoadingTasks(false);
  }, [filterStatus, filterAssignee, filterPriority, filterDue, filterCategoryId, filterMyTasks]);

  useRefreshOnFocus(fetchTasks);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // グローバルタスク作成モーダルからの作成通知を受信
  useEffect(() => {
    const handler = () => fetchTasks();
    window.addEventListener('task-created', handler);
    return () => window.removeEventListener('task-created', handler);
  }, [fetchTasks]);

  // テンプレート一覧フェッチ
  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    const res = await fetch('/api/task-templates');
    if (res.ok) setTemplates(await res.json());
    setIsLoadingTemplates(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'templates') fetchTemplates();
  }, [activeTab, fetchTemplates]);

  // ===== タスク操作 =====
  // Helper: get category code from ID
  const getCategoryCode = (catId: string | number | null): string => {
    if (!catId) return '';
    const cat = taskCategories.find(c => c.id === Number(catId));
    return cat?.code || '';
  };

  const openTaskEdit = (task: Task) => {
    setEditingTask(task);
    // 時刻が00:00:00でなければ時刻設定ありとみなす
    const dueDateObj = new Date(task.dueDate);
    const hasTime = dueDateObj.getHours() !== 0 || dueDateObj.getMinutes() !== 0;
    const timeStr = hasTime
      ? `${String(dueDateObj.getHours()).padStart(2, '0')}:${String(dueDateObj.getMinutes()).padStart(2, '0')}`
      : '';
    setTaskForm({
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate.slice(0, 10),
      dueTime: timeStr,
      isAllDay: !hasTime,
      priority: task.priority,
      status: task.status,
      categoryId: task.categoryId?.toString() || '',
      customerId: task.customer?.id.toString() || '',
      distributorId: task.distributor?.id.toString() || '',
      branchId: task.branch?.id.toString() || '',
    });
    setFormCustomerName(task.customer?.name || '');
    setFormDistributorName(task.distributor ? `${task.distributor.name} (${task.distributor.staffId})` : '');
    // 既存担当者をタグ化
    const existing: SelectedAssignee[] = [];
    task.assignees.forEach(a => {
      if (a.employee) existing.push({ type: 'employee', id: a.employee.id, label: `${a.employee.lastNameJa} ${a.employee.firstNameJa}` });
      if (a.department) existing.push({ type: 'department', id: a.department.id, label: a.department.name });
      if (a.branch) existing.push({ type: 'branch', id: a.branch.id, label: a.branch.nameJa });
    });
    setTaskAssignees(existing);
    setIsTaskModalOpen(true);
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTask(true);
    const method = editingTask ? 'PUT' : 'POST';
    const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
    // assigneeId はマルチセレクトの最初の社員を自動セット
    const firstEmp = taskAssignees.find(a => a.type === 'employee');
    // 時刻を含む dueDate を構築
    let dueDateValue = taskForm.dueDate;
    if (!taskForm.isAllDay && taskForm.dueTime) {
      dueDateValue = `${taskForm.dueDate}T${taskForm.dueTime}:00`;
    }
    const body: any = {
      ...taskForm,
      dueDate: dueDateValue,
      category: taskForm.categoryId || null,
      customerId: taskForm.customerId || null,
      distributorId: taskForm.distributorId || null,
      branchId: taskForm.branchId || null,
      assigneeId: firstEmp ? firstEmp.id.toString() : null,
      assignees: taskAssignees.map(a => ({ type: a.type, id: a.id })),
    };
    // 不要なフィールドを除外
    delete body.dueTime;
    delete body.isAllDay;
    delete body.categoryId;
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      setIsTaskModalOpen(false);
      fetchTasks();
      showToast(editingTask ? t('toast_task_updated') : t('toast_task_created'), 'success');
    } else {
      showToast(t('save_error'), 'error');
    }
    setIsSubmittingTask(false);
  };

  const handleQuickDone = async (taskId: number) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    });
    if (res.ok) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'DONE' } : t));
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!await showConfirm(t('confirm_delete_task'), { variant: 'danger', confirmLabel: t('delete') })) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      showToast(t('toast_task_deleted'), 'success');
    }
  };

  // ===== テンプレート操作 =====
  const resolveAssignees = (tmpl: TaskTemplate): SelectedAssignee[] => {
    const result: SelectedAssignee[] = [];
    ((tmpl.targetEmployeeIds as number[]) || []).forEach(eid => {
      const emp = employees.find(e => e.id === eid);
      result.push({ type: 'employee', id: eid, label: emp ? `${emp.lastNameJa} ${emp.firstNameJa}` : `${t('employee')}#${eid}` });
    });
    ((tmpl.targetDepartmentIds as number[]) || []).forEach(did => {
      result.push({ type: 'department', id: did, label: deptMap[did] || `${t('department')}#${did}` });
    });
    ((tmpl.targetBranchIds as number[]) || []).forEach(bid => {
      result.push({ type: 'branch', id: bid, label: branchMap[bid] || `${t('branch')}#${bid}` });
    });
    return result;
  };

  const openTmplCreate = () => {
    setEditingTmpl(null);
    setTmplForm({
      title: '', description: '', categoryId: taskCategories.length > 0 ? taskCategories[0].id.toString() : '',
      priority: 'MEDIUM',
      completionRule: 'SHARED', customerId: '', distributorId: '', branchId: '',
      recurrenceType: 'ONCE', weeklyDays: [], monthlyDay: '1',
      yearlyMonth: '01', yearlyDay: '01', dueTime: '', isActive: true,
    });
    setTmplAssignees([]);
    setTmplCustomerName('');
    setTmplDistributorName('');
    setIsTmplModalOpen(true);
  };

  const openTmplEdit = (tmpl: TaskTemplate) => {
    setEditingTmpl(tmpl);
    // recurrenceValue をパース
    let weeklyDays: number[] = [];
    let monthlyDay = '1';
    let yearlyMonth = '01';
    let yearlyDay = '01';
    if (tmpl.recurrenceType === 'WEEKLY' && tmpl.recurrenceValue) {
      weeklyDays = tmpl.recurrenceValue.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    } else if (tmpl.recurrenceType === 'MONTHLY' && tmpl.recurrenceValue) {
      monthlyDay = tmpl.recurrenceValue.trim();
    } else if (tmpl.recurrenceType === 'YEARLY' && tmpl.recurrenceValue) {
      const parts = tmpl.recurrenceValue.split('-');
      if (parts.length === 2) { yearlyMonth = parts[0]; yearlyDay = parts[1]; }
    }
    setTmplForm({
      title: tmpl.title,
      description: tmpl.description || '',
      categoryId: tmpl.categoryId?.toString() || '',
      priority: tmpl.priority,
      completionRule: tmpl.completionRule,
      customerId: tmpl.customerId?.toString() || '',
      distributorId: tmpl.distributorId?.toString() || '',
      branchId: tmpl.branchId?.toString() || '',
      recurrenceType: tmpl.recurrenceType,
      weeklyDays, monthlyDay, yearlyMonth, yearlyDay,
      dueTime: tmpl.dueTime || '',
      isActive: tmpl.isActive,
    });
    setTmplAssignees(resolveAssignees(tmpl));
    setTmplCustomerName(tmpl.customer?.name || '');
    setTmplDistributorName(tmpl.distributor ? `${tmpl.distributor.name} (${tmpl.distributor.staffId})` : '');
    setIsTmplModalOpen(true);
  };

  const buildRecurrenceValue = (): string | null => {
    switch (tmplForm.recurrenceType) {
      case 'WEEKLY':
        return tmplForm.weeklyDays.length > 0 ? tmplForm.weeklyDays.sort((a, b) => a - b).join(',') : null;
      case 'MONTHLY':
        return tmplForm.monthlyDay;
      case 'YEARLY':
        return `${tmplForm.yearlyMonth}-${tmplForm.yearlyDay}`;
      default:
        return null;
    }
  };

  const handleTmplSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTmpl(true);
    const method = editingTmpl ? 'PUT' : 'POST';
    const url = editingTmpl ? `/api/task-templates/${editingTmpl.id}` : '/api/task-templates';
    const catCode = getCategoryCode(tmplForm.categoryId);
    const body: any = {
      title: tmplForm.title,
      description: tmplForm.description || null,
      categoryId: tmplForm.categoryId || null,
      priority: tmplForm.priority,
      completionRule: tmplForm.completionRule,
      customerId: catCode === 'SALES' ? (tmplForm.customerId || null) : null,
      distributorId: catCode === 'FIELD' ? (tmplForm.distributorId || null) : null,
      branchId: tmplForm.branchId || null,
      recurrenceType: tmplForm.recurrenceType,
      recurrenceValue: buildRecurrenceValue(),
      dueTime: tmplForm.dueTime || null,
      targetEmployeeIds: tmplAssignees.filter(a => a.type === 'employee').map(a => a.id),
      targetDepartmentIds: tmplAssignees.filter(a => a.type === 'department').map(a => a.id),
      targetBranchIds: tmplAssignees.filter(a => a.type === 'branch').map(a => a.id),
      isActive: tmplForm.isActive,
    };
    // 空配列を null に
    if (body.targetEmployeeIds.length === 0) body.targetEmployeeIds = null;
    if (body.targetDepartmentIds.length === 0) body.targetDepartmentIds = null;
    if (body.targetBranchIds.length === 0) body.targetBranchIds = null;

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      setIsTmplModalOpen(false);
      fetchTemplates();
      showToast(editingTmpl ? t('toast_template_updated') : t('toast_template_created'), 'success');
    } else {
      showToast(t('save_error'), 'error');
    }
    setIsSubmittingTmpl(false);
  };

  const handleDeleteTmpl = async (tmplId: number) => {
    if (!await showConfirm(t('confirm_delete_template'), { variant: 'danger', confirmLabel: t('delete') })) return;
    const res = await fetch(`/api/task-templates/${tmplId}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates(prev => prev.filter(t => t.id !== tmplId));
      showToast(t('toast_template_deleted'), 'success');
    }
  };

  const handleToggleActive = async (tmpl: TaskTemplate) => {
    const res = await fetch(`/api/task-templates/${tmpl.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tmpl, isActive: !tmpl.isActive }),
    });
    if (res.ok) {
      setTemplates(prev => prev.map(t => t.id === tmpl.id ? { ...t, isActive: !t.isActive } : t));
      showToast(tmpl.isActive ? t('toast_template_toggled_off') : t('toast_template_toggled_on'), 'success');
    }
  };

  // ===== 表示用ヘルパー =====
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueCount = tasks.filter(t => {
    if (t.status === 'DONE') return false;
    const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
    return d < today;
  }).length;

  const todayCount = tasks.filter(t => {
    if (t.status === 'DONE') return false;
    const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;

  const kw = filterKeyword.toLowerCase();
  const displayTasks = kw
    ? tasks.filter(t =>
        t.title.toLowerCase().includes(kw) ||
        (t.description?.toLowerCase().includes(kw)) ||
        (t.customer?.name.toLowerCase().includes(kw)) ||
        (t.distributor?.name.toLowerCase().includes(kw)) ||
        (t.assignee && `${t.assignee.lastNameJa}${t.assignee.firstNameJa}`.toLowerCase().includes(kw))
      )
    : tasks;

  const hasFilter = filterStatus || filterPriority || filterAssignee || filterDue || filterKeyword || filterCategoryId || filterMyTasks;

  const renderAssignees = (task: Task) => {
    if (task.assignees && task.assignees.length > 0) {
      const items: string[] = [];
      task.assignees.forEach(a => {
        if (a.employee) items.push(`${a.employee.lastNameJa} ${a.employee.firstNameJa}`);
        if (a.department) items.push(a.department.name);
        if (a.branch) items.push(a.branch.nameJa);
      });
      if (items.length <= 2) return items.join(', ');
      return `${items[0]} +${items.length - 1}`;
    }
    if (task.assignee) return `${task.assignee.lastNameJa} ${task.assignee.firstNameJa}`;
    return '—';
  };

  // ===== JSX =====
  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-10 max-w-7xl mx-auto">

      {/* ==================== タブバー + コンテンツ ==================== */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* タブ行 */}
        <div className="flex items-center border-b border-slate-200">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-colors relative ${
              activeTab === 'tasks' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="bi bi-list-check"></i>
            {t('tab_tasks')}
            {activeTab === 'tasks' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-colors relative ${
              activeTab === 'templates' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className="bi bi-arrow-repeat"></i>
            {t('tab_templates')}
            {activeTab === 'templates' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
            )}
          </button>

          {/* スペーサー + アクションボタン */}
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-4">
            {activeTab === 'templates' && (
              <button onClick={openTmplCreate}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">
                <i className="bi bi-plus-lg text-indigo-500"></i>
                {t('btn_create_template')}
              </button>
            )}
          </div>
        </div>

        {/* タブ内コンテンツ */}
        <div className="p-5">

      {/* ==================== タスク一覧タブ ==================== */}
      {activeTab === 'tasks' && (
        <div className="space-y-5">
          {/* 期限アラートカード */}
          {!isLoadingTasks && (overdueCount > 0 || todayCount > 0) && (
            <div className="flex flex-wrap gap-3">
              {overdueCount > 0 && (
                <button onClick={() => { setFilterDue('overdue'); setFilterStatus(''); }}
                  className="flex items-center gap-3 bg-red-50 border-2 border-red-200 rounded-xl px-5 py-3 hover:bg-red-100 transition-all text-left">
                  <i className="bi bi-exclamation-triangle-fill text-red-500 text-2xl"></i>
                  <div>
                    <p className="text-xs font-bold text-red-500 uppercase tracking-wide">{t('overdue')}</p>
                    <p className="text-2xl font-extrabold text-red-600 leading-none">{overdueCount}<span className="text-sm font-bold ml-1">{t('overdue_count')}</span></p>
                  </div>
                </button>
              )}
              {todayCount > 0 && (
                <button onClick={() => { setFilterDue('today'); setFilterStatus(''); }}
                  className="flex items-center gap-3 bg-orange-50 border-2 border-orange-200 rounded-xl px-5 py-3 hover:bg-orange-100 transition-all text-left">
                  <i className="bi bi-clock-fill text-orange-500 text-2xl"></i>
                  <div>
                    <p className="text-xs font-bold text-orange-500 uppercase tracking-wide">{t('due_today')}</p>
                    <p className="text-2xl font-extrabold text-orange-600 leading-none">{todayCount}<span className="text-sm font-bold ml-1">{t('today_count')}</span></p>
                  </div>
                </button>
              )}
            </div>
          )}
          {!isLoadingTasks && overdueCount === 0 && todayCount === 0 && tasks.length > 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-green-600">
              <i className="bi bi-check-circle-fill text-lg"></i>
              <span className="text-sm font-bold">{t('no_overdue')}</span>
            </div>
          )}

          {/* 検索・フィルタ */}
          <div className="bg-slate-50 p-4 rounded-xl flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_keyword')}</label>
              <div className="relative">
                <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
                <input type="text" value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)}
                  placeholder={t('filter_keyword_placeholder')}
                  className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_category')}</label>
              <select value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[110px] bg-white cursor-pointer">
                <option value="">{t('filter_all')}</option>
                {taskCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[110px] bg-white cursor-pointer">
                <option value="NOT_DONE">{t('filter_not_done')}</option>
                <option value="">{t('filter_all')}</option>
                <option value="PENDING">{t('status_pending')}</option>
                <option value="IN_PROGRESS">{t('status_in_progress')}</option>
                <option value="DONE">{t('status_done')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_priority')}</label>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[100px] bg-white cursor-pointer">
                <option value="">{t('filter_all')}</option>
                <option value="HIGH">{t('priority_high')}</option>
                <option value="MEDIUM">{t('priority_medium')}</option>
                <option value="LOW">{t('priority_low')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_assignee')}</label>
              <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
                <option value="">{t('filter_all')}</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.lastNameJa} {emp.firstNameJa}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_due')}</label>
              <select value={filterDue} onChange={e => setFilterDue(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
                <option value="">{t('filter_all')}</option>
                <option value="today">{t('filter_due_today')}</option>
                <option value="overdue">{t('filter_due_overdue')}</option>
              </select>
            </div>
            {/* マイタスク */}
            <button
              onClick={() => setFilterMyTasks(!filterMyTasks)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
                filterMyTasks ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
              }`}
            >
              <i className={`bi ${filterMyTasks ? 'bi-person-check-fill' : 'bi-person'}`}></i>
              {t('my_tasks')}
            </button>
            {hasFilter && (
              <button
                onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setFilterDue(''); setFilterKeyword(''); setFilterCategoryId(''); setFilterMyTasks(false); }}
                className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 pb-0.5">
                <i className="bi bi-x-circle"></i> {t('btn_reset')}
              </button>
            )}
          </div>

          {/* タスクテーブル */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {isLoadingTasks ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            ) : displayTasks.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <i className="bi bi-check2-all text-4xl mb-3 block"></i>
                <p className="text-sm">{t('empty_tasks')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-16 whitespace-nowrap">{t('col_priority')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('col_task')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">{t('col_type')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('col_related')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('col_assignee')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-28 whitespace-nowrap">{t('col_due_date')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-24 whitespace-nowrap">{t('col_status')}</th>
                      <th className="px-4 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTasks.map(task => {
                      const pcfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
                      const scfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
                      const tc = task.taskCategory;
                      const dueDate = new Date(task.dueDate); dueDate.setHours(0, 0, 0, 0);
                      const isOverdue = task.status !== 'DONE' && dueDate < today;
                      const isDueToday = task.status !== 'DONE' && dueDate.getTime() === today.getTime();

                      return (
                        <tr key={task.id} onClick={() => setDetailTask(task)} className={`border-b transition-colors group cursor-pointer ${
                          isOverdue ? 'bg-red-50 border-red-100 hover:bg-red-100'
                          : isDueToday ? 'bg-orange-50 border-orange-100 hover:bg-orange-100'
                          : 'border-slate-50 hover:bg-slate-50'
                        }`}>
                          <td className={`px-4 py-3 border-l-4 ${isOverdue ? 'border-red-500' : isDueToday ? 'border-orange-400' : 'border-transparent'}`}>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pcfg.cls}`}>{pcfg.label}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[240px]">
                            <p className={`font-medium truncate ${task.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                              {task.title}
                            </p>
                            {task.description && <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>}
                          </td>
                          <td className="px-4 py-3">
                            {tc ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.colorCls || 'bg-slate-100 text-slate-600'}`}>
                                {tc.icon && <i className={`bi ${tc.icon} mr-0.5`}></i>}{tc.name}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {task.customer ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <i className="bi bi-person-lines-fill text-blue-400 text-xs"></i>
                                <Link href={`/customers/${task.customer.id}`} className="text-blue-600 hover:underline text-xs">{task.customer.name}</Link>
                              </div>
                            ) : task.branch ? (
                              <div className="flex items-center gap-1">
                                <i className="bi bi-building text-emerald-500 text-xs"></i>
                                <span className="text-xs text-emerald-700">{task.branch.nameJa}</span>
                              </div>
                            ) : task.distributor ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <i className="bi bi-bicycle text-emerald-500 text-xs"></i>
                                <Link href={`/distributors/${task.distributor.id}`} className="text-emerald-700 hover:underline text-xs">
                                  {task.distributor.name}
                                </Link>
                                <span className="text-slate-400 text-[10px]">({task.distributor.staffId})</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] truncate">
                            {renderAssignees(task)}
                          </td>
                          <td className="px-4 py-3">
                            {isOverdue ? (
                              <div>
                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-red-200 whitespace-nowrap">
                                  <i className="bi bi-exclamation-triangle-fill"></i> {t('overdue_badge')}
                                </span>
                                <p className="text-xs text-red-600 font-bold mt-0.5 whitespace-nowrap">{formatDueDate(task.dueDate)}</p>
                              </div>
                            ) : isDueToday ? (
                              <div>
                                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-orange-200 whitespace-nowrap">
                                  <i className="bi bi-clock-fill"></i> {t('today_badge')}
                                </span>
                                <p className="text-xs text-orange-600 font-bold mt-0.5 whitespace-nowrap">{formatDueDate(task.dueDate)}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600">{formatDueDate(task.dueDate)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${scfg.cls}`}>{scfg.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              {task.status !== 'DONE' && (
                                <button onClick={() => handleQuickDone(task.id)} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors" title={t('btn_mark_done')}>
                                  <i className="bi bi-check-lg text-base"></i>
                                </button>
                              )}
                              <button onClick={() => openTaskEdit(task)} className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors" title={t('edit')}>
                                <i className="bi bi-pencil text-base"></i>
                              </button>
                              <button onClick={() => handleDeleteTask(task.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title={t('delete')}>
                                <i className="bi bi-trash text-base"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 定期タスク設定タブ ==================== */}
      {activeTab === 'templates' && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <i className="bi bi-arrow-repeat text-4xl mb-3 block"></i>
              <p className="text-sm">{t('empty_templates')}</p>
              <button onClick={openTmplCreate} className="mt-3 text-indigo-600 text-sm font-bold hover:underline">
                <i className="bi bi-plus-lg mr-1"></i>{t('btn_create_template_link')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('col_title')}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">{t('col_type')}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('col_cycle')}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">{t('col_priority')}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">{t('col_assignee')}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">{t('col_completion_rule')}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">{t('col_active')}</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('col_last_generated')}</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(tmpl => {
                    const tc = tmpl.taskCategory;
                    const pcfg = PRIORITY_CONFIG[tmpl.priority] || PRIORITY_CONFIG.MEDIUM;
                    const cnt = countAssignees(tmpl);
                    return (
                      <tr key={tmpl.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3">
                          <p className={`font-medium ${tmpl.isActive ? 'text-slate-800' : 'text-slate-400'}`}>{tmpl.title}</p>
                          {tmpl.description && <p className="text-xs text-slate-400 truncate mt-0.5 max-w-[200px]">{tmpl.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {tc && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.colorCls || 'bg-slate-100 text-slate-600'}`}>
                              {tc.icon && <i className={`bi ${tc.icon} mr-0.5`}></i>}{tc.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {formatRecurrence(tmpl.recurrenceType, tmpl.recurrenceValue, t)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pcfg.cls}`}>{pcfg.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 text-center">
                          {cnt > 0 ? (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">{cnt}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {tmpl.completionRule === 'SHARED' ? t('completion_shared') : t('completion_individual')}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleToggleActive(tmpl)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${tmpl.isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tmpl.isActive ? 'left-5' : 'left-0.5'}`}></span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {tmpl.lastGeneratedAt ? new Date(tmpl.lastGeneratedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : t('not_executed')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openTmplEdit(tmpl)} className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors" title={t('edit')}>
                              <i className="bi bi-pencil text-base"></i>
                            </button>
                            <button onClick={() => handleDeleteTmpl(tmpl.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title={t('delete')}>
                              <i className="bi bi-trash text-base"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

        </div>{/* /p-5 */}
      </div>{/* /bg-white card */}

      {/* ==================== タスク詳細モーダル（読み取り専用） ==================== */}
      {detailTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailTask(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* ヘッダー */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  {PRIORITY_CONFIG[detailTask.priority] && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_CONFIG[detailTask.priority].cls}`}>
                      {PRIORITY_CONFIG[detailTask.priority].label}
                    </span>
                  )}
                  {STATUS_CONFIG[detailTask.status] && (
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_CONFIG[detailTask.status].cls}`}>
                      {STATUS_CONFIG[detailTask.status].label}
                    </span>
                  )}
                </div>
                <h2 className="font-bold text-slate-800 text-lg truncate">{detailTask.title}</h2>
              </div>
              <button onClick={() => setDetailTask(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 詳細（description） */}
              {detailTask.description && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                    <i className="bi bi-text-left"></i> {t('detail_description')}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{detailTask.description}</p>
                </div>
              )}

              {/* 情報グリッド */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {/* 種類 */}
                    <tr className="border-b border-slate-50">
                      <td className="px-4 py-2.5 text-xs font-bold text-slate-500 bg-slate-50 w-28">{t('detail_category')}</td>
                      <td className="px-4 py-2.5">
                        {detailTask.taskCategory ? (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${detailTask.taskCategory.colorCls || 'bg-slate-100 text-slate-600'}`}>
                            {detailTask.taskCategory.icon && <i className={`bi ${detailTask.taskCategory.icon} mr-0.5`}></i>}
                            {detailTask.taskCategory.name}
                          </span>
                        ) : <span className="text-slate-400 text-xs">--</span>}
                      </td>
                    </tr>
                    {/* 期限 */}
                    <tr className="border-b border-slate-50">
                      <td className="px-4 py-2.5 text-xs font-bold text-slate-500 bg-slate-50">{t('detail_due_date')}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-700">{formatDueDate(detailTask.dueDate)}</td>
                    </tr>
                    {/* 関連先 */}
                    <tr className="border-b border-slate-50">
                      <td className="px-4 py-2.5 text-xs font-bold text-slate-500 bg-slate-50">{t('detail_related')}</td>
                      <td className="px-4 py-2.5">
                        {detailTask.customer ? (
                          <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1">
                            <i className="bi bi-person-lines-fill text-blue-400 text-xs"></i>
                            <Link href={`/customers/${detailTask.customer.id}`} className="text-blue-600 hover:underline text-sm">{detailTask.customer.name}</Link>
                          </span>
                        ) : detailTask.distributor ? (
                          <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1">
                            <i className="bi bi-bicycle text-emerald-500 text-xs"></i>
                            <Link href={`/distributors/${detailTask.distributor.id}`} className="text-emerald-700 hover:underline text-sm">
                              {detailTask.distributor.name}
                            </Link>
                            <span className="text-slate-400 text-[11px]">({detailTask.distributor.staffId})</span>
                          </span>
                        ) : detailTask.branch ? (
                          <span className="inline-flex items-center gap-1">
                            <i className="bi bi-building text-emerald-500 text-xs"></i>
                            <span className="text-sm text-emerald-700">{detailTask.branch.nameJa}</span>
                          </span>
                        ) : <span className="text-slate-400 text-xs">--</span>}
                      </td>
                    </tr>
                    {/* 担当者 */}
                    <tr className="border-b border-slate-50">
                      <td className="px-4 py-2.5 text-xs font-bold text-slate-500 bg-slate-50">{t('detail_assignees')}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        {detailTask.assignees && detailTask.assignees.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {detailTask.assignees.map((a, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">
                                {a.employee && <><i className="bi bi-person-fill text-slate-400"></i>{a.employee.lastNameJa} {a.employee.firstNameJa}</>}
                                {a.department && <><i className="bi bi-diagram-3-fill text-slate-400"></i>{a.department.name}</>}
                                {a.branch && <><i className="bi bi-building text-slate-400"></i>{a.branch.nameJa}</>}
                              </span>
                            ))}
                          </div>
                        ) : detailTask.assignee ? (
                          <span className="text-sm">{detailTask.assignee.lastNameJa} {detailTask.assignee.firstNameJa}</span>
                        ) : <span className="text-slate-400 text-xs">--</span>}
                      </td>
                    </tr>
                    {/* 作成者 */}
                    <tr>
                      <td className="px-4 py-2.5 text-xs font-bold text-slate-500 bg-slate-50">{t('detail_created_by')}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-700">
                        {detailTask.createdBy ? `${detailTask.createdBy.lastNameJa} ${detailTask.createdBy.firstNameJa}` : <span className="text-slate-400 text-xs">--</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 生成元セクション */}
              {(detailTask.template || detailTask.complaint || detailTask.inspectionFollowUp || detailTask.inspectionFeedback || detailTask.createdBy) && (
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                    <i className="bi bi-link-45deg"></i> {t('detail_source')}
                  </p>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-2">
                    {detailTask.template && (
                      <div className="flex items-center gap-2">
                        <i className="bi bi-arrow-repeat text-indigo-500"></i>
                        <span className="text-sm text-slate-700">
                          <span className="font-bold text-indigo-600">{t('source_template')}</span>: {detailTask.template.title}
                        </span>
                      </div>
                    )}
                    {detailTask.complaint && (
                      <div className="flex items-start gap-2">
                        <i className="bi bi-exclamation-circle text-red-500 mt-0.5"></i>
                        <div>
                          <span className="text-sm text-slate-700">
                            <span className="font-bold text-red-600">{t('source_complaint')}</span>: {detailTask.complaint.title}
                          </span>
                          <div className="mt-1">
                            <Link href={`/quality/complaints?id=${detailTask.complaint.id}`} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                              {t('detail_view_link')} <i className="bi bi-arrow-right"></i>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                    {detailTask.inspectionFollowUp && (
                      <div className="flex items-start gap-2">
                        <i className="bi bi-search text-amber-500 mt-0.5"></i>
                        <div>
                          <span className="text-sm text-slate-700">
                            <span className="font-bold text-amber-600">{t('source_inspection_followup')}</span>
                          </span>
                          {detailTask.inspectionFollowUp.schedule && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(detailTask.inspectionFollowUp.schedule.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                              {detailTask.inspectionFollowUp.schedule.distributor && ` ${detailTask.inspectionFollowUp.schedule.distributor.name}`}
                            </p>
                          )}
                          <div className="mt-1">
                            <Link href={`/inspections/${detailTask.inspectionFollowUp.id}`} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                              {t('detail_view_link')} <i className="bi bi-arrow-right"></i>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                    {detailTask.inspectionFeedback && (
                      <div className="flex items-start gap-2">
                        <i className="bi bi-chat-dots text-purple-500 mt-0.5"></i>
                        <div>
                          <span className="text-sm text-slate-700">
                            <span className="font-bold text-purple-600">{t('source_inspection_feedback')}</span>
                          </span>
                          {detailTask.inspectionFeedback.schedule && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(detailTask.inspectionFeedback.schedule.date).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                              {detailTask.inspectionFeedback.schedule.distributor && ` ${detailTask.inspectionFeedback.schedule.distributor.name}`}
                            </p>
                          )}
                          <div className="mt-1">
                            <Link href={`/inspections/${detailTask.inspectionFeedback.id}`} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                              {t('detail_view_link')} <i className="bi bi-arrow-right"></i>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                    {!detailTask.template && !detailTask.complaint && !detailTask.inspectionFollowUp && !detailTask.inspectionFeedback && detailTask.createdBy && (
                      <div className="flex items-center gap-2">
                        <i className="bi bi-person-fill text-slate-500"></i>
                        <span className="text-sm text-slate-700">
                          <span className="font-bold text-slate-600">{t('source_manual')}</span>: {detailTask.createdBy.lastNameJa} {detailTask.createdBy.firstNameJa}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex items-center gap-3 pt-2">
                {detailTask.status !== 'DONE' && (
                  <button
                    onClick={async () => {
                      await handleQuickDone(detailTask.id);
                      setDetailTask(prev => prev ? { ...prev, status: 'DONE' } : null);
                    }}
                    className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                    <i className="bi bi-check-lg"></i> {t('btn_complete')}
                  </button>
                )}
                <button
                  onClick={() => { openTaskEdit(detailTask); setDetailTask(null); }}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                  <i className="bi bi-pencil"></i> {t('btn_edit')}
                </button>
                <button
                  onClick={async () => { await handleDeleteTask(detailTask.id); setDetailTask(null); }}
                  className="flex items-center gap-1.5 text-red-500 hover:bg-red-50 text-sm font-bold px-4 py-2 rounded-lg border border-red-200 transition-colors">
                  <i className="bi bi-trash"></i> {t('delete')}
                </button>
                <div className="flex-1"></div>
                <button onClick={() => setDetailTask(null)}
                  className="text-slate-600 text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  {t('btn_close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== タスク編集モーダル ==================== */}
      {isTaskModalOpen && editingTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsTaskModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800 text-lg">{t('modal_edit_task')}</h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleTaskSubmit} className="p-6 space-y-4">
              {/* タイトル */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_title')} <span className="text-red-500">*</span></label>
                <input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              {/* 詳細 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_detail')}</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              {/* カテゴリ */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_task_type')}</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button"
                    onClick={() => setTaskForm(f => ({ ...f, categoryId: '', customerId: '', distributorId: '', branchId: '' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      !taskForm.categoryId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}>
                    {t('label_no_type')}
                  </button>
                  {taskCategories.map(cat => (
                    <button key={cat.id} type="button"
                      onClick={() => setTaskForm(f => ({ ...f, categoryId: cat.id.toString(), customerId: '', distributorId: '', branchId: '' }))}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        taskForm.categoryId === cat.id.toString()
                          ? (cat.colorCls || 'bg-indigo-600 text-white') + ' border-current ring-2 ring-indigo-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}>
                      {cat.icon && <i className={`bi ${cat.icon}`}></i>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* 期限・優先度 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_due_date')} <span className="text-red-500">*</span></label>
                  <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                  <div className="mt-2 flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={taskForm.isAllDay}
                        onChange={e => setTaskForm(f => ({ ...f, isAllDay: e.target.checked, dueTime: e.target.checked ? '' : f.dueTime }))}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-xs text-slate-600">{t('label_all_day')}</span>
                    </label>
                    {!taskForm.isAllDay && (
                      <input type="time" value={taskForm.dueTime}
                        onChange={e => setTaskForm(f => ({ ...f, dueTime: e.target.value }))}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_priority')}</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="HIGH">{t('priority_high')}</option><option value="MEDIUM">{t('priority_medium')}</option><option value="LOW">{t('priority_low')}</option>
                  </select>
                </div>
              </div>
              {/* ステータス */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_status')}</label>
                <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="PENDING">{t('status_pending')}</option><option value="IN_PROGRESS">{t('status_in_progress')}</option><option value="DONE">{t('status_done')}</option>
                </select>
              </div>
              {/* 関連先（カテゴリに応じて変化）*/}
              {(() => {
                const catCode = getCategoryCode(taskForm.categoryId);
                return (
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
                    <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      <i className="bi bi-link-45deg"></i> {t('label_related')}
                    </p>
                    {catCode === 'SALES' && (
                      <AutocompleteInput
                        value={taskForm.customerId} label={t('label_customer')} placeholder={t('customer_placeholder')}
                        fetchUrl={q => `/api/customers?search=${encodeURIComponent(q)}`}
                        onSelect={(id, name) => { setTaskForm(f => ({ ...f, customerId: id })); setFormCustomerName(name); }}
                        onClear={() => { setTaskForm(f => ({ ...f, customerId: '' })); setFormCustomerName(''); }}
                        displayText={formCustomerName}
                      />
                    )}
                    {catCode === 'FIELD' && (
                      <AutocompleteInput
                        value={taskForm.distributorId} label={t('label_distributor')} placeholder={t('distributor_placeholder')}
                        fetchUrl={q => `/api/distributors?search=${encodeURIComponent(q)}`}
                        onSelect={(id, name) => { setTaskForm(f => ({ ...f, distributorId: id })); setFormDistributorName(name); }}
                        onClear={() => { setTaskForm(f => ({ ...f, distributorId: '' })); setFormDistributorName(''); }}
                        displayText={formDistributorName}
                      />
                    )}
                    {!catCode && (
                      <>
                        <AutocompleteInput
                          value={taskForm.customerId} label={t('label_customer')} placeholder={t('customer_placeholder')}
                          fetchUrl={q => `/api/customers?search=${encodeURIComponent(q)}`}
                          onSelect={(id, name) => { setTaskForm(f => ({ ...f, customerId: id, distributorId: '' })); setFormCustomerName(name); setFormDistributorName(''); }}
                          onClear={() => { setTaskForm(f => ({ ...f, customerId: '' })); setFormCustomerName(''); }}
                          displayText={formCustomerName}
                        />
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <div className="flex-1 border-t border-slate-200"></div><span>{t('label_or')}</span><div className="flex-1 border-t border-slate-200"></div>
                        </div>
                        <AutocompleteInput
                          value={taskForm.distributorId} label={t('label_distributor')} placeholder={t('distributor_placeholder')}
                          fetchUrl={q => `/api/distributors?search=${encodeURIComponent(q)}`}
                          onSelect={(id, name) => { setTaskForm(f => ({ ...f, distributorId: id, customerId: '' })); setFormDistributorName(name); setFormCustomerName(''); }}
                          onClear={() => { setTaskForm(f => ({ ...f, distributorId: '' })); setFormDistributorName(''); }}
                          displayText={formDistributorName}
                        />
                      </>
                    )}
                    {catCode === 'ADMIN' && (
                      <p className="text-xs text-slate-400 italic">{t('label_admin_no_related')}</p>
                    )}
                  </div>
                );
              })()}
              {/* 担当者マルチセレクト */}
              <AssigneeMultiSelect selected={taskAssignees} onChange={setTaskAssignees} />
              {/* ボタン */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsTaskModalOpen(false)}
                  className="text-slate-600 text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">{t('cancel')}</button>
                <button type="submit" disabled={isSubmittingTask}
                  className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {isSubmittingTask ? t('saving') : t('btn_update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== テンプレート作成/編集モーダル ==================== */}
      {isTmplModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsTmplModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800 text-lg">{editingTmpl ? t('modal_edit_template') : t('modal_create_template')}</h2>
              <button onClick={() => setIsTmplModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleTmplSubmit} className="p-6 space-y-4">
              {/* タスク種類 — 一番上にボタン表示 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">{t('label_task_type')} <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {taskCategories.map(cat => (
                    <button key={cat.id} type="button"
                      onClick={() => setTmplForm(f => ({ ...f, categoryId: cat.id.toString(), customerId: '', distributorId: '', branchId: '' }))}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                        tmplForm.categoryId === cat.id.toString()
                          ? (cat.colorCls || 'bg-indigo-100 text-indigo-700') + ' border-current shadow-sm'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}>
                      {cat.icon && <i className={`bi ${cat.icon}`}></i>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* タイトル */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_title')} <span className="text-red-500">*</span></label>
                <input type="text" value={tmplForm.title} onChange={e => setTmplForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              {/* 詳細 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_description')}</label>
                <textarea value={tmplForm.description} onChange={e => setTmplForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              {/* 優先度 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_priority')}</label>
                <select value={tmplForm.priority} onChange={e => setTmplForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="HIGH">{t('priority_high')}</option><option value="MEDIUM">{t('priority_medium')}</option><option value="LOW">{t('priority_low')}</option>
                </select>
              </div>
              {/* 関連先（カテゴリ依存） */}
              {(() => {
                const catCode = getCategoryCode(tmplForm.categoryId);
                return (
                  <>
                    {catCode === 'SALES' && (
                      <AutocompleteInput
                        value={tmplForm.customerId} label={t('label_customer')} placeholder={t('customer_placeholder')}
                        fetchUrl={q => `/api/customers?search=${encodeURIComponent(q)}`}
                        onSelect={(id, name) => { setTmplForm(f => ({ ...f, customerId: id })); setTmplCustomerName(name); }}
                        onClear={() => { setTmplForm(f => ({ ...f, customerId: '' })); setTmplCustomerName(''); }}
                        displayText={tmplCustomerName}
                      />
                    )}
                    {catCode === 'FIELD' && (
                      <AutocompleteInput
                        value={tmplForm.distributorId} label={t('label_distributor')} placeholder={t('distributor_placeholder')}
                        fetchUrl={q => `/api/distributors?search=${encodeURIComponent(q)}`}
                        onSelect={(id, name) => { setTmplForm(f => ({ ...f, distributorId: id })); setTmplDistributorName(name); }}
                        onClear={() => { setTmplForm(f => ({ ...f, distributorId: '' })); setTmplDistributorName(''); }}
                        displayText={tmplDistributorName}
                      />
                    )}
                  </>
                );
              })()}

              {/* サイクル設定 */}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <i className="bi bi-arrow-repeat"></i> {t('cycle_settings')}
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_recurrence_type')}</label>
                  <select value={tmplForm.recurrenceType} onChange={e => setTmplForm(f => ({ ...f, recurrenceType: e.target.value, weeklyDays: [], monthlyDay: '1', yearlyMonth: '01', yearlyDay: '01' }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="ONCE">{t('recurrence_once')}</option>
                    <option value="DAILY">{t('recurrence_daily')}</option>
                    <option value="WEEKLY">{t('recurrence_weekly')}</option>
                    <option value="MONTHLY">{t('recurrence_monthly')}</option>
                    <option value="YEARLY">{t('recurrence_yearly')}</option>
                  </select>
                </div>
                {/* WEEKLY: 曜日チェックボックス */}
                {tmplForm.recurrenceType === 'WEEKLY' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('label_select_days')}</label>
                    <div className="flex gap-1.5">
                      {DAY_LABELS.map((label, idx) => (
                        <button key={idx} type="button"
                          onClick={() => {
                            setTmplForm(f => ({
                              ...f,
                              weeklyDays: f.weeklyDays.includes(idx)
                                ? f.weeklyDays.filter(d => d !== idx)
                                : [...f.weeklyDays, idx],
                            }));
                          }}
                          className={`w-9 h-9 rounded-full text-xs font-bold border transition-all ${
                            tmplForm.weeklyDays.includes(idx)
                              ? idx === 0 ? 'bg-red-500 text-white border-red-500' : idx === 6 ? 'bg-blue-500 text-white border-blue-500' : 'bg-indigo-600 text-white border-indigo-600'
                              : idx === 0 ? 'text-red-500 border-red-200 hover:border-red-400' : idx === 6 ? 'text-blue-500 border-blue-200 hover:border-blue-400' : 'text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* MONTHLY: 日付選択 */}
                {tmplForm.recurrenceType === 'MONTHLY' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_monthly_day')}</label>
                    <select value={tmplForm.monthlyDay} onChange={e => setTmplForm(f => ({ ...f, monthlyDay: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d.toString()}>{d}{t('day_suffix')}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* YEARLY: 月日選択 */}
                {tmplForm.recurrenceType === 'YEARLY' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_month')}</label>
                      <select value={tmplForm.yearlyMonth} onChange={e => setTmplForm(f => ({ ...f, yearlyMonth: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={String(m).padStart(2, '0')}>{m}{t('month_suffix')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('label_day')}</label>
                      <select value={tmplForm.yearlyDay} onChange={e => setTmplForm(f => ({ ...f, yearlyDay: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={String(d).padStart(2, '0')}>{d}{t('day_suffix')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 期限時刻設定 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  <i className="bi bi-clock mr-1"></i>{t('label_due_time')}
                </label>
                <div className="flex items-center gap-3">
                  <input type="time" value={tmplForm.dueTime}
                    onChange={e => setTmplForm(f => ({ ...f, dueTime: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  {tmplForm.dueTime && (
                    <button type="button" onClick={() => setTmplForm(f => ({ ...f, dueTime: '' }))}
                      className="text-xs text-slate-400 hover:text-slate-600">
                      <i className="bi bi-x-circle mr-0.5"></i>{t('label_due_time_clear')}
                    </button>
                  )}
                  <span className="text-xs text-slate-400">{t('label_due_time_note')}</span>
                </div>
              </div>

              {/* 担当者マルチセレクト */}
              <AssigneeMultiSelect selected={tmplAssignees} onChange={setTmplAssignees} />

              {/* 完了条件（担当者2名以上の場合） */}
              {tmplAssignees.length >= 2 && (
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                  <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                    <i className="bi bi-check2-square"></i> {t('label_completion_rule')}
                  </p>
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      tmplForm.completionRule === 'SHARED' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                      <input type="radio" name="completionRule" value="SHARED"
                        checked={tmplForm.completionRule === 'SHARED'}
                        onChange={() => setTmplForm(f => ({ ...f, completionRule: 'SHARED' }))}
                        className="hidden" />
                      <i className={`bi bi-people-fill ${tmplForm.completionRule === 'SHARED' ? 'text-indigo-500' : 'text-slate-400'}`}></i>
                      <div>
                        <p className="font-bold">{t('label_shared_task')}</p>
                        <p className="text-[11px] opacity-70">{t('label_shared_desc')}</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                      tmplForm.completionRule === 'INDIVIDUAL' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                      <input type="radio" name="completionRule" value="INDIVIDUAL"
                        checked={tmplForm.completionRule === 'INDIVIDUAL'}
                        onChange={() => setTmplForm(f => ({ ...f, completionRule: 'INDIVIDUAL' }))}
                        className="hidden" />
                      <i className={`bi bi-person-fill ${tmplForm.completionRule === 'INDIVIDUAL' ? 'text-indigo-500' : 'text-slate-400'}`}></i>
                      <div>
                        <p className="font-bold">{t('label_individual_task')}</p>
                        <p className="text-[11px] opacity-70">{t('label_individual_desc')}</p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* 有効/無効 */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">{t('label_enable_template')}</span>
                <button type="button" onClick={() => setTmplForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${tmplForm.isActive ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${tmplForm.isActive ? 'left-6' : 'left-0.5'}`}></span>
                </button>
              </div>

              {/* ボタン */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsTmplModalOpen(false)}
                  className="text-slate-600 text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">{t('cancel')}</button>
                <button type="submit" disabled={isSubmittingTmpl}
                  className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {isSubmittingTmpl ? t('saving') : editingTmpl ? t('btn_update') : t('btn_create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
