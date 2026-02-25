'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ChangePasswordPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/portal/login');
    return null;
  }

  const mustChange = (session?.user as any)?.mustChangePassword === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/portal/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/portal/mypage');
      } else {
        setErrorMsg(data.error || 'エラーが発生しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8">

        <div className="flex flex-col items-center mb-6">
          <div className="relative w-[180px] h-[45px] mb-4">
            <Image src="/logo/logo_light_transparent.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <h1 className="text-xl font-bold text-slate-800">パスワードの変更</h1>
        </div>

        {mustChange && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <i className="bi bi-exclamation-triangle-fill text-amber-500 text-lg shrink-0 mt-0.5"></i>
            <div>
              <p className="text-sm font-bold text-amber-800">初期パスワードの変更が必要です</p>
              <p className="text-xs text-amber-700 mt-1">セキュリティのため、初回ログイン後に必ずパスワードを変更してください。</p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold">
            <i className="bi bi-exclamation-triangle-fill mr-2"></i>{errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">現在のパスワード</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium"
              placeholder="現在のパスワード"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">新しいパスワード</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium"
              placeholder="8文字以上・大小英字・数字を含む"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">新しいパスワード（確認）</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm font-medium"
              placeholder="もう一度入力してください"
            />
          </div>

          <p className="text-[11px] text-slate-400 ml-1">
            ※ 8文字以上、大文字・小文字・数字または記号をそれぞれ1文字以上含めてください
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all mt-2 disabled:opacity-70"
          >
            {loading ? '変更中...' : 'パスワードを変更する'}
          </button>

          {!mustChange && (
            <button
              type="button"
              onClick={() => router.push('/portal/mypage')}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              キャンセル
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
