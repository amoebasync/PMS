'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';
import { NotificationProvider } from '@/components/ui/NotificationProvider';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // ログイン画面・ポータル画面・配布員ポータルはサイドバーを隠す
  const isAuthPage = pathname === '/login';
  const isPortalPage = pathname.startsWith('/portal');
  const isDistributorPage = pathname.startsWith('/staff');
  const isAppPrivacyPage = pathname.startsWith('/app-privacy');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-[80px]' : 'ml-[260px]'} p-8 min-h-screen`}>
          {children}
        </main>
      </div>
    </NotificationProvider>
  );
}