'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PortalProviders } from '@/components/portal/PortalProviders';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { CartProvider } from '@/components/portal/CartContext';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // フルスクリーンで表示するページを判定
  const isFullScreenPage = pathname === '/portal/orders/new';

  return (
    <PortalProviders>
      <CartProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
          <PortalHeader />
          {/* ★ 変更: シミュレーション画面の場合は余白をゼロにする */}
          <main className={`flex-1 w-full relative flex flex-col ${isFullScreenPage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
            {children}
          </main>
        </div>
      </CartProvider>
    </PortalProviders>
  );
}