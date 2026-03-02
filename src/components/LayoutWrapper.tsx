'use client';

import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';
import { useState, useEffect, useRef } from 'react';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { useNotification } from '@/components/ui/NotificationProvider';
import Link from 'next/link';

// ページタイトルマップ
const PAGE_TITLES: Record<string, string> = {
  '/': 'ダッシュボード',
  '/attendance': 'マイ勤怠・経費',
  '/dispatch': 'ディスパッチ',
  '/schedules': 'スケジュール照会',
  '/orders': '受注管理',
  '/billing': '請求管理',
  '/crm/tasks': 'CRM / タスク',
  '/crm/leads': '見込み客管理',
  '/customers': '顧客管理',
  '/campaigns': 'キャンペーン',
  '/areas': 'エリア管理',
  '/flyers': 'チラシ管理',
  '/transactions': '入出庫・納品管理',
  '/partners': '外注先マスタ',
  '/quality/complaints': 'クレーム管理',
  '/quality/prohibited-properties': '配布禁止物件',
  '/employees': '社員管理',
  '/distributors': '配布員管理',
  '/distributors/payroll': '配布員給与',
  '/applicants': '応募者管理',
  '/branches': '支店管理',
  '/approvals': '人事・経費承認',
  '/payroll': '給与計算',
  '/settings': 'システム設定',
  '/audit-logs': '監査ログ',
  '/profile': 'プロフィール編集',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const sorted = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (key !== '/' && pathname.startsWith(key)) return PAGE_TITLES[key];
  }
  return 'PMS Pro';
}

/* ------------------------------------------------------------------ */
/*  TopHeader                                                         */
/* ------------------------------------------------------------------ */

function TopHeader({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useNotification();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUserProfile(data); })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
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
        <h1 className="text-[17px] font-semibold text-gray-800 truncate">{pageTitle}</h1>
      </div>

      {/* 右側: 通知 + プロフィール */}
      <div className="flex items-center gap-2 shrink-0">
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
        <div className="md:hidden fixed top-0 left-0 right-0 h-[64px] bg-white/80 backdrop-blur-md border-b border-gray-200/60 z-[1100] flex items-center px-4 gap-4">
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
          <TopHeader isSidebarCollapsed={isSidebarCollapsed} />
        </div>

        {/* メインコンテンツ */}
        <main className={`
          flex-1 transition-all duration-300 min-h-screen
          pt-[80px] pb-6 px-4 md:px-8
          ${isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'}
        `}>
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}
