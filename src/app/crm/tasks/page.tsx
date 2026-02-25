'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useNotification } from '@/components/ui/NotificationProvider';

type Employee = { id: number; lastNameJa: string; firstNameJa: string };
type Customer = { id: number; name: string };
type Distributor = { id: number; name: string; staffId: string };

type Task = {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  priority: string;
  status: string;
  customer: Customer | null;
  distributor: Distributor | null;
  assignee: Employee | null;
  createdBy: Employee | null;
};

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  HIGH:   { label: '高', cls: 'bg-red-100 text-red-700 border border-red-200' },
  MEDIUM: { label: '中', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  LOW:    { label: '低', cls: 'bg-green-100 text-green-700 border border-green-200' },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:     { label: '未着手',  cls: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: '進行中',  cls: 'bg-blue-100 text-blue-700' },
  DONE:        { label: '完了',    cls: 'bg-green-100 text-green-700' },
};

const initialForm = {
  title: '',
  description: '',
  dueDate: new Date().toISOString().slice(0, 10),
  priority: 'MEDIUM',
  status: 'PENDING',
  customerId: '' as string,
  distributorId: '' as string,
  assigneeId: '' as string,
};

// ---- オートコンプリートコンポーネント ----
function AutocompleteInput({
  value,
  label,
  placeholder,
  fetchUrl,
  onSelect,
  onClear,
  displayText,
}: {
  value: string;
  label: string;
  placeholder: string;
  fetchUrl: (q: string) => string;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
  displayText: string; // 選択済み表示テキスト
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<{ id: number; name: string; staffId?: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setCandidates([]);
      setIsOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(fetchUrl(q));
        if (res.ok) {
          const data = await res.json();
          setCandidates(Array.isArray(data) ? data : []);
          setIsOpen(true);
        }
      } finally {
        setIsLoading(false);
      }
    }, 250);
  };

  const handleSelect = (item: { id: number; name: string; staffId?: string }) => {
    onSelect(item.id.toString(), item.name);
    setQuery('');
    setCandidates([]);
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery('');
    setCandidates([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      {value ? (
        // 選択済みの表示
        <div className="flex items-center gap-2 border border-indigo-300 bg-indigo-50 rounded-lg px-3 py-2 text-sm">
          <i className="bi bi-check-circle-fill text-indigo-500 text-xs"></i>
          <span className="flex-1 truncate text-indigo-700 font-medium">{displayText}</span>
          <button type="button" onClick={handleClear} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
            <i className="bi bi-x-lg text-xs"></i>
          </button>
        </div>
      ) : (
        // 未選択: 入力欄
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder={placeholder}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
          />
          {isLoading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {isOpen && candidates.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {candidates.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => handleSelect(item)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  <span className="font-medium text-slate-800">{item.name}</span>
                  {item.staffId && <span className="ml-2 text-xs text-slate-400">{item.staffId}</span>}
                </button>
              ))}
            </div>
          )}
          {isOpen && query.trim() && candidates.length === 0 && !isLoading && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
              <p className="px-3 py-2 text-sm text-slate-400">該当なし</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- メインページ ----
export default function CrmTasksPage() {
  const { showToast, showConfirm } = useNotification();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // フィルタ
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDue, setFilterDue] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');

  // モーダル
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState(initialForm);
  // オートコンプリート表示用テキスト
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formDistributorName, setFormDistributorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterAssignee) params.set('assigneeId', filterAssignee);
    if (filterDue) params.set('dueDate', filterDue);
    const res = await fetch(`/api/tasks?${params.toString()}`);
    if (res.ok) {
      let data: Task[] = await res.json();
      if (filterPriority) data = data.filter(t => t.priority === filterPriority);
      setTasks(data);
    }
    setIsLoading(false);
  }, [filterStatus, filterAssignee, filterPriority, filterDue]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    fetch('/api/employees').then(r => r.ok ? r.json() : []).then(data => {
      setEmployees(Array.isArray(data) ? data.filter((e: any) => e.isActive) : []);
    });
  }, []);

  const openCreate = () => {
    setEditingTask(null);
    setForm(initialForm);
    setFormCustomerName('');
    setFormDistributorName('');
    setIsModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate.slice(0, 10),
      priority: task.priority,
      status: task.status,
      customerId: task.customer?.id.toString() || '',
      distributorId: task.distributor?.id.toString() || '',
      assigneeId: task.assignee?.id.toString() || '',
    });
    setFormCustomerName(task.customer?.name || '');
    setFormDistributorName(
      task.distributor ? `${task.distributor.name} (${task.distributor.staffId})` : ''
    );
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const method = editingTask ? 'PUT' : 'POST';
    const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setIsModalOpen(false);
      fetchTasks();
    }
    setIsSubmitting(false);
  };

  const handleQuickDone = async (taskId: number) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    });
    if (res.ok) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'DONE' } : t));
  };

  const handleDelete = async (taskId: number) => {
    if (!await showConfirm('このタスクを削除しますか？', { variant: 'danger', confirmLabel: '削除する' })) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 期限超過・本日期限のカウント（フィルタ前の全件から）
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

  // キーワードフィルタ（クライアントサイド）
  const kw = filterKeyword.toLowerCase();
  const displayTasks = kw
    ? tasks.filter(t =>
        t.title.toLowerCase().includes(kw) ||
        (t.description?.toLowerCase().includes(kw)) ||
        (t.customer?.name.toLowerCase().includes(kw)) ||
        (t.distributor?.name.toLowerCase().includes(kw)) ||
        (t.distributor?.staffId.toLowerCase().includes(kw)) ||
        (t.assignee && `${t.assignee.lastNameJa}${t.assignee.firstNameJa}`.toLowerCase().includes(kw))
      )
    : tasks;

  const hasFilter = filterStatus || filterPriority || filterAssignee || filterDue || filterKeyword;

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-10 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-check2-all text-indigo-600"></i> タスク管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">CRM タスクの一覧・管理</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <i className="bi bi-plus-lg"></i> 新規タスク
        </button>
      </div>

      {/* 期限アラートカード */}
      {!isLoading && (overdueCount > 0 || todayCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueCount > 0 && (
            <button
              onClick={() => { setFilterDue('overdue'); setFilterStatus(''); setFilterKeyword(''); }}
              className="flex items-center gap-3 bg-red-50 border-2 border-red-200 rounded-xl px-5 py-3 hover:bg-red-100 hover:border-red-300 transition-all text-left"
            >
              <i className="bi bi-exclamation-triangle-fill text-red-500 text-2xl"></i>
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-wide">期限超過</p>
                <p className="text-2xl font-extrabold text-red-600 leading-none">
                  {overdueCount}<span className="text-sm font-bold ml-1">件</span>
                </p>
              </div>
              <i className="bi bi-arrow-right text-red-300 ml-1"></i>
            </button>
          )}
          {todayCount > 0 && (
            <button
              onClick={() => { setFilterDue('today'); setFilterStatus(''); setFilterKeyword(''); }}
              className="flex items-center gap-3 bg-orange-50 border-2 border-orange-200 rounded-xl px-5 py-3 hover:bg-orange-100 hover:border-orange-300 transition-all text-left"
            >
              <i className="bi bi-clock-fill text-orange-500 text-2xl"></i>
              <div>
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wide">本日期限</p>
                <p className="text-2xl font-extrabold text-orange-600 leading-none">
                  {todayCount}<span className="text-sm font-bold ml-1">件</span>
                </p>
              </div>
              <i className="bi bi-arrow-right text-orange-300 ml-1"></i>
            </button>
          )}
          {overdueCount === 0 && todayCount === 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-green-600">
              <i className="bi bi-check-circle-fill text-lg"></i>
              <span className="text-sm font-bold">期限切れタスクはありません</span>
            </div>
          )}
        </div>
      )}
      {!isLoading && overdueCount === 0 && todayCount === 0 && tasks.length > 0 && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-green-600">
          <i className="bi bi-check-circle-fill text-lg"></i>
          <span className="text-sm font-bold">期限超過・本日期限のタスクはありません</span>
        </div>
      )}

      {/* 検索・フィルタバー */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">キーワード検索</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              value={filterKeyword}
              onChange={e => setFilterKeyword(e.target.value)}
              placeholder="タスク名・顧客・配布員・担当者..."
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">ステータス</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer"
          >
            <option value="">すべて</option>
            <option value="PENDING">未着手</option>
            <option value="IN_PROGRESS">進行中</option>
            <option value="DONE">完了</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">優先度</label>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer"
          >
            <option value="">すべて</option>
            <option value="HIGH">高</option>
            <option value="MEDIUM">中</option>
            <option value="LOW">低</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">担当者</label>
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[130px] bg-white cursor-pointer"
          >
            <option value="">すべて</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.lastNameJa} {emp.firstNameJa}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">期限</label>
          <select
            value={filterDue}
            onChange={e => setFilterDue(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[130px] bg-white cursor-pointer"
          >
            <option value="">すべて</option>
            <option value="today">本日期限</option>
            <option value="overdue">期限超過</option>
          </select>
        </div>
        {hasFilter && (
          <button
            onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); setFilterDue(''); setFilterKeyword(''); }}
            className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 pb-2"
          >
            <i className="bi bi-x-circle"></i> リセット
          </button>
        )}
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <i className="bi bi-check2-all text-4xl mb-3 block"></i>
            <p className="text-sm">タスクがありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-12">優先度</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">タスク</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">関連先</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">担当者</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-24">期限</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">ステータス</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.map(task => {
                const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
                const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
                const dueDate = new Date(task.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const isOverdue = task.status !== 'DONE' && dueDate < today;
                const isDueToday = task.status !== 'DONE' && dueDate.getTime() === today.getTime();

                return (
                  <tr
                    key={task.id}
                    className={`border-b transition-colors group ${
                      isOverdue
                        ? 'bg-red-50 border-red-100 hover:bg-red-100'
                        : isDueToday
                        ? 'bg-orange-50 border-orange-100 hover:bg-orange-100'
                        : 'border-slate-50 hover:bg-slate-50'
                    }`}
                  >
                    <td className={`px-4 py-3 border-l-4 ${isOverdue ? 'border-red-500' : isDueToday ? 'border-orange-400' : 'border-transparent'}`}>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${priorityCfg.cls}`}>
                        {priorityCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <p className={`font-medium truncate ${task.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.customer ? (
                        <div className="flex items-center gap-1">
                          <i className="bi bi-person-lines-fill text-blue-400 text-xs"></i>
                          <Link href={`/customers/${task.customer.id}`} className="text-blue-600 hover:underline text-xs">
                            {task.customer.name}
                          </Link>
                        </div>
                      ) : task.distributor ? (
                        <div className="flex items-center gap-1">
                          <i className="bi bi-bicycle text-emerald-500 text-xs"></i>
                          <Link href={`/distributors/${task.distributor.id}`} className="text-emerald-700 hover:underline text-xs">
                            {task.distributor.name}
                          </Link>
                          <span className="text-slate-400 text-[10px]">({task.distributor.staffId})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {task.assignee ? `${task.assignee.lastNameJa} ${task.assignee.firstNameJa}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {isOverdue ? (
                        <div>
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-red-200">
                            <i className="bi bi-exclamation-triangle-fill"></i> 期限超過
                          </span>
                          <p className="text-xs text-red-600 font-bold mt-0.5">{new Date(task.dueDate).toLocaleDateString('ja-JP')}</p>
                        </div>
                      ) : isDueToday ? (
                        <div>
                          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-orange-200">
                            <i className="bi bi-clock-fill"></i> 本日期限
                          </span>
                          <p className="text-xs text-orange-600 font-bold mt-0.5">{new Date(task.dueDate).toLocaleDateString('ja-JP')}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">
                          {new Date(task.dueDate).toLocaleDateString('ja-JP')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {task.status !== 'DONE' && (
                          <button
                            onClick={() => handleQuickDone(task.id)}
                            className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors"
                            title="完了にする"
                          >
                            <i className="bi bi-check-lg text-base"></i>
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(task)}
                          className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                          title="編集"
                        >
                          <i className="bi bi-pencil text-base"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          title="削除"
                        >
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

      {/* 新規/編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800 text-lg">
                {editingTask ? 'タスクを編集' : '新規タスク'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* タイトル */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">タイトル <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* 詳細 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">詳細</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* 期限・優先度 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">期限 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">優先度</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="HIGH">高</option>
                    <option value="MEDIUM">中</option>
                    <option value="LOW">低</option>
                  </select>
                </div>
              </div>

              {/* ステータス・担当者 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ステータス</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PENDING">未着手</option>
                    <option value="IN_PROGRESS">進行中</option>
                    <option value="DONE">完了</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">担当者</label>
                  <select
                    value={form.assigneeId}
                    onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">未割当</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.lastNameJa} {emp.firstNameJa}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 関連先（顧客 OR 配布員）*/}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <i className="bi bi-link-45deg"></i> 関連先（顧客または配布員）
                </p>
                <AutocompleteInput
                  value={form.customerId}
                  label="顧客"
                  placeholder="顧客名を入力して検索…"
                  fetchUrl={q => `/api/customers?search=${encodeURIComponent(q)}`}
                  onSelect={(id, name) => {
                    setForm(f => ({ ...f, customerId: id, distributorId: '' }));
                    setFormCustomerName(name);
                    setFormDistributorName('');
                  }}
                  onClear={() => {
                    setForm(f => ({ ...f, customerId: '' }));
                    setFormCustomerName('');
                  }}
                  displayText={formCustomerName}
                />
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex-1 border-t border-slate-200"></div>
                  <span>または</span>
                  <div className="flex-1 border-t border-slate-200"></div>
                </div>
                <AutocompleteInput
                  value={form.distributorId}
                  label="配布員"
                  placeholder="配布員の名前・スタッフIDを入力…"
                  fetchUrl={q => `/api/distributors?search=${encodeURIComponent(q)}`}
                  onSelect={(id, name) => {
                    setForm(f => ({ ...f, distributorId: id, customerId: '' }));
                    setFormDistributorName(name);
                    setFormCustomerName('');
                  }}
                  onClear={() => {
                    setForm(f => ({ ...f, distributorId: '' }));
                    setFormDistributorName('');
                  }}
                  displayText={formDistributorName}
                />
              </div>

              {/* ボタン */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-600 text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  キャンセル
                </button>
                <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {isSubmitting ? '保存中...' : editingTask ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
