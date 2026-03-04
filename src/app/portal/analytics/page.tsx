'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';

// =====================
// Types
// =====================
type Summary = {
  totalScans: number;
  uniqueVisitors: number;
  recentScans: number;
  activeOrders: number;
  totalPlanned: number;
  totalActual: number;
};

type DailyPoint = { date: string; count: number };
type DevicePoint = { name: string; value: number };
type FlyerPoint = { name: string; count: number };

type QrStats = {
  daily: DailyPoint[];
  deviceBreakdown: DevicePoint[];
  flyerBreakdown: FlyerPoint[];
};

type OrderProgress = {
  id: number;
  orderNo: string;
  title: string;
  status: string;
  statusLabel: string;
  orderDate: string;
  planned: number;
  actual: number;
  progressPct: number;
};

// =====================
// Helpers
// =====================
const DEVICE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PLANNING: 'bg-blue-100 text-blue-700',
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-700',
  PENDING_SUBMISSION: 'bg-orange-100 text-orange-700',
  PENDING_REVIEW: 'bg-purple-100 text-purple-700',
  ADJUSTING: 'bg-pink-100 text-pink-700',
  CONFIRMED: 'bg-cyan-100 text-cyan-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELED: 'bg-red-100 text-red-600',
};

function formatNum(n: number) {
  return n.toLocaleString('ja-JP');
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// =====================
// KPI Card
// =====================
function KpiCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
        <i className={`bi ${icon} text-indigo-600 text-xl`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800 leading-tight">{typeof value === 'number' ? formatNum(value) : value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// =====================
// Main Page
// =====================
export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [qrStats, setQrStats] = useState<QrStats | null>(null);
  const [progress, setProgress] = useState<OrderProgress[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    const res = await fetch('/api/portal/analytics/summary');
    if (!res.ok) throw new Error('summary fetch failed');
    return res.json();
  }, []);

  const loadQrStats = useCallback(async (d: number) => {
    const res = await fetch(`/api/portal/analytics/qr-stats?days=${d}`);
    if (!res.ok) throw new Error('qr-stats fetch failed');
    return res.json();
  }, []);

  const loadProgress = useCallback(async () => {
    const res = await fetch('/api/portal/analytics/progress');
    if (!res.ok) throw new Error('progress fetch failed');
    const data = await res.json();
    return data.orders as OrderProgress[];
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadQrStats(days), loadProgress()])
      .then(([s, q, p]) => {
        setSummary(s);
        setQrStats(q);
        setProgress(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // days変更時のみQR再取得
  useEffect(() => {
    if (!loading) {
      loadQrStats(days).then(setQrStats).catch(console.error);
    }
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500 text-sm">データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center text-red-500">
          <i className="bi bi-exclamation-triangle text-3xl block mb-2" />
          <p>データの取得に失敗しました。</p>
        </div>
      </div>
    );
  }

  const progressRate = summary && summary.totalPlanned > 0
    ? Math.min(100, Math.round((summary.totalActual / summary.totalPlanned) * 100))
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <i className="bi bi-graph-up-arrow text-indigo-600" />
          反響分析
        </h1>
        <p className="text-sm text-slate-500 mt-1">チラシ配布・QRスキャンの効果を確認できます。</p>
      </div>

      {/* KPIサマリー */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard icon="bi-qr-code-scan" label="累計QRスキャン数" value={summary.totalScans} />
          <KpiCard icon="bi-people" label="ユニーク訪問者" value={summary.uniqueVisitors} />
          <KpiCard icon="bi-calendar-week" label="直近30日スキャン" value={summary.recentScans} />
          <KpiCard icon="bi-clipboard-data" label="進行中の発注" value={summary.activeOrders} sub="件" />
          <KpiCard
            icon="bi-stack"
            label="総配布枚数"
            value={`${formatNum(summary.totalActual)} / ${formatNum(summary.totalPlanned)}`}
            sub={`進捗率 ${progressRate}%`}
          />
          <KpiCard
            icon="bi-percent"
            label="配布進捗率（全体）"
            value={`${progressRate}%`}
            sub={`予定 ${formatNum(summary.totalPlanned)} 枚`}
          />
        </div>
      )}

      {/* QRスキャン日次グラフ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <i className="bi bi-bar-chart-line text-indigo-500" />
            QRスキャン推移
          </h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d}日
              </button>
            ))}
          </div>
        </div>
        {qrStats && qrStats.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={qrStats.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval={days === 7 ? 0 : days === 30 ? 6 : 14}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, 'スキャン数']}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2}
                dot={days <= 30}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
            <p>この期間のスキャンデータがありません。</p>
          </div>
        )}
      </div>

      {/* デバイス内訳 & チラシ別スキャン数 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* デバイス内訳 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-5">
            <i className="bi bi-phone text-indigo-500" />
            デバイス内訳（全期間）
          </h2>
          {qrStats && qrStats.deviceBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={qrStats.deviceBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {qrStats.deviceBreakdown.map((_, index) => (
                    <Cell key={index} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'スキャン']} />
                <Legend
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              <p>データがありません。</p>
            </div>
          )}
        </div>

        {/* チラシ別スキャン数 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-5">
            <i className="bi bi-files text-indigo-500" />
            チラシ別スキャン数（全期間）
          </h2>
          {qrStats && qrStats.flyerBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={qrStats.flyerBreakdown}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  width={110}
                  tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v}
                />
                <Tooltip formatter={(value: number) => [value, 'スキャン']} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              <p>データがありません。</p>
            </div>
          )}
        </div>
      </div>

      {/* 発注別進捗 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-5">
          <i className="bi bi-list-check text-indigo-500" />
          発注別 配布進捗
        </h2>
        {progress.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-10">発注データがありません。</p>
        ) : (
          <div className="space-y-4">
            {progress.map((order) => (
              <div key={order.id} className="border border-slate-100 rounded-lg p-4 hover:border-indigo-100 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 font-mono">{order.orderNo}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {order.statusLabel}
                      </span>
                    </div>
                    <p className="font-medium text-slate-800 mt-1 truncate">{order.title}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-indigo-600">{order.progressPct}<span className="text-sm font-normal text-slate-500">%</span></p>
                    <p className="text-xs text-slate-400">
                      {formatNum(order.actual)} / {formatNum(order.planned)} 枚
                    </p>
                  </div>
                </div>
                {/* プログレスバー */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      order.progressPct >= 100
                        ? 'bg-green-500'
                        : order.progressPct >= 50
                        ? 'bg-indigo-500'
                        : 'bg-indigo-300'
                    }`}
                    style={{ width: `${order.progressPct}%` }}
                  />
                </div>
                {order.planned === 0 && (
                  <p className="text-xs text-slate-400 mt-1">配布枚数未設定</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
