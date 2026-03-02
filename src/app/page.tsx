'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; bgColor: string; textColor: string; badgeBg: string; badgeText: string }> = {
  UPDATE:      { label: 'アップデート', icon: 'bi-stars',                    bgColor: 'bg-indigo-50',  textColor: 'text-indigo-500',  badgeBg: 'bg-indigo-50',  badgeText: 'text-indigo-600' },
  MAINTENANCE: { label: 'メンテナンス', icon: 'bi-tools',                     bgColor: 'bg-rose-50',    textColor: 'text-rose-500',    badgeBg: 'bg-rose-50',    badgeText: 'text-rose-600' },
  IMPORTANT:   { label: '重要',         icon: 'bi-exclamation-triangle-fill', bgColor: 'bg-amber-50',   textColor: 'text-amber-500',   badgeBg: 'bg-amber-50',   badgeText: 'text-amber-700' },
  NOTICE:      { label: 'お知らせ',     icon: 'bi-bell-fill',                 bgColor: 'bg-emerald-50', textColor: 'text-emerald-500', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-600' },
  OTHER:       { label: 'その他',       icon: 'bi-megaphone-fill',            bgColor: 'bg-slate-50',   textColor: 'text-slate-400',   badgeBg: 'bg-slate-100',  badgeText: 'text-slate-600' },
};

/* ------------------------------------------------------------------ */
/*  StatCard                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ title, value, subValue, icon, accentColor }: {
  title: string;
  value: string | number;
  subValue?: React.ReactNode;
  icon: string;
  accentColor: 'blue' | 'emerald' | 'violet' | 'slate';
}) {
  const colors = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-600' },
    slate:   { bg: 'bg-slate-100',  text: 'text-slate-500' },
  };
  const c = colors[accentColor];

  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between h-full hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow duration-200">
      <div className="flex justify-between items-start mb-3">
        <span className="text-gray-500 text-xs font-medium tracking-wide">{title}</span>
        <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
          <i className={`bi ${icon} text-[16px]`} />
        </div>
      </div>
      <div>
        <div className="text-[26px] font-extrabold text-gray-800 tracking-tight leading-none">{value}</div>
        {subValue && (
          <div className="text-[11px] mt-2 text-gray-400 font-medium">{subValue}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AlertCard                                                         */
/* ------------------------------------------------------------------ */

function AlertCard({ href, icon, title, message, count, color }: {
  href: string;
  icon: string;
  title: string;
  message: string;
  count: number;
  color: 'orange' | 'rose' | 'red' | 'purple';
}) {
  const styles = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-200/60', iconBg: 'bg-orange-100', iconText: 'text-orange-600', titleText: 'text-orange-800', bodyText: 'text-orange-600', countText: 'text-orange-700', hoverBg: 'hover:bg-orange-100/50', chevron: 'text-orange-300 group-hover:text-orange-500' },
    rose:   { bg: 'bg-rose-50',   border: 'border-rose-200/60',   iconBg: 'bg-rose-100',   iconText: 'text-rose-600',   titleText: 'text-rose-800',   bodyText: 'text-rose-600',   countText: 'text-rose-700',   hoverBg: 'hover:bg-rose-100/50',   chevron: 'text-rose-300 group-hover:text-rose-500' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200/60',    iconBg: 'bg-red-100',    iconText: 'text-red-600',    titleText: 'text-red-800',    bodyText: 'text-red-600',    countText: 'text-red-700',    hoverBg: 'hover:bg-red-100/50',    chevron: 'text-red-300 group-hover:text-red-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200/60', iconBg: 'bg-purple-100', iconText: 'text-purple-600', titleText: 'text-purple-800', bodyText: 'text-purple-600', countText: 'text-purple-700', hoverBg: 'hover:bg-purple-100/50', chevron: 'text-purple-300 group-hover:text-purple-500' },
  };
  const s = styles[color];

  return (
    <Link href={href} className={`${s.bg} border ${s.border} p-4 rounded-2xl flex items-center justify-between group ${s.hoverBg} transition-colors`}>
      <div className="flex items-center gap-3.5">
        <div className={`w-10 h-10 ${s.iconBg} ${s.iconText} rounded-xl flex items-center justify-center text-lg shrink-0`}>
          <i className={`bi ${icon}`} />
        </div>
        <div>
          <h4 className={`font-bold ${s.titleText} text-sm`}>{title}</h4>
          <p className={`text-xs ${s.bodyText} mt-0.5`}>
            {message} <span className={`font-extrabold text-base ${s.countText}`}>{count}</span> 件あります
          </p>
        </div>
      </div>
      <i className={`bi bi-chevron-right ${s.chevron} transition-colors`} />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                         */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dashRes, announcementsRes, profileRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/announcements'),
          fetch('/api/profile'),
        ]);
        if (dashRes.ok) setData(await dashRes.json());
        if (announcementsRes.ok) {
          const ann = await announcementsRes.json();
          setAnnouncements(Array.isArray(ann) ? ann : []);
        }
        if (profileRes.ok) {
          const profile = await profileRes.json();
          const roles: string[] = profile?.roles?.map((r: any) => r.role?.code) || [];
          const primaryRoleCode: string = profile?.role?.code || '';
          setIsSuperAdmin(roles.includes('SUPER_ADMIN') || primaryRoleCode === 'SUPER_ADMIN');
        }
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
      } catch { setDbStatus('disconnected'); setLatency(null); }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10 max-w-7xl mx-auto">

      {/* ── Alerts ── */}
      {data && (data.alerts.orders > 0 || data.alerts.approvals > 0 || data.crm?.overdueTaskCount > 0 || data.quality?.unresolvedComplaintCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.alerts.orders > 0 && (
            <AlertCard href="/orders" icon="bi-briefcase-fill" title="発注の確認・審査待ち" message="未処理の発注が" count={data.alerts.orders} color="orange" />
          )}
          {data.alerts.approvals > 0 && (
            <AlertCard href="/approvals" icon="bi-person-check-fill" title="人事・経費の承認待ち" message="未承認の申請が" count={data.alerts.approvals} color="rose" />
          )}
          {data.crm?.overdueTaskCount > 0 && (
            <AlertCard href="/crm/tasks?dueDate=overdue" icon="bi-exclamation-triangle-fill" title="期限超過タスク" message="期限を超えたタスクが" count={data.crm.overdueTaskCount} color="red" />
          )}
          {data.quality?.unresolvedComplaintCount > 0 && (
            <AlertCard href="/quality/complaints" icon="bi-exclamation-triangle-fill" title="未対応クレーム" message="未対応のクレームが" count={data.quality.unresolvedComplaintCount} color="purple" />
          )}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="今月の売上合計"
          value={`¥${(data?.kpi?.monthlySales || 0).toLocaleString()}`}
          icon="bi-currency-yen"
          accentColor="blue"
          subValue={<><i className="bi bi-info-circle mr-1" />受注確定済みの累計</>}
        />
        <StatCard
          title="本日の稼働スタッフ"
          value={`${data?.kpi?.distributorsTotal || 0} 名`}
          icon="bi-bicycle"
          accentColor="emerald"
          subValue={
            <span className={data?.kpi?.distributorsCompleted > 0 ? 'text-emerald-500' : ''}>
              <i className="bi bi-check-circle-fill mr-1" />うち {data?.kpi?.distributorsCompleted || 0}名 が業務完了
            </span>
          }
        />
        <StatCard
          title="本日の配布タスク"
          value={`${(data?.kpi?.flyersPlanned || 0).toLocaleString()} 枚`}
          icon="bi-send-fill"
          accentColor="violet"
          subValue={
            <span className={data?.kpi?.flyersActual > 0 ? 'text-violet-500' : ''}>
              <i className="bi bi-check-circle-fill mr-1" />
              {data?.kpi?.flyersActual ? Math.floor((data.kpi.flyersActual / data.kpi.flyersPlanned) * 100) : 0}% ({data?.kpi?.flyersActual?.toLocaleString() || 0}枚) 完了
            </span>
          }
        />
        <StatCard
          title="管理エリア総数"
          value="1,240 ヶ所"
          icon="bi-geo-alt-fill"
          accentColor="slate"
          subValue={<><i className="bi bi-house-heart mr-1" />配布可能 385,200世帯</>}
        />
      </div>

      {/* ── Main content 2-column ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Announcements */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
              <i className="bi bi-megaphone-fill text-indigo-500" /> 全体お知らせ
            </h3>
            {isSuperAdmin && (
              <Link
                href="/announcements"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
              >
                <i className="bi bi-gear-fill text-[10px]" /> 管理
              </Link>
            )}
          </div>
          <div className="p-6 space-y-5 flex-1">
            {announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-3">
                  <i className="bi bi-megaphone text-xl" />
                </div>
                <p className="text-gray-500 text-sm font-medium">お知らせはまだありません</p>
                {isSuperAdmin && (
                  <Link href="/announcements" className="mt-2 text-xs text-indigo-500 hover:underline">
                    お知らせを投稿する →
                  </Link>
                )}
              </div>
            ) : (
              announcements.map((a, i) => {
                const cfg = CATEGORY_CONFIG[a.category] || CATEGORY_CONFIG.OTHER;
                const dateStr = new Date(a.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                return (
                  <React.Fragment key={a.id}>
                    {i > 0 && <div className="w-full h-px bg-gray-100" />}
                    <div className="flex gap-4 items-start">
                      <div className={`w-10 h-10 ${cfg.bgColor} ${cfg.textColor} rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5`}>
                        <i className={`bi ${cfg.icon}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold ${cfg.badgeText} ${cfg.badgeBg} px-2 py-0.5 rounded`}>{cfg.label}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{dateStr}</span>
                        </div>
                        <h4 className="font-bold text-gray-800 text-sm mb-1">{a.title}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Sidebar panels */}
        <div className="space-y-5">

          {/* Tasks */}
          {data?.crm && (
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  <i className="bi bi-check2-all text-indigo-500" /> 本日のタスク
                </h3>
                <Link href="/crm/tasks" className="text-xs text-blue-600 hover:underline font-medium">すべて見る</Link>
              </div>
              {data.crm.dueTodayTaskCount > 0 && (
                <div className="mb-3 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-xl font-medium">
                  <i className="bi bi-clock-fill mr-1" /> 本日期限: {data.crm.dueTodayTaskCount} 件
                </div>
              )}
              {data.crm.myTasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">担当タスクなし</p>
              ) : (
                <div className="space-y-1">
                  {data.crm.myTasks.map((task: any) => {
                    const dueDate = new Date(task.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    dueDate.setHours(0, 0, 0, 0);
                    const isOverdue = dueDate < today;
                    return (
                      <div key={task.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-medium ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                              {isOverdue && <i className="bi bi-exclamation-triangle-fill mr-0.5" />}
                              {dueDate.toLocaleDateString('ja-JP')}
                            </span>
                            {task.customer && (
                              <span className="text-[10px] text-gray-400">· {task.customer.name}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            await fetch(`/api/tasks/${task.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'DONE' }),
                            });
                            const res = await fetch('/api/dashboard');
                            if (res.ok) setData(await res.json());
                          }}
                          className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-lg transition-colors shrink-0"
                          title="完了"
                        >
                          <i className="bi bi-check-lg text-base" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Distributor Performance */}
          {data?.evaluation && (
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  <i className="bi bi-award-fill text-amber-500" /> 配布員パフォーマンス
                </h3>
                <Link href="/distributors" className="text-xs text-blue-600 hover:underline font-medium">すべて見る →</Link>
              </div>
              {data.evaluation.topDistributors?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Top 5</p>
                  <div className="space-y-1.5">
                    {data.evaluation.topDistributors.slice(0, 5).map((d: any, i: number) => {
                      const rankColors: Record<string, string> = { S: 'bg-yellow-500', A: 'bg-blue-500', B: 'bg-green-500', C: 'bg-gray-400', D: 'bg-red-400' };
                      return (
                        <div key={d.id || i} className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded text-[10px] font-black text-white flex items-center justify-center ${rankColors[d.rank] || 'bg-gray-300'}`}>
                            {d.rank}
                          </span>
                          <span className="text-sm font-medium text-gray-700 flex-1 truncate">{d.name}</span>
                          <span className="text-sm font-bold text-gray-800">{d.score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {data.evaluation.attentionDistributors?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">要注意</p>
                  <div className="space-y-1.5">
                    {data.evaluation.attentionDistributors.slice(0, 5).map((d: any, i: number) => (
                      <div key={d.id || i} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate flex-1">{d.name}</span>
                        <span className="text-xs font-bold text-red-500">
                          <i className="bi bi-exclamation-triangle-fill mr-0.5" />{d.complaintCount}件
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!data.evaluation.topDistributors?.length && !data.evaluation.attentionDistributors?.length) && (
                <p className="text-xs text-gray-400 text-center py-4">評価データなし</p>
              )}
            </div>
          )}

          {/* EC Portal status */}
          {data && (
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  <i className="bi bi-laptop text-fuchsia-500" /> ECポータル利用状況
                </h3>
                {data.ec.activeUsers > 0 && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-gray-100 pb-2.5">
                  <div className="text-xs text-gray-500 font-medium">現在見ている人 <span className="text-[9px] text-gray-400 ml-1">(直近1H)</span></div>
                  <div className="text-xl font-extrabold text-gray-800 tracking-tight">{data.ec.activeUsers}<span className="text-xs font-medium text-gray-400 ml-0.5">人</span></div>
                </div>
                <div className="flex justify-between items-end border-b border-gray-100 pb-2.5">
                  <div className="text-xs text-gray-500 font-medium">今月の新規登録</div>
                  <div className="text-base font-bold text-gray-700">{data.ec.newUsersThisMonth}<span className="text-[10px] font-medium text-gray-400 ml-0.5">件</span></div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="text-xs text-gray-500 font-medium">累計登録アカウント</div>
                  <div className="text-sm font-bold text-gray-700">{data.ec.totalUsers}<span className="text-[10px] font-medium text-gray-400 ml-0.5">件</span></div>
                </div>
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="bg-gray-900 rounded-2xl p-5 text-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-15 -mr-8 -mt-8 ${dbStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'}`} />

            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <i className={`bi bi-server text-sm ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
              <div>
                <div className="font-bold text-sm">System Status</div>
                <div className={`text-[10px] font-semibold flex items-center gap-1.5 ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'checking' ? 'bg-yellow-400 animate-ping' : dbStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  {dbStatus === 'connected' ? 'All Systems Operational' : dbStatus === 'checking' ? 'Checking Status...' : 'System Error Detected'}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 relative z-10">
              <div className="flex justify-between items-center text-[11px] border-b border-white/10 pb-2">
                <span className="text-gray-400">Database (RDS)</span>
                <span className={`font-mono font-bold ${dbStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dbStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] border-b border-white/10 pb-2">
                <span className="text-gray-400">API Latency</span>
                <span className={`font-mono font-bold ${latency && latency < 100 ? 'text-blue-400' : latency && latency < 500 ? 'text-yellow-400' : 'text-rose-400'}`}>
                  {latency ? `${latency}ms` : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-500">Last Check</span>
                <span className="text-gray-400 font-mono">Just now</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
