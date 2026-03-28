'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

// ─── i18n ────────────────────────────────────────────────
const translations = {
  ja: {
    title: '面接予約の管理',
    subtitle: '面接時間の変更やキャンセルが可能です',
    loading: '読み込み中...',
    invalidToken: '無効なリンクです',
    invalidTokenDesc: 'このリンクは無効または期限切れです。メールに記載のリンクをご確認ください。',
    currentInterview: '現在の面接予約',
    position: '応募職種',
    date: '面接日',
    time: '面接時間',
    meetUrl: 'Google Meet',
    meetUrlZoom: 'Zoom',
    joinMeet: 'Google Meetに参加する',
    joinZoom: 'Zoomに参加する',
    changeTitle: '面接時間を変更する',
    changeDesc: '別の日時に変更できます',
    changeBtn: '日時を変更する',
    cancelTitle: '面接をキャンセルする',
    cancelDesc: 'キャンセルすると応募自体が取り消されます',
    cancelBtn: 'キャンセルする',
    selectNewSlot: '新しい面接日時を選択',
    noSlots: '現在予約可能な面接枠はありません',
    confirmChange: '変更を確定',
    confirmChangeMsg: '面接日時を以下に変更してよろしいですか？',
    confirmCancel: '面接をキャンセル',
    confirmCancelMsg: '本当に面接をキャンセルしますか？この操作は取り消せません。',
    yes: 'はい',
    no: 'いいえ',
    changing: '変更中...',
    cancelling: 'キャンセル中...',
    changeSuccess: '面接日時を変更しました',
    changeSuccessDesc: '新しい面接日時の確認メールをお送りしました。',
    cancelSuccess: '面接をキャンセルしました',
    cancelSuccessDesc: 'キャンセル確認メールをお送りしました。改めて応募される場合は応募ページからお手続きください。',
    cannotModify: 'この面接は変更・キャンセルできません',
    cannotModifyDesc: 'ステータスが変更されたため、面接の変更・キャンセルはできません。',
    sameDayWarning: '面接当日の変更・キャンセルはできません。前日までにお手続きください。',
    backToApply: '応募ページへ',
    close: '閉じる',
    newDate: '新しい面接日',
    newTime: '新しい面接時間',
  },
  en: {
    title: 'Manage Interview',
    subtitle: 'Change or cancel your interview appointment',
    loading: 'Loading...',
    invalidToken: 'Invalid Link',
    invalidTokenDesc: 'This link is invalid or has expired. Please check the link in your email.',
    currentInterview: 'Current Interview',
    position: 'Position',
    date: 'Date',
    time: 'Time',
    meetUrl: 'Google Meet',
    meetUrlZoom: 'Zoom',
    joinMeet: 'Join Google Meet',
    joinZoom: 'Join Zoom',
    changeTitle: 'Reschedule Interview',
    changeDesc: 'Change to a different date and time',
    changeBtn: 'Reschedule',
    cancelTitle: 'Cancel Interview',
    cancelDesc: 'Cancelling will withdraw your application',
    cancelBtn: 'Cancel Interview',
    selectNewSlot: 'Select New Date & Time',
    noSlots: 'No available interview slots at this time',
    confirmChange: 'Confirm Reschedule',
    confirmChangeMsg: 'Are you sure you want to reschedule your interview to the following?',
    confirmCancel: 'Cancel Interview',
    confirmCancelMsg: 'Are you sure you want to cancel your interview? This action cannot be undone.',
    yes: 'Yes',
    no: 'No',
    changing: 'Rescheduling...',
    cancelling: 'Cancelling...',
    changeSuccess: 'Interview Rescheduled',
    changeSuccessDesc: 'A confirmation email has been sent with your new interview details.',
    cancelSuccess: 'Interview Cancelled',
    cancelSuccessDesc: 'A confirmation email has been sent. If you wish to reapply, please visit our application page.',
    cannotModify: 'Cannot modify this interview',
    cannotModifyDesc: 'The interview status has changed and can no longer be modified.',
    sameDayWarning: 'Same-day changes are not allowed. Please make changes at least one day before.',
    backToApply: 'Back to Application',
    close: 'Close',
    newDate: 'New Date',
    newTime: 'New Time',
  },
};

type Lang = 'ja' | 'en';

interface InterviewInfo {
  date: string;
  time: string;
  meetUrl: string | null;
  startTime: string;
}

interface SlotOption {
  id: number;
  startTime: string;
  endTime: string;
}

export default function ManageInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [lang, setLang] = useState<Lang>('ja');
  const t = translations[lang];

  // データ状態
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicantName, setApplicantName] = useState('');
  const [jobCategory, setJobCategory] = useState('');
  const [jobCategoryId, setJobCategoryId] = useState<number | null>(null);
  const [interview, setInterview] = useState<InterviewInfo | null>(null);
  const [canChange, setCanChange] = useState(false);

  // UI状態
  const [showChangeUI, setShowChangeUI] = useState(false);
  const [showConfirmChange, setShowConfirmChange] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'changed' | 'cancelled' | null>(null);
  const [newInterview, setNewInterview] = useState<InterviewInfo | null>(null);

  // 面接情報取得
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/apply/manage/${token}`);
      if (!res.ok) {
        setError('invalid');
        return;
      }
      const data = await res.json();
      setApplicantName(data.applicant.name);
      setJobCategory(data.applicant.jobCategory);
      setJobCategoryId(data.applicant.jobCategoryId);
      setInterview(data.interview);
      setCanChange(data.canChange);
      setLang(data.applicant.language === 'en' ? 'en' : 'ja');
    } catch {
      setError('fetch');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 空きスロット取得
  const fetchSlots = useCallback(async () => {
    if (!jobCategoryId) return;
    try {
      const res = await fetch(`/api/interview-slots/available?jobCategoryId=${jobCategoryId}`);
      const data = await res.json();
      setSlots(data.slots || []);
      // デフォルトで最初の日付を選択
      if (data.slots?.length > 0) {
        const firstDate = new Date(data.slots[0].startTime).toDateString();
        setSelectedDate(firstDate);
      }
    } catch {
      setSlots([]);
    }
  }, [jobCategoryId]);

  // 日時変更UI表示
  const handleShowChange = () => {
    setShowChangeUI(true);
    fetchSlots();
  };

  // 日付グループ化
  const groupedSlots: Record<string, SlotOption[]> = {};
  slots.forEach((slot) => {
    const dateKey = new Date(slot.startTime).toDateString();
    if (!groupedSlots[dateKey]) groupedSlots[dateKey] = [];
    groupedSlots[dateKey].push(slot);
  });
  const dateKeys = Object.keys(groupedSlots);

  // 日時フォーマット
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ja-JP', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      timeZone: 'Asia/Tokyo',
    });
  };

  const formatTime = (startStr: string, endStr: string) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' };
    return `${s.toLocaleTimeString(lang === 'en' ? 'en-US' : 'ja-JP', opts)} - ${e.toLocaleTimeString(lang === 'en' ? 'en-US' : 'ja-JP', opts)}`;
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      timeZone: 'Asia/Tokyo',
    });
  };

  // 面接時間変更
  const handleConfirmChange = async () => {
    if (!selectedSlotId) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/apply/manage/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSlotId: selectedSlotId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'エラーが発生しました');
        setProcessing(false);
        return;
      }
      const data = await res.json();
      setNewInterview(data.interview);
      setResult('changed');
    } catch {
      alert('エラーが発生しました');
    } finally {
      setProcessing(false);
      setShowConfirmChange(false);
    }
  };

  // 面接キャンセル
  const handleConfirmCancel = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/apply/manage/${token}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'エラーが発生しました');
        setProcessing(false);
        return;
      }
      setResult('cancelled');
    } catch {
      alert('エラーが発生しました');
    } finally {
      setProcessing(false);
      setShowConfirmCancel(false);
    }
  };

  // 選択中のスロット
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  // ─── レンダリング ─────────────────────────────────────

  // ローディング
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">{t.loading}</p>
        </div>
      </div>
    );
  }

  // エラー（無効トークン）
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header lang={lang} setLang={setLang} />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">{t.invalidToken}</h2>
            <p className="text-sm text-slate-500">{t.invalidTokenDesc}</p>
          </div>
        </div>
      </div>
    );
  }

  // 結果画面（変更完了 or キャンセル完了）
  if (result) {
    const isChanged = result === 'changed';
    return (
      <div className="min-h-screen bg-slate-50">
        <Header lang={lang} setLang={setLang} />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className={`w-16 h-16 ${isChanged ? 'bg-green-50' : 'bg-orange-50'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isChanged ? (
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {isChanged ? t.changeSuccess : t.cancelSuccess}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {isChanged ? t.changeSuccessDesc : t.cancelSuccessDesc}
            </p>

            {isChanged && newInterview && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1.5 text-slate-500 w-28">{t.position}</td>
                      <td className="py-1.5 font-semibold text-slate-800">{jobCategory}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-slate-500">{t.newDate}</td>
                      <td className="py-1.5 font-semibold text-slate-800">{newInterview.date}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-slate-500">{t.newTime}</td>
                      <td className="py-1.5 font-semibold text-slate-800">{newInterview.time}</td>
                    </tr>
                    {newInterview.meetUrl && (() => {
                      const isZoom = newInterview.meetUrl!.toLowerCase().includes('zoom');
                      return (
                        <tr>
                          <td className="py-1.5 text-slate-500">{isZoom ? t.meetUrlZoom : t.meetUrl}</td>
                          <td className="py-1.5">
                            <a href={newInterview.meetUrl!} target="_blank" rel="noopener noreferrer"
                              className={`font-semibold hover:underline ${isZoom ? 'text-violet-600' : 'text-indigo-600'}`}>
                              {isZoom ? t.joinZoom : t.joinMeet}
                            </a>
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {!isChanged && (
              <a href="/apply" className="inline-block bg-indigo-600 text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-indigo-700 transition">
                {t.backToApply}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // メイン画面
  return (
    <div className="min-h-screen bg-slate-50">
      <Header lang={lang} setLang={setLang} />

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
        </div>

        {/* 現在の面接情報 + アクションボタン */}
        {interview && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">
              {t.currentInterview}
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">{t.position}</span>
                <span className="text-sm font-semibold text-slate-800">{jobCategory}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">{t.date}</span>
                <span className="text-sm font-semibold text-slate-800">{interview.date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">{t.time}</span>
                <span className="text-sm font-semibold text-slate-800">{interview.time}</span>
              </div>
              {interview.meetUrl && (() => {
                const isZoom = interview.meetUrl!.toLowerCase().includes('zoom');
                return (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">{isZoom ? t.meetUrlZoom : t.meetUrl}</span>
                    <a href={interview.meetUrl!} target="_blank" rel="noopener noreferrer"
                      className={`text-sm font-semibold hover:underline ${isZoom ? 'text-violet-600' : 'text-indigo-600'}`}>
                      {isZoom ? t.joinZoom : t.joinMeet}
                    </a>
                  </div>
                );
              })()}
            </div>

            {/* 変更不可メッセージ */}
            {!canChange && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-5">
                <p className="text-sm font-semibold text-amber-800 mb-1">{t.cannotModify}</p>
                <p className="text-xs text-amber-600">{t.cannotModifyDesc}</p>
              </div>
            )}

            {/* アクションボタン */}
            {canChange && !showChangeUI && (
              <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={handleShowChange}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-blue-700 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {t.changeBtn}
                </button>
                <button
                  onClick={() => setShowConfirmCancel(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-red-600 text-sm font-semibold px-4 py-2.5 rounded-lg border border-red-300 hover:bg-red-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t.cancelBtn}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 日時変更UI */}
        {canChange && showChangeUI && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">{t.selectNewSlot}</h2>
              <button
                onClick={() => { setShowChangeUI(false); setSelectedSlotId(null); }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {t.close}
              </button>
            </div>

            {dateKeys.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">{t.noSlots}</p>
            ) : (
              <>
                {/* 日付タブ */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
                  {dateKeys.map((dateKey) => (
                    <button
                      key={dateKey}
                      onClick={() => { setSelectedDate(dateKey); setSelectedSlotId(null); }}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition
                        ${selectedDate === dateKey
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {formatDate(groupedSlots[dateKey][0].startTime)}
                    </button>
                  ))}
                </div>

                {/* 時間スロットグリッド */}
                {selectedDate && groupedSlots[selectedDate] && (
                  <div className="grid grid-cols-2 gap-2">
                    {groupedSlots[selectedDate].map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`px-3 py-3 rounded-lg text-sm font-medium border transition
                          ${selectedSlotId === slot.id
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {formatTime(slot.startTime, slot.endTime)}
                      </button>
                    ))}
                  </div>
                )}

                {/* 確定ボタン */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => { setShowChangeUI(false); setSelectedSlotId(null); }}
                    className="flex-1 bg-slate-100 text-slate-600 text-sm font-semibold py-3 rounded-lg hover:bg-slate-200 transition"
                  >
                    {t.close}
                  </button>
                  <button
                    disabled={!selectedSlotId}
                    onClick={() => setShowConfirmChange(true)}
                    className={`flex-1 text-sm font-semibold py-3 rounded-lg transition
                      ${selectedSlotId
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {t.confirmChange}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 変更確認モーダル */}
      {showConfirmChange && selectedSlot && (
        <Modal onClose={() => setShowConfirmChange(false)}>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t.confirmChange}</h3>
            <p className="text-sm text-slate-500 mb-4">{t.confirmChangeMsg}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.newDate}</span>
                  <span className="font-semibold text-slate-800">{formatFullDate(selectedSlot.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.newTime}</span>
                  <span className="font-semibold text-slate-800">{formatTime(selectedSlot.startTime, selectedSlot.endTime)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmChange}
                disabled={processing}
                className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {processing ? t.changing : t.yes}
              </button>
              <button
                onClick={() => setShowConfirmChange(false)}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-semibold py-3 rounded-lg hover:bg-slate-200 transition"
              >
                {t.no}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* キャンセル確認モーダル */}
      {showConfirmCancel && (
        <Modal onClose={() => setShowConfirmCancel(false)}>
          <div className="text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t.confirmCancel}</h3>
            <p className="text-sm text-slate-500 mb-6">{t.confirmCancelMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmCancel}
                disabled={processing}
                className="flex-1 bg-red-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {processing ? t.cancelling : t.yes}
              </button>
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-semibold py-3 rounded-lg hover:bg-slate-200 transition"
              >
                {t.no}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── サブコンポーネント ─────────────────────────────────

function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="bg-slate-800 text-white">
      <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
        <Image src="/logo/logo_dark_transparent.png" alt="Tiramis" width={120} height={32} className="h-8 w-auto" />
        <button
          onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}
          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition"
        >
          {lang === 'ja' ? 'English' : '日本語'}
        </button>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
