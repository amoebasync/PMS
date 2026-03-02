'use client';

import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import { useState, useEffect, useRef } from 'react';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { useNotification } from '@/components/ui/NotificationProvider';
import Link from 'next/link';
import TaskCreateModal from '@/components/TaskCreateModal';

// ページタイトルマップ（アイコン付き）
const PAGE_TITLES: Record<string, { title: string; icon: string }> = {
  '/':                              { title: 'ダッシュボード',    icon: 'bi-grid-1x2-fill' },
  '/attendance':                    { title: 'マイ勤怠・経費',    icon: 'bi-clock-history' },
  '/dispatch':                      { title: 'ディスパッチ',      icon: 'bi-diagram-3-fill' },
  '/schedules':                     { title: 'スケジュール照会',  icon: 'bi-calendar-check' },
  '/orders':                        { title: '受注管理',          icon: 'bi-briefcase-fill' },
  '/billing':                       { title: '請求管理',          icon: 'bi-receipt-cutoff' },
  '/crm/tasks':                     { title: 'タスク',            icon: 'bi-list-task' },
  '/crm/leads':                     { title: '見込み客管理',      icon: 'bi-person-plus-fill' },
  '/customers':                     { title: '顧客管理',          icon: 'bi-buildings-fill' },
  '/campaigns':                     { title: 'キャンペーン',      icon: 'bi-megaphone-fill' },
  '/areas':                         { title: 'エリア管理',        icon: 'bi-geo-alt-fill' },
  '/flyers':                        { title: 'チラシ管理',        icon: 'bi-file-earmark-richtext' },
  '/transactions':                  { title: '入出庫・納品管理',  icon: 'bi-box-seam' },
  '/partners':                      { title: '外注先マスタ',      icon: 'bi-truck' },
  '/quality/complaints':            { title: 'クレーム管理',      icon: 'bi-exclamation-triangle-fill' },
  '/quality/prohibited-properties': { title: '配布禁止物件',      icon: 'bi-house-x-fill' },
  '/employees':                     { title: '社員管理',          icon: 'bi-person-badge-fill' },
  '/distributors':                  { title: '配布員管理',        icon: 'bi-bicycle' },
  '/distributors/payroll':          { title: '配布員給与',        icon: 'bi-wallet2' },
  '/applicants':                    { title: '応募者管理',        icon: 'bi-person-lines-fill' },
  '/branches':                      { title: '支店管理',          icon: 'bi-shop' },
  '/approvals':                     { title: '人事・経費承認',    icon: 'bi-check2-square' },
  '/payroll':                       { title: '給与計算',          icon: 'bi-cash-stack' },
  '/settings':                      { title: 'システム設定',      icon: 'bi-gear-fill' },
  '/audit-logs':                    { title: '監査ログ',          icon: 'bi-shield-check' },
  '/profile':                       { title: 'プロフィール編集',  icon: 'bi-person-gear' },
  '/announcements':                 { title: '全体お知らせ',      icon: 'bi-megaphone' },
  '/pricing':                       { title: '価格設定',          icon: 'bi-tags-fill' },
  '/settings/company':              { title: '自社情報設定',      icon: 'bi-building' },
};

function getPageInfo(pathname: string): { title: string; icon: string } {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const sorted = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (key !== '/' && pathname.startsWith(key)) return PAGE_TITLES[key];
  }
  return { title: 'PMS Pro', icon: 'bi-app' };
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [headerLinks, setHeaderLinks] = useState<HeaderLink[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  const { title: pageTitle, icon: pageIcon } = getPageInfo(pathname);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUserProfile(data); })
      .catch(() => {});
    fetch('/api/settings/system')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.headerLinks) {
          try { setHeaderLinks(JSON.parse(data.headerLinks)); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
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
      showToast('ログアウトに失敗しました', 'error');
    }
  };

  // tiramis.co.jp ドメインの場合のみ authuser パラメータを付与
  const authParam = userProfile?.email?.endsWith('@tiramis.co.jp')
    ? `?authuser=${encodeURIComponent(userProfile.email)}`
    : '';

  return (
    <header
      className={`
        fixed top-0 right-0 h-[64px] bg-[#f0f2f5]
        z-[900] flex items-center px-4 md:px-8 gap-4
        transition-all duration-300
        ${isSidebarCollapsed ? 'md:left-[72px]' : 'md:left-[240px]'}
        left-0
      `}
    >
      {/* ページタイトル */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[17px] font-semibold text-gray-800 truncate flex items-center gap-2">
          <i className={`bi ${pageIcon} text-indigo-600 text-[15px]`}></i>
          {pageTitle}
        </h1>
      </div>

      {/* 右側: タスク追加 + 通知 + プロフィール */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenTaskModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold
                     bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <i className="bi bi-plus-lg text-xs"></i>
          <span className="hidden lg:inline">タスク追加</span>
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Gmail */}
        <a
          href={`https://mail.google.com/mail/u/${authParam}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Gmail"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-red-500"
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
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-blue-500"
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
              title="リンク集"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-indigo-600"
            >
              <i className="bi bi-grid-3x3-gap-fill text-[16px]"></i>
            </button>
            {isLinksOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-[920]">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
                  <div className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">リンク集</div>
                </div>
                <div className="py-1 max-h-64 overflow-y-auto">
                  {headerLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsLinksOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <i className={`bi ${link.icon || 'bi-link-45deg'} text-gray-400 w-4 text-center`}></i>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <div className="flex items-center">
          <NotificationBell />
        </div>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* ユーザープロフィール */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-all"
          >
            {userProfile?.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                <i className="bi bi-person-fill text-white text-sm"></i>
              </div>
            )}
            <div className="text-left hidden sm:block">
              <div className="text-[13px] font-semibold text-gray-800 leading-tight whitespace-nowrap">
                {userProfile ? `${userProfile.lastNameJa} ${userProfile.firstNameJa}` : '...'}
              </div>
              <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide leading-tight">
                {userProfile?.role?.name || 'USER'}
              </div>
            </div>
            <i className={`bi bi-chevron-${isUserMenuOpen ? 'up' : 'down'} text-gray-400 text-[11px] hidden sm:block`}></i>
          </button>

          {/* ドロップダウンメニュー */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-[920]">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                <div className="text-[13px] font-semibold text-gray-800">
                  {userProfile ? `${userProfile.lastNameJa} ${userProfile.firstNameJa}` : '...'}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {userProfile?.email || ''}
                </div>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <i className="bi bi-person-gear text-gray-400 w-4 text-center"></i>
                  プロフィール編集
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <i className="bi bi-box-arrow-right text-rose-400 w-4 text-center"></i>
                  ログアウト
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
      <NotificationProvider>
        <main className={`w-full min-h-screen m-0 p-0 ${isAuthPage ? 'bg-[#0f172a]' : ''}`}>
          {children}
        </main>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className="flex min-h-screen bg-[#f0f2f5]">

        {/* モバイルヘッダー */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-[64px] bg-white/80 backdrop-blur-md border-b border-gray-200/60 z-[1100] flex items-center px-4 gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="メニューを開く"
          >
            <i className="bi bi-list text-2xl" />
          </button>
          <span className="font-extrabold text-gray-900 tracking-wide flex-1">
            PMS <span className="text-blue-600">Pro</span>
          </span>
          <button
            onClick={() => setIsGlobalTaskModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold
                       bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <i className="bi bi-plus-lg text-[10px]"></i>
          </button>
          <NotificationBell />
        </div>

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
  );
}
