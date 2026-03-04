'use client';

import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import { useState, useEffect, useRef } from 'react';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { useNotification } from '@/components/ui/NotificationProvider';
import Link from 'next/link';
import TaskCreateModal from '@/components/TaskCreateModal';
import { LanguageProvider, useLanguage } from '@/i18n';
import { useTranslation } from '@/i18n';
import type { Language } from '@/i18n';

// ページアイコンマップ
const PAGE_ICONS: Record<string, string> = {
  '/':                              'bi-grid-1x2-fill',
  '/attendance':                    'bi-clock-history',
  '/dispatch':                      'bi-diagram-3-fill',
  '/schedules':                     'bi-calendar-check',
  '/orders':                        'bi-briefcase-fill',
  '/billing':                       'bi-receipt-cutoff',
  '/crm/tasks':                     'bi-list-task',
  '/crm/leads':                     'bi-person-plus-fill',
  '/customers':                     'bi-buildings-fill',
  '/campaigns':                     'bi-megaphone-fill',
  '/areas':                         'bi-geo-alt-fill',
  '/flyers':                        'bi-file-earmark-richtext',
  '/transactions':                  'bi-box-seam',
  '/partners':                      'bi-truck',
  '/quality/complaints':            'bi-exclamation-triangle-fill',
  '/quality/prohibited-properties': 'bi-house-x-fill',
  '/employees':                     'bi-person-badge-fill',
  '/distributors':                  'bi-bicycle',
  '/distributor-shifts':            'bi-calendar-week',
  '/distributors/payroll':          'bi-wallet2',
  '/applicants':                    'bi-person-lines-fill',
  '/branches':                      'bi-shop',
  '/approvals':                     'bi-check2-square',
  '/payroll':                       'bi-cash-stack',
  '/settings':                      'bi-gear-fill',
  '/audit-logs':                    'bi-shield-check',
  '/profile':                       'bi-person-gear',
  '/announcements':                 'bi-megaphone',
  '/pricing':                       'bi-tags-fill',
  '/settings/company':              'bi-building',
};

// パス → 翻訳キー（sidebar.json の page_titles）
const PAGE_TITLE_KEYS: Record<string, string> = {
  '/':                              'page_titles.dashboard',
  '/attendance':                    'page_titles.my_attendance',
  '/dispatch':                      'page_titles.dispatch',
  '/schedules':                     'page_titles.schedule_inquiry',
  '/orders':                        'page_titles.order_management',
  '/billing':                       'page_titles.billing_management',
  '/crm/tasks':                     'page_titles.tasks',
  '/crm/leads':                     'page_titles.lead_management',
  '/customers':                     'page_titles.customer_management',
  '/campaigns':                     'page_titles.campaigns',
  '/areas':                         'page_titles.area_management',
  '/flyers':                        'page_titles.flyer_management',
  '/transactions':                  'page_titles.inventory_management',
  '/partners':                      'page_titles.partner_management',
  '/quality/complaints':            'page_titles.complaint_management',
  '/quality/prohibited-properties': 'page_titles.prohibited_properties',
  '/employees':                     'page_titles.employee_management',
  '/distributors':                  'page_titles.distributor_management',
  '/distributor-shifts':            'page_titles.shift_management',
  '/distributors/payroll':          'page_titles.distributor_payroll',
  '/applicants':                    'page_titles.applicant_management',
  '/branches':                      'page_titles.branch_management',
  '/approvals':                     'page_titles.hr_expense_approval',
  '/payroll':                       'page_titles.payroll',
  '/settings':                      'page_titles.system_settings',
  '/audit-logs':                    'page_titles.audit_logs',
  '/profile':                       'page_titles.profile_edit',
  '/announcements':                 'page_titles.announcements',
  '/pricing':                       'page_titles.pricing',
  '/settings/company':              'page_titles.company_settings',
};

function getPageIcon(pathname: string): string {
  if (PAGE_ICONS[pathname]) return PAGE_ICONS[pathname];
  const sorted = Object.keys(PAGE_ICONS).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (key !== '/' && pathname.startsWith(key)) return PAGE_ICONS[key];
  }
  return 'bi-app';
}

function getPageTitleKey(pathname: string): string | null {
  if (PAGE_TITLE_KEYS[pathname]) return PAGE_TITLE_KEYS[pathname];
  const sorted = Object.keys(PAGE_TITLE_KEYS).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (key !== '/' && pathname.startsWith(key)) return PAGE_TITLE_KEYS[key];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  TopHeader                                                         */
/* ------------------------------------------------------------------ */

type HeaderLink = { label: string; url: string; icon: string };

function TopHeader({
  isSidebarCollapsed,
  onOpenTaskModal,
}: {
  isSidebarCollapsed: boolean;
  onOpenTaskModal: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useNotification();
  const { t } = useTranslation('sidebar');
  const { lang, setLang } = useLanguage();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [headerLinks, setHeaderLinks] = useState<HeaderLink[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  const pageIcon = getPageIcon(pathname);
  const pageTitleKey = getPageTitleKey(pathname);
  const pageTitle = pageTitleKey ? t(pageTitleKey) : 'PMS Pro';

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUserProfile(data);
          if (data.language && data.language !== lang) {
            setLang(data.language as Language);
          }
        }
      })
      .catch(() => {});
    fetch('/api/settings/system')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.headerLinks) {
          try { setHeaderLinks(JSON.parse(data.headerLinks)); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (linksRef.current && !linksRef.current.contains(e.target as Node)) {
        setIsLinksOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      showToast(t('logout_error'), 'error');
    }
  };

  const toggleLanguage = () => {
    setLang(lang === 'ja' ? 'en' : 'ja');
  };

  // tiramis.co.jp ドメインの場合のみ authuser パラメータを付与
  const authParam = userProfile?.email?.endsWith('@tiramis.co.jp')
    ? `?authuser=${encodeURIComponent(userProfile.email)}`
    : '';

  return (
    <header
      className={`
        fixed top-0 right-0 h-[64px] bg-[#f0f2f5]
        z-[110] flex items-center px-4 md:px-8 gap-4
        transition-all duration-300
        ${isSidebarCollapsed ? 'md:left-[72px]' : 'md:left-[240px]'}
        left-0
      `}
    >
      {/* ページタイトル */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-semibold text-slate-800 truncate flex items-center gap-2">
          <i className={`bi ${pageIcon} text-indigo-600 text-[15px]`}></i>
          {pageTitle}
        </h1>
      </div>

      {/* 右側: タスク追加 + 言語切替 + 通知 + プロフィール */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenTaskModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold
                     border-[1.5px] border-indigo-600 text-indigo-600 bg-transparent
                     hover:bg-indigo-50 transition-colors"
        >
          <i className="bi bi-plus-lg text-xs"></i>
          <span className="hidden lg:inline">{t('add_task')}</span>
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* Gmail */}
        <a
          href={`https://mail.google.com/mail/u/${authParam}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Gmail"
          aria-label="Gmail"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-red-500"
        >
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
          </svg>
        </a>

        {/* Google Calendar */}
        <a
          href={`https://calendar.google.com/calendar/u/${authParam}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Google Calendar"
          aria-label="Google Calendar"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-blue-500"
        >
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
            <path d="M19.5 3h-1V1.5a.5.5 0 0 0-1 0V3h-11V1.5a.5.5 0 0 0-1 0V3h-1A2.5 2.5 0 0 0 2 5.5v14A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-14A2.5 2.5 0 0 0 19.5 3zM21 19.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5V9h18v10.5zM21 8H3V5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5V8z"/>
            <rect x="6" y="11" width="3" height="2.5" rx=".4"/>
            <rect x="10.5" y="11" width="3" height="2.5" rx=".4"/>
            <rect x="15" y="11" width="3" height="2.5" rx=".4"/>
            <rect x="6" y="15.5" width="3" height="2.5" rx=".4"/>
            <rect x="10.5" y="15.5" width="3" height="2.5" rx=".4"/>
          </svg>
        </a>

        {/* リンク集ドロップダウン */}
        {headerLinks.length > 0 && (
          <div className="relative" ref={linksRef}>
            <button
              onClick={() => setIsLinksOpen(!isLinksOpen)}
              title={t('links')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-indigo-600"
            >
              <i className="bi bi-grid-3x3-gap-fill text-[16px]"></i>
            </button>
            {isLinksOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-[50]">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
                  <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">{t('links')}</div>
                </div>
                <div className="py-1 max-h-64 overflow-y-auto">
                  {headerLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsLinksOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <i className={`bi ${link.icon || 'bi-link-45deg'} text-slate-400 w-4 text-center`}></i>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* 言語切替トグル */}
        <button
          onClick={toggleLanguage}
          title={lang === 'ja' ? 'Switch to English' : '日本語に切り替え'}
          className="relative flex items-center h-8 w-[68px] rounded-full bg-slate-100 p-0.5 transition-colors hover:bg-slate-200/80 group"
        >
          {/* sliding pill */}
          <span
            className={`absolute top-0.5 h-7 w-[33px] rounded-full bg-white shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 ease-in-out ${
              lang === 'en' ? 'left-[33px]' : 'left-0.5'
            }`}
          />
          <span className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-bold transition-colors duration-200 ${
            lang === 'ja' ? 'text-slate-800' : 'text-slate-400'
          }`}>
            JA
          </span>
          <span className={`relative z-10 flex-1 flex items-center justify-center text-[11px] font-bold transition-colors duration-200 ${
            lang === 'en' ? 'text-slate-800' : 'text-slate-400'
          }`}>
            EN
          </span>
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <div className="flex items-center">
          <NotificationBell />
        </div>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* ユーザープロフィール */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-label="User menu"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-all"
          >
            {userProfile?.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                <i className="bi bi-person-fill text-white text-sm"></i>
              </div>
            )}
            <div className="text-left hidden sm:block">
              <div className="text-[13px] font-semibold text-slate-800 leading-tight whitespace-nowrap">
                {userProfile ? `${userProfile.lastNameJa} ${userProfile.firstNameJa}` : '...'}
              </div>
              <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide leading-tight">
                {userProfile?.role?.name || 'USER'}
              </div>
            </div>
            <i className={`bi bi-chevron-${isUserMenuOpen ? 'up' : 'down'} text-slate-400 text-[11px] hidden sm:block`}></i>
          </button>

          {/* ドロップダウンメニュー */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-[50]">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
                <div className="text-[13px] font-semibold text-slate-800">
                  {userProfile ? `${userProfile.lastNameJa} ${userProfile.firstNameJa}` : '...'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {userProfile?.email || ''}
                </div>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <i className="bi bi-person-gear text-slate-400 w-4 text-center"></i>
                  {t('profile_edit')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <i className="bi bi-box-arrow-right text-rose-400 w-4 text-center"></i>
                  {t('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  MobileHeader                                                      */
/* ------------------------------------------------------------------ */

function MobileHeader({
  onMenuOpen,
  onOpenTaskModal,
}: {
  onMenuOpen: () => void;
  onOpenTaskModal: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation('sidebar');
  const pageIcon = getPageIcon(pathname);
  const pageTitleKey = getPageTitleKey(pathname);
  const pageTitle = pageTitleKey ? t(pageTitleKey) : 'PMS Pro';

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 h-[64px] bg-white/80 backdrop-blur-md border-b border-slate-200/60 z-[120] flex items-center px-3 gap-2">
      <button
        onClick={onMenuOpen}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors rounded-lg active:bg-slate-100"
        aria-label="Open menu"
      >
        <i className="bi bi-list text-[24px]" />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
          <i className={`bi ${pageIcon} text-indigo-600 text-[13px]`}></i>
          {pageTitle}
        </h1>
      </div>
      <button
        onClick={onOpenTaskModal}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg
                   bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
      >
        <i className="bi bi-plus-lg text-[16px]"></i>
      </button>
      <NotificationBell />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LayoutWrapper                                                     */
/* ------------------------------------------------------------------ */

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/change-password';
  const isPortalPage = pathname.startsWith('/portal');
  const isDistributorPage = pathname.startsWith('/staff');
  const isAppPrivacyPage = pathname.startsWith('/app-privacy');
  const isApplyPage = pathname === '/apply' || pathname.startsWith('/apply/manage');
  const isPublicBookingPage = pathname === '/interview-booking' || pathname === '/training-booking';

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false);

  useEffect(() => { setIsMobileOpen(false); }, [pathname]);

  // チャンクエラー自動リロード
  useEffect(() => {
    const handleChunkError = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      if (
        err?.name === 'ChunkLoadError' ||
        err?.message?.includes('Loading chunk') ||
        err?.message?.includes('Failed to fetch dynamically imported module') ||
        err?.message?.includes('Importing a module script failed')
      ) {
        window.location.reload();
      }
    };
    window.addEventListener('unhandledrejection', handleChunkError);
    return () => window.removeEventListener('unhandledrejection', handleChunkError);
  }, []);

  if (isAuthPage || isPortalPage || isDistributorPage || isAppPrivacyPage || isApplyPage || isPublicBookingPage) {
    return (
      <LanguageProvider>
        <NotificationProvider>
          <main className={`w-full min-h-screen m-0 p-0 ${isAuthPage ? 'bg-[#0f172a]' : ''}`}>
            {children}
          </main>
        </NotificationProvider>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <NotificationProvider>
        <div className="flex min-h-screen bg-[#f0f2f5]">

          {/* モバイルヘッダー */}
          <MobileHeader
            onMenuOpen={() => setIsMobileOpen(true)}
            onOpenTaskModal={() => setIsGlobalTaskModalOpen(true)}
          />

          {/* サイドバー */}
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isMobileOpen={isMobileOpen}
            onMobileClose={() => setIsMobileOpen(false)}
          />

          {/* トップヘッダー（デスクトップ） */}
          <div className="hidden md:block">
            <TopHeader isSidebarCollapsed={isSidebarCollapsed} onOpenTaskModal={() => setIsGlobalTaskModalOpen(true)} />
          </div>

          {/* メインコンテンツ */}
          <main className={`
            flex-1 transition-all duration-300 min-h-screen
            pt-[80px] pb-6 px-4 md:px-8
            ${isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}
          `}>
            {children}
          </main>

          {/* グローバルタスク作成モーダル */}
          <TaskCreateModal
            isOpen={isGlobalTaskModalOpen}
            onClose={() => setIsGlobalTaskModalOpen(false)}
            onCreated={() => window.dispatchEvent(new Event('task-created'))}
          />
        </div>
      </NotificationProvider>
    </LanguageProvider>
  );
}
