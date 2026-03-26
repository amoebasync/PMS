'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WeeklyEntry {
  weekStart: string;
  employeeSalary: number;
  distributorSalary: number;
  employeeTransport: number;
  distributorTransport: number;
}

interface SummaryData {
  totals: {
    employeeSalary: number;
    distributorSalary: number;
    employeeTransport: number;
    distributorTransport: number;
    grandTotal: number;
  };
  weekly: WeeklyEntry[];
}

interface EmployeeRow {
  id: number;
  employeeCode: string;
  name: string;
  employmentType: string;
  department: string;
  departmentId: number | null;
  branch: string;
  branchId: number | null;
  totalWage: number;
  totalTransport: number;
  total: number;
}

interface DistributorRow {
  id: number;
  staffId: string;
  name: string;
  branch: string;
  branchId: number | null;
  totalSchedulePay: number;
  totalExpensePay: number;
  totalGrossPay: number;
}

interface DeptRow {
  id: number | null;
  name: string;
  employeeCount: number;
  totalWage: number;
  totalTransport: number;
}

interface BranchRow {
  id: number | null;
  name: string;
  employeeCount: number;
  distributorCount: number;
  employeeTotalWage: number;
  distributorTotalWage: number;
  employeeTotalTransport: number;
  distributorTotalTransport: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toSunday(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function getDefaultRange(): { start: string; end: string } {
  const now = new Date();
  const end = toSunday(now);
  end.setDate(end.getDate() + 6); // Saturday
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  return { start: formatDate(toSunday(start)), end: formatDate(end) };
}

function yen(n: number): string {
  return '¥' + n.toLocaleString();
}

function empTypeLabel(t: (k: string) => string, type: string): string {
  const map: Record<string, string> = {
    FULL_TIME: 'emp_type_full_time',
    PART_TIME: 'emp_type_part_time',
    OUTSOURCE: 'emp_type_outsource',
  };
  return t(map[type] || type);
}

function empTypeBadge(type: string): string {
  const map: Record<string, string> = {
    FULL_TIME: 'bg-blue-100 text-blue-700',
    PART_TIME: 'bg-amber-100 text-amber-700',
    OUTSOURCE: 'bg-purple-100 text-purple-700',
  };
  return map[type] || 'bg-slate-100 text-slate-600';
}

/* ------------------------------------------------------------------ */
/*  CSV Export                                                         */
/* ------------------------------------------------------------------ */

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type Tab = 'summary' | 'employees' | 'distributors' | 'departments';

export default function SalaryAnalysisPage() {
  const { t } = useTranslation('salary-analysis');
  const defaultRange = useMemo(() => getDefaultRange(), []);

  const [tab, setTab] = useState<Tab>('summary');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [loading, setLoading] = useState(false);

  // Data states
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [distributors, setDistributors] = useState<DistributorRow[]>([]);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);

  // Filters
  const [empSearch, setEmpSearch] = useState('');
  const [empTypeFilter, setEmpTypeFilter] = useState('');
  const [distSearch, setDistSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab, startDate, endDate });
      const res = await fetch(`/api/salary-analysis?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      switch (tab) {
        case 'summary':
          setSummary(data);
          break;
        case 'employees':
          setEmployees(data.employees || []);
          break;
        case 'distributors':
          setDistributors(data.distributors || []);
          break;
        case 'departments':
          setDepartments(data.departments || []);
          setBranches(data.branches || []);
          break;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quick range buttons
  const setQuickRange = (months: number) => {
    const now = new Date();
    const end = toSunday(now);
    end.setDate(end.getDate() + 6);
    const start = new Date(end);
    start.setMonth(start.getMonth() - months);
    setStartDate(formatDate(toSunday(start)));
    setEndDate(formatDate(end));
  };

  // Filtered data
  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (empSearch) {
      const q = empSearch.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q));
    }
    if (empTypeFilter) {
      list = list.filter(e => e.employmentType === empTypeFilter);
    }
    return list;
  }, [employees, empSearch, empTypeFilter]);

  const filteredDistributors = useMemo(() => {
    if (!distSearch) return distributors;
    const q = distSearch.toLowerCase();
    return distributors.filter(d => d.name.toLowerCase().includes(q) || d.staffId.toLowerCase().includes(q));
  }, [distributors, distSearch]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: t('tab_summary') },
    { key: 'employees', label: t('tab_employees') },
    { key: 'distributors', label: t('tab_distributors') },
    { key: 'departments', label: t('tab_departments') },
  ];

  return (
    <div className="space-y-4">
      {/* Date range picker */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center gap-3">
        <span className="text-xs font-bold text-slate-500">{t('period')}</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-slate-300 rounded-lg text-xs px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-slate-300 rounded-lg text-xs px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { label: t('quick_1m'), months: 1 },
            { label: t('quick_3m'), months: 3 },
            { label: t('quick_6m'), months: 6 },
            { label: t('quick_1y'), months: 12 },
          ].map(q => (
            <button
              key={q.months}
              onClick={() => setQuickRange(q.months)}
              className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              tab === tb.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 text-sm text-slate-500">{t('loading')}</span>
        </div>
      )}

      {/* Tab content */}
      {!loading && tab === 'summary' && summary && <SummaryTab data={summary} t={t} />}
      {!loading && tab === 'employees' && (
        <EmployeesTab
          employees={filteredEmployees}
          allEmployees={employees}
          search={empSearch}
          onSearchChange={setEmpSearch}
          typeFilter={empTypeFilter}
          onTypeFilterChange={setEmpTypeFilter}
          t={t}
        />
      )}
      {!loading && tab === 'distributors' && (
        <DistributorsTab
          distributors={filteredDistributors}
          allDistributors={distributors}
          search={distSearch}
          onSearchChange={setDistSearch}
          t={t}
        />
      )}
      {!loading && tab === 'departments' && (
        <DepartmentsTab departments={departments} branches={branches} t={t} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Tab                                                        */
/* ------------------------------------------------------------------ */

function SummaryTab({ data, t }: { data: SummaryData; t: (k: string, p?: Record<string, unknown>) => string }) {
  const { totals, weekly } = data;

  const cards = [
    { key: 'employeeSalary', label: t('card_employee_salary'), value: totals.employeeSalary, color: 'bg-blue-50 text-blue-600', icon: 'bi-person-badge' },
    { key: 'distributorSalary', label: t('card_distributor_salary'), value: totals.distributorSalary, color: 'bg-orange-50 text-orange-600', icon: 'bi-bicycle' },
    { key: 'employeeTransport', label: t('card_employee_transport'), value: totals.employeeTransport, color: 'bg-cyan-50 text-cyan-600', icon: 'bi-train-front' },
    { key: 'distributorTransport', label: t('card_distributor_transport'), value: totals.distributorTransport, color: 'bg-purple-50 text-purple-600', icon: 'bi-bus-front' },
    { key: 'grandTotal', label: t('card_grand_total'), value: totals.grandTotal, color: 'bg-indigo-600 text-white', icon: 'bi-calculator', isAccent: true },
  ];

  // Chart data formatting
  const chartData = weekly.map(w => ({
    ...w,
    label: `${parseInt(w.weekStart.split('-')[1])}/${parseInt(w.weekStart.split('-')[2])}`,
  }));

  const formatYAxis = (v: number) => {
    if (v >= 1_000_000) return `¥${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `¥${(v / 1_000).toFixed(0)}K`;
    return `¥${v}`;
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <div
            key={c.key}
            className={`rounded-xl shadow-sm border p-4 ${
              c.isAccent
                ? 'bg-indigo-600 border-indigo-700'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${c.color}`}>
                <i className={`bi ${c.icon}`} />
              </div>
              <span className={`text-[11px] font-bold ${c.isAccent ? 'text-indigo-200' : 'text-slate-500'}`}>
                {c.label}
              </span>
            </div>
            <div className={`text-xl font-bold ${c.isAccent ? 'text-white' : 'text-slate-800'}`}>
              {yen(c.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Line Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-4">{t('chart_title')}</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11, fill: '#94a3b8' }} width={70} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  employeeSalary: t('card_employee_salary'),
                  distributorSalary: t('card_distributor_salary'),
                  employeeTransport: t('card_employee_transport'),
                  distributorTransport: t('card_distributor_transport'),
                };
                return [yen(value), labels[name] || name];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  employeeSalary: t('card_employee_salary'),
                  distributorSalary: t('card_distributor_salary'),
                  employeeTransport: t('card_employee_transport'),
                  distributorTransport: t('card_distributor_transport'),
                };
                return labels[value] || value;
              }}
            />
            <Line type="monotone" dataKey="employeeSalary" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="distributorSalary" stroke="#f97316" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="employeeTransport" stroke="#06b6d4" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="distributorTransport" stroke="#a855f7" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Employees Tab                                                      */
/* ------------------------------------------------------------------ */

function EmployeesTab({
  employees,
  allEmployees,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  t,
}: {
  employees: EmployeeRow[];
  allEmployees: EmployeeRow[];
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  t: (k: string, p?: Record<string, unknown>) => string;
}) {
  const totals = employees.reduce(
    (acc, e) => ({
      wage: acc.wage + e.totalWage,
      transport: acc.transport + e.totalTransport,
      total: acc.total + e.total,
    }),
    { wage: 0, transport: 0, total: 0 },
  );

  const handleExport = () => {
    const headers = [t('col_employee_code'), t('col_name'), t('col_employment_type'), t('col_department'), t('col_wage_total'), t('col_transport'), t('col_total')];
    const rows = employees.map(e => [
      e.employeeCode,
      e.name,
      empTypeLabel(t, e.employmentType),
      e.department,
      String(e.totalWage),
      String(e.totalTransport),
      String(e.total),
    ]);
    downloadCSV('salary-analysis-employees.csv', headers, rows);
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">{t('col_name')}</label>
          <input
            type="text"
            placeholder={t('search_employee')}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="border border-slate-300 rounded-lg text-xs px-3 py-1.5 w-56 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">{t('filter_employment_type')}</label>
          <select
            value={typeFilter}
            onChange={e => onTypeFilterChange(e.target.value)}
            className="border border-slate-300 rounded-lg text-xs px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">{t('filter_all')}</option>
            <option value="FULL_TIME">{t('emp_type_full_time')}</option>
            <option value="PART_TIME">{t('emp_type_part_time')}</option>
            <option value="OUTSOURCE">{t('emp_type_outsource')}</option>
          </select>
        </div>
        <button
          onClick={handleExport}
          className="md:ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
        >
          <i className="bi bi-download mr-1" />
          {t('btn_csv_export')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_employee_code')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_name')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_employment_type')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_department')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_wage_total')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_transport')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <i className="bi bi-inbox text-3xl block mb-2" />
                    {t('no_data')}
                  </td>
                </tr>
              ) : (
                employees.map(e => (
                  <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-3 py-3 text-slate-500">{e.employeeCode}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{e.name}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${empTypeBadge(e.employmentType)}`}>
                        {empTypeLabel(t, e.employmentType)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{e.department}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{yen(e.totalWage)}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{yen(e.totalTransport)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{yen(e.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {employees.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={4} className="px-3 py-2.5 text-slate-600">
                    {t('total_row')}({employees.length}{t('persons')})
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-800">{yen(totals.wage)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{yen(totals.transport)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-800">{yen(totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Distributors Tab                                                   */
/* ------------------------------------------------------------------ */

function DistributorsTab({
  distributors,
  allDistributors,
  search,
  onSearchChange,
  t,
}: {
  distributors: DistributorRow[];
  allDistributors: DistributorRow[];
  search: string;
  onSearchChange: (v: string) => void;
  t: (k: string, p?: Record<string, unknown>) => string;
}) {
  const totals = distributors.reduce(
    (acc, d) => ({
      schedulePay: acc.schedulePay + d.totalSchedulePay,
      expensePay: acc.expensePay + d.totalExpensePay,
      grossPay: acc.grossPay + d.totalGrossPay,
    }),
    { schedulePay: 0, expensePay: 0, grossPay: 0 },
  );

  const handleExport = () => {
    const headers = [t('col_staff_id'), t('col_name'), t('col_branch'), t('col_schedule_pay'), t('col_expense_pay'), t('col_gross_pay')];
    const rows = distributors.map(d => [
      d.staffId,
      d.name,
      d.branch,
      String(d.totalSchedulePay),
      String(d.totalExpensePay),
      String(d.totalGrossPay),
    ]);
    downloadCSV('salary-analysis-distributors.csv', headers, rows);
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">{t('col_name')}</label>
          <input
            type="text"
            placeholder={t('search_distributor')}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="border border-slate-300 rounded-lg text-xs px-3 py-1.5 w-56 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button
          onClick={handleExport}
          className="md:ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
        >
          <i className="bi bi-download mr-1" />
          {t('btn_csv_export')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_staff_id')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_name')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_branch')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_schedule_pay')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_expense_pay')}</th>
                <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_gross_pay')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {distributors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <i className="bi bi-inbox text-3xl block mb-2" />
                    {t('no_data')}
                  </td>
                </tr>
              ) : (
                distributors.map(d => (
                  <tr key={d.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-3 py-3 text-slate-500">{d.staffId}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{d.name}</td>
                    <td className="px-3 py-3 text-slate-500">{d.branch}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{yen(d.totalSchedulePay)}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{yen(d.totalExpensePay)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">{yen(d.totalGrossPay)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {distributors.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={3} className="px-3 py-2.5 text-slate-600">
                    {t('total_row')}({distributors.length}{t('persons')})
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-800">{yen(totals.schedulePay)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{yen(totals.expensePay)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-800">{yen(totals.grossPay)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Departments Tab                                                    */
/* ------------------------------------------------------------------ */

function DepartmentsTab({
  departments,
  branches,
  t,
}: {
  departments: DeptRow[];
  branches: BranchRow[];
  t: (k: string, p?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Department section */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <i className="bi bi-diagram-3 text-indigo-500" />
          {t('dept_section_title')}
        </h3>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_department')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">{t('col_employee_count')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_emp_wage')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_emp_transport')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      <i className="bi bi-inbox text-3xl block mb-2" />
                      {t('no_data')}
                    </td>
                  </tr>
                ) : (
                  departments.map(d => (
                    <tr key={d.name} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-3 py-3 font-medium text-slate-800">{d.name}</td>
                      <td className="px-3 py-3 text-center text-slate-500">{d.employeeCount}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800">{yen(d.totalWage)}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{yen(d.totalTransport)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800">{yen(d.totalWage + d.totalTransport)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {departments.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-3 py-2.5 text-slate-600">{t('total_row')}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {departments.reduce((s, d) => s + d.employeeCount, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-800">
                      {yen(departments.reduce((s, d) => s + d.totalWage, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {yen(departments.reduce((s, d) => s + d.totalTransport, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-800">
                      {yen(departments.reduce((s, d) => s + d.totalWage + d.totalTransport, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Branch section */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <i className="bi bi-shop text-indigo-500" />
          {t('branch_section_title')}
        </h3>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('col_branch')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">{t('col_employee_count')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">{t('col_distributor_count')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_emp_wage')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_dist_wage')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_emp_transport')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_dist_transport')}</th>
                  <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-right">{t('col_total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <i className="bi bi-inbox text-3xl block mb-2" />
                      {t('no_data')}
                    </td>
                  </tr>
                ) : (
                  branches.map(b => {
                    const total = b.employeeTotalWage + b.distributorTotalWage + b.employeeTotalTransport + b.distributorTotalTransport;
                    return (
                      <tr key={b.name} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-3 py-3 font-medium text-slate-800">{b.name}</td>
                        <td className="px-3 py-3 text-center text-slate-500">{b.employeeCount}</td>
                        <td className="px-3 py-3 text-center text-slate-500">{b.distributorCount}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{yen(b.employeeTotalWage)}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{yen(b.distributorTotalWage)}</td>
                        <td className="px-3 py-3 text-right text-slate-500">{yen(b.employeeTotalTransport)}</td>
                        <td className="px-3 py-3 text-right text-slate-500">{yen(b.distributorTotalTransport)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-800">{yen(total)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {branches.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-bold">
                    <td className="px-3 py-2.5 text-slate-600">{t('total_row')}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {branches.reduce((s, b) => s + b.employeeCount, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {branches.reduce((s, b) => s + b.distributorCount, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-800">
                      {yen(branches.reduce((s, b) => s + b.employeeTotalWage, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-800">
                      {yen(branches.reduce((s, b) => s + b.distributorTotalWage, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {yen(branches.reduce((s, b) => s + b.employeeTotalTransport, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {yen(branches.reduce((s, b) => s + b.distributorTotalTransport, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-800">
                      {yen(branches.reduce((s, b) => s + b.employeeTotalWage + b.distributorTotalWage + b.employeeTotalTransport + b.distributorTotalTransport, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
