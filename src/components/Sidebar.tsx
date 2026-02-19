'use client';

import Link from 'next/link';
import Image from 'next/image'; // 画像用コンポーネントを追加
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  // 初期値を空にすることで、サーバーとクライアントの不一致（Hydration Error）を完全に防ぎます
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState({ 
    clock: '00:00:00', 
    date: '----/--/--' 
  });

  // マウント後に時計を動かす
  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setTime({
        clock: now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }),
      });
    };

    updateTime(); // 初回実行
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (pathname === '/login') {
    return null;
  }

  // ★ ここに配布員管理を追加しました ★
  const navItems = [
    { name: 'ダッシュボード', href: '/', icon: 'bi-grid-1x2-fill' }, 
    { name: '顧客管理', href: '/customers', icon: 'bi-people-fill' },
    { name: 'エリア管理', href: '/areas', icon: 'bi-geo-alt-fill' },
    { name: '社員管理', href: '/employees', icon: 'bi-person-badge-fill' },
    { name: '配布員管理', href: '/distributors', icon: 'bi-bicycle' }, // 追加
    { name: 'システム設定', href: '/settings', icon: 'bi-gear-fill' },
    { name: '支店管理', href: '/branches', icon: 'bi-shop' },
    { name: 'スケジュール照会', href: '/schedules', icon: 'bi bi-calendar-day' },
    { name: 'チラシ管理', href: '/flyers', icon: 'bi-file-earmark-richtext' },
  ];

  return (
    <nav className="w-[260px] h-screen bg-[#0f172a] text-slate-200 fixed left-0 top-0 z-[1000] flex flex-col shadow-2xl border-r border-white/5 font-sans">
      
      {/* ロゴエリア */}
      <div className="h-[80px] flex items-center justify-center border-b border-white/10 bg-[#0f172a]">
        <div className="relative w-[180px] h-[40px]">
          <Image 
            src="/logo/logo_dark_transparent.png" 
            alt="PMS Pro Logo" 
            fill
            className="object-contain" // アスペクト比を維持して枠内に収める
            priority // 優先的に読み込む
          />
        </div>
      </div>

      {/* メニューエリア */}
      <div className="flex-1 py-6 px-3 overflow-y-auto custom-scrollbar">
        <div className="px-4 mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Main Menu</div>
        <div className="space-y-1">
          {navItems.map((item) => {
            // パスが一致するか、サブパス（例: /areas/123）も含めて一致するか判定
            // トップページ('/')の場合は完全一致のみにする（他の全パスがマッチしてしまうのを防ぐため）
            const isActive = item.href === '/' 
              ? pathname === '/' 
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
              
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {/* アクティブ時の左側の青いライン */}
                {isActive && <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-300 rounded-r-full"></div>}
                
                <i className={`${item.icon} mr-3 text-lg ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'}`}></i>
                <span className="font-medium tracking-wide text-sm">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ユーザー情報＆時計エリア */}
      <div className="p-4 bg-black/20 border-t border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
            <i className="bi bi-person-fill text-white text-lg"></i>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="font-bold text-white text-sm truncate">管理者ユーザー</div>
            <div className="text-[10px] text-blue-300 uppercase tracking-wider font-semibold">Administrator</div>
          </div>
        </div>
        
        {/* 時計（マウントされるまで表示しないことでエラー回避） */}
        <div className="pt-3 border-t border-white/5 text-center min-h-[44px]">
          {mounted ? (
            <>
              <div className="font-mono text-xl font-bold text-white tracking-widest leading-none mb-1">{time.clock}</div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wide">{time.date}</div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="w-1 h-1 bg-slate-600 rounded-full animate-ping"></div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}