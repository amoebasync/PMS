'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const RANK_COLORS: Record<string, string> = {
  S: 'bg-yellow-500 text-white',
  A: 'bg-blue-500 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-slate-400 text-white',
  D: 'bg-red-400 text-white',
};

function RankBadge({ rank, size = 'lg' }: { rank: string; size?: 'sm' | 'lg' }) {
  const cls = RANK_COLORS[rank] || 'bg-slate-300 text-white';
  if (size === 'sm') {
    return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${cls}`}>{rank}</span>;
  }
  return <span className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl text-2xl font-black ${cls} shadow-lg`}>{rank}</span>;
}

type Evaluation = {
  id: number;
  periodStart: string;
  periodEnd: string;
  totalScore: number;
  performanceScore: number;
  qualityScore: number;
  determinedRank: string;
  attendanceDays: number;
  totalSheets: number;
  complaintCount: number;
};

export default function StaffEvaluationPage() {
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [currentRank, setCurrentRank] = useState('C');
  const [currentScore, setCurrentScore] = useState(0);
  const [nextRankThreshold, setNextRankThreshold] = useState<number | null>(null);
  const [nextRankName, setNextRankName] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/staff/evaluation');
        if (res.ok) {
          const data = await res.json();
          setEvaluations(data.evaluations || []);
          setCurrentRank(data.currentRank || 'C');
          setCurrentScore(data.currentScore || 0);
          setNextRankThreshold(data.scoreForNextRank ?? null);
          setNextRankName(data.nextRank ?? null);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const chartData = [...evaluations]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
    .map(e => ({
      week: `${new Date(e.periodStart).getMonth() + 1}/${new Date(e.periodStart).getDate()}`,
      totalScore: e.totalScore,
      performanceScore: e.performanceScore,
      qualityScore: e.qualityScore,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const pointsToNext = nextRankThreshold;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
        <i className="bi bi-award-fill text-indigo-500"></i> 評価
      </h1>

      {/* Current Rank Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-5">
          <RankBadge rank={currentRank} />
          <div className="flex-1">
            <p className="text-xs text-slate-500 font-bold">現在のランク</p>
            <p className="text-2xl font-black text-slate-800">{currentScore} <span className="text-sm font-bold text-slate-400">点</span></p>
            {pointsToNext != null && nextRankName && pointsToNext > 0 && (
              <p className="text-xs text-indigo-600 font-bold mt-1">
                <i className="bi bi-arrow-up-circle-fill mr-1"></i>
                次のランク ({nextRankName}) まで: {pointsToNext}点
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3">スコア推移 (12週間)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="totalScore" stroke="#3b82f6" name="総合" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="performanceScore" stroke="#22c55e" name="パフォーマンス" strokeWidth={1.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="qualityScore" stroke="#ef4444" name="品質" strokeWidth={1.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly Evaluation List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">週次評価</h2>
        </div>
        {evaluations.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">評価データがありません</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {evaluations.map(ev => {
              const ws = new Date(ev.periodStart);
              const we = new Date(ev.periodEnd);
              const label = `${ws.getMonth() + 1}/${ws.getDate()} - ${we.getMonth() + 1}/${we.getDate()}`;
              const isExpanded = expandedId === ev.id;
              return (
                <div key={ev.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <RankBadge rank={ev.determinedRank} size="sm" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{label}</p>
                        <p className="text-xs text-slate-400">{ev.totalScore}点</p>
                      </div>
                    </div>
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-400`}></i>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-slate-50">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-white rounded-xl p-3">
                          <span className="text-slate-500">パフォーマンス</span>
                          <p className="text-lg font-bold text-green-600">{ev.performanceScore}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3">
                          <span className="text-slate-500">品質</span>
                          <p className="text-lg font-bold text-red-500">{ev.qualityScore}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3">
                          <span className="text-slate-500">出勤日数</span>
                          <p className="text-lg font-bold text-slate-700">{ev.attendanceDays}日</p>
                        </div>
                        <div className="bg-white rounded-xl p-3">
                          <span className="text-slate-500">配布枚数</span>
                          <p className="text-lg font-bold text-slate-700">{ev.totalSheets.toLocaleString()}枚</p>
                        </div>
                        {ev.complaintCount > 0 && (
                          <div className="col-span-2 bg-red-50 rounded-xl p-3">
                            <span className="text-red-500">クレーム件数</span>
                            <p className="text-lg font-bold text-red-600">{ev.complaintCount}件</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
