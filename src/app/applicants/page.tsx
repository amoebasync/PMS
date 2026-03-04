'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { handlePhoneChange } from '@/lib/formatters';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';
import Pagination from '@/components/ui/Pagination';

// ──────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────
type JobCategory = {
  id: number;
  nameJa: string;
  nameEn: string | null;
  isActive: boolean;
  _count?: { applicants: number };
};

type InterviewSlot = {
  id: number;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  meetUrl: string | null;
  interviewer: { id: number; lastNameJa: string; firstNameJa: string; email: string } | null;
  applicant: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    flowStatus: string;
    hiringStatus: string;
    jobCategory: { id: number; nameJa: string; nameEn: string | null } | null;
  } | null;
  interviewSlotApplicants?: Array<{
    applicant: {
      id: number;
      name: string;
      email: string;
      phone: string | null;
      flowStatus: string;
      hiringStatus: string;
      jobCategory: { id: number; nameJa: string; nameEn: string | null } | null;
    };
  }>;
  _count?: { interviewSlotApplicants: number };
  interviewSlotMaster?: {
    id: number;
    name: string;
    capacity: number;
  } | null;
};

type Country = { id: number; code: string; name: string; nameEn: string };
type VisaType = { id: number; name: string };
type RecruitingMedia = { id: number; nameJa: string; nameEn: string | null; code: string; isActive: boolean; sortOrder: number };

type TrainingSlotOption = {
  id: number;
  startTime: string;
  endTime: string;
  capacity: number;
  location: string | null;
  bookedCount: number;
  remainingCapacity: number;
};

type Applicant = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  birthday: string | null;
  language: string;
  jobCategoryId: number;
  jobCategory: { id: number; nameJa: string; nameEn: string | null } | null;
  countryId: number | null;
  country: Country | null;
  visaTypeId: number | null;
  visaType: VisaType | null;
  postalCode: string | null;
  address: string | null;
  building: string | null;
  recruitingMediaId: number | null;
  recruitingMedia: RecruitingMedia | null;
  interviewSlot: {
    id: number;
    startTime: string;
    endTime: string;
    meetUrl: string | null;
    isBooked: boolean;
    interviewer: { id: number; lastNameJa: string; firstNameJa: string; email: string } | null;
    interviewSlotMaster?: {
      id: number;
      name: string;
      meetingType: 'GOOGLE_MEET' | 'ZOOM';
      zoomMeetingNumber?: string | null;
      zoomPassword?: string | null;
    } | null;
  } | null;
  interviewSlotApplicants?: Array<{
    interviewSlot: {
      id: number;
      startTime: string;
      endTime: string;
      meetUrl: string | null;
      isBooked: boolean;
      interviewer: { id: number; lastNameJa: string; firstNameJa: string; email: string } | null;
      interviewSlotMaster?: {
        id: number;
        name: string;
        meetingType: 'GOOGLE_MEET' | 'ZOOM';
        zoomMeetingNumber?: string | null;
        zoomPassword?: string | null;
      } | null;
    };
  }>;
  trainingSlot: {
    id: number;
    startTime: string;
    endTime: string;
    capacity: number;
    location: string | null;
  } | null;
  flowStatus: string;
  hiringStatus: string;
  hasOtherJob: boolean | null;
  otherJobDetails: string | null;
  hasBankInJapan: boolean | null;
  japaneseLevel: number | null;
  englishLevel: number | null;
  communicationScore: number | null;
  impressionScore: number | null;
  interviewNotes: string | null;
  trainingAttendance: string | null;
  trainingUnderstandingScore: number | null;
  trainingCommunicationScore: number | null;
  trainingSpeedScore: number | null;
  trainingMotivationScore: number | null;
  trainingNotes: string | null;
  gender: string | null;
  registeredDistributorId: number | null;
  createdAt: string;
  updatedAt: string;
};

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────
const FLOW_STATUS_MAP: Record<string, { labelKey: string; color: string }> = {
  INTERVIEW_WAITING:   { labelKey: 'flow_interview_waiting',   color: 'bg-amber-100 text-amber-700' },
  NO_SHOW:             { labelKey: 'flow_no_show',    color: 'bg-rose-100 text-rose-700' },
  TRAINING_WAITING:    { labelKey: 'flow_training_waiting',   color: 'bg-blue-100 text-blue-700' },
  TRAINING_COMPLETED:  { labelKey: 'flow_training_completed',   color: 'bg-emerald-100 text-emerald-700' },
};

const HIRING_STATUS_MAP: Record<string, { labelKey: string; color: string }> = {
  IN_PROGRESS: { labelKey: 'hiring_in_progress',  color: 'bg-slate-100 text-slate-600' },
  HIRED:       { labelKey: 'hiring_hired',    color: 'bg-emerald-100 text-emerald-700' },
  REJECTED:    { labelKey: 'hiring_rejected',  color: 'bg-rose-100 text-rose-700' },
};

const LIMIT = 20;

// ──────────────────────────────────────────
// サブコンポーネント: SearchableSelect
// ──────────────────────────────────────────
interface SearchableSelectProps<T> {
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  placeholder: string;
  searchPlaceholder: string;
  noResultsText: string;
  className?: string;
  error?: boolean;
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
  className = '',
  error = false,
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
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-all flex items-center justify-between bg-white border focus:ring-2 focus:ring-blue-400 focus:outline-none ${
          error ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200'
        } ${isOpen ? 'ring-2 ring-blue-400' : ''}`}
      >
        <span className={displayText ? 'text-slate-800' : 'text-slate-400'}>
          {displayText || placeholder}
        </span>
        <i className={`bi bi-chevron-down text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {getOptionLabel(opt)}
                    {isSelected && <i className="bi bi-check ml-2 text-blue-600" />}
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

// ──────────────────────────────────────────
// サブコンポーネント: ScoreSelector
// ──────────────────────────────────────────
const ScoreSelector = ({ value, onChange, label, lowLabel = '低', highLabel = '高' }: { value: number | null; onChange: (v: number) => void; label: string; lowLabel?: string; highLabel?: string }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
    <div className="flex gap-1 items-end">
      <span className="text-[10px] text-slate-400 pb-2.5 mr-0.5">{lowLabel}</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
            value === n
              ? n <= 2
                ? 'bg-rose-500 text-white shadow-md'
                : n === 3
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-emerald-500 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {n}
        </button>
      ))}
      <span className="text-[10px] text-slate-400 pb-2.5 ml-0.5">{highLabel}</span>
    </div>
  </div>
);

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function ApplicantsPage() {
  const { showToast, showConfirm } = useNotification();
  const { t, lang } = useTranslation('applicants');
  const calendarRef = useRef<FullCalendar>(null);
  const trainingCalendarRef = useRef<FullCalendar>(null);
  const trainingDateRangeRef = useRef<{ from: string; to: string } | null>(null);

  // ── タブ ──
  const [activeTab, setActiveTab] = useState<'calendar' | 'list' | 'training'>('calendar');

  // ── 研修管理 ──
  type TrainingApplicant = {
    id: number; name: string; flowStatus: string; hiringStatus: string; phone: string | null; email: string;
    trainingAttendance: string | null; trainingUnderstandingScore: number | null;
    trainingCommunicationScore: number | null; trainingSpeedScore: number | null;
    trainingMotivationScore: number | null; trainingNotes: string | null;
    countryName: string | null; jobCategoryName: string | null;
    registeredDistributorId: number | null;
  };
  type TrainingSlotManagement = {
    id: number; startTime: string; endTime: string; capacity: number;
    location: string | null; note: string | null; bookedCount: number;
    remainingCapacity: number; applicants: TrainingApplicant[];
  };
  const [trainingMgmtSlots, setTrainingMgmtSlots] = useState<TrainingSlotManagement[]>([]);
  const [trainingMgmtLoading, setTrainingMgmtLoading] = useState(false);
  const [trainingMgmtMonth, setTrainingMgmtMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedTrainingSlot, setSelectedTrainingSlot] = useState<TrainingSlotManagement | null>(null);
  const [expandedTrainingApplicantId, setExpandedTrainingApplicantId] = useState<number | null>(null);
  const [returnToTrainingSlotId, setReturnToTrainingSlotId] = useState<number | null>(null);
  const [editCapacity, setEditCapacity] = useState<number>(10);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState(false);

  const fetchTrainingMgmt = async (from?: string, to?: string) => {
    setTrainingMgmtLoading(true);
    try {
      const f = from ?? trainingDateRangeRef.current?.from;
      const t = to ?? trainingDateRangeRef.current?.to;
      let url = '/api/training-slots';
      if (f && t) {
        url += `?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`;
      } else {
        url += `?month=${trainingMgmtMonth}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const newSlots = json.data || [];
        setTrainingMgmtSlots(newSlots);
        setSelectedTrainingSlot(prev => {
          if (!prev) return null;
          return newSlots.find((s: TrainingSlotManagement) => s.id === prev.id) ?? null;
        });
      }
    } catch { /* ignore */ }
    setTrainingMgmtLoading(false);
  };

  const handleOpenTrainingEval = (app: TrainingApplicant) => {
    setTrainingEvalTargetId(app.id);
    setTrainingEvalForm({
      attendance: app.trainingAttendance || '',
      understandingScore: app.trainingUnderstandingScore,
      communicationScore: app.trainingCommunicationScore,
      speedScore: app.trainingSpeedScore,
      motivationScore: app.trainingMotivationScore,
      notes: app.trainingNotes || '',
    });
  };

  const handleSaveTrainingEval = async () => {
    if (!trainingEvalTargetId) return;
    if (!trainingEvalForm.attendance) {
      showToast(t('training_eval_select_attendance'), 'error');
      return;
    }
    setTrainingEvalSaving(true);
    try {
      const payload: any = {
        flowStatus: 'TRAINING_COMPLETED',
        trainingAttendance: trainingEvalForm.attendance,
        trainingNotes: trainingEvalForm.notes || null,
      };
      if (trainingEvalForm.attendance === 'ATTENDED') {
        payload.trainingUnderstandingScore = trainingEvalForm.understandingScore;
        payload.trainingCommunicationScore = trainingEvalForm.communicationScore;
        payload.trainingSpeedScore = trainingEvalForm.speedScore;
        payload.trainingMotivationScore = trainingEvalForm.motivationScore;
      } else {
        payload.trainingUnderstandingScore = null;
        payload.trainingCommunicationScore = null;
        payload.trainingSpeedScore = null;
        payload.trainingMotivationScore = null;
      }
      const res = await fetch(`/api/applicants/${trainingEvalTargetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast(t('training_eval_saved'), 'success');
        setTrainingEvalTargetId(null);
        await fetchTrainingMgmt();
      } else {
        showToast(t('update_failed'), 'error');
      }
    } catch { showToast(t('error_occurred'), 'error'); }
    setTrainingEvalSaving(false);
  };

  // ── カレンダー ──
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterMasterId, setFilterMasterId] = useState<number | ''>('');
  const [slotMasters, setSlotMasters] = useState<Array<{id: number; name: string}>>([]);
  const [slotMinTime, setSlotMinTime] = useState('08:00:00');
  const [slotMaxTime, setSlotMaxTime] = useState('20:00:00');

  // ── 応募者リスト ──
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFlowStatus, setFilterFlowStatus] = useState('');
  const [filterHiringStatus, setFilterHiringStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(1); // ポーリング用: 現在のページ番号を追跡

  // ── モーダル状態 ──
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showJobCatModal, setShowJobCatModal] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalSaving, setEvalSaving] = useState(false);

  // ── 面接日程変更 ──
  const [showReschedulePanel, setShowReschedulePanel] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{id: number; startTime: string; endTime: string}[]>([]);
  const [selectedNewSlotId, setSelectedNewSlotId] = useState<number | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // ── 研修スロット ──
  const [trainingSlots, setTrainingSlots] = useState<TrainingSlotOption[]>([]);
  const [loadingTrainingSlots, setLoadingTrainingSlots] = useState(false);
  const [selectedTrainingSlotId, setSelectedTrainingSlotId] = useState<number | ''>('');
  const [trainingBookingMode, setTrainingBookingMode] = useState<'now' | 'later'>('now');
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // ── 研修日程変更 ──
  const [showTrainingReschedulePanel, setShowTrainingReschedulePanel] = useState(false);
  const [availableTrainingSlots, setAvailableTrainingSlots] = useState<TrainingSlotOption[]>([]);
  const [selectedNewTrainingSlotId, setSelectedNewTrainingSlotId] = useState<number | null>(null);
  const [trainingRescheduleLoading, setTrainingRescheduleLoading] = useState(false);

  // ── 研修管理モーダル: 参加者アクション ──
  const [trainingActionMenuId, setTrainingActionMenuId] = useState<number | null>(null);
  const [trainingRescheduleTargetId, setTrainingRescheduleTargetId] = useState<number | null>(null);
  const [trainingRescheduleMode, setTrainingRescheduleMode] = useState<'direct' | null>(null);
  const [calendarNewTrainingSlotId, setCalendarNewTrainingSlotId] = useState<number | null>(null);
  const [calendarRescheduleLoading, setCalendarRescheduleLoading] = useState(false);

  // ── 研修評価フォーム ──
  const [trainingEvalTargetId, setTrainingEvalTargetId] = useState<number | null>(null);
  const [trainingEvalForm, setTrainingEvalForm] = useState({
    attendance: '' as string,
    understandingScore: null as number | null,
    communicationScore: null as number | null,
    speedScore: null as number | null,
    motivationScore: null as number | null,
    notes: '',
  });
  const [trainingEvalSaving, setTrainingEvalSaving] = useState(false);

  // ── 配布員登録 ──
  const [branches, setBranches] = useState<{ id: number; nameJa: string; prefix: string | null }[]>([]);
  const [showDistributorForm, setShowDistributorForm] = useState(false);
  const [distForm, setDistForm] = useState({ branchId: '', staffId: '' });
  const [staffIdLoading, setStaffIdLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registeredDistributorId, setRegisteredDistributorId] = useState<number | null>(null);

  // ── 応募ページリンク生成 ──
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkLang, setLinkLang] = useState('ja');
  const [linkMediaId, setLinkMediaId] = useState('');

  // ── 手動登録 ──
  const [showManualRegisterModal, setShowManualRegisterModal] = useState(false);
  const [manualRegForm, setManualRegForm] = useState({ name: '', email: '', phone: '', jobCategoryId: '', language: 'en', recruitingMediaId: '', birthday: '', gender: '', countryId: '', visaTypeId: '', sendInterviewEmail: true });
  const [manualRegSaving, setManualRegSaving] = useState(false);
  const [sendingInvitation, setSendingInvitation] = useState(false);

  // ── スロット作成フォーム ──
  const [slotForm, setSlotForm] = useState({
    date: '',
    startHour: 9,
    endHour: 17,
    intervalMinutes: 30,
    meetUrl: '',
  });
  const [slotCreating, setSlotCreating] = useState(false);

  // ── 応募者評価フォーム ──
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [evalForm, setEvalForm] = useState({
    name: '',
    email: '',
    phone: '',
    language: 'ja',
    birthday: '',
    gender: '',
    jobCategoryId: '' as string | number,
    countryId: '' as string | number,
    visaTypeId: '' as string | number,
    postalCode: '',
    address: '',
    building: '',
    hasOtherJob: false,
    otherJobDetails: '',
    hasBankInJapan: false,
    japaneseLevel: null as number | null,
    englishLevel: null as number | null,
    communicationScore: null as number | null,
    impressionScore: null as number | null,
    interviewNotes: '',
    flowStatus: 'INTERVIEW_WAITING',
    hiringStatus: 'IN_PROGRESS',
    recruitingMediaId: '' as string | number,
  });

  // ── 職種マスタ ──
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [jobCatLoading, setJobCatLoading] = useState(false);
  const [newJobCat, setNewJobCat] = useState({ nameJa: '', nameEn: '' });
  const [jobCatCreating, setJobCatCreating] = useState(false);
  const [editingJobCat, setEditingJobCat] = useState<{ id: number; nameJa: string; nameEn: string } | null>(null);
  const [jobCatSaving, setJobCatSaving] = useState(false);

  // ── マスターデータ ──
  const [countries, setCountries] = useState<Country[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [recruitingMediaList, setRecruitingMediaList] = useState<RecruitingMedia[]>([]);
  const [interviewerEmployees, setInterviewerEmployees] = useState<{ id: number; lastNameJa: string; firstNameJa: string; email: string }[]>([]);

  // ──────────────────────────────────────────
  // ヘルパー: 応募者の面接スロット取得（junction table対応）
  // ──────────────────────────────────────────
  function getApplicantInterviewSlot(applicant: Applicant) {
    if (applicant.interviewSlotApplicants && applicant.interviewSlotApplicants.length > 0) {
      return applicant.interviewSlotApplicants[0].interviewSlot;
    }
    return applicant.interviewSlot;
  }

  // ──────────────────────────────────────────
  // データ取得
  // ──────────────────────────────────────────
  const fetchSlots = useCallback(async (month?: string, silent = false) => {
    if (!silent) setCalendarLoading(true);
    try {
      const m = month || currentMonth;
      const url = new URL('/api/interview-slots', window.location.origin);
      url.searchParams.set('month', m);
      if (filterMasterId) url.searchParams.set('masterId', String(filterMasterId));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const fetchedSlots = data.data || [];
      setSlots(fetchedSlots);

      // Compute dynamic time range
      if (fetchedSlots.length > 0) {
        const times = fetchedSlots.map((s: InterviewSlot) => {
          const start = new Date(s.startTime);
          const end = new Date(s.endTime);
          return { startH: start.getHours(), endH: end.getHours() + (end.getMinutes() > 0 ? 1 : 0) };
        });
        const minH = Math.max(0, Math.min(...times.map((t: { startH: number }) => t.startH)) - 1);
        const maxH = Math.min(24, Math.max(...times.map((t: { endH: number }) => t.endH)) + 1);
        setSlotMinTime(`${String(minH).padStart(2, '0')}:00:00`);
        setSlotMaxTime(`${String(maxH).padStart(2, '0')}:00:00`);
      }
    } catch {
      if (!silent) {
        setSlots([]);
        showToast(t('slot_fetch_failed'), 'error');
      }
    } finally {
      if (!silent) setCalendarLoading(false);
    }
  }, [currentMonth, filterMasterId, showToast]);

  const fetchApplicants = useCallback(async (p = 1, silent = false) => {
    if (!silent) setListLoading(true);
    try {
      const params = new URLSearchParams({
        page: p.toString(),
        limit: LIMIT.toString(),
      });
      if (searchTerm) params.set('search', searchTerm);
      if (filterFlowStatus) params.set('flowStatus', filterFlowStatus);
      if (filterHiringStatus) params.set('hiringStatus', filterHiringStatus);

      const res = await fetch(`/api/applicants?${params}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setApplicants(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch {
      if (!silent) setApplicants([]);
    } finally {
      if (!silent) setListLoading(false);
    }
  }, [searchTerm, filterFlowStatus, filterHiringStatus]);

  const fetchJobCategories = useCallback(async () => {
    setJobCatLoading(true);
    try {
      const res = await fetch('/api/job-categories');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setJobCategories(data || []);
    } catch {
      setJobCategories([]);
    } finally {
      setJobCatLoading(false);
    }
  }, []);

  const fetchMasterData = useCallback(async () => {
    try {
      const [countriesRes, visaTypesRes, rmRes, empRes, mastersRes] = await Promise.all([
        fetch('/api/countries/public'),
        fetch('/api/visa-types/public'),
        fetch('/api/recruiting-media'),
        fetch('/api/employees?simple=true'),
        fetch('/api/interview-slot-masters'),
      ]);
      if (countriesRes.ok) {
        const data = await countriesRes.json();
        setCountries(data || []);
      }
      if (visaTypesRes.ok) {
        const data = await visaTypesRes.json();
        setVisaTypes(data || []);
      }
      if (rmRes.ok) {
        const data = await rmRes.json();
        setRecruitingMediaList(data || []);
      }
      if (empRes.ok) {
        const data = await empRes.json();
        setInterviewerEmployees(data || []);
      }
      if (mastersRes.ok) {
        const data = await mastersRes.json();
        setSlotMasters((data || []).map((m: any) => ({ id: m.id, name: m.name })));
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchTrainingSlots = async () => {
    setLoadingTrainingSlots(true);
    try {
      const res = await fetch('/api/training-slots/available');
      if (res.ok) {
        const data = await res.json();
        setTrainingSlots(data.slots || []);
      }
    } catch {
      // silently fail
    }
    setLoadingTrainingSlots(false);
  };

  const fetchNextStaffId = async (branchId: string) => {
    if (!branchId) return;
    setStaffIdLoading(true);
    try {
      const res = await fetch(`/api/branches/${branchId}/next-staff-id`);
      const data = await res.json();
      if (res.ok && data.nextStaffId) {
        setDistForm(f => ({ ...f, staffId: data.nextStaffId }));
      } else {
        setDistForm(f => ({ ...f, staffId: '' }));
      }
    } catch {
      setDistForm(f => ({ ...f, staffId: '' }));
    } finally {
      setStaffIdLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) setBranches(await res.json());
    } catch {
      // silently fail
    }
  };

  const handleRegisterAsDistributor = async () => {
    if (!selectedApplicant || !distForm.branchId) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/register-as-distributor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: Number(distForm.branchId),
          staffId: distForm.staffId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegisteredDistributorId(data.distributorId);
        setShowDistributorForm(false);
        showToast(t('eval_distributor_success'), 'success');
      } else {
        showToast(data.error || t('eval_distributor_failed'), 'error');
      }
    } catch {
      showToast(t('eval_distributor_failed'), 'error');
    } finally {
      setRegistering(false);
    }
  };

  // 応募ページリンク生成＆コピー
  const buildApplyUrl = () => {
    const base = `${window.location.origin}/apply`;
    const params = new URLSearchParams();
    if (linkLang === 'en') params.set('lang', 'en');
    const media = recruitingMediaList.find(m => m.id === Number(linkMediaId));
    if (media) params.set('source', media.code);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const handleCopyApplyLink = async () => {
    const url = buildApplyUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('link_copied'), 'success');
    } catch {
      showToast(t('link_copy_failed'), 'error');
    }
  };

  // 手動登録
  const handleManualRegister = async () => {
    if (!manualRegForm.name.trim() || !manualRegForm.email.trim() || !manualRegForm.jobCategoryId) {
      showToast(t('manual_required_fields'), 'warning');
      return;
    }
    setManualRegSaving(true);
    try {
      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualRegForm.name.trim(),
          email: manualRegForm.email.trim(),
          phone: manualRegForm.phone.trim() || undefined,
          jobCategoryId: Number(manualRegForm.jobCategoryId),
          language: manualRegForm.language,
          recruitingMediaId: manualRegForm.recruitingMediaId ? Number(manualRegForm.recruitingMediaId) : undefined,
          countryId: manualRegForm.countryId ? Number(manualRegForm.countryId) : undefined,
          visaTypeId: manualRegForm.visaTypeId ? Number(manualRegForm.visaTypeId) : undefined,
          birthday: manualRegForm.birthday || undefined,
          gender: manualRegForm.gender || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('eval_distributor_failed'));
      setShowManualRegisterModal(false);
      const shouldSendEmail = manualRegForm.sendInterviewEmail;
      setManualRegForm({ name: '', email: '', phone: '', jobCategoryId: '', language: 'en', recruitingMediaId: '', birthday: '', gender: '', countryId: '', visaTypeId: '', sendInterviewEmail: true });
      fetchApplicants(1);
      fetchSlots();
      if (shouldSendEmail) {
        showToast(t('manual_registered_sending'), 'success');
        try {
          await fetch(`/api/applicants/${data.id}/send-interview-invitation`, { method: 'POST' });
          showToast(t('eval_invitation_sent'), 'success');
        } catch {
          showToast(t('eval_invitation_failed'), 'error');
        }
      } else {
        showToast(t('manual_registered'), 'success');
      }
    } catch (e: any) {
      showToast(e.message || t('eval_distributor_failed'), 'error');
    } finally {
      setManualRegSaving(false);
    }
  };

  // 面接案内メール送信
  const handleSendInterviewInvitation = async () => {
    if (!selectedApplicant) return;
    setSendingInvitation(true);
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/send-interview-invitation`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('eval_invitation_failed'));
      showToast(t('eval_invitation_sent'), 'success');
    } catch (e: any) {
      showToast(e.message || t('eval_invitation_failed'), 'error');
    } finally {
      setSendingInvitation(false);
    }
  };

  // ── 初回ロード ──
  useEffect(() => {
    fetchSlots();
    fetchApplicants(1);
    fetchMasterData();
  }, []);

  // ── ページ番号をrefに同期（ポーリング用） ──
  useEffect(() => { pageRef.current = page; }, [page]);

  // ── 30秒ポーリング: 面接予約・変更・キャンセルを自動反映（ローディング表示なし）──
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchApplicants(pageRef.current, true); // silent
        fetchSlots(undefined, true);            // silent
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchApplicants, fetchSlots]);

  // ── マスタフィルター変更時にスロット再取得 ──
  useEffect(() => {
    fetchSlots();
  }, [filterMasterId]);

  // ── 検索デバウンス ──
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchApplicants(1);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchTerm, filterFlowStatus, filterHiringStatus]);

  // ──────────────────────────────────────────
  // 研修カレンダーイベント変換
  // ──────────────────────────────────────────
  const trainingCalendarEvents = trainingMgmtSlots.map(slot => {
    const fillRate = slot.capacity > 0 ? (slot.bookedCount / slot.capacity) * 100 : 0;
    const allDone = slot.applicants.length > 0 && slot.applicants.every(a => a.flowStatus === 'TRAINING_COMPLETED');
    const bg = allDone ? '#10b981' : fillRate >= 100 ? '#ef4444' : fillRate >= 70 ? '#f59e0b' : slot.bookedCount > 0 ? '#6366f1' : '#94a3b8';
    return {
      id: String(slot.id),
      title: `${slot.bookedCount}/${slot.capacity}${t('training_persons')}`,
      start: slot.startTime,
      end: slot.endTime,
      backgroundColor: bg,
      borderColor: bg,
      textColor: '#ffffff',
      extendedProps: { slot },
    };
  });

  // ──────────────────────────────────────────
  // カレンダーイベント変換
  // ──────────────────────────────────────────
  const calendarEvents = slots.map(slot => {
    const capacity = slot.interviewSlotMaster?.capacity ?? 1;
    const bookedCount = slot._count?.interviewSlotApplicants ?? (slot.isBooked ? 1 : 0);
    const isFull = capacity > 0 && bookedCount >= capacity;
    const isPartial = bookedCount > 0 && !isFull;
    const isBooked = bookedCount > 0;

    // Color: empty=green, partial=amber, full=purple
    const backgroundColor = isFull ? '#7c3aed' : isPartial ? '#d97706' : '#059669';
    const borderColor = isFull ? '#6d28d9' : isPartial ? '#b45309' : '#047857';

    // Title: capacity=1 shows applicant name, capacity>1 shows count format
    let title: string;
    if (capacity === 1) {
      const applicantName = slot.applicant?.name || slot.interviewSlotApplicants?.[0]?.applicant?.name;
      title = applicantName || t('empty_slot');
    } else {
      title = `${bookedCount}/${capacity === 0 ? '\u221E' : capacity}${lang === 'ja' ? '\u540D' : ''}`;
    }

    const interviewerName = slot.interviewer ? `${slot.interviewer.lastNameJa} ${slot.interviewer.firstNameJa}` : '';
    return {
      id: String(slot.id),
      title,
      start: slot.startTime,
      end: slot.endTime,
      backgroundColor,
      borderColor,
      textColor: '#ffffff',
      extendedProps: {
        slot,
        isBooked,
        interviewerName,
        bookedCount,
        capacity,
      },
    };
  });

  // ──────────────────────────────────────────
  // イベントハンドラ
  // ──────────────────────────────────────────

  // 研修カレンダー: 週変更
  const handleTrainingDatesSet = (arg: { start: Date; end: Date }) => {
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    trainingDateRangeRef.current = { from, to };
    fetchTrainingMgmt(from, to);
  };

  // 研修カレンダー: イベントクリック → スロット詳細表示
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleTrainingEventClick = (arg: any) => {
    const { slot } = arg.event.extendedProps as { slot: TrainingSlotManagement };
    setSelectedTrainingSlot(slot);
    setEditCapacity(slot.capacity);
  };

  // 研修スロット: 定員保存
  const handleSaveCapacity = async () => {
    if (!selectedTrainingSlot) return;
    setSavingCapacity(true);
    try {
      const res = await fetch(`/api/training-slots/${selectedTrainingSlot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: editCapacity }),
      });
      if (res.ok) {
        showToast(t('training_capacity_saved'), 'success');
        await fetchTrainingMgmt();
      } else {
        const err = await res.json();
        showToast(err.error || t('update_failed'), 'error');
      }
    } catch { showToast(t('error_occurred'), 'error'); }
    setSavingCapacity(false);
  };

  // 研修スロット詳細モーダルを閉じる
  const closeTrainingSlotPanel = () => {
    setSelectedTrainingSlot(null);
    setExpandedTrainingApplicantId(null);
  };

  // 評価モーダルを閉じる（研修詳細から遷移していた場合はそちらに戻る）
  const closeEvalModal = () => {
    setShowEvalModal(false);
    setSelectedApplicant(null);
    if (returnToTrainingSlotId) {
      const slotId = returnToTrainingSlotId;
      setReturnToTrainingSlotId(null);
      // 研修データを最新化してスロット詳細モーダルを再表示
      const f = trainingDateRangeRef.current?.from;
      const t = trainingDateRangeRef.current?.to;
      let url = '/api/training-slots';
      if (f && t) {
        url += `?from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`;
      }
      fetch(url).then(res => res.ok ? res.json() : null).then(json => {
        if (!json) return;
        const slots = json.data || [];
        setTrainingMgmtSlots(slots);
        const found = slots.find((s: TrainingSlotManagement) => s.id === slotId);
        if (found) {
          setSelectedTrainingSlot(found);
          setEditCapacity(found.capacity);
        }
      }).catch(() => {});
    }
  };

  // 研修スロット: 削除
  const handleDeleteTrainingSlot = async () => {
    if (!selectedTrainingSlot) return;
    const start = new Date(selectedTrainingSlot.startTime);
    const dateStr = start.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const ok = await showConfirm(
      t('training_slot_delete_confirm', { dateStr }),
      { variant: 'danger', confirmLabel: t('delete'), title: t('training_slot_delete_title') }
    );
    if (!ok) return;
    setDeletingSlot(true);
    try {
      const res = await fetch(`/api/training-slots/${selectedTrainingSlot.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(t('training_slot_deleted'), 'success');
        closeTrainingSlotPanel();
        await fetchTrainingMgmt();
      } else {
        const err = await res.json();
        showToast(err.error || t('eval_delete_failed'), 'error');
      }
    } catch { showToast(t('error_occurred'), 'error'); }
    setDeletingSlot(false);
  };

  // カレンダー月変更
  const handleDatesSet = (arg: { start: Date; end: Date }) => {
    const midDate = new Date((arg.start.getTime() + arg.end.getTime()) / 2);
    const newMonth = `${midDate.getFullYear()}-${String(midDate.getMonth() + 1).padStart(2, '0')}`;
    if (newMonth !== currentMonth) {
      setCurrentMonth(newMonth);
      fetchSlots(newMonth);
    }
  };

  // 日付クリック → スロット作成モーダル
  const handleDateClick = (arg: { dateStr: string }) => {
    const dateStr = arg.dateStr.includes('T') ? arg.dateStr.split('T')[0] : arg.dateStr;
    setSlotForm({
      date: dateStr,
      startHour: 9,
      endHour: 17,
      intervalMinutes: 30,
      meetUrl: '',
    });
    setShowSlotModal(true);
  };

  // イベントクリック
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = async (arg: any) => {
    const { slot, isBooked } = arg.event.extendedProps as { slot: InterviewSlot; isBooked: boolean };
    // Try junction table first, then legacy applicant
    const firstApplicant = slot.interviewSlotApplicants?.[0]?.applicant || slot.applicant;
    if (isBooked && firstApplicant) {
      openEvalModal(firstApplicant.id);
    } else {
      const ok = await showConfirm(
        t('slot_delete_confirm', { dateTime: new Date(slot.startTime).toLocaleString('ja-JP') }),
        { variant: 'danger', confirmLabel: t('delete'), title: t('slot_delete_title') }
      );
      if (ok) {
        try {
          const res = await fetch(`/api/interview-slots/${slot.id}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || t('eval_delete_failed'));
          }
          showToast(t('slot_deleted'), 'success');
          fetchSlots();
        } catch (e: any) {
          showToast(e.message || t('slot_delete_failed'), 'error');
        }
      }
    }
  };

  // スロット一括作成
  const handleCreateSlots = async () => {
    if (!slotForm.date) {
      showToast(t('slot_create_date_required'), 'warning');
      return;
    }
    if (slotForm.startHour >= slotForm.endHour) {
      showToast(t('slot_create_time_error'), 'warning');
      return;
    }
    setSlotCreating(true);
    try {
      const res = await fetch('/api/interview-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: slotForm.date,
          startHour: slotForm.startHour,
          endHour: slotForm.endHour,
          intervalMinutes: slotForm.intervalMinutes,
          meetUrl: slotForm.meetUrl || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('slot_create_failed'));
      }
      const data = await res.json();
      showToast(t('slot_create_success', { count: data.count }), 'success');
      setShowSlotModal(false);
      fetchSlots();
    } catch (e: any) {
      showToast(e.message || t('slot_create_failed'), 'error');
    } finally {
      setSlotCreating(false);
    }
  };

  // 応募者評価モーダルを開く
  const openEvalModal = async (applicantId: number, fromTrainingSlotId?: number) => {
    setReturnToTrainingSlotId(fromTrainingSlotId ?? null);
    setEvalLoading(true);
    setShowEvalModal(true);
    if (jobCategories.length === 0) fetchJobCategories();
    setShowReschedulePanel(false);
    setShowTrainingReschedulePanel(false);
    setSelectedNewTrainingSlotId(null);
    setSelectedTrainingSlotId('');
    setTrainingBookingMode('now');
    setShowDistributorForm(false);
    setDistForm({ branchId: '', staffId: '' });
    setRegisteredDistributorId(null);
    try {
      const res = await fetch(`/api/applicants/${applicantId}`);
      if (!res.ok) throw new Error('fetch failed');
      const data: Applicant = await res.json();
      setSelectedApplicant(data);
      setRegisteredDistributorId(data.registeredDistributorId);
      setEvalForm({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        language: data.language || 'ja',
        birthday: data.birthday ? data.birthday.slice(0, 10) : '',
        gender: data.gender || '',
        jobCategoryId: data.jobCategoryId || '',
        countryId: data.countryId || '',
        visaTypeId: data.visaTypeId || '',
        postalCode: data.postalCode || '',
        address: data.address || '',
        building: data.building || '',
        hasOtherJob: data.hasOtherJob || false,
        otherJobDetails: data.otherJobDetails || '',
        hasBankInJapan: data.hasBankInJapan || false,
        japaneseLevel: data.japaneseLevel,
        englishLevel: data.englishLevel,
        communicationScore: data.communicationScore,
        impressionScore: data.impressionScore,
        interviewNotes: data.interviewNotes || '',
        flowStatus: data.flowStatus,
        hiringStatus: data.hiringStatus,
        recruitingMediaId: data.recruitingMediaId || '',
      });
      // 採用済みの場合は研修スロットを取得
      if (data.hiringStatus === 'HIRED') {
        fetchTrainingSlots();
      }
    } catch {
      showToast(t('eval_fetch_failed'), 'error');
      closeEvalModal();
    } finally {
      setEvalLoading(false);
    }
  };

  // 応募者評価保存
  const handleSaveEval = async () => {
    if (!selectedApplicant) return;
    setEvalSaving(true);
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: evalForm.name,
          email: evalForm.email,
          phone: evalForm.phone || null,
          language: evalForm.language,
          birthday: evalForm.birthday || null,
          gender: evalForm.gender || null,
          jobCategoryId: evalForm.jobCategoryId || null,
          countryId: evalForm.countryId || null,
          visaTypeId: evalForm.visaTypeId || null,
          postalCode: evalForm.postalCode || null,
          address: evalForm.address || null,
          building: evalForm.building || null,
          hasOtherJob: evalForm.hasOtherJob,
          otherJobDetails: evalForm.hasOtherJob ? evalForm.otherJobDetails : null,
          hasBankInJapan: evalForm.hasBankInJapan,
          japaneseLevel: evalForm.japaneseLevel,
          englishLevel: evalForm.englishLevel,
          communicationScore: evalForm.communicationScore,
          impressionScore: evalForm.impressionScore,
          interviewNotes: evalForm.interviewNotes || null,
          flowStatus: evalForm.flowStatus,
          hiringStatus: evalForm.hiringStatus,
          recruitingMediaId: evalForm.recruitingMediaId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('eval_save_failed'));
      }

      // 研修スロット処理
      if (evalForm.hiringStatus === 'HIRED') {
        let trainingBooked = false;
        if (trainingBookingMode === 'now' && selectedTrainingSlotId) {
          const bookRes = await fetch(`/api/applicants/${selectedApplicant.id}/book-training`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainingSlotId: selectedTrainingSlotId }),
          });
          if (!bookRes.ok) {
            const err = await bookRes.json();
            showToast(`${t('eval_training_book_failed')}: ${err.error || ''}`, 'error');
          } else {
            showToast(t('eval_training_booked'), 'success');
            trainingBooked = true;
          }
        } else if (trainingBookingMode === 'later') {
          const inviteRes = await fetch(`/api/applicants/${selectedApplicant.id}/book-training`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainingSlotId: null, sendInvite: true }),
          });
          if (!inviteRes.ok) {
            showToast(t('eval_training_invite_failed'), 'error');
          } else {
            showToast(t('eval_training_invite_sent'), 'success');
          }
        } else {
          showToast(t('eval_saved'), 'success');
        }

      } else {
        showToast(t('eval_saved'), 'success');
      }

      closeEvalModal();
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('eval_save_failed'), 'error');
    } finally {
      setEvalSaving(false);
    }
  };

  // 面接キャンセル（管理者）
  const handleCancelInterview = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      t('eval_cancel_interview_confirm', { name: selectedApplicant.name }),
      { variant: 'danger', confirmLabel: t('eval_cancel_interview_confirm_label'), title: t('eval_cancel_interview_title') }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/cancel-interview`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('eval_cancel_interview_failed'));
      }
      showToast(t('eval_cancel_interview_success'), 'success');
      openEvalModal(selectedApplicant.id);
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('eval_cancel_interview_failed'), 'error');
    }
  };

  // 面接NO SHOW記録
  const handleNoShow = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      t('eval_no_show_confirm', { name: selectedApplicant.name }),
      { variant: 'danger', confirmLabel: t('eval_no_show_confirm_label'), title: t('eval_no_show_title') }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowStatus: 'NO_SHOW' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('eval_no_show_failed'));
      }
      showToast(t('eval_no_show_success'), 'success');
      openEvalModal(selectedApplicant.id);
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('eval_no_show_failed'), 'error');
    }
  };

  // 面接担当者変更
  const handleChangeInterviewer = async (newInterviewerId: number | null) => {
    const slot = selectedApplicant ? getApplicantInterviewSlot(selectedApplicant) : null;
    if (!slot) return;
    const slotId = slot.id;
    try {
      const res = await fetch(`/api/interview-slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewerId: newInterviewerId }),
      });
      if (!res.ok) throw new Error('update failed');
      const updatedSlot = await res.json();
      setSelectedApplicant((prev) =>
        prev ? { ...prev, interviewSlot: { ...prev.interviewSlot!, interviewer: updatedSlot.interviewer } } : prev
      );
    } catch {
      alert(t('eval_interviewer_change_failed'));
    }
  };

  // 応募者削除
  const handleDeleteApplicant = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      t('eval_delete_confirm', { name: selectedApplicant.name }),
      { variant: 'danger', confirmLabel: t('delete'), title: t('eval_delete_title') }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('eval_delete_failed'));
      }
      showToast(t('eval_deleted', { name: selectedApplicant.name }), 'success');
      closeEvalModal();
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('eval_delete_failed'), 'error');
    }
  };

  // 日程変更パネル表示
  const openReschedulePanel = async () => {
    if (!selectedApplicant) return;
    setShowReschedulePanel(true);
    setSelectedNewSlotId(null);
    setRescheduleLoading(true);
    try {
      const jobCatId = selectedApplicant.jobCategoryId;
      const url = jobCatId
        ? `/api/interview-slots/available?jobCategoryId=${jobCatId}`
        : '/api/interview-slots/available';
      const res = await fetch(url);
      const data = await res.json();
      setAvailableSlots(data.slots || []);
    } catch {
      setAvailableSlots([]);
    } finally {
      setRescheduleLoading(false);
    }
  };

  // 面接日程変更実行
  const handleReschedule = async () => {
    if (!selectedApplicant || !selectedNewSlotId) return;
    setRescheduleLoading(true);
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSlotId: selectedNewSlotId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('eval_reschedule_failed'));
      }
      showToast(t('eval_reschedule_success'), 'success');
      setShowReschedulePanel(false);
      openEvalModal(selectedApplicant.id);
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('eval_reschedule_failed'), 'error');
    } finally {
      setRescheduleLoading(false);
    }
  };

  // ── 研修キャンセル ──
  const handleCancelTraining = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      t('training_cancel_confirm', { name: selectedApplicant.name }),
      { variant: 'danger', confirmLabel: t('training_cancel_confirm_label'), title: t('training_cancel_title') }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/cancel-training`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('training_cancel_failed'));
      }
      showToast(t('training_cancel_success'), 'success');
      openEvalModal(selectedApplicant.id);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('training_cancel_failed'), 'error');
    }
  };

  // ── 研修キャンセル（カレンダーモーダルから） ──
  const handleCancelTrainingFromModal = async (applicantId: number, applicantName: string) => {
    const ok = await showConfirm(
      t('training_cancel_confirm', { name: applicantName }),
      { variant: 'danger', confirmLabel: t('training_cancel_confirm_label'), title: t('training_cancel_title') }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${applicantId}/cancel-training`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('training_cancel_failed'));
      }
      showToast(t('training_cancel_success'), 'success');
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('training_cancel_failed'), 'error');
    }
  };

  // ── 研修日程変更 ──
  const handleTrainingReschedule = async () => {
    if (!selectedApplicant || !selectedNewTrainingSlotId) return;
    setTrainingRescheduleLoading(true);
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/reschedule-training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTrainingSlotId: selectedNewTrainingSlotId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('training_reschedule_failed'));
      }
      showToast(t('training_reschedule_success'), 'success');
      setShowTrainingReschedulePanel(false);
      openEvalModal(selectedApplicant.id);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('training_reschedule_failed'), 'error');
    } finally {
      setTrainingRescheduleLoading(false);
    }
  };

  // ── 研修日程変更（カレンダーモーダルから直接選択） ──
  const handleCalendarTrainingReschedule = async (applicantId: number) => {
    if (!calendarNewTrainingSlotId) return;
    setCalendarRescheduleLoading(true);
    try {
      const res = await fetch(`/api/applicants/${applicantId}/reschedule-training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTrainingSlotId: calendarNewTrainingSlotId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('training_reschedule_failed'));
      }
      showToast(t('training_reschedule_success'), 'success');
      setTrainingRescheduleTargetId(null);
      setTrainingRescheduleMode(null);
      setCalendarNewTrainingSlotId(null);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('training_reschedule_failed'), 'error');
    } finally {
      setCalendarRescheduleLoading(false);
    }
  };

  // ── 研修日程変更メール送信（カレンダーモーダルから） ──
  const handleSendTrainingRescheduleEmail = async (applicantId: number, applicantName: string) => {
    const ok = await showConfirm(
      t('training_reschedule_email_confirm', { name: applicantName }),
      { variant: 'primary', confirmLabel: t('training_reschedule_email_confirm_label'), title: t('training_reschedule_email_title') }
    );
    if (!ok) return;
    try {
      // まず現在の研修をキャンセル（スロット解放）
      await fetch(`/api/applicants/${applicantId}/cancel-training`, { method: 'POST' });
      // 研修案内メールを送信（本人が自分で予約し直す）
      const res = await fetch(`/api/applicants/${applicantId}/send-training-invite`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('training_reschedule_email_failed'));
      }
      showToast(t('training_reschedule_email_sent'), 'success');
      setTrainingActionMenuId(null);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || t('training_reschedule_email_failed'), 'error');
    }
  };

  // 職種作成
  const handleCreateJobCategory = async () => {
    if (!newJobCat.nameJa.trim()) {
      showToast(t('jobcat_name_required'), 'warning');
      return;
    }
    setJobCatCreating(true);
    try {
      const res = await fetch('/api/job-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameJa: newJobCat.nameJa.trim(),
          nameEn: newJobCat.nameEn.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('jobcat_create_failed'));
      }
      showToast(t('jobcat_created'), 'success');
      setNewJobCat({ nameJa: '', nameEn: '' });
      fetchJobCategories();
    } catch (e: any) {
      showToast(e.message || t('jobcat_create_failed'), 'error');
    } finally {
      setJobCatCreating(false);
    }
  };

  // 職種更新
  const handleUpdateJobCategory = async () => {
    if (!editingJobCat || !editingJobCat.nameJa.trim()) return;
    setJobCatSaving(true);
    try {
      const res = await fetch(`/api/job-categories/${editingJobCat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameJa: editingJobCat.nameJa.trim(),
          nameEn: editingJobCat.nameEn.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('jobcat_update_failed'));
      }
      showToast(t('jobcat_updated'), 'success');
      setEditingJobCat(null);
      fetchJobCategories();
    } catch (e: any) {
      showToast(e.message || t('jobcat_update_failed'), 'error');
    } finally {
      setJobCatSaving(false);
    }
  };

  // 職種削除
  const handleDeleteJobCategory = async (cat: JobCategory) => {
    const confirmed = await showConfirm(t('jobcat_delete_confirm', { name: cat.nameJa }));
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/job-categories/${cat.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('jobcat_delete_failed'));
      }
      showToast(t('jobcat_deleted'), 'success');
      fetchJobCategories();
    } catch (e: any) {
      showToast(e.message || t('jobcat_delete_failed'), 'error');
    }
  };

  // ── 日本人判定（国籍がJPかどうか） ──
  const isJapanese = (countryId: string | number | null | undefined): boolean => {
    if (!countryId) return false;
    const c = countries.find(ct => ct.id === Number(countryId));
    return c?.code === 'JP';
  };

  // ──────────────────────────────────────────
  // レンダリング
  // ──────────────────────────────────────────
  return (
    <>
      {/* FullCalendar スタイルオーバーライド */}
      <style jsx global>{`
        .fc {
          font-family: inherit;
        }
        .fc .fc-button-primary {
          background-color: #4f46e5;
          border-color: #4f46e5;
          font-weight: 600;
          font-size: 0.8rem;
          padding: 0.4rem 0.8rem;
          border-radius: 0.5rem;
          transition: all 0.15s;
        }
        .fc .fc-button-primary:hover {
          background-color: #4338ca;
          border-color: #4338ca;
        }
        .fc .fc-button-primary:disabled {
          background-color: #94a3b8;
          border-color: #94a3b8;
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background-color: #3730a3;
          border-color: #3730a3;
        }
        .fc .fc-toolbar-title {
          font-weight: 800;
          color: #1e293b;
          font-size: 1.25rem;
        }
        .fc .fc-event {
          border-radius: 0.375rem;
          padding: 2px 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .fc .fc-daygrid-event {
          margin-top: 2px;
        }
        .fc .fc-col-header-cell {
          background-color: #f8fafc;
          font-weight: 700;
          font-size: 0.8rem;
          color: #475569;
          padding: 8px 0;
        }
        .fc .fc-daygrid-day-number {
          font-weight: 600;
          color: #334155;
          padding: 6px 10px;
          font-size: 0.85rem;
        }
        .fc .fc-day-today {
          background-color: #eef2ff !important;
        }
        .fc .fc-timegrid-slot {
          height: 2.5rem;
        }
        .fc .fc-timegrid-slot-label {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }
        .fc .fc-scrollgrid {
          border-color: #e2e8f0;
          border-radius: 0.75rem;
          overflow: hidden;
        }
        .fc td, .fc th {
          border-color: #e2e8f0;
        }
      `}</style>

      <div className="space-y-6">
        {/* ── タブ + アクションボタン ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center border-b border-slate-200">
            <div className="flex overflow-x-auto md:overflow-visible scrollbar-hide">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-3.5 text-xs md:text-sm font-bold transition-colors relative shrink-0 whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="bi bi-calendar3"></i>
              {t('tab_calendar')}
              {activeTab === 'calendar' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('list');
                fetchApplicants(1);
              }}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-3.5 text-xs md:text-sm font-bold transition-colors relative shrink-0 whitespace-nowrap ${
                activeTab === 'list'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="bi bi-list-ul"></i>
              {t('tab_list')}
              {activeTab === 'list' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('training');
                fetchTrainingMgmt();
              }}
              className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-3.5 text-xs md:text-sm font-bold transition-colors relative shrink-0 whitespace-nowrap ${
                activeTab === 'training'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="bi bi-mortarboard-fill"></i>
              {t('tab_training')}
              {activeTab === 'training' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
              )}
            </button>
            </div>

            {/* スペーサー + アクションボタン */}
            <div className="hidden md:block flex-1" />
            <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-0 overflow-x-auto scrollbar-hide">
              <div className="relative">
                <button
                  onClick={() => setShowLinkPopover(v => !v)}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shrink-0 whitespace-nowrap"
                >
                  <i className="bi bi-link-45deg text-indigo-500"></i>
                  <span className="hidden md:inline">{t('btn_apply_page')}</span>
                  <i className="bi bi-chevron-down text-[10px] text-slate-400"></i>
                </button>
                {showLinkPopover && (
                  <>
                    <div className="fixed inset-0 z-[200]" onClick={() => setShowLinkPopover(false)} />
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-[210] p-4 space-y-3">
                      <div className="text-xs font-black text-slate-700 mb-1">{t('apply_link_title')}</div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('apply_link_language')}</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setLinkLang('ja')}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${linkLang === 'ja' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            {t('apply_link_lang_ja')}
                          </button>
                          <button
                            onClick={() => setLinkLang('en')}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${linkLang === 'en' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            English
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">{t('apply_link_media')}</label>
                        <select
                          value={linkMediaId}
                          onChange={e => setLinkMediaId(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                        >
                          <option value="">{t('apply_link_media_none')}</option>
                          {recruitingMediaList.filter(m => m.isActive).map(m => (
                            <option key={m.id} value={m.id}>{m.nameJa}{m.code ? ` (${m.code})` : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 text-[11px] text-slate-600 font-mono break-all">
                        {buildApplyUrl()}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyApplyLink}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          <i className="bi bi-clipboard"></i>
                          {t('apply_link_copy')}
                        </button>
                        <a
                          href={buildApplyUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                        >
                          <i className="bi bi-box-arrow-up-right"></i>
                          {t('apply_link_open')}
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  fetchJobCategories();
                  setShowManualRegisterModal(true);
                }}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shrink-0 whitespace-nowrap"
              >
                <i className="bi bi-person-plus-fill text-emerald-500"></i>
                <span className="hidden md:inline">{t('btn_manual_register')}</span>
              </button>
              <button
                onClick={() => {
                  fetchJobCategories();
                  setShowJobCatModal(true);
                }}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shrink-0 whitespace-nowrap"
              >
                <i className="bi bi-tags-fill text-violet-500"></i>
                <span className="hidden md:inline">{t('btn_job_category_master')}</span>
              </button>
              <a
                href="/settings?tab=interviewSlot"
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shrink-0 whitespace-nowrap"
              >
                <i className="bi bi-gear-fill text-slate-400"></i>
                <span className="hidden md:inline">{t('btn_slot_settings')}</span>
              </a>
            </div>
          </div>

          {/* ── TAB 1: カレンダー ── */}
          {activeTab === 'calendar' && (
            <div className="p-3 md:p-6">
              {/* Master filter dropdown */}
              <div className="mb-4 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500">{t('filter_master')}:</label>
                <select
                  value={filterMasterId}
                  onChange={(e) => setFilterMasterId(e.target.value ? Number(e.target.value) : '')}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">{t('all_masters')}</option>
                  {slotMasters.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              {calendarLoading && slots.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">{t('calendar_loading')}</span>
                  </div>
                </div>
              ) : (
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="timeGridWeek"
                  locale="ja"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek',
                  }}
                  buttonText={{
                    today: t('calendar_today'),
                    month: t('calendar_month'),
                    week: t('calendar_week'),
                  }}
                  events={calendarEvents}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  datesSet={handleDatesSet}
                  slotMinTime={slotMinTime}
                  slotMaxTime={slotMaxTime}
                  allDaySlot={false}
                  height="auto"
                  dayMaxEvents={4}
                  eventDisplay="block"
                  nowIndicator={true}
                  eventContent={(arg) => {
                    const { interviewerName } = arg.event.extendedProps;
                    return (
                      <div className="p-0.5 overflow-hidden text-xs leading-tight">
                        <div className="font-semibold truncate">{arg.event.title}</div>
                        {interviewerName && (
                          <div className="text-[10px] opacity-80 truncate">{interviewerName}</div>
                        )}
                      </div>
                    );
                  }}
                />
              )}
            </div>
          )}

          {/* ── TAB 2: 応募者一覧 ── */}
          {activeTab === 'list' && (
            <div>
              {/* フィルター */}
              <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-50/50">
                <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
                  <div className="w-full md:flex-1 md:min-w-[240px]">
                    <div className="relative">
                      <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                      <input
                        type="text"
                        placeholder={t('list_search_placeholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-1 md:flex-none">
                    <select
                      value={filterFlowStatus}
                      onChange={e => setFilterFlowStatus(e.target.value)}
                      className="flex-1 md:flex-none border border-slate-200 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                    >
                      <option value="">{t('list_filter_flow_all')}</option>
                      <option value="INTERVIEW_WAITING">{t('flow_interview_waiting')}</option>
                      <option value="NO_SHOW">{t('flow_no_show')}</option>
                      <option value="TRAINING_WAITING">{t('flow_training_waiting')}</option>
                      <option value="TRAINING_COMPLETED">{t('flow_training_completed')}</option>
                    </select>
                    <select
                      value={filterHiringStatus}
                      onChange={e => setFilterHiringStatus(e.target.value)}
                      className="flex-1 md:flex-none border border-slate-200 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                    >
                      <option value="">{t('list_filter_hiring_all')}</option>
                      <option value="IN_PROGRESS">{t('hiring_in_progress')}</option>
                      <option value="HIRED">{t('hiring_hired')}</option>
                      <option value="REJECTED">{t('hiring_rejected')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Desktop テーブル */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('th_name')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('th_email')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('th_job_category')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('th_interview_date')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('th_flow')}</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('th_hiring_status')}</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('th_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-slate-100 rounded animate-pulse"></div>
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : applicants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <i className="bi bi-person-x text-4xl"></i>
                            <p className="text-sm font-medium">{t('no_applicants')}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      applicants.map(app => {
                        const flow = FLOW_STATUS_MAP[app.flowStatus];
                        const hiring = HIRING_STATUS_MAP[app.hiringStatus];
                        return (
                          <tr
                            key={app.id}
                            onClick={() => openEvalModal(app.id)}
                            className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold text-slate-800">{app.name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-slate-600">{app.email}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-slate-600">{app.jobCategory?.nameJa || '-'}</span>
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                const slot = getApplicantInterviewSlot(app);
                                return slot ? (
                                  <span className="text-sm text-slate-600">
                                    {new Date(slot.startTime).toLocaleString('ja-JP', {
                                      month: 'numeric',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">{t('interview_unset')}</span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              {flow && (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${flow.color}`}>
                                  {t(flow.labelKey)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {hiring && (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${hiring.color}`}>
                                  {t(hiring.labelKey)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openEvalModal(app.id);
                                }}
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors"
                              >
                                {t('btn_detail')}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile カードレイアウト */}
              <div className="md:hidden">
                {listLoading ? (
                  <div className="p-3 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 animate-pulse">
                        <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                        <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : applicants.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 text-slate-400 py-16">
                    <i className="bi bi-person-x text-4xl"></i>
                    <p className="text-sm font-medium">{t('no_applicants')}</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-3">
                    {applicants.map(app => {
                      const flow = FLOW_STATUS_MAP[app.flowStatus];
                      const hiring = HIRING_STATUS_MAP[app.hiringStatus];
                      const slot = getApplicantInterviewSlot(app);
                      return (
                        <div
                          key={app.id}
                          onClick={() => openEvalModal(app.id)}
                          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-sm text-slate-800 truncate mr-2">{app.name}</span>
                            <div className="flex gap-1 shrink-0">
                              {flow && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${flow.color}`}>
                                  {t(flow.labelKey)}
                                </span>
                              )}
                              {hiring && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${hiring.color}`}>
                                  {t(hiring.labelKey)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 truncate mb-1">{app.email}</div>
                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span className="truncate">{app.jobCategory?.nameJa || '-'}</span>
                            {slot && (
                              <span className="text-slate-400 shrink-0">
                                <i className="bi bi-calendar3 mr-0.5"></i>
                                {new Date(slot.startTime).toLocaleString('ja-JP', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ページネーション */}
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={LIMIT}
                onPageChange={p => fetchApplicants(p)}
              />
            </div>
          )}

          {/* ── TAB 3: 研修管理 ── */}
          {activeTab === 'training' && (
            <div>
              {/* ツールバー */}
              <div className="p-3 md:p-4 border-b border-slate-200 bg-slate-50/50">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/training-slots/generate', { method: 'POST' });
                        const data = await res.json();
                        if (res.ok) {
                          showToast(data.message || t('training_generated'), 'success');
                          fetchTrainingMgmt();
                        } else {
                          showToast(data.error || t('training_generate_failed'), 'error');
                        }
                      } catch { showToast(t('error_occurred'), 'error'); }
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs md:text-sm font-bold hover:bg-indigo-700 transition-colors self-start"
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                    {t('training_generate_now')}
                  </button>
                  {/* 凡例 */}
                  <div className="flex items-center gap-2 md:gap-3 md:ml-auto text-[10px] md:text-xs text-slate-500 overflow-x-auto scrollbar-hide">
                    <span className="flex items-center gap-1 shrink-0"><span className="w-3 h-3 rounded-sm bg-slate-400 inline-block"></span>{t('training_legend_empty')}</span>
                    <span className="flex items-center gap-1 shrink-0"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block"></span>{t('training_legend_booked')}</span>
                    <span className="flex items-center gap-1 shrink-0"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"></span>{t('training_legend_few')}</span>
                    <span className="flex items-center gap-1 shrink-0"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>{t('training_legend_full')}</span>
                    <span className="flex items-center gap-1 shrink-0"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>{t('training_legend_done')}</span>
                  </div>
                </div>
              </div>

              {/* カレンダー */}
              <div className="p-3 md:p-6">
                {trainingMgmtLoading && trainingMgmtSlots.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">{t('calendar_loading')}</span>
                    </div>
                  </div>
                ) : (
                  <FullCalendar
                    ref={trainingCalendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    locale="ja"
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: 'dayGridMonth,timeGridWeek',
                    }}
                    buttonText={{ today: t('calendar_today'), month: t('calendar_month'), week: t('calendar_week') }}
                    events={trainingCalendarEvents}
                    eventClick={handleTrainingEventClick}
                    datesSet={handleTrainingDatesSet}
                    slotMinTime="08:00:00"
                    slotMaxTime="23:00:00"
                    allDaySlot={false}
                    height="auto"
                    nowIndicator={true}
                    eventContent={(arg) => {
                      const slot = arg.event.extendedProps.slot as TrainingSlotManagement;
                      const fillRate = slot.capacity > 0 ? (slot.bookedCount / slot.capacity) * 100 : 0;
                      return (
                        <div className="px-1 py-0.5 overflow-hidden h-full flex flex-col gap-0.5 cursor-pointer">
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-[11px] font-bold truncate">{arg.timeText}</div>
                            <div className="text-[11px] shrink-0 opacity-90">{slot.bookedCount}/{slot.capacity}{t('training_persons')}</div>
                          </div>
                          {slot.location && <div className="text-[10px] truncate opacity-80"><i className="bi bi-geo-alt mr-0.5"></i>{slot.location}</div>}
                          {slot.capacity > 0 && (
                            <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                              <div className="h-full bg-white/80 rounded-full" style={{ width: `${Math.min(fillRate, 100)}%` }}></div>
                            </div>
                          )}
                          {slot.applicants.length > 0 && (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              {slot.applicants.map(app => {
                                const isDone = app.flowStatus === 'TRAINING_COMPLETED';
                                return (
                                  <div key={app.id} className={`text-[10px] truncate px-1 py-0.5 rounded bg-white/20 leading-tight ${isDone ? 'opacity-60 line-through' : ''}`}>
                                    {isDone && <span className="mr-0.5">✓</span>}{app.name}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          モーダル: 研修スロット詳細
         ════════════════════════════════════════════ */}
      {selectedTrainingSlot && (() => {
        const slot = selectedTrainingSlot;
        const start = new Date(slot.startTime);
        const end = new Date(slot.endTime);
        const fillRate = slot.capacity > 0 ? (slot.bookedCount / slot.capacity) * 100 : 0;
        const canDelete = slot.bookedCount === 0;
        return (
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-4">
            <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-[85vh]">
              {/* Mobile drag handle */}
              <div className="md:hidden flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>
              {/* ヘッダー */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <i className="bi bi-mortarboard-fill text-indigo-600"></i>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">
                      {start.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 〜 {end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      {slot.location && <span className="ml-2"><i className="bi bi-geo-alt mr-0.5"></i>{slot.location}</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeTrainingSlotPanel}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <i className="bi bi-x-lg text-lg"></i>
                </button>
              </div>

              {/* ボディ */}
              <div className="overflow-y-auto flex-1">
                {/* 定員設定 */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-500 mb-2">{t('training_slot_capacity')}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditCapacity(v => Math.max(1, v - 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors font-bold"
                    >
                      <i className="bi bi-dash text-sm"></i>
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={editCapacity}
                      onChange={e => setEditCapacity(Math.max(1, Math.min(100, Number(e.target.value))))}
                      className="w-16 text-center border border-slate-200 rounded-lg py-1.5 text-sm font-bold focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    />
                    <button
                      onClick={() => setEditCapacity(v => Math.min(100, v + 1))}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors font-bold"
                    >
                      <i className="bi bi-plus text-sm"></i>
                    </button>
                    <span className="text-sm text-slate-500">{t('training_slot_capacity_unit')}</span>
                    <button
                      onClick={handleSaveCapacity}
                      disabled={savingCapacity || editCapacity === slot.capacity}
                      className="ml-auto flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {savingCapacity ? (
                        <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                      ) : (
                        <i className="bi bi-check2"></i>
                      )}
                      {t('eval_btn_save')}
                    </button>
                  </div>
                  {/* 埋まり具合バー */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${fillRate >= 100 ? 'bg-rose-500' : fillRate >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(fillRate, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 shrink-0">
                      {slot.bookedCount}/{slot.capacity}{t('training_slot_capacity_unit')}
                    </span>
                  </div>
                </div>

                {/* 参加者リスト */}
                <div className="px-6 py-4">
                  <div className="text-xs font-bold text-slate-500 mb-2">{t('training_slot_participants')}</div>
                  {slot.applicants.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">{t('training_slot_no_participants')}</p>
                  ) : (
                    <div className="space-y-2">
                      {slot.applicants.map(app => {
                        const flow = FLOW_STATUS_MAP[app.flowStatus];
                        const hiring = HIRING_STATUS_MAP[app.hiringStatus];
                        const isCompleted = app.flowStatus === 'TRAINING_COMPLETED';
                        const isEvalOpen = trainingEvalTargetId === app.id;
                        const isNoShow = app.trainingAttendance === 'NO_SHOW';
                        const isExpanded = expandedTrainingApplicantId === app.id;
                        return (
                          <div key={app.id}>
                            <div
                              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${isNoShow ? 'bg-rose-50 hover:bg-rose-100/60' : isCompleted ? 'bg-emerald-50 hover:bg-emerald-100/60' : 'bg-slate-50 hover:bg-slate-100'}`}
                              onClick={() => setExpandedTrainingApplicantId(isExpanded ? null : app.id)}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${isNoShow ? 'bg-rose-100 text-rose-600' : isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'}`}>
                                  <i className={`bi ${isNoShow ? 'bi-x-lg' : isCompleted ? 'bi-check-lg' : 'bi-person'}`}></i>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-bold text-slate-800 truncate">{app.name}</span>
                                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-slate-400`}></i>
                                  </div>
                                  {app.phone && <div className="text-xs text-slate-400">{app.phone}</div>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                  {app.registeredDistributorId ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                      <i className="bi bi-person-badge mr-0.5"></i>{t('training_slot_distributor_registered')}
                                    </span>
                                  ) : null}
                                  {isNoShow ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">NO SHOW</span>
                                  ) : flow && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${flow.color}`}>
                                      {t(flow.labelKey)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isCompleted ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); isEvalOpen ? setTrainingEvalTargetId(null) : handleOpenTrainingEval(app); }}
                                  className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors shrink-0 ml-2"
                                  title={t('training_slot_edit_eval')}
                                >
                                  <i className={`bi ${isEvalOpen ? 'bi-chevron-up' : 'bi-pencil-square'}`}></i>
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenTrainingEval(app); }}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    <i className="bi bi-clipboard-check"></i>
                                    {t('training_slot_eval_complete')}
                                  </button>
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setTrainingActionMenuId(trainingActionMenuId === app.id ? null : app.id); }}
                                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                      title={t('training_slot_action')}
                                    >
                                      <i className="bi bi-three-dots-vertical text-sm"></i>
                                    </button>
                                    {trainingActionMenuId === app.id && (
                                      <>
                                        <div className="fixed inset-0 z-[200]" onClick={() => setTrainingActionMenuId(null)} />
                                        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-[210] py-1 overflow-hidden">
                                          <button
                                            onClick={() => {
                                              setTrainingActionMenuId(null);
                                              setTrainingRescheduleTargetId(app.id);
                                              setTrainingRescheduleMode('direct');
                                              setCalendarNewTrainingSlotId(null);
                                              fetchTrainingSlots();
                                            }}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                                          >
                                            <i className="bi bi-calendar2-event text-indigo-500"></i>
                                            {t('training_slot_reschedule')}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setTrainingActionMenuId(null);
                                              handleSendTrainingRescheduleEmail(app.id, app.name);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-left"
                                          >
                                            <i className="bi bi-envelope text-amber-500"></i>
                                            {t('training_slot_reschedule_email')}
                                          </button>
                                          <div className="border-t border-slate-100 my-1"></div>
                                          <button
                                            onClick={() => {
                                              setTrainingActionMenuId(null);
                                              handleCancelTrainingFromModal(app.id, app.name);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                                          >
                                            <i className="bi bi-x-circle text-rose-500"></i>
                                            {t('training_slot_cancel')}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 展開: 応募者詳細情報 */}
                            {isExpanded && (
                              <div className="mt-1 px-3 py-3 rounded-lg border border-slate-200 bg-white space-y-2">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                  <div>
                                    <span className="text-slate-400">{t('training_detail_email')}</span>
                                    <p className="text-slate-700 font-medium truncate">{app.email || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">{t('training_detail_phone')}</span>
                                    <p className="text-slate-700 font-medium">{app.phone || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">{t('training_detail_country')}</span>
                                    <p className="text-slate-700 font-medium">{app.countryName || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">{t('training_detail_job')}</span>
                                    <p className="text-slate-700 font-medium">{app.jobCategoryName || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">{t('training_detail_hiring')}</span>
                                    {hiring && <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${hiring.color}`}>{t(hiring.labelKey)}</span>}
                                  </div>
                                  <div>
                                    <span className="text-slate-400">{t('training_detail_distributor')}</span>
                                    <p className="text-slate-700 font-medium">
                                      {app.registeredDistributorId
                                        ? <span className="text-indigo-600 font-bold">ID: {app.registeredDistributorId}</span>
                                        : <span className="text-slate-400">{t('training_detail_not_registered')}</span>}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeTrainingSlotPanel();
                                    openEvalModal(app.id, slot.id);
                                  }}
                                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors mt-1"
                                >
                                  <i className="bi bi-box-arrow-up-right"></i>
                                  {t('training_detail_open')}
                                </button>
                              </div>
                            )}

                            {/* 研修評価フォーム（インライン展開） */}
                            {isEvalOpen && (
                              <div className="mt-1 p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-4">
                                {/* 出欠 */}
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('training_eval_attendance')}</label>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setTrainingEvalForm(f => ({ ...f, attendance: 'ATTENDED' }))}
                                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                                        trainingEvalForm.attendance === 'ATTENDED'
                                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                      }`}
                                    >
                                      <i className="bi bi-check-circle"></i>
                                      {t('training_eval_attended')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setTrainingEvalForm(f => ({ ...f, attendance: 'NO_SHOW' }))}
                                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                                        trainingEvalForm.attendance === 'NO_SHOW'
                                          ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                                          : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                                      }`}
                                    >
                                      <i className="bi bi-x-circle"></i>
                                      {t('training_eval_absent')}
                                    </button>
                                  </div>
                                </div>

                                {/* 評価項目（出席時のみ） */}
                                {trainingEvalForm.attendance === 'ATTENDED' && (
                                  <div className="space-y-3">
                                    <ScoreSelector label={t('training_eval_understanding')} lowLabel={t('score_low')} highLabel={t('score_high')} value={trainingEvalForm.understandingScore} onChange={v => setTrainingEvalForm(f => ({ ...f, understandingScore: v }))} />
                                    <ScoreSelector label={t('training_eval_communication')} lowLabel={t('score_low')} highLabel={t('score_high')} value={trainingEvalForm.communicationScore} onChange={v => setTrainingEvalForm(f => ({ ...f, communicationScore: v }))} />
                                    <ScoreSelector label={t('training_eval_speed')} lowLabel={t('score_low')} highLabel={t('score_high')} value={trainingEvalForm.speedScore} onChange={v => setTrainingEvalForm(f => ({ ...f, speedScore: v }))} />
                                    <ScoreSelector label={t('training_eval_motivation')} lowLabel={t('score_low')} highLabel={t('score_high')} value={trainingEvalForm.motivationScore} onChange={v => setTrainingEvalForm(f => ({ ...f, motivationScore: v }))} />
                                  </div>
                                )}

                                {/* メモ */}
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('training_eval_notes')}</label>
                                  <textarea
                                    value={trainingEvalForm.notes}
                                    onChange={e => setTrainingEvalForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={2}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white resize-none"
                                    placeholder={t('training_eval_notes_placeholder')}
                                  />
                                </div>

                                {/* 保存 */}
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setTrainingEvalTargetId(null)}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                                  >
                                    {t('cancel')}
                                  </button>
                                  <button
                                    onClick={handleSaveTrainingEval}
                                    disabled={trainingEvalSaving || !trainingEvalForm.attendance}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {trainingEvalSaving ? (
                                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    ) : (
                                      <i className="bi bi-check2"></i>
                                    )}
                                    {isCompleted ? t('training_eval_update') : t('training_eval_save_complete')}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 完了済みの評価サマリー（フォームが閉じている時） */}
                            {isCompleted && !isEvalOpen && (app.trainingUnderstandingScore || app.trainingAttendance === 'NO_SHOW') && (
                              <div className={`mt-1 px-3 py-2 rounded-lg text-xs ${isNoShow ? 'bg-rose-50/50' : 'bg-emerald-50/50'}`}>
                                {isNoShow ? (
                                  <span className="text-rose-600 font-bold">NO SHOW</span>
                                ) : (
                                  <div className="flex items-center gap-3 text-slate-500">
                                    <span>{t('training_eval_summary_understanding')}: <b className="text-slate-700">{app.trainingUnderstandingScore}</b></span>
                                    <span>{t('training_eval_summary_communication')}: <b className="text-slate-700">{app.trainingCommunicationScore}</b></span>
                                    <span>{t('training_eval_summary_speed')}: <b className="text-slate-700">{app.trainingSpeedScore}</b></span>
                                    <span>{t('training_eval_summary_motivation')}: <b className="text-slate-700">{app.trainingMotivationScore}</b></span>
                                  </div>
                                )}
                                {app.trainingNotes && <div className="text-slate-400 mt-0.5 truncate">{app.trainingNotes}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 日程変更パネル */}
              {trainingRescheduleTargetId && trainingRescheduleMode === 'direct' && (() => {
                const targetApp = slot.applicants.find((a: any) => a.id === trainingRescheduleTargetId);
                if (!targetApp) return null;
                const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
                return (
                  <div className="px-6 py-4 border-t border-indigo-200 bg-indigo-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-black text-indigo-700">
                        <i className="bi bi-calendar2-event mr-1"></i>
                        {targetApp.name}{t('training_reschedule_title')}
                      </div>
                      <button
                        onClick={() => { setTrainingRescheduleTargetId(null); setTrainingRescheduleMode(null); }}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                    {trainingSlots.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">{t('training_reschedule_no_slots')}</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {trainingSlots.map(ts => {
                          const s = new Date(ts.startTime);
                          const e = new Date(ts.endTime);
                          const dateLabel = `${s.getMonth() + 1}/${s.getDate()}(${WEEKDAYS[s.getDay()]})`;
                          const timeLabel = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')} - ${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
                          const isCurrent = slot.id === ts.id;
                          return (
                            <button
                              key={ts.id}
                              onClick={() => setCalendarNewTrainingSlotId(ts.id)}
                              disabled={isCurrent}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors ${
                                calendarNewTrainingSlotId === ts.id
                                  ? 'bg-indigo-100 border-indigo-400 text-indigo-800 font-bold'
                                  : isCurrent
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                              }`}
                            >
                              <span>{dateLabel} {timeLabel} {ts.location ? `@ ${ts.location}` : ''}</span>
                              <span className="text-[10px] text-slate-400">{t('training_reschedule_remaining', { remaining: ts.remainingCapacity, capacity: ts.capacity })}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => handleCalendarTrainingReschedule(trainingRescheduleTargetId)}
                      disabled={!calendarNewTrainingSlotId || calendarRescheduleLoading}
                      className="mt-3 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {calendarRescheduleLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <i className="bi bi-check2"></i>
                      )}
                      {t('training_reschedule_confirm')}
                    </button>
                  </div>
                );
              })()}

              {/* フッター */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                {canDelete ? (
                  <button
                    onClick={handleDeleteTrainingSlot}
                    disabled={deletingSlot}
                    className="w-full flex items-center justify-center gap-2 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingSlot ? (
                      <span className="w-4 h-4 border border-rose-500 border-t-transparent rounded-full animate-spin inline-block"></span>
                    ) : (
                      <i className="bi bi-trash3"></i>
                    )}
                    {t('training_slot_delete_btn')}
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 text-center">
                    <i className="bi bi-info-circle mr-1"></i>
                    {t('training_slot_delete_disabled')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════
          モーダル: スロット作成
         ════════════════════════════════════════════ */}
      {showSlotModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-[90vh]">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-calendar-plus text-emerald-600"></i>
                </div>
                <h2 className="text-lg font-black text-slate-800">{t('slot_create_title')}</h2>
              </div>
              <button
                onClick={() => setShowSlotModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>

            {/* ボディ */}
            <div className="p-6 space-y-4">
              {/* 日付 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('slot_create_date')}</label>
                <input
                  type="date"
                  value={slotForm.date}
                  onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                />
              </div>

              {/* 開始・終了時刻 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('slot_create_start')}</label>
                  <select
                    value={slotForm.startHour}
                    onChange={e => setSlotForm(f => ({ ...f, startHour: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 9).map(h => (
                      <option key={h} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('slot_create_end')}</label>
                  <select
                    value={slotForm.endHour}
                    onChange={e => setSlotForm(f => ({ ...f, endHour: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 10).map(h => (
                      <option key={h} value={h}>{h}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 間隔 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('slot_create_interval')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="interval"
                      value={30}
                      checked={slotForm.intervalMinutes === 30}
                      onChange={() => setSlotForm(f => ({ ...f, intervalMinutes: 30 }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">{t('slot_create_30min')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="interval"
                      value={60}
                      checked={slotForm.intervalMinutes === 60}
                      onChange={() => setSlotForm(f => ({ ...f, intervalMinutes: 60 }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">{t('slot_create_60min')}</span>
                  </label>
                </div>
              </div>

              {/* Google Meet URL */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  {t('slot_create_meet_url')} <span className="text-slate-400 font-normal">{t('slot_create_meet_optional')}</span>
                </label>
                <input
                  type="url"
                  value={slotForm.meetUrl}
                  onChange={e => setSlotForm(f => ({ ...f, meetUrl: e.target.value }))}
                  placeholder="https://meet.google.com/xxx-xxx-xxx"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                />
              </div>

              {/* プレビュー */}
              {slotForm.date && slotForm.startHour < slotForm.endHour && (
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-indigo-700">
                    <i className="bi bi-info-circle mr-1.5"></i>
                    {slotForm.date} {slotForm.startHour}:00 〜 {slotForm.endHour}:00 / {slotForm.intervalMinutes}分間隔
                    {t('slot_create_preview', { count: Math.floor((slotForm.endHour - slotForm.startHour) * 60 / slotForm.intervalMinutes) })}
                  </p>
                </div>
              )}
            </div>

            {/* フッター */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowSlotModal(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateSlots}
                disabled={slotCreating}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {slotCreating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {t('slot_create_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          モーダル: 応募者評価
         ════════════════════════════════════════════ */}
      {showEvalModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center md:justify-center bg-black/50 backdrop-blur-sm md:p-4">
          <div className="bg-white w-full h-full md:h-auto md:max-w-4xl rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden md:max-h-[90vh]">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1 sticky top-0 bg-white z-10">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-person-badge text-indigo-600"></i>
                </div>
                {evalLoading ? (
                  <div className="h-6 w-32 bg-slate-100 rounded animate-pulse"></div>
                ) : selectedApplicant ? (
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-black text-slate-800">{selectedApplicant.name}</h2>
                    {FLOW_STATUS_MAP[selectedApplicant.flowStatus] && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${FLOW_STATUS_MAP[selectedApplicant.flowStatus].color}`}>
                        {t(FLOW_STATUS_MAP[selectedApplicant.flowStatus].labelKey)}
                      </span>
                    )}
                    {HIRING_STATUS_MAP[selectedApplicant.hiringStatus] && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${HIRING_STATUS_MAP[selectedApplicant.hiringStatus].color}`}>
                        {t(HIRING_STATUS_MAP[selectedApplicant.hiringStatus].labelKey)}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              <button
                onClick={closeEvalModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>

            {/* ボディ (スクロール可) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {evalLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">{t('loading')}</span>
                  </div>
                </div>
              ) : selectedApplicant ? (
                <>
                  {/* セクション 1: 基本情報 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="bi bi-person-fill text-indigo-600"></i>
                      <h3 className="text-sm font-black text-slate-800">{t('eval_section_basic')}</h3>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      {/* 個人情報 */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_name')}</p>
                          <input
                            type="text"
                            value={evalForm.name}
                            onChange={e => setEvalForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          />
                        </div>
                        <div>
                          <p className={`text-xs font-bold mb-0.5 ${!evalForm.birthday ? 'text-red-500' : 'text-slate-400'}`}>
                            {t('eval_birthday')}{!evalForm.birthday && <span className="ml-1 text-[10px] font-medium">{t('eval_birthday_required')}</span>}
                          </p>
                          <input
                            type="date"
                            value={evalForm.birthday}
                            onChange={e => setEvalForm(f => ({ ...f, birthday: e.target.value }))}
                            className={`w-full text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white border ${!evalForm.birthday ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <p className={`text-xs font-bold mb-0.5 ${!evalForm.gender ? 'text-red-500' : 'text-slate-400'}`}>
                            {t('eval_gender')}{!evalForm.gender && <span className="ml-1 text-[10px] font-medium">{t('eval_gender_required')}</span>}
                          </p>
                          <select
                            value={evalForm.gender}
                            onChange={e => setEvalForm(f => ({ ...f, gender: e.target.value }))}
                            className={`w-full text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white border ${!evalForm.gender ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200'}`}
                          >
                            <option value="">{t('eval_gender_unset')}</option>
                            <option value="male">{t('eval_gender_male')}</option>
                            <option value="female">{t('eval_gender_female')}</option>
                            <option value="other">{t('eval_gender_other')}</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 my-3" />

                      {/* 連絡先 */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div className="col-span-1">
                          <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_email')}</p>
                          <input
                            type="email"
                            value={evalForm.email}
                            onChange={e => setEvalForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_phone')}</p>
                          <input
                            type="tel"
                            value={evalForm.phone}
                            onChange={e => handlePhoneChange(e.target.value, v => setEvalForm(f => ({ ...f, phone: v })))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                            placeholder="090-0000-0000"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_language')}</p>
                          <select
                            value={evalForm.language}
                            onChange={e => setEvalForm(f => ({ ...f, language: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          >
                            <option value="ja">{t('eval_language_ja')}</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 my-3" />

                      {/* 応募情報 */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_job_category')}</p>
                          <select
                            value={evalForm.jobCategoryId}
                            onChange={e => setEvalForm(f => ({ ...f, jobCategoryId: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          >
                            <option value="">{t('eval_select_placeholder')}</option>
                            {jobCategories.filter(jc => jc.isActive).map(jc => (
                              <option key={jc.id} value={jc.id}>{jc.nameJa}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_recruiting_media')}</p>
                          <select
                            value={evalForm.recruitingMediaId}
                            onChange={e => setEvalForm(f => ({ ...f, recruitingMediaId: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                          >
                            <option value="">{t('eval_recruiting_unset')}</option>
                            {recruitingMediaList.map(m => (
                              <option key={m.id} value={m.id}>{m.nameJa}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 my-3" />

                      {/* 面接情報 */}
                      {(() => {
                        const evalSlot = getApplicantInterviewSlot(selectedApplicant);
                        return (
                          <>
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                              <div>
                                <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_interview_date')}</p>
                                {evalSlot ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm text-slate-700">
                                      {new Date(evalSlot.startTime).toLocaleString('ja-JP', {
                                        year: 'numeric',
                                        month: 'numeric',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                    {evalSlot.meetUrl && (() => {
                                      const slotMaster = evalSlot.interviewSlotMaster;
                                      const isZoom = slotMaster?.meetingType === 'ZOOM';
                                      return (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <a
                                            href={evalSlot.meetUrl!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`inline-flex items-center gap-1 text-xs font-medium hover:underline transition-colors ${
                                              isZoom ? 'text-violet-500 hover:text-violet-700' : 'text-blue-500 hover:text-blue-700'
                                            }`}
                                          >
                                            <i className="bi bi-camera-video text-xs"></i>
                                            {isZoom ? 'Zoom' : 'Meet'}
                                          </a>
                                          {isZoom && slotMaster?.zoomMeetingNumber && (
                                            <span className="text-[10px] text-slate-400">
                                              ID: {slotMaster.zoomMeetingNumber}
                                              {slotMaster.zoomPassword && ` / PW: ${slotMaster.zoomPassword}`}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-400">{t('interview_unset')}</p>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-400 mb-0.5">{t('eval_interviewer')}</p>
                                {evalSlot ? (
                                  <select
                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                                    value={evalSlot.interviewer?.id || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleChangeInterviewer(val ? Number(val) : null);
                                    }}
                                  >
                                    <option value="">{t('eval_interviewer_unset')}</option>
                                    {interviewerEmployees.map((emp) => (
                                      <option key={emp.id} value={emp.id}>
                                        {emp.lastNameJa} {emp.firstNameJa}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <p className="text-sm text-slate-400">{t('eval_interview_not_booked')}</p>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}

                      {/* 面接操作ボタン */}
                      {(getApplicantInterviewSlot(selectedApplicant)) && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => openReschedulePanel()}
                            className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1"
                          >
                            <i className="bi bi-calendar-plus"></i>{t('eval_reschedule')}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelInterview}
                            className="text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 transition-colors inline-flex items-center gap-1"
                          >
                            <i className="bi bi-x-circle"></i>{t('eval_cancel_interview')}
                          </button>
                          {selectedApplicant.flowStatus !== 'NO_SHOW' && (
                            <button
                              type="button"
                              onClick={handleNoShow}
                              className="text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-200 transition-colors inline-flex items-center gap-1"
                            >
                              <i className="bi bi-person-x"></i>NO SHOW
                            </button>
                          )}
                        </div>
                      )}

                      {/* 面接案内メール送信（未予約時） */}
                      {!getApplicantInterviewSlot(selectedApplicant) && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={handleSendInterviewInvitation}
                            disabled={sendingInvitation}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingInvitation ? (
                              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block"></span>
                            ) : (
                              <i className="bi bi-envelope-fill"></i>
                            )}
                            {t('eval_send_invitation')}
                          </button>
                        </div>
                      )}

                      {/* 日程変更パネル */}
                      {showReschedulePanel && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-black text-indigo-700">{t('eval_reschedule_title')}</h4>
                            <button type="button" onClick={() => setShowReschedulePanel(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                          {rescheduleLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : availableSlots.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">{t('eval_reschedule_no_slots')}</p>
                          ) : (
                            <>
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {availableSlots.map(slot => {
                                  const d = new Date(slot.startTime);
                                  const dateStr = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
                                  const timeStr = `${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => setSelectedNewSlotId(slot.id)}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                        selectedNewSlotId === slot.id
                                          ? 'bg-indigo-100 border-indigo-300 border text-indigo-800 font-bold'
                                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="font-bold">{dateStr}</span> {timeStr}
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={handleReschedule}
                                disabled={!selectedNewSlotId || rescheduleLoading}
                                className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                              >
                                {rescheduleLoading ? t('eval_reschedule_changing') : t('eval_reschedule_confirm')}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* セクション 2: 国籍・在留資格・住所 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="bi bi-geo-alt-fill text-indigo-600"></i>
                      <h3 className="text-sm font-black text-slate-800">{t('eval_section_nationality')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-bold mb-1.5 ${!evalForm.countryId ? 'text-red-500' : 'text-slate-500'}`}>
                          {t('eval_country')}{!evalForm.countryId && <span className="ml-1 text-[10px] font-medium">{t('eval_country_required')}</span>}
                        </label>
                        <SearchableSelect
                          options={countries}
                          value={String(evalForm.countryId || '')}
                          onChange={(v) => setEvalForm(f => ({ ...f, countryId: v }))}
                          getOptionValue={(c) => String(c.id)}
                          getOptionLabel={(c) => `${c.name}（${c.nameEn}）`}
                          placeholder={t('eval_select_placeholder')}
                          searchPlaceholder={t('eval_country_search')}
                          noResultsText={t('eval_country_no_results')}
                          error={!evalForm.countryId}
                          filterFn={(c, search) => {
                            const s = search.toLowerCase();
                            return c.name.toLowerCase().includes(s) || c.nameEn.toLowerCase().includes(s);
                          }}
                        />
                      </div>

                      {!isJapanese(evalForm.countryId) && (
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${!evalForm.visaTypeId ? 'text-red-500' : 'text-slate-500'}`}>
                            {t('eval_visa_type')}{!evalForm.visaTypeId && <span className="ml-1 text-[10px] font-medium">{t('eval_visa_required')}</span>}
                          </label>
                          <select
                            value={evalForm.visaTypeId}
                            onChange={e => setEvalForm(f => ({ ...f, visaTypeId: e.target.value }))}
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white border ${!evalForm.visaTypeId ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200'}`}
                          >
                            <option value="">{t('eval_select_placeholder')}</option>
                            {visaTypes.map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_postal_code')}</label>
                        <input
                          type="text"
                          value={evalForm.postalCode}
                          onChange={e => setEvalForm(f => ({ ...f, postalCode: e.target.value }))}
                          placeholder="123-4567"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_address')}</label>
                        <input
                          type="text"
                          value={evalForm.address}
                          onChange={e => setEvalForm(f => ({ ...f, address: e.target.value }))}
                          placeholder={t('eval_address_placeholder')}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_building')}</label>
                        <input
                          type="text"
                          value={evalForm.building}
                          onChange={e => setEvalForm(f => ({ ...f, building: e.target.value }))}
                          placeholder={t('eval_building_placeholder')}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* セクション 3: 面接評価 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="bi bi-clipboard-check text-indigo-600"></i>
                      <h3 className="text-sm font-black text-slate-800">{t('eval_section_interview')}</h3>
                    </div>
                    <div className="space-y-4">
                      {/* 他の仕事 */}
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={evalForm.hasOtherJob}
                              onChange={e => setEvalForm(f => ({ ...f, hasOtherJob: e.target.checked }))}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-slate-700">{t('eval_other_job')}</span>
                          </label>
                          {evalForm.hasOtherJob && (
                            <div className="mt-2 ml-6">
                              <input
                                type="text"
                                value={evalForm.otherJobDetails}
                                onChange={e => setEvalForm(f => ({ ...f, otherJobDetails: e.target.value }))}
                                placeholder={t('eval_other_job_details_placeholder')}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 口座 */}
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={evalForm.hasBankInJapan}
                            onChange={e => setEvalForm(f => ({ ...f, hasBankInJapan: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-bold text-slate-700">{t('eval_bank_account')}</span>
                        </label>
                      </div>

                      {/* スコア */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ScoreSelector
                          label={t('eval_score_japanese')}
                          lowLabel={t('score_low')}
                          highLabel={t('score_high')}
                          value={evalForm.japaneseLevel}
                          onChange={v => setEvalForm(f => ({ ...f, japaneseLevel: v }))}
                        />
                        <ScoreSelector
                          label={t('eval_score_english')}
                          lowLabel={t('score_low')}
                          highLabel={t('score_high')}
                          value={evalForm.englishLevel}
                          onChange={v => setEvalForm(f => ({ ...f, englishLevel: v }))}
                        />
                        <ScoreSelector
                          label={t('eval_score_communication')}
                          lowLabel={t('score_low')}
                          highLabel={t('score_high')}
                          value={evalForm.communicationScore}
                          onChange={v => setEvalForm(f => ({ ...f, communicationScore: v }))}
                        />
                        <ScoreSelector
                          label={t('eval_score_impression')}
                          lowLabel={t('score_low')}
                          highLabel={t('score_high')}
                          value={evalForm.impressionScore}
                          onChange={v => setEvalForm(f => ({ ...f, impressionScore: v }))}
                        />
                      </div>

                      {/* 備考 */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_interview_notes')}</label>
                        <textarea
                          value={evalForm.interviewNotes}
                          onChange={e => setEvalForm(f => ({ ...f, interviewNotes: e.target.value }))}
                          rows={3}
                          placeholder={t('eval_interview_notes_placeholder')}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* セクション 4: ステータス変更 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="bi bi-arrow-left-right text-indigo-600"></i>
                      <h3 className="text-sm font-black text-slate-800">{t('eval_section_status')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_flow_status')}</label>
                        <select
                          value={evalForm.flowStatus}
                          onChange={e => setEvalForm(f => ({ ...f, flowStatus: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        >
                          <option value="INTERVIEW_WAITING">{t('flow_interview_waiting')}</option>
                          <option value="NO_SHOW">{t('flow_no_show')}</option>
                          <option value="TRAINING_WAITING">{t('flow_training_waiting')}</option>
                          <option value="TRAINING_COMPLETED">{t('flow_training_completed')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_hiring_status')}</label>
                        <select
                          value={evalForm.hiringStatus}
                          onChange={e => {
                            setEvalForm(f => ({ ...f, hiringStatus: e.target.value }));
                            if (e.target.value === 'HIRED' && trainingSlots.length === 0 && !loadingTrainingSlots) {
                              fetchTrainingSlots();
                            }
                          }}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        >
                          <option value="IN_PROGRESS">{t('hiring_in_progress')}</option>
                          <option value="HIRED">{t('hiring_hired')}</option>
                          <option value="REJECTED">{t('hiring_rejected')}</option>
                        </select>
                      </div>
                    </div>

                    {/* 採用警告 */}
                    {evalForm.hiringStatus === 'HIRED' && selectedApplicant.hiringStatus !== 'HIRED' && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                        <i className="bi bi-exclamation-triangle-fill text-amber-500 mt-0.5"></i>
                        <p className="text-xs font-bold text-amber-700">
                          {t('eval_hiring_notification')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* セクション 5: 研修スロット設定（採用時のみ） */}
                  {evalForm.hiringStatus === 'HIRED' && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <i className="bi bi-mortarboard text-indigo-600"></i>
                        <h3 className="text-sm font-black text-slate-800">{t('eval_section_training')}</h3>
                      </div>

                      {/* 既に研修スロットが設定済みの場合 */}
                      {selectedApplicant.trainingSlot ? (
                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                          <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                                <i className="bi bi-check-circle-fill text-emerald-500"></i>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-emerald-700 mb-1">{t('eval_training_confirmed')}</p>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <i className="bi bi-calendar-event text-slate-400 text-xs"></i>
                                    <p className="text-sm font-bold text-slate-800">
                                      {new Date(selectedApplicant.trainingSlot.startTime).toLocaleDateString('ja-JP', {
                                        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                                      })}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <i className="bi bi-clock text-slate-400 text-xs"></i>
                                    <p className="text-sm text-slate-700">
                                      {new Date(selectedApplicant.trainingSlot.startTime).toLocaleTimeString('ja-JP', {
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                      {' 〜 '}
                                      {new Date(selectedApplicant.trainingSlot.endTime).toLocaleTimeString('ja-JP', {
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                    </p>
                                  </div>
                                  {selectedApplicant.trainingSlot.location && (
                                    <div className="flex items-center gap-2">
                                      <i className="bi bi-geo-alt text-slate-400 text-xs"></i>
                                      <p className="text-sm text-slate-700">{selectedApplicant.trainingSlot.location}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowTrainingReschedulePanel(true);
                                  setSelectedNewTrainingSlotId(null);
                                  setTrainingRescheduleLoading(true);
                                  fetch('/api/training-slots/available')
                                    .then(r => r.json())
                                    .then(data => setAvailableTrainingSlots(data.slots || []))
                                    .catch(() => setAvailableTrainingSlots([]))
                                    .finally(() => setTrainingRescheduleLoading(false));
                                }}
                                className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1"
                              >
                                <i className="bi bi-calendar-plus"></i>{t('eval_training_reschedule')}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelTraining}
                                className="text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 transition-colors inline-flex items-center gap-1"
                              >
                                <i className="bi bi-x-circle"></i>{t('eval_training_cancel')}
                              </button>
                            </div>

                            {/* 研修日程変更パネル */}
                            {showTrainingReschedulePanel && (
                              <div className="pt-3 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-xs font-black text-indigo-700">{t('eval_training_reschedule_title')}</h4>
                                  <button type="button" onClick={() => setShowTrainingReschedulePanel(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                                    <i className="bi bi-x-lg"></i>
                                  </button>
                                </div>
                                {trainingRescheduleLoading ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                  </div>
                                ) : availableTrainingSlots.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-2">{t('eval_training_no_slots')}</p>
                                ) : (
                                  <>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {availableTrainingSlots
                                        .filter(slot => slot.id !== selectedApplicant?.trainingSlot?.id)
                                        .map(slot => {
                                          const d = new Date(slot.startTime);
                                          const dateStr = d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
                                          const timeStr = `${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
                                          return (
                                            <button
                                              key={slot.id}
                                              type="button"
                                              onClick={() => setSelectedNewTrainingSlotId(slot.id)}
                                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                                                selectedNewTrainingSlotId === slot.id
                                                  ? 'bg-indigo-100 border-indigo-300 border text-indigo-800 font-bold'
                                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                                              }`}
                                            >
                                              <span className="font-bold">{dateStr}</span> {timeStr}
                                              <span className="ml-2 text-[11px] text-slate-400">{t('eval_training_remaining', { remaining: slot.remainingCapacity })}</span>
                                              {slot.location && <span className="ml-2 text-[11px] text-slate-400">{slot.location}</span>}
                                            </button>
                                          );
                                        })}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleTrainingReschedule}
                                      disabled={!selectedNewTrainingSlotId || trainingRescheduleLoading}
                                      className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                                    >
                                      {trainingRescheduleLoading ? t('eval_reschedule_changing') : t('eval_reschedule_confirm')}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                        {/* 案内方法の選択 */}
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="trainingBookingMode"
                              value="now"
                              checked={trainingBookingMode === 'now'}
                              onChange={() => {
                                setTrainingBookingMode('now');
                                if (trainingSlots.length === 0 && !loadingTrainingSlots) {
                                  fetchTrainingSlots();
                                }
                              }}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-slate-700">{t('eval_training_mode_now')}</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="trainingBookingMode"
                              value="later"
                              checked={trainingBookingMode === 'later'}
                              onChange={() => {
                                setTrainingBookingMode('later');
                                setEvalForm(f => ({ ...f, flowStatus: 'TRAINING_WAITING' }));
                              }}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-slate-700">{t('eval_training_mode_later')}</span>
                          </label>
                        </div>

                        {/* 今すぐ指定: カレンダーピッカー */}
                        {trainingBookingMode === 'now' && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">{t('eval_training_select_date')}</label>
                            {loadingTrainingSlots ? (
                              <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                {t('loading')}
                              </div>
                            ) : trainingSlots.length === 0 ? (
                              <p className="text-sm text-slate-400">{t('eval_training_no_available')}</p>
                            ) : (() => {
                              // スロットを日付ごとにグループ化
                              const slotsByDate: Record<string, TrainingSlotOption[]> = {};
                              trainingSlots.forEach(slot => {
                                const key = new Date(slot.startTime).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                if (!slotsByDate[key]) slotsByDate[key] = [];
                                slotsByDate[key].push(slot);
                              });
                              const availableDates = new Set(Object.keys(slotsByDate));

                              // カレンダー生成
                              const { year, month } = calendarViewDate;
                              const firstDay = new Date(year, month, 1).getDay();
                              const daysInMonth = new Date(year, month + 1, 0).getDate();
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);

                              const slotsForSelected = selectedCalendarDate ? (slotsByDate[selectedCalendarDate] || []) : [];

                              return (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                  {/* カレンダーヘッダー */}
                                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                                    <button type="button" onClick={() => setCalendarViewDate(prev => {
                                      const d = new Date(prev.year, prev.month - 1);
                                      return { year: d.getFullYear(), month: d.getMonth() };
                                    })} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500">
                                      <i className="bi bi-chevron-left text-xs"></i>
                                    </button>
                                    <span className="text-sm font-bold text-slate-700">
                                      {year}/{month + 1}
                                    </span>
                                    <button type="button" onClick={() => setCalendarViewDate(prev => {
                                      const d = new Date(prev.year, prev.month + 1);
                                      return { year: d.getFullYear(), month: d.getMonth() };
                                    })} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500">
                                      <i className="bi bi-chevron-right text-xs"></i>
                                    </button>
                                  </div>

                                  {/* 曜日ヘッダー */}
                                  <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                                    {['日','月','火','水','木','金','土'].map((d, i) => (
                                      <div key={d} className={`text-center text-[10px] font-bold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{d}</div>
                                    ))}
                                  </div>

                                  {/* 日付グリッド */}
                                  <div className="grid grid-cols-7 p-1 gap-0.5 bg-white">
                                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                      const day = i + 1;
                                      const dateKey = `${year}/${String(month + 1).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
                                      const hasSlot = availableDates.has(dateKey);
                                      const isSelected = selectedCalendarDate === dateKey;
                                      const isPast = new Date(year, month, day) < today;
                                      const dow = new Date(year, month, day).getDay();
                                      return (
                                        <button
                                          key={day}
                                          type="button"
                                          disabled={!hasSlot || isPast}
                                          onClick={() => setSelectedCalendarDate(isSelected ? null : dateKey)}
                                          className={`relative h-8 w-full rounded-lg text-xs font-bold transition-all
                                            ${isSelected ? 'bg-indigo-600 text-white' :
                                              hasSlot && !isPast ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-300' :
                                              isPast ? 'text-slate-200 cursor-not-allowed' :
                                              dow === 0 ? 'text-red-300 cursor-not-allowed' :
                                              dow === 6 ? 'text-blue-300 cursor-not-allowed' :
                                              'text-slate-300 cursor-not-allowed'}`}
                                        >
                                          {day}
                                          {hasSlot && !isPast && !isSelected && (
                                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500"></span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* 選択日のスロット一覧 */}
                                  {selectedCalendarDate && (
                                    <div className="border-t border-slate-200 p-2 bg-slate-50 space-y-1.5">
                                      <p className="text-[11px] font-bold text-slate-500 px-1">{t('eval_training_date_slots', { date: selectedCalendarDate })}</p>
                                      {slotsForSelected.map(slot => {
                                        const start = new Date(slot.startTime);
                                        const end = new Date(slot.endTime);
                                        const timeStr = `${start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
                                        const isSlotSelected = selectedTrainingSlotId === slot.id;
                                        return (
                                          <button
                                            key={slot.id}
                                            type="button"
                                            onClick={() => {
                                              setSelectedTrainingSlotId(isSlotSelected ? '' : slot.id);
                                              if (!isSlotSelected) {
                                                setEvalForm(f => ({ ...f, flowStatus: 'TRAINING_WAITING' }));
                                              }
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all
                                              ${isSlotSelected ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                          >
                                            <span className="font-bold">{timeStr}</span>
                                            <div className="flex items-center gap-2">
                                              {slot.location && <span className={`text-[11px] ${isSlotSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{slot.location}</span>}
                                              <span className={`text-[11px] font-bold ${isSlotSelected ? 'text-indigo-200' : slot.remainingCapacity <= 1 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                {t('eval_training_slot_remaining', { remaining: slot.remainingCapacity })}
                                              </span>
                                              {isSlotSelected && <i className="bi bi-check-circle-fill text-white"></i>}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* 後でメールで案内 */}
                        {trainingBookingMode === 'later' && (
                          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <i className="bi bi-envelope-fill text-blue-500 mt-0.5"></i>
                            <p className="text-xs text-blue-700 font-medium">
                              {t('eval_training_later_note')}
                            </p>
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                  )}

                </>
              ) : null}
            </div>

            {/* フッター */}
            {!evalLoading && selectedApplicant && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
                <button
                  onClick={handleDeleteApplicant}
                  className="px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-sm transition-colors border border-rose-200 flex items-center gap-1.5"
                >
                  <i className="bi bi-trash3"></i>
                  {t('eval_btn_delete')}
                </button>
                <div className="flex gap-3">
                  {registeredDistributorId ? (
                    <button
                      disabled
                      className="px-4 py-2.5 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm border border-slate-200 flex items-center gap-1.5 cursor-not-allowed"
                    >
                      <i className="bi bi-check-circle-fill"></i>
                      {t('eval_distributor_registered_btn')}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowDistributorForm(true);
                        setDistForm({ branchId: '', staffId: '' });
                        if (branches.length === 0) fetchBranches();
                      }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-1.5"
                    >
                      <i className="bi bi-person-plus"></i>
                      {t('eval_distributor_register')}
                    </button>
                  )}
                  <button
                    onClick={closeEvalModal}
                    className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSaveEval}
                    disabled={evalSaving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {evalSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    <i className="bi bi-check-lg"></i>
                    {t('eval_btn_save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          モーダル: 配布員登録
         ════════════════════════════════════════════ */}
      {showDistributorForm && selectedApplicant && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-[90vh]">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-person-badge-fill text-emerald-600"></i>
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">{t('eval_section_distributor')}</h2>
                  <p className="text-xs text-slate-500">{selectedApplicant.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDistributorForm(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>
            {/* フォーム */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_distributor_branch')} <span className="text-rose-500">*</span></label>
                <select
                  value={distForm.branchId}
                  onChange={e => {
                    const val = e.target.value;
                    setDistForm(f => ({ ...f, branchId: val, staffId: '' }));
                    if (val) fetchNextStaffId(val);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                >
                  <option value="">{t('eval_select_placeholder')}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}{b.prefix ? ` (${b.prefix})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('eval_distributor_staff_id')}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={distForm.staffId}
                    onChange={e => setDistForm(f => ({ ...f, staffId: e.target.value }))}
                    placeholder={distForm.branchId ? t('eval_distributor_staff_placeholder_branch') : t('eval_distributor_staff_placeholder_select')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none font-mono"
                  />
                  {staffIdLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{t('eval_distributor_staff_note')}</p>
              </div>
            </div>
            {/* フッター */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowDistributorForm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleRegisterAsDistributor}
                disabled={registering || !distForm.branchId}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {registering && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {t('eval_distributor_register_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          モーダル: 応募者手動登録
         ════════════════════════════════════════════ */}
      {showManualRegisterModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full md:max-w-xl rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-[90vh]">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-person-plus-fill text-emerald-600"></i>
                </div>
                <h2 className="text-lg font-black text-slate-800">{t('manual_title')}</h2>
              </div>
              <button
                onClick={() => setShowManualRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>

            {/* ボディ（スクロール可能） */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_name')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualRegForm.name}
                    onChange={e => setManualRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={t('manual_name_placeholder')}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_email')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={manualRegForm.email}
                    onChange={e => setManualRegForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="example@email.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_phone')} <span className="text-slate-400 font-normal">{t('manual_phone_optional')}</span>
                  </label>
                  <input
                    type="tel"
                    value={manualRegForm.phone}
                    onChange={e => handlePhoneChange(e.target.value, v => setManualRegForm(f => ({ ...f, phone: v })))}
                    placeholder="090-1234-5678"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_birthday')} <span className="text-slate-400 font-normal">{t('manual_birthday_optional')}</span>
                  </label>
                  <input
                    type="date"
                    value={manualRegForm.birthday}
                    onChange={e => setManualRegForm(f => ({ ...f, birthday: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_gender')} <span className="text-slate-400 font-normal">{t('manual_gender_optional')}</span>
                  </label>
                  <select
                    value={manualRegForm.gender}
                    onChange={e => setManualRegForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">{t('manual_gender_unset')}</option>
                    <option value="male">{t('manual_gender_male')}</option>
                    <option value="female">{t('manual_gender_female')}</option>
                    <option value="other">{t('manual_gender_other')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_job_category')} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={manualRegForm.jobCategoryId}
                    onChange={e => setManualRegForm(f => ({ ...f, jobCategoryId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">{t('eval_select_placeholder')}</option>
                    {jobCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nameJa}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_recruiting_media')} <span className="text-slate-400 font-normal">{t('manual_recruiting_optional')}</span>
                  </label>
                  <select
                    value={manualRegForm.recruitingMediaId}
                    onChange={e => setManualRegForm(f => ({ ...f, recruitingMediaId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">{t('manual_recruiting_unset')}</option>
                    {recruitingMediaList.filter(m => m.isActive).map(m => (
                      <option key={m.id} value={m.id}>{m.nameJa}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_country')} <span className="text-slate-400 font-normal">{t('manual_country_optional')}</span>
                  </label>
                  <select
                    value={manualRegForm.countryId}
                    onChange={e => setManualRegForm(f => ({ ...f, countryId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">{t('manual_country_unset')}</option>
                    {countries.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    {t('manual_visa')} <span className="text-slate-400 font-normal">{t('manual_visa_optional')}</span>
                  </label>
                  <select
                    value={manualRegForm.visaTypeId}
                    onChange={e => setManualRegForm(f => ({ ...f, visaTypeId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">{t('manual_visa_unset')}</option>
                    {visaTypes.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">{t('manual_email_lang')}</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="manualRegLang"
                        value="ja"
                        checked={manualRegForm.language === 'ja'}
                        onChange={() => setManualRegForm(f => ({ ...f, language: 'ja' }))}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">{t('manual_email_lang_ja')}</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="manualRegLang"
                        value="en"
                        checked={manualRegForm.language === 'en'}
                        onChange={() => setManualRegForm(f => ({ ...f, language: 'en' }))}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">English</span>
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualRegForm.sendInterviewEmail}
                    onChange={e => setManualRegForm(f => ({ ...f, sendInterviewEmail: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">{t('manual_send_interview_email')}</span>
                </label>
              </div>
            </div>

            {/* フッター */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowManualRegisterModal(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleManualRegister}
                disabled={manualRegSaving || !manualRegForm.name.trim() || !manualRegForm.email.trim() || !manualRegForm.jobCategoryId}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {manualRegSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <i className="bi bi-person-plus-fill"></i>
                {t('manual_register_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          モーダル: 職種マスタ管理
         ════════════════════════════════════════════ */}
      {showJobCatModal && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-[90vh]">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-tags-fill text-indigo-600"></i>
                </div>
                <h2 className="text-lg font-black text-slate-800">{t('jobcat_title')}</h2>
              </div>
              <button
                onClick={() => setShowJobCatModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>

            {/* ボディ */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 新規追加フォーム */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">{t('jobcat_new')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('jobcat_name_ja')}</label>
                    <input
                      type="text"
                      value={newJobCat.nameJa}
                      onChange={e => setNewJobCat(f => ({ ...f, nameJa: e.target.value }))}
                      placeholder={t('jobcat_name_ja_placeholder')}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">{t('jobcat_name_en')}</label>
                    <input
                      type="text"
                      value={newJobCat.nameEn}
                      onChange={e => setNewJobCat(f => ({ ...f, nameEn: e.target.value }))}
                      placeholder="Distributor"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateJobCategory}
                  disabled={jobCatCreating || !newJobCat.nameJa.trim()}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {jobCatCreating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <i className="bi bi-plus-lg"></i>
                  {t('jobcat_add_btn')}
                </button>
              </div>

              {/* 一覧 */}
              <div>
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">{t('jobcat_list_title')}</h4>
                {jobCatLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : jobCategories.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <i className="bi bi-tags text-2xl block mb-2"></i>
                    <p className="text-xs font-medium">{t('jobcat_no_categories')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobCategories.map(cat => (
                      <div
                        key={cat.id}
                        className="bg-white border border-slate-200 rounded-lg px-4 py-3"
                      >
                        {editingJobCat?.id === cat.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={editingJobCat.nameJa}
                                onChange={e => setEditingJobCat(prev => prev ? { ...prev, nameJa: e.target.value } : prev)}
                                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                placeholder={t('jobcat_name_ja')}
                              />
                              <input
                                type="text"
                                value={editingJobCat.nameEn}
                                onChange={e => setEditingJobCat(prev => prev ? { ...prev, nameEn: e.target.value } : prev)}
                                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                placeholder={t('jobcat_name_en')}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingJobCat(null)}
                                className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                onClick={handleUpdateJobCategory}
                                disabled={jobCatSaving || !editingJobCat.nameJa.trim()}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                {jobCatSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                {t('save')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{cat.nameJa}</p>
                              {cat.nameEn && <p className="text-xs text-slate-500">{cat.nameEn}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">
                                {t('jobcat_applicant_count', { count: cat._count?.applicants || 0 })}
                              </span>
                              {!cat.isActive && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                                  {t('jobcat_inactive')}
                                </span>
                              )}
                              <button
                                onClick={() => setEditingJobCat({ id: cat.id, nameJa: cat.nameJa, nameEn: cat.nameEn || '' })}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title={t('edit')}
                              >
                                <i className="bi bi-pencil-square text-sm"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteJobCategory(cat)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title={t('delete')}
                              >
                                <i className="bi bi-trash3 text-sm"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* フッター */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowJobCatModal(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
