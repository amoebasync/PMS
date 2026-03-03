'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { handlePhoneChange } from '@/lib/formatters';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useNotification } from '@/components/ui/NotificationProvider';
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
  } | null;
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
  createdAt: string;
  updatedAt: string;
};

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────
const FLOW_STATUS_MAP: Record<string, { label: string; color: string }> = {
  INTERVIEW_WAITING:   { label: '面接待ち',   color: 'bg-amber-100 text-amber-700' },
  NO_SHOW:             { label: 'NO SHOW',    color: 'bg-rose-100 text-rose-700' },
  TRAINING_WAITING:    { label: '研修待ち',   color: 'bg-blue-100 text-blue-700' },
  TRAINING_COMPLETED:  { label: '研修完了',   color: 'bg-emerald-100 text-emerald-700' },
};

const HIRING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: '選考中',  color: 'bg-slate-100 text-slate-600' },
  HIRED:       { label: '採用',    color: 'bg-emerald-100 text-emerald-700' },
  REJECTED:    { label: '不採用',  color: 'bg-rose-100 text-rose-700' },
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
const ScoreSelector = ({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
    <div className="flex gap-1 items-end">
      <span className="text-[10px] text-slate-400 pb-2.5 mr-0.5">低</span>
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
      <span className="text-[10px] text-slate-400 pb-2.5 ml-0.5">高</span>
    </div>
  </div>
);

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export default function ApplicantsPage() {
  const { showToast, showConfirm } = useNotification();
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
      showToast('出欠を選択してください', 'error');
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
        showToast('研修評価を保存しました', 'success');
        setTrainingEvalTargetId(null);
        await fetchTrainingMgmt();
      } else {
        showToast('更新に失敗しました', 'error');
      }
    } catch { showToast('エラーが発生しました', 'error'); }
    setTrainingEvalSaving(false);
  };

  // ── カレンダー ──
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // ── マスターデータ ──
  const [countries, setCountries] = useState<Country[]>([]);
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [recruitingMediaList, setRecruitingMediaList] = useState<RecruitingMedia[]>([]);
  const [interviewerEmployees, setInterviewerEmployees] = useState<{ id: number; lastNameJa: string; firstNameJa: string; email: string }[]>([]);

  // ──────────────────────────────────────────
  // データ取得
  // ──────────────────────────────────────────
  const fetchSlots = useCallback(async (month?: string, silent = false) => {
    if (!silent) setCalendarLoading(true);
    try {
      const m = month || currentMonth;
      const res = await fetch(`/api/interview-slots?month=${m}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setSlots(data.data || []);
    } catch {
      if (!silent) {
        setSlots([]);
        showToast('スロットの取得に失敗しました', 'error');
      }
    } finally {
      if (!silent) setCalendarLoading(false);
    }
  }, [currentMonth, showToast]);

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
      const [countriesRes, visaTypesRes, rmRes, empRes] = await Promise.all([
        fetch('/api/countries/public'),
        fetch('/api/visa-types/public'),
        fetch('/api/recruiting-media'),
        fetch('/api/employees?simple=true'),
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
        showToast('配布員として登録しました', 'success');
      } else {
        showToast(data.error || '登録に失敗しました', 'error');
      }
    } catch {
      showToast('登録に失敗しました', 'error');
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
      showToast('リンクをコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  };

  // 手動登録
  const handleManualRegister = async () => {
    if (!manualRegForm.name.trim() || !manualRegForm.email.trim() || !manualRegForm.jobCategoryId) {
      showToast('氏名・メール・職種は必須です', 'warning');
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
      if (!res.ok) throw new Error(data.error || '登録に失敗しました');
      setShowManualRegisterModal(false);
      const shouldSendEmail = manualRegForm.sendInterviewEmail;
      setManualRegForm({ name: '', email: '', phone: '', jobCategoryId: '', language: 'en', recruitingMediaId: '', birthday: '', gender: '', countryId: '', visaTypeId: '', sendInterviewEmail: true });
      fetchApplicants(1);
      fetchSlots();
      if (shouldSendEmail) {
        showToast('応募者を登録しました。面接案内メールを送信中...', 'success');
        try {
          await fetch(`/api/applicants/${data.id}/send-interview-invitation`, { method: 'POST' });
          showToast('面接案内メールを送信しました', 'success');
        } catch {
          showToast('面接案内メールの送信に失敗しました', 'error');
        }
      } else {
        showToast('応募者を登録しました', 'success');
      }
    } catch (e: any) {
      showToast(e.message || '登録に失敗しました', 'error');
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
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      showToast('面接案内メールを送信しました', 'success');
    } catch (e: any) {
      showToast(e.message || '面接案内メールの送信に失敗しました', 'error');
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
      title: `${slot.bookedCount}/${slot.capacity}名`,
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
    const isBooked = slot.isBooked && slot.applicant;
    const interviewerName = slot.interviewer ? `${slot.interviewer.lastNameJa} ${slot.interviewer.firstNameJa}` : '';
    return {
      id: String(slot.id),
      title: isBooked ? slot.applicant!.name : '空きスロット',
      start: slot.startTime,
      end: slot.endTime,
      backgroundColor: isBooked ? '#6366f1' : '#10b981',
      borderColor: isBooked ? '#4f46e5' : '#059669',
      textColor: '#ffffff',
      extendedProps: {
        slot,
        isBooked,
        interviewerName,
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
        showToast('定員を更新しました', 'success');
        await fetchTrainingMgmt();
      } else {
        const err = await res.json();
        showToast(err.error || '更新に失敗しました', 'error');
      }
    } catch { showToast('エラーが発生しました', 'error'); }
    setSavingCapacity(false);
  };

  // 研修スロット詳細モーダルを閉じる
  const closeTrainingSlotPanel = () => {
    setSelectedTrainingSlot(null);
    setExpandedTrainingApplicantId(null);
  };

  // 研修スロット: 削除
  const handleDeleteTrainingSlot = async () => {
    if (!selectedTrainingSlot) return;
    const start = new Date(selectedTrainingSlot.startTime);
    const dateStr = start.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    const ok = await showConfirm(
      `このスロットを削除しますか？\n${dateStr}`,
      { variant: 'danger', confirmLabel: '削除', title: '研修スロット削除' }
    );
    if (!ok) return;
    setDeletingSlot(true);
    try {
      const res = await fetch(`/api/training-slots/${selectedTrainingSlot.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('スロットを削除しました', 'success');
        closeTrainingSlotPanel();
        await fetchTrainingMgmt();
      } else {
        const err = await res.json();
        showToast(err.error || '削除に失敗しました', 'error');
      }
    } catch { showToast('エラーが発生しました', 'error'); }
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
    if (isBooked && slot.applicant) {
      openEvalModal(slot.applicant.id);
    } else {
      const ok = await showConfirm(
        `この空きスロットを削除しますか？\n${new Date(slot.startTime).toLocaleString('ja-JP')}`,
        { variant: 'danger', confirmLabel: '削除', title: 'スロット削除' }
      );
      if (ok) {
        try {
          const res = await fetch(`/api/interview-slots/${slot.id}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '削除に失敗しました');
          }
          showToast('スロットを削除しました', 'success');
          fetchSlots();
        } catch (e: any) {
          showToast(e.message || 'スロットの削除に失敗しました', 'error');
        }
      }
    }
  };

  // スロット一括作成
  const handleCreateSlots = async () => {
    if (!slotForm.date) {
      showToast('日付を入力してください', 'warning');
      return;
    }
    if (slotForm.startHour >= slotForm.endHour) {
      showToast('終了時刻は開始時刻より後にしてください', 'warning');
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
        throw new Error(err.error || '作成に失敗しました');
      }
      const data = await res.json();
      showToast(`${data.count}件のスロットを作成しました`, 'success');
      setShowSlotModal(false);
      fetchSlots();
    } catch (e: any) {
      showToast(e.message || 'スロットの作成に失敗しました', 'error');
    } finally {
      setSlotCreating(false);
    }
  };

  // 応募者評価モーダルを開く
  const openEvalModal = async (applicantId: number) => {
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
      showToast('応募者情報の取得に失敗しました', 'error');
      setShowEvalModal(false);
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
        throw new Error(err.error || '保存に失敗しました');
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
            showToast(`研修スロットの予約に失敗しました: ${err.error || ''}`, 'error');
          } else {
            showToast('応募者情報を保存し、研修スロットを予約しました', 'success');
            trainingBooked = true;
          }
        } else if (trainingBookingMode === 'later') {
          const inviteRes = await fetch(`/api/applicants/${selectedApplicant.id}/book-training`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainingSlotId: null, sendInvite: true }),
          });
          if (!inviteRes.ok) {
            showToast('研修案内メールの送信に失敗しました', 'error');
          } else {
            showToast('応募者情報を保存し、研修案内メールを送信しました', 'success');
          }
        } else {
          showToast('応募者情報を保存しました', 'success');
        }

      } else {
        showToast('応募者情報を保存しました', 'success');
      }

      setShowEvalModal(false);
      setSelectedApplicant(null);
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '保存に失敗しました', 'error');
    } finally {
      setEvalSaving(false);
    }
  };

  // 面接キャンセル（管理者）
  const handleCancelInterview = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      `「${selectedApplicant.name}」の面接をキャンセルしますか？\nスロットが解放されます。`,
      { variant: 'danger', confirmLabel: 'キャンセルする', title: '面接キャンセル' }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/cancel-interview`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'キャンセルに失敗しました');
      }
      showToast('面接をキャンセルしました', 'success');
      openEvalModal(selectedApplicant.id);
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '面接キャンセルに失敗しました', 'error');
    }
  };

  // 面接NO SHOW記録
  const handleNoShow = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      `「${selectedApplicant.name}」を面接不参加（NO SHOW）として記録しますか？`,
      { variant: 'danger', confirmLabel: 'NO SHOWを記録', title: '面接不参加（NO SHOW）' }
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
        throw new Error(err.error || 'NO SHOWの記録に失敗しました');
      }
      showToast('NO SHOWを記録しました', 'success');
      openEvalModal(selectedApplicant.id);
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || 'NO SHOWの記録に失敗しました', 'error');
    }
  };

  // 面接担当者変更
  const handleChangeInterviewer = async (newInterviewerId: number | null) => {
    if (!selectedApplicant?.interviewSlot) return;
    const slotId = selectedApplicant.interviewSlot.id;
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
      alert('担当者の変更に失敗しました');
    }
  };

  // 応募者削除
  const handleDeleteApplicant = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      `「${selectedApplicant.name}」を削除しますか？\nこの操作は取り消せません。`,
      { variant: 'danger', confirmLabel: '削除する', title: '応募者削除' }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '削除に失敗しました');
      }
      showToast(`「${selectedApplicant.name}」を削除しました`, 'success');
      setShowEvalModal(false);
      setSelectedApplicant(null);
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '削除に失敗しました', 'error');
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
        throw new Error(err.error || '日程変更に失敗しました');
      }
      showToast('面接日程を変更しました', 'success');
      setShowReschedulePanel(false);
      openEvalModal(selectedApplicant.id);
      fetchSlots();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '面接日程変更に失敗しました', 'error');
    } finally {
      setRescheduleLoading(false);
    }
  };

  // ── 研修キャンセル ──
  const handleCancelTraining = async () => {
    if (!selectedApplicant) return;
    const ok = await showConfirm(
      `「${selectedApplicant.name}」の研修予約をキャンセルしますか？`,
      { variant: 'danger', confirmLabel: 'キャンセルする', title: '研修キャンセル' }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/cancel-training`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'キャンセルに失敗しました');
      }
      showToast('研修予約をキャンセルしました', 'success');
      openEvalModal(selectedApplicant.id);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '研修キャンセルに失敗しました', 'error');
    }
  };

  // ── 研修キャンセル（カレンダーモーダルから） ──
  const handleCancelTrainingFromModal = async (applicantId: number, applicantName: string) => {
    const ok = await showConfirm(
      `「${applicantName}」の研修予約をキャンセルしますか？`,
      { variant: 'danger', confirmLabel: 'キャンセルする', title: '研修キャンセル' }
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/applicants/${applicantId}/cancel-training`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'キャンセルに失敗しました');
      }
      showToast('研修予約をキャンセルしました', 'success');
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '研修キャンセルに失敗しました', 'error');
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
        throw new Error(err.error || '日程変更に失敗しました');
      }
      showToast('研修日程を変更しました', 'success');
      setShowTrainingReschedulePanel(false);
      openEvalModal(selectedApplicant.id);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '研修日程変更に失敗しました', 'error');
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
        throw new Error(err.error || '日程変更に失敗しました');
      }
      showToast('研修日程を変更しました', 'success');
      setTrainingRescheduleTargetId(null);
      setTrainingRescheduleMode(null);
      setCalendarNewTrainingSlotId(null);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || '研修日程変更に失敗しました', 'error');
    } finally {
      setCalendarRescheduleLoading(false);
    }
  };

  // ── 研修日程変更メール送信（カレンダーモーダルから） ──
  const handleSendTrainingRescheduleEmail = async (applicantId: number, applicantName: string) => {
    const ok = await showConfirm(
      `「${applicantName}」に研修日程の変更メールを送信しますか？\n本人がリンクから新しい日程を選択できます。`,
      { variant: 'primary', confirmLabel: 'メール送信', title: '研修日程変更メール' }
    );
    if (!ok) return;
    try {
      // まず現在の研修をキャンセル（スロット解放）
      await fetch(`/api/applicants/${applicantId}/cancel-training`, { method: 'POST' });
      // 研修案内メールを送信（本人が自分で予約し直す）
      const res = await fetch(`/api/applicants/${applicantId}/send-training-invite`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'メール送信に失敗しました');
      }
      showToast('研修日程変更メールを送信しました', 'success');
      setTrainingActionMenuId(null);
      fetchTrainingMgmt();
      fetchApplicants(page);
    } catch (e: any) {
      showToast(e.message || 'メール送信に失敗しました', 'error');
    }
  };

  // 職種作成
  const handleCreateJobCategory = async () => {
    if (!newJobCat.nameJa.trim()) {
      showToast('職種名（日本語）を入力してください', 'warning');
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
        throw new Error(err.error || '作成に失敗しました');
      }
      showToast('職種を作成しました', 'success');
      setNewJobCat({ nameJa: '', nameEn: '' });
      fetchJobCategories();
    } catch (e: any) {
      showToast(e.message || '職種の作成に失敗しました', 'error');
    } finally {
      setJobCatCreating(false);
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
          <div className="flex items-center border-b border-slate-200">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-colors relative ${
                activeTab === 'calendar'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="bi bi-calendar3"></i>
              カレンダー
              {activeTab === 'calendar' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('list');
                fetchApplicants(1);
              }}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-colors relative ${
                activeTab === 'list'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="bi bi-list-ul"></i>
              応募者一覧
              {activeTab === 'list' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('training');
                fetchTrainingMgmt();
              }}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition-colors relative ${
                activeTab === 'training'
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className="bi bi-mortarboard-fill"></i>
              研修管理
              {activeTab === 'training' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
              )}
            </button>

            {/* スペーサー + アクションボタン */}
            <div className="flex-1" />
            <div className="flex items-center gap-2 px-4">
              <div className="relative">
                <button
                  onClick={() => setShowLinkPopover(v => !v)}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  <i className="bi bi-link-45deg text-indigo-500"></i>
                  応募ページ
                  <i className="bi bi-chevron-down text-[10px] text-slate-400"></i>
                </button>
                {showLinkPopover && (
                  <>
                    <div className="fixed inset-0 z-[999]" onClick={() => setShowLinkPopover(false)} />
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-[1000] p-4 space-y-3">
                      <div className="text-xs font-black text-slate-700 mb-1">応募ページリンク生成</div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">言語</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setLinkLang('ja')}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${linkLang === 'ja' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            日本語
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
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">求人媒体</label>
                        <select
                          value={linkMediaId}
                          onChange={e => setLinkMediaId(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                        >
                          <option value="">なし</option>
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
                          コピー
                        </button>
                        <a
                          href={buildApplyUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                        >
                          <i className="bi bi-box-arrow-up-right"></i>
                          開く
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
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                <i className="bi bi-person-plus-fill text-emerald-500"></i>
                手動登録
              </button>
              <button
                onClick={() => {
                  fetchJobCategories();
                  setShowJobCatModal(true);
                }}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                <i className="bi bi-tags-fill text-violet-500"></i>
                職種マスタ
              </button>
              <a
                href="/settings?tab=interviewSlot"
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                <i className="bi bi-gear-fill text-slate-400"></i>
                スロット設定
              </a>
            </div>
          </div>

          {/* ── TAB 1: カレンダー ── */}
          {activeTab === 'calendar' && (
            <div className="p-6">
              {calendarLoading && slots.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">読み込み中...</span>
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
                    today: '今日',
                    month: '月',
                    week: '週',
                  }}
                  events={calendarEvents}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  datesSet={handleDatesSet}
                  slotMinTime="08:00:00"
                  slotMaxTime="21:00:00"
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
              <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <div className="relative">
                      <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                      <input
                        type="text"
                        placeholder="氏名・メールで検索..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                  <select
                    value={filterFlowStatus}
                    onChange={e => setFilterFlowStatus(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                  >
                    <option value="">フロー: すべて</option>
                    <option value="INTERVIEW_WAITING">面接待ち</option>
                    <option value="NO_SHOW">NO SHOW</option>
                    <option value="TRAINING_WAITING">研修待ち</option>
                    <option value="TRAINING_COMPLETED">研修完了</option>
                  </select>
                  <select
                    value={filterHiringStatus}
                    onChange={e => setFilterHiringStatus(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                  >
                    <option value="">採用: すべて</option>
                    <option value="IN_PROGRESS">選考中</option>
                    <option value="HIRED">採用</option>
                    <option value="REJECTED">不採用</option>
                  </select>
                </div>
              </div>

              {/* テーブル */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">氏名</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">メール</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">職種</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">面接日時</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">フロー</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">採用ステータス</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
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
                            <p className="text-sm font-medium">応募者が見つかりません</p>
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
                              {app.interviewSlot ? (
                                <span className="text-sm text-slate-600">
                                  {new Date(app.interviewSlot.startTime).toLocaleString('ja-JP', {
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">未設定</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {flow && (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${flow.color}`}>
                                  {flow.label}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {hiring && (
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${hiring.color}`}>
                                  {hiring.label}
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
                                詳細
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
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
              <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/training-slots/generate', { method: 'POST' });
                        const data = await res.json();
                        if (res.ok) {
                          showToast(data.message || 'スロットを生成しました', 'success');
                          fetchTrainingMgmt();
                        } else {
                          showToast(data.error || '生成に失敗しました', 'error');
                        }
                      } catch { showToast('エラーが発生しました', 'error'); }
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                    今すぐ生成
                  </button>
                  {/* 凡例 */}
                  <div className="flex items-center gap-3 ml-auto text-xs text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-400 inline-block"></span>空き</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block"></span>予約あり</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"></span>残りわずか</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>満員</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>全員完了</span>
                  </div>
                </div>
              </div>

              {/* カレンダー */}
              <div className="p-6">
                {trainingMgmtLoading && trainingMgmtSlots.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">読み込み中...</span>
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
                    buttonText={{ today: '今日', month: '月', week: '週' }}
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
                            <div className="text-[11px] shrink-0 opacity-90">{slot.bookedCount}/{slot.capacity}名</div>
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
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
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
                  <div className="text-xs font-bold text-slate-500 mb-2">定員設定</div>
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
                    <span className="text-sm text-slate-500">名</span>
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
                      保存
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
                      {slot.bookedCount}/{slot.capacity}名
                    </span>
                  </div>
                </div>

                {/* 参加者リスト */}
                <div className="px-6 py-4">
                  <div className="text-xs font-bold text-slate-500 mb-2">参加者</div>
                  {slot.applicants.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">参加者なし</p>
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
                                      <i className="bi bi-person-badge mr-0.5"></i>配布員登録済
                                    </span>
                                  ) : null}
                                  {isNoShow ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">NO SHOW</span>
                                  ) : flow && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${flow.color}`}>
                                      {flow.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isCompleted ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); isEvalOpen ? setTrainingEvalTargetId(null) : handleOpenTrainingEval(app); }}
                                  className="text-xs font-bold text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors shrink-0 ml-2"
                                  title="評価を編集"
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
                                    評価・完了
                                  </button>
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setTrainingActionMenuId(trainingActionMenuId === app.id ? null : app.id); }}
                                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="アクション"
                                    >
                                      <i className="bi bi-three-dots-vertical text-sm"></i>
                                    </button>
                                    {trainingActionMenuId === app.id && (
                                      <>
                                        <div className="fixed inset-0 z-[2999]" onClick={() => setTrainingActionMenuId(null)} />
                                        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-[3000] py-1 overflow-hidden">
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
                                            日程を変更する
                                          </button>
                                          <button
                                            onClick={() => {
                                              setTrainingActionMenuId(null);
                                              handleSendTrainingRescheduleEmail(app.id, app.name);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-left"
                                          >
                                            <i className="bi bi-envelope text-amber-500"></i>
                                            日程変更メールを送信
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
                                            研修をキャンセル
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
                                    <span className="text-slate-400">メール</span>
                                    <p className="text-slate-700 font-medium truncate">{app.email || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">電話</span>
                                    <p className="text-slate-700 font-medium">{app.phone || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">国籍</span>
                                    <p className="text-slate-700 font-medium">{app.countryName || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">職種</span>
                                    <p className="text-slate-700 font-medium">{app.jobCategoryName || '—'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">採用ステータス</span>
                                    {hiring && <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${hiring.color}`}>{hiring.label}</span>}
                                  </div>
                                  <div>
                                    <span className="text-slate-400">配布員登録</span>
                                    <p className="text-slate-700 font-medium">
                                      {app.registeredDistributorId
                                        ? <span className="text-indigo-600 font-bold">ID: {app.registeredDistributorId}</span>
                                        : <span className="text-slate-400">未登録</span>}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeTrainingSlotPanel();
                                    openEvalModal(app.id);
                                  }}
                                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors mt-1"
                                >
                                  <i className="bi bi-box-arrow-up-right"></i>
                                  応募者詳細を開く
                                </button>
                              </div>
                            )}

                            {/* 研修評価フォーム（インライン展開） */}
                            {isEvalOpen && (
                              <div className="mt-1 p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-4">
                                {/* 出欠 */}
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">出欠</label>
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
                                      出席
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
                                      NO SHOW
                                    </button>
                                  </div>
                                </div>

                                {/* 評価項目（出席時のみ） */}
                                {trainingEvalForm.attendance === 'ATTENDED' && (
                                  <div className="space-y-3">
                                    <ScoreSelector label="理解度" value={trainingEvalForm.understandingScore} onChange={v => setTrainingEvalForm(f => ({ ...f, understandingScore: v }))} />
                                    <ScoreSelector label="コミュニケーション" value={trainingEvalForm.communicationScore} onChange={v => setTrainingEvalForm(f => ({ ...f, communicationScore: v }))} />
                                    <ScoreSelector label="スピード" value={trainingEvalForm.speedScore} onChange={v => setTrainingEvalForm(f => ({ ...f, speedScore: v }))} />
                                    <ScoreSelector label="やる気" value={trainingEvalForm.motivationScore} onChange={v => setTrainingEvalForm(f => ({ ...f, motivationScore: v }))} />
                                  </div>
                                )}

                                {/* メモ */}
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5">メモ</label>
                                  <textarea
                                    value={trainingEvalForm.notes}
                                    onChange={e => setTrainingEvalForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={2}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white resize-none"
                                    placeholder="研修メモ..."
                                  />
                                </div>

                                {/* 保存 */}
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setTrainingEvalTargetId(null)}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                                  >
                                    キャンセル
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
                                    {isCompleted ? '評価を更新' : '研修完了として保存'}
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
                                    <span>理解: <b className="text-slate-700">{app.trainingUnderstandingScore}</b></span>
                                    <span>コミュ: <b className="text-slate-700">{app.trainingCommunicationScore}</b></span>
                                    <span>速度: <b className="text-slate-700">{app.trainingSpeedScore}</b></span>
                                    <span>意欲: <b className="text-slate-700">{app.trainingMotivationScore}</b></span>
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
                        {targetApp.name} の研修日程を変更
                      </div>
                      <button
                        onClick={() => { setTrainingRescheduleTargetId(null); setTrainingRescheduleMode(null); }}
                        className="text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                    {trainingSlots.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">空き研修スロットがありません</p>
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
                              <span className="text-[10px] text-slate-400">残{ts.remainingCapacity}/{ts.capacity}</span>
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
                      この日程に変更する
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
                    この枠を削除
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 text-center">
                    <i className="bi bi-info-circle mr-1"></i>
                    参加者がいる枠は削除できません
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
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-calendar-plus text-emerald-600"></i>
                </div>
                <h2 className="text-lg font-black text-slate-800">面接スロット作成</h2>
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
                <label className="block text-xs font-bold text-slate-500 mb-1.5">日付</label>
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
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">開始時刻</label>
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
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">終了時刻</label>
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
                <label className="block text-xs font-bold text-slate-500 mb-1.5">間隔</label>
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
                    <span className="text-sm font-medium text-slate-700">30分</span>
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
                    <span className="text-sm font-medium text-slate-700">60分</span>
                  </label>
                </div>
              </div>

              {/* Google Meet URL */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  Google Meet URL <span className="text-slate-400 font-normal">(任意)</span>
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
                    = {Math.floor((slotForm.endHour - slotForm.startHour) * 60 / slotForm.intervalMinutes)}件のスロット
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
                キャンセル
              </button>
              <button
                onClick={handleCreateSlots}
                disabled={slotCreating}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {slotCreating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          モーダル: 応募者評価
         ════════════════════════════════════════════ */}
      {showEvalModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh]">
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
                        {FLOW_STATUS_MAP[selectedApplicant.flowStatus].label}
                      </span>
                    )}
                    {HIRING_STATUS_MAP[selectedApplicant.hiringStatus] && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${HIRING_STATUS_MAP[selectedApplicant.hiringStatus].color}`}>
                        {HIRING_STATUS_MAP[selectedApplicant.hiringStatus].label}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => {
                  setShowEvalModal(false);
                  setSelectedApplicant(null);
                }}
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
                    <span className="text-sm font-medium">読み込み中...</span>
                  </div>
                </div>
              ) : selectedApplicant ? (
                <>
                  {/* セクション 1: 基本情報 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="bi bi-person-fill text-indigo-600"></i>
                      <h3 className="text-sm font-black text-slate-800">基本情報</h3>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                      {/* 個人情報 */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">氏名</p>
                          <input
                            type="text"
                            value={evalForm.name}
                            onChange={e => setEvalForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          />
                        </div>
                        <div>
                          <p className={`text-xs font-bold mb-0.5 ${!evalForm.birthday ? 'text-red-500' : 'text-slate-400'}`}>
                            生年月日{!evalForm.birthday && <span className="ml-1 text-[10px] font-medium">※ 入力してください</span>}
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
                            性別{!evalForm.gender && <span className="ml-1 text-[10px] font-medium">※ 入力してください</span>}
                          </p>
                          <select
                            value={evalForm.gender}
                            onChange={e => setEvalForm(f => ({ ...f, gender: e.target.value }))}
                            className={`w-full text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white border ${!evalForm.gender ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200'}`}
                          >
                            <option value="">未設定</option>
                            <option value="male">男性</option>
                            <option value="female">女性</option>
                            <option value="other">その他</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 my-3" />

                      {/* 連絡先 */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div className="col-span-1">
                          <p className="text-xs font-bold text-slate-400 mb-0.5">メール</p>
                          <input
                            type="email"
                            value={evalForm.email}
                            onChange={e => setEvalForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">電話</p>
                          <input
                            type="tel"
                            value={evalForm.phone}
                            onChange={e => handlePhoneChange(e.target.value, v => setEvalForm(f => ({ ...f, phone: v })))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                            placeholder="090-0000-0000"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">言語</p>
                          <select
                            value={evalForm.language}
                            onChange={e => setEvalForm(f => ({ ...f, language: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          >
                            <option value="ja">日本語</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 my-3" />

                      {/* 応募情報 */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">職種</p>
                          <select
                            value={evalForm.jobCategoryId}
                            onChange={e => setEvalForm(f => ({ ...f, jobCategoryId: e.target.value }))}
                            className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          >
                            <option value="">選択してください</option>
                            {jobCategories.filter(jc => jc.isActive).map(jc => (
                              <option key={jc.id} value={jc.id}>{jc.nameJa}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">応募経路</p>
                          <select
                            value={evalForm.recruitingMediaId}
                            onChange={e => setEvalForm(f => ({ ...f, recruitingMediaId: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                          >
                            <option value="">未設定</option>
                            {recruitingMediaList.map(m => (
                              <option key={m.id} value={m.id}>{m.nameJa}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 my-3" />

                      {/* 面接情報 */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">面接日時</p>
                          {selectedApplicant.interviewSlot ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-slate-700">
                                {new Date(selectedApplicant.interviewSlot.startTime).toLocaleString('ja-JP', {
                                  year: 'numeric',
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                              {selectedApplicant.interviewSlot.meetUrl && (
                                <a
                                  href={selectedApplicant.interviewSlot.meetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-1 text-xs font-medium hover:underline transition-colors"
                                >
                                  <i className="bi bi-camera-video text-xs"></i>
                                  Meet
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">未設定</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">面接担当者</p>
                          {selectedApplicant.interviewSlot ? (
                            <select
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                              value={selectedApplicant.interviewSlot.interviewer?.id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleChangeInterviewer(val ? Number(val) : null);
                              }}
                            >
                              <option value="">未設定</option>
                              {interviewerEmployees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.lastNameJa} {emp.firstNameJa}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-slate-400">面接未予約</p>
                          )}
                        </div>
                      </div>

                      {/* 面接操作ボタン */}
                      {selectedApplicant.interviewSlot && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => openReschedulePanel()}
                            className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 transition-colors inline-flex items-center gap-1"
                          >
                            <i className="bi bi-calendar-plus"></i>日程変更
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelInterview}
                            className="text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 transition-colors inline-flex items-center gap-1"
                          >
                            <i className="bi bi-x-circle"></i>面接キャンセル
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
                      {!selectedApplicant.interviewSlot && (
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
                            面接案内メールを送信
                          </button>
                        </div>
                      )}

                      {/* 日程変更パネル */}
                      {showReschedulePanel && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-black text-indigo-700">新しい日程を選択</h4>
                            <button type="button" onClick={() => setShowReschedulePanel(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                          {rescheduleLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : availableSlots.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">空きスロットがありません</p>
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
                                {rescheduleLoading ? '変更中...' : 'この日程に変更する'}
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
                      <h3 className="text-sm font-black text-slate-800">国籍・在留資格・住所</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-bold mb-1.5 ${!evalForm.countryId ? 'text-red-500' : 'text-slate-500'}`}>
                          国籍{!evalForm.countryId && <span className="ml-1 text-[10px] font-medium">※ 入力してください</span>}
                        </label>
                        <SearchableSelect
                          options={countries}
                          value={String(evalForm.countryId || '')}
                          onChange={(v) => setEvalForm(f => ({ ...f, countryId: v }))}
                          getOptionValue={(c) => String(c.id)}
                          getOptionLabel={(c) => `${c.name}（${c.nameEn}）`}
                          placeholder="選択してください"
                          searchPlaceholder="国名で検索..."
                          noResultsText="該当する国がありません"
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
                            在留資格{!evalForm.visaTypeId && <span className="ml-1 text-[10px] font-medium">※ 入力してください</span>}
                          </label>
                          <select
                            value={evalForm.visaTypeId}
                            onChange={e => setEvalForm(f => ({ ...f, visaTypeId: e.target.value }))}
                            className={`w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white border ${!evalForm.visaTypeId ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200'}`}
                          >
                            <option value="">選択してください</option>
                            {visaTypes.map(v => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">郵便番号</label>
                        <input
                          type="text"
                          value={evalForm.postalCode}
                          onChange={e => setEvalForm(f => ({ ...f, postalCode: e.target.value }))}
                          placeholder="123-4567"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">住所</label>
                        <input
                          type="text"
                          value={evalForm.address}
                          onChange={e => setEvalForm(f => ({ ...f, address: e.target.value }))}
                          placeholder="東京都..."
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">建物名・部屋番号</label>
                        <input
                          type="text"
                          value={evalForm.building}
                          onChange={e => setEvalForm(f => ({ ...f, building: e.target.value }))}
                          placeholder="マンション名 101号室"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* セクション 3: 面接評価 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="bi bi-clipboard-check text-indigo-600"></i>
                      <h3 className="text-sm font-black text-slate-800">面接評価</h3>
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
                            <span className="text-sm font-bold text-slate-700">他の仕事をやっているか</span>
                          </label>
                          {evalForm.hasOtherJob && (
                            <div className="mt-2 ml-6">
                              <input
                                type="text"
                                value={evalForm.otherJobDetails}
                                onChange={e => setEvalForm(f => ({ ...f, otherJobDetails: e.target.value }))}
                                placeholder="詳細を入力..."
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
                          <span className="text-sm font-bold text-slate-700">日本で発行された口座はあるか</span>
                        </label>
                      </div>

                      {/* スコア */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ScoreSelector
                          label="日本語能力"
                          value={evalForm.japaneseLevel}
                          onChange={v => setEvalForm(f => ({ ...f, japaneseLevel: v }))}
                        />
                        <ScoreSelector
                          label="英語能力"
                          value={evalForm.englishLevel}
                          onChange={v => setEvalForm(f => ({ ...f, englishLevel: v }))}
                        />
                        <ScoreSelector
                          label="コミュニケーション"
                          value={evalForm.communicationScore}
                          onChange={v => setEvalForm(f => ({ ...f, communicationScore: v }))}
                        />
                        <ScoreSelector
                          label="印象"
                          value={evalForm.impressionScore}
                          onChange={v => setEvalForm(f => ({ ...f, impressionScore: v }))}
                        />
                      </div>

                      {/* 備考 */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">備考欄</label>
                        <textarea
                          value={evalForm.interviewNotes}
                          onChange={e => setEvalForm(f => ({ ...f, interviewNotes: e.target.value }))}
                          rows={3}
                          placeholder="面接時のメモ..."
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* セクション 4: ステータス変更 */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <i className="bi bi-arrow-left-right text-indigo-600"></i>
                      <h3 className="text-sm font-black text-slate-800">ステータス変更</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">フローステータス</label>
                        <select
                          value={evalForm.flowStatus}
                          onChange={e => setEvalForm(f => ({ ...f, flowStatus: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        >
                          <option value="INTERVIEW_WAITING">面接待ち</option>
                          <option value="NO_SHOW">NO SHOW</option>
                          <option value="TRAINING_WAITING">研修待ち</option>
                          <option value="TRAINING_COMPLETED">研修完了</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">採用ステータス</label>
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
                          <option value="IN_PROGRESS">選考中</option>
                          <option value="HIRED">採用</option>
                          <option value="REJECTED">不採用</option>
                        </select>
                      </div>
                    </div>

                    {/* 採用警告 */}
                    {evalForm.hiringStatus === 'HIRED' && selectedApplicant.hiringStatus !== 'HIRED' && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                        <i className="bi bi-exclamation-triangle-fill text-amber-500 mt-0.5"></i>
                        <p className="text-xs font-bold text-amber-700">
                          採用通知メールが自動送信されます
                        </p>
                      </div>
                    )}
                  </div>

                  {/* セクション 5: 研修スロット設定（採用時のみ） */}
                  {evalForm.hiringStatus === 'HIRED' && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <i className="bi bi-mortarboard text-indigo-600"></i>
                        <h3 className="text-sm font-black text-slate-800">研修スロット設定</h3>
                      </div>

                      {/* 既に研修スロットが設定済みの場合 */}
                      {selectedApplicant.trainingSlot ? (
                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                          <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                                <i className="bi bi-check-circle-fill text-emerald-500"></i>
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-emerald-700 mb-1">研修日程確定</p>
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
                                <i className="bi bi-calendar-plus"></i>日程変更
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelTraining}
                                className="text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 transition-colors inline-flex items-center gap-1"
                              >
                                <i className="bi bi-x-circle"></i>研修キャンセル
                              </button>
                            </div>

                            {/* 研修日程変更パネル */}
                            {showTrainingReschedulePanel && (
                              <div className="pt-3 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-xs font-black text-indigo-700">新しい研修日程を選択</h4>
                                  <button type="button" onClick={() => setShowTrainingReschedulePanel(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                                    <i className="bi bi-x-lg"></i>
                                  </button>
                                </div>
                                {trainingRescheduleLoading ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                  </div>
                                ) : availableTrainingSlots.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-2">空き研修スロットがありません</p>
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
                                              <span className="ml-2 text-[11px] text-slate-400">残{slot.remainingCapacity}名</span>
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
                                      {trainingRescheduleLoading ? '変更中...' : 'この日程に変更する'}
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
                            <span className="text-sm font-bold text-slate-700">今すぐ指定</span>
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
                            <span className="text-sm font-bold text-slate-700">後でメールで案内</span>
                          </label>
                        </div>

                        {/* 今すぐ指定: カレンダーピッカー */}
                        {trainingBookingMode === 'now' && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">研修日時を選択</label>
                            {loadingTrainingSlots ? (
                              <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                読み込み中...
                              </div>
                            ) : trainingSlots.length === 0 ? (
                              <p className="text-sm text-slate-400">利用可能な研修スロットがありません</p>
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
                                      {year}年{month + 1}月
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
                                      <p className="text-[11px] font-bold text-slate-500 px-1">{selectedCalendarDate} のスロット</p>
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
                                                残{slot.remainingCapacity}名
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
                              保存時に研修予約リンクをメール送信します
                            </p>
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* セクション 6: 配布員登録（採用済み） */}
                  {selectedApplicant.hiringStatus === 'HIRED' && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <i className="bi bi-person-badge text-emerald-600"></i>
                        <h3 className="text-sm font-black text-slate-800">配布員登録</h3>
                      </div>

                      {registeredDistributorId ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                          <i className="bi bi-check-circle-fill text-emerald-500"></i>
                          <p className="text-xs font-bold text-emerald-700">
                            配布員として登録済み（スタッフID: {registeredDistributorId}）
                          </p>
                        </div>
                      ) : showDistributorForm ? (
                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">所属支店 <span className="text-rose-500">*</span></label>
                            <select
                              value={distForm.branchId}
                              onChange={e => {
                                const val = e.target.value;
                                setDistForm(f => ({ ...f, branchId: val, staffId: '' }));
                                if (val) fetchNextStaffId(val);
                              }}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                            >
                              <option value="">選択してください</option>
                              {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}{b.prefix ? ` (${b.prefix})` : ''}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">スタッフID</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={distForm.staffId}
                                onChange={e => setDistForm(f => ({ ...f, staffId: e.target.value }))}
                                placeholder={distForm.branchId ? '支店のプレフィックスで自動入力' : '支店を選択してください'}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none font-mono"
                              />
                              {staffIdLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">支店選択時に自動入力されます。変更も可能です。</p>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setShowDistributorForm(false)}
                              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors"
                            >
                              キャンセル
                            </button>
                            <button
                              onClick={handleRegisterAsDistributor}
                              disabled={registering || !distForm.branchId}
                              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                            >
                              {registering && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                              登録する
                            </button>
                          </div>
                        </div>
                      ) : null}
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
                  削除
                </button>
                <div className="flex gap-3">
                  {selectedApplicant.hiringStatus === 'HIRED' && !showDistributorForm && (
                    registeredDistributorId ? (
                      <button
                        disabled
                        className="px-4 py-2.5 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm border border-slate-200 flex items-center gap-1.5 cursor-not-allowed"
                      >
                        <i className="bi bi-check-circle-fill"></i>
                        配布員登録済み
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!evalForm.birthday) {
                            showToast('生年月日を入力してから配布員登録を行ってください', 'warning');
                            return;
                          }
                          setShowDistributorForm(true);
                          if (branches.length === 0) fetchBranches();
                        }}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-1.5"
                      >
                        <i className="bi bi-person-plus"></i>
                        配布員登録
                      </button>
                    )
                  )}
                  <button
                    onClick={() => {
                      setShowEvalModal(false);
                      setSelectedApplicant(null);
                    }}
                    className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveEval}
                    disabled={evalSaving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {evalSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    <i className="bi bi-check-lg"></i>
                    保存
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          モーダル: 応募者手動登録
         ════════════════════════════════════════════ */}
      {showManualRegisterModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-person-plus-fill text-emerald-600"></i>
                </div>
                <h2 className="text-lg font-black text-slate-800">応募者を手動登録</h2>
              </div>
              <button
                onClick={() => setShowManualRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-lg"></i>
              </button>
            </div>

            {/* ボディ（スクロール可能） */}
            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    氏名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualRegForm.name}
                    onChange={e => setManualRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="山田 太郎"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    メールアドレス <span className="text-rose-500">*</span>
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    電話番号 <span className="text-slate-400 font-normal">（任意）</span>
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
                    生年月日 <span className="text-slate-400 font-normal">（任意）</span>
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
                    性別 <span className="text-slate-400 font-normal">（任意）</span>
                  </label>
                  <select
                    value={manualRegForm.gender}
                    onChange={e => setManualRegForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">未選択</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    職種 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={manualRegForm.jobCategoryId}
                    onChange={e => setManualRegForm(f => ({ ...f, jobCategoryId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">選択してください</option>
                    {jobCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nameJa}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    求人媒体 <span className="text-slate-400 font-normal">（任意）</span>
                  </label>
                  <select
                    value={manualRegForm.recruitingMediaId}
                    onChange={e => setManualRegForm(f => ({ ...f, recruitingMediaId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">選択なし</option>
                    {recruitingMediaList.filter(m => m.isActive).map(m => (
                      <option key={m.id} value={m.id}>{m.nameJa}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    国籍 <span className="text-slate-400 font-normal">（任意）</span>
                  </label>
                  <select
                    value={manualRegForm.countryId}
                    onChange={e => setManualRegForm(f => ({ ...f, countryId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">未選択</option>
                    {countries.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    在留資格 <span className="text-slate-400 font-normal">（任意）</span>
                  </label>
                  <select
                    value={manualRegForm.visaTypeId}
                    onChange={e => setManualRegForm(f => ({ ...f, visaTypeId: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white"
                  >
                    <option value="">未選択</option>
                    {visaTypes.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">メール言語</label>
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
                      <span className="text-sm font-medium text-slate-700">日本語</span>
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
                  <span className="text-sm font-medium text-slate-700">面接案内メール送信</span>
                </label>
              </div>
            </div>

            {/* フッター */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowManualRegisterModal(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleManualRegister}
                disabled={manualRegSaving || !manualRegForm.name.trim() || !manualRegForm.email.trim() || !manualRegForm.jobCategoryId}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {manualRegSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <i className="bi bi-person-plus-fill"></i>
                登録する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          モーダル: 職種マスタ管理
         ════════════════════════════════════════════ */}
      {showJobCatModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i className="bi bi-tags-fill text-indigo-600"></i>
                </div>
                <h2 className="text-lg font-black text-slate-800">職種マスタ管理</h2>
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
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">新規追加</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">職種名（日本語）</label>
                    <input
                      type="text"
                      value={newJobCat.nameJa}
                      onChange={e => setNewJobCat(f => ({ ...f, nameJa: e.target.value }))}
                      placeholder="配布スタッフ"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">職種名（英語）</label>
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
                  追加
                </button>
              </div>

              {/* 一覧 */}
              <div>
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2">登録済み職種</h4>
                {jobCatLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : jobCategories.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <i className="bi bi-tags text-2xl block mb-2"></i>
                    <p className="text-xs font-medium">職種が登録されていません</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobCategories.map(cat => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">{cat.nameJa}</p>
                          {cat.nameEn && <p className="text-xs text-slate-500">{cat.nameEn}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">
                            {cat._count?.applicants || 0}名
                          </span>
                          {!cat.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                              無効
                            </span>
                          )}
                        </div>
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
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
