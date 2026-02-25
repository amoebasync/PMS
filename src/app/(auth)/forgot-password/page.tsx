'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, birthday }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
      } else {
        setErrorMsg(data.error || 'エラーが発生しました');
      }
    } catch {
      setErrorMsg('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden m-0 p-0">
      {/* 背景装飾 */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]"></div>
      </div>

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
          <p className="text-slate-400 text-sm tracking-widest uppercase">Posting Management System</p>
        </div>

        {submitted ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto">
              <i className="bi bi-envelope-check text-green-400 text-3xl"></i>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg mb-2">メールを送信しました</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                入力されたメールアドレスと生年月日が一致する場合、パスワードリセットのご案内を送信しました。<br />
                メールをご確認ください。リンクは1時間以内・1回限り有効です。
              </p>
            </div>
            <Link
              href="/login"
              className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <i className="bi bi-arrow-left mr-1"></i>
              ログインページへ戻る
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-white font-bold text-lg mb-1">パスワードのリセット</h2>
              <p className="text-slate-400 text-sm">
                登録済みのメールアドレスと生年月日を入力してください。確認後、パスワードリセット用のリンクをお送りします。
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
                <i className="bi bi-exclamation-circle-fill"></i>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                  メールアドレス
                </label>
                <div className="relative">
                  <i className="bi bi-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="登録済みのメールアドレス"
                    autoComplete="email"
                    className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">
                  生年月日
                </label>
                <div className="relative">
                  <i className="bi bi-calendar3 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
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
                    送信中...
                  </>
                ) : (
                  <>
                    リセットメールを送信
                    <i className="bi bi-send text-base"></i>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
              >
                <i className="bi bi-arrow-left mr-1"></i>
                ログインページへ戻る
              </Link>
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            &copy; 2026 Tiramis Co., Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
