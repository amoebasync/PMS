'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface MenuItem {
  nameKey: string;
  href: string;
  icon: string;
  badge?: 'orders' | 'approvals' | 'alerts';
  superAdminOnly?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Menu definition                                                   */
/* ------------------------------------------------------------------ */

const PINNED_ITEMS: MenuItem[] = [
  { nameKey: 'dashboard', href: '/', icon: 'bi-grid-1x2-fill' },
  { nameKey: 'my_attendance', href: '/attendance', icon: 'bi-clock-history' },
  { nameKey: 'tasks', href: '/crm/tasks', icon: 'bi-list-task' },
];

const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'SALES',
    items: [
      { nameKey: 'order_management', href: '/orders', icon: 'bi-briefcase-fill', badge: 'orders' },
      { nameKey: 'customer_management', href: '/customers', icon: 'bi-buildings-fill' },
      { nameKey: 'lead_management', href: '/crm/leads', icon: 'bi-person-plus-fill' },
      { nameKey: 'campaigns', href: '/campaigns', icon: 'bi-megaphone-fill' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { nameKey: 'dispatch', href: '/dispatch', icon: 'bi-diagram-3-fill' },
      { nameKey: 'schedule_inquiry', href: '/schedules', icon: 'bi-calendar-check' },
      { nameKey: 'data_import', href: '/schedules/import', icon: 'bi-file-earmark-arrow-up' },
      { nameKey: 'area_management', href: '/areas', icon: 'bi-geo-alt-fill' },
      { nameKey: 'flyer_management', href: '/flyers', icon: 'bi-file-earmark-richtext' },
      { nameKey: 'inventory_management', href: '/transactions', icon: 'bi-box-seam' },
      { nameKey: 'picking_verification', href: '/picking', icon: 'bi-camera-fill' },
      { nameKey: 'partner_management', href: '/partners', icon: 'bi-truck' },
      { nameKey: 'distributor_management', href: '/distributors', icon: 'bi-bicycle' },
      { nameKey: 'shift_management', href: '/distributor-shifts', icon: 'bi-calendar-week' },
      { nameKey: 'relay_management', href: '/relay', icon: 'bi-arrow-left-right' },
    ],
  },
  {
    title: 'QUALITY',
    items: [
      { nameKey: 'alerts', href: '/alerts', icon: 'bi-bell-fill', badge: 'alerts' },
      { nameKey: 'complaint_management', href: '/quality/complaints', icon: 'bi-exclamation-triangle-fill' },
      { nameKey: 'prohibited_properties', href: '/quality/prohibited-properties', icon: 'bi-house-x-fill' },
      { nameKey: 'fraud_detection', href: '/quality/fraud-detection', icon: 'bi-shield-exclamation' },
    ],
  },
  {
    title: 'HUMAN RESOURCES',
    items: [
      { nameKey: 'employee_management', href: '/employees', icon: 'bi-person-badge-fill' },
      { nameKey: 'applicant_management', href: '/applicants', icon: 'bi-person-lines-fill' },
      { nameKey: 'branch_management', href: '/branches', icon: 'bi-shop' },
      { nameKey: 'hr_expense_approval', href: '/approvals', icon: 'bi-check2-square', badge: 'approvals' },
    ],
  },
  {
    title: 'ACCOUNTING',
    items: [
      { nameKey: 'billing_management', href: '/billing', icon: 'bi-receipt-cutoff' },
      { nameKey: 'payroll', href: '/payroll', icon: 'bi-cash-stack' },
      { nameKey: 'distributor_payroll', href: '/distributors/payroll', icon: 'bi-wallet2' },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { nameKey: 'area_analytics', href: '/analytics/areas', icon: 'bi-bar-chart-line-fill' },
      { nameKey: 'distribution_analytics', href: '/analytics/distribution', icon: 'bi-graph-up' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { nameKey: 'line_integration', href: '/line', icon: 'bi-chat-dots-fill' },
      { nameKey: 'system_settings', href: '/settings', icon: 'bi-gear-fill' },
      { nameKey: 'audit_logs', href: '/audit-logs', icon: 'bi-shield-check', superAdminOnly: true },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isHrefActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/distributors') {
    return pathname === '/distributors' || (pathname.startsWith('/distributors/') && !pathname.startsWith('/distributors/payroll'));
  }
  if (href === '/schedules') {
    return pathname === '/schedules' || (pathname.startsWith('/schedules/') && !pathname.startsWith('/schedules/import'));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function Sidebar({ isCollapsed, toggleCollapse, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation('sidebar');

  // Badge counts
  const [orderPendingCount, setOrderPendingCount] = useState(0);
  const [approvalPendingCount, setApprovalPendingCount] = useState(0);
  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);

  // Flyout (collapsed mode)
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ---- Badge fetch + role check ---- */
  useEffect(() => {
    fetch('/api/orders/pending-count').then(r => r.json()).then(d => setOrderPendingCount(d.count || 0)).catch(() => {});
    fetch('/api/approvals/pending-count').then(r => r.json()).then(d => setApprovalPendingCount(d.total || 0)).catch(() => {});
    fetch('/api/alerts/summary').then(r => r.json()).then(d => setOpenAlertCount(d.total || 0)).catch(() => {});
    fetch('/api/profile').then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        const roles = data.roles?.map((r: any) => r.role?.code) || [];
        setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
        setIsDriver(roles.includes('DRIVER'));
      }
    }).catch(() => {});
  }, [pathname]);

  /* ---- Scroll-only scrollbar visibility ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      el.classList.add('is-scrolling');
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => el.classList.remove('is-scrolling'), 800);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  /* ---- Close flyout on outside click ---- */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (flyoutRef.current?.contains(target) || sidebarRef.current?.contains(target)) return;
      setFlyoutGroup(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ---- Close flyout when sidebar expands ---- */
  useEffect(() => { if (!isCollapsed) setFlyoutGroup(null); }, [isCollapsed]);

  /* ---- Helpers ---- */
  const getBadge = (badge?: string) => {
    if (badge === 'orders') return orderPendingCount;
    if (badge === 'approvals') return approvalPendingCount;
    if (badge === 'alerts') return openAlertCount;
    return 0;
  };

  const handleGroupFlyout = useCallback((title: string, e: React.MouseEvent) => {
    if (flyoutGroup === title) { setFlyoutGroup(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyoutTop(rect.top);
    setFlyoutGroup(title);
  }, [flyoutGroup]);

  if (pathname === '/login') return null;

  // DRIVER: 限定メニュー（マイ勤怠・タスク・中継/回収管理のみ）
  const DRIVER_ALLOWED_HREFS = ['/attendance', '/crm/tasks', '/relay'];
  const effectivePinned = isDriver
    ? PINNED_ITEMS.filter(item => DRIVER_ALLOWED_HREFS.includes(item.href))
    : PINNED_ITEMS;
  const effectiveGroups = isDriver
    ? MENU_GROUPS.map(g => ({
        ...g,
        items: g.items.filter(item => DRIVER_ALLOWED_HREFS.includes(item.href)),
      })).filter(g => g.items.length > 0)
    : MENU_GROUPS;

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <>
      {/* Mobile overlay (backdrop) */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto z-[120]' : 'opacity-0 pointer-events-none z-[120]'
        }`}
        onClick={onMobileClose}
      />

      <nav
        ref={sidebarRef}
        role="navigation"
        aria-label="メインナビゲーション"
        className={`
          h-screen bg-white fixed left-0 top-0 flex flex-col
          border-r border-slate-200/60
          transition-all duration-300 ease-in-out
          md:z-[100]
          ${isCollapsed ? 'md:w-[72px]' : 'md:w-[240px]'}
          w-[280px] md:w-auto
          ${isMobileOpen ? 'translate-x-0 z-[120]' : '-translate-x-full md:translate-x-0 z-[100]'}
        `}
      >
        {/* ── Logo ── */}
        <div className={`h-[64px] flex items-center border-b border-slate-100 shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-5'}`}>
          <Link href="/" className="flex items-center gap-2.5" onClick={onMobileClose}>
            <div className="relative w-7 h-7 shrink-0">
              <Image src="/logo/logo_Icon_transparent.png" alt="PMS" fill className="object-contain" priority />
            </div>
            <span className={`font-extrabold text-slate-900 text-lg tracking-wide whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'hidden' : ''}`}>
              PMS <span className="text-blue-600">Pro</span>
            </span>
          </Link>
        </div>

        {/* ── Collapse toggle (desktop) ── */}
        <button
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-[28px] w-6 h-6 bg-white border border-slate-200 rounded-full
                     flex items-center justify-center text-slate-400 shadow-sm
                     hover:bg-slate-50 hover:text-slate-700 transition-colors z-[110] hidden md:flex"
        >
          <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'} text-[10px]`} />
        </button>

        {/* ── Navigation ── */}
        <div ref={scrollRef} className="flex-1 py-3 overflow-y-auto sidebar-scrollbar">

          {/* ── Pinned items (always visible, no group) ── */}
          <div className={isCollapsed ? 'px-2 mb-1' : 'px-3 mb-1'}>
            <div className="space-y-0.5">
              {effectivePinned.map(item => {
                const active = isHrefActive(item.href, pathname);
                const badgeCount = getBadge(item.badge);
                const label = t(item.nameKey);
                return isCollapsed ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={label}
                    onClick={onMobileClose}
                    className={`
                      flex items-center justify-center py-2.5 rounded-xl transition-all duration-150 group relative
                      ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}
                    `}
                  >
                    <i className={`${item.icon} text-[17px]`} />
                    {badgeCount > 0 && (
                      <div className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
                    )}
                  </Link>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={`
                      flex items-center gap-3 py-2.5 md:py-2 px-3 rounded-xl transition-all duration-150 group relative
                      ${active ? 'bg-blue-50/70 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                    `}
                  >
                    {active && <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />}
                    <i className={`${item.icon} text-[15px] w-5 text-center shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500 transition-colors'}`} />
                    <span className="text-[13px] flex-1 truncate">{label}</span>
                    {badgeCount > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── Menu groups ── */}
          {effectiveGroups.map((group) => {
            const visibleItems = group.items.filter(item => !item.superAdminOnly || isSuperAdmin);
            if (visibleItems.length === 0) return null;
            const filteredGroup = { ...group, items: visibleItems };
            const groupHasBadge = filteredGroup.items.some(item => item.badge && getBadge(item.badge) > 0);

            return (
              <div key={group.title} className={isCollapsed ? 'px-2 mb-1' : 'px-3 mb-1'}>

                {/* ── Collapsed: separator + flyout trigger ── */}
                {isCollapsed && (
                  <>
                    <div className="my-2 mx-1.5 border-t border-slate-100" />
                    <button
                      onClick={(e) => handleGroupFlyout(group.title, e)}
                      title={group.title}
                      aria-label={group.title}
                      className={`
                        w-full flex items-center justify-center py-2.5 rounded-xl transition-all duration-150 group relative
                        ${filteredGroup.items.some(item => isHrefActive(item.href, pathname)) ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}
                      `}
                    >
                      <i className={`${filteredGroup.items[0].icon} text-[17px]`} />
                      {groupHasBadge && (
                        <div className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
                      )}
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-30" />
                    </button>
                  </>
                )}

                {/* ── Expanded: static group header + items ── */}
                {!isCollapsed && (
                  <>
                    <div className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 select-none">
                      {group.title}
                    </div>
                    <div className="space-y-0.5">
                      {filteredGroup.items.map(item => {
                        const active = isHrefActive(item.href, pathname);
                        const badgeCount = getBadge(item.badge);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onMobileClose}
                            className={`
                              flex items-center gap-3 py-2.5 md:py-2 px-3 rounded-xl transition-all duration-150 group relative
                              ${active ? 'bg-blue-50/70 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                            `}
                          >
                            {active && <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />}
                            <i className={`${item.icon} text-[15px] w-5 text-center shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500 transition-colors'}`} />
                            <span className="text-[13px] flex-1 truncate">{t(item.nameKey)}</span>
                            {badgeCount > 0 && (
                              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                {badgeCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── Flyout popover (collapsed mode) ── */}
      {isCollapsed && flyoutGroup && (() => {
        const group = MENU_GROUPS.find(g => g.title === flyoutGroup);
        if (!group) return null;
        const flyoutItems = group.items.filter(item => !item.superAdminOnly || isSuperAdmin);
        if (flyoutItems.length === 0) return null;
        return (
          <div
            ref={flyoutRef}
            className="fixed z-[120] bg-white rounded-xl shadow-lg border border-slate-200/80 py-1.5 min-w-[180px] animate-in fade-in slide-in-from-left-1 duration-150"
            style={{ left: 80, top: flyoutTop }}
          >
            <div className="px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 select-none">
              {group.title}
            </div>
            {flyoutItems.map(item => {
              const active = isHrefActive(item.href, pathname);
              const badgeCount = getBadge(item.badge);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setFlyoutGroup(null)}
                  className={`
                    flex items-center gap-2 px-3.5 py-2 text-[13px] transition-colors mx-1.5 rounded-lg
                    ${active
                      ? 'text-blue-700 font-semibold bg-blue-50'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <i className={`${item.icon} text-[13px] w-4 text-center shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="flex-1">{t(item.nameKey)}</span>
                  {badgeCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
