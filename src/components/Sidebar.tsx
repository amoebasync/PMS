'use client';

import Link from 'next/link';
import Image from 'next/image'; 
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export default function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false); 
  const [time, setTime] = useState({ clock: '00:00:00', date: '----/--/--' });
  
  const [orderPendingCount, setOrderPendingCount] = useState(0); 
  const [approvalPendingCount, setApprovalPendingCount] = useState(0);

  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    
    const updateTime = () => {
      const now = new Date();
      setTime({
        clock: now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }),
      });
    };

    updateTime(); 
    const timer = setInterval(updateTime, 1000);

    fetch('/api/orders/pending-count')
      .then(r => r.json())
      .then(d => setOrderPendingCount(d.count || 0))
      .catch(() => {});

    fetch('/api/approvals/pending-count')
      .then(r => r.json())
      .then(d => setApprovalPendingCount(d.total || 0))
      .catch(() => {});

    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setUserProfile(data);
      })
      .catch(() => {});

    return () => clearInterval(timer);
  }, [pathname]);

  if (pathname === '/login') return null;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      alert('ログアウトに失敗しました');
    }
  };

  const menuGroups = [
    {
      title: 'WORKFLOW',
      items: [
        { name: 'ダッシュボード', href: '/', icon: 'bi-grid-1x2-fill' }, 
        { name: 'マイ勤怠・経費', href: '/attendance', icon: 'bi-clock-history' },
        { name: 'ディスパッチ', href: '/dispatch', icon: 'bi-diagram-3-fill' }, 
        { name: 'スケジュール照会', href: '/schedules', icon: 'bi-calendar-check' },
        { name: '受注管理', href: '/orders', icon: 'bi-briefcase-fill' }, 
      ]
    },
    {
      title: 'MASTERS',
      items: [
        { name: '顧客管理', href: '/customers', icon: 'bi-buildings-fill' },
        { name: 'エリア管理', href: '/areas', icon: 'bi-geo-alt-fill' },
        { name: 'チラシ管理', href: '/flyers', icon: 'bi-file-earmark-richtext' },
        { name: '入出庫・納品管理', href: '/transactions', icon: 'bi-box-seam' },
        { name: '外注先マスタ', href: '/partners', icon: 'bi-truck' },
      ]
    },
    {
      title: 'ORGANIZATION',
      items: [
        { name: '社員管理', href: '/employees', icon: 'bi-person-badge-fill' },
        { name: '配布員管理', href: '/distributors', icon: 'bi-bicycle' }, 
        { name: '支店管理', href: '/branches', icon: 'bi-shop' },
        { name: '人事・経費承認', href: '/approvals', icon: 'bi-check2-square' },
        { name: 'システム設定', href: '/settings', icon: 'bi-gear-fill' },
      ]
    }
  ];

  return (
    <nav className={`h-screen bg-[#0f172a] text-slate-200 fixed left-0 top-0 z-[1000] flex flex-col shadow-2xl border-r border-white/5 font-sans transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      
      <button 
        onClick={toggleCollapse} 
        className="absolute -right-3 top-6 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md hover:bg-blue-500 transition-colors z-[1010]"
      >
        <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'} text-[10px]`}></i>
      </button>

      <div className="h-[80px] flex items-center justify-center border-b border-white/10 bg-[#0f172a] shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-[32px] h-[32px] shrink-0">
            <Image src="/logo/logo_Icon_transparent.png" alt="Icon" fill className="object-contain" priority />
          </div>
          {!isCollapsed && (
            <div className="font-extrabold text-white text-xl tracking-wide whitespace-nowrap">
              PMS <span className="text-blue-500">Pro</span>
            </div>
          )}
        </Link>
      </div>

      <div className="flex-1 py-6 overflow-y-auto sidebar-scrollbar">
        {menuGroups.map((group, gIdx) => (
          <div key={gIdx} className="mb-6 px-3">
            {!isCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link 
                    key={item.href} 
                    href={item.href} 
                    title={isCollapsed ? item.name : ''}
                    className={`flex items-center py-2.5 rounded-lg transition-all duration-200 group relative ${
                      isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-white/5 text-slate-400 hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
                  >
                    {isActive && !isCollapsed && <div className="absolute left-0 top-2 bottom-2 w-1 bg-blue-300 rounded-r-full"></div>}
                    <i className={`${item.icon} text-lg ${!isCollapsed && 'mr-3'} ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'}`}></i>
                    {!isCollapsed && <span className="font-medium tracking-wide text-sm whitespace-nowrap">{item.name}</span>}
                    
                    {!isCollapsed && item.href === '/orders' && orderPendingCount > 0 && (
                      <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {orderPendingCount}
                      </span>
                    )}
                    {!isCollapsed && item.href === '/approvals' && approvalPendingCount > 0 && (
                      <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {approvalPendingCount}
                      </span>
                    )}

                    {isCollapsed && item.href === '/orders' && orderPendingCount > 0 && (
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#0f172a]"></div>
                    )}
                    {isCollapsed && item.href === '/approvals' && approvalPendingCount > 0 && (
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#0f172a]"></div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-black/20 border-t border-white/10 backdrop-blur-sm relative">
        {isUserMenuOpen && (
          <div className={`absolute z-[1020] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden py-1 ${
            isCollapsed ? 'bottom-3 left-full ml-3 w-48' : 'bottom-full left-3 right-3 mb-2'
          }`}>
            <Link href="/profile" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700 transition-colors text-sm text-slate-200">
               <i className="bi bi-person-gear"></i> プロフィール編集
            </Link>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-rose-500/20 text-rose-400 transition-colors text-sm text-left">
               <i className="bi bi-box-arrow-right"></i> ログアウト
            </button>
          </div>
        )}

        {/* ★ 変更: hover時の背景色と、キャレットアイコンを追加してクリックできることを強調 */}
        <button 
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
          className={`w-full flex items-center justify-between text-left hover:bg-slate-800 p-2 rounded-xl transition-all border border-transparent hover:border-slate-700`}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3'} overflow-hidden`}>
            {userProfile?.avatarUrl ? (
              <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden shadow-lg border border-slate-600">
                <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
                <i className="bi bi-person-fill text-white text-lg"></i>
              </div>
            )}

            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <div className="font-bold text-white text-sm truncate">
                  {userProfile ? `${userProfile.lastNameJa} ${userProfile.firstNameJa}` : '読み込み中...'}
                </div>
                <div className="text-[10px] text-blue-300 uppercase tracking-wider font-semibold truncate">
                  {userProfile?.role?.name || 'USER'}
                </div>
              </div>
            )}
          </div>
          
          {/* ★ 追加: メニューが開くことを示すアイコン */}
          {!isCollapsed && (
            <i className={`bi bi-chevron-${isUserMenuOpen ? 'down' : 'up'} text-slate-400 text-sm ml-2 transition-transform`}></i>
          )}
        </button>
        
        {!isCollapsed && (
          <div className="pt-3 mt-2 border-t border-white/5 text-center min-h-[44px]">
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
        )}
      </div>
    </nav>
  );
}