'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PortalProviders } from '@/components/portal/PortalProviders';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { PortalFooter } from '@/components/portal/PortalFooter';
import { CartProvider } from '@/components/portal/CartContext';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // ★ 変更: トップページ ('/portal') もフルスクリーンで表示するように条件を追加
  const isFullScreenPage = pathname === '/portal/orders/new' || pathname === '/portal';

  // フッターを非表示にするページを判定（地図画面や入稿画面など）
  const hideFooter = 
    pathname === '/portal/orders/new' || 
    pathname?.match(/^\/portal\/orders\/\d+\/submit$/);

  return (
    <PortalProviders>
      <CartProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
          <PortalHeader />
          
          {/* メインコンテンツ領域 */}
          <main className={`flex-1 w-full relative flex flex-col ${isFullScreenPage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
            {children}
          </main>

          {/* フッターの表示制御 */}
          {!hideFooter && <PortalFooter />}
          
        </div>
      </CartProvider>
    </PortalProviders>
  );
}