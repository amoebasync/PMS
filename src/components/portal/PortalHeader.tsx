// src/components/portal/PortalHeader.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useCart } from './CartContext';
import { signOut, useSession } from 'next-auth/react';

export function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  
  // ★ 修正1: useCartがエラー等でundefinedを返しても落ちないように安全に取得
  const cartContext = useCart();
  const cartItems = cartContext?.items || [];
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // ★ 修正2: すべての useEffect などのHookを early return の前に配置する（Reactのルール）
  useEffect(() => {
    if (status !== 'authenticated') return;
    
    // 通知を取得
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/portal/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchNotifications();
  }, [status]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenNotifications = async () => {
    setIsNotifOpen(!isNotifOpen);
    // 開いた瞬間に既読化 (ACTION_REQUIRED以外)
    if (!isNotifOpen && unreadCount > 0) {
      try {
        await fetch('/api/portal/notifications/read', { method: 'POST' });
        // フロントエンドのStateも更新（ACTION_REQUIREDは未読のまま残す）
        setNotifications(prev => prev.map(n => n.type === 'ACTION_REQUIRED' ? n : { ...n, isRead: true }));
      } catch (e) { console.error(e); }
    }
  };

  const handleNotificationClick = (orderId: number | null) => {
    setIsNotifOpen(false);
    if (orderId) {
      // 発注履歴ページへ、特定のorderIdを指定して遷移
      router.push(`/portal/orders?orderId=${orderId}`);
    } else {
      router.push('/portal/orders');
    }
  };

  // ★ 修正3: Hookの呼び出しが全て終わった後に return null の判定をする
  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/signup';
  if (isAuthPage) return null;

  const authNavItems = [
    { name: 'マイページ', href: '/portal/mypage', icon: 'bi-grid-1x2-fill' },
    { name: '新規発注', href: '/portal/orders/new', icon: 'bi-cart-plus-fill' },
    { name: '発注履歴', href: '/portal/orders', icon: 'bi-clock-history' },
    { name: 'QR管理', href: '/portal/qrcodes', icon: 'bi-qr-code' },
    { name: '反響分析', href: '/portal/analytics', icon: 'bi-graph-up-arrow' },
    { name: '設定', href: '/portal/settings', icon: 'bi-gear-fill' },
  ];

  const publicNavItems = [
    { name: 'ホーム', href: '/portal', icon: 'bi-house-door-fill' },
    { name: '料金・エリアから発注', href: '/portal/orders/new', icon: 'bi-map-fill' },
  ];

  const navItems = session ? authNavItems : publicNavItems;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <div className="flex items-center gap-8">
          <Link href="/portal" className="relative w-[140px] h-[30px]">
            <Image src="/logo/logo_light_transparent.png" alt="Logo" fill className="object-contain" priority />
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
          
          {/* --- 通知アイコン --- */}
          {session && (
            <div className="relative mr-2" ref={notifRef}>
              <button 
                onClick={handleOpenNotifications}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors relative"
              >
                <i className="bi bi-bell text-2xl"></i>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm transform translate-x-1 -translate-y-1">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* 通知ポップオーバー */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm">お知らせ</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">新しいお知らせはありません。</div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif.orderId)}
                          className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${notif.isRead ? 'opacity-70' : 'bg-indigo-50/30'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 shrink-0 ${notif.type === 'ACTION_REQUIRED' ? 'text-rose-500' : 'text-indigo-500'}`}>
                              {notif.type === 'ACTION_REQUIRED' ? <i className="bi bi-exclamation-triangle-fill"></i> : <i className="bi bi-info-circle-fill"></i>}
                            </div>
                            <div>
                              <div className={`text-sm font-bold ${notif.type === 'ACTION_REQUIRED' ? 'text-rose-700' : 'text-slate-800'}`}>
                                {notif.title}
                              </div>
                              <div className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</div>
                              {notif.orderNo && (
                                <div className="text-[10px] font-mono text-slate-400 mt-2">{notif.orderNo}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* カートアイコン */}
          <Link href="/portal/cart" className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors mr-2">
            <i className="bi bi-cart3 text-2xl"></i>
            {cartItems && cartItems.length > 0 && (
              <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform translate-x-1">
                {cartItems.length}
              </span>
            )}
          </Link>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

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