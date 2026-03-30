'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function DistributorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const res = await fetch('/api/staff/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMsg(data.error || 'ログインに失敗しました');
      setLoading(false);
      return;
    }

    const isEn = data.language === 'en';
    router.push(isEn ? '/staff/en' : '/staff');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[120px] h-[30px] sm:w-[160px] sm:h-[40px] mb-5">
            <Image src="/logo/logo_light_transparent.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <h1 className="text-xl font-bold text-slate-800">配布員ログイン</h1>
          <p className="text-xs text-slate-500 mt-1">メールアドレスとパスワードでログイン</p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold">
            <i className="bi bi-exclamation-triangle-fill mr-2"></i>{errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base font-medium"
              placeholder="mail@example.com"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">パスワード</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base font-medium"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} text-lg`}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all mt-2 disabled:opacity-70 text-base"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
