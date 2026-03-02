'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';

const EMP_TYPE_MAP: Record<string, string> = { FULL_TIME: '正社員', PART_TIME: 'アルバイト', OUTSOURCE: '業務委託' };
const EMP_TYPE_COLOR: Record<string, string> = {
  FULL_TIME: 'bg-blue-50 text-blue-700 border-blue-200',
  PART_TIME: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OUTSOURCE: 'bg-violet-50 text-violet-700 border-violet-200',
};
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: '下書き', color: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: '確定済', color: 'bg-emerald-100 text-emerald-700' },
  PAID:      { label: '支払済', color: 'bg-blue-100 text-blue-700' },
};

type PayrollRecord = {
  id: number;
  employeeId: number;
  employmentType: string;
  periodStart: string;
  periodEnd: string;
  paymentCycle: string;
  baseSalary: number;
  allowance: number;
  workingDaysInPeriod: number;
  absentDays: number;
  absentDeduction: number;
  holidayWorkDays: number;
  totalWorkHours: number;
  healthInsurance: number;
  pensionInsurance: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID';
  note: string | null;
  employee: {
    id: number; employeeCode: string | null;
    lastNameJa: string; firstNameJa: string;
    employmentType: string; avatarUrl: string | null;
    branch?: { nameJa: string } | null;
    department?: { name: string } | null;
  };
};

const fmt = (n: number) => `¥${n.toLocaleString()}`;

export default function PayrollPage() {
  const { showToast, showConfirm } = useNotification();
  const today = new Date();
  const [cycle, setCycle] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [weekStart, setWeekStart] = useState(''); // ISO date string of Monday
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // システム設定の週開始曜日を取得して今週の開始日を初期値にセット
  useEffect(() => {
    fetch('/api/settings/system')
      .then(r => r.ok ? r.json() : { weekStartDay: '1' })
      .then((settings: Record<string, string>) => {
        const startDay = parseInt(settings.weekStartDay ?? '1'); // 0=日, 1=月, ...6=土
        const d = new Date();
        const currentDay = d.getDay(); // 0=日, 1=月, ...6=土
        const diff = (currentDay - startDay + 7) % 7;
        d.setDate(d.getDate() - diff);
        setWeekStart(d.toISOString().split('T')[0]);
      })
      .catch(() => {
        // フォールバック: 月曜始まり
        const d = new Date();
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        setWeekStart(d.toISOString().split('T')[0]);
      });
  }, []);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ cycle, status: filterStatus });
      if (cycle === 'MONTHLY') {
        params.set('year', String(year));
        params.set('month', String(month));
      } else if (weekStart) {
        params.set('weekStart', weekStart);
      }
      const res = await fetch(`/api/payroll?${params}`);
      if (res.ok) setRecords(await res.json());
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [cycle, year, month, weekStart, filterStatus]);

  const handleCalculate = async () => {
    const label = cycle === 'MONTHLY' ? `${year}年${month}月` : `週：${weekStart}〜`;
    const target = cycle === 'MONTHLY' ? '正社員（月次）' : 'アルバイト・業務委託（週次）';
    if (!await showConfirm(`${label} の ${target} の給与を一括計算します。既存の下書きは上書きされます。続行しますか？`, { variant: 'warning', title: '給与計算の確認', confirmLabel: '計算する' })) return;

    setIsCalculating(true);
    try {
      const body: any = { cycle };
      if (cycle === 'MONTHLY') { body.year = year; body.month = month; }
      else body.weekStart = weekStart;

      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`計算完了 / 作成:${data.created}件 / 更新:${data.updated}件 / スキップ:${data.skipped}件`, 'success');
        fetchRecords();
      } else {
        showToast(`エラー: ${data.error}`, 'error');
      }
    } catch (e) { showToast('通信エラーが発生しました', 'error'); }
    setIsCalculating(false);
  };

  const handleBatchConfirm = async () => {
    if (selectedIds.size === 0) return;
    if (!await showConfirm(`選択した ${selectedIds.size} 件を確定します。よろしいですか？`, { variant: 'primary', confirmLabel: '確定する' })) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/payroll/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'CONFIRMED' }),
          })
        )
      );
      setSelectedIds(new Set());
      fetchRecords();
    } catch (e) { showToast('確定処理に失敗しました', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!await showConfirm('この下書きレコードを削除しますか？', { variant: 'danger', confirmLabel: '削除する' })) return;
    const res = await fetch(`/api/payroll/${id}`, { method: 'DELETE' });
    if (res.ok) fetchRecords();
    else { const d = await res.json(); showToast(d.error, 'error'); }
  };

  const openEdit = (record: PayrollRecord) => {
    setEditRecord(record);
    setEditForm({
      absentDeduction: record.absentDeduction,
      healthInsurance: record.healthInsurance,
      pensionInsurance: record.pensionInsurance,
      employmentInsurance: record.employmentInsurance,
      incomeTax: record.incomeTax,
      residentTax: record.residentTax,
      note: record.note || '',
      status: record.status,
    });
  };

  const liveDeductions = editForm
    ? (parseInt(editForm.absentDeduction) || 0)
      + (parseInt(editForm.healthInsurance) || 0)
      + (parseInt(editForm.pensionInsurance) || 0)
      + (parseInt(editForm.employmentInsurance) || 0)
      + (parseInt(editForm.incomeTax) || 0)
      + (parseInt(editForm.residentTax) || 0)
    : 0;
  const liveNetPay = editRecord ? editRecord.grossPay - liveDeductions : 0;

  const handleSave = async (newStatus?: 'CONFIRMED' | 'PAID') => {
    if (!editRecord) return;
    setIsSaving(true);
    const body = { ...editForm, status: newStatus || editForm.status };
    const res = await fetch(`/api/payroll/${editRecord.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditRecord(null);
      fetchRecords();
    } else { const d = await res.json(); showToast(d.error, 'error'); }
    setIsSaving(false);
  };

  const filteredRecords = useMemo(() => records, [records]);

  const summary = useMemo(() => ({
    count: filteredRecords.length,
    grossTotal: filteredRecords.reduce((s, r) => s + r.grossPay, 0),
    netTotal: filteredRecords.reduce((s, r) => s + r.netPay, 0),
  }), [filteredRecords]);

  const draftIds = filteredRecords.filter(r => r.status === 'DRAFT').map(r => r.id);
  const allDraftSelected = draftIds.length > 0 && draftIds.every(id => selectedIds.has(id));

  const toggleAll = () => {
    if (allDraftSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(draftIds));
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-right';

  return (
    <div className="space-y-6">
      {/* 操作バー */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">計算サイクル</label>
          <div className="flex gap-2">
            {(['MONTHLY', 'WEEKLY'] as const).map(c => (
              <button key={c} onClick={() => setCycle(c)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${cycle === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                {c === 'MONTHLY' ? '月次（正社員）' : '週次（アルバイト・委託）'}
              </button>
            ))}
          </div>
        </div>

        {cycle === 'MONTHLY' ? (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">対象年</label>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer min-w-[90px]">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">対象月</label>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer min-w-[80px]">
                {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">週開始日</label>
            <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">ステータス</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
            <option value="ALL">すべて</option>
            <option value="DRAFT">下書き</option>
            <option value="CONFIRMED">確定済</option>
            <option value="PAID">支払済</option>
          </select>
        </div>

        <button onClick={handleCalculate} disabled={isCalculating}
          className="ml-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2">
          {isCalculating ? <><i className="bi bi-arrow-repeat animate-spin"></i> 計算中...</> : <><i className="bi bi-calculator-fill"></i> 一括計算を実行する</>}
        </button>
      </div>

      {/* 集計サマリー */}
      {!isLoading && filteredRecords.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '対象人数', value: `${summary.count} 名`, icon: 'bi-people-fill', color: 'text-slate-700' },
            { label: '総支給合計', value: fmt(summary.grossTotal), icon: 'bi-cash-coin', color: 'text-indigo-600' },
            { label: '差引支給合計', value: fmt(summary.netTotal), icon: 'bi-wallet2', color: 'text-emerald-600' },
          ].map(c => (
            <div key={c.label} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="text-xs font-bold text-slate-500 flex items-center gap-1"><i className={`bi ${c.icon}`}></i>{c.label}</div>
              <div className={`text-xl font-black font-mono mt-1 ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 一括確定ボタン */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <span className="text-sm font-bold text-indigo-700">{selectedIds.size} 件選択中</span>
          <button onClick={handleBatchConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1">
            <i className="bi bi-check2-circle"></i> 選択を確定する
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 text-sm hover:text-slate-700">キャンセル</button>
        </div>
      )}

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3">
                <input type="checkbox" checked={allDraftSelected} onChange={toggleAll} className="rounded" />
              </th>
              <th className="px-3 py-3 whitespace-nowrap">社員コード / 氏名</th>
              <th className="px-3 py-3 whitespace-nowrap">種別</th>
              <th className="px-3 py-3 whitespace-nowrap">期間</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">総支給</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">欠勤控除</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">社保計</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">所得税</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">住民税</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">差引支給</th>
              <th className="px-3 py-3 text-center whitespace-nowrap">ステータス</th>
              <th className="px-3 py-3 text-right w-px whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={12} className="p-8 text-center text-slate-400">読み込み中...</td></tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-12 text-center">
                  <i className="bi bi-calculator text-4xl text-slate-300 block mb-2"></i>
                  <p className="text-slate-400 text-sm">データがありません。「一括計算を実行する」で給与を計算してください。</p>
                </td>
              </tr>
            ) : filteredRecords.map(r => {
              const socialTotal = r.healthInsurance + r.pensionInsurance + r.employmentInsurance;
              const statusInfo = STATUS_MAP[r.status];
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-3">
                    {r.status === 'DRAFT' && (
                      <input type="checkbox" checked={selectedIds.has(r.id)}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          e.target.checked ? next.add(r.id) : next.delete(r.id);
                          setSelectedIds(next);
                        }} className="rounded" />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-mono text-slate-400">{r.employee.employeeCode || '-'}</div>
                    <div className="font-bold text-slate-800">{r.employee.lastNameJa} {r.employee.firstNameJa}</div>
                    {r.employee.branch && <div className="text-[10px] text-slate-400">{r.employee.branch.nameJa}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${EMP_TYPE_COLOR[r.employmentType] || 'bg-slate-50 text-slate-500'}`}>
                      {EMP_TYPE_MAP[r.employmentType] || r.employmentType}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(r.periodStart).toLocaleDateString('ja-JP', {month:'numeric',day:'numeric'})}〜{new Date(r.periodEnd).toLocaleDateString('ja-JP', {month:'numeric',day:'numeric'})}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">{fmt(r.grossPay)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    {r.absentDeduction > 0
                      ? <span className="text-rose-600">-{fmt(r.absentDeduction)}</span>
                      : r.totalWorkHours > 0
                        ? <span className="text-slate-400 text-[10px]">{r.totalWorkHours.toFixed(1)}h</span>
                        : '-'
                    }
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-600 whitespace-nowrap">{socialTotal > 0 ? fmt(socialTotal) : '-'}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-600 whitespace-nowrap">{r.incomeTax > 0 ? fmt(r.incomeTax) : '-'}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-600 whitespace-nowrap">{r.residentTax > 0 ? fmt(r.residentTax) : '-'}</td>
                  <td className="px-3 py-3 text-right font-mono font-black text-indigo-600 whitespace-nowrap">{fmt(r.netPay)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                    {r.holidayWorkDays > 0 && <div className="text-[9px] text-orange-500 mt-0.5">休日出勤 {r.holidayWorkDays}日</div>}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><i className="bi bi-pencil-square"></i></button>
                    {r.status === 'DRAFT' && (
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"><i className="bi bi-trash"></i></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 編集モーダル */}
      {editRecord && editForm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-6 py-4 flex justify-between items-center">
              <div className="text-white">
                <div className="text-xs font-mono opacity-70">{editRecord.employee.employeeCode}</div>
                <div className="text-lg font-black">{editRecord.employee.lastNameJa} {editRecord.employee.firstNameJa}</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {EMP_TYPE_MAP[editRecord.employmentType]} ／
                  {new Date(editRecord.periodStart).toLocaleDateString('ja-JP')} 〜 {new Date(editRecord.periodEnd).toLocaleDateString('ja-JP')}
                </div>
              </div>
              <button onClick={() => setEditRecord(null)} className="text-white/70 hover:text-white"><i className="bi bi-x-lg text-xl"></i></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 読み取り専用サマリー */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">基本給</div>
                  <div className="font-mono font-bold text-slate-700">{fmt(editRecord.baseSalary)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">手当</div>
                  <div className="font-mono font-bold text-slate-700">{fmt(editRecord.allowance)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">総支給額</div>
                  <div className="font-mono font-black text-lg text-indigo-600">{fmt(editRecord.grossPay)}</div>
                </div>
                {editRecord.employmentType === 'FULL_TIME' ? (
                  <>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">所定稼働日数</div>
                      <div className="font-bold text-slate-700">{editRecord.workingDaysInPeriod} 日</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">欠勤日数</div>
                      <div className="font-bold text-slate-700">{editRecord.absentDays} 日</div>
                    </div>
                    {editRecord.holidayWorkDays > 0 && (
                      <div>
                        <div className="text-[10px] text-orange-400 font-bold uppercase">休日出勤</div>
                        <div className="font-bold text-orange-600">{editRecord.holidayWorkDays} 日</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">総労働時間</div>
                    <div className="font-bold text-slate-700">{editRecord.totalWorkHours.toFixed(1)} 時間</div>
                  </div>
                )}
              </div>

              {/* 控除額編集 */}
              <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1"><i className="bi bi-dash-circle"></i> 控除額（編集可）</h3>
                <div className="grid grid-cols-2 gap-3">
                  {editRecord.employmentType === 'FULL_TIME' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">欠勤控除額</label>
                      <input type="number" value={editForm.absentDeduction} onChange={e => setEditForm((p:any) => ({...p, absentDeduction: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">健康保険料</label>
                    <input type="number" value={editForm.healthInsurance} onChange={e => setEditForm((p:any) => ({...p, healthInsurance: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">厚生年金保険料</label>
                    <input type="number" value={editForm.pensionInsurance} onChange={e => setEditForm((p:any) => ({...p, pensionInsurance: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">雇用保険料</label>
                    <input type="number" value={editForm.employmentInsurance} onChange={e => setEditForm((p:any) => ({...p, employmentInsurance: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">所得税</label>
                    <input type="number" value={editForm.incomeTax} onChange={e => setEditForm((p:any) => ({...p, incomeTax: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">住民税</label>
                    <input type="number" value={editForm.residentTax} onChange={e => setEditForm((p:any) => ({...p, residentTax: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                </div>
              </div>

              {/* ライブ計算 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-indigo-500">控除合計</div>
                  <div className="font-mono font-bold text-slate-700">{fmt(liveDeductions)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-indigo-500">差引支給額</div>
                  <div className="font-mono font-black text-2xl text-indigo-600">{fmt(liveNetPay)}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">備考</label>
                <textarea value={editForm.note} onChange={e => setEditForm((p:any) => ({...p, note: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={2}
                  disabled={editRecord.status === 'PAID'} />
              </div>
            </div>

            {/* フッター */}
            <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setEditRecord(null)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold text-sm">キャンセル</button>
              {editRecord.status !== 'PAID' && (
                <>
                  <button onClick={() => handleSave()} disabled={isSaving}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-lg transition-colors disabled:opacity-50">
                    保存する
                  </button>
                  {editRecord.status === 'DRAFT' && (
                    <button onClick={() => handleSave('CONFIRMED')} disabled={isSaving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-md transition-colors disabled:opacity-50 flex items-center gap-1">
                      <i className="bi bi-check2-circle"></i> 確定する
                    </button>
                  )}
                  {editRecord.status === 'CONFIRMED' && (
                    <button onClick={() => handleSave('PAID')} disabled={isSaving}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-md transition-colors disabled:opacity-50 flex items-center gap-1">
                      <i className="bi bi-wallet2"></i> 支払済にする
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
