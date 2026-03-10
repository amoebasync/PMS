'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';

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

type InterviewSlotMasterOption = {
  id: number;
  name: string;
  meetingType: 'GOOGLE_MEET' | 'ZOOM';
  isActive: boolean;
};

type InterviewSlot = {
  id: number;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  jobCategoryId: number | null;
  jobCategory: JobCategory | null;
  interviewer: EmployeeOption | null;
  interviewSlotMaster?: InterviewSlotMasterOption | null;
  applicant: {
    id: number;
    name: string;
    email: string;
  } | null;
};

export default function InterviewSlotManager() {
  const { showToast, showConfirm } = useNotification();
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [masters, setMasters] = useState<InterviewSlotMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // フォーム状態
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('10:00');
  const [formEndTime, setFormEndTime] = useState('11:00');
  const [formJobCategoryId, setFormJobCategoryId] = useState<string>('');
  const [formInterviewerId, setFormInterviewerId] = useState<string>('');
  const [formMasterId, setFormMasterId] = useState<string>('');

  // フィルター
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchSlots = async () => {
    try {
      const res = await fetch(`/api/interview-slots?month=${filterMonth}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchJobCategories = async () => {
    try {
      const res = await fetch('/api/job-categories/public');
      if (res.ok) {
        const data = await res.json();
        setJobCategories(data || []);
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

  const fetchMasters = async () => {
    try {
      const res = await fetch('/api/interview-slot-masters');
      if (res.ok) {
        const data = await res.json();
        setMasters((data || []).filter((m: InterviewSlotMasterOption) => m.isActive));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchJobCategories();
    fetchEmployees();
    fetchMasters();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSlots();
  }, [filterMonth]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formStartTime || !formEndTime) {
      showToast('日付と時間を入力してください', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const startTime = new Date(`${formDate}T${formStartTime}:00`);
      const endTime = new Date(`${formDate}T${formEndTime}:00`);

      const res = await fetch('/api/interview-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          jobCategoryId: formJobCategoryId ? Number(formJobCategoryId) : null,
          interviewerId: formInterviewerId ? Number(formInterviewerId) : null,
          interviewSlotMasterId: formMasterId ? Number(formMasterId) : null,
        }),
      });

      if (res.ok) {
        showToast('スロットを追加しました', 'success');
        setShowAddModal(false);
        setFormDate('');
        setFormStartTime('10:00');
        setFormEndTime('11:00');
        setFormJobCategoryId('');
        setFormInterviewerId('');
        setFormMasterId('');
        fetchSlots();
      } else {
        const err = await res.json();
        showToast(err.error || '追加に失敗しました', 'error');
      }
    } catch (e) {
      showToast('追加に失敗しました', 'error');
    }
    setSubmitting(false);
  };

  const handleDeleteSlot = async (slot: InterviewSlot) => {
    if (slot.isBooked) {
      showToast('予約済みのスロットは削除できません', 'error');
      return;
    }
    const confirmed = await showConfirm(
      `${new Date(slot.startTime).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })} ${new Date(slot.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })} のスロットを削除しますか？`,
      { variant: 'danger', confirmLabel: '削除' }
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/interview-slots/${slot.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('スロットを削除しました', 'success');
        fetchSlots();
      } else {
        const err = await res.json();
        showToast(err.error || '削除に失敗しました', 'error');
      }
    } catch (e) {
      showToast('削除に失敗しました', 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  };

  return (
    <>
      {/* スロットマスタ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">面接スロットマスタ</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2"
          >
            <i className="bi bi-plus-lg" /> 追加
          </button>
        </div>

        {/* フィルター */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
          <label className="text-sm text-slate-600 font-medium">表示月:</label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* スロット一覧 */}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-400">
              <i className="bi bi-hourglass-split text-xl animate-spin mr-2" />
              読み込み中...
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <i className="bi bi-calendar-x text-3xl mb-2 block" />
              <p className="text-sm">この月にスロットはありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    slot.isBooked
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="w-24 text-sm font-medium text-slate-700">
                    {formatDate(slot.startTime)}
                  </div>
                  <div className="text-sm text-slate-600">
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </div>
                  {/* マスタ名 */}
                  <div className="w-28">
                    {slot.interviewSlotMaster ? (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        slot.interviewSlotMaster.meetingType === 'ZOOM'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {slot.interviewSlotMaster.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </div>
                  <div className="flex-1">
                    {slot.jobCategory ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                        {slot.jobCategory.nameJa}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-medium">
                        全職種
                      </span>
                    )}
                  </div>
                  <div className="w-28">
                    {slot.interviewer ? (
                      <span className="text-xs text-slate-600 font-medium">
                        <i className="bi bi-person-badge mr-1" />
                        {slot.interviewer.lastNameJa} {slot.interviewer.firstNameJa}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">担当者未設定</span>
                    )}
                  </div>
                  <div className="w-32 text-right">
                    {slot.isBooked && slot.applicant ? (
                      <span className="text-xs text-amber-700 font-medium">
                        <i className="bi bi-person-fill mr-1" />
                        {slot.applicant.name}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">
                        <i className="bi bi-check-circle mr-1" />
                        空き
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteSlot(slot)}
                    disabled={slot.isBooked}
                    className="text-rose-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={slot.isBooked ? '予約済みのため削除不可' : '削除'}
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto p-6">
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center -mt-4 mb-3">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-slate-800 text-lg">面接スロット追加</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center"
              >
                <i className="bi bi-x text-xl" />
              </button>
            </div>

            <form onSubmit={handleAddSlot} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  日付 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    開始時刻 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    required
                    className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    終了時刻 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    required
                    className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* マスタ選択 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  面接マスタ
                </label>
                <select
                  value={formMasterId}
                  onChange={(e) => setFormMasterId(e.target.value)}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">未設定</option>
                  {masters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.meetingType === 'ZOOM' ? 'Zoom' : 'Google Meet'})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  マスタを選択すると、面接方法（Google Meet / Zoom）が自動的に設定されます
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  対象職種
                </label>
                <select
                  value={formJobCategoryId}
                  onChange={(e) => setFormJobCategoryId(e.target.value)}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">全職種（共通）</option>
                  {jobCategories.map((jc) => (
                    <option key={jc.id} value={jc.id}>
                      {jc.nameJa}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  「全職種」を選択すると、どの職種の応募者も選択可能なスロットになります
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  面接担当者
                </label>
                <select
                  value={formInterviewerId}
                  onChange={(e) => setFormInterviewerId(e.target.value)}
                  className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">未設定</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.lastNameJa} {emp.firstNameJa}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  担当者を設定すると、面接作成時にカレンダー招待が送信されます
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {submitting ? '追加中...' : '追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
