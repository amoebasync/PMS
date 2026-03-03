'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';

export default function ChangePasswordPage() {
  const { t } = useTranslation('change-password');
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // パスワード強度チェック
  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;
  const strengthLabel = ['', t('strength_weak'), t('strength_fair'), t('strength_strong'), t('strength_very_strong')][strengthScore] ?? '';
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-blue-500', 'bg-green-500'][strengthScore] ?? '';
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!hasLength) {
      setErrorMsg(t('error_min_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('error_mismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('error_change_failed'));
      }
    } catch {
      setErrorMsg(t('error_network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[180px] h-[54px] mb-4">
            <Image src="/logo/logo_dark_transparent.png" alt="PMS Pro" fill className="object-contain" priority />
          </div>
          {/* 注意バナー */}
          <div className="w-full flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <i className="bi bi-shield-lock-fill text-amber-400 text-xl mt-0.5 shrink-0"></i>
            <div>
              <p className="text-amber-300 font-bold text-sm">{t('banner_title')}</p>
              <p className="text-amber-400/80 text-xs mt-0.5">{t('banner_message')}</p>
            </div>
          </div>
        </div>

        {/* エラー */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-400 text-sm">
            <i className="bi bi-exclamation-circle-fill shrink-0"></i>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 新しいパスワード */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">{t('label_new_password')}</label>
            <div className="relative">
              <i className="bi bi-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={t('placeholder_new')}
                className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-12 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <i className={`bi ${showNew ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>

            {/* 強度バー */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                        i <= strengthScore ? strengthColor : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex gap-3 text-[11px]">
                    <span className={hasLength ? 'text-green-400' : 'text-slate-500'}>
                      <i className={`bi ${hasLength ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>{t('rule_length')}
                    </span>
                    <span className={hasUpper ? 'text-green-400' : 'text-slate-500'}>
                      <i className={`bi ${hasUpper ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>{t('rule_uppercase')}
                    </span>
                    <span className={hasLower ? 'text-green-400' : 'text-slate-500'}>
                      <i className={`bi ${hasLower ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>{t('rule_lowercase')}
                    </span>
                    <span className={hasNumber ? 'text-green-400' : 'text-slate-500'}>
                      <i className={`bi ${hasNumber ? 'bi-check-circle-fill' : 'bi-circle'} mr-1`}></i>{t('rule_number')}
                    </span>
                  </div>
                  <span className={`text-[11px] font-bold ${strengthColor.replace('bg-', 'text-')}`}>
                    {strengthLabel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 確認用パスワード */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">{t('label_confirm_password')}</label>
            <div className="relative">
              <i className="bi bi-lock-fill absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t('placeholder_confirm')}
                className={`w-full bg-slate-900/50 border text-white pl-12 pr-12 py-3 rounded-xl focus:ring-2 outline-none transition-all placeholder:text-slate-600 ${
                  confirmPassword.length > 0
                    ? isMatch
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                    : 'border-slate-700 focus:ring-amber-500 focus:border-amber-500'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
              {confirmPassword.length > 0 && (
                <i className={`bi absolute right-11 top-1/2 -translate-y-1/2 text-sm ${
                  isMatch ? 'bi-check-circle-fill text-green-400' : 'bi-x-circle-fill text-rose-400'
                }`}></i>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !hasLength || !isMatch}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {t('btn_submitting')}
              </>
            ) : (
              <>
                <i className="bi bi-shield-check text-lg"></i>
                {t('btn_submit')}
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          &copy; 2026 Tiramis Co., Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
