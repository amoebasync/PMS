'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const CATEGORY_STYLE: Record<string, { labelKey: string; icon: string; bgColor: string; textColor: string; badgeBg: string; badgeText: string }> = {
  UPDATE:      { labelKey: 'category_update',      icon: 'bi-stars',                    bgColor: 'bg-indigo-50',  textColor: 'text-indigo-500',  badgeBg: 'bg-indigo-50',  badgeText: 'text-indigo-600' },
  MAINTENANCE: { labelKey: 'category_maintenance',  icon: 'bi-tools',                     bgColor: 'bg-rose-50',    textColor: 'text-rose-500',    badgeBg: 'bg-rose-50',    badgeText: 'text-rose-600' },
  IMPORTANT:   { labelKey: 'category_important',    icon: 'bi-exclamation-triangle-fill', bgColor: 'bg-amber-50',   textColor: 'text-amber-500',   badgeBg: 'bg-amber-50',   badgeText: 'text-amber-700' },
  NOTICE:      { labelKey: 'category_notice',       icon: 'bi-bell-fill',                 bgColor: 'bg-emerald-50', textColor: 'text-emerald-500', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-600' },
  OTHER:       { labelKey: 'category_other',        icon: 'bi-megaphone-fill',            bgColor: 'bg-slate-50',   textColor: 'text-slate-400',   badgeBg: 'bg-slate-100',  badgeText: 'text-slate-600' },
};

/* ------------------------------------------------------------------ */
/*  StatCard                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ title, value, subValue, icon, accentColor }: {
  title: string;
  value: string | number;
  subValue?: React.ReactNode;
  icon: string;
  accentColor: 'blue' | 'emerald' | 'violet' | 'slate';
}) {
  const colors = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600' },
    slate:   { bg: 'bg-slate-100',  text: 'text-slate-500' },
  };
  const c = colors[accentColor];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 md:p-5 flex flex-col justify-between h-full hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow duration-200">
      <div className="flex justify-between items-start mb-2 md:mb-3">
        <span className="text-slate-500 text-[11px] md:text-xs font-medium tracking-wide">{title}</span>
        <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
          <i className={`bi ${icon} text-[14px] md:text-[16px]`} />
        </div>
      </div>
      <div>
        <div className="text-xl md:text-[26px] font-extrabold text-slate-800 tracking-tight leading-none">{value}</div>
        {subValue && (
          <div className="text-[10px] md:text-[11px] mt-1.5 md:mt-2 text-slate-400 font-medium">{subValue}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AlertCard                                                         */
/* ------------------------------------------------------------------ */

function AlertCard({ href, icon, title, message, count, countSuffix, color }: {
  href: string;
  icon: string;
  title: string;
  message: string;
  count: number;
  countSuffix?: string;
  color: 'orange' | 'rose' | 'red' | 'purple';
}) {
  const styles = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-200/60', iconBg: 'bg-orange-100', iconText: 'text-orange-600', titleText: 'text-orange-800', bodyText: 'text-orange-600', countText: 'text-orange-700', hoverBg: 'hover:bg-orange-100/50', chevron: 'text-orange-300 group-hover:text-orange-500' },
    rose:   { bg: 'bg-rose-50',   border: 'border-rose-200/60',   iconBg: 'bg-rose-100',   iconText: 'text-rose-600',   titleText: 'text-rose-800',   bodyText: 'text-rose-600',   countText: 'text-rose-700',   hoverBg: 'hover:bg-rose-100/50',   chevron: 'text-rose-300 group-hover:text-rose-500' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200/60',    iconBg: 'bg-red-100',    iconText: 'text-red-600',    titleText: 'text-red-800',    bodyText: 'text-red-600',    countText: 'text-red-700',    hoverBg: 'hover:bg-red-100/50',    chevron: 'text-red-300 group-hover:text-red-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200/60', iconBg: 'bg-purple-100', iconText: 'text-purple-600', titleText: 'text-purple-800', bodyText: 'text-purple-600', countText: 'text-purple-700', hoverBg: 'hover:bg-purple-100/50', chevron: 'text-purple-300 group-hover:text-purple-500' },
  };
  const s = styles[color];

  return (
    <Link href={href} className={`${s.bg} border ${s.border} p-4 rounded-2xl flex items-center justify-between group ${s.hoverBg} transition-colors`}>
      <div className="flex items-center gap-3.5">
        <div className={`w-10 h-10 ${s.iconBg} ${s.iconText} rounded-xl flex items-center justify-center text-lg shrink-0`}>
          <i className={`bi ${icon}`} />
        </div>
        <div>
          <h4 className={`font-bold ${s.titleText} text-sm`}>{title}</h4>
          <p className={`text-xs ${s.bodyText} mt-0.5`}>
            {message} <span className={`font-extrabold text-base ${s.countText}`}>{count}</span> {countSuffix}
          </p>
        </div>
      </div>
      <i className={`bi bi-chevron-right ${s.chevron} transition-colors`} />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                         */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // ブロッキングアナウンスメント
  const [blockingAnnouncements, setBlockingAnnouncements] = useState<any[]>([]);
  const [blockingIndex, setBlockingIndex] = useState(0);
  const [showBlocking, setShowBlocking] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dashRes, announcementsRes, profileRes, blockingRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/announcements'),
          fetch('/api/profile'),
          fetch('/api/announcements/blocking'),
        ]);
        if (dashRes.ok) setData(await dashRes.json());
        if (announcementsRes.ok) {
          const ann = await announcementsRes.json();
          setAnnouncements(Array.isArray(ann) ? ann : []);
        }
        if (profileRes.ok) {
          const profile = await profileRes.json();
          const roles: string[] = profile?.roles?.map((r: any) => r.role?.code) || [];
          const primaryRoleCode: string = profile?.role?.code || '';
          setIsSuperAdmin(roles.includes('SUPER_ADMIN') || primaryRoleCode === 'SUPER_ADMIN');
        }
        if (blockingRes.ok) {
          const blockingData = await blockingRes.json();
          const items = blockingData.announcements || [];
          if (items.length > 0) {
            // sessionStorage で「次回読む」を管理
            const dismissed = JSON.parse(sessionStorage.getItem('blocking_dismissed') || '[]');
            const filtered = items.filter((a: any) => !dismissed.includes(a.id));
            setBlockingAnnouncements(filtered);
            if (filtered.length > 0) {
              setBlockingIndex(0);
              setShowBlocking(true);
            }
          }
        }
      } catch (e) { console.error(e); }
    };
    fetchDashboardData();

    const checkHealth = async () => {
      try {
        setDbStatus('checking');
        const res = await fetch('/api/health');
        const hData = await res.json();
        if (res.ok && hData.status === 'ok') {
          setDbStatus('connected'); setLatency(hData.db_latency);
        } else {
          setDbStatus('disconnected'); setLatency(null);
        }
      } catch { setDbStatus('disconnected'); setLatency(null); }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async () => {
    const current = blockingAnnouncements[blockingIndex];
    if (!current) return;
    setMarkingRead(true);
    try {
      await fetch(`/api/announcements/${current.id}/read`, { method: 'POST' });
      const remaining = blockingAnnouncements.filter((_: any, i: number) => i !== blockingIndex);
      setBlockingAnnouncements(remaining);
      if (remaining.length === 0) {
        setShowBlocking(false);
      } else {
        setBlockingIndex(Math.min(blockingIndex, remaining.length - 1));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingRead(false);
    }
  };

  const handleReadLater = () => {
    // sessionStorage に保存してセッション中はスキップ
    const dismissed = JSON.parse(sessionStorage.getItem('blocking_dismissed') || '[]');
    const ids = blockingAnnouncements.map((a: any) => a.id);
    sessionStorage.setItem('blocking_dismissed', JSON.stringify([...dismissed, ...ids]));
    setShowBlocking(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10 max-w-7xl mx-auto">

      {/* ── Blocking Announcement Overlay ── */}
      {showBlocking && blockingAnnouncements.length > 0 && (() => {
        const current = blockingAnnouncements[blockingIndex];
        const cfg = CATEGORY_STYLE[current.category] || CATEGORY_STYLE.OTHER;
        const dateStr = new Date(current.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).replace(/\//g, '/');
        return (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <i className="bi bi-megaphone-fill text-lg"></i>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">{t('blocking_announcement_title')}</h3>
                    {blockingAnnouncements.length > 1 && (
                      <span className="text-xs text-slate-400 font-mono">
                        {t('blocking_page_indicator', { current: blockingIndex + 1, total: blockingAnnouncements.length })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-bold ${cfg.badgeText} ${cfg.badgeBg} px-2 py-0.5 rounded`}>{t(cfg.labelKey)}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{dateStr}</span>
                </div>
                <h4 className="font-bold text-slate-800 text-xl mb-4">{current.title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{current.content}</p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={handleReadLater}
                  className="px-4 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-sm transition-colors"
                >
                  {t('blocking_read_later')}
                </button>
                <div className="flex items-center gap-2">
                  {blockingAnnouncements.length > 1 && (
                    <div className="flex gap-1 mr-2">
                      {blockingAnnouncements.map((_: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => setBlockingIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === blockingIndex ? 'bg-indigo-500' : 'bg-slate-300'}`}
                        />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={handleMarkRead}
                    disabled={markingRead}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all"
                  >
                    {markingRead ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <i className="bi bi-check-lg"></i>
                    )}
                    {t('blocking_mark_read')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Alerts ── */}
      {data && (data.alerts.orders > 0 || data.alerts.approvals > 0 || data.crm?.overdueTaskCount > 0 || data.quality?.unresolvedComplaintCount > 0 || data.alertSummary?.openAlertCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.alertSummary?.openAlertCount > 0 && (
            <AlertCard
              href="/alerts"
              icon="bi-bell-fill"
              title={data.alertSummary.criticalAlertCount > 0 ? t('alert_urgent') : t('alert_open')}
              message={t('alert_open_message')}
              countSuffix={t('alert_count_suffix')}
              count={data.alertSummary.openAlertCount}
              color={data.alertSummary.criticalAlertCount > 0 ? 'red' : 'orange'}
            />
          )}
          {data.alerts.orders > 0 && (
            <AlertCard href="/orders" icon="bi-briefcase-fill" title={t('alert_orders_title')} message={t('alert_orders_message')} count={data.alerts.orders} countSuffix={t('alert_count_suffix')} color="orange" />
          )}
          {data.alerts.approvals > 0 && (
            <AlertCard href="/approvals" icon="bi-person-check-fill" title={t('alert_approvals_title')} message={t('alert_approvals_message')} count={data.alerts.approvals} countSuffix={t('alert_count_suffix')} color="rose" />
          )}
          {data.crm?.overdueTaskCount > 0 && (
            <AlertCard href="/crm/tasks?dueDate=overdue" icon="bi-exclamation-triangle-fill" title={t('alert_overdue_title')} message={t('alert_overdue_message')} count={data.crm.overdueTaskCount} countSuffix={t('alert_count_suffix')} color="red" />
          )}
          {data.quality?.unresolvedComplaintCount > 0 && (
            <AlertCard href="/quality/complaints" icon="bi-exclamation-triangle-fill" title={t('alert_complaint_title')} message={t('alert_complaint_message')} count={data.quality.unresolvedComplaintCount} countSuffix={t('alert_count_suffix')} color="purple" />
          )}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('kpi_monthly_sales')}
          value={`¥${(data?.kpi?.monthlySales || 0).toLocaleString()}`}
          icon="bi-currency-yen"
          accentColor="blue"
          subValue={<><i className="bi bi-info-circle mr-1" />{t('kpi_sales_sub')}</>}
        />
        <StatCard
          title={t('kpi_active_staff')}
          value={`${data?.kpi?.distributorsTotal || 0} ${t('kpi_staff_unit')}`}
          icon="bi-bicycle"
          accentColor="emerald"
          subValue={
            <span className={data?.kpi?.distributorsCompleted > 0 ? 'text-emerald-500' : ''}>
              <i className="bi bi-check-circle-fill mr-1" />{t('kpi_staff_completed', { count: data?.kpi?.distributorsCompleted || 0 })}
            </span>
          }
        />
        <StatCard
          title={t('kpi_distribution_tasks')}
          value={`${(data?.kpi?.flyersPlanned || 0).toLocaleString()}${t('kpi_sheets_unit')}`}
          icon="bi-send-fill"
          accentColor="violet"
          subValue={
            <span className={data?.kpi?.flyersActual > 0 ? 'text-violet-500' : ''}>
              <i className="bi bi-check-circle-fill mr-1" />
              {t('kpi_completed_pct', { pct: data?.kpi?.flyersActual ? Math.floor((data.kpi.flyersActual / data.kpi.flyersPlanned) * 100) : 0, count: data?.kpi?.flyersActual?.toLocaleString() || 0 })}
            </span>
          }
        />
        <StatCard
          title={t('kpi_managed_areas')}
          value={t('kpi_areas_value')}
          icon="bi-geo-alt-fill"
          accentColor="slate"
          subValue={<><i className="bi bi-house-heart mr-1" />{t('kpi_households')}</>}
        />
      </div>

      {/* ── Main content 2-column ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Announcements */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <i className="bi bi-megaphone-fill text-indigo-500" /> {t('announcements_title')}
            </h3>
            {isSuperAdmin && (
              <Link
                href="/announcements"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
              >
                <i className="bi bi-gear-fill text-[10px]" /> {t('announcements_manage')}
              </Link>
            )}
          </div>
          <div className="p-6 space-y-5 flex-1">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                  <i className="bi bi-megaphone text-xl" />
                </div>
                <p className="text-slate-500 text-sm font-medium">{t('announcements_empty')}</p>
                {isSuperAdmin && (
                  <Link href="/announcements" className="mt-2 text-xs text-indigo-500 hover:underline">
                    {t('announcements_post')}
                  </Link>
                )}
              </div>
            ) : (
              announcements.map((a, i) => {
                const cfg = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.OTHER;
                const dateStr = new Date(a.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).replace(/\//g, '/');
                return (
                  <React.Fragment key={a.id}>
                    {i > 0 && <div className="w-full h-px bg-slate-100" />}
                    <div className="flex gap-4 items-start">
                      <div className={`w-10 h-10 ${cfg.bgColor} ${cfg.textColor} rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5`}>
                        <i className={`bi ${cfg.icon}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold ${cfg.badgeText} ${cfg.badgeBg} px-2 py-0.5 rounded`}>{t(cfg.labelKey)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{dateStr}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">{a.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Sidebar panels */}
        <div className="space-y-5">

          {/* Tasks */}
          {data?.crm && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <i className="bi bi-check2-all text-indigo-500" /> {t('tasks_title')}
                </h3>
                <Link href="/crm/tasks" className="text-xs text-blue-600 hover:underline font-medium">{t('tasks_view_all')}</Link>
              </div>
              {data.crm.dueTodayTaskCount > 0 && (
                <div className="mb-3 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-xl font-medium">
                  <i className="bi bi-clock-fill mr-1" /> {t('tasks_due_today', { count: data.crm.dueTodayTaskCount })}
                </div>
              )}
              {data.crm.myTasks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">{t('tasks_none')}</p>
              ) : (
                <div className="space-y-1">
                  {data.crm.myTasks.map((task: any) => {
                    const dueDate = new Date(task.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dueDate.setHours(0, 0, 0, 0);
                    const isOverdue = dueDate < today;
                    return (
                      <div key={task.id} className="flex items-start justify-between gap-2 py-2 border-b border-slate-50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                              {isOverdue && <i className="bi bi-exclamation-triangle-fill mr-0.5" />}
                              {dueDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                            </span>
                            {task.customer && (
                              <span className="text-[10px] text-slate-400">· {task.customer.name}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            await fetch(`/api/tasks/${task.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'DONE' }),
                            });
                            const res = await fetch('/api/dashboard');
                            if (res.ok) setData(await res.json());
                          }}
                          className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-lg transition-colors shrink-0"
                          title={t('tasks_complete')}
                        >
                          <i className="bi bi-check-lg text-base" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Distributor Performance */}
          {data?.evaluation && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <i className="bi bi-award-fill text-amber-500" /> {t('performance_title')}
                </h3>
                <Link href="/distributors" className="text-xs text-blue-600 hover:underline font-medium">{t('performance_view_all')}</Link>
              </div>
              {data.evaluation.topDistributors?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Top 5</p>
                  <div className="space-y-1.5">
                    {data.evaluation.topDistributors.slice(0, 5).map((d: any, i: number) => {
                      const rankColors: Record<string, string> = { S: 'bg-yellow-500', A: 'bg-blue-500', B: 'bg-green-500', C: 'bg-slate-400', D: 'bg-red-400' };
                      return (
                        <div key={d.id || i} className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded text-[10px] font-black text-white flex items-center justify-center ${rankColors[d.rank] || 'bg-slate-300'}`}>
                            {d.rank}
                          </span>
                          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{d.name}</span>
                          <span className="text-sm font-bold text-slate-800">{d.score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {data.evaluation.attentionDistributors?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">{t('performance_attention')}</p>
                  <div className="space-y-1.5">
                    {data.evaluation.attentionDistributors.slice(0, 5).map((d: any, i: number) => (
                      <div key={d.id || i} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 truncate flex-1">{d.name}</span>
                        <span className="text-xs font-bold text-red-500">
                          <i className="bi bi-exclamation-triangle-fill mr-0.5" />{t('performance_complaints', { count: d.complaintCount })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!data.evaluation.topDistributors?.length && !data.evaluation.attentionDistributors?.length) && (
                <p className="text-xs text-slate-400 text-center py-4">{t('performance_no_data')}</p>
              )}
            </div>
          )}

          {/* EC Portal status */}
          {data && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <i className="bi bi-laptop text-fuchsia-500" /> {t('ec_portal_title')}
                </h3>
                {data.ec.activeUsers > 0 && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2.5">
                  <div className="text-xs text-slate-500 font-medium">{t('ec_active_users')} <span className="text-[9px] text-slate-400 ml-1">{t('ec_active_users_suffix')}</span></div>
                  <div className="text-xl font-extrabold text-slate-800 tracking-tight">{data.ec.activeUsers}<span className="text-xs font-medium text-slate-400 ml-0.5">{t('ec_active_users_unit')}</span></div>
                </div>
                <div className="flex justify-between items-end border-b border-slate-100 pb-2.5">
                  <div className="text-xs text-slate-500 font-medium">{t('ec_new_registrations')}</div>
                  <div className="text-base font-bold text-slate-700">{data.ec.newUsersThisMonth}<span className="text-[10px] font-medium text-slate-400 ml-0.5">{t('ec_count_unit')}</span></div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-xs text-slate-500 font-medium">{t('ec_total_accounts')}</div>
                  <div className="text-sm font-bold text-slate-700">{data.ec.totalUsers}<span className="text-[10px] font-medium text-slate-400 ml-0.5">{t('ec_count_unit')}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-15 -mr-8 -mt-8 ${dbStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'}`} />

            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <i className={`bi bi-server text-sm ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
              <div>
                <div className="font-bold text-sm">System Status</div>
                <div className={`text-[10px] font-semibold flex items-center gap-1.5 ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'checking' ? 'bg-yellow-400 animate-ping' : dbStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  {dbStatus === 'connected' ? 'All Systems Operational' : dbStatus === 'checking' ? 'Checking Status...' : 'System Error Detected'}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 relative z-10">
              <div className="flex justify-between items-center text-[11px] border-b border-white/10 pb-2">
                <span className="text-slate-400">Database (RDS)</span>
                <span className={`font-mono font-bold ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dbStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] border-b border-white/10 pb-2">
                <span className="text-slate-400">API Latency</span>
                <span className={`font-mono font-bold ${latency && latency < 100 ? 'text-blue-400' : latency && latency < 500 ? 'text-yellow-400' : 'text-rose-400'}`}>
                  {latency ? `${latency}ms` : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500">Last Check</span>
                <span className="text-slate-400 font-mono">Just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
