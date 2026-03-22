'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';

type Employee = {
  id: number;
  employeeCode: string | null;
  lastNameJa: string;
  firstNameJa: string;
  employmentType: string;
  linkedDistributor?: { id: number; staffId: string; name: string } | null;
};

export default function EmployeePayrollStatementPage() {
  const today = new Date();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState<number | null>(today.getMonth() + 1);
  const [generating, setGenerating] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/employees?page=1&limit=500')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.data || []);
        setEmployees(list);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      `${e.lastNameJa}${e.firstNameJa}`.toLowerCase().includes(q) ||
      (e.employeeCode || '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  const empName = (e: Employee) => `${e.lastNameJa} ${e.firstNameJa}`;
  const empCode = (e: Employee) => e.employeeCode || `EMP${e.id}`;

  const handleSelect = (emp: Employee) => {
    setSelectedEmp(emp);
    setSearch('');
  };

  const handleDownload = async () => {
    if (!selectedEmp) return;
    setGenerating(true);
    try {
      const params = new URLSearchParams({
        employeeId: String(selectedEmp.id),
        year: String(year),
      });
      if (month) params.set('month', String(month));
      const res = await fetch(`/api/payroll/statement?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const code = empCode(selectedEmp);
      a.download = month
        ? `支払明細書_${code}_${year}年${month}月.pdf`
        : `支払明細書_${code}_${year}年度.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setRecentDownloads(prev => [
        `${code} ${empName(selectedEmp)} — ${month ? `${year}年${month}月` : `${year}年度`}`,
        ...prev.slice(0, 4),
      ]);
    } catch {
      alert('PDF生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/payroll" className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <i className="bi bi-arrow-left text-lg"></i>
          </a>
          <div>
            <h1 className="text-xl font-black text-slate-800">支払明細書</h1>
            <p className="text-xs text-slate-400 mt-0.5">社員の支払明細書PDFを生成・ダウンロード</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 社員検索 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <i className="bi bi-person-badge text-indigo-500"></i>
                社員を選択
              </h2>
            </div>
            <div className="p-4">
              {selectedEmp && (
                <div className="mb-3 flex items-center gap-3 bg-indigo-50 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <i className="bi bi-person-fill text-indigo-500 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-indigo-900">{empName(selectedEmp)}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-indigo-500">{empCode(selectedEmp)}</p>
                      {selectedEmp.linkedDistributor && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-bold">
                          <i className="bi bi-link-45deg mr-0.5"></i>{selectedEmp.linkedDistributor.staffId}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedEmp(null)} className="text-indigo-400 hover:text-indigo-600 p-1">
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              )}

              <div className="relative">
                <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="名前またはIDで検索..."
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  autoFocus
                />
                {search && (
                  <button onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between mt-2 mb-1 px-1">
                <p className="text-xs text-slate-400">
                  {search ? `${filtered.length}件ヒット` : `全${employees.length}名`}
                </p>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto border-t border-slate-100">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <i className="bi bi-hourglass-split animate-spin mr-2"></i>読み込み中...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <i className="bi bi-search text-3xl block mb-2 opacity-30"></i>
                  該当する社員が見つかりません
                </div>
              ) : (
                filtered.map((emp, idx) => {
                  const isSelected = selectedEmp?.id === emp.id;
                  return (
                    <button
                      key={emp.id}
                      onClick={() => handleSelect(emp)}
                      className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors
                        ${isSelected
                          ? 'bg-indigo-50 border-l-4 border-indigo-500'
                          : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50 border-l-4 border-transparent'
                            : 'bg-slate-50/30 hover:bg-slate-50 border-l-4 border-transparent'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                        ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {emp.lastNameJa.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>
                          {empName(emp)}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-400">{empCode(emp)}</p>
                          {emp.linkedDistributor && (
                            <span className="text-[10px] px-1 py-0.5 bg-orange-50 text-orange-500 rounded font-bold">
                              <i className="bi bi-link-45deg"></i>{emp.linkedDistributor.staffId}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <i className="bi bi-check-circle-fill text-indigo-500"></i>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 右: 期間選択 & ダウンロード */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <i className="bi bi-calendar3 text-indigo-500"></i>
                対象期間
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">年</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">月</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button onClick={() => setMonth(null)}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition-all col-span-4 mb-1
                      ${month === null ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    年間一括
                  </button>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <button key={m} onClick={() => setMonth(m)}
                      className={`px-2 py-2.5 rounded-lg text-xs font-bold transition-all
                        ${month === m ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                      {m}月
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleDownload} disabled={!selectedEmp || generating}
            className="w-full px-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base">
            {generating ? (
              <><i className="bi bi-hourglass-split animate-spin"></i>PDF生成中...</>
            ) : (
              <><i className="bi bi-file-earmark-pdf text-lg"></i>PDFダウンロード</>
            )}
          </button>

          {!selectedEmp && (
            <p className="text-center text-xs text-slate-400">左の一覧から社員を選択してください</p>
          )}

          {selectedEmp && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-emerald-700 font-bold">
                {empName(selectedEmp)}（{empCode(selectedEmp)}）
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {month ? `${year}年${month}月` : `${year}年度（年間）`}
              </p>
              {selectedEmp.linkedDistributor && (
                <p className="text-[10px] text-orange-600 mt-1">
                  <i className="bi bi-link-45deg mr-0.5"></i>
                  配布員 {selectedEmp.linkedDistributor.staffId} の報酬も合算
                </p>
              )}
            </div>
          )}

          {recentDownloads.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <i className="bi bi-clock-history text-slate-400"></i>
                  最近のダウンロード
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {recentDownloads.map((item, i) => (
                  <div key={i} className="px-5 py-2.5 text-xs text-slate-500 flex items-center gap-2">
                    <i className="bi bi-check-circle text-emerald-500"></i>{item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
