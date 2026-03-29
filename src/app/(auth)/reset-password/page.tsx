'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setTokenError('パスワードリセットのリンクが正しくありません');
      setVerifying(false);
      return;
    }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
        } else {
          setTokenError(data.error || 'このリンクは無効です');
        }
      })
      .catch(() => {
        setTokenError('通信エラーが発生しました');
      })
      .finally(() => setVerifying(false));
  }, [token]);

  const getPasswordStrength = () => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    return score;
  };

  const strengthLevel = getPasswordStrength();
  const strengthColors = ['', 'bg-rose-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
  const strengthLabels = ['', '弱い', '普通', '良い', '強い'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setDone(true);
      } else {
        setErrorMsg(data.error || 'エラーが発生しました');
      }
    } catch {
      setErrorMsg('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 text-sm">リンクを確認中...</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center mx-auto">
          <i className="bi bi-x-circle text-rose-600 text-3xl"></i>
        </div>
        <div>
          <h2 className="text-slate-800 font-bold text-lg mb-2">リンクが無効です</h2>
          <p className="text-slate-500 text-sm">{tokenError}</p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all text-sm"
        >
          再度リセットをリクエストする
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
          <i className="bi bi-check-circle text-emerald-600 text-3xl"></i>
        </div>
        <div>
          <h2 className="text-slate-800 font-bold text-lg mb-2">パスワードを変更しました</h2>
          <p className="text-slate-500 text-sm">
            新しいパスワードでログインしてください。
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all text-sm"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-slate-800 font-bold text-lg mb-1">新しいパスワードの設定</h2>
        <p className="text-slate-500 text-sm">8文字以上の新しいパスワードを入力してください。</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-600 text-sm">
          <i className="bi bi-exclamation-circle-fill"></i>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">
            新しいパスワード
          </label>
          <div className="relative">
            <i className="bi bi-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              autoComplete="new-password"
              className="w-full bg-white border border-slate-300 text-slate-800 pl-12 pr-12 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} text-lg`}></i>
            </button>
          </div>
          {password.length > 0 && (
            <div className="space-y-1 px-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      level <= strengthLevel ? strengthColors[strengthLevel] : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs ${strengthLevel >= 3 ? 'text-green-400' : 'text-slate-400'}`}>
                強度: {strengthLabels[strengthLevel]}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">
            パスワード（確認）
          </label>
          <div className="relative">
            <i className="bi bi-lock-fill absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="もう一度入力"
              autoComplete="new-password"
              className={`w-full bg-white border text-slate-800 pl-12 pr-4 py-3 rounded-xl focus:ring-2 outline-none transition-all placeholder:text-slate-400 ${
                confirmPassword.length > 0 && password !== confirmPassword
                  ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                  : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
              required
            />
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-rose-400 px-1">パスワードが一致しません</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || password !== confirmPassword || password.length < 8}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              変更中...
            </>
          ) : (
            <>
              パスワードを変更する
              <i className="bi bi-check-lg text-xl"></i>
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden m-0 p-0">
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

        <Suspense
          fallback={
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            &copy; 2026 Tiramis Co., Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
