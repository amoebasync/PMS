'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import PrivacyContent from '@/components/portal/PrivacyContent';

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
    birthday: '生年月日',
    gender: '性別',
    genderMale: '男性',
    genderFemale: '女性',
    genderOther: 'その他',
    nationalityVisa: '国籍・ビザ',
    country: '国籍',
    countryPlaceholder: '国を選択 / 検索...',
    visaType: '在留資格',
    visaTypePlaceholder: '在留資格を選択 / 検索...',
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
    meetLinkZoom: 'Zoom リンク',
    joinMeet: 'Google Meet に参加',
    joinZoom: 'Zoomに参加',
    badgeGoogleMeet: 'Google Meet面接',
    badgeZoom: 'Zoom面接',
    backToTop: 'トップページへ',
    required: '必須',
    optional: '任意',
    loadingSlots: '面接枠を読み込み中...',
    loadingCategories: '読み込み中...',
    errorGeneral: '送信に失敗しました。もう一度お試しください。',
    searchPlaceholder: '検索...',
    noResults: '該当なし',
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
    birthday: 'Date of Birth',
    gender: 'Gender',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Other',
    nationalityVisa: 'Nationality & Visa',
    country: 'Nationality',
    countryPlaceholder: 'Select / Search...',
    visaType: 'Visa Type',
    visaTypePlaceholder: 'Select / Search...',
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
    meetLinkZoom: 'Zoom Link',
    joinMeet: 'Join Google Meet',
    joinZoom: 'Join Zoom',
    badgeGoogleMeet: 'Google Meet Interview',
    badgeZoom: 'Zoom Interview',
    backToTop: 'Back to Home',
    required: 'Required',
    optional: 'Optional',
    loadingSlots: 'Loading interview slots...',
    loadingCategories: 'Loading...',
    errorGeneral: 'Submission failed. Please try again.',
    searchPlaceholder: 'Search...',
    noResults: 'No results',
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
  aliases: string | null;
}

interface VisaType {
  id: number;
  name: string;
  nameEn: string;
}

interface InterviewSlot {
  id: number;
  startTime: string;
  endTime: string;
  interviewSlotMaster?: {
    id: number;
    name: string;
    meetingType: 'GOOGLE_MEET' | 'ZOOM';
  } | null;
}

interface SuccessData {
  date: string;
  time: string;
  meetUrl: string | null;
  meetingType?: 'GOOGLE_MEET' | 'ZOOM' | null;
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

/**
 * 面接スロットが選択可能かどうかを判定する
 * - 7:00以前（0:00〜6:59）: 当日のスロットも選択可能
 * - 7:00以降: 翌日以降のスロットのみ選択可能
 */
const isSlotSelectable = (slotStartTime: string): boolean => {
  const now = new Date();
  const slotDate = new Date(slotStartTime);
  
  // 現在時刻の時間を取得
  const currentHour = now.getHours();
  
  // 今日の日付（時刻を0:00:00に設定）
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // スロットの日付（時刻を0:00:00に設定）
  const slotDay = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
  
  // 7時より前（0:00〜6:59）の場合
  if (currentHour < 7) {
    // 当日以降のスロットは選択可能（かつ、スロット開始時刻が現在より後）
    return slotDate > now;
  }
  
  // 7時以降の場合
  // 翌日以降のスロットのみ選択可能
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return slotDay >= tomorrow;
};

// ─── SearchableSelect Component ──────────────────────────
interface SearchableSelectProps<T> {
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  placeholder: string;
  searchPlaceholder: string;
  noResultsText: string;
  disabled?: boolean;
  className?: string;
  filterFn?: (option: T, search: string) => boolean;
}

function SearchableSelect<T>({
  options,
  value,
  onChange,
  getOptionValue,
  getOptionLabel,
  placeholder,
  searchPlaceholder,
  noResultsText,
  disabled = false,
  className = '',
  filterFn,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => getOptionValue(opt) === value);
  const displayText = selectedOption ? getOptionLabel(selectedOption) : '';

  const filteredOptions = options.filter((opt) =>
    filterFn ? filterFn(opt, search) : getOptionLabel(opt).toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-sm transition-all flex items-center justify-between ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:bg-white'
        } ${isOpen ? 'ring-2 ring-indigo-500 bg-white' : ''}`}
      >
        <span className={displayText ? 'text-slate-800' : 'text-slate-400'}>
          {displayText || placeholder}
        </span>
        <i className={`bi bi-chevron-down text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">{noResultsText}</div>
            ) : (
              filteredOptions.map((opt) => {
                const optValue = getOptionValue(opt);
                const isSelected = optValue === value;
                return (
                  <button
                    key={optValue}
                    type="button"
                    onClick={() => handleSelect(optValue)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {getOptionLabel(opt)}
                    {isSelected && <i className="bi bi-check ml-2 text-indigo-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Form Component ───────────────────────────────────
function ApplyForm() {
  const searchParams = useSearchParams();
  const jobParam = searchParams.get('job');

  const [form, setForm] = useState({
    language: 'ja',
    name: '',
    email: '',
    emailConfirm: '',
    phone: '',
    birthday: '',
    gender: '',
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
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
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

  // Recruiting media tracking
  const [recruitingMediaId, setRecruitingMediaId] = useState<number | null>(null);

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
      .then((data) => {
        const categories = Array.isArray(data) ? data : [];
        setJobCategories(categories);
        
        // URLパラメータから職種IDを設定
        if (jobParam && categories.length > 0) {
          const jobId = parseInt(jobParam, 10);
          if (!isNaN(jobId) && categories.some((c: JobCategory) => c.id === jobId)) {
            setForm((prev) => ({ ...prev, jobCategoryId: String(jobId) }));
          }
        }
      })
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

    // Recruiting media tracking from URL parameter
    const sourceParam = searchParams.get('source') || searchParams.get('media');
    if (sourceParam) {
      fetch(`/api/recruiting-media/public?code=${encodeURIComponent(sourceParam)}`)
        .then(r => r.json())
        .then(data => {
          if (data?.id) setRecruitingMediaId(data.id);
        })
        .catch(() => {});
    }

  }, [jobParam, searchParams]);

  // ─── Fetch slots when job category changes ───────────────
  const fetchSlots = useCallback(async (jobCatId?: string) => {
    setLoadingSlots(true);
    try {
      const url = jobCatId
        ? `/api/interview-slots/available?jobCategoryId=${jobCatId}`
        : '/api/interview-slots/available';
      const res = await fetch(url);
      const data = await res.json();
      setSlots(data.slots || []);
      setSelectedDate(null);
      setForm(prev => ({ ...prev, interviewSlotId: '' }));
    } catch {
      setSlots([]);
    }
    setLoadingSlots(false);
  }, []);

  // Fetch slots when job category changes
  useEffect(() => {
    if (form.jobCategoryId) {
      fetchSlots(form.jobCategoryId);
    } else {
      setSlots([]);
      setLoadingSlots(false);
    }
  }, [form.jobCategoryId, fetchSlots]);


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

  // ─── Filter selectable slots ─────────────────────────
  const selectableSlots = slots.filter((slot) => isSlotSelectable(slot.startTime));

  // ─── Group slots by date ─────────────────────────────
  const slotsByDate: Record<string, InterviewSlot[]> = {};
  selectableSlots.forEach((slot) => {
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
    form.birthday !== '' &&
    form.gender !== '' &&
    form.jobCategoryId !== '' &&
    form.countryId !== '' &&
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
          birthday: form.birthday || undefined,
          gender: form.gender || undefined,
          language: form.language,
          jobCategoryId: Number(form.jobCategoryId),
          countryId: form.countryId ? Number(form.countryId) : undefined,
          visaTypeId: form.visaTypeId ? Number(form.visaTypeId) : undefined,
          postalCode: form.postalCode.replace(/\D/g, '') || undefined,
          address: form.address.trim() || undefined,
          building: form.building.trim() || undefined,
          interviewSlotId: Number(form.interviewSlotId),
          recruitingMediaId: recruitingMediaId || undefined,
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
        meetingType: data.interview.meetingType || null,
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
            {success.meetUrl && (() => {
              const isZoom = success.meetingType === 'ZOOM' || (!success.meetingType && success.meetUrl.toLowerCase().includes('zoom'));
              return (
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1">
                    {isZoom ? t.meetLinkZoom : t.meetLink}
                  </p>
                  <a
                    href={success.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm font-semibold py-2.5 px-5 rounded-full transition-all text-sm text-slate-700"
                  >
                    {isZoom ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="5" width="14" height="14" rx="3" fill="#2D8CFF"/>
                        <path d="M16 10l4.5-2.5a.5.5 0 0 1 .75.43v8.14a.5.5 0 0 1-.75.43L16 14V10Z" fill="#2D8CFF"/>
                        <rect x="5" y="9" width="8" height="5" rx="1" fill="white" fillOpacity=".9"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M3.5 6.5A3 3 0 0 1 6.5 3.5h5a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3v-11Z" fill="#00AC47"/>
                        <path d="M14.5 8.2l4.8-3.2a.8.8 0 0 1 1.2.7v12.6a.8.8 0 0 1-1.2.7l-4.8-3.2V8.2Z" fill="#00832D"/>
                        <path d="M6.5 3.5h5a3 3 0 0 1 3 3v2.5h-11V6.5a3 3 0 0 1 3-3Z" fill="#00AC47"/>
                        <path d="M14.5 9v6l4.8 3.2a.8.8 0 0 0 1.2-.7V5.7a.8.8 0 0 0-1.2-.7L14.5 8.2" fill="#00832D"/>
                        <rect x="3.5" y="3.5" width="11" height="17" rx="3" fill="#00AC47" fillOpacity=".15"/>
                      </svg>
                    )}
                    {isZoom ? t.joinZoom : t.joinMeet}
                  </a>
                </div>
              );
            })()}
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
              src="/logo/logo_light_transparent.png"
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

              {/* Birthday */}
              <div>
                <label className={labelClass}>
                  {t.birthday}
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                    {t.required}
                  </span>
                </label>
                <input
                  type="date"
                  value={form.birthday}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, birthday: e.target.value }))
                  }
                  className={inputClass}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Gender */}
              <div>
                <label className={labelClass}>
                  {t.gender}
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                    {t.required}
                  </span>
                </label>
                <div className="flex gap-3 mt-1">
                  {[
                    { value: 'male', label: t.genderMale },
                    { value: 'female', label: t.genderFemale },
                    { value: 'other', label: t.genderOther },
                  ].map(({ value, label }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border-2 transition-all text-xs font-semibold
                        ${form.gender === value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={value}
                        checked={form.gender === value}
                        onChange={() => setForm((prev) => ({ ...prev, gender: value }))}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
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
              {/* Country - Searchable */}
              <div>
                <label className={labelClass}>
                  {t.country}
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                    {t.required}
                  </span>
                </label>
                <SearchableSelect
                  options={countries}
                  value={form.countryId}
                  onChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      countryId: val,
                      visaTypeId: '', // reset visa when country changes
                    }))
                  }
                  getOptionValue={(c) => String(c.id)}
                  getOptionLabel={(c) => (isEn ? c.nameEn : c.name)}
                  placeholder={loadingCountries ? t.loadingCategories : t.countryPlaceholder}
                  searchPlaceholder={t.searchPlaceholder}
                  noResultsText={t.noResults}
                  disabled={loadingCountries}
                  filterFn={(c: Country, search: string) => {
                    const s = search.toLowerCase();
                    if (c.name.toLowerCase().includes(s)) return true;
                    if ((c.nameEn || '').toLowerCase().includes(s)) return true;
                    if (c.aliases) {
                      return c.aliases.split(',').some((a: string) => a.trim().toLowerCase().includes(s));
                    }
                    return false;
                  }}
                />
              </div>

              {/* Visa Type (conditional) - Searchable */}
              {needsVisa && (
                <div className="animate-in fade-in">
                  <label className={labelClass}>
                    {t.visaType}
                    <span className="text-[10px] font-bold text-white bg-rose-500 rounded px-1.5 py-0.5 ml-2">
                      {t.required}
                    </span>
                  </label>
                  <SearchableSelect
                    options={visaTypes}
                    value={form.visaTypeId}
                    onChange={(val) =>
                      setForm((prev) => ({
                        ...prev,
                        visaTypeId: val,
                      }))
                    }
                    getOptionValue={(v) => String(v.id)}
                    getOptionLabel={(v) => isEn && v.nameEn ? v.nameEn : v.name}
                    filterFn={(v, s) => {
                      const q = s.toLowerCase();
                      return v.name.toLowerCase().includes(q) ||
                        (v.nameEn || '').toLowerCase().includes(q);
                    }}
                    placeholder={loadingVisaTypes ? t.loadingCategories : t.visaTypePlaceholder}
                    searchPlaceholder={t.searchPlaceholder}
                    noResultsText={t.noResults}
                    disabled={loadingVisaTypes}
                  />
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
                      const meetingType = slot.interviewSlotMaster?.meetingType;

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
                          <div className="flex flex-col items-center gap-1">
                            <span>
                              <i
                                className={`bi bi-clock mr-1.5 ${
                                  isSelected ? 'text-indigo-500' : 'text-slate-400'
                                }`}
                              />
                              {start} - {end}
                            </span>
                            {meetingType && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                meetingType === 'ZOOM'
                                  ? 'bg-violet-100 text-violet-700'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {meetingType === 'ZOOM' ? t.badgeZoom : t.badgeGoogleMeet}
                              </span>
                            )}
                          </div>
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
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }}
                    className="text-indigo-600 underline hover:text-indigo-800 font-bold transition-colors"
                  >
                    {form.language === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}
                  </button>
                  {form.language === 'ja' ? 'に同意する' : ' - I agree'}
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

      {/* ── プライバシーポリシーモーダル ── */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h2 className="text-lg font-black text-slate-800">
                {form.language === 'ja' ? 'プライバシーポリシー' : 'Privacy Policy'}
              </h2>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <PrivacyContent />
            </div>
            <div className="px-6 py-3 border-t border-slate-200 shrink-0">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-indigo-700 transition-colors"
              >
                {form.language === 'ja' ? '閉じる' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Component with Suspense ───────────────────────────
export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-slate-400">
          <i className="bi bi-arrow-repeat animate-spin mr-2" />
          Loading...
        </div>
      </div>
    }>
      <ApplyForm />
    </Suspense>
  );
}
