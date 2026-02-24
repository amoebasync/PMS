'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { StaffHeader } from '@/components/staff/StaffHeader';
import { useState, useEffect } from 'react';

export default function DistributorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [distributorName, setDistributorName] = useState<string | undefined>();

  // 英語ポータル配下は /staff/en/layout.tsx が独自レイアウトを持つため素通りさせる
  const isEnglishPortal = pathname.startsWith('/staff/en');

  const isAuthPage =
    pathname === '/staff/login' || pathname === '/staff/change-password';

  useEffect(() => {
    if (isAuthPage || isEnglishPortal) return;
    fetch('/api/staff/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.name) setDistributorName(d.name); })
      .catch(() => {});
  }, [isAuthPage, isEnglishPortal]);

  if (isEnglishPortal) {
    return <>{children}</>;
  }

  const showNav = !isAuthPage;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StaffHeader name={distributorName} />
      <main className={`flex-1 max-w-lg mx-auto w-full px-4 py-6 ${showNav ? 'pb-24' : ''}`}>
        {children}
      </main>
    </div>
  );
}
