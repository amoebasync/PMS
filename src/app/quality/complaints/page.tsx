'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';

// ===== Types =====
interface ComplaintTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  assignee?: { id: number; lastNameJa: string; firstNameJa: string } | null;
  taskCategory?: { id: number; name: string; code: string; icon?: string; colorCls?: string } | null;
}

interface Complaint {
  id: number;
  occurredAt: string;
  receivedAt: string;
  complaintTypeId: number | null;
  customerId: number | null;
  distributorId: number | null;
  scheduleId: number | null;
  branchId: number | null;
  address: string;
  buildingName: string | null;
  roomNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  title: string;
  description: string;
  status: 'UNRESOLVED' | 'IN_PROGRESS' | 'RESOLVED';
  assigneeId: number | null;
  imageUrls: string | null;
  // クレーム元
  source?: 'CUSTOMER' | 'RESIDENT' | 'MANAGER' | 'PARTNER' | 'OTHER' | null;
  sourceContactName?: string | null;
  sourceContactPhone?: string | null;
  sourcePartnerId?: number | null;
  sourcePartner?: { id: number; name: string } | null;
  needsResponse?: boolean;
  needsCustomerReport?: boolean;
  createdAt: string;
  updatedAt: string;
  complaintType?: { id: number; name: string } | null;
  customer?: { id: number; name: string; customerCode: string } | null;
  distributor?: { id: number; name: string; staffId: string } | null;
  schedule?: { id: number; jobNumber: string | null; date: string | null } | null;
  branch?: { id: number; nameJa: string } | null;
  assignee?: { id: number; lastNameJa: string; firstNameJa: string } | null;
  responses?: ComplaintResponse[];
  prohibitedProperties?: { id: number; address: string; buildingName?: string | null; isActive: boolean }[];
  tasks?: ComplaintTask[];
  _count?: { responses: number; prohibitedProperties: number; tasks: number };
}

interface ComplaintResponse {
  id: number;
  complaintId: number;
  responderId: number | null;
  content: string;
  createdAt: string;
  responder?: { id: number; lastNameJa: string; firstNameJa: string } | null;
}

interface ComplaintType {
  id: number;
  name: string;
  isActive: boolean;
}

interface ProhibitedReason {
  id: number;
  name: string;
  isActive: boolean;
}

interface BranchOption {
  id: number;
  nameJa: string;
}

// ===== Constants =====
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  UNRESOLVED: { label: '\u672a\u5bfe\u5fdc', bg: 'bg-red-100', text: 'text-red-700' },
  IN_PROGRESS: { label: '\u5bfe\u5fdc\u4e2d', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  RESOLVED: { label: '\u89e3\u6c7a\u6e08\u307f', bg: 'bg-green-100', text: 'text-green-700' },
};

const STATUS_KEYS = ['ALL', 'UNRESOLVED', 'IN_PROGRESS', 'RESOLVED'] as const;
const STATUS_TAB_LABELS: Record<string, string> = {
  ALL: '\u5168\u3066',
  UNRESOLVED: '\u672a\u5bfe\u5fdc',
  IN_PROGRESS: '\u5bfe\u5fdc\u4e2d',
  RESOLVED: '\u89e3\u6c7a\u6e08\u307f',
};

const SOURCE_CONFIG: Record<string, { label: string; icon: string }> = {
  CUSTOMER: { label: '顧客', icon: 'bi-person-badge' },
  RESIDENT: { label: '住人', icon: 'bi-house-door' },
  MANAGER: { label: '管理人', icon: 'bi-key' },
  PARTNER: { label: '外注先', icon: 'bi-building-gear' },
  OTHER: { label: 'その他', icon: 'bi-three-dots' },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: '未着手', bg: 'bg-slate-100', text: 'text-slate-600' },
  IN_PROGRESS: { label: '進行中', bg: 'bg-blue-100', text: 'text-blue-700' },
  DONE: { label: '完了', bg: 'bg-green-100', text: 'text-green-700' },
};

const PAGE_SIZE = 20;

// ===== Helpers =====
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function parseImageUrls(imageUrlsStr: string | null | undefined): string[] {
  if (!imageUrlsStr) return [];
  try {
    const parsed = JSON.parse(imageUrlsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function employeeName(emp: { lastNameJa: string; firstNameJa: string } | null | undefined): string {
  if (!emp) return '';
  return `${emp.lastNameJa} ${emp.firstNameJa}`;
}

// ===== Autocomplete Input Component =====
function AutocompleteInput({
  value,
  label,
  icon,
  placeholder,
  fetchUrl,
  onSelect,
  onClear,
  displayText,
  renderItem,
}: {
  value: string;
  label: string;
  icon: string;
  placeholder: string;
  fetchUrl: (q: string) => string;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
  displayText: string;
  renderItem?: (item: Record<string, unknown>) => React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Record<string, unknown>[]>([]);
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
          setCandidates(Array.isArray(data) ? data : (data.data ?? []));
          setIsOpen(true);
        }
      } finally { setIsLoading(false); }
    }, 300);
  };

  const handleSelect = (item: Record<string, unknown>) => {
    const id = String(item.id);
    const name = (item.name as string) ||
      `${(item as Record<string, unknown>).lastNameJa || ''} ${(item as Record<string, unknown>).firstNameJa || ''}`.trim();
    onSelect(id, name);
    setQuery('');
    setCandidates([]);
    setIsOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-bold text-slate-600 mb-1">
        <i className={`bi ${icon} mr-1`}></i>{label}
      </label>
      {value ? (
        <div className="flex items-center gap-2 border border-indigo-300 bg-indigo-50 rounded-xl px-3 py-2.5 text-sm">
          <i className="bi bi-check-circle-fill text-indigo-500 text-xs"></i>
          <span className="flex-1 truncate text-indigo-700 font-medium">{displayText}</span>
          <button type="button" onClick={() => { onClear(); setQuery(''); setCandidates([]); setIsOpen(false); }} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
            <i className="bi bi-x-lg text-xs"></i>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleChange}
            placeholder={placeholder}
            className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {isOpen && candidates.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
              {candidates.map((item) => (
                <button
                  key={String(item.id)}
                  type="button"
                  onMouseDown={() => handleSelect(item)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  {renderItem ? renderItem(item) : (
                    <span className="font-medium text-slate-800">
                      {(item.name as string) || `${item.lastNameJa || ''} ${item.firstNameJa || ''}`.trim()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {isOpen && query.trim() && candidates.length === 0 && !isLoading && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg">
              <p className="px-3 py-2 text-sm text-slate-400">該当なし</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Status Badge =====
function StatusBadge({ status }: { status: string }) {
  const conf = STATUS_CONFIG[status];
  if (!conf) return <span className="text-xs text-slate-400">{status}</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${conf.bg} ${conf.text}`}>
      {conf.label}
    </span>
  );
}

// ================================================================
// Main Page Component
// ================================================================
export default function ComplaintsPage() {
  const { showToast, showConfirm } = useNotification();

  // ----- List state -----
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // ----- Filter state -----
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ----- Status counts -----
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ ALL: 0, UNRESOLVED: 0, IN_PROGRESS: 0, RESOLVED: 0 });

  // ----- Master data -----
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [complaintTypes, setComplaintTypes] = useState<ComplaintType[]>([]);
  const [prohibitedReasons, setProhibitedReasons] = useState<ProhibitedReason[]>([]);

  // ----- Modal state -----
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ==========================================
  // Fetch master data
  // ==========================================
  useEffect(() => {
    Promise.all([
      fetch('/api/branches').then(r => r.ok ? r.json() : []),
      fetch('/api/complaint-types').then(r => r.ok ? r.json() : []),
      fetch('/api/prohibited-reasons').then(r => r.ok ? r.json() : []),
    ]).then(([branchData, typeData, reasonData]) => {
      setBranches(Array.isArray(branchData) ? branchData : (branchData.data ?? []));
      setComplaintTypes(Array.isArray(typeData) ? typeData : []);
      setProhibitedReasons(Array.isArray(reasonData) ? reasonData : []);
    });
  }, []);

  // ==========================================
  // Debounce search keyword
  // ==========================================
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
      setPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchKeyword]);

  // ==========================================
  // Fetch complaints list
  // ==========================================
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (branchFilter) params.set('branchId', branchFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/complaints?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setComplaints(json.data || []);
      setTotal(json.total || 0);
    } catch {
      showToast('クレーム一覧の取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, branchFilter, dateFrom, dateTo, debouncedSearch, page, showToast]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  // ==========================================
  // Fetch status counts (for tabs)
  // ==========================================
  const fetchStatusCounts = useCallback(async () => {
    try {
      const baseParams = new URLSearchParams();
      if (branchFilter) baseParams.set('branchId', branchFilter);
      if (dateFrom) baseParams.set('dateFrom', dateFrom);
      if (dateTo) baseParams.set('dateTo', dateTo);
      if (debouncedSearch) baseParams.set('search', debouncedSearch);
      baseParams.set('limit', '1');

      const fetchCount = async (status?: string) => {
        const p = new URLSearchParams(baseParams);
        if (status) p.set('status', status);
        const res = await fetch(`/api/complaints?${p.toString()}`);
        if (!res.ok) return 0;
        const json = await res.json();
        return json.total || 0;
      };

      const [allCount, unresolvedCount, inProgressCount, resolvedCount] = await Promise.all([
        fetchCount(),
        fetchCount('UNRESOLVED'),
        fetchCount('IN_PROGRESS'),
        fetchCount('RESOLVED'),
      ]);

      setStatusCounts({
        ALL: allCount,
        UNRESOLVED: unresolvedCount,
        IN_PROGRESS: inProgressCount,
        RESOLVED: resolvedCount,
      });
    } catch {
      // silently fail
    }
  }, [branchFilter, dateFrom, dateTo, debouncedSearch]);

  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);

  // ==========================================
  // Open detail modal
  // ==========================================
  const openDetail = async (complaintId: number) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`);
      if (!res.ok) throw new Error();
      const data: Complaint = await res.json();
      setSelectedComplaint(data);
    } catch {
      showToast('クレーム詳細の取得に失敗しました', 'error');
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!selectedComplaint) return;
    try {
      const res = await fetch(`/api/complaints/${selectedComplaint.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedComplaint(data);
      }
    } catch {
      // silently fail
    }
  };

  // ==========================================
  // Pagination helpers
  // ==========================================
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | string)[] = [];
    if (page > 3) pages.push(1, '...');
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...', totalPages);
    return pages;
  };

  // ================================================================
  // RENDER: Main list view
  // ================================================================
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            <i className="bi bi-exclamation-triangle-fill text-red-500 mr-2"></i>
            クレーム管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">クレームの受付、対応、解決までの一元管理</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md transition-colors"
        >
          <i className="bi bi-plus-lg"></i>
          新規登録
        </button>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {STATUS_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                statusFilter === key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {STATUS_TAB_LABELS[key]}
              <span className={`ml-1.5 text-xs font-normal ${
                statusFilter === key ? 'text-indigo-200' : 'text-slate-400'
              }`}>
                ({statusCounts[key] ?? 0})
              </span>
            </button>
          ))}
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">支店</label>
            <select
              value={branchFilter}
              onChange={e => { setBranchFilter(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">全支店</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.nameJa}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">期間（開始）</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">期間（終了）</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">キーワード検索</label>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="タイトル・住所・内容..."
                className="w-full border border-slate-300 pl-9 pr-3 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-sm text-slate-500">読み込み中...</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="bi bi-inbox text-4xl mb-3"></i>
            <p className="text-sm">クレームが見つかりません</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">受付日</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">種別</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">タイトル</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">物件住所</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">顧客</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">配布員</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">ステータス</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">担当</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">対応数</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openDetail(c.id)}
                      className="border-b border-slate-100 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDate(c.occurredAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.complaintType ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {c.complaintType.name}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate font-medium text-slate-800">{c.title}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate text-slate-600">{c.address}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {c.customer ? c.customer.name : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {c.distributor ? c.distributor.name : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {c.assignee ? employeeName(c.assignee) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(c._count?.responses ?? 0) > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                            {c._count?.responses}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetail(c.id); }}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-xs transition-colors"
                        >
                          詳細
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-100 gap-3">
              <p className="text-xs text-slate-500">
                {total}件中 {startItem}-{endItem}件表示
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
                {getPageNumbers().map((p, idx) =>
                  typeof p === 'string' ? (
                    <span key={`dots-${idx}`} className="px-2 text-slate-400 text-xs">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        page === p
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateComplaintModal
          complaintTypes={complaintTypes}
          branches={branches}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchComplaints();
            fetchStatusCounts();
            showToast('クレームを登録しました', 'success');
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <DetailModal
          complaint={selectedComplaint}
          loading={detailLoading}
          complaintTypes={complaintTypes}
          prohibitedReasons={prohibitedReasons}
          onClose={() => { setShowDetailModal(false); setSelectedComplaint(null); }}
          onRefresh={refreshDetail}
          onListRefresh={() => { fetchComplaints(); fetchStatusCounts(); }}
          showToast={showToast}
          showConfirm={showConfirm}
        />
      )}
    </div>
  );
}

// ================================================================
// CREATE COMPLAINT MODAL
// ================================================================
function CreateComplaintModal({
  complaintTypes,
  branches,
  onClose,
  onCreated,
}: {
  complaintTypes: ComplaintType[];
  branches: BranchOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useNotification();
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [complaintTypeId, setComplaintTypeId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Autocomplete fields
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');

  // クレーム元
  const [source, setSource] = useState('');
  const [sourceContactName, setSourceContactName] = useState('');
  const [sourceContactPhone, setSourceContactPhone] = useState('');
  const [sourcePartnerId, setSourcePartnerId] = useState('');
  const [sourcePartnerName, setSourcePartnerName] = useState('');

  // タスク連携
  const [needsResponse, setNeedsResponse] = useState(false);
  const [responseTaskContent, setResponseTaskContent] = useState('');
  const [responseTaskAssigneeId, setResponseTaskAssigneeId] = useState('');
  const [responseTaskAssigneeName, setResponseTaskAssigneeName] = useState('');

  const [needsCustomerReport, setNeedsCustomerReport] = useState(false);
  const [customerReportContent, setCustomerReportContent] = useState('');
  const [customerReportAssigneeId, setCustomerReportAssigneeId] = useState('');
  const [customerReportAssigneeName, setCustomerReportAssigneeName] = useState('');
  const [customerReportCustomerId, setCustomerReportCustomerId] = useState('');
  const [customerReportCustomerName, setCustomerReportCustomerName] = useState('');

  // クレーム元が顧客の場合、顧客報告の顧客を自動プリフィル
  useEffect(() => {
    if (source === 'CUSTOMER' && customerId && customerName && needsCustomerReport && !customerReportCustomerId) {
      setCustomerReportCustomerId(customerId);
      setCustomerReportCustomerName(customerName);
    }
  }, [source, customerId, customerName, needsCustomerReport, customerReportCustomerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occurredAt || !address.trim() || !title.trim() || !description.trim()) {
      showToast('必須項目を入力してください', 'warning');
      return;
    }

    // タスク必須チェック
    if (needsResponse && (!responseTaskContent.trim() || !responseTaskAssigneeId)) {
      showToast('クレーム対応タスクの内容と担当者を入力してください', 'warning');
      return;
    }
    if (needsCustomerReport && (!customerReportContent.trim() || !customerReportAssigneeId)) {
      showToast('顧客報告タスクの内容と担当者を入力してください', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        occurredAt,
        title: title.trim(),
        address: address.trim(),
        description: description.trim(),
      };
      if (complaintTypeId) body.complaintTypeId = Number(complaintTypeId);
      if (branchId) body.branchId = Number(branchId);
      if (customerId) body.customerId = Number(customerId);
      if (distributorId) body.distributorId = Number(distributorId);
      if (assigneeId) body.assigneeId = Number(assigneeId);
      if (buildingName.trim()) body.buildingName = buildingName.trim();
      if (roomNumber.trim()) body.roomNumber = roomNumber.trim();
      if (latitude) body.latitude = Number(latitude);
      if (longitude) body.longitude = Number(longitude);
      // クレーム元
      if (source) body.source = source;
      if (sourceContactName.trim()) body.sourceContactName = sourceContactName.trim();
      if (sourceContactPhone.trim()) body.sourceContactPhone = sourceContactPhone.trim();
      if (sourcePartnerId) body.sourcePartnerId = Number(sourcePartnerId);
      // タスク連携
      body.needsResponse = needsResponse;
      body.needsCustomerReport = needsCustomerReport;
      if (needsResponse) {
        body.responseTaskContent = responseTaskContent.trim();
        body.responseTaskAssigneeId = Number(responseTaskAssigneeId);
      }
      if (needsCustomerReport) {
        body.customerReportContent = customerReportContent.trim();
        body.customerReportAssigneeId = Number(customerReportAssigneeId);
        if (customerReportCustomerId) body.customerReportCustomerId = Number(customerReportCustomerId);
      }

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '登録に失敗しました');
      }

      onCreated();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '登録に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-black text-slate-800">
            <i className="bi bi-plus-circle-fill text-indigo-500 mr-2"></i>
            クレーム新規登録
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="bi bi-x-lg text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Required Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-calendar-event mr-1"></i>発生日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={occurredAt}
                onChange={e => setOccurredAt(e.target.value)}
                required
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-tag mr-1"></i>クレーム種別
              </label>
              <select
                value={complaintTypeId}
                onChange={e => setComplaintTypeId(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">選択してください</option>
                {complaintTypes.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              <i className="bi bi-chat-text mr-1"></i>タイトル <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="クレームの概要を入力"
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              <i className="bi bi-geo-alt mr-1"></i>住所 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              required
              placeholder="物件住所を入力"
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-building mr-1"></i>建物名
              </label>
              <input
                type="text"
                value={buildingName}
                onChange={e => setBuildingName(e.target.value)}
                placeholder="建物名"
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-door-open mr-1"></i>部屋番号
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value)}
                placeholder="部屋番号"
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              <i className="bi bi-body-text mr-1"></i>詳細内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="クレームの詳細を入力"
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Optional Autocomplete Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AutocompleteInput
              value={customerId}
              label="顧客"
              icon="bi-person-badge"
              placeholder="顧客名で検索..."
              fetchUrl={(q) => `/api/customers?search=${encodeURIComponent(q)}`}
              onSelect={(id, name) => { setCustomerId(id); setCustomerName(name); }}
              onClear={() => { setCustomerId(''); setCustomerName(''); }}
              displayText={customerName}
              renderItem={(item) => (
                <>
                  <span className="font-medium text-slate-800">{item.name as string}</span>
                  {item.customerCode && <span className="ml-2 text-xs text-slate-400">{item.customerCode as string}</span>}
                </>
              )}
            />
            <AutocompleteInput
              value={distributorId}
              label="配布員"
              icon="bi-person-walking"
              placeholder="配布員名で検索..."
              fetchUrl={(q) => `/api/distributors?search=${encodeURIComponent(q)}`}
              onSelect={(id, name) => { setDistributorId(id); setDistributorName(name); }}
              onClear={() => { setDistributorId(''); setDistributorName(''); }}
              displayText={distributorName}
              renderItem={(item) => (
                <>
                  <span className="font-medium text-slate-800">{item.name as string}</span>
                  {item.staffId && <span className="ml-2 text-xs text-slate-400">{item.staffId as string}</span>}
                </>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-building mr-1"></i>関連支店
              </label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">選択してください</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.nameJa}</option>
                ))}
              </select>
            </div>
            <AutocompleteInput
              value={assigneeId}
              label="担当者"
              icon="bi-person-gear"
              placeholder="社員名で検索..."
              fetchUrl={(q) => `/api/employees?search=${encodeURIComponent(q)}`}
              onSelect={(id, name) => { setAssigneeId(id); setAssigneeName(name); }}
              onClear={() => { setAssigneeId(''); setAssigneeName(''); }}
              displayText={assigneeName}
              renderItem={(item) => (
                <span className="font-medium text-slate-800">
                  {`${item.lastNameJa || ''} ${item.firstNameJa || ''}`.trim()}
                </span>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-geo mr-1"></i>緯度
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                placeholder="35.6812"
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-geo mr-1"></i>経度
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                placeholder="139.7671"
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* ===== クレーム元セクション ===== */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
              <i className="bi bi-person-lines-fill text-orange-500"></i>
              クレーム元
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">クレーム元種別</label>
              <select
                value={source}
                onChange={e => {
                  setSource(e.target.value);
                  setSourceContactName('');
                  setSourceContactPhone('');
                  setSourcePartnerId('');
                  setSourcePartnerName('');
                }}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">選択してください</option>
                {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {/* 住人・管理人: 氏名+電話番号 */}
            {(source === 'RESIDENT' || source === 'MANAGER') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    <i className="bi bi-person mr-1"></i>氏名
                  </label>
                  <input
                    type="text"
                    value={sourceContactName}
                    onChange={e => setSourceContactName(e.target.value)}
                    placeholder="氏名を入力"
                    className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    <i className="bi bi-telephone mr-1"></i>電話番号
                  </label>
                  <input
                    type="tel"
                    value={sourceContactPhone}
                    onChange={e => setSourceContactPhone(e.target.value)}
                    placeholder="090-1234-5678"
                    className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* 顧客: 上の顧客AutocompleteInputを使用する旨を表示 */}
            {source === 'CUSTOMER' && (
              <p className="text-xs text-slate-500 mt-2">
                <i className="bi bi-info-circle mr-1"></i>
                上部の「顧客」フィールドで選択してください
                {customerName && <span className="ml-1 font-bold text-indigo-600">（選択済み: {customerName}）</span>}
              </p>
            )}

            {/* 外注先: Partner検索 */}
            {source === 'PARTNER' && (
              <div className="mt-3">
                <AutocompleteInput
                  value={sourcePartnerId}
                  label="外注先"
                  icon="bi-building-gear"
                  placeholder="外注先名で検索..."
                  fetchUrl={(q) => `/api/partners?search=${encodeURIComponent(q)}`}
                  onSelect={(id, name) => { setSourcePartnerId(id); setSourcePartnerName(name); }}
                  onClear={() => { setSourcePartnerId(''); setSourcePartnerName(''); }}
                  displayText={sourcePartnerName}
                  renderItem={(item) => (
                    <span className="font-medium text-slate-800">{item.name as string}</span>
                  )}
                />
              </div>
            )}
          </div>

          {/* ===== タスク連携セクション ===== */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
              <i className="bi bi-list-task text-blue-500"></i>
              タスク連携
            </h3>

            {/* クレーム対応が必要 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsResponse}
                  onChange={e => setNeedsResponse(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                <span className="text-sm font-bold text-slate-700">クレーム対応が必要</span>
              </label>
              {needsResponse && (
                <div className="mt-3 ml-6 space-y-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">対応内容</label>
                    <textarea
                      value={responseTaskContent}
                      onChange={e => setResponseTaskContent(e.target.value)}
                      rows={2}
                      placeholder="対応内容を入力..."
                      className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <AutocompleteInput
                    value={responseTaskAssigneeId}
                    label="対応担当者"
                    icon="bi-person-gear"
                    placeholder="担当者名で検索..."
                    fetchUrl={(q) => `/api/employees?search=${encodeURIComponent(q)}`}
                    onSelect={(id, name) => { setResponseTaskAssigneeId(id); setResponseTaskAssigneeName(name); }}
                    onClear={() => { setResponseTaskAssigneeId(''); setResponseTaskAssigneeName(''); }}
                    displayText={responseTaskAssigneeName}
                    renderItem={(item) => (
                      <span className="font-medium text-slate-800">
                        {`${item.lastNameJa || ''} ${item.firstNameJa || ''}`.trim()}
                      </span>
                    )}
                  />
                </div>
              )}
            </div>

            {/* 顧客報告が必要 */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsCustomerReport}
                  onChange={e => setNeedsCustomerReport(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                <span className="text-sm font-bold text-slate-700">顧客報告が必要</span>
              </label>
              {needsCustomerReport && (
                <div className="mt-3 ml-6 space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AutocompleteInput
                    value={customerReportCustomerId}
                    label="報告先顧客"
                    icon="bi-person-badge"
                    placeholder="顧客名で検索..."
                    fetchUrl={(q) => `/api/customers?search=${encodeURIComponent(q)}`}
                    onSelect={(id, name) => { setCustomerReportCustomerId(id); setCustomerReportCustomerName(name); }}
                    onClear={() => { setCustomerReportCustomerId(''); setCustomerReportCustomerName(''); }}
                    displayText={customerReportCustomerName}
                    renderItem={(item) => (
                      <>
                        <span className="font-medium text-slate-800">{item.name as string}</span>
                        {item.customerCode && <span className="ml-2 text-xs text-slate-400">{item.customerCode as string}</span>}
                      </>
                    )}
                  />
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">報告内容</label>
                    <textarea
                      value={customerReportContent}
                      onChange={e => setCustomerReportContent(e.target.value)}
                      rows={2}
                      placeholder="顧客への報告内容を入力..."
                      className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <AutocompleteInput
                    value={customerReportAssigneeId}
                    label="報告担当者"
                    icon="bi-person-gear"
                    placeholder="担当者名で検索..."
                    fetchUrl={(q) => `/api/employees?search=${encodeURIComponent(q)}`}
                    onSelect={(id, name) => { setCustomerReportAssigneeId(id); setCustomerReportAssigneeName(name); }}
                    onClear={() => { setCustomerReportAssigneeId(''); setCustomerReportAssigneeName(''); }}
                    displayText={customerReportAssigneeName}
                    renderItem={(item) => (
                      <span className="font-medium text-slate-800">
                        {`${item.lastNameJa || ''} ${item.firstNameJa || ''}`.trim()}
                      </span>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit / Cancel */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  登録中...
                </span>
              ) : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ================================================================
// DETAIL MODAL
// ================================================================
function DetailModal({
  complaint,
  loading,
  complaintTypes,
  prohibitedReasons,
  onClose,
  onRefresh,
  onListRefresh,
  showToast,
  showConfirm,
}: {
  complaint: Complaint | null;
  loading: boolean;
  complaintTypes: ComplaintType[];
  prohibitedReasons: ProhibitedReason[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onListRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  showConfirm: (msg: string, options?: { title?: string; variant?: 'danger' | 'primary'; confirmLabel?: string }) => Promise<boolean>;
}) {
  // Response form
  const [responseContent, setResponseContent] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Status change
  const [changingStatus, setChangingStatus] = useState(false);

  // Prohibited property sub-modal
  const [showProhibitedModal, setShowProhibitedModal] = useState(false);

  // ----- Send Response -----
  const handleSendResponse = async () => {
    if (!complaint || !responseContent.trim()) return;
    setSendingResponse(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: responseContent.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '送信に失敗しました');
      }
      setResponseContent('');
      await onRefresh();
      onListRefresh();
      showToast('対応履歴を追加しました', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '送信に失敗しました', 'error');
    } finally {
      setSendingResponse(false);
    }
  };

  // ----- Upload Image -----
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!complaint || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/complaints/${complaint.id}/images`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'アップロードに失敗しました');
      }
      await onRefresh();
      showToast('画像をアップロードしました', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'アップロードに失敗しました', 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ----- Delete Image -----
  const handleDeleteImage = async (url: string) => {
    if (!complaint) return;
    const ok = await showConfirm('この画像を削除しますか?', { title: '画像の削除', variant: 'danger', confirmLabel: '削除する' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
      showToast('画像を削除しました', 'success');
    } catch {
      showToast('画像の削除に失敗しました', 'error');
    }
  };

  // ----- Change Status -----
  const handleStatusChange = async (newStatus: string) => {
    if (!complaint || complaint.status === newStatus) return;
    setChangingStatus(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
      onListRefresh();
      showToast('ステータスを変更しました', 'success');
    } catch {
      showToast('ステータスの変更に失敗しました', 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  // ----- Parse images -----
  const images = complaint ? parseImageUrls(complaint.imageUrls) : [];
  const responses = complaint?.responses || [];

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 animate-in zoom-in-95 duration-200">
        {loading || !complaint ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-sm text-slate-500">読み込み中...</span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={complaint.status} />
                  <span className="text-xs text-slate-400">
                    ID: {complaint.id} | 発生日: {formatDate(complaint.occurredAt)}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-800 mt-1 truncate">{complaint.title}</h2>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-1">
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>

            {/* Body: Two-column layout */}
            <div className="flex flex-col lg:flex-row max-h-[80vh] overflow-hidden">
              {/* Left Column */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-slate-100">
                {/* Complaint Content */}
                <section>
                  <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                    <i className="bi bi-chat-left-text text-indigo-500"></i>
                    クレーム内容
                  </h3>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500">タイトル</span>
                      <p className="text-sm text-slate-800 font-medium">{complaint.title}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">詳細</span>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
                    </div>
                    {complaint.complaintType && (
                      <div>
                        <span className="text-xs font-bold text-slate-500">種別</span>
                        <p className="text-sm text-slate-700">{complaint.complaintType.name}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Source Info */}
                {complaint.source && (
                  <section>
                    <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                      <i className={`${SOURCE_CONFIG[complaint.source]?.icon || 'bi-person'} text-orange-500`}></i>
                      クレーム元
                    </h3>
                    <div className="bg-orange-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                          <i className={SOURCE_CONFIG[complaint.source]?.icon || 'bi-person'}></i>
                          {SOURCE_CONFIG[complaint.source]?.label || complaint.source}
                        </span>
                      </div>
                      {(complaint.source === 'RESIDENT' || complaint.source === 'MANAGER') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {complaint.sourceContactName && (
                            <div>
                              <span className="text-xs font-bold text-slate-500">氏名</span>
                              <p className="text-sm text-slate-800">{complaint.sourceContactName}</p>
                            </div>
                          )}
                          {complaint.sourceContactPhone && (
                            <div>
                              <span className="text-xs font-bold text-slate-500">電話番号</span>
                              <p className="text-sm text-slate-800">{complaint.sourceContactPhone}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {complaint.source === 'CUSTOMER' && complaint.customer && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">顧客</span>
                          <p className="text-sm text-slate-800">
                            {complaint.customer.name}
                            <span className="text-xs text-slate-400 ml-1">({complaint.customer.customerCode})</span>
                          </p>
                        </div>
                      )}
                      {complaint.source === 'PARTNER' && complaint.sourcePartner && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">外注先</span>
                          <p className="text-sm text-slate-800">{complaint.sourcePartner.name}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Property Info */}
                <section>
                  <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                    <i className="bi bi-geo-alt text-rose-500"></i>
                    物件情報
                  </h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-500">住所</span>
                        <p className="text-sm text-slate-800">{complaint.address}</p>
                      </div>
                      {complaint.buildingName && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">建物名</span>
                          <p className="text-sm text-slate-800">{complaint.buildingName}</p>
                        </div>
                      )}
                      {complaint.roomNumber && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">部屋番号</span>
                          <p className="text-sm text-slate-800">{complaint.roomNumber}</p>
                        </div>
                      )}
                      {(complaint.latitude != null || complaint.longitude != null) && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">座標</span>
                          <p className="text-sm text-slate-800">
                            {complaint.latitude ?? '-'}, {complaint.longitude ?? '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Images */}
                <section>
                  <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                    <i className="bi bi-images text-amber-500"></i>
                    画像
                    <span className="text-xs font-normal text-slate-400">({images.length}件)</span>
                  </h3>
                  {images.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      {images.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt={`image-${idx + 1}`}
                              className="w-full h-28 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity"
                            />
                          </a>
                          <button
                            onClick={() => handleDeleteImage(url)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-700"
                            title="削除"
                          >
                            <i className="bi bi-x text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-3">画像なし</p>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50"
                    >
                      {uploadingImage ? (
                        <>
                          <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></span>
                          アップロード中...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-arrow-up"></i>
                          画像を追加
                        </>
                      )}
                    </button>
                  </div>
                </section>

                {/* Response Timeline */}
                <section>
                  <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                    <i className="bi bi-chat-dots text-emerald-500"></i>
                    対応履歴
                    <span className="text-xs font-normal text-slate-400">({responses.length}件)</span>
                  </h3>

                  {responses.length > 0 ? (
                    <div className="space-y-3 mb-4">
                      {[...responses].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((r) => (
                        <div key={r.id} className="bg-slate-50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                {r.responder ? r.responder.lastNameJa.charAt(0) : '?'}
                              </div>
                              <span className="text-sm font-bold text-slate-700">
                                {r.responder ? employeeName(r.responder) : '不明'}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-9">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-4">対応履歴なし</p>
                  )}

                  {/* Response Input */}
                  <div className="border border-slate-200 rounded-xl p-3">
                    <textarea
                      value={responseContent}
                      onChange={e => setResponseContent(e.target.value)}
                      placeholder="対応内容を入力..."
                      rows={3}
                      className="w-full text-sm outline-none resize-none bg-transparent placeholder:text-slate-400"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleSendResponse}
                        disabled={sendingResponse || !responseContent.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingResponse ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            送信中...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send"></i>
                            送信
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column (Sidebar) */}
              <div className="w-full lg:w-80 shrink-0 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                {/* Status Control */}
                <section>
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">ステータス</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={complaint.status} />
                    </div>
                    <select
                      value={complaint.status}
                      onChange={e => handleStatusChange(e.target.value)}
                      disabled={changingStatus}
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-50"
                    >
                      <option value="UNRESOLVED">未対応</option>
                      <option value="IN_PROGRESS">対応中</option>
                      <option value="RESOLVED">解決済み</option>
                    </select>
                  </div>
                </section>

                {/* Related People */}
                <section>
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">関係者</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-bold text-slate-500">顧客</span>
                      <p className="text-sm text-slate-800">
                        {complaint.customer ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-person-badge text-slate-400 text-xs"></i>
                            {complaint.customer.name}
                            <span className="text-xs text-slate-400">({complaint.customer.customerCode})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">なし</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">配布員</span>
                      <p className="text-sm text-slate-800">
                        {complaint.distributor ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-person-walking text-slate-400 text-xs"></i>
                            {complaint.distributor.name}
                            <span className="text-xs text-slate-400">({complaint.distributor.staffId})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">なし</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">関連スケジュール</span>
                      <p className="text-sm text-slate-800">
                        {complaint.schedule ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-calendar3 text-slate-400 text-xs"></i>
                            {complaint.schedule.jobNumber || `#${complaint.schedule.id}`}
                            {complaint.schedule.date && (
                              <span className="text-xs text-slate-400">({formatDate(complaint.schedule.date)})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">なし</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">支店</span>
                      <p className="text-sm text-slate-800">
                        {complaint.branch ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-building text-slate-400 text-xs"></i>
                            {complaint.branch.nameJa}
                          </span>
                        ) : (
                          <span className="text-slate-400">なし</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">担当者</span>
                      <p className="text-sm text-slate-800">
                        {complaint.assignee ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-person-gear text-slate-400 text-xs"></i>
                            {employeeName(complaint.assignee)}
                          </span>
                        ) : (
                          <span className="text-slate-400">なし</span>
                        )}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Prohibited Properties */}
                {complaint.prohibitedProperties && complaint.prohibitedProperties.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">登録済み禁止物件</h3>
                    <div className="space-y-2">
                      {complaint.prohibitedProperties.map(pp => (
                        <div key={pp.id} className="flex items-center gap-2 text-sm">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${pp.isActive ? 'bg-red-500' : 'bg-slate-300'}`}></span>
                          <span className={`truncate ${pp.isActive ? 'text-red-700' : 'text-slate-400 line-through'}`}>
                            {pp.address}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Linked Tasks */}
                {complaint.tasks && complaint.tasks.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">紐付きタスク</h3>
                    <div className="space-y-2">
                      {complaint.tasks.map(task => {
                        const tConf = TASK_STATUS_CONFIG[task.status] || { label: task.status, bg: 'bg-slate-100', text: 'text-slate-600' };
                        return (
                          <div key={task.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-slate-800 truncate flex-1" title={task.title}>
                                {task.taskCategory?.icon && <i className={`${task.taskCategory.icon} mr-1 text-xs`}></i>}
                                {task.title}
                              </p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${tConf.bg} ${tConf.text}`}>
                                {tConf.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              {task.assignee && (
                                <span className="flex items-center gap-1">
                                  <i className="bi bi-person text-slate-400"></i>
                                  {employeeName(task.assignee)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <i className="bi bi-calendar3 text-slate-400"></i>
                                {formatDate(task.dueDate)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Actions */}
                <section>
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">アクション</h3>
                  <button
                    onClick={() => setShowProhibitedModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-bold transition-colors border border-red-200"
                  >
                    <i className="bi bi-shield-exclamation"></i>
                    禁止物件として登録
                  </button>
                </section>

                {/* Timestamps */}
                <section className="pt-3 border-t border-slate-200">
                  <div className="space-y-1 text-xs text-slate-400">
                    <p>受付日: {formatDateTime(complaint.receivedAt)}</p>
                    <p>作成日: {formatDateTime(complaint.createdAt)}</p>
                    <p>更新日: {formatDateTime(complaint.updatedAt)}</p>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Prohibited Property Sub-Modal */}
      {showProhibitedModal && complaint && (
        <ProhibitedPropertyModal
          complaint={complaint}
          prohibitedReasons={prohibitedReasons}
          onClose={() => setShowProhibitedModal(false)}
          onCreated={async () => {
            setShowProhibitedModal(false);
            await onRefresh();
            onListRefresh();
            showToast('禁止物件を登録しました', 'success');
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ================================================================
// PROHIBITED PROPERTY SUB-MODAL
// ================================================================
function ProhibitedPropertyModal({
  complaint,
  prohibitedReasons,
  onClose,
  onCreated,
  showToast,
}: {
  complaint: Complaint;
  prohibitedReasons: ProhibitedReason[];
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [prohibitedReasonId, setProhibitedReasonId] = useState('');
  const [customerScope, setCustomerScope] = useState<'all' | 'specific'>('all');
  const [reasonDetail, setReasonDetail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (prohibitedReasonId) body.prohibitedReasonId = Number(prohibitedReasonId);
      if (customerScope === 'specific' && complaint.customerId) {
        body.customerId = complaint.customerId;
      }
      if (reasonDetail.trim()) body.reasonDetail = reasonDetail.trim();

      const res = await fetch(`/api/complaints/${complaint.id}/register-prohibited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '登録に失敗しました');
      }

      onCreated();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '登録に失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-black text-slate-800">
            <i className="bi bi-shield-exclamation text-red-500 mr-2"></i>
            禁止物件として登録
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Pre-filled address info */}
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
            <p>
              <span className="font-bold text-slate-600">住所: </span>
              <span className="text-slate-800">{complaint.address}</span>
            </p>
            {complaint.buildingName && (
              <p>
                <span className="font-bold text-slate-600">建物名: </span>
                <span className="text-slate-800">{complaint.buildingName}</span>
              </p>
            )}
            {complaint.roomNumber && (
              <p>
                <span className="font-bold text-slate-600">部屋番号: </span>
                <span className="text-slate-800">{complaint.roomNumber}</span>
              </p>
            )}
            {(complaint.latitude != null || complaint.longitude != null) && (
              <p>
                <span className="font-bold text-slate-600">座標: </span>
                <span className="text-slate-800">{complaint.latitude}, {complaint.longitude}</span>
              </p>
            )}
          </div>

          {/* Prohibited Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">禁止理由</label>
            <select
              value={prohibitedReasonId}
              onChange={e => setProhibitedReasonId(e.target.value)}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">選択してください</option>
              {prohibitedReasons.filter(r => r.isActive).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Customer Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">顧客限定</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerScope"
                  checked={customerScope === 'all'}
                  onChange={() => setCustomerScope('all')}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-slate-700">全顧客禁止</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerScope"
                  checked={customerScope === 'specific'}
                  onChange={() => setCustomerScope('specific')}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-slate-700">特定顧客のみ</span>
              </label>
            </div>
            {customerScope === 'specific' && (
              <p className="text-xs text-slate-500 mt-1">
                {complaint.customer
                  ? `対象: ${complaint.customer.name} (${complaint.customer.customerCode})`
                  : '* このクレームに顧客が紐付いていません'}
              </p>
            )}
          </div>

          {/* Reason Detail */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">理由詳細</label>
            <textarea
              value={reasonDetail}
              onChange={e => setReasonDetail(e.target.value)}
              rows={3}
              placeholder="禁止の理由の詳細を入力..."
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  登録中...
                </span>
              ) : '禁止物件に登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
