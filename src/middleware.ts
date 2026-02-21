import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

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
    path.startsWith('/api/locations') || 
    path.startsWith('/api/areas');       

  const adminSession = request.cookies.get('pms_session')?.value;
  const portalSession = request.cookies.get('next-auth.session-token')?.value || request.cookies.get('__Secure-next-auth.session-token')?.value;

  // --- 1. クライアントポータル画面 (/portal) へのアクセス制御 ---
  if (path.startsWith('/portal') && !isPublicPath) {
    if (!portalSession) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }
    return NextResponse.next();
  }

  if (portalSession && (path === '/portal/login' || path === '/portal/signup')) {
    return NextResponse.redirect(new URL('/portal/mypage', request.url));
  }

  // --- 2. クライアント用API (/api/portal) へのアクセス制御 ---
  if (path.startsWith('/api/portal/') && !isPublicPath) {
    if (!portalSession) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // --- 3. 社内管理システム (上記以外) へのアクセス制御 ---
  if (!path.startsWith('/portal') && !path.startsWith('/api/portal/') && !isPublicPath) {
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