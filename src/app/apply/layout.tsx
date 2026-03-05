import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '応募フォーム | 株式会社ティラミス',
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
