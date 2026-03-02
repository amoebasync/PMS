'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface SubMenuItem {
  name: string;
  href: string;
  badge?: 'orders' | 'approvals';
}

interface MenuItem {
  name: string;
  href?: string;
  icon: string;
  children?: SubMenuItem[];
  badge?: 'orders' | 'approvals';
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

const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'WORKFLOW',
    items: [
      { name: 'ダッシュボード', href: '/', icon: 'bi-grid-1x2-fill' },
      { name: 'マイ勤怠・経費', href: '/attendance', icon: 'bi-clock-history' },
      { name: 'ディスパッチ', href: '/dispatch', icon: 'bi-diagram-3-fill' },
      { name: 'スケジュール照会', href: '/schedules', icon: 'bi-calendar-check' },
      { name: '受注管理', href: '/orders', icon: 'bi-briefcase-fill', badge: 'orders' },
      { name: '請求管理', href: '/billing', icon: 'bi-receipt-cutoff' },
      {
        name: 'CRM',
        icon: 'bi-people-fill',
        children: [
          { name: 'タスク', href: '/crm/tasks' },
          { name: '見込み客管理', href: '/crm/leads' },
        ],
      },
    ],
  },
  {
    title: 'MASTERS',
    items: [
      { name: '顧客管理', href: '/customers', icon: 'bi-buildings-fill' },
      { name: 'キャンペーン', href: '/campaigns', icon: 'bi-megaphone-fill' },
      { name: 'エリア管理', href: '/areas', icon: 'bi-geo-alt-fill' },
      { name: 'チラシ管理', href: '/flyers', icon: 'bi-file-earmark-richtext' },
      { name: '入出庫・納品管理', href: '/transactions', icon: 'bi-box-seam' },
      { name: '外注先マスタ', href: '/partners', icon: 'bi-truck' },
    ],
  },
  {
    title: 'QUALITY',
    items: [
      { name: 'クレーム管理', href: '/quality/complaints', icon: 'bi-exclamation-triangle-fill' },
      { name: '配布禁止物件', href: '/quality/prohibited-properties', icon: 'bi-house-x-fill' },
    ],
  },
  {
    title: 'ORGANIZATION',
    items: [
      { name: '社員管理', href: '/employees', icon: 'bi-person-badge-fill' },
      {
        name: '配布員',
        icon: 'bi-bicycle',
        children: [
          { name: '配布員管理', href: '/distributors' },
          { name: '配布員給与', href: '/distributors/payroll' },
        ],
      },
      { name: '応募者管理', href: '/applicants', icon: 'bi-person-lines-fill' },
      { name: '支店管理', href: '/branches', icon: 'bi-shop' },
      { name: '人事・経費承認', href: '/approvals', icon: 'bi-check2-square', badge: 'approvals' },
      { name: '給与計算', href: '/payroll', icon: 'bi-cash-stack' },
      { name: 'システム設定', href: '/settings', icon: 'bi-gear-fill' },
      { name: '監査ログ', href: '/audit-logs', icon: 'bi-shield-check' },
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

  // Accordion (expanded mode)
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  // Flyout (collapsed mode)
  const [flyoutItem, setFlyoutItem] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  /* ---- Badge fetch ---- */
  useEffect(() => {
    fetch('/api/orders/pending-count').then(r => r.json()).then(d => setOrderPendingCount(d.count || 0)).catch(() => {});
    fetch('/api/approvals/pending-count').then(r => r.json()).then(d => setApprovalPendingCount(d.total || 0)).catch(() => {});
  }, [pathname]);

  /* ---- Auto-open accordion for the active parent ---- */
  useEffect(() => {
    const next = new Set(openAccordions);
    for (const g of MENU_GROUPS) {
      for (const item of g.items) {
        if (item.children?.some(c => isHrefActive(c.href, pathname))) {
          next.add(item.name);
        }
      }
    }
    if (next.size !== openAccordions.size || [...next].some(v => !openAccordions.has(v))) {
      setOpenAccordions(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /* ---- Close flyout on outside click ---- */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (flyoutRef.current?.contains(t) || sidebarRef.current?.contains(t)) return;
      setFlyoutItem(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ---- Close flyout when sidebar expands ---- */
  useEffect(() => { if (!isCollapsed) setFlyoutItem(null); }, [isCollapsed]);

  /* ---- Helpers ---- */
  const getBadge = (badge?: string) => {
    if (badge === 'orders') return orderPendingCount;
    if (badge === 'approvals') return approvalPendingCount;
    return 0;
  };

  const toggleAccordion = useCallback((name: string) => {
    setOpenAccordions(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const handleFlyout = useCallback((name: string, e: React.MouseEvent) => {
    if (flyoutItem === name) { setFlyoutItem(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyoutTop(rect.top);
    setFlyoutItem(name);
  }, [flyoutItem]);

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
        <div className="flex-1 py-3 overflow-y-auto sidebar-scrollbar">
          {MENU_GROUPS.map((group, gIdx) => (
            <div key={group.title} className={isCollapsed ? 'px-2 mb-1' : 'px-3 mb-1'}>

              {/* Group header */}
              {!isCollapsed && (
                <div className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 select-none">
                  {group.title}
                </div>
              )}
              {isCollapsed && gIdx > 0 && <div className="my-2 mx-1.5 border-t border-gray-100" />}

              {/* Items */}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <SidebarItem
                    key={item.name}
                    item={item}
                    pathname={pathname}
                    isCollapsed={isCollapsed}
                    isOpen={openAccordions.has(item.name)}
                    onToggle={toggleAccordion}
                    onFlyout={handleFlyout}
                    getBadge={getBadge}
                    onMobileClose={onMobileClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Flyout popover (collapsed mode) ── */}
      {isCollapsed && flyoutItem && (() => {
        const item = MENU_GROUPS.flatMap(g => g.items).find(i => i.name === flyoutItem && i.children);
        if (!item?.children) return null;
        return (
          <div
            ref={flyoutRef}
            className="fixed z-[1100] bg-white rounded-xl shadow-lg border border-gray-200/80 py-1.5 min-w-[180px] animate-in fade-in slide-in-from-left-1 duration-150"
            style={{ left: 80, top: flyoutTop }}
          >
            <div className="px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 select-none">
              {item.name}
            </div>
            {item.children.map(child => {
              const active = isHrefActive(child.href, pathname);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setFlyoutItem(null)}
                  className={`
                    flex items-center gap-2 px-3.5 py-2 text-[13px] transition-colors mx-1.5 rounded-lg
                    ${active
                      ? 'text-blue-700 font-semibold bg-blue-50'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                  <span>{child.name}</span>
                </Link>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}

/* ================================================================== */
/*  SidebarItem – single menu item (with optional accordion)          */
/* ================================================================== */

function SidebarItem({
  item,
  pathname,
  isCollapsed,
  isOpen,
  onToggle,
  onFlyout,
  getBadge,
  onMobileClose,
}: {
  item: MenuItem;
  pathname: string;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: (name: string) => void;
  onFlyout: (name: string, e: React.MouseEvent) => void;
  getBadge: (badge?: string) => number;
  onMobileClose?: () => void;
}) {
  const hasChildren = !!item.children;
  const active = hasChildren
    ? item.children!.some(c => isHrefActive(c.href, pathname))
    : item.href ? isHrefActive(item.href, pathname) : false;
  const badgeCount = getBadge(item.badge);

  /* ─────── Collapsed ─────── */
  if (isCollapsed) {
    // Item with children → flyout trigger
    if (hasChildren) {
      return (
        <button
          onClick={(e) => onFlyout(item.name, e)}
          className={`
            w-full flex items-center justify-center py-2.5 rounded-xl transition-all duration-150 group relative
            ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'}
          `}
          title={item.name}
        >
          <i className={`${item.icon} text-[17px]`} />
          {/* Small triangle indicator for "has submenu" */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-30" />
        </button>
      );
    }

    // Simple link
    return (
      <Link
        href={item.href!}
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
    );
  }

  /* ─────── Expanded ─────── */

  // Item with children → accordion
  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => onToggle(item.name)}
          className={`
            w-full flex items-center gap-3 py-2 px-3 rounded-xl text-left transition-all duration-150 group
            ${active ? 'bg-blue-50/70 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
          `}
        >
          <i className={`${item.icon} text-[15px] w-5 text-center shrink-0 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
          <span className="text-[13px] font-medium flex-1">{item.name}</span>
          <i className={`bi bi-chevron-down text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${active ? 'text-blue-400' : 'text-gray-300'}`} />
        </button>

        {/* Accordion body */}
        <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="ml-[22px] pl-3.5 border-l-[2px] border-gray-100 mt-0.5 mb-1 space-y-0.5">
            {item.children!.map(child => {
              const childActive = isHrefActive(child.href, pathname);
              const childBadge = getBadge(child.badge);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onMobileClose}
                  className={`
                    flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-[13px] transition-all duration-150
                    ${childActive
                      ? 'text-blue-700 font-semibold bg-blue-50/60'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}
                  `}
                >
                  {childActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                  <span className={!childActive ? 'ml-3.5' : ''}>{child.name}</span>
                  {childBadge > 0 && (
                    <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {childBadge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Simple link
  return (
    <Link
      href={item.href!}
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
}
