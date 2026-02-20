import React from 'react';
import { PortalProviders } from '@/components/portal/PortalProviders';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { CartProvider } from '@/components/portal/CartContext'; // ★ 追加

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalProviders>
      <CartProvider> {/* ★ 追加 */}
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
          <PortalHeader />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
            {children}
          </main>
        </div>
      </CartProvider>
    </PortalProviders>
  );
}