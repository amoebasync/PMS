'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // 入力値とエラーメッセージのStateを追加
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
        // ログイン成功時
        router.push('/');
        router.refresh(); // 状態を最新にするためリフレッシュ
      } else {
        // ログイン失敗時 (401エラーなど)
        const data = await res.json();
        setErrorMsg(data.error || 'ログインに失敗しました');
        setLoading(false);
      }
    } catch (error) {
      setErrorMsg('通信エラーが発生しました');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden m-0 p-0">      {/* 背景装飾 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]"></div>
      </div>

      {/* ログインカード */}
      <div className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[200px] h-[60px] mb-2">
            <Image 
              src="/logo/logo_dark_transparent.png" 
              alt="PMS Pro Logo" 
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase">Property Management System</p>
        </div>

        {/* エラーメッセージの表示エリア */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm animate-fade-in">
            <i className="bi bi-exclamation-circle-fill"></i>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Account ID</label>
            <div className="relative">
              <i className="bi bi-person absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input 
                type="text" 
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="社員コード または メールアドレス" 
                className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <i className="bi bi-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力" 
                className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            &copy; 2026 Tiramis Co., Ltd. All rights reserved.
          </p>
        </div> 
      </div>
    </div>
  );
}