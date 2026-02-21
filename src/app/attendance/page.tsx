'use client';

import React, { useState, useEffect } from 'react';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'EXPENSE'>('ATTENDANCE');
  const [isLoading, setIsLoading] = useState(true);

  // --- 勤怠用State ---
  const [attendances, setAttendances] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [summaryOffset, setSummaryOffset] = useState(0); // 0:今週/今月, -1:先週/先月...
  
  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toLocaleDateString('sv-SE'),
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 60,
    note: '',
    saveAsDefault: false // ★ デフォルト保存フラグ
  });

  // --- 経費用State ---
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toLocaleDateString('sv-SE'),
    type: 'TRANSPORTATION',
    amount: '',
    description: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [attRes, sumRes, expRes] = await Promise.all([
        fetch('/api/attendance'),
        fetch(`/api/attendance/summary?offset=${summaryOffset}`), // ★ オフセット付き
        fetch('/api/expenses')
      ]);
      
      if (attRes.ok) setAttendances(await attRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
        // 初回ロード時のみ、フォームにデフォルト時間をセット
        if (summaryOffset === 0 && attendanceForm.startTime === '09:00' && sumData.defaults) {
          setAttendanceForm(prev => ({
            ...prev,
            startTime: sumData.defaults.startTime,
            endTime: sumData.defaults.endTime,
            breakMinutes: sumData.defaults.breakMinutes
          }));
        }
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [summaryOffset]);

  // ★ 打刻処理（新規＆編集 共通）
  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attendanceForm)
      });
      if (res.ok) {
        alert('勤怠を記録しました！');
        setAttendanceForm(prev => ({ ...prev, note: '', saveAsDefault: false }));
        fetchData();
      } else {
        alert('打刻に失敗しました');
      }
    } catch (err) { alert('通信エラーが発生しました'); }
    setIsSubmitting(false);
  };

  // ★ 追加: 申請の取り下げ（削除）
  const handleDeleteAttendance = async (dateStr: string) => {
    if (!confirm(`${new Date(dateStr).toLocaleDateString()} の申請を取り下げますか？`)) return;
    try {
      const res = await fetch(`/api/attendance?date=${dateStr.split('T')[0]}`, { method: 'DELETE' });
      if (res.ok) {
        alert('申請を取り下げました。');
        fetchData();
      } else {
        alert('取り下げに失敗しました。');
      }
    } catch (e) { alert('エラーが発生しました。'); }
  };

  // ★ 追加: 編集ボタンを押した時（フォームにセット）
  const handleEditAttendance = (att: any) => {
    setAttendanceForm({
      date: att.date.split('T')[0],
      startTime: att.startTime,
      endTime: att.endTime,
      breakMinutes: att.breakMinutes,
      note: att.note || '',
      saveAsDefault: false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' }); // フォームまでスクロール
  };

  // 経費の申請処理
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseForm)
      });
      if (res.ok) {
        alert('経費を申請しました！');
        setExpenseForm(prev => ({ ...prev, amount: '', description: '' }));
        fetchData();
      } else {
        alert('申請に失敗しました');
      }
    } catch (err) { alert('通信エラーが発生しました'); }
    setIsSubmitting(false);
  };

  // ★ サマリーの動的タイトル生成
  const getSummaryTitle = () => {
    if (!summary) return '給与見込み';
    const period = summary.salaryType === 'MONTHLY' ? '月給' : '週給';
    return summary.isPast ? `${period} 支給額` : `今${period === '月給' ? '月' : '週'}の${period}見込み`;
  };

  if (isLoading && !summary) return <div className="p-10 text-center text-slate-500">読み込み中...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      
      <div className="flex justify-between items-end border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-clock-history text-indigo-600"></i> マイ勤怠・経費
          </h1>
          <p className="text-slate-500 text-sm mt-1">日々の打刻、給与の確認、経費の申請を行います。</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('ATTENDANCE')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'ATTENDANCE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><i className="bi bi-calendar-check mr-2"></i> 勤怠・給与確認</button>
        <button onClick={() => setActiveTab('EXPENSE')} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'EXPENSE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><i className="bi bi-receipt mr-2"></i> 経費申請</button>
      </div>

      {activeTab === 'ATTENDANCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="space-y-6">
            
            {/* ★ 改修: サマリーカード (はみ出し防止・コンパクトUI) */}
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-lg p-5 text-white flex flex-col justify-between">
              
              {/* タイトルと日付コントローラーを「上下」に配置してスッキリさせる */}
              <div className="flex flex-col gap-3 mb-4 border-b border-white/20 pb-4">
                <h3 className="font-bold text-lg leading-none mt-1">
                  <i className="bi bi-wallet2 mr-2"></i> {getSummaryTitle()}
                </h3>
                
                {/* スライドコントローラー (カードの幅いっぱいに広げてボタンを両端に配置) */}
                <div className="flex items-center justify-between bg-black/20 p-1.5 rounded-lg w-full shadow-inner">
                  <button onClick={() => setSummaryOffset(o => o - 1)} className="hover:bg-white/20 rounded w-7 h-7 flex items-center justify-center transition-colors shrink-0">
                    <i className="bi bi-chevron-left text-xs"></i>
                  </button>
                  <span className="text-[11px] font-mono tracking-tighter sm:tracking-normal px-2 truncate text-indigo-50 font-semibold">
                    {summary?.startDate?.replace(/-/g, '/')} ~ {summary?.endDate?.replace(/-/g, '/')}
                  </span>
                  <button onClick={() => setSummaryOffset(o => o + 1)} className="hover:bg-white/20 rounded w-7 h-7 flex items-center justify-center transition-colors shrink-0">
                    <i className="bi bi-chevron-right text-xs"></i>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-[10px] text-indigo-100 uppercase tracking-widest font-bold">合計金額</div>
                <div className="text-4xl font-black font-mono mt-1 drop-shadow-sm">
                  ¥{summary?.totalWage?.toLocaleString() || 0}
                </div>
              </div>
              <div className="flex justify-between text-sm bg-black/20 p-3 rounded-xl shadow-inner">
                <div>
                  <span className="text-indigo-200 text-xs">実労働時間</span> <br/>
                  <span className="font-bold">{summary?.totalHours || 0} h</span>
                </div>
                <div className="text-right">
                  <span className="text-indigo-200 text-xs">出勤日数</span> <br/>
                  <span className="font-bold">{summary?.records?.length || 0} 日</span>
                </div>
              </div>
            </div>

            {/* 打刻フォーム */}
            <form onSubmit={handleAttendanceSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2"><i className="bi bi-pencil-square mr-2 text-indigo-600"></i> 打刻・勤怠入力</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">勤務日</label>
                <input type="date" required value={attendanceForm.date} onChange={e => setAttendanceForm({...attendanceForm, date: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

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

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">備考 (遅刻・早退理由など)</label>
                <textarea rows={2} value={attendanceForm.note} onChange={e => setAttendanceForm({...attendanceForm, note: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
              </div>

              {/* ★ 追加: デフォルト設定のチェックボックス */}
              <label className="flex items-center gap-2 cursor-pointer mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                <input type="checkbox" checked={attendanceForm.saveAsDefault} onChange={e => setAttendanceForm({...attendanceForm, saveAsDefault: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                <span className="text-[11px] font-bold text-slate-600">この時間をデフォルト(テンプレート)として保存する</span>
              </label>

              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 mt-2">
                {isSubmitting ? '保存中...' : '勤怠を記録する'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800"><i className="bi bi-list-ul mr-2"></i> 直近の勤怠履歴</h3>
            </div>
            <div className="overflow-x-auto flex-1 p-5">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="pb-3 font-bold">日付</th>
                    <th className="pb-3 font-bold">時間</th>
                    <th className="pb-3 font-bold text-center">実働</th>
                    <th className="pb-3 font-bold text-right">日給</th>
                    <th className="pb-3 font-bold text-center">状態</th>
                    <th className="pb-3 font-bold text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendances.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-400">履歴がありません</td></tr>
                  )}
                  {attendances.map((att: any) => (
                    <tr key={att.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3 font-mono font-bold text-slate-700">{new Date(att.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })}</td>
                      <td className="py-3 text-[11px] sm:text-sm">{att.startTime} ~ {att.endTime} <span className="text-slate-400 ml-1">({att.breakMinutes}分休)</span></td>
                      <td className="py-3 font-bold text-center">{att.workHours}h</td>
                      <td className="py-3 text-right font-mono font-bold text-indigo-600">¥{(att.calculatedWage || 0).toLocaleString()}</td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${att.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : att.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {att.status}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        {/* ★ PENDINGの時のみ編集・削除ボタンを表示 */}
                        {att.status === 'PENDING' ? (
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditAttendance(att)} className="w-7 h-7 bg-blue-100 text-blue-600 rounded flex items-center justify-center hover:bg-blue-200" title="編集"><i className="bi bi-pencil"></i></button>
                            <button onClick={() => handleDeleteAttendance(att.date)} className="w-7 h-7 bg-rose-100 text-rose-600 rounded flex items-center justify-center hover:bg-rose-200" title="取り下げ(削除)"><i className="bi bi-trash3"></i></button>
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
      )}

      {/* 経費タブ (変更なし) */}
      {activeTab === 'EXPENSE' && (
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