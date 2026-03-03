'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

type Slide = {
  icon: string;
  title: string;
  description: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
};

const SLIDES_JA: Slide[] = [
  {
    icon: 'bi-calendar-check',
    title: 'シフト登録',
    description: '週単位でシフトを登録・キャンセルできます。\n日付をタップして選択し、まとめて送信するだけ。',
    gradient: 'from-indigo-500 to-blue-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-train-front',
    title: '交通費申請',
    description: '勤務で発生した交通費を簡単に申請できます。\n日付・金額・経路を入力して送信。',
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-file-earmark-text',
    title: '配布履歴',
    description: '過去の配布実績を確認できます。\n配布枚数やエリア情報をいつでもチェック。',
    gradient: 'from-sky-500 to-cyan-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-star',
    title: '評価',
    description: 'あなたのパフォーマンス評価を確認できます。\n日々の配布品質の振り返りに。',
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-wallet2',
    title: '給与明細',
    description: '週ごとの給与明細を確認できます。\n配布実績に基づく報酬が表示されます。',
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-person-circle',
    title: 'プロフィール',
    description: '個人情報や銀行口座情報を管理できます。\n住所変更なども、ここから簡単に更新。',
    gradient: 'from-rose-500 to-pink-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
];

const SLIDES_EN: Slide[] = [
  {
    icon: 'bi-calendar-check',
    title: 'Shift Registration',
    description: 'Register and cancel shifts on a weekly basis.\nJust tap dates to select and submit all at once.',
    gradient: 'from-indigo-500 to-blue-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-train-front',
    title: 'Transportation Expense',
    description: 'Easily submit transportation expenses.\nEnter the date, amount, and route to submit.',
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-file-earmark-text',
    title: 'Distribution History',
    description: 'Check your past distribution records.\nView delivery count and area details anytime.',
    gradient: 'from-sky-500 to-cyan-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-star',
    title: 'Rating',
    description: 'View your performance rating.\nReflect on your daily distribution quality.',
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-wallet2',
    title: 'Payroll',
    description: 'Check your weekly payroll details.\nEarnings based on your distribution work.',
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
  {
    icon: 'bi-person-circle',
    title: 'Profile',
    description: 'Manage your personal and bank info.\nEasily update your address and other details.',
    gradient: 'from-rose-500 to-pink-600',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
  },
];

type Props = {
  lang: 'ja' | 'en';
  onComplete: () => void;
};

export default function OnboardingModal({ lang, onComplete }: Props) {
  const slides = lang === 'en' ? SLIDES_EN : SLIDES_JA;
  const [current, setCurrent] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [visible, setVisible] = useState(false);

  // Touch swipe
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Fade in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const isLast = current === slides.length - 1;

  const completeOnboarding = useCallback(async () => {
    setFinishing(true);
    await fetch('/api/staff/onboarding', { method: 'PUT' });
    setVisible(false);
    setTimeout(() => onComplete(), 300);
  }, [onComplete]);

  const handleNext = () => {
    if (isLast) {
      completeOnboarding();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handlePrev = () => {
    if (current > 0) setCurrent((c) => c - 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && current < slides.length - 1) {
        setCurrent((c) => c + 1);
      } else if (diff < 0 && current > 0) {
        setCurrent((c) => c - 1);
      }
    }
  };

  const slide = slides[current];

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal card */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Gradient header with icon */}
          <div className={`bg-gradient-to-br ${slide.gradient} px-8 pt-12 pb-16 text-center relative overflow-hidden transition-all duration-500`}>
            {/* Decorative circles */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute top-16 left-8 w-16 h-16 rounded-full bg-white/5" />

            {/* Skip button */}
            <button
              onClick={completeOnboarding}
              disabled={finishing}
              className="absolute top-4 right-4 text-white/70 hover:text-white text-sm font-medium transition-colors px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            >
              {lang === 'en' ? 'Skip' : 'スキップ'}
            </button>

            {/* Page counter */}
            <div className="absolute top-4 left-4 text-white/50 text-xs font-bold">
              {current + 1} / {slides.length}
            </div>

            {/* Icon */}
            <div className={`w-24 h-24 rounded-3xl ${slide.iconBg} backdrop-blur-sm mx-auto flex items-center justify-center mb-6 shadow-lg`}>
              <i className={`bi ${slide.icon} text-5xl ${slide.iconColor} drop-shadow-md`}></i>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-black text-white drop-shadow-sm">
              {slide.title}
            </h2>
          </div>

          {/* Body */}
          <div className="px-8 pt-8 pb-6">
            <p className="text-sm text-slate-600 text-center leading-relaxed whitespace-pre-line min-h-[60px]">
              {slide.description}
            </p>
          </div>

          {/* Dots + Button */}
          <div className="px-8 pb-8 space-y-5">
            {/* Dot indicators */}
            <div className="flex justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex gap-3">
              {current > 0 && (
                <button
                  onClick={handlePrev}
                  className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors shrink-0"
                >
                  <i className="bi bi-chevron-left text-lg"></i>
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={finishing}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 text-base flex items-center justify-center gap-2"
              >
                {finishing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isLast ? (
                  lang === 'en' ? 'Get Started' : '始める'
                ) : (
                  <>{lang === 'en' ? 'Next' : '次へ'} <i className="bi bi-arrow-right"></i></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
