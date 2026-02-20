import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ★ 変更: API (/api/locations, /api/areas) を認証不要の公開パスに追加
  const isPublicPath = 
    path === '/login' || 
    path.startsWith('/api/auth') || 
    path.startsWith('/api/portal/register') ||
    path.startsWith('/q/') ||
    path === '/portal/login' ||
    path === '/portal/signup' ||
    path === '/portal' ||
    path === '/portal/orders/new' || 
    path === '/portal/cart' ||
    path.startsWith('/api/locations') || // ← 追加: 都道府県マスタ取得用
    path.startsWith('/api/areas');       // ← 追加: 地図ポリゴン描画用

  const adminSession = request.cookies.get('pms_session')?.value;
  const portalSession = request.cookies.get('next-auth.session-token')?.value || request.cookies.get('__Secure-next-auth.session-token')?.value;

  if (path.startsWith('/portal') && !isPublicPath) {
    if (!portalSession) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }
    return NextResponse.next();
  }

  if (portalSession && (path === '/portal/login' || path === '/portal/signup')) {
    return NextResponse.redirect(new URL('/portal/mypage', request.url));
  }

  if (!path.startsWith('/portal') && !isPublicPath) {
    if (!adminSession) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (adminSession && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo/).*)'],
};