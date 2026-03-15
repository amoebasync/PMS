'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';

type Distributor = {
  id: number;
  staffId: string;
  name: string;
};

export default function PayrollStatementPage() {
  const today = new Date();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDist, setSelectedDist] = useState<Distributor | null>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState<number | null>(today.getMonth() + 1);
  const [generating, setGenerating] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/distributors')
      .then(r => r.json())
      .then(data => {
        setDistributors(Array.isArray(data) ? data : (data.distributors || []));
        setLoading(false);
      });
  }, []);

  // フィルタリング
  const filtered = useMemo(() => {
    if (!search.trim()) return distributors;
    const q = search.toLowerCase();
    return distributors.filter(d =>
      d.staffId.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
    );
  }, [distributors, search]);

  const handleSelect = (dist: Distributor) => {
    setSelectedDist(dist);
    setSearch('');
  };

  const handleDownload = async () => {
    if (!selectedDist) return;
    setGenerating(true);
    try {
      const params = new URLSearchParams({
        distributorId: String(selectedDist.id),
        year: String(year),
      });
      if (month) params.set('month', String(month));
      const res = await fetch(`/api/distributor-payroll/statement?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = month
        ? `支払明細書_${selectedDist.staffId}_${year}年${month}月.pdf`
        : `支払明細書_${selectedDist.staffId}_${year}年度.pdf`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setRecentDownloads(prev => [
        `${selectedDist.staffId} ${selectedDist.name} — ${month ? `${year}年${month}月` : `${year}年度`}`,
        ...prev.slice(0, 4),
      ]);
    } catch {
      alert('PDF生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  // 一括ダウンロード
  const handleBulkDownload = async () => {
    if (filtered.length === 0) return;
    const targets = filtered.slice(0, 50); // 最大50人
    setGenerating(true);
    try {
      for (const dist of targets) {
        const params = new URLSearchParams({
          distributorId: String(dist.id),
          year: String(year),
        });
        if (month) params.set('month', String(month));
        const res = await fetch(`/api/distributor-payroll/statement?${params}`);
        if (!res.ok) continue;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = month
          ? `支払明細書_${dist.staffId}_${year}年${month}月.pdf`
          : `支払明細書_${dist.staffId}_${year}年度.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {}
    setGenerating(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/distributors/payroll"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <i className="bi bi-arrow-left text-lg"></i>
          </a>
          <div>
            <h1 className="text-xl font-black text-slate-800">支払明細書</h1>
            <p className="text-xs text-slate-400 mt-0.5">配布員の支払明細書PDFを生成・ダウンロード</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 配布員検索 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 検索ボックス */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <i className="bi bi-person-lines-fill text-indigo-500"></i>
                配布員を選択
              </h2>
            </div>
            <div className="p-4">
              {/* 選択済み表示 */}
              {selectedDist && (
                <div className="mb-3 flex items-center gap-3 bg-indigo-50 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <i className="bi bi-person-fill text-indigo-500 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-indigo-900">{selectedDist.name}</p>
                    <p className="text-xs text-indigo-500">{selectedDist.staffId}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDist(null)}
                    className="text-indigo-400 hover:text-indigo-600 p-1"
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              )}

              {/* 検索入力 */}
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
                  <button
                    onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <i className="bi bi-x-circle-fill"></i>
                  </button>
                )}
              </div>

              {/* 件数 */}
              <div className="flex items-center justify-between mt-2 mb-1 px-1">
                <p className="text-xs text-slate-400">
                  {search ? `${filtered.length}件ヒット` : `全${distributors.length}名`}
                </p>
              </div>
            </div>

            {/* リスト */}
            <div className="max-h-[420px] overflow-y-auto border-t border-slate-100">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <i className="bi bi-hourglass-split animate-spin mr-2"></i>読み込み中...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <i className="bi bi-search text-3xl block mb-2 opacity-30"></i>
                  該当する配布員が見つかりません
                </div>
              ) : (
                filtered.map((dist, idx) => {
                  const isSelected = selectedDist?.id === dist.id;
                  return (
                    <button
                      key={dist.id}
                      onClick={() => handleSelect(dist)}
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
                        {dist.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>
                          {dist.name}
                        </p>
                        <p className="text-xs text-slate-400">{dist.staffId}</p>
                      </div>
                      {isSelected && (
                        <i className="bi bi-check-circle-fill text-indigo-500"></i>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 右: 期間選択 & ダウンロード */}
        <div className="space-y-4">
          {/* 期間設定 */}
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
                <select
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  {Array.from({ length: 5 }, (_, i) => today.getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">月</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setMonth(null)}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition-all col-span-4 mb-1
                      ${month === null
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                  >
                    年間一括
                  </button>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <button
                      key={m}
                      onClick={() => setMonth(m)}
                      className={`px-2 py-2.5 rounded-lg text-xs font-bold transition-all
                        ${month === m
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ダウンロードボタン */}
          <button
            onClick={handleDownload}
            disabled={!selectedDist || generating}
            className="w-full px-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          >
            {generating ? (
              <><i className="bi bi-hourglass-split animate-spin"></i>PDF生成中...</>
            ) : (
              <><i className="bi bi-file-earmark-pdf text-lg"></i>PDFダウンロード</>
            )}
          </button>

          {!selectedDist && (
            <p className="text-center text-xs text-slate-400">
              左の一覧から配布員を選択してください
            </p>
          )}

          {selectedDist && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-emerald-700 font-bold">
                {selectedDist.name}（{selectedDist.staffId}）
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {month ? `${year}年${month}月` : `${year}年度（年間）`}
              </p>
            </div>
          )}

          {/* 最近のダウンロード */}
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
                    <i className="bi bi-check-circle text-emerald-500"></i>
                    {item}
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
