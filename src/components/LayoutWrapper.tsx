'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // ★ 変更: ログイン画面に加えて、ポータル画面の場合もサイドバーを隠す
  const isAuthPage = pathname === '/login';
  const isPortalPage = pathname.startsWith('/portal');
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  if (isAuthPage || isPortalPage) {
    return (
      <main className={`w-full min-h-screen m-0 p-0 ${isAuthPage ? 'bg-[#0f172a]' : ''}`}>
        {children}
      </main>
    );
  }

  // 通常の社内画面の場合
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-[80px]' : 'ml-[260px]'} p-8 min-h-screen`}>
        {children}
      </main>
    </div>
  );
}