'use client';

import React, { useState, useEffect } from 'react';

const RANK_COLORS: Record<string, { bg: string; text: string }> = {
  S: { bg: 'bg-yellow-500', text: 'text-white' },
  A: { bg: 'bg-blue-500', text: 'text-white' },
  B: { bg: 'bg-green-500', text: 'text-white' },
  C: { bg: 'bg-slate-400', text: 'text-white' },
  D: { bg: 'bg-red-400', text: 'text-white' },
};

interface DistributorDetailModalProps {
  distributorId: number;
  onClose: () => void;
}

export default function DistributorDetailModal({ distributorId, onClose }: DistributorDetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/distributors/${distributorId}`);
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [distributorId]);

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-700 break-words flex-1">{value ?? '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : !data ? (
          <div className="p-6 text-center text-slate-500 text-sm">データが見つかりません</div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-4 relative">
              <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors">
                <i className="bi bi-x-lg text-lg"></i>
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-black shrink-0">
                  {data.avatarUrl ? (
                    <img src={data.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    data.name?.charAt(0) || '?'
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-white font-bold text-lg truncate">{data.name}</h2>
                    {data.evalRank && (
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-sm ${RANK_COLORS[data.evalRank]?.bg || 'bg-slate-400'} ${RANK_COLORS[data.evalRank]?.text || 'text-white'}`}>
                        {data.evalRank}
                      </span>
                    )}
                  </div>
                  <div className="text-white/70 text-sm">{data.staffId || '—'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {data.status === 'ACTIVE' ? (
                      <span className="text-[10px] font-bold bg-emerald-400/30 text-emerald-100 px-2 py-0.5 rounded-full">在籍</span>
                    ) : data.status === 'LEFT' ? (
                      <span className="text-[10px] font-bold bg-red-400/30 text-red-100 px-2 py-0.5 rounded-full">退職</span>
                    ) : null}
                    {data.branch?.nameJa && (
                      <span className="text-[10px] text-white/60">{data.branch.nameJa}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex border-b border-slate-100">
              <div className="flex-1 text-center py-3 border-r border-slate-100">
                <div className="text-lg font-black text-indigo-600">{data.totalWorkDays ?? 0}</div>
                <div className="text-[10px] text-slate-400">出勤日数</div>
              </div>
              <div className="flex-1 text-center py-3 border-r border-slate-100">
                <div className="text-lg font-black text-emerald-600">{data._count?.schedules ?? 0}</div>
                <div className="text-[10px] text-slate-400">完了件数</div>
              </div>
              <div className="flex-1 text-center py-3">
                <div className="text-lg font-black text-amber-600">
                  {data.avgDistributionRate != null ? `${data.avgDistributionRate}%` : '—'}
                </div>
                <div className="text-[10px] text-slate-400">配布率</div>
              </div>
            </div>

            {/* Detail Info */}
            <div className="px-5 py-3 max-h-[40vh] overflow-y-auto">
              <InfoRow label="電話番号" value={data.phone} />
              <InfoRow label="メール" value={data.email} />
              <InfoRow label="国籍" value={data.country?.name} />
              <InfoRow label="ビザ" value={data.visaType?.name} />
              <InfoRow label="生年月日" value={data.birthday ? new Date(data.birthday).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : null} />
              <InfoRow label="住所" value={data.address} />
              {data.evalScore != null && (
                <InfoRow label="評価スコア" value={`${data.evalScore} / 100`} />
              )}
              {data.leaveDate && (
                <InfoRow label="退職日" value={new Date(data.leaveDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })} />
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center">
              <a
                href={`/distributors/${distributorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1 transition-colors"
              >
                <i className="bi bi-box-arrow-up-right"></i>
                詳細ページを開く
              </a>
              <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                閉じる
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
