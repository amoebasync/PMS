'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ─── i18n ────────────────────────────────────────────────
const translations = {
  ja: {
    title: '応募フォーム',
    subtitle: '以下のフォームに必要事項をご記入ください',
    langLabel: 'English',
    jobCategory: '希望職種',
    jobCategoryPlaceholder: '職種を選択してください',
    personalInfo: '個人情報',
    name: '氏名',
    namePlaceholder: '山田 太郎',
    email: 'メールアドレス',
    emailPlaceholder: 'example@email.com',
    emailConfirm: 'メールアドレス確認',
    emailConfirmPlaceholder: 'もう一度入力してください',
    emailMismatch: 'メールアドレスが一致しません',
    phone: '電話番号',
    phonePlaceholder: '090-1234-5678',
    nationalityVisa: '国籍・ビザ',
    country: '国籍',
    countryPlaceholder: '国を選択してください',
    visaType: '在留資格',
    visaTypePlaceholder: '在留資格を選択してください',
    addressSection: '住所',
    postalCode: '郵便番号',
    postalCodePlaceholder: '123-4567',
    address: '住所',
    addressPlaceholder: '住所を入力してください',
    building: '建物名',
    buildingPlaceholder: 'マンション名・号室等（任意）',
    interviewSlot: '面接日時',
    interviewSlotDesc: 'ご希望の面接日時を選択してください',
    noSlots: '現在予約可能な面接枠はありません。後日改めてご確認ください。',
    consent: '同意事項',
    privacyAgree: 'プライバシーポリシーに同意する',
    confirmInfo: '入力した情報に間違いがないことを確認しました',
    submit: '応募する',
    submitting: '送信中...',
    successTitle: '応募が完了しました！',
    successMessage: '以下の日時で面接が予約されました。確認メールをお送りしましたのでご確認ください。',
    interviewDate: '面接日',
    interviewTime: '時間',
    meetLink: 'Google Meet リンク',
    joinMeet: 'Google Meet に参加',
    backToTop: 'トップページへ',
    required: '必須',
    optional: '任意',
    loadingSlots: '面接枠を読み込み中...',
    loadingCategories: '読み込み中...',
    errorGeneral: '送信に失敗しました。もう一度お試しください。',
  },
  en: {
    title: 'Job Application',
    subtitle: 'Please fill out the form below',
    langLabel: '日本語',
    jobCategory: 'Job Category',
    jobCategoryPlaceholder: 'Select a job category',
    personalInfo: 'Personal Information',
    name: 'Full Name',
    namePlaceholder: 'John Doe',
    email: 'Email Address',
    emailPlaceholder: 'example@email.com',
    emailConfirm: 'Confirm Email',
    emailConfirmPlaceholder: 'Enter your email again',
    emailMismatch: 'Email addresses do not match',
    phone: 'Phone Number',
    phonePlaceholder: '090-1234-5678',
    nationalityVisa: 'Nationality & Visa',
    country: 'Nationality',
    countryPlaceholder: 'Select a country',
    visaType: 'Visa Type',
    visaTypePlaceholder: 'Select a visa type',
    addressSection: 'Address',
    postalCode: 'Postal Code',
    postalCodePlaceholder: '123-4567',
    address: 'Address',
    addressPlaceholder: 'Enter your address',
    building: 'Building',
    buildingPlaceholder: 'Apartment, suite, etc. (optional)',
    interviewSlot: 'Interview Schedule',
    interviewSlotDesc: 'Please select your preferred interview time',
    noSlots: 'No interview slots are currently available. Please check back later.',
    consent: 'Consent',
    privacyAgree: 'I agree to the Privacy Policy',
    confirmInfo: 'I confirm the information above is correct',
    submit: 'Submit Application',
    submitting: 'Submitting...',
    successTitle: 'Application Submitted!',
    successMessage: 'Your interview has been scheduled. A confirmation email has been sent to your inbox.',
    interviewDate: 'Interview Date',
    interviewTime: 'Time',
    meetLink: 'Google Meet Link',
    joinMeet: 'Join Google Meet',
    backToTop: 'Back to Home',
    required: 'Required',
    optional: 'Optional',
    loadingSlots: 'Loading interview slots...',
    loadingCategories: 'Loading...',
    errorGeneral: 'Submission failed. Please try again.',
  },
};

// ─── Types ───────────────────────────────────────────────
interface JobCategory {
  id: number;
  nameJa: string;
  nameEn: string;
}

interface Country {
  id: number;
  code: string;
  name: string;
  nameEn: string;
}

interface VisaType {
  id: number;
  name: string;
}

interface InterviewSlot {
  id: number;
  startTime: string;
  endTime: string;
}

interface SuccessData {
  date: string;
  time: string;
  meetUrl: string | null;
}

// ─── Helpers ─────────────────────────────────────────────
const formatPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const formatPostalCode = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

// ─── Component ───────────────────────────────────────────
export default function ApplyPage() {
  const [form, setForm] = useState({
    language: 'ja',
    name: '',
    email: '',
    emailConfirm: '',
    phone: '',
    jobCategoryId: '',
    countryId: '',
    visaTypeId: '',
    postalCode: '',
    address: '',
    building: '',
    interviewSlotId: '',
  });

  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeConfirm, setAgreeConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState<SuccessData | null>(null);

  // API data
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [slots, setSlots] = useState<InterviewSlot[]>([]);

  // Loading states
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingVisaTypes, setLoadingVisaTypes] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Interview slot selection
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const t = translations[form.language as 'ja' | 'en'] || translations.ja;
  const isEn = form.language === 'en';

  // Selected country
  const selectedCountry = countries.find((c) => c.id === Number(form.countryId));
  const needsVisa = selectedCountry ? selectedCountry.code !== 'JP' : false;

  // ─── Data fetching ───────────────────────────────────
  useEffect(() => {
    fetch('/api/job-categories/public')
      .then((r) => r.json())
      .then((data) => setJobCategories(Array.isArray(data) ? data : []))
      .catch(() => setJobCategories([]))
      .finally(() => setLoadingCategories(false));

    fetch('/api/countries/public')
      .then((r) => r.json())
      .then((data) => setCountries(Array.isArray(data) ? data : []))
      .catch(() => setCountries([]))
      .finally(() => setLoadingCountries(false));

    fetch('/api/visa-types/public')
      .then((r) => r.json())
      .then((data) => setVisaTypes(Array.isArray(data) ? data : []))
      .catch(() => setVisaTypes([]))
      .finally(() => setLoadingVisaTypes(false));

    fetch('/api/interview-slots/available')
      .then((r) => r.json())
      .then((data) => setSlots(data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, []);

  // ─── Postal code auto-lookup ─────────────────────────
  const lookupPostalCode = useCallback(async (code: string) => {
    const digits = code.replace(/\D/g, '');
    if (digits.length === 7) {
      try {
        const res = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`
        );
        const data = await res.json();
        if (data.results?.[0]) {
          const r = data.results[0];
          setForm((prev) => ({
            ...prev,
            address: `${r.address1}${r.address2}${r.address3}`,
          }));
        }
      } catch {
        // zipcloud lookup failed silently
      }
    }
  }, []);

  // ─── Group slots by date ─────────────────────────────
  const slotsByDate: Record<string, InterviewSlot[]> = {};
  slots.forEach((slot) => {
    const dateStr = new Date(slot.startTime).toLocaleDateString(
      isEn ? 'en-US' : 'ja-JP',
      { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }
    );
    if (!slotsByDate[dateStr]) slotsByDate[dateStr] = [];
    slotsByDate[dateStr].push(slot);
  });
  const dateKeys = Object.keys(slotsByDate);

  // Auto-select first date if none selected
  useEffect(() => {
    if (dateKeys.length > 0 && !selectedDate) {
      setSelectedDate(dateKeys[0]);
    }
  }, [dateKeys, selectedDate]);

  // ─── Validation ──────────────────────────────────────
  const emailsMatch = form.email === form.emailConfirm;
  const showEmailMismatch =
    form.emailConfirm.length > 0 && !emailsMatch;

  const isFormValid =
    form.name.trim() !== '' &&
    form.email.trim() !== '' &&
    form.emailConfirm.trim() !== '' &&
    emailsMatch &&
    form.jobCategoryId !== '' &&
    form.interviewSlotId !== '' &&
    (!needsVisa || form.visaTypeId !== '') &&
    agreePrivacy &&
    agreeConfirm;

  // ─── Submit ──────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.replace(/\D/g, '') || undefined,
          language: form.language,
          jobCategoryId: Number(form.jobCategoryId),
          countryId: form.countryId ? Number(form.countryId) : undefined,
          visaTypeId: form.visaTypeId ? Number(form.visaTypeId) : undefined,
          postalCode: form.postalCode.replace(/\D/g, '') || undefined,
          address: form.address.trim() || undefined,
          building: form.building.trim() || undefined,
          interviewSlotId: Number(form.interviewSlotId),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (isEn) {
          if (res.status === 409) {
            setErrorMsg(
              data.error?.includes('メール')
                ? 'This email address is already registered.'
                : 'This interview slot is already taken. Please select another.'
            );
          } else {
            setErrorMsg(data.error || t.errorGeneral);
          }
        } else {
          setErrorMsg(data.error || t.errorGeneral);
        }
        setSubmitting(false);
        return;
      }

      setSuccess({
        date: data.interview.date,
        time: data.interview.time,
        meetUrl: data.interview.meetUrl,
      });
    } catch {
      setErrorMsg(t.errorGeneral);
      setSubmitting(false);
    }
  };

  // ─── Input classes ───────────────────────────────────
  const inputClass =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all';
  const labelClass = 'block text-xs font-bold text-slate-500 mb-1.5';
  const sectionHeaderClass =
    'flex items-center gap-2 text-sm font-bold text-slate-700 mb-4';

  // ─── Success Screen ──────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <i className="bi bi-check-lg text-3xl text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{t.successTitle}</h1>
          <p className="text-sm text-slate-500 mb-8">{t.successMessage}</p>

          <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-4 mb-6">
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1">{t.interviewDate}</p>
              <p className="text-sm font-semibold text-slate-700">
                <i className="bi bi-calendar-event mr-2 text-indigo-500" />
                {success.date}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1">{t.interviewTime}</p>
              <p className="text-sm font-semibold text-slate-700">
                <i className="bi bi-clock mr-2 text-indigo-500" />
                {success.time}
              </p>
            </div>
            {success.meetUrl && (
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">{t.meetLink}</p>
                <a
                  href={success.meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all text-sm"
                >
                  <i className="bi bi-camera-video" />
                  {t.joinMeet}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center py-8 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative w-[140px] h-[42px]">
            <Image
              src="/logo/logo_dark_transparent.png"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              language: prev.language === 'ja' ? 'en' : 'ja',
            }))
          }
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg px-3 py-2 transition-all hover:border-indigo-300"
        >
          <i className="bi bi-translate" />
          {t.langLabel}
        </button>
      </div>

      {/* Form Container */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">{t.title}</h1>
          <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 animate-in fade-in">
            <i className="bi bi-exclamation-triangle-fill text-rose-500 mt-0.5" />
            <p className="text-sm text-rose-700">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ── Section: Job Category ─── */}
          <section>
            <div className={sectionHeaderClass}>
              <i className="bi bi-briefcase text-indigo-500" />
              {t.jobCategory}
              <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-1">
                {t.required}
              </span>
            </div>
            <select
              value={form.jobCategoryId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, jobCategoryId: e.target.value }))
              }
              className={inputClass}
              required
            >
              <option value="">
                {loadingCategories
                  ? t.loadingCategories
                  : t.jobCategoryPlaceholder}
              </option>
              {jobCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {isEn ? cat.nameEn : cat.nameJa}
                </option>
              ))}
            </select>
          </section>

          {/* ── Section: Personal Info ─── */}
          <section>
            <div className={sectionHeaderClass}>
              <i className="bi bi-person text-indigo-500" />
              {t.personalInfo}
            </div>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className={labelClass}>
                  {t.name}
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                    {t.required}
                  </span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder={t.namePlaceholder}
                  className={inputClass}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className={labelClass}>
                  {t.email}
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                    {t.required}
                  </span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder={t.emailPlaceholder}
                  className={inputClass}
                  required
                />
              </div>

              {/* Email Confirm */}
              <div>
                <label className={labelClass}>
                  {t.emailConfirm}
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                    {t.required}
                  </span>
                </label>
                <input
                  type="email"
                  value={form.emailConfirm}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      emailConfirm: e.target.value,
                    }))
                  }
                  placeholder={t.emailConfirmPlaceholder}
                  className={`${inputClass} ${
                    showEmailMismatch
                      ? 'border-rose-400 focus:ring-rose-400'
                      : ''
                  }`}
                  required
                />
                {showEmailMismatch && (
                  <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
                    <i className="bi bi-exclamation-circle" />
                    {t.emailMismatch}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className={labelClass}>{t.phone}</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      phone: formatPhone(e.target.value),
                    }))
                  }
                  placeholder={t.phonePlaceholder}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* ── Section: Nationality & Visa ─── */}
          <section>
            <div className={sectionHeaderClass}>
              <i className="bi bi-globe2 text-indigo-500" />
              {t.nationalityVisa}
            </div>
            <div className="space-y-4">
              {/* Country */}
              <div>
                <label className={labelClass}>{t.country}</label>
                <select
                  value={form.countryId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      countryId: e.target.value,
                      visaTypeId: '', // reset visa when country changes
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">
                    {loadingCountries
                      ? t.loadingCategories
                      : t.countryPlaceholder}
                  </option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isEn ? c.nameEn : c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Visa Type (conditional) */}
              {needsVisa && (
                <div className="animate-in fade-in">
                  <label className={labelClass}>
                    {t.visaType}
                    <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                      {t.required}
                    </span>
                  </label>
                  <select
                    value={form.visaTypeId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        visaTypeId: e.target.value,
                      }))
                    }
                    className={inputClass}
                    required
                  >
                    <option value="">
                      {loadingVisaTypes
                        ? t.loadingCategories
                        : t.visaTypePlaceholder}
                    </option>
                    {visaTypes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* ── Section: Address ─── */}
          <section>
            <div className={sectionHeaderClass}>
              <i className="bi bi-house text-indigo-500" />
              {t.addressSection}
            </div>
            <div className="space-y-4">
              {/* Postal Code */}
              <div>
                <label className={labelClass}>{t.postalCode}</label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => {
                    const formatted = formatPostalCode(e.target.value);
                    setForm((prev) => ({ ...prev, postalCode: formatted }));
                    lookupPostalCode(formatted);
                  }}
                  placeholder={t.postalCodePlaceholder}
                  className={inputClass}
                  inputMode="numeric"
                />
              </div>

              {/* Address */}
              <div>
                <label className={labelClass}>{t.address}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder={t.addressPlaceholder}
                  className={inputClass}
                />
              </div>

              {/* Building */}
              <div>
                <label className={labelClass}>
                  {t.building}
                  <span className="text-[10px] font-medium text-slate-400 ml-2">
                    {t.optional}
                  </span>
                </label>
                <input
                  type="text"
                  value={form.building}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, building: e.target.value }))
                  }
                  placeholder={t.buildingPlaceholder}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* ── Section: Interview Slot Picker ─── */}
          <section>
            <div className={sectionHeaderClass}>
              <i className="bi bi-calendar-check text-indigo-500" />
              {t.interviewSlot}
              <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-1">
                {t.required}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">{t.interviewSlotDesc}</p>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
                <i className="bi bi-arrow-repeat animate-spin mr-2" />
                {t.loadingSlots}
              </div>
            ) : dateKeys.length === 0 ? (
              <div className="py-8 text-center">
                <i className="bi bi-calendar-x text-3xl text-slate-300 mb-2 block" />
                <p className="text-sm text-slate-400">{t.noSlots}</p>
              </div>
            ) : (
              <>
                {/* Date tabs */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                  {dateKeys.map((dateStr) => (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
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

                {/* Time slots */}
                {selectedDate && slotsByDate[selectedDate] && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {slotsByDate[selectedDate].map((slot) => {
                      const start = new Date(slot.startTime).toLocaleTimeString(
                        isEn ? 'en-US' : 'ja-JP',
                        { hour: '2-digit', minute: '2-digit', hour12: false }
                      );
                      const end = new Date(slot.endTime).toLocaleTimeString(
                        isEn ? 'en-US' : 'ja-JP',
                        { hour: '2-digit', minute: '2-digit', hour12: false }
                      );
                      const isSelected =
                        form.interviewSlotId === String(slot.id);

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              interviewSlotId: String(slot.id),
                            }))
                          }
                          className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          <i
                            className={`bi bi-clock mr-1.5 ${
                              isSelected ? 'text-indigo-500' : 'text-slate-400'
                            }`}
                          />
                          {start} - {end}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Section: Consent ─── */}
          <section>
            <div className={sectionHeaderClass}>
              <i className="bi bi-shield-check text-indigo-500" />
              {t.consent}
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                  {t.privacyAgree}
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreeConfirm}
                  onChange={(e) => setAgreeConfirm(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                  {t.confirmInfo}
                </span>
              </label>
            </div>
          </section>

          {/* ── Submit Button ─── */}
          <button
            type="submit"
            disabled={!isFormValid || submitting}
            className={`w-full font-bold py-3.5 px-6 rounded-xl text-sm transition-all ${
              isFormValid && !submitting
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <i className="bi bi-arrow-repeat animate-spin" />
                {t.submitting}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <i className="bi bi-send" />
                {t.submit}
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  );
}
