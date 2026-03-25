'use client';

import React, { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n';

interface Attendance {
  round: number;
  date: string;
  types: number;
  mainCount: number;
  areaName: string;
}

interface Distributor {
  id: number;
  staffId: string;
  name: string;
  joinDate: string;
  branch: string;
  isActive: boolean;
  attendanceCount: number;
  attendances: Attendance[];
}

interface Stats {
  total: number;
  active: number;
  left: number;
  avgAttendance: number;
  retentionRate: number;
}

const MILESTONES = [4, 8, 15, 20, 25, 30];

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getCountColor(types: number, mainCount: number) {
  if (mainCount === 0) return 'bg-red-100 text-red-700';
  if (mainCount < 500) return 'bg-red-50 text-red-600';
  if (mainCount < 1000) return 'bg-amber-50 text-amber-700';
  return '';
}

export default function BeginnersAnalyticsPage() {
  const { t } = useTranslation('analytics');

  // デフォルト: 直近2ヶ月
  const today = new Date();
  const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const [from, setFrom] = useState(twoMonthsAgo.toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);
  const [data, setData] = useState<Distributor[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/beginners?from=${from}&to=${to}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.distributors);
        setStats(json.stats);
      }
    } catch { /* silent */ }
    setLoading(false);
    setSearched(true);
  }, [from, to]);

  // 全配布員の最大回数を計算（テーブルのカラム数に使用）
  const maxRounds = Math.max(8, ...data.map(d => d.attendanceCount));

  return (
    <div className="space-y-4 max-w-full">
      {/* Filter bar */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:flex-wrap gap-3 md:gap-4 md:items-end">
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">加入日（From）</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-slate-300 rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">加入日（To）</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-slate-300 rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <button onClick={fetchData} disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5">
          {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> 検索中...</> : <><i className="bi bi-search"></i> 検索</>}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
            合計: {stats.total}名
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg text-xs font-bold text-emerald-700">
            継続: {stats.active}名
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg text-xs font-bold text-red-700">
            退職: {stats.left}名
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 rounded-lg text-xs font-bold text-indigo-700">
            平均出勤: {stats.avgAttendance}回
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg text-xs font-bold text-amber-700">
            継続率: {stats.retentionRate}%
          </span>
        </div>
      )}

      {/* Table */}
      {searched && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-2 py-2 text-left font-bold text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[70px]">支店</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-500 sticky left-[70px] bg-slate-50 z-10 min-w-[70px]">Staff ID</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-500 sticky left-[140px] bg-slate-50 z-10 min-w-[120px]">配布員名</th>
                  <th className="px-2 py-2 text-center font-bold text-slate-500 min-w-[80px]">加入日</th>
                  <th className="px-2 py-2 text-center font-bold text-slate-500 min-w-[50px]">状態</th>
                  <th className="px-2 py-2 text-center font-bold text-slate-500 min-w-[40px]">回数</th>
                  {/* Milestone columns */}
                  {MILESTONES.map(m => (
                    <th key={m} className="px-1 py-2 text-center font-bold text-slate-400 min-w-[30px] bg-blue-50">{m}回</th>
                  ))}
                  {/* Round columns */}
                  {Array.from({ length: maxRounds }, (_, i) => (
                    <th key={i} className="px-2 py-2 text-center font-bold text-slate-500 min-w-[90px]">{i + 1}回目</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length === 0 ? (
                  <tr><td colSpan={6 + MILESTONES.length + maxRounds} className="px-4 py-12 text-center text-slate-400">該当する配布員がいません</td></tr>
                ) : data.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="px-2 py-2 text-slate-600 sticky left-0 bg-white z-10">{d.branch}</td>
                    <td className="px-2 py-2 font-mono text-slate-500 sticky left-[70px] bg-white z-10">{d.staffId}</td>
                    <td className="px-2 py-2 font-bold text-slate-800 sticky left-[140px] bg-white z-10 truncate max-w-[120px]" title={d.name}>{d.name}</td>
                    <td className="px-2 py-2 text-center text-slate-600">{formatDate(d.joinDate)}</td>
                    <td className="px-2 py-2 text-center">
                      {d.isActive ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">継続</span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">退職</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-slate-700">{d.attendanceCount}</td>
                    {/* Milestones */}
                    {MILESTONES.map(m => (
                      <td key={m} className="px-1 py-2 text-center bg-blue-50/50">
                        {d.attendanceCount >= m ? (
                          <span className="text-emerald-600 font-bold">O</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    ))}
                    {/* Rounds */}
                    {Array.from({ length: maxRounds }, (_, i) => {
                      const att = d.attendances[i];
                      if (!att) return <td key={i} className="px-2 py-2"></td>;
                      const colorCls = getCountColor(att.types, att.mainCount);
                      return (
                        <td key={i} className={`px-2 py-2 text-center ${colorCls}`} title={`${att.date} ${att.areaName}`}>
                          <div className="font-bold">{att.types}種, {att.mainCount.toLocaleString()}枚</div>
                          <div className="text-[9px] text-slate-400 truncate max-w-[85px]">{att.areaName}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
