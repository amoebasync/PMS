'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ★ここを修正しました★
  // pathname === '/login' に完全一致する場合のみ true にする
  const isAuthPage = pathname === '/login';

  // --- ログイン画面の場合 ---
  // サイドバーや余白を一切入れずに全画面表示する
  if (isAuthPage) {
    return (
      <main className="w-full min-h-screen m-0 p-0 bg-[#0f172a]">
        {children}
      </main>
    );
  }

  // --- 通常の画面（ダッシュボード、社員管理など）の場合 ---
  // 今まで通りサイドバーを表示し、メインコンテンツエリアに余白を設ける
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-[260px] p-8 min-h-screen bg-slate-50">
        {children}
      </main>
    </div>
  );
}