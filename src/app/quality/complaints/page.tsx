'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

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
  penaltyScore?: number | null;
  needsResponse?: boolean;
  needsCustomerReport?: boolean;
  createdAt: string;
  updatedAt: string;
  complaintType?: { id: number; name: string; penaltyScore?: number } | null;
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
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  UNRESOLVED: { bg: 'bg-red-100', text: 'text-red-700' },
  IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  RESOLVED: { bg: 'bg-green-100', text: 'text-green-700' },
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  ALL: 'status_all',
  UNRESOLVED: 'status_unresolved',
  IN_PROGRESS: 'status_in_progress',
  RESOLVED: 'status_resolved',
};

const STATUS_KEYS = ['ALL', 'UNRESOLVED', 'IN_PROGRESS', 'RESOLVED'] as const;

const SOURCE_ICONS: Record<string, string> = {
  CUSTOMER: 'bi-person-badge',
  RESIDENT: 'bi-house-door',
  MANAGER: 'bi-key',
  PARTNER: 'bi-building-gear',
  OTHER: 'bi-three-dots',
};

const SOURCE_LABEL_KEYS: Record<string, string> = {
  CUSTOMER: 'source_customer',
  RESIDENT: 'source_resident',
  MANAGER: 'source_manager',
  PARTNER: 'source_partner',
  OTHER: 'source_other',
};

const TASK_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-slate-100', text: 'text-slate-600' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-700' },
  DONE: { bg: 'bg-green-100', text: 'text-green-700' },
};

const TASK_STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING: 'task_status_pending',
  IN_PROGRESS: 'task_status_in_progress',
  DONE: 'task_status_done',
};

const PAGE_SIZE = 20;

// ===== Helpers =====
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }) +
    ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
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
function StatusBadge({ status, t }: { status: string; t?: (key: string) => string }) {
  const style = STATUS_STYLE[status];
  if (!style) return <span className="text-xs text-slate-400">{status}</span>;
  const labelKey = STATUS_LABEL_KEYS[status] || status;
  const label = t ? t(labelKey) : labelKey;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
}

// ================================================================
// Main Page Component
// ================================================================
export default function ComplaintsPage() {
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('complaints');

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
      showToast(t('fetch_list_error'), 'error');
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
      showToast(t('fetch_detail_error'), 'error');
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
      {/* Action buttons */}
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md transition-colors"
        >
          <i className="bi bi-plus-lg"></i>
          {t('create')}
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
              {t(STATUS_LABEL_KEYS[key])}
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
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_branch')}</label>
            <select
              value={branchFilter}
              onChange={e => { setBranchFilter(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">{t('filter_all_branches')}</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.nameJa}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_date_from')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_date_to')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_keyword')}</label>
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder={t('filter_keyword_placeholder')}
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
            <span className="ml-3 text-sm text-slate-500">{t('loading')}</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="bi bi-inbox text-4xl mb-3"></i>
            <p className="text-sm">{t('no_complaints')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_received_date')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_type')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_title')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_address')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_customer')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_distributor')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_status')}</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_assignee')}</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_response_count')}</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 whitespace-nowrap">{t('table_actions')}</th>
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
                        <StatusBadge status={c.status} t={t} />
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
                          {t('details')}
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
                {t('pagination_showing', { total: String(total), start: String(startItem), end: String(endItem) })}
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
            showToast(t('created_success'), 'success');
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
  const { t } = useTranslation('complaints');
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

  // スケジュール紐付け
  const [scheduleId, setScheduleId] = useState('');
  const [scheduleOptions, setScheduleOptions] = useState<Array<{ id: number; date: string; area: string; status: string }>>([]);

  // 配布禁止物件リンク
  const [prohibitedMatches, setProhibitedMatches] = useState<Array<{ id: number; address: string; buildingName?: string; distance?: number; matchType: string }>>([]);
  const [linkedProhibitedId, setLinkedProhibitedId] = useState<number | null>(null);
  const [registerAsProhibited, setRegisterAsProhibited] = useState(false);
  const [prohibitedReasonId, setProhibitedReasonId] = useState('');
  const [prohibitedReasons, setProhibitedReasons] = useState<Array<{ id: number; name: string }>>([]);

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

  // クレーム種別選択 → タイトル自動入力
  useEffect(() => {
    if (complaintTypeId && !title) {
      const ct = complaintTypes.find(t => t.id === Number(complaintTypeId));
      if (ct) setTitle(ct.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintTypeId]);

  // 配布員選択 → 直近30日のスケジュールを取得
  useEffect(() => {
    if (!distributorId) { setScheduleOptions([]); setScheduleId(''); return; }
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + 7);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    fetch(`/api/schedules?distributorId=${distributorId}&from=${fmt(from)}&to=${fmt(toDate)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data.schedules || [];
        const opts = list.map((s: any) => ({
          id: s.id,
          date: (s.date || '').slice(0, 10),
          area: s.area ? `${s.city?.name || ''} ${s.area?.chome_name || s.area?.town_name || ''}` : '',
          status: s.status,
        }));
        setScheduleOptions(opts.reverse());
      })
      .catch(() => setScheduleOptions([]));
  }, [distributorId]);

  // 住所・緯度経度 → 禁止物件自動マッチング
  useEffect(() => {
    const timer = setTimeout(() => {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const hasGps = !isNaN(lat) && !isNaN(lng);
      const hasAddress = address.trim().length >= 3;
      if (!hasGps && !hasAddress) { setProhibitedMatches([]); return; }

      const params = new URLSearchParams();
      if (hasGps) { params.set('lat', String(lat)); params.set('lng', String(lng)); }
      if (hasAddress) params.set('q', address.trim());

      fetch(`/api/prohibited-properties/search?${params}`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then(data => setProhibitedMatches(data.results || []))
        .catch(() => setProhibitedMatches([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [address, latitude, longitude]);

  // 禁止理由マスタ取得
  useEffect(() => {
    fetch('/api/prohibited-reasons')
      .then(r => r.ok ? r.json() : [])
      .then(data => setProhibitedReasons(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

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
      showToast(t('form_required_error'), 'warning');
      return;
    }

    // タスク必須チェック
    if (needsResponse && (!responseTaskContent.trim() || !responseTaskAssigneeId)) {
      showToast(t('task_response_validation'), 'warning');
      return;
    }
    if (needsCustomerReport && (!customerReportContent.trim() || !customerReportAssigneeId)) {
      showToast(t('task_report_validation'), 'warning');
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
      if (scheduleId) body.scheduleId = Number(scheduleId);
      // 配布禁止物件リンク
      if (linkedProhibitedId) body.linkProhibitedPropertyId = linkedProhibitedId;
      else if (registerAsProhibited) {
        body.registerAsProhibited = true;
        if (prohibitedReasonId) body.prohibitedReasonId = Number(prohibitedReasonId);
      }
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
        throw new Error(err.error || t('form_register_error'));
      }

      onCreated();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('form_register_error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-start justify-center bg-black/50 backdrop-blur-sm md:overflow-y-auto md:py-8">
      <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl md:mx-4 animate-in zoom-in-95 duration-200 max-h-[95vh] md:max-h-none overflow-y-auto">
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-black text-slate-800">
            <i className="bi bi-plus-circle-fill text-indigo-500 mr-2"></i>
            {t('create_modal_title')}
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
                <i className="bi bi-calendar-event mr-1"></i>{t('form_occurred_date')} <span className="text-red-500">*</span>
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
                <i className="bi bi-tag mr-1"></i>{t('form_complaint_type')}
              </label>
              <select
                value={complaintTypeId}
                onChange={e => setComplaintTypeId(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">{t('form_select_placeholder')}</option>
                {complaintTypes.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              <i className="bi bi-chat-text mr-1"></i>{t('form_title')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder={t('form_title_placeholder')}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              <i className="bi bi-geo-alt mr-1"></i>{t('form_address')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              required
              placeholder={t('form_address_placeholder')}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-building mr-1"></i>{t('form_building_name')}
              </label>
              <input
                type="text"
                value={buildingName}
                onChange={e => setBuildingName(e.target.value)}
                placeholder={t('form_building_name')}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-door-open mr-1"></i>{t('form_room_number')}
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={e => setRoomNumber(e.target.value)}
                placeholder={t('form_room_number')}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              <i className="bi bi-body-text mr-1"></i>{t('form_detail')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              rows={4}
              placeholder={t('form_detail_placeholder')}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Optional Autocomplete Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AutocompleteInput
              value={customerId}
              label={t('form_customer')}
              icon="bi-person-badge"
              placeholder={t('form_customer_placeholder')}
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
              label={t('form_distributor')}
              icon="bi-person-walking"
              placeholder={t('form_distributor_placeholder')}
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

          {/* Schedule selector (when distributor is selected) */}
          {distributorId && scheduleOptions.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-calendar-check mr-1"></i>{t('form_schedule') || 'スケジュール'}
              </label>
              <select
                value={scheduleId}
                onChange={e => setScheduleId(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">{t('form_select_placeholder')}</option>
                {scheduleOptions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.date} - {s.area} ({s.status === 'COMPLETED' ? '完了' : s.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                <i className="bi bi-building mr-1"></i>{t('form_related_branch')}
              </label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">{t('form_select_placeholder')}</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.nameJa}</option>
                ))}
              </select>
            </div>
            <AutocompleteInput
              value={assigneeId}
              label={t('form_assignee')}
              icon="bi-person-gear"
              placeholder={t('form_assignee_placeholder')}
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
                <i className="bi bi-geo mr-1"></i>{t('form_latitude')}
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
                <i className="bi bi-geo mr-1"></i>{t('form_longitude')}
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
              {t('section_source')}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">{t('source_type')}</label>
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
                <option value="">{t('form_select_placeholder')}</option>
                {Object.entries(SOURCE_LABEL_KEYS).map(([key, labelKey]) => (
                  <option key={key} value={key}>{t(labelKey)}</option>
                ))}
              </select>
            </div>

            {/* 住人・管理人: 氏名+電話番号 */}
            {(source === 'RESIDENT' || source === 'MANAGER') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    <i className="bi bi-person mr-1"></i>{t('source_contact_name')}
                  </label>
                  <input
                    type="text"
                    value={sourceContactName}
                    onChange={e => setSourceContactName(e.target.value)}
                    placeholder={t('source_contact_name_placeholder')}
                    className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    <i className="bi bi-telephone mr-1"></i>{t('source_contact_phone')}
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
                {t('source_customer_hint')}
                {customerName && <span className="ml-1 font-bold text-indigo-600">({t('source_customer_selected', { name: customerName })})</span>}
              </p>
            )}

            {/* 外注先: Partner検索 */}
            {source === 'PARTNER' && (
              <div className="mt-3">
                <AutocompleteInput
                  value={sourcePartnerId}
                  label={t('source_partner_label')}
                  icon="bi-building-gear"
                  placeholder={t('source_partner_placeholder')}
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

          {/* ===== 配布禁止物件リンク ===== */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <i className="bi bi-house-x text-red-500"></i>
              {t('form_prohibited_section') || '配布禁止物件'}
            </h3>

            {/* Auto-match results */}
            {linkedProhibitedId ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="bi bi-link-45deg text-emerald-600"></i>
                  <div>
                    <span className="text-xs font-bold text-emerald-700">{t('form_prohibited_linked') || '禁止物件とリンク済み'}</span>
                    <span className="text-xs text-emerald-600 ml-2">#{linkedProhibitedId}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkedProhibitedId(null)}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            ) : prohibitedMatches.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <i className="bi bi-exclamation-triangle text-amber-600"></i>
                  <span className="text-xs font-bold text-amber-700">{t('form_prohibited_matches') || 'この住所付近に配布禁止物件があります'}</span>
                </div>
                <div className="space-y-1.5">
                  {prohibitedMatches.slice(0, 3).map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-slate-700 truncate block">{m.address}</span>
                        {m.buildingName && <span className="text-[10px] text-slate-400">{m.buildingName}</span>}
                        {m.distance != null && <span className="text-[10px] text-amber-600 ml-1">({m.distance}m)</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setLinkedProhibitedId(m.id); setRegisterAsProhibited(false); }}
                        className="shrink-0 ml-2 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                      >
                        {t('form_prohibited_link_btn') || 'リンク'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Register as new prohibited property */}
            {!linkedProhibitedId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={registerAsProhibited}
                  onChange={e => setRegisterAsProhibited(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 accent-red-600"
                />
                <span className="text-xs font-bold text-slate-600">{t('form_register_prohibited') || 'この物件を配布禁止に登録する'}</span>
              </label>
            )}

            {registerAsProhibited && !linkedProhibitedId && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {t('form_prohibited_reason') || '禁止理由'}
                </label>
                <select
                  value={prohibitedReasonId}
                  onChange={e => setProhibitedReasonId(e.target.value)}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400 bg-white"
                >
                  <option value="">{t('form_select_placeholder')}</option>
                  {prohibitedReasons.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ===== タスク連携セクション ===== */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
              <i className="bi bi-list-task text-blue-500"></i>
              {t('section_task')}
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
                <span className="text-sm font-bold text-slate-700">{t('task_needs_response')}</span>
              </label>
              {needsResponse && (
                <div className="mt-3 ml-6 space-y-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('task_response_content')}</label>
                    <textarea
                      value={responseTaskContent}
                      onChange={e => setResponseTaskContent(e.target.value)}
                      rows={2}
                      placeholder={t('task_response_content_placeholder')}
                      className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <AutocompleteInput
                    value={responseTaskAssigneeId}
                    label={t('task_response_assignee')}
                    icon="bi-person-gear"
                    placeholder={t('task_response_assignee_placeholder')}
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
                <span className="text-sm font-bold text-slate-700">{t('task_needs_customer_report')}</span>
              </label>
              {needsCustomerReport && (
                <div className="mt-3 ml-6 space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AutocompleteInput
                    value={customerReportCustomerId}
                    label={t('task_report_customer')}
                    icon="bi-person-badge"
                    placeholder={t('form_customer_placeholder')}
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
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('task_report_content')}</label>
                    <textarea
                      value={customerReportContent}
                      onChange={e => setCustomerReportContent(e.target.value)}
                      rows={2}
                      placeholder={t('task_report_content_placeholder')}
                      className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                  <AutocompleteInput
                    value={customerReportAssigneeId}
                    label={t('task_report_assignee')}
                    icon="bi-person-gear"
                    placeholder={t('task_response_assignee_placeholder')}
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
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {t('form_registering')}
                </span>
              ) : t('form_register')}
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
  const { t } = useTranslation('complaints');

  // Response form
  const [responseContent, setResponseContent] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Status change
  const [changingStatus, setChangingStatus] = useState(false);

  // Penalty score
  const [penaltyScoreInput, setPenaltyScoreInput] = useState<string>('');
  const [savingPenalty, setSavingPenalty] = useState(false);

  // Sync penalty score when complaint changes
  useEffect(() => {
    if (complaint) {
      setPenaltyScoreInput(complaint.penaltyScore != null ? String(complaint.penaltyScore) : '');
    }
  }, [complaint?.id, complaint?.penaltyScore]);

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
        throw new Error(err.error || t('detail_send_error'));
      }
      setResponseContent('');
      await onRefresh();
      onListRefresh();
      showToast(t('detail_response_added'), 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('detail_send_error'), 'error');
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
        throw new Error(err.error || t('detail_image_upload_error'));
      }
      await onRefresh();
      showToast(t('detail_image_uploaded'), 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('detail_image_upload_error'), 'error');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ----- Delete Image -----
  const handleDeleteImage = async (url: string) => {
    if (!complaint) return;
    const ok = await showConfirm(t('detail_delete_image_confirm'), { title: t('detail_delete_image_title'), variant: 'danger', confirmLabel: t('detail_delete_image_btn') });
    if (!ok) return;
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
      showToast(t('detail_image_deleted'), 'success');
    } catch {
      showToast(t('detail_image_delete_error'), 'error');
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
      showToast(t('sidebar_status_changed'), 'success');
    } catch {
      showToast(t('sidebar_status_change_error'), 'error');
    } finally {
      setChangingStatus(false);
    }
  };

  // ----- Save Penalty Score -----
  const handleSavePenalty = async () => {
    if (!complaint) return;
    setSavingPenalty(true);
    try {
      const value = penaltyScoreInput.trim() === '' ? null : parseInt(penaltyScoreInput);
      const res = await fetch(`/api/complaints/${complaint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ penaltyScore: value }),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
      onListRefresh();
      showToast(t('sidebar_penalty_saved'), 'success');
    } catch {
      showToast(t('sidebar_penalty_save_error'), 'error');
    } finally {
      setSavingPenalty(false);
    }
  };

  // ----- Parse images -----
  const images = complaint ? parseImageUrls(complaint.imageUrls) : [];
  const responses = complaint?.responses || [];

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-start justify-center bg-black/50 backdrop-blur-sm md:overflow-y-auto md:py-6">
      <div className="bg-white w-full h-full md:h-auto md:max-w-5xl rounded-none md:rounded-2xl shadow-2xl md:mx-4 animate-in zoom-in-95 duration-200 overflow-y-auto">
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        {loading || !complaint ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-sm text-slate-500">{t('loading')}</span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={complaint.status} t={t} />
                  <span className="text-xs text-slate-400">
                    {t('detail_id_date', { id: String(complaint.id), date: formatDate(complaint.occurredAt) })}
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
                    {t('detail_complaint_content')}
                  </h3>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500">{t('detail_title_label')}</span>
                      <p className="text-sm text-slate-800 font-medium">{complaint.title}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">{t('detail_description_label')}</span>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
                    </div>
                    {complaint.complaintType && (
                      <div>
                        <span className="text-xs font-bold text-slate-500">{t('detail_type_label')}</span>
                        <p className="text-sm text-slate-700">{complaint.complaintType.name}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Source Info */}
                {complaint.source && (
                  <section>
                    <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                      <i className={`${SOURCE_ICONS[complaint.source] || 'bi-person'} text-orange-500`}></i>
                      {t('detail_source')}
                    </h3>
                    <div className="bg-orange-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                          <i className={SOURCE_ICONS[complaint.source] || 'bi-person'}></i>
                          {t(SOURCE_LABEL_KEYS[complaint.source] || complaint.source)}
                        </span>
                      </div>
                      {(complaint.source === 'RESIDENT' || complaint.source === 'MANAGER') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {complaint.sourceContactName && (
                            <div>
                              <span className="text-xs font-bold text-slate-500">{t('source_contact_name')}</span>
                              <p className="text-sm text-slate-800">{complaint.sourceContactName}</p>
                            </div>
                          )}
                          {complaint.sourceContactPhone && (
                            <div>
                              <span className="text-xs font-bold text-slate-500">{t('source_contact_phone')}</span>
                              <p className="text-sm text-slate-800">{complaint.sourceContactPhone}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {complaint.source === 'CUSTOMER' && complaint.customer && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">{t('sidebar_customer')}</span>
                          <p className="text-sm text-slate-800">
                            {complaint.customer.name}
                            <span className="text-xs text-slate-400 ml-1">({complaint.customer.customerCode})</span>
                          </p>
                        </div>
                      )}
                      {complaint.source === 'PARTNER' && complaint.sourcePartner && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">{t('source_partner_label')}</span>
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
                    {t('detail_property_info')}
                  </h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-500">{t('detail_address_label')}</span>
                        <p className="text-sm text-slate-800">{complaint.address}</p>
                      </div>
                      {complaint.buildingName && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">{t('detail_building_label')}</span>
                          <p className="text-sm text-slate-800">{complaint.buildingName}</p>
                        </div>
                      )}
                      {complaint.roomNumber && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">{t('detail_room_label')}</span>
                          <p className="text-sm text-slate-800">{complaint.roomNumber}</p>
                        </div>
                      )}
                      {(complaint.latitude != null || complaint.longitude != null) && (
                        <div>
                          <span className="text-xs font-bold text-slate-500">{t('detail_coordinates')}</span>
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
                    {t('detail_images')}
                    <span className="text-xs font-normal text-slate-400">({t('detail_images_count', { count: String(images.length) })})</span>
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
                            title={t('detail_delete_tooltip')}
                          >
                            <i className="bi bi-x text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-3">{t('detail_no_images')}</p>
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
                          {t('detail_uploading')}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-cloud-arrow-up"></i>
                          {t('detail_add_image')}
                        </>
                      )}
                    </button>
                  </div>
                </section>

                {/* Response Timeline */}
                <section>
                  <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                    <i className="bi bi-chat-dots text-emerald-500"></i>
                    {t('detail_response_timeline')}
                    <span className="text-xs font-normal text-slate-400">({t('detail_images_count', { count: String(responses.length) })})</span>
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
                                {r.responder ? employeeName(r.responder) : t('detail_unknown_responder')}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</span>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-9">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 mb-4">{t('detail_no_responses')}</p>
                  )}

                  {/* Response Input */}
                  <div className="border border-slate-200 rounded-xl p-3">
                    <textarea
                      value={responseContent}
                      onChange={e => setResponseContent(e.target.value)}
                      placeholder={t('detail_response_placeholder')}
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
                            {t('detail_sending')}
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send"></i>
                            {t('detail_send')}
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
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">{t('sidebar_status')}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={complaint.status} t={t} />
                    </div>
                    <select
                      value={complaint.status}
                      onChange={e => handleStatusChange(e.target.value)}
                      disabled={changingStatus}
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:opacity-50"
                    >
                      <option value="UNRESOLVED">{t('status_unresolved')}</option>
                      <option value="IN_PROGRESS">{t('status_in_progress')}</option>
                      <option value="RESOLVED">{t('status_resolved')}</option>
                    </select>
                  </div>
                </section>

                {/* Penalty Score */}
                <section>
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">{t('sidebar_penalty_score')}</h3>
                  <div className="space-y-2">
                    <input
                      type="number"
                      min={0}
                      value={penaltyScoreInput}
                      onChange={e => setPenaltyScoreInput(e.target.value)}
                      placeholder={t('sidebar_penalty_type_default', { score: String(complaint.complaintType?.penaltyScore ?? 10) })}
                      className="w-full border border-slate-300 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <p className="text-[10px] text-slate-400">{t('sidebar_penalty_empty_hint')}</p>
                    <button
                      onClick={handleSavePenalty}
                      disabled={savingPenalty}
                      className="w-full text-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {savingPenalty ? t('sidebar_penalty_saving') : t('sidebar_penalty_save')}
                    </button>
                  </div>
                </section>

                {/* Related People */}
                <section>
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">{t('sidebar_related_people')}</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-bold text-slate-500">{t('sidebar_customer')}</span>
                      <p className="text-sm text-slate-800">
                        {complaint.customer ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-person-badge text-slate-400 text-xs"></i>
                            {complaint.customer.name}
                            <span className="text-xs text-slate-400">({complaint.customer.customerCode})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">{t('sidebar_none')}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">{t('sidebar_distributor')}</span>
                      <p className="text-sm text-slate-800">
                        {complaint.distributor ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-person-walking text-slate-400 text-xs"></i>
                            {complaint.distributor.name}
                            <span className="text-xs text-slate-400">({complaint.distributor.staffId})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">{t('sidebar_none')}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">{t('sidebar_schedule')}</span>
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
                          <span className="text-slate-400">{t('sidebar_none')}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">{t('sidebar_branch')}</span>
                      <p className="text-sm text-slate-800">
                        {complaint.branch ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-building text-slate-400 text-xs"></i>
                            {complaint.branch.nameJa}
                          </span>
                        ) : (
                          <span className="text-slate-400">{t('sidebar_none')}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">{t('sidebar_assignee')}</span>
                      <p className="text-sm text-slate-800">
                        {complaint.assignee ? (
                          <span className="flex items-center gap-1.5">
                            <i className="bi bi-person-gear text-slate-400 text-xs"></i>
                            {employeeName(complaint.assignee)}
                          </span>
                        ) : (
                          <span className="text-slate-400">{t('sidebar_none')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Prohibited Properties */}
                {complaint.prohibitedProperties && complaint.prohibitedProperties.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">{t('sidebar_prohibited')}</h3>
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
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">{t('sidebar_linked_tasks')}</h3>
                    <div className="space-y-2">
                      {complaint.tasks.map(task => {
                        const tStyle = TASK_STATUS_STYLE[task.status] || { bg: 'bg-slate-100', text: 'text-slate-600' };
                        const tLabelKey = TASK_STATUS_LABEL_KEYS[task.status] || task.status;
                        return (
                          <div key={task.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-slate-800 truncate flex-1" title={task.title}>
                                {task.taskCategory?.icon && <i className={`${task.taskCategory.icon} mr-1 text-xs`}></i>}
                                {task.title}
                              </p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${tStyle.bg} ${tStyle.text}`}>
                                {t(tLabelKey)}
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
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-3">{t('sidebar_actions')}</h3>
                  <button
                    onClick={() => setShowProhibitedModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-bold transition-colors border border-red-200"
                  >
                    <i className="bi bi-shield-exclamation"></i>
                    {t('sidebar_register_prohibited')}
                  </button>
                </section>

                {/* Timestamps */}
                <section className="pt-3 border-t border-slate-200">
                  <div className="space-y-1 text-xs text-slate-400">
                    <p>{t('sidebar_received_date', { date: formatDateTime(complaint.receivedAt) })}</p>
                    <p>{t('sidebar_created_date', { date: formatDateTime(complaint.createdAt) })}</p>
                    <p>{t('sidebar_updated_date', { date: formatDateTime(complaint.updatedAt) })}</p>
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
            showToast(t('prohibited_registered'), 'success');
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
  const { t } = useTranslation('complaints');
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
        throw new Error(err.error || t('form_register_error'));
      }

      onCreated();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('form_register_error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-end md:items-center justify-center bg-black/40 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl md:mx-4 animate-in zoom-in-95 duration-200 max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-black text-slate-800">
            <i className="bi bi-shield-exclamation text-red-500 mr-2"></i>
            {t('prohibited_modal_title')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Pre-filled address info */}
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
            <p>
              <span className="font-bold text-slate-600">{t('prohibited_address')}</span>
              <span className="text-slate-800">{complaint.address}</span>
            </p>
            {complaint.buildingName && (
              <p>
                <span className="font-bold text-slate-600">{t('prohibited_building')}</span>
                <span className="text-slate-800">{complaint.buildingName}</span>
              </p>
            )}
            {complaint.roomNumber && (
              <p>
                <span className="font-bold text-slate-600">{t('prohibited_room')}</span>
                <span className="text-slate-800">{complaint.roomNumber}</span>
              </p>
            )}
            {(complaint.latitude != null || complaint.longitude != null) && (
              <p>
                <span className="font-bold text-slate-600">{t('prohibited_coordinates')}</span>
                <span className="text-slate-800">{complaint.latitude}, {complaint.longitude}</span>
              </p>
            )}
          </div>

          {/* Prohibited Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">{t('prohibited_reason')}</label>
            <select
              value={prohibitedReasonId}
              onChange={e => setProhibitedReasonId(e.target.value)}
              className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">{t('form_select_placeholder')}</option>
              {prohibitedReasons.filter(r => r.isActive).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Customer Scope */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('prohibited_customer_scope')}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerScope"
                  checked={customerScope === 'all'}
                  onChange={() => setCustomerScope('all')}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-slate-700">{t('prohibited_scope_all')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerScope"
                  checked={customerScope === 'specific'}
                  onChange={() => setCustomerScope('specific')}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-slate-700">{t('prohibited_scope_specific')}</span>
              </label>
            </div>
            {customerScope === 'specific' && (
              <p className="text-xs text-slate-500 mt-1">
                {complaint.customer
                  ? t('prohibited_scope_target', { name: complaint.customer.name, code: complaint.customer.customerCode })
                  : t('prohibited_scope_no_customer')}
              </p>
            )}
          </div>

          {/* Reason Detail */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">{t('prohibited_reason_detail')}</label>
            <textarea
              value={reasonDetail}
              onChange={e => setReasonDetail(e.target.value)}
              rows={3}
              placeholder={t('prohibited_reason_placeholder')}
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
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {t('prohibited_registering')}
                </span>
              ) : t('prohibited_register')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
