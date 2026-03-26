'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '@/components/ui/NotificationProvider';

// ===== 共通型定義（page.tsx からも利用） =====
export type SelectedAssignee = {
  type: 'employee' | 'department' | 'branch';
  id: number;
  label: string;
};

export type SearchResult = {
  type: 'employee' | 'department' | 'branch';
  id: number;
  label: string;
  sub: string;
};

export type TaskCategoryInfo = {
  id: number;
  name: string;
  code: string;
  icon: string | null;
  colorCls: string | null;
};

// ===== 共通定数 =====
export const ASSIGNEE_TYPE_ICON: Record<string, string> = {
  employee: 'bi-person-fill', department: 'bi-people-fill', branch: 'bi-building',
};

export const ASSIGNEE_TYPE_COLOR: Record<string, string> = {
  employee: 'bg-blue-100 text-blue-700 border-blue-200',
  department: 'bg-purple-100 text-purple-700 border-purple-200',
  branch: 'bg-amber-100 text-amber-700 border-amber-200',
};

// ===== 担当者マルチセレクト =====
export function AssigneeMultiSelect({
  selected,
  onChange,
}: {
  selected: SelectedAssignee[];
  onChange: (items: SelectedAssignee[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setIsOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search-assignees?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setResults(data.filter(r => !selected.some(s => s.type === r.type && s.id === r.id)));
          setIsOpen(true);
        }
      } finally { setIsLoading(false); }
    }, 250);
  };

  const addItem = (item: SearchResult) => {
    onChange([...selected, { type: item.type, id: item.id, label: item.label }]);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const removeItem = (type: string, id: number) => {
    onChange(selected.filter(s => !(s.type === type && s.id === id)));
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-bold text-slate-600 mb-1">
        <i className="bi bi-people-fill mr-1"></i>担当者
      </label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(s => (
            <span key={`${s.type}-${s.id}`} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${ASSIGNEE_TYPE_COLOR[s.type]}`}>
              <i className={`${ASSIGNEE_TYPE_ICON[s.type]} text-[10px]`}></i>
              {s.label}
              <button type="button" onClick={() => removeItem(s.type, s.id)} className="ml-0.5 hover:opacity-70">
                <i className="bi bi-x text-sm leading-none"></i>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="社員・部署・支店を検索して追加..."
          className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map(r => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              onMouseDown={() => addItem(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 flex items-center gap-2"
            >
              <i className={`${ASSIGNEE_TYPE_ICON[r.type]} text-slate-400`}></i>
              <div>
                <span className="font-medium text-slate-800">{r.label}</span>
                <span className="ml-2 text-xs text-slate-400">{r.sub}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {isOpen && query.trim() && results.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <p className="px-3 py-2 text-sm text-slate-400">該当なし</p>
        </div>
      )}
    </div>
  );
}

// ===== 顧客オートコンプリート =====
export function AutocompleteInput({
  value, label, placeholder, fetchUrl, onSelect, onClear, displayText,
}: {
  value: string; label: string; placeholder: string;
  fetchUrl: (q: string) => string;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
  displayText: string;
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<{ id: number; name: string; staffId?: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // ドロップダウン位置を計算
  const updateDropdownPos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // スクロール・リサイズ時に位置更新
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPos();
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true);
      window.removeEventListener('resize', updateDropdownPos);
    };
  }, [isOpen, updateDropdownPos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setCandidates([]); setIsOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(fetchUrl(q));
        if (res.ok) {
          const data = await res.json();
          setCandidates(Array.isArray(data) ? data : []);
          updateDropdownPos();
          setIsOpen(true);
        }
      } finally { setIsLoading(false); }
    }, 250);
  };

  const handleSelect = (item: { id: number; name: string; staffId?: string }) => {
    onSelect(item.id.toString(), item.name);
    setQuery(''); setCandidates([]); setIsOpen(false);
  };

  const dropdownContent = isOpen && (candidates.length > 0 || (query.trim() && !isLoading)) ? (
    <div
      ref={dropdownRef}
      className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto"
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
    >
      {candidates.length > 0 ? candidates.map(item => (
        <button key={item.id} type="button" onMouseDown={() => handleSelect(item)}
          className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0">
          <span className="font-medium text-slate-800">{item.name}</span>
          {item.staffId && <span className="ml-2 text-xs text-slate-400">{item.staffId}</span>}
        </button>
      )) : (
        <p className="px-3 py-2 text-sm text-slate-400">該当なし</p>
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>
      {value ? (
        <div className="flex items-center gap-2 border border-indigo-300 bg-indigo-50 rounded-lg px-3 py-2 text-sm">
          <i className="bi bi-check-circle-fill text-indigo-500 text-xs"></i>
          <span className="flex-1 truncate text-indigo-700 font-medium">{displayText}</span>
          <button type="button" onClick={() => { onClear(); setQuery(''); setCandidates([]); setIsOpen(false); }} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
            <i className="bi bi-x-lg text-xs"></i>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text" value={query} onChange={handleChange}
            placeholder={placeholder}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8"
          />
          {isLoading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {dropdownContent && createPortal(dropdownContent, document.body)}
        </div>
      )}
    </div>
  );
}

// ===== タスク作成モーダル =====
interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function TaskCreateModal({ isOpen, onClose, onCreated }: TaskCreateModalProps) {
  const { showToast } = useNotification();
  const [taskCategories, setTaskCategories] = useState<TaskCategoryInfo[]>([]);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', dueDate: new Date().toISOString().slice(0, 10),
    dueTime: '' as string, isAllDay: true,
    priority: 'MEDIUM', status: 'PENDING', categoryId: '' as string,
    customerId: '' as string, distributorId: '' as string, branchId: '' as string,
  });
  const [taskAssignees, setTaskAssignees] = useState<SelectedAssignee[]>([]);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formDistributorName, setFormDistributorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // カテゴリ取得
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/task-categories').then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setTaskCategories(data.filter((c: any) => c.isActive));
    });
  }, [isOpen]);

  // モーダルが開くたびにフォームをリセット
  useEffect(() => {
    if (isOpen) {
      setTaskForm({
        title: '', description: '', dueDate: new Date().toISOString().slice(0, 10),
        dueTime: '', isAllDay: true,
        priority: 'MEDIUM', status: 'PENDING', categoryId: '',
        customerId: '', distributorId: '', branchId: '',
      });
      setTaskAssignees([]);
      setFormCustomerName('');
      setFormDistributorName('');
    }
  }, [isOpen]);

  const getCategoryCode = useCallback((catId: string | number | null): string => {
    if (!catId) return '';
    const cat = taskCategories.find(c => c.id === Number(catId));
    return cat?.code || '';
  }, [taskCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const firstEmp = taskAssignees.find(a => a.type === 'employee');
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
    delete body.dueTime;
    delete body.isAllDay;
    delete body.categoryId;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      onClose();
      onCreated?.();
      showToast('タスクを作成しました', 'success');
    } else {
      showToast('保存に失敗しました', 'error');
    }
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  const catCode = getCategoryCode(taskForm.categoryId);

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] md:max-h-[85vh] flex flex-col">
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-slate-800 text-lg">新規タスク</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <i className="bi bi-x-lg text-xl"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* タイトル */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">タイトル <span className="text-red-500">*</span></label>
            <input type="text" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          {/* 詳細 */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">詳細</label>
            <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          {/* カテゴリ */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">タスク種類</label>
            <div className="flex flex-wrap gap-2">
              <button type="button"
                onClick={() => setTaskForm(f => ({ ...f, categoryId: '', customerId: '', distributorId: '', branchId: '' }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  !taskForm.categoryId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                }`}>
                指定なし
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
              <label className="block text-xs font-bold text-slate-600 mb-1">期限 <span className="text-red-500">*</span></label>
              <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              <div className="mt-2 flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={taskForm.isAllDay}
                    onChange={e => setTaskForm(f => ({ ...f, isAllDay: e.target.checked, dueTime: e.target.checked ? '' : f.dueTime }))}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs text-slate-600">終日</span>
                </label>
                {!taskForm.isAllDay && (
                  <input type="time" value={taskForm.dueTime}
                    onChange={e => setTaskForm(f => ({ ...f, dueTime: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">優先度</label>
              <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="HIGH">高</option><option value="MEDIUM">中</option><option value="LOW">低</option>
              </select>
            </div>
          </div>
          {/* ステータス */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ステータス</label>
            <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="PENDING">未着手</option><option value="IN_PROGRESS">進行中</option><option value="DONE">完了</option>
            </select>
          </div>
          {/* 関連先（カテゴリに応じて変化）*/}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
            <p className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <i className="bi bi-link-45deg"></i> 関連先
            </p>
            {catCode === 'SALES' && (
              <AutocompleteInput
                value={taskForm.customerId} label="顧客" placeholder="顧客名を入力して検索..."
                fetchUrl={q => `/api/customers?search=${encodeURIComponent(q)}`}
                onSelect={(id, name) => { setTaskForm(f => ({ ...f, customerId: id })); setFormCustomerName(name); }}
                onClear={() => { setTaskForm(f => ({ ...f, customerId: '' })); setFormCustomerName(''); }}
                displayText={formCustomerName}
              />
            )}
            {catCode === 'FIELD' && (
              <AutocompleteInput
                value={taskForm.distributorId} label="配布員" placeholder="配布員の名前・スタッフIDを入力..."
                fetchUrl={q => `/api/distributors?search=${encodeURIComponent(q)}`}
                onSelect={(id, name) => { setTaskForm(f => ({ ...f, distributorId: id })); setFormDistributorName(name); }}
                onClear={() => { setTaskForm(f => ({ ...f, distributorId: '' })); setFormDistributorName(''); }}
                displayText={formDistributorName}
              />
            )}
            {!catCode && (
              <>
                <AutocompleteInput
                  value={taskForm.customerId} label="顧客" placeholder="顧客名を入力して検索..."
                  fetchUrl={q => `/api/customers?search=${encodeURIComponent(q)}`}
                  onSelect={(id, name) => { setTaskForm(f => ({ ...f, customerId: id, distributorId: '' })); setFormCustomerName(name); setFormDistributorName(''); }}
                  onClear={() => { setTaskForm(f => ({ ...f, customerId: '' })); setFormCustomerName(''); }}
                  displayText={formCustomerName}
                />
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex-1 border-t border-slate-200"></div><span>または</span><div className="flex-1 border-t border-slate-200"></div>
                </div>
                <AutocompleteInput
                  value={taskForm.distributorId} label="配布員" placeholder="配布員の名前・スタッフIDを入力..."
                  fetchUrl={q => `/api/distributors?search=${encodeURIComponent(q)}`}
                  onSelect={(id, name) => { setTaskForm(f => ({ ...f, distributorId: id, customerId: '' })); setFormDistributorName(name); setFormCustomerName(''); }}
                  onClear={() => { setTaskForm(f => ({ ...f, distributorId: '' })); setFormDistributorName(''); }}
                  displayText={formDistributorName}
                />
              </>
            )}
            {catCode === 'ADMIN' && (
              <p className="text-xs text-slate-400 italic">アドミンタスクには関連先がありません</p>
            )}
          </div>
          {/* 担当者マルチセレクト */}
          <AssigneeMultiSelect selected={taskAssignees} onChange={setTaskAssignees} />
          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="text-slate-600 text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">キャンセル</button>
            <button type="submit" disabled={isSubmitting}
              className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {isSubmitting ? '保存中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
