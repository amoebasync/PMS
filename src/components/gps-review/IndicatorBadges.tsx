'use client';

/* ------------------------------------------------------------------ */
/*  IndicatorBadges — 3 core indicator cards + 2 auxiliary badges      */
/* ------------------------------------------------------------------ */

interface CoverageIndicator {
  score: number;
  diffPercent: number | null;
  currentInsideRatio: number | null;
  pastAvgInsideRatio: number | null;
  pastSamples: number | null;
  isDeliverAll: boolean | null;
  reason: string;
}

interface SpeedIndicator {
  score: number;
  currentSpeed: number | null;
  avgSpeed: number | null;
  stdSpeed: number | null;
  zScore: number | null;
  pastSamples: number | null;
  reason: string;
}

interface FastMoveIndicator {
  score: number;
  fastRatio: number | null;
  totalInsideMinutes: number | null;
  fastMinutes: number | null;
  reason: string;
}

interface AuxiliaryIndicator {
  outOfAreaPct: number;
  outOfAreaWarning: boolean;
  pauseMinutes: number;
  pauseWarning: boolean;
}

export interface IndicatorData {
  coverage: CoverageIndicator | null;
  speed: SpeedIndicator | null;
  fastMove: FastMoveIndicator | null;
  auxiliary: AuxiliaryIndicator | null;
  riskScoreV2: number | null;
  riskLevelV2: string | null;
}

interface Props {
  indicators: IndicatorData;
}

/* ---- Helpers ---- */

function scoreToStatus(score: number): { label: string; bg: string; text: string } {
  if (score >= 0.6) return { label: '要確認', bg: 'bg-red-50', text: 'text-red-700' };
  if (score >= 0.3) return { label: '注意', bg: 'bg-amber-50', text: 'text-amber-700' };
  return { label: '問題なし', bg: 'bg-emerald-50', text: 'text-emerald-700' };
}

function scoreToIcon(score: number): string {
  if (score >= 0.6) return 'bi-exclamation-triangle-fill';
  if (score >= 0.3) return 'bi-exclamation-circle-fill';
  return 'bi-check-circle-fill';
}

function scoreToDot(score: number): string {
  if (score >= 0.6) return 'bg-red-500';
  if (score >= 0.3) return 'bg-amber-500';
  return 'bg-emerald-500';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IndicatorBadges({ indicators }: Props) {
  const { coverage, speed, fastMove, auxiliary } = indicators;

  const coverageScore = coverage?.score ?? 0;
  const speedScore = speed?.score ?? 0;
  const fastMoveScore = fastMove?.score ?? 0;

  const coverageStatus = scoreToStatus(coverageScore);
  const speedStatus = scoreToStatus(speedScore);
  const fastMoveStatus = scoreToStatus(fastMoveScore);

  /* Main value formatting */
  const coverageValue = coverage?.currentInsideRatio != null
    ? `${Math.round(coverage.currentInsideRatio * 100)}%`
    : coverage?.diffPercent != null
      ? `${coverage.diffPercent > 0 ? '+' : ''}${coverage.diffPercent}%`
      : coverage?.score != null
        ? `${Math.round((1 - coverage.score) * 100)}%`
        : '--';

  const speedValue = speed?.currentSpeed != null
    ? `${Math.round(speed.currentSpeed)}枚/h`
    : '正常';

  const fastMoveValue = fastMove?.fastRatio != null
    ? `${Math.round(fastMove.fastRatio * 100)}%`
    : '正常';

  return (
    <div className="space-y-3">
      {/* 3 Core Indicator Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Coverage */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
            <i className="bi bi-bar-chart-fill text-sm" />
            <span>カバレッジ</span>
          </div>
          <div className="text-lg font-bold text-slate-800 mb-1.5">{coverageValue}</div>
          <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${coverageStatus.bg} ${coverageStatus.text}`}>
            <i className={`bi ${scoreToIcon(coverageScore)} text-[10px]`} />
            {coverageStatus.label}
          </div>
        </div>

        {/* Speed */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
            <i className="bi bi-lightning-charge-fill text-sm" />
            <span>配布速度</span>
          </div>
          <div className="text-lg font-bold text-slate-800 mb-1.5">{speedValue}</div>
          <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${speedStatus.bg} ${speedStatus.text}`}>
            <i className={`bi ${scoreToIcon(speedScore)} text-[10px]`} />
            {speedStatus.label}
          </div>
        </div>

        {/* Fast Move */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 mb-1.5">
            <i className="bi bi-person-walking text-sm" />
            <span>移動速度</span>
          </div>
          <div className="text-lg font-bold text-slate-800 mb-1.5">{fastMoveValue}</div>
          <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${fastMoveStatus.bg} ${fastMoveStatus.text}`}>
            <i className={`bi ${scoreToIcon(fastMoveScore)} text-[10px]`} />
            {fastMoveStatus.label}
          </div>
        </div>
      </div>

      {/* 2 Auxiliary Indicators */}
      {auxiliary && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">エリア外:</span>
            <span className={`text-xs font-bold ${auxiliary.outOfAreaWarning ? 'text-amber-700' : 'text-slate-700'}`}>
              {Math.round(auxiliary.outOfAreaPct)}%
            </span>
            {auxiliary.outOfAreaWarning && (
              <span className={`w-1.5 h-1.5 rounded-full ${scoreToDot(0.5)}`} />
            )}
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">PAUSE:</span>
            <span className={`text-xs font-bold ${auxiliary.pauseWarning ? 'text-amber-700' : 'text-slate-700'}`}>
              {Math.round(auxiliary.pauseMinutes)}分
            </span>
            {auxiliary.pauseWarning && (
              <span className={`w-1.5 h-1.5 rounded-full ${scoreToDot(0.5)}`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Export helper for schedule list dots ---- */
export function indicatorDots(coverageScore: number, speedScore: number, fastMoveScore: number) {
  return [coverageScore, speedScore, fastMoveScore].map((s) => scoreToDot(s));
}
