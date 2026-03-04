'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';

type AlertCategory = {
  id: number;
  name: string;
  icon: string | null;
  colorCls: string | null;
};

type Alert = {
  id: number;
  categoryId: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED';
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: number | null;
  resolvedById: number | null;
  resolvedAt: string | null;
  resolvedNote: string | null;
  createdAt: string;
  category: AlertCategory;
  resolvedBy: { id: number; lastNameJa: string; firstNameJa: string } | null;
};

const SEVERITY_STYLE: Record<string, { labelKey: string; bg: string; text: string; dot: string }> = {
  CRITICAL: { labelKey: 'severity_critical', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  WARNING:  { labelKey: 'severity_warning', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  INFO:     { labelKey: 'severity_info', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const ENTITY_LINKS: Record<string, (id: number) => string> = {
  FlyerDistributor: (id) => `/distributors/${id}`,
};

export default function AlertsPage() {
  const { t } = useTranslation('alerts');

  const SEVERITY_CONFIG = useMemo(() => {
    const result: Record<string, { label: string; bg: string; text: string; dot: string }> = {};
    for (const [key, style] of Object.entries(SEVERITY_STYLE)) {
      result[key] = { label: t(style.labelKey), ...style };
    }
    return result;
  }, [t]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [categories, setCategories] = useState<AlertCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Resolve modal
  const [resolveTarget, setResolveTarget] = useState<Alert | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/alert-categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.filter((c: any) => c.isActive));
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '30');
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/alerts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  }, [statusFilter, severityFilter, categoryFilter, search, page]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { setPage(1); }, [statusFilter, severityFilter, categoryFilter, search]);

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setIsResolving(true);
    try {
      const res = await fetch(`/api/alerts/${resolveTarget.id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: resolveNote }),
      });
      if (res.ok) {
        setResolveTarget(null);
        setResolveNote('');
        await fetchAlerts();
      }
    } catch (e) { console.error(e); }
    setIsResolving(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
      + ' ' + d.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <i className="bi bi-bell-fill text-indigo-500" /> {t('page_title')}
        </h1>
        <div className="text-sm text-slate-500">
          {total} 件
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Status toggle */}
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            {(['OPEN', 'RESOLVED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  statusFilter === s ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s === 'OPEN' ? t('status_open') : t('status_resolved')}
              </button>
            ))}
          </div>

          {/* Severity tabs */}
          <div className="flex bg-slate-100 rounded-xl p-0.5">
            {[{ key: 'ALL', label: t('severity_all') }, { key: 'CRITICAL', label: t('severity_critical') }, { key: 'WARNING', label: t('severity_warning') }, { key: 'INFO', label: t('severity_info') }].map(s => (
              <button
                key={s.key}
                onClick={() => setSeverityFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  severityFilter === s.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Category dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{t('filter_all_categories')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search_placeholder')}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left">{t('col_severity')}</th>
              <th className="px-5 py-3 text-left">{t('col_category')}</th>
              <th className="px-5 py-3 text-left">{t('col_title')}</th>
              <th className="px-5 py-3 text-left">{t('col_datetime')}</th>
              <th className="px-5 py-3 text-center">{t('col_status')}</th>
              <th className="px-5 py-3 text-center w-24">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                <i className="bi bi-arrow-clockwise animate-spin text-xl" />
              </td></tr>
            ) : alerts.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                {t('empty')}
              </td></tr>
            ) : (
              alerts.map(alert => {
                const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.INFO;
                return (
                  <tr key={alert.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${sev.bg} ${sev.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${alert.category.colorCls || 'bg-slate-100 text-slate-600'}`}>
                        {alert.category.icon && <i className={`bi ${alert.category.icon} text-[11px]`} />}
                        {alert.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{alert.title}</div>
                      {alert.message && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-md">{alert.message}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(alert.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {alert.status === 'OPEN' ? (
                        <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">{t('status_open')}</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{t('status_resolved')}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {alert.entityType && alert.entityId && ENTITY_LINKS[alert.entityType] && (
                          <a
                            href={ENTITY_LINKS[alert.entityType](alert.entityId)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('btn_view_related')}
                          >
                            <i className="bi bi-box-arrow-up-right text-sm" />
                          </a>
                        )}
                        {alert.status === 'OPEN' && (
                          <button
                            onClick={() => { setResolveTarget(alert); setResolveNote(''); }}
                            className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title={t('btn_resolve')}
                          >
                            <i className="bi bi-check-circle text-sm" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {t('pagination_info', { total: String(total), start: String((page - 1) * 30 + 1), end: String(Math.min(page * 30, total)) })}
            </div>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                {t('previous')}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resolve modal */}
      {resolveTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setResolveTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-check-circle text-emerald-500" /> {t('resolve_modal_title')}
              </h3>
              <button onClick={() => setResolveTarget(null)} className="text-slate-400 hover:text-slate-600 transition">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Alert detail */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${SEVERITY_CONFIG[resolveTarget.severity]?.bg} ${SEVERITY_CONFIG[resolveTarget.severity]?.text}`}>
                    {SEVERITY_CONFIG[resolveTarget.severity]?.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${resolveTarget.category.colorCls || 'bg-slate-100 text-slate-600'}`}>
                    {resolveTarget.category.icon && <i className={`bi ${resolveTarget.category.icon}`} />}
                    {resolveTarget.category.name}
                  </span>
                </div>
                <h4 className="font-bold text-slate-800">{resolveTarget.title}</h4>
                {resolveTarget.message && <p className="text-sm text-slate-500">{resolveTarget.message}</p>}
                <div className="text-xs text-slate-400">{formatDate(resolveTarget.createdAt)}</div>
                {resolveTarget.entityType && resolveTarget.entityId && ENTITY_LINKS[resolveTarget.entityType] && (
                  <a
                    href={ENTITY_LINKS[resolveTarget.entityType](resolveTarget.entityId)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                  >
                    <i className="bi bi-box-arrow-up-right" /> {t('btn_view_related_link')}
                  </a>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('resolve_note_label')}</label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder={t('resolve_note_placeholder')}
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setResolveTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {isResolving ? t('processing') : <><i className="bi bi-check-circle-fill" /> {t('btn_mark_resolved')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
