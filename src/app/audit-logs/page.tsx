'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Pagination from '@/components/ui/Pagination';
import SkeletonRow from '@/components/ui/SkeletonRow';
import EmptyState from '@/components/ui/EmptyState';
import { useTranslation } from '@/i18n';

type AuditLog = {
  id: number;
  actorType: 'EMPLOYEE' | 'PORTAL_USER' | 'STAFF' | 'SYSTEM';
  actorId: number | null;
  actorName: string | null;
  action: string;
  targetModel: string | null;
  targetId: number | null;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type AuditLogDetail = AuditLog & {
  beforeData: unknown;
  afterData: unknown;
  userAgent: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: 'bg-emerald-100 text-emerald-700',
  LOGIN_FAILURE: 'bg-red-100 text-red-700',
  LOGOUT:        'bg-slate-100 text-slate-600',
  CREATE:        'bg-blue-100 text-blue-700',
  UPDATE:        'bg-amber-100 text-amber-700',
  DELETE:        'bg-rose-100 text-rose-700',
  APPROVE:       'bg-indigo-100 text-indigo-700',
  REJECT:        'bg-orange-100 text-orange-700',
  STATUS_CHANGE: 'bg-violet-100 text-violet-700',
};

const TARGET_MODEL_OPTIONS = [
  'Employee',
  'Customer',
  'CustomerContact',
  'Order',
  'FlyerDistributor',
];

const LIMIT = 50;

export default function AuditLogsPage() {
  const { t } = useTranslation('audit-logs');

  const ACTION_LABELS: Record<string, { label: string; color: string }> = useMemo(() => ({
    LOGIN_SUCCESS: { label: t('action_login_success'), color: ACTION_COLORS.LOGIN_SUCCESS },
    LOGIN_FAILURE: { label: t('action_login_failure'), color: ACTION_COLORS.LOGIN_FAILURE },
    LOGOUT:        { label: t('action_logout'),        color: ACTION_COLORS.LOGOUT },
    CREATE:        { label: t('action_create'),        color: ACTION_COLORS.CREATE },
    UPDATE:        { label: t('action_update'),        color: ACTION_COLORS.UPDATE },
    DELETE:        { label: t('action_delete'),        color: ACTION_COLORS.DELETE },
    APPROVE:       { label: t('action_approve'),       color: ACTION_COLORS.APPROVE },
    REJECT:        { label: t('action_reject'),        color: ACTION_COLORS.REJECT },
    STATUS_CHANGE: { label: t('action_status_change'), color: ACTION_COLORS.STATUS_CHANGE },
  }), [t]);

  const ACTOR_TYPE_LABELS: Record<string, string> = useMemo(() => ({
    EMPLOYEE: t('actor_employee'),
    PORTAL_USER: t('actor_portal_user'),
    STAFF: t('actor_staff'),
    SYSTEM: t('actor_system'),
  }), [t]);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [filterAction, setFilterAction] = useState('');
  const [filterActorType, setFilterActorType] = useState('');
  const [filterTargetModel, setFilterTargetModel] = useState('');
  const [filterActorName, setFilterActorName] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p.toString(), limit: LIMIT.toString() });
      if (filterAction) params.set('action', filterAction);
      if (filterActorType) params.set('actorType', filterActorType);
      if (filterTargetModel) params.set('targetModel', filterTargetModel);
      if (filterActorName) params.set('actorName', filterActorName);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const res = await fetch(`/api/audit-logs?${params}`);
      if (res.status === 403) { setAccessDenied(true); setLoading(false); return; }
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterActorType, filterTargetModel, filterActorName, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  const handleRowClick = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/audit-logs/${id}`);
      if (!res.ok) throw new Error('fetch failed');
      setSelectedLog(await res.json());
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReset = () => {
    setFilterAction('');
    setFilterActorType('');
    setFilterTargetModel('');
    setFilterActorName('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  if (accessDenied) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="bi bi-shield-lock-fill text-3xl"></i>
          </div>
          <h3 className="font-bold text-rose-800 text-lg mb-2">{t('access_denied_title')}</h3>
          <p className="text-rose-600 text-sm">{t('access_denied_message')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      {/* フィルターパネル */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">{t('filter_all_actions')}</option>
            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filterActorType}
            onChange={e => setFilterActorType(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">{t('filter_all_actor_types')}</option>
            {Object.entries(ACTOR_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filterTargetModel}
            onChange={e => setFilterTargetModel(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">{t('filter_all_entities')}</option>
            {TARGET_MODEL_OPTIONS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder={t('filter_actor_name')}
            value={filterActorName}
            onChange={e => setFilterActorName(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => fetchLogs(1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
          >
            <i className="bi bi-search" />
            {t('search')}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            {t('reset')}
          </button>
          {!loading && (
            <span className="ml-auto text-xs text-slate-400">
              {total.toLocaleString()} {t('items_count')}
            </span>
          )}
        </div>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{t('col_datetime')}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{t('col_type')}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{t('col_actor')}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{t('col_action')}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{t('col_target')}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">{t('col_description')}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 whitespace-nowrap">{t('col_ip_address')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : logs.length === 0
                ? (
                  <EmptyState title={t('empty_message')} />
                )
                : logs.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => handleRowClick(log.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-slate-500">
                        {ACTOR_TYPE_LABELS[log.actorType] || log.actorType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {log.actorName || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_LABELS[log.action]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {ACTION_LABELS[log.action]?.label || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {log.targetModel
                        ? `${log.targetModel}${log.targetId ? ` #${log.targetId}` : ''}`
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {log.description || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono whitespace-nowrap">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={fetchLogs}
        />
      </div>

      {/* 詳細モーダル */}
      {(selectedLog || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {detailLoading || !selectedLog ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800">
                    {t('detail_title')}
                    <span className="ml-2 text-sm font-normal text-slate-400">#{selectedLog.id}</span>
                  </h2>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>

                <div className="px-6 py-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-6">
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-0.5">{t('detail_datetime')}</span>
                      <span className="text-slate-700">{new Date(selectedLog.createdAt).toLocaleString('ja-JP')}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-0.5">{t('detail_actor')}</span>
                      <span className="text-slate-700 font-medium">
                        {selectedLog.actorName || '—'}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          ({ACTOR_TYPE_LABELS[selectedLog.actorType]})
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-0.5">{t('detail_action')}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_LABELS[selectedLog.action]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-0.5">{t('detail_target')}</span>
                      <span className="text-slate-700">
                        {selectedLog.targetModel || '—'}
                        {selectedLog.targetId && <span className="text-slate-400"> #{selectedLog.targetId}</span>}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-medium text-slate-500 block mb-0.5">{t('detail_description')}</span>
                      <span className="text-slate-700">{selectedLog.description || '—'}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-0.5">{t('detail_ip')}</span>
                      <code className="text-slate-600 text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                        {selectedLog.ipAddress || '—'}
                      </code>
                    </div>
                    {selectedLog.userAgent && (
                      <div className="col-span-2">
                        <span className="text-xs font-medium text-slate-500 block mb-0.5">User Agent</span>
                        <span className="text-slate-500 text-xs break-all">{selectedLog.userAgent}</span>
                      </div>
                    )}
                  </div>

                  {(selectedLog.beforeData !== null || selectedLog.afterData !== null) && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 mb-3">{t('changes_title')}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1.5">{t('changes_before')}</p>
                          <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-auto max-h-72 border border-slate-200 text-slate-600">
                            {selectedLog.beforeData != null
                              ? JSON.stringify(selectedLog.beforeData, null, 2)
                              : 'N/A'
                            }
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1.5">{t('changes_after')}</p>
                          <pre className="bg-slate-50 rounded-lg p-3 text-xs overflow-auto max-h-72 border border-slate-200 text-slate-600">
                            {selectedLog.afterData != null
                              ? JSON.stringify(selectedLog.afterData, null, 2)
                              : 'N/A'
                            }
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
