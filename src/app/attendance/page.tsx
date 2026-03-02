'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';

export default function AttendancePage() {
  const { showToast, showConfirm } = useNotification();
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'EXPENSE'>('ATTENDANCE');
  const [isLoading, setIsLoading] = useState(true);

  // --- HR管理者向け ---
  const [isHrAdmin, setIsHrAdmin] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(''); // '' = 自分

  // --- 勤怠用State ---
  const [attendances, setAttendances] = useState<any[]>([]);
  const [attendanceTypes, setAttendanceTypes] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [summaryOffset, setSummaryOffset] = useState(0);

  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toLocaleDateString('sv-SE'),
    attendanceTypeId: '',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    note: '',
    saveAsDefault: false
  });

  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toLocaleDateString('sv-SE'), type: 'TRANSPORTATION', amount: '', description: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ロール確認 & 社員一覧取得
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        if (!profile) return;
        const roleCodes = profile.roles?.map((r: any) => r.role?.code) || [];
        if (roleCodes.includes('SUPER_ADMIN') || roleCodes.includes('HR_ADMIN')) {
          setIsHrAdmin(true);
          fetch('/api/employees')
            .then(r => r.ok ? r.json() : [])
            .then(emps => setEmployees(emps.filter((e: any) => e.isActive)));
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const empParam = selectedEmployeeId ? `employeeId=${selectedEmployeeId}&` : '';
      const [attRes, sumRes, expRes, typesRes] = await Promise.all([
        fetch(`/api/attendance${selectedEmployeeId ? `?employeeId=${selectedEmployeeId}` : ''}`),
        fetch(`/api/attendance/summary?${empParam}offset=${summaryOffset}`),
        fetch('/api/expenses'),
        fetch('/api/attendance/types')
      ]);

      if (attRes.ok) setAttendances(await attRes.json());
      if (expRes.ok) setExpenses(await expRes.json());

      let defaultTypeId = '';
      if (typesRes.ok) {
        const types = await typesRes.json();
        setAttendanceTypes(types);
        const workType = types.find((t: any) => t.code === 'WORK');
        if (workType) defaultTypeId = workType.id.toString();
      }

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
        if (summaryOffset === 0) {
          setAttendanceForm(prev => ({
            ...prev,
            attendanceTypeId: defaultTypeId,
            startTime: sumData.defaults?.startTime || '09:00',
            endTime: sumData.defaults?.endTime || '18:00',
            breakMinutes: sumData.defaults?.breakMinutes ?? 60
          }));
        }
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [summaryOffset, selectedEmployeeId]);

  const handleEmployeeChange = (id: string) => {
    setSelectedEmployeeId(id);
    setSummaryOffset(0);
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const body: any = { ...attendanceForm };
      if (selectedEmployeeId) body.targetEmployeeId = parseInt(selectedEmployeeId);

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const targetName = selectedEmployee ? `${selectedEmployee.lastNameJa} ${selectedEmployee.firstNameJa}` : '自分';
        showToast(`${selectedEmployeeId ? `${targetName}の` : ''}勤怠を記録しました`, 'success');
        const workType = attendanceTypes.find((t: any) => t.code === 'WORK');
        setAttendanceForm(prev => ({ ...prev, note: '', saveAsDefault: false, attendanceTypeId: workType?.id?.toString() || '' }));
        fetchData();
      } else {
        const data = await res.json();
        showToast(`打刻エラー: ${data.error || '失敗しました'}`, 'error');
      }
    } catch (err) { showToast('通信エラーが発生しました', 'error'); }
    setIsSubmitting(false);
  };

  const handleDeleteAttendance = async (dateStr: string) => {
    const targetName = selectedEmployee ? `${selectedEmployee.lastNameJa} ${selectedEmployee.firstNameJa}` : '';
    const confirmMsg = selectedEmployeeId
      ? `${targetName} の ${new Date(dateStr).toLocaleDateString()} の勤怠を削除しますか？（※有給休暇の場合は残日数が返還されます）`
      : `${new Date(dateStr).toLocaleDateString()} の申請を取り下げますか？（※有給休暇の場合は残日数が返還されます）`;
    if (!await showConfirm(confirmMsg, { variant: 'danger', confirmLabel: '削除する' })) return;
    try {
      const url = selectedEmployeeId
        ? `/api/attendance?date=${dateStr.split('T')[0]}&employeeId=${selectedEmployeeId}`
        : `/api/attendance?date=${dateStr.split('T')[0]}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        showToast(selectedEmployeeId ? '勤怠を削除しました' : '申請を取り下げました', 'success');
        fetchData();
      } else {
        showToast('削除に失敗しました', 'error');
      }
    } catch (e) { showToast('エラーが発生しました', 'error'); }
  };

  const handleEditAttendance = (att: any) => {
    setAttendanceForm({
      date: att.date.split('T')[0],
      attendanceTypeId: att.attendanceTypeId.toString(),
      startTime: att.startTime || '09:00',
      endTime: att.endTime || '18:00',
      breakMinutes: att.breakMinutes || 60,
      note: att.note || '',
      saveAsDefault: false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expenseForm)
      });
      if (res.ok) {
        showToast('経費を申請しました', 'success');
        setExpenseForm(prev => ({ ...prev, amount: '', description: '' }));
        fetchData();
      } else { showToast('申請に失敗しました', 'error'); }
    } catch (err) { showToast('通信エラーが発生しました', 'error'); }
    setIsSubmitting(false);
  };

  const getSummaryTitle = () => {
    if (!summary) return '給与見込み';
    const period = summary.salaryType === 'MONTHLY' ? '月給' : '週給';
    return summary.isPast ? `${period} 支給額` : `今${period === '月給' ? '月' : '週'}の${period}見込み`;
  };

  const selectedType = attendanceTypes.find(t => t.id.toString() === attendanceForm.attendanceTypeId);
  const isWorking = selectedType?.isWorking || false;

  const availableTypes = attendanceTypes.filter(t => {
    if (summary?.employmentType === 'FULL_TIME') return true;
    return t.code === 'WORK' || t.code === 'ABSENCE';
  });

  const selectedEmployee = selectedEmployeeId
    ? employees.find(e => e.id.toString() === selectedEmployeeId)
    : null;

  // HR管理者が他社員を表示中かどうか
  const isViewingOther = isHrAdmin && !!selectedEmployeeId;

  if (isLoading && !summary) return <div className="p-10 text-center text-slate-500">読み込み中...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">


      {/* HR管理者向け: 対象社員セレクター */}
      {isHrAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-amber-800">
            <i className="bi bi-person-gear text-lg"></i>
            <span className="text-sm font-bold">管理者モード：対象社員</span>
          </div>
          <select
            value={selectedEmployeeId}
            onChange={e => handleEmployeeChange(e.target.value)}
            className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-amber-400 outline-none font-medium min-w-[200px]"
          >
            <option value="">自分の勤怠を表示</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.lastNameJa} {emp.firstNameJa}（{emp.employeeCode || emp.id}）
              </option>
            ))}
          </select>
          {isViewingOther && (
            <span className="text-sm font-bold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
              <i className="bi bi-eye-fill mr-1"></i>
              {selectedEmployee?.lastNameJa} {selectedEmployee?.firstNameJa} の勤怠を表示中
            </span>
          )}
        </div>
      )}

      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('ATTENDANCE')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'ATTENDANCE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><i className="bi bi-calendar-check mr-2"></i> 勤怠・給与確認</button>
        {/* 他社員表示中は経費タブを非表示 */}
        {!isViewingOther && (
          <button onClick={() => setActiveTab('EXPENSE')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'EXPENSE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><i className="bi bi-receipt mr-2"></i> 経費申請</button>
        )}
      </div>

      {activeTab === 'ATTENDANCE' && (
        <div className="space-y-6">

          {/* サマリーカード */}
          <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-lg p-5 text-white flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full md:w-auto flex-1">
              <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                <i className="bi bi-wallet2"></i>
                {isViewingOther
                  ? `${selectedEmployee?.lastNameJa} ${selectedEmployee?.firstNameJa} の${getSummaryTitle()}`
                  : getSummaryTitle()
                }
              </h3>
              <div className="flex items-center justify-between bg-black/20 p-1.5 rounded-lg max-w-sm shadow-inner">
                <button onClick={() => setSummaryOffset(o => o - 1)} className="hover:bg-white/20 rounded w-7 h-7 flex items-center justify-center transition-colors shrink-0"><i className="bi bi-chevron-left text-xs"></i></button>
                <span className="text-xs font-mono tracking-tighter sm:tracking-normal px-2 truncate text-indigo-50 font-semibold">
                  {summary?.startDate?.replace(/-/g, '/')} ~ {summary?.endDate?.replace(/-/g, '/')}
                </span>
                <button onClick={() => setSummaryOffset(o => o + 1)} className="hover:bg-white/20 rounded w-7 h-7 flex items-center justify-center transition-colors shrink-0"><i className="bi bi-chevron-right text-xs"></i></button>
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-wrap md:flex-nowrap items-center gap-4">
              <div className="pr-4 md:border-r border-white/20">
                <div className="text-[10px] text-indigo-100 uppercase tracking-widest font-bold">合計金額</div>
                <div className="text-3xl font-black font-mono mt-1 drop-shadow-sm">¥{summary?.totalWage?.toLocaleString() || 0}</div>
              </div>
              <div className="flex gap-3 text-sm">
                <div className="bg-black/20 px-4 py-2 rounded-xl shadow-inner text-center min-w-[70px]">
                  <div className="text-indigo-200 text-[10px]">実労働</div>
                  <div className="font-bold mt-0.5">{summary?.totalHours || 0} h</div>
                </div>
                <div className="bg-black/20 px-4 py-2 rounded-xl shadow-inner text-center min-w-[70px]">
                  <div className="text-indigo-200 text-[10px]">出勤</div>
                  <div className="font-bold mt-0.5">{summary?.records?.length || 0} 日</div>
                </div>
                {summary?.employmentType === 'FULL_TIME' && (
                  <div className="bg-white/20 px-4 py-2 rounded-xl shadow-sm border border-white/10 backdrop-blur-sm text-center min-w-[70px]">
                    <div className="text-indigo-50 text-[10px] whitespace-nowrap"><i className="bi bi-cup-hot-fill mr-1"></i>有給残</div>
                    <div className="font-bold mt-0.5">{summary?.paidLeaveBalance || 0} 日</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 打刻フォームと履歴テーブル */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 左側: 打刻フォーム */}
            <div className="space-y-6">
              <form onSubmit={handleAttendanceSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                  <i className="bi bi-pencil-square text-indigo-600"></i>
                  {isViewingOther
                    ? `${selectedEmployee?.lastNameJa} ${selectedEmployee?.firstNameJa} の勤怠入力`
                    : '打刻・勤怠入力'
                  }
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">勤務日</label>
                  <input type="date" required value={attendanceForm.date} onChange={e => setAttendanceForm({...attendanceForm, date: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">勤怠の種類</label>
                  <select required value={attendanceForm.attendanceTypeId} onChange={e => setAttendanceForm({...attendanceForm, attendanceTypeId: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none font-bold">
                    <option value="">選択してください</option>
                    {availableTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {selectedType?.isDeducting && <p className="text-[10px] text-emerald-600 mt-1 font-bold">※ 有給休暇を1日分消化します。</p>}
                </div>

                {isWorking ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">出勤時間</label>
                        <input type="time" required value={attendanceForm.startTime} onChange={e => setAttendanceForm({...attendanceForm, startTime: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">退勤時間</label>
                        <input type="time" required value={attendanceForm.endTime} onChange={e => setAttendanceForm({...attendanceForm, endTime: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">休憩時間 (分)</label>
                      <input type="number" required min="0" value={attendanceForm.breakMinutes} onChange={e => setAttendanceForm({...attendanceForm, breakMinutes: Number(e.target.value)})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 text-center border border-dashed border-slate-200">
                    <i className="bi bi-info-circle mr-1"></i> 休暇のため時間の入力は不要です
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">備考 (遅刻・早退・休暇理由など)</label>
                  <textarea rows={2} value={attendanceForm.note} onChange={e => setAttendanceForm({...attendanceForm, note: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
                </div>

                {/* デフォルト保存は自分の場合のみ表示 */}
                {isWorking && !isViewingOther && (
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <input type="checkbox" checked={attendanceForm.saveAsDefault} onChange={e => setAttendanceForm({...attendanceForm, saveAsDefault: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                    <span className="text-[11px] font-bold text-slate-600">この時間をデフォルトとして保存</span>
                  </label>
                )}

                <button type="submit" disabled={isSubmitting || !attendanceForm.attendanceTypeId} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 mt-2">
                  {isSubmitting ? '保存中...' : isViewingOther ? '代理登録する' : '記録を送信する'}
                </button>
              </form>
            </div>

            {/* 右側: 履歴テーブル */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">
                  <i className="bi bi-list-ul mr-2"></i>
                  {isViewingOther
                    ? `${selectedEmployee?.lastNameJa} ${selectedEmployee?.firstNameJa} の勤怠履歴`
                    : '直近の勤怠履歴'
                  }
                </h3>
              </div>
              <div className="overflow-x-auto flex-1 p-5">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="pb-3 font-bold">日付</th>
                      <th className="pb-3 font-bold">内容</th>
                      <th className="pb-3 font-bold text-center">実働</th>
                      <th className="pb-3 font-bold text-right">日給(計算)</th>
                      <th className="pb-3 font-bold text-center">状態</th>
                      <th className="pb-3 font-bold text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendances.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-400">履歴がありません</td></tr>
                    )}
                    {attendances.map((att: any) => (
                      <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-mono font-bold text-slate-700">
                          {new Date(att.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}
                        </td>
                        <td className="py-3">
                          {att.attendanceType?.isWorking ? (
                            <span className="text-[11px] sm:text-sm font-medium">{att.startTime} ~ {att.endTime} <span className="text-slate-400 ml-1">({att.breakMinutes}分休)</span></span>
                          ) : (
                            <span className="text-sm font-bold text-emerald-600">{att.attendanceType?.name || '休暇'}</span>
                          )}
                        </td>
                        <td className="py-3 font-bold text-center text-slate-600">{att.workHours > 0 ? `${att.workHours}h` : '-'}</td>
                        <td className="py-3 text-right font-mono font-bold text-indigo-600">¥{(att.calculatedWage || 0).toLocaleString()}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${att.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : att.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {/* 自分：PENDINGのみ操作可 / HR管理者が他社員：全ステータス削除可 */}
                          {(att.status === 'PENDING' || isViewingOther) ? (
                            <div className="flex justify-center gap-2">
                              {att.status === 'PENDING' && (
                                <button onClick={() => handleEditAttendance(att)} className="w-7 h-7 bg-blue-50 text-blue-600 border border-blue-200 rounded flex items-center justify-center hover:bg-blue-100 shadow-sm" title="編集"><i className="bi bi-pencil"></i></button>
                              )}
                              <button onClick={() => handleDeleteAttendance(att.date)} className="w-7 h-7 bg-rose-50 text-rose-600 border border-rose-200 rounded flex items-center justify-center hover:bg-rose-100 shadow-sm" title="削除"><i className="bi bi-trash3"></i></button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'EXPENSE' && !isViewingOther && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleExpenseSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 border-b pb-2"><i className="bi bi-cash-coin mr-2 text-indigo-600"></i> 新規経費の申請</h3>
            <div><label className="block text-xs font-bold text-slate-600 mb-1">発生日</label><input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            <div><label className="block text-xs font-bold text-slate-600 mb-1">経費種別</label><select required value={expenseForm.type} onChange={e => setExpenseForm({...expenseForm, type: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"><option value="TRANSPORTATION">交通費 (電車・バス等)</option><option value="OTHER">その他経費 (備品・接待交際費等)</option></select></div>
            <div><label className="block text-xs font-bold text-slate-600 mb-1">金額 (円)</label><input type="number" required min="1" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full border p-2 rounded-lg text-sm font-mono bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例: 1500" /></div>
            <div><label className="block text-xs font-bold text-slate-600 mb-1">目的・経路 (詳細)</label><textarea required rows={3} value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="例: 新宿駅〜東京駅 往復（〇〇社訪問のため）"></textarea></div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-slate-800 hover:bg-black text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50">{isSubmitting ? '処理中...' : '承認フローへ申請する'}</button>
            <p className="text-[10px] text-slate-400 text-center">※申請後、管理者の承認を経て給与に合算または別途振り込まれます。</p>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-200 bg-slate-50"><h3 className="font-bold text-slate-800"><i className="bi bi-list-ul mr-2"></i> 経費申請の履歴</h3></div>
            <div className="overflow-x-auto flex-1 p-5">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead><tr className="text-slate-500 border-b border-slate-200"><th className="pb-3 font-bold">発生日</th><th className="pb-3 font-bold">種別</th><th className="pb-3 font-bold">内容</th><th className="pb-3 font-bold text-right">金額</th><th className="pb-3 font-bold text-center">ステータス</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.length === 0 && (<tr><td colSpan={5} className="py-8 text-center text-slate-400">申請履歴がありません</td></tr>)}
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 font-mono text-slate-700">{new Date(exp.date).toLocaleDateString('ja-JP')}</td>
                      <td className="py-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded font-bold">{exp.type === 'TRANSPORTATION' ? '交通費' : 'その他'}</span></td>
                      <td className="py-3 max-w-[200px] truncate text-slate-600" title={exp.description}>{exp.description}</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-800">¥{exp.amount.toLocaleString()}</td>
                      <td className="py-3 text-center"><span className={`px-2 py-1 text-[10px] font-bold rounded-full ${exp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : exp.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{exp.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
