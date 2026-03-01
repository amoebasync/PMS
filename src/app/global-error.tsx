'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // チャンク読み込み失敗時は自動リロード
    if (
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed')
    ) {
      window.location.reload();
    }
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
              エラーが発生しました
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>
              ページを再読み込みしてください。
            </p>
            <button
              onClick={reset}
              style={{ background: '#4f46e5', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
            >
              再試行
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
