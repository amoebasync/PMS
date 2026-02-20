import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 現在アクセスしようとしているURLのパス（例: '/employees', '/login' など）
  const path = request.nextUrl.pathname;

  // ★ 修正: ログイン不要でアクセスできるパスに `path.startsWith('/q/')` を追加！
  const isPublicPath = path === '/login' || path.startsWith('/api/auth') || path.startsWith('/q/');

  // ブラウザのCookieからセッション（ログイン情報）を取得
  const session = request.cookies.get('pms_session')?.value;

  // --- 判定ロジック ---

  // 1. 未ログイン(セッションなし) なのに、ログイン必須のページにアクセスしようとした場合
  if (!session && !isPublicPath) {
    // APIルートの場合はリダイレクトではなく 401 Unauthorized エラーを返す
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }
    // 通常の画面の場合はログイン画面へ強制送還
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. 既にログイン済みなのに、再度ログイン画面(/login)にアクセスしようとした場合
  if (session && path === '/login') {
    // ダッシュボード(/)に飛ばす
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 問題なければそのままアクセスを許可
  return NextResponse.next();
}

// ミドルウェアを動作させる対象のパスを指定（画像やシステムファイルを除外）
export const config = {
  matcher: [
    /*
     * 以下のパス "以外" のすべてのリクエストでミドルウェアを実行する
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化)
     * - favicon.ico (ファビコン)
     * - logo/ (ロゴ画像などのフォルダ)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo/).*)',
  ],
};