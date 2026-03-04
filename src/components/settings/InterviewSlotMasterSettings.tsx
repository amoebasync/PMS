'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/useTranslation';
import { useNotification } from '@/components/ui/NotificationProvider';

// --- Types ---

type JobCategory = {
  id: number;
  nameJa: string;
  nameEn: string | null;
};

type EmployeeOption = {
  id: number;
  lastNameJa: string;
  firstNameJa: string;
  email: string;
};

type SlotMaster = {
  id: number;
  name: string;
  meetingType: 'GOOGLE_MEET' | 'ZOOM';
  zoomUrl: string | null;
  zoomMeetingNumber: string | null;
  zoomPassword: string | null;
  isActive: boolean;
  jobCategoryIds: number[];
  slotCount: number;
  capacity: number;
  allowHolidays: boolean;
};

type DefaultSlot = {
  id: number | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  isEnabled: boolean;
  interviewerId: number | null;
};

type MasterFormData = {
  name: string;
  meetingType: 'GOOGLE_MEET' | 'ZOOM';
  zoomUrl: string;
  zoomMeetingNumber: string;
  zoomPassword: string;
  jobCategoryIds: number[];
  isActive: boolean;
  capacity: number;
  capacityUnlimited: boolean;
  allowHolidays: boolean;
};

const INITIAL_FORM: MasterFormData = {
  name: '',
  meetingType: 'GOOGLE_MEET',
  zoomUrl: '',
  zoomMeetingNumber: '',
  zoomPassword: '',
  jobCategoryIds: [],
  isActive: true,
  capacity: 1,
  capacityUnlimited: false,
  allowHolidays: true,
};

const INTERVAL_OPTIONS = [15, 30, 45, 60, 90, 120];

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function calcSlotCount(slot: DefaultSlot): number {
  if (!slot.isEnabled) return 0;
  const [startH, startM] = slot.startTime.split(':').map(Number);
  const [endH, endM] = slot.endTime.split(':').map(Number);
  const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (totalMinutes <= 0) return 0;
  return Math.floor(totalMinutes / slot.intervalMinutes);
}

// --- Component ---

export default function InterviewSlotMasterSettings() {
  const { t, lang } = useTranslation('settings');
  const { showToast, showConfirm } = useNotification();

  // Masters
  const [masters, setMasters] = useState<SlotMaster[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);

  // Master modal
  const [showModal, setShowModal] = useState(false);
  const [editingMasterId, setEditingMasterId] = useState<number | null>(null);
  const [form, setForm] = useState<MasterFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Job categories & employees
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  // Weekly schedule for selected master
  const [slots, setSlots] = useState<DefaultSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(getTomorrowStr());

  // --- Day labels i18n ---
  const DAY_KEYS = ['day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday'];

  // --- All job category IDs assigned to OTHER masters ---
  const assignedToOtherIds = useCallback(
    (excludeMasterId?: number | null): Set<number> => {
      const set = new Set<number>();
      masters.forEach((m) => {
        if (excludeMasterId != null && m.id === excludeMasterId) return;
        m.jobCategoryIds.forEach((id) => set.add(id));
      });
      return set;
    },
    [masters]
  );

  // --- Fetch helpers ---

  const fetchMasters = async () => {
    try {
      const res = await fetch('/api/interview-slot-masters');
      if (res.ok) {
        const data = await res.json();
        // API returns jobCategories[] and _count, transform to flat shape
        const mapped: SlotMaster[] = data.map((m: any) => ({
          id: m.id,
          name: m.name,
          meetingType: m.meetingType,
          zoomUrl: m.zoomUrl,
          zoomMeetingNumber: m.zoomMeetingNumber,
          zoomPassword: m.zoomPassword,
          isActive: m.isActive,
          jobCategoryIds: (m.jobCategories || []).map((jc: any) => jc.id),
          slotCount: m._count?.interviewSlots ?? 0,
          capacity: m.capacity ?? 1,
          allowHolidays: m.allowHolidays ?? true,
        }));
        setMasters(mapped);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingMasters(false);
  };

  const fetchJobCategories = async () => {
    try {
      const res = await fetch('/api/job-categories');
      if (res.ok) {
        const data = await res.json();
        setJobCategories(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees?simple=true');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWeeklySlots = async (masterId: number) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/settings/default-slots?masterId=${masterId}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingSlots(false);
  };

  useEffect(() => {
    fetchMasters();
    fetchJobCategories();
    fetchEmployees();
  }, []);

  // When a master is selected, load its weekly schedule
  useEffect(() => {
    if (selectedMasterId != null) {
      fetchWeeklySlots(selectedMasterId);
      setSaveResult(null);
      setGenerateResult(null);
    }
  }, [selectedMasterId]);

  // --- Master CRUD ---

  const openCreateModal = () => {
    setEditingMasterId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const openEditModal = (master: SlotMaster) => {
    setEditingMasterId(master.id);
    setForm({
      name: master.name,
      meetingType: master.meetingType,
      zoomUrl: master.zoomUrl || '',
      zoomMeetingNumber: master.zoomMeetingNumber || '',
      zoomPassword: master.zoomPassword || '',
      jobCategoryIds: [...master.jobCategoryIds],
      isActive: master.isActive,
      capacity: master.capacity,
      capacityUnlimited: master.capacity === 0,
      allowHolidays: master.allowHolidays,
    });
    setShowModal(true);
  };

  const handleSaveMaster = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        meetingType: form.meetingType,
        zoomUrl: form.meetingType === 'ZOOM' ? form.zoomUrl.trim() || null : null,
        zoomMeetingNumber: form.meetingType === 'ZOOM' ? form.zoomMeetingNumber.trim() || null : null,
        zoomPassword: form.meetingType === 'ZOOM' ? form.zoomPassword.trim() || null : null,
        jobCategoryIds: form.jobCategoryIds,
        isActive: form.isActive,
        capacity: form.capacityUnlimited ? 0 : Number(form.capacity) || 1,
        allowHolidays: form.allowHolidays,
      };

      const isEdit = editingMasterId != null;
      const url = isEdit
        ? `/api/interview-slot-masters/${editingMasterId}`
        : '/api/interview-slot-masters';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast(isEdit ? t('ism_toast_updated') : t('ism_toast_created'), 'success');
        setShowModal(false);
        await fetchMasters();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || t('ism_toast_save_error'), 'error');
      }
    } catch {
      showToast(t('ism_toast_save_error'), 'error');
    }
    setSubmitting(false);
  };

  const handleDeleteMaster = async (master: SlotMaster) => {
    const confirmed = await showConfirm(t('ism_delete_confirm', { name: master.name }));
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/interview-slot-masters/${master.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(t('ism_toast_deleted'), 'success');
        if (selectedMasterId === master.id) {
          setSelectedMasterId(null);
          setSlots([]);
        }
        await fetchMasters();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || t('ism_has_booked_error'), 'error');
      }
    } catch {
      showToast(t('toast_delete_error'), 'error');
    }
  };

  const toggleJobCategory = (jcId: number) => {
    setForm((prev) => ({
      ...prev,
      jobCategoryIds: prev.jobCategoryIds.includes(jcId)
        ? prev.jobCategoryIds.filter((id) => id !== jcId)
        : [...prev.jobCategoryIds, jcId],
    }));
  };

  // --- Weekly schedule handlers ---

  const handleSlotChange = (dayOfWeek: number, field: keyof DefaultSlot, value: string | boolean | number | null) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
      )
    );
  };

  const handleCopyToOthers = (fromDay: number) => {
    const source = slots.find((s) => s.dayOfWeek === fromDay);
    if (!source) return;

    setSlots((prev) =>
      prev.map((s) =>
        s.dayOfWeek === fromDay
          ? s
          : {
              ...s,
              startTime: source.startTime,
              endTime: source.endTime,
              intervalMinutes: source.intervalMinutes,
              isEnabled: source.isEnabled,
              interviewerId: source.interviewerId,
            }
      )
    );
    setCopyFromDay(fromDay);
    setTimeout(() => setCopyFromDay(null), 2000);
  };

  const handleSaveAll = async () => {
    if (selectedMasterId == null) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/settings/default-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterId: selectedMasterId,
          slots,
          effectiveFrom: effectiveFrom || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        fetchWeeklySlots(selectedMasterId);

        if (data.cleanup) {
          const { deleted, created } = data.cleanup as { deleted: number; created: number };
          setSaveResult({
            type: 'success',
            message: `${t('ism_saved')} - ${effectiveFrom}: -${deleted} / +${created}`,
          });
        } else {
          setSaveResult({ type: 'success', message: t('ism_saved') });
        }
      } else {
        setSaveResult({ type: 'error', message: data.error || t('ism_toast_save_error') });
      }
    } catch {
      setSaveResult({ type: 'error', message: t('ism_toast_save_error') });
    }
    setSaving(false);
    setTimeout(() => setSaveResult(null), 6000);
  };

  const handleGenerate = async () => {
    const confirmed = await showConfirm(t('ism_generate') + '?');
    if (!confirmed) return;

    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch('/api/interview-slots/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setGenerateResult(`${data.created} created, ${data.skipped} skipped`);
      } else {
        setGenerateResult(data.error || t('ism_toast_save_error'));
      }
    } catch {
      setGenerateResult(t('ism_toast_save_error'));
    }
    setGenerating(false);
    setTimeout(() => setGenerateResult(null), 5000);
  };

  // --- Render ---

  if (loadingMasters) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400">
        <i className="bi bi-hourglass-split text-2xl animate-spin mr-3" />
        Loading...
      </div>
    );
  }

  const selectedMaster = masters.find((m) => m.id === selectedMasterId);
  const otherAssigned = assignedToOtherIds(editingMasterId);

  return (
    <div className="space-y-4">
      {/* ========== Master List ========== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-700">{t('ism_title')}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {t('ism_default_slot_desc')}
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2"
            >
              <i className="bi bi-plus-lg" />
              {t('ism_add')}
            </button>
          </div>
        </div>

        {masters.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <i className="bi bi-inbox text-3xl mb-2 block" />
            {t('ism_no_masters')}
          </div>
        ) : (
          <div className="p-5 grid gap-3">
            {masters.map((master) => {
              const isSelected = selectedMasterId === master.id;
              return (
                <div
                  key={master.id}
                  className={`rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div
                    className="flex items-center gap-4 p-4"
                    onClick={() => setSelectedMasterId(isSelected ? null : master.id)}
                  >
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${master.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-700 truncate">{master.name}</span>
                        {/* Meeting type badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          master.meetingType === 'GOOGLE_MEET'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-violet-100 text-violet-700'
                        }`}>
                          {master.meetingType === 'GOOGLE_MEET' ? t('ism_google_meet') : t('ism_zoom')}
                        </span>
                        {/* Active / Inactive badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          master.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {master.isActive ? t('ism_active') : t('ism_inactive')}
                        </span>
                        {/* Capacity badge */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                          {master.capacity === 0 ? t('ism_unlimited') : `${master.capacity}${t('ism_capacity_persons')}`}
                        </span>
                        {/* Holiday badge */}
                        {!master.allowHolidays && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {t('ism_holidays_reject')}
                          </span>
                        )}
                      </div>
                      {/* Job category tags */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {master.jobCategoryIds.length > 0 ? (
                          master.jobCategoryIds.map((jcId) => {
                            const jc = jobCategories.find((c) => c.id === jcId);
                            if (!jc) return null;
                            return (
                              <span key={jcId} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {lang === 'en' && jc.nameEn ? jc.nameEn : jc.nameJa}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            {t('ism_job_categories')}: --
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Slot count */}
                    <div className="text-center shrink-0">
                      <span className="text-lg font-bold text-indigo-600">{master.slotCount}</span>
                      <p className="text-[10px] text-slate-500">{t('ism_slots_count')}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(master)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title={t('ism_edit')}
                      >
                        <i className="bi bi-pencil-square" />
                      </button>
                      <button
                        onClick={() => handleDeleteMaster(master)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title={t('ism_delete')}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>

                    {/* Expand chevron */}
                    <i className={`bi ${isSelected ? 'bi-chevron-up' : 'bi-chevron-down'} text-slate-400 shrink-0`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========== Weekly Schedule (for selected master) ========== */}
      {selectedMasterId != null && selectedMaster && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-700">
                  <i className="bi bi-calendar-week mr-2 text-indigo-500" />
                  {t('ism_weekly_schedule')} - {selectedMaster.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {t('ism_default_slot_desc')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !slots.some((s) => s.isEnabled)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <i className="bi bi-hourglass-split animate-spin" /> {t('ism_generating')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-lightning-charge" /> {t('ism_generate')}
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
                >
                  {saved ? (
                    <>
                      <i className="bi bi-check2" /> {t('ism_saved')}
                    </>
                  ) : saving ? (
                    t('saving')
                  ) : (
                    <>
                      <i className="bi bi-floppy" /> {t('ism_save_all')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Effective from date picker */}
            <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <i className="bi bi-calendar-event text-amber-600 text-base mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-700 mb-0.5">{t('ism_effective_from')}</p>
                <p className="text-xs text-amber-600">
                  {t('ism_effective_from_desc')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="date"
                  value={effectiveFrom}
                  min={getTomorrowStr()}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-amber-400 outline-none bg-white"
                />
                {effectiveFrom && (
                  <button
                    type="button"
                    onClick={() => setEffectiveFrom('')}
                    className="text-xs text-amber-600 hover:text-amber-800 underline whitespace-nowrap"
                  >
                    {t('ism_effective_clear')}
                  </button>
                )}
              </div>
            </div>
            {!effectiveFrom && (
              <p className="mt-2 text-xs text-slate-400 pl-1">
                <i className="bi bi-info-circle mr-1" />
                {t('ism_effective_clear_hint')}
              </p>
            )}

            {/* Save result message */}
            {saveResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
                saveResult.type === 'error'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <i className={`bi ${saveResult.type === 'error' ? 'bi-exclamation-triangle' : 'bi-check-circle'} mr-2`} />
                {saveResult.message}
              </div>
            )}

            {/* Generate result message */}
            {generateResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
                generateResult.startsWith('Error') || generateResult.includes(t('ism_toast_save_error'))
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <i className={`bi ${
                  generateResult.startsWith('Error') || generateResult.includes(t('ism_toast_save_error'))
                    ? 'bi-exclamation-triangle'
                    : 'bi-check-circle'
                } mr-2`} />
                {generateResult}
              </div>
            )}
          </div>

          {/* Day rows */}
          {loadingSlots ? (
            <div className="flex items-center justify-center h-32 text-slate-400">
              <i className="bi bi-hourglass-split text-xl animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {slots.map((slot) => {
                const slotCount = calcSlotCount(slot);
                return (
                  <div
                    key={slot.dayOfWeek}
                    className={`rounded-xl border transition-all ${
                      slot.isEnabled
                        ? 'bg-indigo-50/50 border-indigo-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-4 p-4 flex-wrap">
                      {/* Day label */}
                      <div className="w-20 shrink-0">
                        <span
                          className={`font-bold text-sm ${
                            slot.dayOfWeek === 0
                              ? 'text-rose-600'
                              : slot.dayOfWeek === 6
                              ? 'text-blue-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {t(DAY_KEYS[slot.dayOfWeek])}
                        </span>
                      </div>

                      {/* Enable checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slot.isEnabled}
                          onChange={(e) => handleSlotChange(slot.dayOfWeek, 'isEnabled', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-500">{t('ism_enabled')}</span>
                      </label>

                      {/* Start time */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">{t('ism_start_time')}</label>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => handleSlotChange(slot.dayOfWeek, 'startTime', e.target.value)}
                          disabled={!slot.isEnabled}
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      {/* End time */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">{t('ism_end_time')}</label>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => handleSlotChange(slot.dayOfWeek, 'endTime', e.target.value)}
                          disabled={!slot.isEnabled}
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      {/* Interval */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">{t('ism_interval')}</label>
                        <select
                          value={slot.intervalMinutes}
                          onChange={(e) => handleSlotChange(slot.dayOfWeek, 'intervalMinutes', Number(e.target.value))}
                          disabled={!slot.isEnabled}
                          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {INTERVAL_OPTIONS.map((v) => (
                            <option key={v} value={v}>{v}{lang === 'ja' ? '分' : 'min'}</option>
                          ))}
                        </select>
                      </div>

                      {/* Slot count preview */}
                      {slot.isEnabled && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                          {slotCount}{t('ism_slots_per_day')}
                        </span>
                      )}

                      {/* Interviewer select */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 whitespace-nowrap">{t('ism_interviewer')}</label>
                        <select
                          value={slot.interviewerId || ''}
                          onChange={(e) =>
                            handleSlotChange(slot.dayOfWeek, 'interviewerId', e.target.value ? Number(e.target.value) : null)
                          }
                          disabled={!slot.isEnabled}
                          className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 max-w-[160px]"
                        >
                          <option value="">{t('ism_interviewer_none')}</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.lastNameJa} {emp.firstNameJa}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Copy to others */}
                      <button
                        type="button"
                        onClick={() => handleCopyToOthers(slot.dayOfWeek)}
                        disabled={!slot.isEnabled}
                        className="ml-auto px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent flex items-center gap-1"
                      >
                        {copyFromDay === slot.dayOfWeek ? (
                          <>
                            <i className="bi bi-check2" /> {t('ism_copied')}
                          </>
                        ) : (
                          <>
                            <i className="bi bi-copy" /> {t('ism_copy_to_others')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              <i className="bi bi-info-circle mr-1" />
              {t('ism_generate_footer')}
            </p>
          </div>
        </div>
      )}

      {/* ========== Create / Edit Master Modal ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-700">
                {editingMasterId != null ? t('ism_edit') : t('ism_add')}
              </h3>
            </div>

            <div className="p-5 space-y-5">
              {/* Master name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('ism_name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('ism_name')}
                />
              </div>

              {/* Meeting type radio */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('ism_meeting_type')}</label>
                <div className="flex items-center gap-4">
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    form.meetingType === 'GOOGLE_MEET'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="meetingType"
                      value="GOOGLE_MEET"
                      checked={form.meetingType === 'GOOGLE_MEET'}
                      onChange={() => setForm((f) => ({ ...f, meetingType: 'GOOGLE_MEET' }))}
                      className="hidden"
                    />
                    <i className="bi bi-camera-video text-indigo-500" />
                    <span className="text-sm font-bold">{t('ism_google_meet')}</span>
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    form.meetingType === 'ZOOM'
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="meetingType"
                      value="ZOOM"
                      checked={form.meetingType === 'ZOOM'}
                      onChange={() => setForm((f) => ({ ...f, meetingType: 'ZOOM' }))}
                      className="hidden"
                    />
                    <i className="bi bi-camera-video-fill text-violet-500" />
                    <span className="text-sm font-bold">{t('ism_zoom')}</span>
                  </label>
                </div>
              </div>

              {/* Zoom fields (only when Zoom selected) */}
              {form.meetingType === 'ZOOM' && (
                <div className="space-y-3 p-4 bg-violet-50/50 rounded-xl border border-violet-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">{t('ism_zoom_url')}</label>
                    <input
                      type="url"
                      value={form.zoomUrl}
                      onChange={(e) => setForm((f) => ({ ...f, zoomUrl: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('ism_zoom_meeting_number')}</label>
                      <input
                        type="text"
                        value={form.zoomMeetingNumber}
                        onChange={(e) => setForm((f) => ({ ...f, zoomMeetingNumber: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">{t('ism_zoom_password')}</label>
                      <input
                        type="text"
                        value={form.zoomPassword}
                        onChange={(e) => setForm((f) => ({ ...f, zoomPassword: e.target.value }))}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Job category checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('ism_job_categories')}</label>
                <p className="text-[11px] text-slate-400 mb-2">{t('ism_job_categories_desc')}</p>
                <div className="flex flex-wrap gap-2">
                  {jobCategories.map((jc) => {
                    const isSelected = form.jobCategoryIds.includes(jc.id);
                    const isAssignedElsewhere = otherAssigned.has(jc.id);
                    return (
                      <label
                        key={jc.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          isAssignedElsewhere
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-700 cursor-pointer'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isAssignedElsewhere}
                          onChange={() => toggleJobCategory(jc.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                        />
                        <span>{lang === 'en' && jc.nameEn ? jc.nameEn : jc.nameJa}</span>
                        {isAssignedElsewhere && (
                          <span className="text-[10px] text-slate-400">{t('ism_category_assigned_warning')}</span>
                        )}
                      </label>
                    );
                  })}
                  {jobCategories.length === 0 && (
                    <p className="text-xs text-slate-400">{t('ism_job_categories')}: --</p>
                  )}
                </div>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('ism_capacity')}</label>
                <div className="flex items-center gap-4">
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    !form.capacityUnlimited
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="capacityType"
                      checked={!form.capacityUnlimited}
                      onChange={() => setForm((f) => ({ ...f, capacityUnlimited: false, capacity: f.capacity || 1 }))}
                      className="hidden"
                    />
                    <span className="text-sm font-bold">{t('ism_capacity_limited')}</span>
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    form.capacityUnlimited
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="capacityType"
                      checked={form.capacityUnlimited}
                      onChange={() => setForm((f) => ({ ...f, capacityUnlimited: true }))}
                      className="hidden"
                    />
                    <span className="text-sm font-bold">{t('ism_unlimited')}</span>
                  </label>
                </div>
                {!form.capacityUnlimited && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.capacity}
                      onChange={(e) => setForm((f) => ({ ...f, capacity: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-24 border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-500">{t('ism_capacity_persons')}</span>
                  </div>
                )}
              </div>

              {/* Holiday slots */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('ism_holidays')}</label>
                <div className="flex items-center gap-4">
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    form.allowHolidays
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="allowHolidays"
                      checked={form.allowHolidays}
                      onChange={() => setForm((f) => ({ ...f, allowHolidays: true }))}
                      className="hidden"
                    />
                    <span className="text-sm font-bold">{t('ism_holidays_accept')}</span>
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    !form.allowHolidays
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="allowHolidays"
                      checked={!form.allowHolidays}
                      onChange={() => setForm((f) => ({ ...f, allowHolidays: false }))}
                      className="hidden"
                    />
                    <span className="text-sm font-bold">{t('ism_holidays_reject')}</span>
                  </label>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-sm font-bold text-slate-600">{t('active')}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                {t('btn_cancel')}
              </button>
              <button
                onClick={handleSaveMaster}
                disabled={submitting || !form.name.trim()}
                className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <i className="bi bi-hourglass-split animate-spin" /> {t('saving')}
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg" /> {editingMasterId != null ? t('btn_update') : t('btn_save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
