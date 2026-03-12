'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error.name, error.message, error.stack);
    // チャンク読み込み失敗（新デプロイ後に古いキャッシュが残っている場合）
    // → ページ全体をリロードして新しいチャンクを取得する
    if (
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed')
    ) {
      window.location.reload();
    }
  }, [error]);

  const isChunkError =
    error.name === 'ChunkLoadError' ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('Failed to fetch dynamically imported module');

  if (isChunkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">更新を反映しています...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md p-8">
        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="bi bi-exclamation-triangle-fill text-rose-500 text-xl"></i>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">エラーが発生しました</h2>
        <p className="text-sm text-slate-500 mb-6">
          ページの読み込み中に問題が発生しました。
        </p>
        {process.env.NODE_ENV !== 'production' && (
          <pre className="text-xs text-left bg-slate-100 p-3 rounded mb-4 overflow-auto max-h-40 text-red-600">
            {error.name}: {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
