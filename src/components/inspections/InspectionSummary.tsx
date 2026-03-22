'use client';

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Checkpoint {
  id: number;
  lat: number;
  lng: number;
  result: 'CONFIRMED' | 'NOT_FOUND' | 'UNABLE' | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface ProhibitedCheck {
  id: number;
  prohibitedPropertyId: number;
  result: 'COMPLIANT' | 'VIOLATION' | 'UNABLE' | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface Inspection {
  id: number;
  confirmationRate: number | null;
  complianceRate: number | null;
  distributionSpeed: string | null;
  stickerCompliance: string | null;
  prohibitedCompliance: string | null;
  mapComprehension: string | null;
  workAttitude: string | null;
  note: string | null;
  followUpRequired: boolean;
}

interface Props {
  inspection: Inspection;
  checkpoints: Checkpoint[];
  prohibitedChecks: ProhibitedCheck[];
}

/* ------------------------------------------------------------------ */
/*  Circular progress                                                  */
/* ------------------------------------------------------------------ */

function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 36;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[88px] h-[88px]">
        <svg width="88" height="88" className="-rotate-90">
          {/* Background circle */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          {/* Progress arc */}
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black text-slate-700">{Math.round(value)}%</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-500 text-center">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Guidance score label                                               */
/* ------------------------------------------------------------------ */

const guidanceLabel = (value: string | null, t: (k: string) => string): { label: string; cls: string } => {
  if (!value) return { label: '--', cls: 'text-slate-400' };

  const map: Record<string, { label: string; cls: string }> = {
    VERY_SLOW: { label: t('inspection_speed_very_slow'), cls: 'text-red-600' },
    SLOW: { label: t('inspection_speed_slow'), cls: 'text-orange-600' },
    NORMAL: { label: t('inspection_speed_normal'), cls: 'text-yellow-600' },
    FAST: { label: t('inspection_speed_fast'), cls: 'text-emerald-600' },
    VERY_FAST: { label: t('inspection_speed_very_fast'), cls: 'text-emerald-700' },
    NO_MISTAKES: { label: t('inspection_no_mistakes'), cls: 'text-emerald-600' },
    SOME: { label: t('inspection_some_mistakes'), cls: 'text-yellow-600' },
    MANY: { label: t('inspection_many_mistakes'), cls: 'text-red-600' },
    BAD: { label: t('inspection_level_bad'), cls: 'text-red-600' },
    GOOD: { label: t('inspection_level_good'), cls: 'text-emerald-600' },
  };

  return map[value] || { label: value, cls: 'text-slate-600' };
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InspectionSummary({ inspection, checkpoints, prohibitedChecks }: Props) {
  const { t } = useTranslation('inspections');

  /* ---- Checkpoint breakdown ---- */
  const cpBreakdown = useMemo(() => {
    const confirmed = checkpoints.filter((c) => c.result === 'CONFIRMED').length;
    const notFound = checkpoints.filter((c) => c.result === 'NOT_FOUND').length;
    const unable = checkpoints.filter((c) => c.result === 'UNABLE').length;
    const total = checkpoints.length;
    return { confirmed, notFound, unable, total };
  }, [checkpoints]);

  /* ---- Prohibited breakdown ---- */
  const ppBreakdown = useMemo(() => {
    const compliant = prohibitedChecks.filter((c) => c.result === 'COMPLIANT').length;
    const violation = prohibitedChecks.filter((c) => c.result === 'VIOLATION').length;
    const unable = prohibitedChecks.filter((c) => c.result === 'UNABLE').length;
    const total = prohibitedChecks.length;
    return { compliant, violation, unable, total };
  }, [prohibitedChecks]);

  /* ---- Rates ---- */
  const confirmationRate = useMemo(() => {
    if (inspection.confirmationRate !== null) return inspection.confirmationRate;
    const checkable = cpBreakdown.confirmed + cpBreakdown.notFound;
    if (checkable === 0) return 0;
    return Math.round((cpBreakdown.confirmed / checkable) * 100);
  }, [inspection.confirmationRate, cpBreakdown]);

  const complianceRate = useMemo(() => {
    if (inspection.complianceRate !== null) return inspection.complianceRate;
    const checkable = ppBreakdown.compliant + ppBreakdown.violation;
    if (checkable === 0) return 0;
    return Math.round((ppBreakdown.compliant / checkable) * 100);
  }, [inspection.complianceRate, ppBreakdown]);

  /* ---- Timeline: merge checkpoints and prohibited checks, sort by time ---- */
  const timeline = useMemo(() => {
    const items: { type: 'checkpoint' | 'prohibited'; time: string; result: string | null; note: string | null; photoUrl: string | null }[] = [];

    checkpoints.forEach((cp) => {
      items.push({
        type: 'checkpoint',
        time: cp.createdAt,
        result: cp.result,
        note: cp.note,
        photoUrl: cp.photoUrl,
      });
    });

    prohibitedChecks.forEach((pc) => {
      items.push({
        type: 'prohibited',
        time: pc.createdAt,
        result: pc.result,
        note: pc.note,
        photoUrl: pc.photoUrl,
      });
    });

    return items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [checkpoints, prohibitedChecks]);

  const fmtTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo',
      });
    } catch {
      return '';
    }
  };

  const resultLabel = (type: string, result: string | null) => {
    if (type === 'checkpoint') {
      if (result === 'CONFIRMED') return t('checkpoint_confirmed');
      if (result === 'NOT_FOUND') return t('checkpoint_not_found');
      if (result === 'UNABLE') return t('checkpoint_unable');
    } else {
      if (result === 'COMPLIANT') return t('prohibited_compliant');
      if (result === 'VIOLATION') return t('prohibited_violation');
      if (result === 'UNABLE') return t('prohibited_unable');
    }
    return '--';
  };

  const resultCls = (result: string | null) => {
    switch (result) {
      case 'CONFIRMED':
      case 'COMPLIANT':
        return 'text-emerald-600';
      case 'NOT_FOUND':
      case 'VIOLATION':
        return 'text-red-600';
      default:
        return 'text-slate-500';
    }
  };

  /* ---- Guidance fields ---- */
  const guidanceFields = [
    { key: 'distributionSpeed', label: t('guidance_speed'), value: inspection.distributionSpeed },
    { key: 'stickerCompliance', label: t('guidance_sticker'), value: inspection.stickerCompliance },
    { key: 'prohibitedCompliance', label: t('guidance_prohibited'), value: inspection.prohibitedCompliance },
    { key: 'mapComprehension', label: t('guidance_map'), value: inspection.mapComprehension },
    { key: 'workAttitude', label: t('guidance_attitude'), value: inspection.workAttitude },
  ];

  const hasGuidance = guidanceFields.some((f) => f.value !== null);

  return (
    <div className="p-4 space-y-5">
      <h3 className="text-xs font-bold text-slate-500">{t('section_summary')}</h3>

      {/* Rates */}
      <div className="flex justify-center gap-8">
        <CircularProgress
          value={confirmationRate}
          label={t('confirmation_rate')}
          color={confirmationRate >= 80 ? '#22c55e' : confirmationRate >= 50 ? '#eab308' : '#ef4444'}
        />
        <CircularProgress
          value={complianceRate}
          label={t('compliance_rate')}
          color={complianceRate >= 80 ? '#22c55e' : complianceRate >= 50 ? '#eab308' : '#ef4444'}
        />
      </div>

      {/* Checkpoint breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t('section_checkpoints')}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-lg font-black text-emerald-600">{cpBreakdown.confirmed}</span>
            <p className="text-[10px] text-slate-400">{t('checkpoint_confirmed')}</p>
          </div>
          <div>
            <span className="text-lg font-black text-red-600">{cpBreakdown.notFound}</span>
            <p className="text-[10px] text-slate-400">{t('checkpoint_not_found')}</p>
          </div>
          <div>
            <span className="text-lg font-black text-slate-500">{cpBreakdown.unable}</span>
            <p className="text-[10px] text-slate-400">{t('checkpoint_unable')}</p>
          </div>
        </div>
      </div>

      {/* Prohibited breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t('section_prohibited')}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-lg font-black text-emerald-600">{ppBreakdown.compliant}</span>
            <p className="text-[10px] text-slate-400">{t('prohibited_compliant')}</p>
          </div>
          <div>
            <span className="text-lg font-black text-red-600">{ppBreakdown.violation}</span>
            <p className="text-[10px] text-slate-400">{t('prohibited_violation')}</p>
          </div>
          <div>
            <span className="text-lg font-black text-slate-500">{ppBreakdown.unable}</span>
            <p className="text-[10px] text-slate-400">{t('prohibited_unable')}</p>
          </div>
        </div>
      </div>

      {/* Guidance scores */}
      {hasGuidance && (
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t('section_guidance')}</p>
          <div className="space-y-2">
            {guidanceFields.map((f) => {
              const { label, cls } = guidanceLabel(f.value, t);
              return (
                <div key={f.key} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{f.label}</span>
                  <span className={`text-xs font-bold ${cls}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Follow-up */}
      {inspection.followUpRequired && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill text-rose-500"></i>
          <span className="text-xs font-bold text-rose-700">{t('follow_up_required')}</span>
        </div>
      )}

      {/* Note */}
      {inspection.note && (
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 mb-1">{t('note')}</p>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{inspection.note}</p>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Timeline</p>
          <div className="space-y-0">
            {timeline.map((item, i) => (
              <div key={i} className="flex gap-3">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    item.type === 'checkpoint' ? 'bg-blue-400' : 'bg-amber-400'
                  }`}></div>
                  {i < timeline.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 min-h-[24px]"></div>
                  )}
                </div>

                {/* Content */}
                <div className="pb-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{fmtTime(item.time)}</span>
                    <span className={`text-[10px] font-bold ${resultCls(item.result)}`}>
                      {resultLabel(item.type, item.result)}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      item.type === 'checkpoint' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {item.type === 'checkpoint' ? t('section_checkpoints') : t('section_prohibited')}
                    </span>
                  </div>
                  {item.note && (
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.note}</p>
                  )}
                  {item.photoUrl && (
                    <img
                      src={item.photoUrl}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg mt-1"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
