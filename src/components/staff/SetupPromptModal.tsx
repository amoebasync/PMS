'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type SetupStep = {
  id: string;
  icon: string;
  gradient: string;
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
};

const STEPS_JA: SetupStep[] = [
  {
    id: 'residence-card',
    icon: 'bi-person-vcard',
    gradient: 'from-sky-500 to-cyan-600',
    title: '在留カードを登録',
    description: '在留カードの表面と裏面の写真を\nアップロードしてください。\n就労資格の確認に必要です。',
    buttonLabel: '写真をアップロードする',
    href: '/staff/profile#residence-card',
  },
  {
    id: 'payment-method',
    icon: 'bi-cash-stack',
    gradient: 'from-emerald-500 to-teal-600',
    title: '給料の受取方法を設定',
    description: '給与の受取方法を選択してください。\n銀行振込の場合は、キャッシュカードを\n撮影するだけで口座情報を自動登録できます。',
    buttonLabel: '受取方法を設定する',
    href: '/staff/profile#payment-method',
  },
];

const STEPS_EN: SetupStep[] = [
  {
    id: 'residence-card',
    icon: 'bi-person-vcard',
    gradient: 'from-sky-500 to-cyan-600',
    title: 'Upload Residence Card',
    description: 'Please upload photos of the front and\nback of your residence card.\nThis is required to verify your work permit.',
    buttonLabel: 'Upload Photos',
    href: '/staff/en/profile#residence-card',
  },
  {
    id: 'payment-method',
    icon: 'bi-cash-stack',
    gradient: 'from-emerald-500 to-teal-600',
    title: 'Set Payment Method',
    description: 'Choose how you want to receive your salary.\nFor bank transfer, just take a photo of your\nbank card to auto-register account info.',
    buttonLabel: 'Set Up Payment',
    href: '/staff/en/profile#payment-method',
  },
];

type Props = {
  lang: 'ja' | 'en';
  /** Which steps to show (filtered by what's missing) */
  missingSteps: ('residence-card' | 'payment-method')[];
  onComplete: () => void;
};

export default function SetupPromptModal({ lang, missingSteps, onComplete }: Props) {
  const router = useRouter();
  const allSteps = lang === 'en' ? STEPS_EN : STEPS_JA;
  const steps = allSteps.filter((s) => missingSteps.includes(s.id as 'residence-card' | 'payment-method'));

  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  if (steps.length === 0) {
    onComplete();
    return null;
  }

  const step = steps[current];
  const isLast = current === steps.length - 1;

  const handleSkip = () => {
    if (isLast) {
      setVisible(false);
      setTimeout(() => onComplete(), 300);
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const handleAction = () => {
    setVisible(false);
    setTimeout(() => {
      onComplete();
      router.push(step.href);
    }, 300);
  };

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header with step counter */}
          <div className="flex items-center justify-between px-6 pt-5">
            {steps.length > 1 && (
              <span className="text-xs font-bold text-slate-400">
                {lang === 'en' ? 'Step' : 'ステップ'} {current + 1} / {steps.length}
              </span>
            )}
            {steps.length <= 1 && <span />}
            <button
              onClick={handleSkip}
              className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors px-3 py-1 rounded-full hover:bg-slate-100"
            >
              {lang === 'en' ? 'Later' : 'あとで'}
            </button>
          </div>

          {/* Icon area */}
          <div className="flex justify-center pt-6 pb-4">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg`}>
              <i className={`bi ${step.icon} text-4xl text-white drop-shadow-sm`}></i>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-2 text-center">
            <h2 className="text-xl font-black text-slate-800 mb-3">
              {step.title}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">
              {step.description}
            </p>
          </div>

          {/* Actions */}
          <div className="px-8 pt-6 pb-8 space-y-3">
            <button
              onClick={handleAction}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all text-sm flex items-center justify-center gap-2"
            >
              {step.buttonLabel}
              <i className="bi bi-arrow-right"></i>
            </button>

            <button
              onClick={handleSkip}
              className="w-full py-3 text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors"
            >
              {lang === 'en' ? 'I\'ll do it later' : 'あとで設定する'}
            </button>
          </div>

          {/* Progress dots */}
          {steps.length > 1 && (
            <div className="flex justify-center gap-2 pb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
