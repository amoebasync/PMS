'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

export function StaffHeaderEn({ name }: { name?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { name: 'Home',     href: '/staff/en',           icon: 'bi-house-door-fill' },
    { name: 'Shifts',   href: '/staff/en/shifts',     icon: 'bi-calendar3' },
    { name: 'Expenses', href: '/staff/en/expenses',   icon: 'bi-train-front-fill' },
    { name: 'Report',   href: '/staff/en/report',     icon: 'bi-clipboard-check-fill' },
    { name: 'Profile',  href: '/staff/en/profile',    icon: 'bi-person-fill' },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/staff/auth/logout', { method: 'POST' });
    router.push('/staff/login');
  };

  if (pathname === '/staff/login' || pathname === '/staff/en/change-password') {
    return null;
  }

  return (
    <>
      {/* Top header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/staff/en" className="relative w-[120px] h-[26px]">
            <Image src="/logo/logo_light_transparent.png" alt="Logo" fill className="object-contain" priority />
          </Link>
          <div className="flex items-center gap-3">
            {name && <span className="text-sm font-bold text-slate-700">{name}</span>}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 disabled:opacity-60"
            >
              <i className="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-up">
        <div className="max-w-lg mx-auto grid grid-cols-5">
          {navItems.map((item) => {
            const isActive = item.href === '/staff/en'
              ? pathname === '/staff/en'
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
