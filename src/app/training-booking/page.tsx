'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

// ─── i18n ─────────────────────────────────────────────────
const translations = {
  ja: {
    title: '研修日程を選択してください',
    subtitle: '希望の研修日程を選んでお申し込みください',
    loadingTitle: '読み込み中...',
    selectSlot: '研修スロットを選択',
    submit: '予約する',
    submitting: '予約中...',
    remaining: '残',
    remaining_suffix: '名',
    full: '満員',
    location: '場所',
    successTitle: '研修予約が完了しました！',
    successMessage: '以下の日程で研修が予約されました。確認メールをお送りします。',
    trainingDate: '研修日',
    trainingTime: '時間',
    trainingLocation: '場所',
    errorInvalidToken: '無効な予約リンクです。管理者にお問い合わせください。',
    errorAlreadyBooked: 'すでに研修スロットが予約されています。',
    errorNotHired: 'この操作を実行する権限がありません。',
    errorTokenExpired: '予約リンクの有効期限が切れています。',
    errorNoSlots: '現在予約可能な研修スロットはありません。後日改めてご確認ください。',
    errorGeneral: '予約に失敗しました。もう一度お試しください。',
    errorLoading: '情報の取得に失敗しました。',
    selectPrompt: '研修スロットを選択してください',
    noSlotsAvailable: '利用可能な研修スロットがありません',
    backToTop: 'トップページへ',
  },
  en: {
    title: 'Select Training Schedule',
    subtitle: 'Please select your preferred training schedule',
    loadingTitle: 'Loading...',
    selectSlot: 'Select Training Slot',
    submit: 'Book Now',
    submitting: 'Booking...',
    remaining: 'Remaining: ',
    remaining_suffix: ' seats',
    full: 'Full',
    location: 'Location',
    successTitle: 'Training Booked Successfully!',
    successMessage: 'Your training has been scheduled. A confirmation email will be sent to you.',
    trainingDate: 'Training Date',
    trainingTime: 'Time',
    trainingLocation: 'Location',
    errorInvalidToken: 'Invalid booking link. Please contact the administrator.',
    errorAlreadyBooked: 'A training slot is already booked for you.',
    errorNotHired: 'You do not have permission to perform this action.',
    errorTokenExpired: 'This booking link has expired.',
    errorNoSlots: 'No training slots are currently available. Please check back later.',
    errorGeneral: 'Booking failed. Please try again.',
    errorLoading: 'Failed to load information.',
    selectPrompt: 'Please select a training slot',
    noSlotsAvailable: 'No training slots available',
    backToTop: 'Back to Home',
  },
};

// ─── Types ────────────────────────────────────────────────
type Lang = 'ja' | 'en';

interface TrainingSlot {
  id: number;
  startTime: string;
  endTime: string;
  capacity: number;
  location: string | null;
  bookedCount: number;
  remainingCapacity: number;
}

interface ApplicantInfo {
  id: number;
  name: string;
  email: string;
  language: string;
  trainingSlotId: number | null;
}

interface BookingData {
  applicant: ApplicantInfo;
  slots: TrainingSlot[];
}

interface SuccessData {
  startTime: string;
  endTime: string;
  location: string | null;
}

// ─── Helper ───────────────────────────────────────────────
function formatDate(dateStr: string, lang: Lang) {
  return new Date(dateStr).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Tokyo',
  });
}

function formatTime(startStr: string, endStr: string) {
  const start = new Date(startStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  const end = new Date(endStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  return `${start} - ${end}`;
}

// ─── Inner Component (uses useSearchParams) ───────────────
function TrainingBookingContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [lang, setLang] = useState<Lang>('ja');
  const t = translations[lang];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);

  useEffect(() => {
    if (!token) {
      setError(translations.ja.errorInvalidToken);
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/training-booking?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) setError(translations.ja.errorInvalidToken);
          else if (res.status === 409) setError(translations.ja.errorAlreadyBooked);
          else if (res.status === 403) setError(translations.ja.errorNotHired);
          else setError(data.error || translations.ja.errorLoading);
          setLoading(false);
          return;
        }
        setBookingData(data);
        // 言語設定を応募者の言語に合わせる
        if (data.applicant?.language === 'en') {
          setLang('en');
        }
      } catch {
        setError(translations.ja.errorLoading);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleSubmit = async () => {
    if (!selectedSlotId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/training-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, trainingSlotId: selectedSlotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setError(t.errorAlreadyBooked);
        else setError(data.error || t.errorGeneral);
        return;
      }
      setSuccess({
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
      });
    } catch {
      setError(t.errorGeneral);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 font-sans">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Image
            src="/logo/logo_light_transparent.png"
            alt="Logo"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
          />
          <button
            onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {lang === 'ja' ? 'English' : '日本語'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* ローディング */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium">{t.loadingTitle}</p>
          </div>
        )}

        {/* エラー表示 */}
        {!loading && error && !success && (
          <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-8 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-rose-500 text-2xl"></i>
            </div>
            <h2 className="text-lg font-black text-slate-800 mb-2">{lang === 'ja' ? 'エラーが発生しました' : 'An Error Occurred'}</h2>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        )}

        {/* 成功表示 */}
        {success && (
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-check-circle-fill text-emerald-500 text-2xl"></i>
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">{t.successTitle}</h2>
            <p className="text-sm text-slate-600 mb-6">{t.successMessage}</p>

            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-6">
              <div className="flex gap-2">
                <span className="text-xs font-bold text-slate-500 w-20 shrink-0">{t.trainingDate}</span>
                <span className="text-sm font-bold text-slate-800">{formatDate(success.startTime, lang)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs font-bold text-slate-500 w-20 shrink-0">{t.trainingTime}</span>
                <span className="text-sm font-bold text-slate-800">{formatTime(success.startTime, success.endTime)}</span>
              </div>
              {success.location && (
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-slate-500 w-20 shrink-0">{t.trainingLocation}</span>
                  <span className="text-sm font-bold text-slate-800">{success.location}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 予約フォーム */}
        {!loading && !error && !success && bookingData && (
          <div className="space-y-6">
            {/* ページタイトル */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-800">{t.title}</h1>
              <p className="text-sm text-slate-500 mt-2">{t.subtitle}</p>
              {bookingData.applicant && (
                <p className="text-sm font-bold text-indigo-600 mt-1">{bookingData.applicant.name} 様</p>
              )}
            </div>

            {/* スロット一覧 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                  <i className="bi bi-calendar3 text-indigo-500"></i>
                  {t.selectSlot}
                </h2>
              </div>

              {bookingData.slots.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <i className="bi bi-calendar-x text-3xl text-slate-300 block mb-3"></i>
                  <p className="text-sm text-slate-400">{t.noSlotsAvailable}</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {bookingData.slots.map(slot => {
                    const isFull = slot.remainingCapacity <= 0;
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={isFull}
                        onClick={() => !isFull && setSelectedSlotId(slot.id)}
                        className={`w-full text-left rounded-xl border-2 px-4 py-4 transition-all ${
                          isFull
                            ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {/* 選択インジケーター */}
                            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                              isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                            </div>
                            <div>
                              {/* 日付 */}
                              <p className="text-sm font-black text-slate-800">
                                {formatDate(slot.startTime, lang)}
                              </p>
                              {/* 時間 */}
                              <p className="text-sm text-slate-600 mt-0.5">
                                <i className="bi bi-clock mr-1.5 text-indigo-400"></i>
                                {formatTime(slot.startTime, slot.endTime)}
                              </p>
                              {/* 場所 */}
                              {slot.location && (
                                <p className="text-xs text-slate-500 mt-1">
                                  <i className="bi bi-geo-alt mr-1 text-slate-400"></i>
                                  {slot.location}
                                </p>
                              )}
                            </div>
                          </div>
                          {/* 残席 */}
                          <div className={`shrink-0 text-right ${isFull ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {isFull ? (
                              <span className="text-xs font-bold bg-rose-100 text-rose-600 px-2 py-1 rounded-full">
                                {t.full}
                              </span>
                            ) : (
                              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                                {lang === 'ja'
                                  ? `残${slot.remainingCapacity}${t.remaining_suffix}`
                                  : `${t.remaining}${slot.remainingCapacity}${t.remaining_suffix}`
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 送信ボタン */}
            {bookingData.slots.length > 0 && (
              <div className="space-y-3">
                {!selectedSlotId && (
                  <p className="text-center text-sm text-slate-400">{t.selectPrompt}</p>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedSlotId || submitting}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-calendar-check"></i>
                      {t.submit}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="mt-16 pb-8 text-center">
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Tiramisu Inc. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// ─── Main Export (with Suspense for useSearchParams) ──────
export default function TrainingBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    }>
      <TrainingBookingContent />
    </Suspense>
  );
}
