'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_MANUAL_ID || '';

export default function ManualLiffPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    if (!LIFF_ID) {
      setError('LIFF_MANUAL_ID 未設定');
      return;
    }

    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const profile = await liff.getProfile();
        const res = await fetch('/api/staff/auth/line-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId: profile.userId }),
        });

        if (res.ok) {
          const data = await res.json();
          const dest = data.language === 'en' ? '/staff/en/manual' : '/staff/manual';
          window.location.href = dest;
        } else {
          const err = await res.json();
          setError(err.error || 'Login failed');
        }
      })
      .catch(err => {
        console.error('LIFF init error:', err);
        setError('LINE認証に失敗しました');
      });
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <a href="/staff/login" className="text-indigo-600 text-sm underline">
            手動でログイン
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">マニュアルを読み込み中...</p>
      </div>
    </div>
  );
}
