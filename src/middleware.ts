import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isPublicPath =
    path === '/login' ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/change-password' ||
    path === '/api/auth/change-password' ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/portal/register') ||
    path.startsWith('/q/') ||
    path === '/portal/login' ||
    path === '/portal/signup' ||
    path === '/portal' ||
    path === '/portal/orders/new' ||
    path === '/portal/cart' ||
    path === '/portal/terms' ||
    path === '/portal/privacy' ||
    path === '/app-privacy' ||
    path.startsWith('/api/locations') ||
    path.startsWith('/api/areas') ||
    path.startsWith('/uploads/') || // アップロードされたファイルの閲覧を許可（旧パス互換）
    path.startsWith('/api/s3-proxy') || // S3署名付きURLプロキシ
    path === '/staff/login' ||
    path === '/api/staff/auth/login' ||
    path === '/apply' ||
    path.startsWith('/apply/manage') ||
    path.startsWith('/api/apply') ||
    path === '/api/interview-slots/available' ||
    path === '/api/job-categories/public' ||
    path === '/api/countries/public' ||
    path === '/api/visa-types/public' ||
    path === '/api/recruiting-media/public' ||
    path === '/api/cron/generate-slots' ||
    path === '/api/cron/generate-tasks' ||
    path === '/api/cron/generate-training-slots' ||
    path === '/api/training-slots/available' ||
    path === '/api/training-booking' ||
    path === '/training-booking';

  const adminSession = request.cookies.get('pms_session')?.value;
  const portalSession = request.cookies.get('next-auth.session-token')?.value || request.cookies.get('__Secure-next-auth.session-token')?.value;
  const distributorSession = request.cookies.get('pms_distributor_session')?.value;
  const forcePwChange = request.cookies.get('pms_force_pw_change')?.value;

  // 社員ログイン後・初回パスワード強制変更
  if (
    adminSession &&
    forcePwChange === '1' &&
    !isPublicPath &&
    !path.startsWith('/portal') &&
    !path.startsWith('/staff')
  ) {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  // --- 0. 配布員ポータル画面 (/staff) へのアクセス制御 ---
  if (path.startsWith('/staff') && !isPublicPath) {
    if (!distributorSession) {
      return NextResponse.redirect(new URL('/staff/login', request.url));
    }
    return NextResponse.next();
  }

  // --- 0b. 配布員用API (/api/staff) へのアクセス制御 ---
  if (path.startsWith('/api/staff/') && !isPublicPath) {
    if (!distributorSession) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }
    return NextResponse.next();
  }

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