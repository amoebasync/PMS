'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// =====================
// Types
// =====================
type KPI = {
  totalOrders: number;
  totalPlanned: number;
  totalActual: number;
  avgDistributionRate: number;
};

type OrderSummary = {
  orderId: number;
  orderNo: string;
  title: string;
  orderDate: string;
  status: string;
  statusLabel: string;
  totalPlanned: number;
  totalActual: number;
  distributionRate: number;
  areaCount: number;
  lastDistributed: string | null;
};

type AreaBreakdown = {
  areaId: number;
  areaName: string;
  plannedCount: number;
  actualCount: number;
  distributionRate: number;
  schedulesCount: number;
  lastDistributed: string | null;
};

type DailyProgress = {
  date: string;
  actualCount: number;
};

type OrderDetail = {
  order: {
    orderId: number;
    orderNo: string;
    title: string;
    orderDate: string;
    totalPlanned: number;
    totalActual: number;
    distributionRate: number;
  };
  areaBreakdown: AreaBreakdown[];
  dailyProgress: DailyProgress[];
};

// =====================
// Helpers
// =====================
const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: 'bg-cyan-100 text-cyan-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

function formatNum(n: number) {
  return n.toLocaleString('ja-JP');
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatShortDate(iso: string) {
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
export default function ReportsPage() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    const res = await fetch('/api/portal/reports/orders');
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadOrders()
      .then((data) => {
        setKpi(data.kpi);
        setOrders(data.orders);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectOrder = async (orderId: number) => {
    if (selectedOrderId === orderId) {
      setSelectedOrderId(null);
      setDetail(null);
      return;
    }
    setSelectedOrderId(orderId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/portal/reports/orders/${orderId}`);
      if (!res.ok) throw new Error('Failed to fetch detail');
      const data = await res.json();
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadCsv = (orderId: number) => {
    window.open(`/api/portal/reports/orders/${orderId}/csv`, '_blank');
  };

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <i className="bi bi-file-earmark-bar-graph text-indigo-600" />
          配布レポート
        </h1>
        <p className="text-sm text-slate-500 mt-1">発注ごとの配布実績をエリア別・日別で確認できます。</p>
      </div>

      {/* KPIサマリー */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon="bi-receipt" label="発注件数" value={kpi.totalOrders} sub="件" />
          <KpiCard icon="bi-stack" label="総配布予定枚数" value={formatNum(kpi.totalPlanned)} sub="枚" />
          <KpiCard icon="bi-check2-all" label="総配布実績枚数" value={formatNum(kpi.totalActual)} sub="枚" />
          <KpiCard icon="bi-percent" label="平均配布率" value={`${kpi.avgDistributionRate}%`} />
        </div>
      )}

      {/* 発注一覧テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <i className="bi bi-list-check text-indigo-500" />
            発注別 配布実績
          </h2>
        </div>
        {orders.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            配布対象の発注がありません。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => (
              <div key={order.orderId}>
                <div
                  onClick={() => handleSelectOrder(order.orderId)}
                  className={`px-6 py-4 cursor-pointer transition-colors hover:bg-slate-50 ${selectedOrderId === order.orderId ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs text-slate-400 font-mono">{order.orderNo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {order.statusLabel}
                        </span>
                        <span className="text-xs text-slate-400">{formatDate(order.orderDate)}</span>
                      </div>
                      <p className="font-medium text-slate-800 truncate">{order.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{order.areaCount} エリア</span>
                        {order.lastDistributed && (
                          <span>最終配布: {formatDate(order.lastDistributed)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-32">
                      <p className="text-2xl font-bold text-indigo-600">
                        {order.distributionRate}<span className="text-sm font-normal text-slate-500">%</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatNum(order.totalActual)} / {formatNum(order.totalPlanned)} 枚
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <i className={`bi ${selectedOrderId === order.orderId ? 'bi-chevron-up' : 'bi-chevron-down'} text-slate-400`} />
                    </div>
                  </div>
                  {/* プログレスバー */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        order.distributionRate >= 100
                          ? 'bg-green-500'
                          : order.distributionRate >= 50
                          ? 'bg-indigo-500'
                          : 'bg-indigo-300'
                      }`}
                      style={{ width: `${Math.min(100, order.distributionRate)}%` }}
                    />
                  </div>
                </div>

                {/* 詳細レポート展開 */}
                {selectedOrderId === order.orderId && (
                  <div className="px-6 pb-6 bg-slate-50/50 border-t border-slate-100">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-6 pt-4">
                        {/* CSVダウンロードボタン */}
                        <div className="flex justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadCsv(order.orderId); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                          >
                            <i className="bi bi-download" />
                            CSV エクスポート
                          </button>
                        </div>

                        {/* エリア別内訳テーブル */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <i className="bi bi-geo-alt text-indigo-500" />
                              エリア別内訳
                            </h3>
                          </div>
                          {detail.areaBreakdown.length === 0 ? (
                            <div className="p-6 text-center text-sm text-slate-400">エリアデータがありません。</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-500 text-xs">
                                    <th className="text-left px-4 py-2 font-medium">エリア名</th>
                                    <th className="text-right px-4 py-2 font-medium">予定枚数</th>
                                    <th className="text-right px-4 py-2 font-medium">実績枚数</th>
                                    <th className="text-right px-4 py-2 font-medium">配布率</th>
                                    <th className="text-right px-4 py-2 font-medium">最終配布日</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {detail.areaBreakdown.map((area) => (
                                    <tr key={area.areaId} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-2.5 text-slate-800 font-medium">{area.areaName}</td>
                                      <td className="px-4 py-2.5 text-right text-slate-600">{formatNum(area.plannedCount)}</td>
                                      <td className="px-4 py-2.5 text-right text-slate-800 font-medium">{formatNum(area.actualCount)}</td>
                                      <td className="px-4 py-2.5 text-right">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                          area.distributionRate >= 100 ? 'bg-green-100 text-green-700'
                                            : area.distributionRate >= 50 ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-orange-100 text-orange-700'
                                        }`}>
                                          {area.distributionRate}%
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-slate-500 text-xs">
                                        {area.lastDistributed ? formatDate(area.lastDistributed) : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* 日別配布推移グラフ */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5">
                          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
                            <i className="bi bi-bar-chart-line text-indigo-500" />
                            日別配布推移
                          </h3>
                          {detail.dailyProgress.length === 0 ? (
                            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
                              <p>配布データがありません。</p>
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={detail.dailyProgress} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                  dataKey="date"
                                  tickFormatter={formatShortDate}
                                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                                />
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                                <Tooltip
                                  formatter={(value: number) => [formatNum(value) + ' 枚', '配布枚数']}
                                  labelFormatter={(label) => formatDate(label)}
                                />
                                <Bar dataKey="actualCount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
