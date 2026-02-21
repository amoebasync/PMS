'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// スッキリさせたKPIカードコンポーネント
const StatCard = ({ title, value, subValue, icon, color }: any) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-indigo-300 transition-colors flex flex-col justify-between h-full">
    <div className="flex justify-between items-start mb-2 relative z-10">
      <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</div>
      <div className={`w-8 h-8 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center text-lg shrink-0`}>
        <i className={`bi ${icon}`}></i>
      </div>
    </div>
    <div className="relative z-10 mt-auto">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-slate-800 tracking-tight">{value}</span>
      </div>
      {subValue && (
        <div className="text-[10px] mt-1.5 font-bold text-slate-400">
          {subValue}
        </div>
      )}
    </div>
  </div>
);

export default function Dashboard() {
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) setData(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchDashboardData();

    const checkHealth = async () => {
      try {
        setDbStatus('checking'); 
        const res = await fetch('/api/health');
        const hData = await res.json();
        if (res.ok && hData.status === 'ok') {
          setDbStatus('connected'); setLatency(hData.db_latency);
        } else {
          setDbStatus('disconnected'); setLatency(null);
        }
      } catch (error) { setDbStatus('disconnected'); setLatency(null); }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-grid-1x2-fill text-indigo-600"></i> ダッシュボード
          </h1>
          <p className="text-slate-500 text-sm mt-1">本日の業務進捗とシステム全体の稼働状況サマリー</p>
        </div>
      </div>

      {/* --- ★ アラートエリア (要対応タスク) --- */}
      {data && (data.alerts.orders > 0 || data.alerts.approvals > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.alerts.orders > 0 && (
            <Link href="/orders" className="bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm flex items-center justify-between group hover:bg-orange-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-lg shadow-inner shrink-0">
                  <i className="bi bi-briefcase-fill"></i>
                </div>
                <div>
                  <h4 className="font-bold text-orange-800 text-sm">発注の確認・審査待ち</h4>
                  <p className="text-xs text-orange-600 mt-0.5">未処理の発注が <span className="font-black text-base">{data.alerts.orders}</span> 件あります</p>
                </div>
              </div>
              <i className="bi bi-chevron-right text-orange-400 group-hover:text-orange-600"></i>
            </Link>
          )}
          {data.alerts.approvals > 0 && (
            <Link href="/approvals" className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-sm flex items-center justify-between group hover:bg-rose-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-lg shadow-inner shrink-0">
                  <i className="bi bi-person-check-fill"></i>
                </div>
                <div>
                  <h4 className="font-bold text-rose-800 text-sm">人事・経費の承認待ち</h4>
                  <p className="text-xs text-rose-600 mt-0.5">未承認の申請が <span className="font-black text-base">{data.alerts.approvals}</span> 件あります</p>
                </div>
              </div>
              <i className="bi bi-chevron-right text-rose-400 group-hover:text-rose-600"></i>
            </Link>
          )}
        </div>
      )}

      {/* --- ★ メインKPI カードエリア --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="今月の売上合計" 
          value={`¥${(data?.kpi?.monthlySales || 0).toLocaleString()}`} 
          icon="bi-currency-yen" color="blue" 
          subValue={<><i className="bi bi-info-circle"></i> 受注確定済みの累計</>}
        />
        <StatCard 
          title="本日の稼働スタッフ" 
          value={`${data?.kpi?.distributorsTotal || 0} 名`} 
          icon="bi-bicycle" color="emerald" 
          subValue={
            <span className={data?.kpi?.distributorsCompleted > 0 ? "text-emerald-500" : ""}>
              <i className="bi bi-check-circle-fill mr-1"></i> うち {data?.kpi?.distributorsCompleted || 0}名 が業務完了
            </span>
          }
        />
        <StatCard 
          title="本日の配布タスク" 
          value={`${(data?.kpi?.flyersPlanned || 0).toLocaleString()} 枚`} 
          icon="bi-send-fill" color="indigo" 
          subValue={
            <span className={data?.kpi?.flyersActual > 0 ? "text-indigo-500" : ""}>
              <i className="bi bi-check-circle-fill mr-1"></i> {data?.kpi?.flyersActual ? Math.floor((data.kpi.flyersActual / data.kpi.flyersPlanned) * 100) : 0}% ({data?.kpi?.flyersActual?.toLocaleString() || 0}枚) 完了
            </span>
          }
        />
        <StatCard 
          title="管理エリア総数" 
          value="1,240 ヶ所" 
          icon="bi-geo-alt-fill" color="slate" 
          subValue={<><i className="bi bi-house-heart"></i> 配布可能 385,200世帯</>}
        />
      </div>

      {/* --- メインコンテンツ 2カラム --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 左側: 全体お知らせ (広く取る) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <i className="bi bi-megaphone-fill text-indigo-500"></i> 全体お知らせ
            </h3>
          </div>
          <div className="p-6 space-y-6">
            
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-lg shrink-0 mt-1"><i className="bi bi-stars"></i></div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">アップデート</span>
                  <span className="text-[10px] text-slate-400 font-mono">2026/02/22</span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-1.5">ダッシュボードのデザインを刷新しました</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ダッシュボードのレイアウトを見直し、日々の業務に必要なKPI（アラートや本日の出勤人数・配布枚数）が一目でわかるように改善しました。
                </p>
              </div>
            </div>

            <div className="w-full h-px bg-slate-100"></div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center text-lg shrink-0 mt-1"><i className="bi bi-tools"></i></div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">メンテナンス</span>
                  <span className="text-[10px] text-slate-400 font-mono">2026/02/15</span>
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-1.5">定期システムメンテナンスのお知らせ</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  次回のシステムメンテナンスは 2月25日（水）の深夜 2:00〜4:00 を予定しています。この間は一時的にシステムにアクセスできなくなります。
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* 右側: サブ情報 (ステータス・EC状況) */}
        <div className="space-y-6">
          
          {/* ECポータル利用状況 (コンパクト化) */}
          {data && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <i className="bi bi-laptop text-fuchsia-500"></i> ECポータル利用状況
                </h3>
                {data.ec.activeUsers > 0 && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live
                  </span>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <div className="text-xs text-slate-500 font-medium">現在見ている人 <span className="text-[9px] text-slate-400 ml-1">(直近1H)</span></div>
                  <div className="text-xl font-black text-slate-800 tracking-tight">{data.ec.activeUsers}<span className="text-xs font-medium text-slate-400 ml-0.5">人</span></div>
                </div>
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <div className="text-xs text-slate-500 font-medium">今月の新規登録</div>
                  <div className="text-base font-bold text-slate-700">{data.ec.newUsersThisMonth}<span className="text-[10px] font-medium text-slate-400 ml-0.5">件</span></div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-xs text-slate-500 font-medium">累計登録アカウント</div>
                  <div className="text-sm font-bold text-slate-700">{data.ec.totalUsers}<span className="text-[10px] font-medium text-slate-400 ml-0.5">件</span></div>
                </div>
              </div>
            </div>
          )}

          {/* システムステータス (ダークトーンでシュッとさせる) */}
          <div className="bg-slate-800 rounded-xl p-5 text-white shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-20 -mr-8 -mt-8 ${dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shadow-inner">
                <i className={`bi bi-server text-sm ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}></i>
              </div>
              <div>
                <div className="font-bold text-sm">System Status</div>
                <div className={`text-[9px] font-bold flex items-center gap-1.5 ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'checking' ? 'bg-yellow-400 animate-ping' : dbStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                  {dbStatus === 'connected' ? 'All Systems Operational' : dbStatus === 'checking' ? 'Checking Status...' : 'System Error Detected'}
                </div>
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <div className="flex justify-between items-center text-[11px] border-b border-white/10 pb-1.5">
                <span className="text-slate-400">Database (RDS)</span>
                <span className={`font-mono font-bold ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dbStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] border-b border-white/10 pb-1.5">
                <span className="text-slate-400">API Latency</span>
                <span className={`font-mono font-bold ${latency && latency < 100 ? 'text-blue-400' : latency && latency < 500 ? 'text-yellow-400' : 'text-rose-400'}`}>
                  {latency ? `${latency}ms` : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500">Last Check</span>
                <span className="text-slate-400 font-mono">Just now</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}