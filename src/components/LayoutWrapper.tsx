'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';
  
  // ★ サイドバーの折りたたみ状態を管理するState
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ログイン画面の場合
  if (isAuthPage) {
    return (
      <main className="w-full min-h-screen m-0 p-0 bg-[#0f172a]">
        {children}
      </main>
    );
  }

  // 通常の画面の場合
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebarに状態とトグル関数を渡す */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      {/* サイドバーが折りたたまれている時は左の余白(ml)を 80px に減らす */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-[80px]' : 'ml-[260px]'} p-8 min-h-screen`}>
        {children}
      </main>
    </div>
  );
}