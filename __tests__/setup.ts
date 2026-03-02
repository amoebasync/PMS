import { vi } from 'vitest';

// Next.js のモジュールをグローバルにモック
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return actual;
});

// Node.js 18+ の Request/Response をグローバルに確認
if (typeof globalThis.Request === 'undefined') {
  const { Request, Response, Headers } = await import('node-fetch' as any);
  Object.assign(globalThis, { Request, Response, Headers });
}
