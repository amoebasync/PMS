'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

const EMP_TYPE_LABEL_KEYS: Record<string, string> = { FULL_TIME: 'emp_type_full_time', PART_TIME: 'emp_type_part_time', OUTSOURCE: 'emp_type_outsource' };
const EMP_TYPE_COLOR: Record<string, string> = {
  FULL_TIME: 'bg-blue-50 text-blue-700 border-blue-200',
  PART_TIME: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  OUTSOURCE: 'bg-violet-50 text-violet-700 border-violet-200',
};
const STATUS_STYLE: Record<string, string> = {
  DRAFT:     'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  PAID:      'bg-blue-100 text-blue-700',
};
const STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT:     'status_draft',
  CONFIRMED: 'status_confirmed',
  PAID:      'status_paid',
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
  expenseTotal: number;
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

type DailyRow = {
  id: number;
  date: string;
  type: 'attendance' | 'expense';
  attendanceType: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  workHours: number;
  wage: number;
  description: string | null;
  expenseType: string | null;
};

const fmt = (n: number) => `¥${n.toLocaleString()}`;

export default function PayrollPage() {
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('payroll');
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

  // 日別展開
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyEditable, setDailyEditable] = useState(false);
  const [dailySaving, setDailySaving] = useState(false);
  const [dailyDirty, setDailyDirty] = useState(false);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setDailyLoading(true);
    setDailyDirty(false);
    try {
      const res = await fetch(`/api/payroll/${id}/daily`);
      if (res.ok) {
        const data = await res.json();
        setDailyRows(data.rows || []);
        setDailyEditable(data.status === 'DRAFT');
      } else {
        setDailyRows([]);
        setDailyEditable(false);
      }
    } catch { setDailyRows([]); setDailyEditable(false); }
    setDailyLoading(false);
  };

  const updateDailyWage = (index: number, value: string) => {
    const num = parseInt(value) || 0;
    setDailyRows(prev => prev.map((r, i) => i === index ? { ...r, wage: num } : r));
    setDailyDirty(true);
  };

  const saveDailyChanges = async () => {
    if (!expandedId || !dailyDirty) return;
    setDailySaving(true);
    try {
      const changes = dailyRows.map(r => ({ id: r.id, type: r.type, wage: r.wage }));
      const res = await fetch(`/api/payroll/${expandedId}/daily`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      if (res.ok) {
        setDailyDirty(false);
        fetchRecords();
      } else {
        showToast(t('save_error'), 'error');
      }
    } catch { showToast(t('save_error'), 'error'); }
    setDailySaving(false);
  };

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

  // 展開を閉じる（週・月切替時）
  useEffect(() => { setExpandedId(null); }, [cycle, year, month, weekStart, filterStatus]);

  const handleCalculate = async () => {
    const label = cycle === 'MONTHLY' ? `${year}/${month}` : `${weekStart}~`;
    const target = cycle === 'MONTHLY' ? t('calculate_monthly_target') : t('calculate_weekly_target');
    if (!await showConfirm(t('calculate_confirm', { label, target }), { variant: 'warning', title: t('calculate_confirm_title'), confirmLabel: t('calculate_btn') })) return;

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
        showToast(t('calculate_success', { created: data.created, updated: data.updated, skipped: data.skipped }), 'success');
        fetchRecords();
      } else {
        showToast(t('calculate_error', { error: data.error }), 'error');
      }
    } catch (e) { showToast(t('comm_error'), 'error'); }
    setIsCalculating(false);
  };

  const handleBatchConfirm = async () => {
    if (selectedIds.size === 0) return;
    if (!await showConfirm(t('batch_confirm_msg', { count: selectedIds.size }), { variant: 'primary', confirmLabel: t('batch_confirm_btn') })) return;
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
    } catch (e) { showToast(t('batch_confirm_error'), 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!await showConfirm(t('delete_confirm'), { variant: 'danger', confirmLabel: t('delete_btn') })) return;
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
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_cycle')}</label>
          <div className="flex gap-2">
            {(['MONTHLY', 'WEEKLY'] as const).map(c => (
              <button key={c} onClick={() => setCycle(c)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${cycle === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}>
                {c === 'MONTHLY' ? t('cycle_monthly_label') : t('cycle_weekly_label')}
              </button>
            ))}
          </div>
        </div>

        {cycle === 'MONTHLY' ? (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_year_label')}</label>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer min-w-[90px]">
                {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}{t('filter_year_suffix')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_month_label')}</label>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer min-w-[80px]">
                {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}{t('filter_month_suffix')}</option>)}
              </select>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_week_start_label')}</label>
            <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_status')}</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer">
            <option value="ALL">{t('filter_status_all')}</option>
            <option value="DRAFT">{t('status_draft')}</option>
            <option value="CONFIRMED">{t('status_confirmed')}</option>
            <option value="PAID">{t('status_paid')}</option>
          </select>
        </div>

        <a href="/payroll/statement"
          className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2">
          <i className="bi bi-file-earmark-pdf"></i> 支払明細書
        </a>
        <button onClick={handleCalculate} disabled={isCalculating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center gap-2">
          {isCalculating ? <><i className="bi bi-arrow-repeat animate-spin"></i> {t('calculating')}</> : <><i className="bi bi-calculator-fill"></i> {t('btn_calculate_label')}</>}
        </button>
      </div>

      {/* 集計サマリー */}
      {!isLoading && filteredRecords.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('summary_count'), value: `${summary.count} ${t('summary_count_unit')}`, icon: 'bi-people-fill', color: 'text-slate-700' },
            { label: t('summary_gross_total'), value: fmt(summary.grossTotal), icon: 'bi-cash-coin', color: 'text-indigo-600' },
            { label: t('summary_net_total'), value: fmt(summary.netTotal), icon: 'bi-wallet2', color: 'text-emerald-600' },
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
          <span className="text-sm font-bold text-indigo-700">{t('selected_count', { count: selectedIds.size })}</span>
          <button onClick={handleBatchConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1">
            <i className="bi bi-check2-circle"></i> {t('btn_confirm_selected')}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-slate-500 text-sm hover:text-slate-700">{t('btn_cancel')}</button>
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
              <th className="px-3 py-3 whitespace-nowrap">{t('table_employee_code_name')}</th>
              <th className="px-3 py-3 whitespace-nowrap">{t('table_emp_type_label')}</th>
              <th className="px-3 py-3 whitespace-nowrap">{t('table_period_label')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('table_gross_pay')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('table_expense_total')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('table_absent_deduction')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('table_social_total')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('table_income_tax')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('table_resident_tax')}</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">{t('table_net_pay')}</th>
              <th className="px-3 py-3 text-center whitespace-nowrap">{t('table_status_label')}</th>
              <th className="px-3 py-3 text-right w-px whitespace-nowrap">{t('table_actions_label')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={13} className="p-8 text-center text-slate-400">{t('loading')}</td></tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-12 text-center">
                  <i className="bi bi-calculator text-4xl text-slate-300 block mb-2"></i>
                  <p className="text-slate-400 text-sm">{t('no_data_hint_full')}</p>
                </td>
              </tr>
            ) : filteredRecords.map(r => {
              const socialTotal = r.healthInsurance + r.pensionInsurance + r.employmentInsurance;
              const statusStyle = STATUS_STYLE[r.status] || '';
              const statusLabelKey = STATUS_LABEL_KEYS[r.status] || r.status;
              const isExpanded = expandedId === r.id;
              return (
                <React.Fragment key={r.id}>
                  <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/50' : ''}`}
                      onClick={() => toggleExpand(r.id)}>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
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
                      <div className="flex items-center gap-2">
                        <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} text-slate-400 text-[10px]`}></i>
                        <div>
                          <div className="text-xs font-mono text-slate-400">{r.employee.employeeCode || '-'}</div>
                          <div className="font-bold text-slate-800">{r.employee.lastNameJa} {r.employee.firstNameJa}</div>
                          {r.employee.branch && <div className="text-[10px] text-slate-400">{r.employee.branch.nameJa}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${EMP_TYPE_COLOR[r.employmentType] || 'bg-slate-50 text-slate-500'}`}>
                        {t(EMP_TYPE_LABEL_KEYS[r.employmentType] || r.employmentType)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(r.periodStart).toLocaleDateString('ja-JP', {month:'numeric',day:'numeric', timeZone:'Asia/Tokyo'})}〜{new Date(r.periodEnd).toLocaleDateString('ja-JP', {month:'numeric',day:'numeric', timeZone:'Asia/Tokyo'})}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">{fmt(r.grossPay)}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600 whitespace-nowrap">
                      {r.expenseTotal > 0 ? <span className="text-teal-600">{fmt(r.expenseTotal)}</span> : '-'}
                    </td>
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusStyle}`}>{t(statusLabelKey)}</span>
                      {r.holidayWorkDays > 0 && <div className="text-[9px] text-orange-500 mt-0.5">{t('holiday_work_days', { days: r.holidayWorkDays })}</div>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><i className="bi bi-pencil-square"></i></button>
                      {r.status === 'DRAFT' && (
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"><i className="bi bi-trash"></i></button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={13} className="p-0">
                        <div className="bg-slate-50 border-t border-b border-slate-200 px-8 py-4">
                          {dailyLoading ? (
                            <div className="text-center text-slate-400 text-sm py-3">
                              <i className="bi bi-arrow-repeat animate-spin mr-1"></i>{t('daily_loading')}
                            </div>
                          ) : dailyRows.length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-3">{t('daily_no_data')}</div>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                                  <th className="pb-2 text-left">{t('daily_date')}</th>
                                  <th className="pb-2 text-left">{t('daily_type')}</th>
                                  <th className="pb-2 text-center">{t('daily_time')}</th>
                                  <th className="pb-2 text-right">{t('daily_hours')}</th>
                                  <th className="pb-2 text-right">{t('daily_wage')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {dailyRows.map((d, i) => {
                                  const dayNames = ['日','月','火','水','木','金','土'];
                                  const dateObj = new Date(d.date);
                                  const dayOfWeek = dayNames[dateObj.getUTCDay()];
                                  const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
                                  const isExpense = d.type === 'expense';
                                  return (
                                    <tr key={i} className={isExpense ? 'bg-teal-50/50' : isWeekend ? 'text-rose-500' : ''}>
                                      <td className="py-1.5 font-mono text-xs">
                                        {dateObj.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', timeZone:'UTC' })}
                                        <span className="text-slate-400 ml-1">({dayOfWeek})</span>
                                      </td>
                                      <td className="py-1.5 text-xs text-slate-600">
                                        {isExpense ? (
                                          <span className="inline-flex items-center gap-1 text-teal-600">
                                            <i className="bi bi-receipt text-[10px]"></i>
                                            {d.attendanceType}
                                            {d.description && <span className="text-slate-400 ml-1 truncate max-w-[200px]" title={d.description}>({d.description})</span>}
                                          </span>
                                        ) : d.attendanceType}
                                      </td>
                                      <td className="py-1.5 text-xs text-center text-slate-500 font-mono">
                                        {isExpense ? '-' : d.startTime && d.endTime ? `${d.startTime}〜${d.endTime}` : '-'}
                                      </td>
                                      <td className="py-1.5 text-right font-mono text-xs">
                                        {isExpense ? '-' : `${d.workHours.toFixed(1)}h`}
                                      </td>
                                      <td className={`py-1.5 text-right font-mono font-bold text-xs ${isExpense ? 'text-teal-600' : ''}`}>
                                        {dailyEditable ? (
                                          <input
                                            type="number"
                                            value={d.wage}
                                            onChange={(e) => updateDailyWage(i, e.target.value)}
                                            className="w-24 text-right font-mono font-bold text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
                                          />
                                        ) : fmt(d.wage)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-slate-300">
                                  <td colSpan={3} className="pt-2 text-right font-bold text-xs text-slate-600">{t('daily_total')}</td>
                                  <td className="pt-2 text-right font-mono font-bold text-xs">
                                    {dailyRows.reduce((s, d) => s + (d.workHours || 0), 0).toFixed(1)}h
                                  </td>
                                  <td className="pt-2 text-right font-mono font-black text-indigo-600 text-xs">
                                    {fmt(dailyRows.reduce((s, d) => s + (d.wage || 0), 0))}
                                  </td>
                                </tr>
                                {dailyEditable && dailyDirty && (
                                  <tr>
                                    <td colSpan={5} className="pt-3 text-right">
                                      <button
                                        onClick={saveDailyChanges}
                                        disabled={dailySaving}
                                        className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                      >
                                        {dailySaving ? t('saving') : t('btn_save')}
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </tfoot>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 編集モーダル */}
      {editRecord && editForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-6 py-4 flex justify-between items-center">
              <div className="text-white">
                <div className="text-xs font-mono opacity-70">{editRecord.employee.employeeCode}</div>
                <div className="text-lg font-black">{editRecord.employee.lastNameJa} {editRecord.employee.firstNameJa}</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {t(EMP_TYPE_LABEL_KEYS[editRecord.employmentType])} /
                  {new Date(editRecord.periodStart).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })} 〜 {new Date(editRecord.periodEnd).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                </div>
              </div>
              <button onClick={() => setEditRecord(null)} className="text-white/70 hover:text-white"><i className="bi bi-x-lg text-xl"></i></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 読み取り専用サマリー */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{t('edit_base_salary')}</div>
                  <div className="font-mono font-bold text-slate-700">{fmt(editRecord.baseSalary)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{t('edit_allowance')}</div>
                  <div className="font-mono font-bold text-slate-700">{fmt(editRecord.allowance)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{t('edit_gross_pay')}</div>
                  <div className="font-mono font-black text-lg text-indigo-600">{fmt(editRecord.grossPay)}</div>
                </div>
                {editRecord.expenseTotal > 0 && (
                  <div>
                    <div className="text-[10px] text-teal-500 font-bold uppercase">{t('edit_expense_total')}</div>
                    <div className="font-mono font-bold text-teal-600">{fmt(editRecord.expenseTotal)}</div>
                  </div>
                )}
                {editRecord.employmentType === 'FULL_TIME' ? (
                  <>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{t('edit_working_days')}</div>
                      <div className="font-bold text-slate-700">{editRecord.workingDaysInPeriod} {t('days_unit')}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{t('edit_absent_days_label')}</div>
                      <div className="font-bold text-slate-700">{editRecord.absentDays} {t('days_unit')}</div>
                    </div>
                    {editRecord.holidayWorkDays > 0 && (
                      <div>
                        <div className="text-[10px] text-orange-400 font-bold uppercase">{t('edit_holiday_work')}</div>
                        <div className="font-bold text-orange-600">{editRecord.holidayWorkDays} {t('days_unit')}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{t('edit_total_work_hours')}</div>
                    <div className="font-bold text-slate-700">{editRecord.totalWorkHours.toFixed(1)} {t('hours_unit')}</div>
                  </div>
                )}
              </div>

              {/* 控除額編集 */}
              <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1"><i className="bi bi-dash-circle"></i> {t('edit_deductions_section')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {editRecord.employmentType === 'FULL_TIME' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">{t('edit_absent_deduction_label')}</label>
                      <input type="number" value={editForm.absentDeduction} onChange={e => setEditForm((p:any) => ({...p, absentDeduction: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('edit_health_insurance_label')}</label>
                    <input type="number" value={editForm.healthInsurance} onChange={e => setEditForm((p:any) => ({...p, healthInsurance: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('edit_pension_label')}</label>
                    <input type="number" value={editForm.pensionInsurance} onChange={e => setEditForm((p:any) => ({...p, pensionInsurance: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('edit_employment_insurance_label')}</label>
                    <input type="number" value={editForm.employmentInsurance} onChange={e => setEditForm((p:any) => ({...p, employmentInsurance: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('edit_income_tax_label')}</label>
                    <input type="number" value={editForm.incomeTax} onChange={e => setEditForm((p:any) => ({...p, incomeTax: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('edit_resident_tax_label')}</label>
                    <input type="number" value={editForm.residentTax} onChange={e => setEditForm((p:any) => ({...p, residentTax: e.target.value}))} className={inputCls} disabled={editRecord.status === 'PAID'} />
                  </div>
                </div>
              </div>

              {/* ライブ計算 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-indigo-500">{t('edit_deduction_total')}</div>
                  <div className="font-mono font-bold text-slate-700">{fmt(liveDeductions)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-indigo-500">{t('edit_net_pay_label')}</div>
                  <div className="font-mono font-black text-2xl text-indigo-600">{fmt(liveNetPay)}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">{t('edit_note_label')}</label>
                <textarea value={editForm.note} onChange={e => setEditForm((p:any) => ({...p, note: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={2}
                  disabled={editRecord.status === 'PAID'} />
              </div>
            </div>

            {/* フッター */}
            <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setEditRecord(null)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold text-sm">{t('btn_cancel')}</button>
              {editRecord.status !== 'PAID' && (
                <>
                  <button onClick={() => handleSave()} disabled={isSaving}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-lg transition-colors disabled:opacity-50">
                    {t('btn_save')}
                  </button>
                  {editRecord.status === 'DRAFT' && (
                    <button onClick={() => handleSave('CONFIRMED')} disabled={isSaving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-md transition-colors disabled:opacity-50 flex items-center gap-1">
                      <i className="bi bi-check2-circle"></i> {t('btn_confirm')}
                    </button>
                  )}
                  {editRecord.status === 'CONFIRMED' && (
                    <button onClick={() => handleSave('PAID')} disabled={isSaving}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-md transition-colors disabled:opacity-50 flex items-center gap-1">
                      <i className="bi bi-wallet2"></i> {t('btn_mark_paid')}
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
