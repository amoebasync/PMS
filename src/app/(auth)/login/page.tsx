'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 入力値とエラーメッセージのStateを追加
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const accountIdRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(''); // エラーをリセット

    try {
      // ログインAPIを叩く
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, password }),
      });

      if (res.ok) {
        const data = await res.json();
        // ログイン時の言語設定をlocalStorageに保存（FOUC防止）
        try { localStorage.setItem('pms_lang', data.language || 'ja'); } catch { /* ignore */ }
        // 初回ログイン / 仮パスワードの場合はパスワード変更ページへ
        if (data.mustChangePassword) {
          router.push('/change-password');
        } else if (data.roles?.includes('DRIVER')) {
          router.push('/relay');
        } else {
          router.push('/');
        }
        router.refresh();
      } else {
        // ログイン失敗時 (401エラーなど)
        const data = await res.json();
        setErrorMsg(data.error || 'ログインに失敗しました');
        setLoading(false);
        accountIdRef.current?.focus();
      }
    } catch (error) {
      setErrorMsg('通信エラーが発生しました');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden m-0 p-0">
      {/* ログインカード */}
      <div className="relative z-10 w-full max-w-md p-8 bg-white border border-slate-200 rounded-2xl shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[200px] h-[60px] mb-2">
            <Image
              src="/logo/logo_light_transparent.png"
              alt="PMS Pro Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-slate-500 text-sm tracking-widest uppercase">Posting Management System</p>
        </div>

        {/* エラーメッセージの表示エリア */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-600 text-sm animate-fade-in">
            <i className="bi bi-exclamation-circle-fill"></i>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Account ID</label>
            <div className="relative">
              <i className="bi bi-person absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input
                ref={accountIdRef}
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="社員コード または メールアドレス"
                autoComplete="username"
                className="w-full bg-white border border-slate-300 text-slate-800 pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <i className="bi bi-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                className="w-full bg-white border border-slate-300 text-slate-800 pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Signing in...
              </>
            ) : (
              <>
                ログイン
                <i className="bi bi-arrow-right-short text-xl"></i>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            パスワードをお忘れですか？
          </a>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            &copy; 2026 Tiramis Co., Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
