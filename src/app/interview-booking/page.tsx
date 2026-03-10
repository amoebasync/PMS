'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

// ─── i18n ─────────────────────────────────────────────────
const translations = {
  ja: {
    title: '面接日程を選択してください',
    subtitle: '希望の面接日程を選んでお申し込みください',
    loadingTitle: '読み込み中...',
    selectSlot: '面接スロットを選択',
    submit: '予約する',
    submitting: '予約中...',
    interviewer: '面接担当',
    successTitle: '面接予約が完了しました！',
    successMessage: '以下の日程で面接が予約されました。確認メールをお送りします。',
    interviewDate: '面接日',
    interviewTime: '時間',
    meetUrl: 'Google Meet',
    joinMeet: '面接に参加する',
    errorInvalidToken: '無効な予約リンクです。管理者にお問い合わせください。',
    errorAlreadyBooked: 'すでに面接スロットが予約されています。',
    errorNoSlots: '現在予約可能な面接スロットはありません。後日改めてご確認ください。',
    errorGeneral: '予約に失敗しました。もう一度お試しください。',
    errorLoading: '情報の取得に失敗しました。',
    selectPrompt: '面接スロットを選択してください',
    noSlotsAvailable: '利用可能な面接スロットがありません',
  },
  en: {
    title: 'Select Your Interview Schedule',
    subtitle: 'Please select your preferred interview date and time',
    loadingTitle: 'Loading...',
    selectSlot: 'Select Interview Slot',
    submit: 'Book Now',
    submitting: 'Booking...',
    interviewer: 'Interviewer',
    successTitle: 'Interview Booked Successfully!',
    successMessage: 'Your interview has been scheduled. A confirmation email will be sent to you.',
    interviewDate: 'Interview Date',
    interviewTime: 'Time',
    meetUrl: 'Google Meet',
    joinMeet: 'Join Interview',
    errorInvalidToken: 'Invalid booking link. Please contact the administrator.',
    errorAlreadyBooked: 'An interview slot is already booked for you.',
    errorNoSlots: 'No interview slots are currently available. Please check back later.',
    errorGeneral: 'Booking failed. Please try again.',
    errorLoading: 'Failed to load information.',
    selectPrompt: 'Please select an interview slot',
    noSlotsAvailable: 'No interview slots available',
  },
};

type Lang = 'ja' | 'en';

interface InterviewSlot {
  id: number;
  startTime: string;
  endTime: string;
  meetUrl: string | null;
  interviewer: { id: number; lastNameJa: string; firstNameJa: string } | null;
}

interface ApplicantInfo {
  id: number;
  name: string;
  language: string;
}

interface BookingData {
  applicant: ApplicantInfo;
  slots: InterviewSlot[];
}

interface SuccessData {
  startTime: string;
  endTime: string;
  meetUrl: string | null;
}

function formatDate(dateStr: string, lang: Lang) {
  return new Date(dateStr).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  });
}

function formatTime(startStr: string, endStr: string) {
  const start = new Date(startStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' });
  const end = new Date(endStr).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' });
  return `${start} - ${end}`;
}

// ─── Inner Component ───────────────────────────────────────
function InterviewBookingContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [lang, setLang] = useState<Lang>('ja');
  const t = translations[lang];
  const isEn = lang === 'en';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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
        const res = await fetch(`/api/interview-booking?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) setError(translations.ja.errorInvalidToken);
          else if (res.status === 409) setError(translations.ja.errorAlreadyBooked);
          else setError(data.error || translations.ja.errorLoading);
          setLoading(false);
          return;
        }
        setBookingData(data);
        if (data.applicant?.language === 'en') setLang('en');
      } catch {
        setError(translations.ja.errorLoading);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Group slots by date
  const slotsByDate: Record<string, InterviewSlot[]> = {};
  if (bookingData?.slots) {
    bookingData.slots.forEach((slot) => {
      const dateStr = new Date(slot.startTime).toLocaleDateString(
        isEn ? 'en-US' : 'ja-JP',
        { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' }
      );
      if (!slotsByDate[dateStr]) slotsByDate[dateStr] = [];
      slotsByDate[dateStr].push(slot);
    });
  }
  const dateKeys = Object.keys(slotsByDate);

  // Auto-select first date
  useEffect(() => {
    if (dateKeys.length > 0 && !selectedDate) {
      setSelectedDate(dateKeys[0]);
    }
  }, [dateKeys, selectedDate]);

  const handleSubmit = async () => {
    if (!selectedSlotId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/interview-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, interviewSlotId: selectedSlotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setError(t.errorAlreadyBooked);
        else setError(data.error || t.errorGeneral);
        return;
      }
      setSuccess({
        startTime: data.interview.startTime,
        endTime: data.interview.endTime,
        meetUrl: data.interview.meetUrl,
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
            <h2 className="text-lg font-black text-slate-800 mb-2">
              {isEn ? 'An Error Occurred' : 'エラーが発生しました'}
            </h2>
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
                <span className="text-xs font-bold text-slate-500 w-24 shrink-0">{t.interviewDate}</span>
                <span className="text-sm font-bold text-slate-800">{formatDate(success.startTime, lang)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-xs font-bold text-slate-500 w-24 shrink-0">{t.interviewTime}</span>
                <span className="text-sm font-bold text-slate-800">{formatTime(success.startTime, success.endTime)}</span>
              </div>
              {success.meetUrl && (
                <div className="flex gap-2 items-center">
                  <span className="text-xs font-bold text-slate-500 w-24 shrink-0">{t.meetUrl}</span>
                  <a
                    href={success.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <i className="bi bi-camera-video-fill"></i>
                    {t.joinMeet}
                  </a>
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
                <p className="text-sm font-bold text-indigo-600 mt-1">
                  {bookingData.applicant.name}
                  {!isEn ? ' 様' : ''}
                </p>
              )}
            </div>

            {/* Google Meet バナー */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-start gap-3">
              <i className="bi bi-camera-video-fill text-blue-500 text-lg mt-0.5 shrink-0"></i>
              <div>
                <p className="text-sm font-bold text-blue-800">
                  {isEn
                    ? 'This interview will be conducted online via Google Meet.'
                    : '面接は Google Meet を使用したオンライン面接で実施いたします。'}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {isEn
                    ? 'A Google Meet link will be sent to you after your interview is confirmed.'
                    : '面接日程確定後に Google Meet のリンクをメールでお送りします。'}
                </p>
              </div>
            </div>

            {/* スロット選択 */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-1">
                <i className="bi bi-calendar-check text-indigo-500"></i>
                <h2 className="font-bold text-slate-700">{t.selectSlot}</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">{t.subtitle}</p>

              {dateKeys.length === 0 ? (
                <div className="py-10 text-center">
                  <i className="bi bi-calendar-x text-3xl text-slate-300 mb-2 block"></i>
                  <p className="text-sm text-slate-400">{t.noSlotsAvailable}</p>
                </div>
              ) : (
                <>
                  {/* 日付タブ */}
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                    {dateKeys.map((dateStr) => (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => { setSelectedDate(dateStr); setSelectedSlotId(null); }}
                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          selectedDate === dateStr
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {dateStr}
                      </button>
                    ))}
                  </div>

                  {/* 時間スロット */}
                  {selectedDate && slotsByDate[selectedDate] && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {slotsByDate[selectedDate].map((slot) => {
                        const start = new Date(slot.startTime).toLocaleTimeString(
                          isEn ? 'en-US' : 'ja-JP',
                          { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' }
                        );
                        const end = new Date(slot.endTime).toLocaleTimeString(
                          isEn ? 'en-US' : 'ja-JP',
                          { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' }
                        );
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                            }`}
                          >
                            <i className={`bi bi-clock mr-1.5 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`} />
                            {start} - {end}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 送信ボタン */}
            {dateKeys.length > 0 && (
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

// ─── Main Export ───────────────────────────────────────────
export default function InterviewBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    }>
      <InterviewBookingContent />
    </Suspense>
  );
}
