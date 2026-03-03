'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface MenuItem {
  name: string;
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
  { name: 'ダッシュボード', href: '/', icon: 'bi-grid-1x2-fill' },
  { name: 'マイ勤怠・経費', href: '/attendance', icon: 'bi-clock-history' },
  { name: 'タスク', href: '/crm/tasks', icon: 'bi-list-task' },
];

const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'SALES',
    items: [
      { name: '受注管理', href: '/orders', icon: 'bi-briefcase-fill', badge: 'orders' },
      { name: '顧客管理', href: '/customers', icon: 'bi-buildings-fill' },
      { name: '見込み客管理', href: '/crm/leads', icon: 'bi-person-plus-fill' },
      { name: 'キャンペーン', href: '/campaigns', icon: 'bi-megaphone-fill' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { name: 'ディスパッチ', href: '/dispatch', icon: 'bi-diagram-3-fill' },
      { name: 'スケジュール照会', href: '/schedules', icon: 'bi-calendar-check' },
      { name: 'エリア管理', href: '/areas', icon: 'bi-geo-alt-fill' },
      { name: 'チラシ管理', href: '/flyers', icon: 'bi-file-earmark-richtext' },
      { name: '入出庫・納品管理', href: '/transactions', icon: 'bi-box-seam' },
      { name: '外注先マスタ', href: '/partners', icon: 'bi-truck' },
      { name: '配布員管理', href: '/distributors', icon: 'bi-bicycle' },
      { name: 'シフト管理', href: '/distributor-shifts', icon: 'bi-calendar-week' },
    ],
  },
  {
    title: 'QUALITY',
    items: [
      { name: 'アラート', href: '/alerts', icon: 'bi-bell-fill', badge: 'alerts' },
      { name: 'クレーム管理', href: '/quality/complaints', icon: 'bi-exclamation-triangle-fill' },
      { name: '配布禁止物件', href: '/quality/prohibited-properties', icon: 'bi-house-x-fill' },
    ],
  },
  {
    title: 'HUMAN RESOURCES',
    items: [
      { name: '社員管理', href: '/employees', icon: 'bi-person-badge-fill' },
      { name: '応募者管理', href: '/applicants', icon: 'bi-person-lines-fill' },
      { name: '支店管理', href: '/branches', icon: 'bi-shop' },
      { name: '人事・経費承認', href: '/approvals', icon: 'bi-check2-square', badge: 'approvals' },
    ],
  },
  {
    title: 'ACCOUNTING',
    items: [
      { name: '請求管理', href: '/billing', icon: 'bi-receipt-cutoff' },
      { name: '給与計算', href: '/payroll', icon: 'bi-cash-stack' },
      { name: '配布員給与', href: '/distributors/payroll', icon: 'bi-wallet2' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { name: 'システム設定', href: '/settings', icon: 'bi-gear-fill' },
      { name: '監査ログ', href: '/audit-logs', icon: 'bi-shield-check', superAdminOnly: true },
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
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function Sidebar({ isCollapsed, toggleCollapse, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  // Badge counts
  const [orderPendingCount, setOrderPendingCount] = useState(0);
  const [approvalPendingCount, setApprovalPendingCount] = useState(0);
  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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
      const t = e.target as Node;
      if (flyoutRef.current?.contains(t) || sidebarRef.current?.contains(t)) return;
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

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999] md:hidden" onClick={onMobileClose} />
      )}

      <nav
        ref={sidebarRef}
        className={`
          h-screen bg-white fixed left-0 top-0 z-[1000] flex flex-col
          border-r border-gray-200/60
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'md:w-[72px]' : 'md:w-[240px]'}
          w-[240px]
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* ── Logo ── */}
        <div className={`h-[64px] flex items-center border-b border-gray-100 shrink-0 ${isCollapsed ? 'justify-center px-0' : 'px-5'}`}>
          <Link href="/" className="flex items-center gap-2.5" onClick={onMobileClose}>
            <div className="relative w-7 h-7 shrink-0">
              <Image src="/logo/logo_Icon_transparent.png" alt="PMS" fill className="object-contain" priority />
            </div>
            <span className={`font-extrabold text-gray-900 text-lg tracking-wide whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'hidden' : ''}`}>
              PMS <span className="text-blue-600">Pro</span>
            </span>
          </Link>
        </div>

        {/* ── Collapse toggle (desktop) ── */}
        <button
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
          className="absolute -right-3 top-[28px] w-6 h-6 bg-white border border-gray-200 rounded-full
                     flex items-center justify-center text-gray-400 shadow-sm
                     hover:bg-gray-50 hover:text-gray-700 transition-colors z-[1010] hidden md:flex"
        >
          <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'} text-[10px]`} />
        </button>

        {/* ── Navigation ── */}
        <div ref={scrollRef} className="flex-1 py-3 overflow-y-auto sidebar-scrollbar">

          {/* ── Pinned items (always visible, no group) ── */}
          <div className={isCollapsed ? 'px-2 mb-1' : 'px-3 mb-1'}>
            <div className="space-y-0.5">
              {PINNED_ITEMS.map(item => {
                const active = isHrefActive(item.href, pathname);
                const badgeCount = getBadge(item.badge);
                return isCollapsed ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    onClick={onMobileClose}
                    className={`
                      flex items-center justify-center py-2.5 rounded-xl transition-all duration-150 group relative
                      ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'}
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
                      flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-150 group relative
                      ${active ? 'bg-blue-50/70 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                  >
                    {active && <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />}
                    <i className={`${item.icon} text-[15px] w-5 text-center shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500 transition-colors'}`} />
                    <span className="text-[13px] flex-1">{item.name}</span>
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
          {MENU_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => !item.superAdminOnly || isSuperAdmin);
            if (visibleItems.length === 0) return null;
            const filteredGroup = { ...group, items: visibleItems };
            const groupHasBadge = filteredGroup.items.some(item => item.badge && getBadge(item.badge) > 0);

            return (
              <div key={group.title} className={isCollapsed ? 'px-2 mb-1' : 'px-3 mb-1'}>

                {/* ── Collapsed: separator + flyout trigger ── */}
                {isCollapsed && (
                  <>
                    <div className="my-2 mx-1.5 border-t border-gray-100" />
                    <button
                      onClick={(e) => handleGroupFlyout(group.title, e)}
                      title={group.title}
                      className={`
                        w-full flex items-center justify-center py-2.5 rounded-xl transition-all duration-150 group relative
                        ${filteredGroup.items.some(item => isHrefActive(item.href, pathname)) ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'}
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
                    <div className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 select-none">
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
                              flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-150 group relative
                              ${active ? 'bg-blue-50/70 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                            `}
                          >
                            {active && <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />}
                            <i className={`${item.icon} text-[15px] w-5 text-center shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500 transition-colors'}`} />
                            <span className="text-[13px] flex-1">{item.name}</span>
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
            className="fixed z-[1100] bg-white rounded-xl shadow-lg border border-gray-200/80 py-1.5 min-w-[180px] animate-in fade-in slide-in-from-left-1 duration-150"
            style={{ left: 80, top: flyoutTop }}
          >
            <div className="px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">
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
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <i className={`${item.icon} text-[13px] w-4 text-center shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="flex-1">{item.name}</span>
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

