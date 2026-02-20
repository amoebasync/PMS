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
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[200px] h-[50px] mb-4">
            <Image src="/logo/logo_dark_transparent.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <h1 className="text-xl font-bold text-slate-800">クライアントログイン</h1>
        </div>

        {errorMsg && <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold"><i className="bi bi-exclamation-triangle-fill mr-2"></i>{errorMsg}</div>}

        <button 
          onClick={() => signIn('google', { callbackUrl: '/portal/mypage' })}
          className="w-full py-3 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 mb-6"
        >
          <i className="bi bi-google text-rose-500"></i> Googleアカウントでログイン
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-px bg-slate-200 flex-1"></div>
          <span className="text-xs font-bold text-slate-400">またはメールアドレスで</span>
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