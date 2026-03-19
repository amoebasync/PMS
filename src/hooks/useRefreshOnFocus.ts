'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * タブがフォーカスを取り戻した時にコールバックを実行するフック
 *
 * - タブが非表示→表示になった時にrefresh関数を呼ぶ
 * - 最低インターバル（デフォルト5秒）以内の連続呼び出しを防止
 * - SSR安全（windowの存在チェック付き）
 */
export function useRefreshOnFocus(
  refreshFn: () => void | Promise<void>,
  options?: { minInterval?: number; enabled?: boolean }
) {
  const { minInterval = 5000, enabled = true } = options ?? {};
  const lastRefreshRef = useRef<number>(0);
  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;

  const handleVisibilityChange = useCallback(() => {
    if (!enabled) return;
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (now - lastRefreshRef.current > minInterval) {
        lastRefreshRef.current = now;
        refreshRef.current();
      }
    }
  }, [enabled, minInterval]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);
}
