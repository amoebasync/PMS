'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { StaffHeaderEn } from '@/components/staff/StaffHeaderEn';
import { useState, useEffect } from 'react';

export default function DistributorLayoutEn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [distributorName, setDistributorName] = useState<string | undefined>();

  const isAuthPage = pathname === '/staff/en/change-password';

  useEffect(() => {
    if (isAuthPage) return;
    fetch('/api/staff/profile')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.name) setDistributorName(d.name); })
      .catch(() => {});
  }, [isAuthPage]);

  const showNav = !isAuthPage;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StaffHeaderEn name={distributorName} />
      <main className={`flex-1 max-w-lg mx-auto w-full px-4 py-6 ${showNav ? 'pb-24' : ''}`}>
        {children}
      </main>
    </div>
  );
}
