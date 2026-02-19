'use client';

import React, { useState, useEffect } from 'react';

// 統計カードコンポーネント（変更なし）
const StatCard = ({ title, value, unit, icon, color, trend }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
      <i className={`bi ${icon} text-6xl text-${color}-600`}></i>
    </div>
    <div className="relative z-10">
      <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{title}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-800">{value}</span>
        <span className="text-sm text-slate-400 font-medium">{unit}</span>
      </div>
      <div className={`text-xs mt-2 font-medium ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'} flex items-center gap-1`}>
        <i className={`bi bi-graph-${trend}-arrow`}></i>
        <span>先月比 +12.5%</span>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  // ヘルスチェック用の状態管理
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [latency, setLatency] = useState<number | null>(null);

  // 定期的なヘルスチェック実行
  useEffect(() => {
    const checkHealth = async () => {
      try {
        setDbStatus('checking'); // チェック中表示（一瞬）
        const res = await fetch('/api/health');
        const data = await res.json();
        
        if (res.ok && data.status === 'ok') {
          setDbStatus('connected');
          setLatency(data.db_latency);
        } else {
          setDbStatus('disconnected');
          setLatency(null);
        }
      } catch (error) {
        setDbStatus('disconnected');
        setLatency(null);
      }
    };

    // 初回実行
    checkHealth();

    // 30秒ごとに実行
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>
        <p className="text-slate-500 text-sm">システム全体の稼働状況と配布進捗のサマリーです。</p>
      </div>

      {/* KPI カードエリア（ダミーデータ） */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="管理エリア総数" value="1,240" unit="エリア" icon="bi-geo-alt-fill" color="blue" trend="up" />
        <StatCard title="配布可能世帯数" value="385,200" unit="世帯" icon="bi-house-heart-fill" color="indigo" trend="up" />
        <StatCard title="稼働中スタッフ" value="48" unit="名" icon="bi-people-fill" color="emerald" trend="up" />
        <StatCard title="今月の配布実績" value="85.2" unit="%" icon="bi-pie-chart-fill" color="orange" trend="up" />
      </div>

      {/* メインコンテンツエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左側: 最新のアクティビティ（ダミーデータ） */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <i className="bi bi-clock-history text-blue-500"></i>
              最近の更新アクティビティ
            </h3>
            <button className="text-xs text-blue-600 font-bold hover:underline">すべて見る</button>
          </div>
          <div className="p-0">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 font-semibold">担当者</th>
                  <th className="px-6 py-3 font-semibold">操作内容</th>
                  <th className="px-6 py-3 font-semibold">対象エリア</th>
                  <th className="px-6 py-3 font-semibold text-right">日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        S{i}
                      </div>
                      <span className="text-sm font-medium text-slate-700">佐藤 健太</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md mr-2">更新</span>
                      配布不可リスト登録
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">TOK-MN-00{i}</td>
                    <td className="px-6 py-4 text-xs text-right text-slate-400">2026/02/18 14:30</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右側: お知らせ・システムステータス（★ここが本番稼働） */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            {/* ステータスに応じた背景エフェクト */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 ${
              dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}></div>

            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <i className={`bi bi-broadcast text-xl ${
                  dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                }`}></i>
              </div>
              <div>
                <div className="font-bold">System Status</div>
                <div className={`text-xs flex items-center gap-1 ${
                  dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    dbStatus === 'checking' ? 'bg-yellow-400 animate-ping' : 
                    dbStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}></span>
                  {dbStatus === 'connected' ? 'All Systems Operational' : 
                   dbStatus === 'checking' ? 'Checking Status...' : 'System Error Detected'}
                </div>
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              <div className="flex justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-slate-400">Database (RDS)</span>
                <span className={`font-mono font-bold ${
                  dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {dbStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-slate-400">API Latency</span>
                <span className={`font-mono ${
                  latency && latency < 100 ? 'text-blue-400' : 
                  latency && latency < 500 ? 'text-yellow-400' : 'text-rose-400'
                }`}>
                  {latency ? `${latency}ms` : '--'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Last Check</span>
                <span className="text-slate-200">Just now</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h4 className="font-bold text-slate-700 mb-4 text-sm">重要なお知らせ</h4>
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <i className="bi bi-info-circle-fill text-blue-500 mt-1"></i>
                <div>
                  <div className="text-xs text-slate-400 mb-1">2026/02/15</div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    次回のシステムメンテナンスは2月25日（水）の深夜2:00〜4:00を予定しています。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}