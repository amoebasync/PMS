'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg('');

    const res = await signIn('credentials', {
      redirect: false, email, password,
    });

    if (res?.ok) {
      router.push('/portal/mypage');
      router.refresh();
    } else {
      setErrorMsg('メールアドレスまたはパスワードが間違っています。');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      
      {/* ★ 追加: トップページへ戻るリンク */}
      <Link href="/portal" className="mb-6 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-2">
        <i className="bi bi-arrow-left"></i> トップページへ戻る
      </Link>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[180px] h-[45px] mb-4">
            {/* ★ 変更: 白背景用のロゴに変更 */}
            <Image src="/logo/logo_light_transparent.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <h1 className="text-xl font-bold text-slate-800">クライアントログイン</h1>
        </div>

        {errorMsg && <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold"><i className="bi bi-exclamation-triangle-fill mr-2"></i>{errorMsg}</div>}

        <button 
          onClick={() => signIn('google', { callbackUrl: `${window.location.origin}/portal/mypage` })}
          className="w-full py-3.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 mb-6"
        >
          {/* ★ 変更: Google公式の4色SVGロゴ */}
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Googleアカウントでログイン
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-[11px] font-bold text-slate-400">またはメールアドレスで</span>
          <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">メールアドレス</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium" placeholder="mail@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">パスワード</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium" placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all mt-4 disabled:opacity-70">
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 font-medium">
          アカウントをお持ちでないですか？ <Link href="/portal/signup" className="text-indigo-600 hover:underline font-bold">新規登録はこちら</Link>
        </div>
      </div>
    </div>
  );
}