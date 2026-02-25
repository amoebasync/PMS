'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { NotificationProvider } from '@/components/ui/NotificationProvider';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ログイン画面・ポータル画面・配布員ポータルはサイドバーを隠す
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/change-password';
  const isPortalPage = pathname.startsWith('/portal');
  const isDistributorPage = pathname.startsWith('/staff');
  const isAppPrivacyPage = pathname.startsWith('/app-privacy');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // ページ遷移でモバイルメニューを閉じる
  useEffect(() => { setIsMobileOpen(false); }, [pathname]);

  if (isAuthPage || isPortalPage || isDistributorPage || isAppPrivacyPage) {
    return (
      <NotificationProvider>
        <main className={`w-full min-h-screen m-0 p-0 ${isAuthPage ? 'bg-[#0f172a]' : ''}`}>
          {children}
        </main>
      </NotificationProvider>
    );
  }

  // 通常の社内画面の場合
  return (
    <NotificationProvider>
      <div className="flex min-h-screen bg-slate-50">

        {/* モバイル用ヘッダーバー */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0f172a] z-[1100] flex items-center px-4 gap-4 shadow-lg">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="text-slate-300 hover:text-white transition-colors"
            aria-label="メニューを開く"
          >
            <i className="bi bi-list text-2xl" />
          </button>
          <span className="font-extrabold text-white tracking-wide">
            PMS <span className="text-blue-400">Pro</span>
          </span>
        </div>

        <Sidebar
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
        />

        <main className={`flex-1 transition-all duration-300 pt-14 p-4 md:px-12 md:py-10 min-h-screen ${
          isSidebarCollapsed ? 'md:ml-[80px]' : 'md:ml-[260px]'
        }`}>
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}
