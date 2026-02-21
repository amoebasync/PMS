'use client';

import React, { useState, useEffect } from 'react';

export default function ApprovalsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 画面の表示モード（承認待ち or 履歴）
  const [viewMode, setViewMode] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'EXPENSE'>('ATTENDANCE');
  
  const [attendances, setAttendances] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  
  // バッジ表示用の件数
  const [pendingCounts, setPendingCounts] = useState({ attendance: 0, expense: 0 });
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const modeParam = viewMode === 'PENDING' ? 'pending' : 'history';
      const [profileRes, attRes, expRes, countsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch(`/api/approvals/attendance?view=${modeParam}`),
        fetch(`/api/approvals/expense?view=${modeParam}`),
        fetch('/api/approvals/pending-count') // 件数は常にPendingを取得
      ]);

      if (profileRes.ok) setCurrentUser(await profileRes.json());
      if (attRes.ok) setAttendances(await attRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (countsRes.ok) setPendingCounts(await countsRes.json());
      
      setSelectedIds(new Set()); 
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [viewMode]);

  const roles = currentUser?.roles?.map((r: any) => r.role?.code) || [];
  const isHrAdmin = roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN');
  const isManager = currentUser?._count?.subordinates > 0;
  const canAccess = isHrAdmin || isManager;

  const toggleSelect = (id: number) => {
    if (viewMode === 'HISTORY') return; // 履歴時は選択不可
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: any[]) => {
    if (viewMode === 'HISTORY') return;
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleApprove = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} 件の申請を「承認」しますか？`)) return;
    
    setIsSubmitting(true);
    const endpoint = activeTab === 'ATTENDANCE' ? '/api/approvals/attendance' : '/api/approvals/expense';
    
    try {
      const res = await fetch(endpoint, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'APPROVE' })
      });
      if (res.ok) {
        alert('承認しました！');
        fetchData();
      } else { alert('エラーが発生しました'); }
    } catch (e) { alert('通信エラー'); }
    setIsSubmitting(false);
  };

  const executeReject = async () => {
    setIsSubmitting(true);
    const endpoint = activeTab === 'ATTENDANCE' ? '/api/approvals/attendance' : '/api/approvals/expense';
    
    try {
      const res = await fetch(endpoint, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'REJECT', reason: rejectReason })
      });
      if (res.ok) {
        alert('申請を却下しました');
        setIsRejectModalOpen(false);
        setRejectReason('');
        fetchData();
      } else { alert('エラーが発生しました'); }
    } catch (e) { alert('通信エラー'); }
    setIsSubmitting(false);
  };

  if (isLoading && !currentUser) return <div className="p-10 text-center text-slate-500">読み込み中...</div>;
  if (!canAccess) return <div className="p-10 text-center text-rose-500 font-bold"><i className="bi bi-shield-lock text-3xl block mb-2"></i>この画面にアクセスする権限がありません。<br/><span className="text-sm font-normal">部下のいない一般社員は、この画面を利用できません。</span></div>;

  const currentItems = activeTab === 'ATTENDANCE' ? attendances : expenses;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 relative">
      <div className="flex justify-between items-end border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-check2-square text-indigo-600"></i> 人事・経費の承認
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isHrAdmin ? '全社員から申請された勤怠、休暇、経費の確認と承認を行います。' : 'あなたの部下から申請された勤怠、休暇、経費の確認と承認を行います。'}
          </p>
        </div>

        {/* 承認待ち / 履歴 の切り替えトグル */}
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
          <button 
            onClick={() => setViewMode('PENDING')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'PENDING' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="bi bi-inbox mr-1"></i> 承認待ち
          </button>
          <button 
            onClick={() => setViewMode('HISTORY')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'HISTORY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="bi bi-clock-history mr-1"></i> 承認履歴
          </button>
        </div>
      </div>

      {/* サブタブ (勤怠 / 経費) と 件数バッジ */}
      <div className="flex border-b border-slate-200 gap-2">
        <button onClick={() => { setActiveTab('ATTENDANCE'); setSelectedIds(new Set()); }} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'ATTENDANCE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          勤怠・休暇 
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${pendingCounts.attendance > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {pendingCounts.attendance}
          </span>
        </button>
        <button onClick={() => { setActiveTab('EXPENSE'); setSelectedIds(new Set()); }} className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'EXPENSE' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          交通費・経費
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${pendingCounts.expense > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {pendingCounts.expense}
          </span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
            <tr>
              {viewMode === 'PENDING' && (
                <th className="px-4 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={currentItems.length > 0 && selectedIds.size === currentItems.length}
                    onChange={() => toggleSelectAll(currentItems)}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer" 
                    disabled={currentItems.length === 0}
                  />
                </th>
              )}
              <th className="px-4 py-4 font-semibold">申請者</th>
              <th className="px-4 py-4 font-semibold">該当日</th>
              {activeTab === 'ATTENDANCE' ? (
                <>
                  <th className="px-4 py-4 font-semibold">内容 (種類)・時間</th>
                  <th className="px-4 py-4 font-semibold">実働</th>
                  <th className="px-4 py-4 font-semibold">備考・理由</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-4 font-semibold">種別</th>
                  <th className="px-4 py-4 font-semibold text-right">金額</th>
                  <th className="px-4 py-4 font-semibold">内容・経路</th>
                </>
              )}
              {viewMode === 'HISTORY' && (
                <th className="px-4 py-4 font-semibold text-center bg-slate-100">承認結果</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentItems.length === 0 && !isLoading ? (
              <tr><td colSpan={7} className="py-16 text-center text-slate-400 font-bold"><i className={`bi ${viewMode === 'PENDING' ? 'bi-inbox' : 'bi-clock-history'} text-3xl block mb-2 opacity-50`}></i>データがありません</td></tr>
            ) : (
              currentItems.map((item) => (
                <tr key={item.id} className={`hover:bg-indigo-50/30 transition-colors ${viewMode === 'PENDING' ? 'cursor-pointer' : ''} ${selectedIds.has(item.id) ? 'bg-indigo-50/50' : ''}`} onClick={() => toggleSelect(item.id)}>
                  
                  {viewMode === 'PENDING' && (
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                    </td>
                  )}

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {item.employee.avatarUrl ? (
                        <img src={item.employee.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {item.employee.lastNameJa.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800">{item.employee.lastNameJa} {item.employee.firstNameJa}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.employee.employeeCode}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-4 font-mono font-bold text-slate-600">{new Date(item.date).toLocaleDateString('ja-JP')}</td>
                  
                  {activeTab === 'ATTENDANCE' ? (
                    <>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={`px-2 py-0.5 text-[10px] w-fit font-bold rounded ${item.attendanceType.isDeducting ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {item.attendanceType.name}
                          </span>
                          {/* ★ 追加: 勤務時間があれば表示する */}
                          {item.attendanceType.isWorking && item.startTime && item.endTime && (
                            <span className="text-xs font-mono font-bold text-indigo-600">
                              <i className="bi bi-clock mr-1 text-slate-400"></i>
                              {item.startTime} <span className="text-slate-400 mx-0.5">〜</span> {item.endTime}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 font-bold">{item.workHours > 0 ? `${item.workHours} h` : '-'}</td>
                      <td className="px-4 py-4 text-slate-500 text-xs truncate max-w-[200px]" title={item.note}>{item.note || '-'}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] rounded font-bold">{item.type === 'TRANSPORTATION' ? '交通費' : 'その他経費'}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-indigo-600 text-base">¥{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-4 text-slate-600 text-xs truncate max-w-[250px]" title={item.description}>{item.description}</td>
                    </>
                  )}

                  {/* ★ 追加: 履歴モードの場合の「承認結果」列 */}
                  {viewMode === 'HISTORY' && (
                    <td className="px-4 py-4 text-center bg-slate-50/50 border-l border-slate-100">
                      <div className="flex flex-col items-center gap-1">
                        {item.status === 'APPROVED' ? (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold"><i className="bi bi-check-circle-fill"></i> 承認済</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold"><i className="bi bi-x-circle-fill"></i> 却下</span>
                        )}
                        <div className="text-[9px] font-bold text-slate-500 mt-1">
                          {item.approver ? `${item.approver.lastNameJa} ${item.approver.firstNameJa}` : '自動処理'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          {item.approvedAt ? new Date(item.approvedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                      </div>
                    </td>
                  )}

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* フローティング アクション バー (承認待ちモード かつ 選択時のみ表示) */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 transition-all duration-300 z-50 ${viewMode === 'PENDING' && selectedIds.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-indigo-500 rounded-full font-black text-xs">{selectedIds.size}</span>
          <span className="text-sm font-bold tracking-wide">件の申請を選択中</span>
        </div>
        <div className="w-px h-8 bg-slate-600"></div>
        <div className="flex gap-3">
          <button onClick={() => setIsRejectModalOpen(true)} className="px-5 py-2.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
            <i className="bi bi-x-circle-fill"></i> 却下 (差し戻し)
          </button>
          <button onClick={handleApprove} disabled={isSubmitting} className="px-8 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2">
            <i className="bi bi-check-circle-fill"></i> 一括で承認する
          </button>
        </div>
      </div>

      {/* 却下用モーダル */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="text-lg font-black text-slate-800 text-center mb-2">選択した {selectedIds.size} 件を却下しますか？</h3>
            <p className="text-slate-500 text-xs text-center mb-6">※有給休暇を却下した場合は、残日数が自動で返還されます。</p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-rose-600 mb-2">却下理由 (申請者に通知されます・任意)</label>
              <textarea 
                value={rejectReason} 
                onChange={e => setRejectReason(e.target.value)} 
                className="w-full border border-rose-200 bg-rose-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 outline-none h-24"
                placeholder="例: 領収書の添付がないため、再度申請してください。"
              ></textarea>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={() => setIsRejectModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">キャンセル</button>
              <button onClick={executeReject} disabled={isSubmitting} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50">
                {isSubmitting ? '処理中...' : '却下を確定する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}