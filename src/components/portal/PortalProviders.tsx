'use client';

import { SessionProvider } from "next-auth/react";

export function PortalProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}