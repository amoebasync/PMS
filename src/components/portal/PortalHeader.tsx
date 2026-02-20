'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useCart } from '@/components/portal/CartContext'; // ★ 追加

export function PortalHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { items } = useCart(); // ★ 追加

  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/signup';
  if (isAuthPage) return null;

  const authNavItems = [
    { name: 'マイページ', href: '/portal/mypage', icon: 'bi-grid-1x2-fill' },
    { name: '新規発注', href: '/portal/orders/new', icon: 'bi-cart-plus-fill' },
    { name: '発注履歴', href: '/portal/orders', icon: 'bi-clock-history' },
    { name: '反響分析', href: '/portal/analytics', icon: 'bi-graph-up-arrow' },
    { name: '設定', href: '/portal/settings', icon: 'bi-gear-fill' },
  ];

  const publicNavItems = [
    { name: 'ホーム', href: '/portal', icon: 'bi-house-door-fill' },
    { name: '料金・エリアから発注', href: '/portal/orders/new', icon: 'bi-map-fill' },
  ];

  const navItems = session ? authNavItems : publicNavItems;

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/portal" className="relative w-[140px] h-[30px]">
            <Image src="/logo/logo_dark_transparent.png" alt="Logo" fill className="object-contain" priority />
          </Link>
          
          <nav className="hidden md:flex gap-1">
            {navItems.map(item => {
              const isActive = item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href} className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  <i className={`bi ${item.icon}`}></i> {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          
          {/* ★ 追加: カートアイコン (常時表示) */}
          <Link href="/portal/cart" className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors mr-2">
            <i className="bi bi-cart3 text-2xl"></i>
            {items.length > 0 && (
              <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform translate-x-1 -translate-y-1">
                {items.length}
              </span>
            )}
          </Link>

          {status === 'loading' ? (
            <div className="w-20 h-6 bg-slate-100 animate-pulse rounded"></div>
          ) : session ? (
            <>
              <div className="hidden lg:block text-right mr-2">
                <div className="text-[10px] text-slate-400 font-bold leading-none">{(session.user as any)?.company}</div>
                <div className="text-sm font-bold text-slate-700 leading-tight">{session.user?.name} 様</div>
              </div>
              <button onClick={() => signOut({ callbackUrl: '/portal/login' })} className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                <i className="bi bi-box-arrow-right"></i> ログアウト
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link href="/portal/login" className="text-sm font-bold text-slate-600 hover:text-indigo-600 px-4 py-2 transition-colors">
                ログイン
              </Link>
              <Link href="/portal/signup" className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-xl shadow-sm transition-all">
                無料で始める
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}