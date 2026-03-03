'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n';

// ─── 型定義 ───────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmOptions {
  title?: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning' | 'success';
  /** true にすると「閉じる」ボタンのみ表示（alertの代替）*/
  infoOnly?: boolean;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmState {
  message: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

interface NotificationContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

// ─── スタイル設定 ─────────────────────────────────────────
const TOAST_STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-emerald-600', icon: 'bi-check-circle-fill' },
  error:   { bg: 'bg-rose-600',    icon: 'bi-exclamation-circle-fill' },
  warning: { bg: 'bg-amber-500',   icon: 'bi-exclamation-triangle-fill' },
  info:    { bg: 'bg-indigo-600',  icon: 'bi-info-circle-fill' },
};

const CONFIRM_STYLES: Record<string, { btn: string; iconBg: string; iconColor: string; icon: string }> = {
  danger:  { btn: 'bg-rose-600 hover:bg-rose-700',     iconBg: 'bg-rose-100',    iconColor: 'text-rose-600',    icon: 'bi-exclamation-triangle-fill' },
  primary: { btn: 'bg-indigo-600 hover:bg-indigo-700', iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600',  icon: 'bi-question-circle-fill' },
  warning: { btn: 'bg-amber-500 hover:bg-amber-600',   iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   icon: 'bi-exclamation-triangle-fill' },
  success: { btn: 'bg-emerald-600 hover:bg-emerald-700', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: 'bi-check-circle-fill' },
};

// ─── Context ──────────────────────────────────────────────
const NotificationContext = createContext<NotificationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const showConfirm = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise(resolve => setConfirmState({ message, options, resolve }));
  }, []);

  const respond = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* ── Toast スタック ── */}
      <div className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const s = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`${s.bg} text-white flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl shadow-2xl min-w-[260px] max-w-sm pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-300`}
            >
              <i className={`bi ${s.icon} text-lg shrink-0`}></i>
              <p className="flex-1 text-sm font-bold leading-snug whitespace-pre-line">{t.message}</p>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-white/60 hover:text-white transition-colors ml-1 shrink-0"
              >
                <i className="bi bi-x-lg text-sm"></i>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── 確認モーダル ── */}
      {confirmState && (() => {
        const { message, options } = confirmState;
        const variant = options.variant ?? 'primary';
        const s = CONFIRM_STYLES[variant];
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center animate-in zoom-in-95 duration-200">
              <div className={`w-14 h-14 ${s.iconBg} ${s.iconColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <i className={`bi ${s.icon} text-2xl`}></i>
              </div>
              {options.title && (
                <h3 className="font-black text-slate-800 text-lg mb-2">{options.title}</h3>
              )}
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{message}</p>
              {options.detail && (
                <p className="text-slate-400 text-xs mt-2 leading-relaxed whitespace-pre-line">{options.detail}</p>
              )}
              <div className="flex justify-center gap-3 mt-6">
                {!options.infoOnly && (
                  <button
                    onClick={() => respond(false)}
                    className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                  >
                    {options.cancelLabel ?? t('confirm_dialog.cancel')}
                  </button>
                )}
                <button
                  onClick={() => respond(true)}
                  className={`px-5 py-2.5 ${s.btn} text-white rounded-xl font-bold text-sm shadow-md transition-colors`}
                >
                  {options.confirmLabel ?? (options.infoOnly ? t('confirm_dialog.close') : t('confirm_dialog.confirm'))}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </NotificationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────
export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
