'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
type RecruitingMedia = { id: number; nameJa: string; nameEn: string | null; code: string };

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
  createdAt: string;
  updatedAt: string;
};

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────
const FLOW_STATUS_MAP: Record<string, { label: string; color: string }> = {
  INTERVIEW_WAITING:   { label: '面接待ち',   color: 'bg-amber-100 text-amber-700' },
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
  type TrainingApplicant = { id: number; name: string; flowStatus: string; hiringStatus: string; phone: string | null };
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
  const [markingComplete, setMarkingComplete] = useState<number | null>(null);
  const [selectedTrainingSlot, setSelectedTrainingSlot] = useState<TrainingSlotManagement | null>(null);
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

  const handleMarkTrainingComplete = async (applicantId: number) => {
    setMarkingComplete(applicantId);
    try {
      const res = await fetch(`/api/applicants/${applicantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowStatus: 'TRAINING_COMPLETED' }),
      });
      if (res.ok) {
        showToast('研修完了としてマークしました', 'success');
        await fetchTrainingMgmt();
      } else {
        showToast('更新に失敗しました', 'error');
      }
    } catch { showToast('エラーが発生しました', 'error'); }
    setMarkingComplete(null);
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

  // ── 配布員登録 ──
  const [branches, setBranches] = useState<{ id: number; nameJa: string }[]>([]);
  const [showDistributorForm, setShowDistributorForm] = useState(false);
  const [distForm, setDistForm] = useState({ birthday: '', branchId: '', staffId: '', gender: '' });
  const [registering, setRegistering] = useState(false);
  const [registeredDistributorId, setRegisteredDistributorId] = useState<number | null>(null);

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

  // ──────────────────────────────────────────
  // データ取得
  // ──────────────────────────────────────────
  const fetchSlots = useCallback(async (month?: string) => {
    setCalendarLoading(true);
    try {
      const m = month || currentMonth;
      const res = await fetch(`/api/interview-slots?month=${m}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setSlots(data.data || []);
    } catch {
      setSlots([]);
      showToast('スロットの取得に失敗しました', 'error');
    } finally {
      setCalendarLoading(false);
    }
  }, [currentMonth, showToast]);

  const fetchApplicants = useCallback(async (p = 1) => {
    setListLoading(true);
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
      setApplicants([]);
    } finally {
      setListLoading(false);
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
      const [countriesRes, visaTypesRes, rmRes] = await Promise.all([
        fetch('/api/countries/public'),
        fetch('/api/visa-types/public'),
        fetch('/api/recruiting-media'),
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

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) setBranches(await res.json());
    } catch {
      // silently fail
    }
  };

  const handleRegisterAsDistributor = async () => {
    if (!selectedApplicant || !distForm.birthday || !distForm.branchId) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/applicants/${selectedApplicant.id}/register-as-distributor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthday: distForm.birthday,
          branchId: Number(distForm.branchId),
          staffId: distForm.staffId || undefined,
          gender: distForm.gender || undefined,
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

  // ── 初回ロード ──
  useEffect(() => {
    fetchSlots();
    fetchApplicants(1);
    fetchMasterData();
  }, []);

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

  // 研修スロット詳細パネルを閉じ、カレンダーサイズを再計算
  const closeTrainingSlotPanel = () => {
    setSelectedTrainingSlot(null);
    setTimeout(() => {
      trainingCalendarRef.current?.getApi().updateSize();
    }, 50);
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
    setShowReschedulePanel(false);
    setSelectedTrainingSlotId('');
    setTrainingBookingMode('now');
    setShowDistributorForm(false);
    setDistForm({ birthday: '', branchId: '', staffId: '', gender: '' });
    setRegisteredDistributorId(null);
    try {
      const res = await fetch(`/api/applicants/${applicantId}`);
      if (!res.ok) throw new Error('fetch failed');
      const data: Applicant = await res.json();
      setSelectedApplicant(data);
      setEvalForm({
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
        {/* ── ヘッダー ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <i className="bi bi-person-lines-fill text-indigo-600 text-lg"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">応募者管理</h1>
              <p className="text-xs text-slate-500">面接スロット・応募者評価管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/apply"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              応募ページ
            </a>
            <button
              onClick={() => {
                fetchJobCategories();
                setShowJobCatModal(true);
              }}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <i className="bi bi-tags-fill text-indigo-500"></i>
              職種マスタ
            </button>
            <a
              href="/settings?tab=interviewSlot"
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <i className="bi bi-gear-fill text-slate-500"></i>
              スロット設定
            </a>
          </div>
        </div>

        {/* ── タブ ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200">
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

              {/* カレンダー + 詳細パネル */}
              <div className="flex">
                {/* FullCalendar */}
                <div className={`p-6 transition-all ${selectedTrainingSlot ? 'w-[60%]' : 'w-full'}`}>
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
                          <div className="px-1 py-0.5 overflow-hidden h-full flex flex-col gap-0.5">
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

                {/* スロット詳細パネル */}
                {selectedTrainingSlot && (() => {
                  const slot = selectedTrainingSlot;
                  const start = new Date(slot.startTime);
                  const end = new Date(slot.endTime);
                  const fillRate = slot.capacity > 0 ? (slot.bookedCount / slot.capacity) * 100 : 0;
                  const canDelete = slot.bookedCount === 0;
                  return (
                    <div className="w-[40%] border-l border-slate-200 flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                      {/* ヘッダー */}
                      <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-200 flex items-start justify-between z-10">
                        <div>
                          <div className="text-sm font-black text-slate-800">
                            {start.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 〜 {end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {slot.location && (
                            <div className="text-xs text-slate-400 mt-1">
                              <i className="bi bi-geo-alt mr-1"></i>{slot.location}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={closeTrainingSlotPanel}
                          className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
                        >
                          <i className="bi bi-x-lg text-base"></i>
                        </button>
                      </div>

                      {/* 定員設定 */}
                      <div className="px-5 py-4 border-b border-slate-100">
                        <div className="text-xs font-bold text-slate-500 mb-2">定員</div>
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
                      <div className="px-5 py-4 flex-1">
                        <div className="text-xs font-bold text-slate-500 mb-2">参加者</div>
                        {slot.applicants.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">参加者なし</p>
                        ) : (
                          <div className="space-y-2">
                            {slot.applicants.map(app => {
                              const flow = FLOW_STATUS_MAP[app.flowStatus];
                              const isCompleted = app.flowStatus === 'TRAINING_COMPLETED';
                              return (
                                <div
                                  key={app.id}
                                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${isCompleted ? 'bg-emerald-50' : 'bg-slate-50'}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'}`}>
                                      <i className={`bi ${isCompleted ? 'bi-check-lg' : 'bi-person'}`}></i>
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-slate-800 truncate">{app.name}</div>
                                      {app.phone && <div className="text-xs text-slate-400">{app.phone}</div>}
                                    </div>
                                    {flow && (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${flow.color}`}>
                                        {flow.label}
                                      </span>
                                    )}
                                  </div>
                                  {!isCompleted && (
                                    <button
                                      onClick={() => handleMarkTrainingComplete(app.id)}
                                      disabled={markingComplete === app.id}
                                      className="flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 shrink-0 ml-2"
                                    >
                                      {markingComplete === app.id ? (
                                        <span className="w-3 h-3 border border-emerald-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                                      ) : (
                                        <i className="bi bi-check2-circle"></i>
                                      )}
                                      完了
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 削除ボタン */}
                      <div className="px-5 py-4 border-t border-slate-100">
                        {canDelete ? (
                          <button
                            onClick={handleDeleteTrainingSlot}
                            disabled={deletingSlot}
                            className="w-full flex items-center justify-center gap-2 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
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
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

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
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">氏名</p>
                          <p className="text-sm font-bold text-slate-800">{selectedApplicant.name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">メール</p>
                          <p className="text-sm text-slate-700">{selectedApplicant.email}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">電話</p>
                          <p className="text-sm text-slate-700">{selectedApplicant.phone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">言語</p>
                          <p className="text-sm text-slate-700">{selectedApplicant.language === 'en' ? 'English' : '日本語'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">職種</p>
                          <p className="text-sm text-slate-700">{selectedApplicant.jobCategory?.nameJa || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">面接日時</p>
                          {selectedApplicant.interviewSlot ? (
                            <div className="flex items-center gap-2">
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
                        {/* 応募経路 */}
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
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">国籍</label>
                        <select
                          value={evalForm.countryId}
                          onChange={e => setEvalForm(f => ({ ...f, countryId: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
                        >
                          <option value="">選択してください</option>
                          {countries.map(c => (
                            <option key={c.id} value={c.id}>{c.name}（{c.nameEn}）</option>
                          ))}
                        </select>
                      </div>

                      {!isJapanese(evalForm.countryId) && (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">在留資格</label>
                          <select
                            value={evalForm.visaTypeId}
                            onChange={e => setEvalForm(f => ({ ...f, visaTypeId: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
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
                        {!isJapanese(evalForm.countryId) && (
                          <>
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
                          </>
                        )}
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
                      {selectedApplicant.trainingSlot && (
                        <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                          <i className="bi bi-check-circle-fill text-emerald-500 mt-0.5"></i>
                          <div>
                            <p className="text-xs font-bold text-emerald-700">研修スロット予約済み</p>
                            <p className="text-xs text-emerald-600 mt-0.5">
                              {new Date(selectedApplicant.trainingSlot.startTime).toLocaleString('ja-JP', {
                                year: 'numeric', month: 'numeric', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                              {' 〜 '}
                              {new Date(selectedApplicant.trainingSlot.endTime).toLocaleTimeString('ja-JP', {
                                hour: '2-digit', minute: '2-digit',
                              })}
                              {selectedApplicant.trainingSlot.location && ` / ${selectedApplicant.trainingSlot.location}`}
                            </p>
                          </div>
                        </div>
                      )}

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
                              onChange={() => setTrainingBookingMode('later')}
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
                                            onClick={() => setSelectedTrainingSlotId(isSlotSelected ? '' : slot.id)}
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
                    </div>
                  )}

                  {/* セクション 6: 配布員登録（採用 + 研修日確定後） */}
                  {selectedApplicant.hiringStatus === 'HIRED' && selectedApplicant.trainingSlot && (
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
                      ) : !showDistributorForm ? (
                        <button
                          onClick={() => {
                            setShowDistributorForm(true);
                            if (branches.length === 0) fetchBranches();
                          }}
                          className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                          <i className="bi bi-person-plus"></i>
                          配布員として登録する
                        </button>
                      ) : (
                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">生年月日 <span className="text-rose-500">*</span></label>
                            <input
                              type="date"
                              value={distForm.birthday}
                              onChange={e => setDistForm(f => ({ ...f, birthday: e.target.value }))}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">初期パスワードは生年月日（YYYYMMDD）で設定されます</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">所属支店 <span className="text-rose-500">*</span></label>
                            <select
                              value={distForm.branchId}
                              onChange={e => setDistForm(f => ({ ...f, branchId: e.target.value }))}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                            >
                              <option value="">選択してください</option>
                              {branches.map(b => <option key={b.id} value={b.id}>{b.nameJa}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">スタッフID（任意）</label>
                            <input
                              type="text"
                              value={distForm.staffId}
                              onChange={e => setDistForm(f => ({ ...f, staffId: e.target.value }))}
                              placeholder="空欄の場合は自動採番"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">性別（任意）</label>
                            <select
                              value={distForm.gender}
                              onChange={e => setDistForm(f => ({ ...f, gender: e.target.value }))}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                            >
                              <option value="">未設定</option>
                              <option value="male">男性</option>
                              <option value="female">女性</option>
                              <option value="other">その他</option>
                            </select>
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
                              disabled={registering || !distForm.birthday || !distForm.branchId}
                              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                            >
                              {registering && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                              登録する
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* フッター */}
            {!evalLoading && selectedApplicant && (
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
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
            )}
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
