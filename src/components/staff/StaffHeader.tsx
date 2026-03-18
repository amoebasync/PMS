'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export function StaffHeader({ name, missingResidenceCard, visaExpiringSoon, contractUnsigned }: { name?: string; missingResidenceCard?: boolean; visaExpiringSoon?: boolean; contractUnsigned?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { name: 'ホーム',     href: '/staff',            icon: 'bi-house-door-fill' },
    { name: 'シフト',     href: '/staff/shifts',      icon: 'bi-calendar3' },
    { name: '交通費',     href: '/staff/expenses',    icon: 'bi-train-front-fill' },
    { name: '配布履歴',   href: '/staff/report',      icon: 'bi-clock-history' },
    { name: '評価',       href: '/staff/evaluation',  icon: 'bi-award-fill' },
    { name: 'プロフィール', href: '/staff/profile',   icon: 'bi-person-fill' },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/staff/auth/logout', { method: 'POST' });
    router.push('/staff/login');
  };

  if (pathname === '/staff/login' || pathname === '/staff/change-password') {
    return null;
  }

  return (
    <>
      {/* Top header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/staff" className="relative w-[120px] h-[26px]">
            <Image src="/logo/logo_light_transparent.png" alt="Logo" fill className="object-contain" priority />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            {name && <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{name}</span>}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="shrink-0 text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 disabled:opacity-60"
            >
              <i className="bi bi-box-arrow-right"></i> ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* VISA期限警告 */}
      {visaExpiringSoon && (
        <div className="bg-rose-50 border-b border-rose-200">
          <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-2">
            <i className="bi bi-exclamation-octagon-fill text-rose-500 shrink-0"></i>
            <Link href="/staff/profile" className="text-xs font-bold text-rose-700 hover:underline">
              在留資格の有効期限が近づいています。新しい在留カードの写真をアップロードしてください
            </Link>
          </div>
        </div>
      )}

      {/* 在留カード未提出警告 */}
      {!visaExpiringSoon && missingResidenceCard && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill text-amber-500 shrink-0"></i>
            <Link href="/staff/profile" className="text-xs font-bold text-amber-700 hover:underline">
              在留カードの写真をマイページからアップロードしてください
            </Link>
          </div>
        </div>
      )}

      {/* 業務委託契約書未署名警告 */}
      {contractUnsigned && (
        <div className="bg-indigo-50 border-b border-indigo-200">
          <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-2">
            <i className="bi bi-pen-fill text-indigo-500 shrink-0"></i>
            <button
              onClick={() => {
                fetch('/api/staff/contract')
                  .then(r => r.json())
                  .then(d => {
                    if (d.signingUrl) {
                      window.open(d.signingUrl, '_blank');
                    }
                  });
              }}
              className="text-xs font-bold text-indigo-700 hover:underline text-left"
            >
              業務委託契約書の電子署名が未完了です。こちらをタップして署名してください
            </button>
          </div>
        </div>
      )}

      {/* Bottom navigation bar (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-up">
        <div className="max-w-lg mx-auto grid grid-cols-6">
          {navItems.map((item) => {
            const isActive = item.href === '/staff'
              ? pathname === '/staff'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-bold transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <i className={`bi ${item.icon} text-xl`}></i>
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
