'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Inspection {
  id: number;
  distributionSpeed: string | null;
  stickerCompliance: string | null;
  prohibitedCompliance: string | null;
  mapComprehension: string | null;
  workAttitude: string | null;
  multipleInsertion: string | null;
  fraudTrace: string | null;
  note: string | null;
  followUpRequired: boolean;
}

interface Props {
  inspectionId: string;
  inspection: Inspection;
  category: 'CHECK' | 'GUIDANCE';
  isActive: boolean;
  onUpdate: () => void;
}

/* ------------------------------------------------------------------ */
/*  SegmentButtons (reused from InspectionsTab pattern)                */
/* ------------------------------------------------------------------ */

function SegmentButtons({ options, value, onChange, disabled }: {
  options: { value: string; label: string; color?: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const colorClass = isSelected
          ? (opt.color || 'bg-emerald-600 text-white border-emerald-600')
          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-w-0 px-2 py-2.5 text-xs font-bold rounded-lg border transition-all ${colorClass} active:scale-95 disabled:opacity-50`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GuidancePanel({ inspectionId, inspection, category, isActive, onUpdate }: Props) {
  const { t } = useTranslation('inspections');
  const { showToast } = useNotification();

  const [distributionSpeed, setDistributionSpeed] = useState(inspection.distributionSpeed || '');
  const [stickerCompliance, setStickerCompliance] = useState(inspection.stickerCompliance || '');
  const [prohibitedCompliance, setProhibitedCompliance] = useState(inspection.prohibitedCompliance || '');
  const [mapComprehension, setMapComprehension] = useState(inspection.mapComprehension || '');
  const [workAttitude, setWorkAttitude] = useState(inspection.workAttitude || '');
  const [note, setNote] = useState(inspection.note || '');
  const [multipleInsertion, setMultipleInsertion] = useState(inspection.multipleInsertion || '');
  const [fraudTrace, setFraudTrace] = useState(inspection.fraudTrace || '');
  const [followUpRequired, setFollowUpRequired] = useState(inspection.followUpRequired);
  const [saving, setSaving] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state when inspection changes externally
  useEffect(() => {
    setDistributionSpeed(inspection.distributionSpeed || '');
    setStickerCompliance(inspection.stickerCompliance || '');
    setProhibitedCompliance(inspection.prohibitedCompliance || '');
    setMapComprehension(inspection.mapComprehension || '');
    setWorkAttitude(inspection.workAttitude || '');
    setMultipleInsertion(inspection.multipleInsertion || '');
    setFraudTrace(inspection.fraudTrace || '');
    setNote(inspection.note || '');
    setFollowUpRequired(inspection.followUpRequired);
  }, [inspection]);

  /* ---- Auto-save ---- */
  const autoSave = useCallback(
    (updates: Record<string, any>) => {
      if (!isActive) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const res = await fetch(`/api/inspections/${inspectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          if (!res.ok) throw new Error();
          onUpdate();
        } catch {
          showToast(t('error_generic'), 'error');
        }
        setSaving(false);
      }, 800);
    },
    [inspectionId, isActive, onUpdate, showToast, t]
  );

  /* ---- Field change handlers ---- */
  const handleSpeedChange = (v: string) => {
    setDistributionSpeed(v);
    autoSave({ distributionSpeed: v || null });
  };
  const handleStickerChange = (v: string) => {
    setStickerCompliance(v);
    autoSave({ stickerCompliance: v || null });
  };
  const handleProhibitedChange = (v: string) => {
    setProhibitedCompliance(v);
    autoSave({ prohibitedCompliance: v || null });
  };
  const handleMapChange = (v: string) => {
    setMapComprehension(v);
    autoSave({ mapComprehension: v || null });
  };
  const handleAttitudeChange = (v: string) => {
    setWorkAttitude(v);
    autoSave({ workAttitude: v || null });
  };
  const handleNoteChange = (v: string) => {
    setNote(v);
    autoSave({ note: v || null });
  };
  const handleFollowUpChange = (v: boolean) => {
    setFollowUpRequired(v);
    autoSave({ followUpRequired: v });
  };

  /* ---- Speed options ---- */
  const speedOptions = [
    { value: 'VERY_SLOW', label: t('inspection_speed_very_slow'), color: 'bg-red-500 text-white border-red-500' },
    { value: 'SLOW', label: t('inspection_speed_slow'), color: 'bg-orange-500 text-white border-orange-500' },
    { value: 'NORMAL', label: t('inspection_speed_normal'), color: 'bg-yellow-500 text-white border-yellow-500' },
    { value: 'FAST', label: t('inspection_speed_fast'), color: 'bg-emerald-500 text-white border-emerald-500' },
    { value: 'VERY_FAST', label: t('inspection_speed_very_fast'), color: 'bg-emerald-600 text-white border-emerald-600' },
  ];

  const complianceOptions = [
    { value: 'NO_MISTAKES', label: t('inspection_no_mistakes'), color: 'bg-emerald-600 text-white border-emerald-600' },
    { value: 'SOME', label: t('inspection_some_mistakes'), color: 'bg-yellow-500 text-white border-yellow-500' },
    { value: 'MANY', label: t('inspection_many_mistakes'), color: 'bg-red-500 text-white border-red-500' },
  ];

  const levelOptions = [
    { value: 'BAD', label: t('inspection_level_bad'), color: 'bg-red-500 text-white border-red-500' },
    { value: 'NORMAL', label: t('inspection_level_normal'), color: 'bg-yellow-500 text-white border-yellow-500' },
    { value: 'GOOD', label: t('inspection_level_good'), color: 'bg-emerald-600 text-white border-emerald-600' },
  ];

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500">{t('section_guidance')}</h3>
        {saving && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            {t('btn_save')}...
          </div>
        )}
      </div>

      {category === 'CHECK' ? (
        <>
          {/* チェック用項目 */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('check_flyer_protrusion')}</label>
            <SegmentButtons
              options={complianceOptions}
              value={multipleInsertion}
              onChange={(v) => { setMultipleInsertion(v); autoSave({ multipleInsertion: v || null }); }}
              disabled={!isActive}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('check_sticker_compliance')}</label>
            <SegmentButtons
              options={complianceOptions}
              value={stickerCompliance}
              onChange={handleStickerChange}
              disabled={!isActive}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('check_disposal')}</label>
            <SegmentButtons
              options={[
                { value: 'NONE', label: t('check_disposal_none'), color: 'bg-emerald-600 text-white border-emerald-600' },
                { value: 'SUSPICIOUS', label: t('check_disposal_suspicious'), color: 'bg-yellow-500 text-white border-yellow-500' },
                { value: 'FOUND', label: t('check_disposal_found'), color: 'bg-red-500 text-white border-red-500' },
              ]}
              value={fraudTrace}
              onChange={(v) => { setFraudTrace(v); autoSave({ fraudTrace: v || null }); }}
              disabled={!isActive}
            />
          </div>
        </>
      ) : (
        <>
          {/* 指導用項目 */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('guidance_speed')}</label>
            <SegmentButtons options={speedOptions} value={distributionSpeed} onChange={handleSpeedChange} disabled={!isActive} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('guidance_sticker')}</label>
            <SegmentButtons options={complianceOptions} value={stickerCompliance} onChange={handleStickerChange} disabled={!isActive} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('guidance_prohibited')}</label>
            <SegmentButtons options={complianceOptions} value={prohibitedCompliance} onChange={handleProhibitedChange} disabled={!isActive} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('guidance_map')}</label>
            <SegmentButtons options={levelOptions} value={mapComprehension} onChange={handleMapChange} disabled={!isActive} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2">{t('guidance_attitude')}</label>
            <SegmentButtons options={levelOptions} value={workAttitude} onChange={handleAttitudeChange} disabled={!isActive} />
          </div>
        </>
      )}

      {/* Note */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">{t('note')}</label>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          disabled={!isActive}
          placeholder={t('note')}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white h-24 resize-none disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      {/* Follow-up */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={followUpRequired}
          onChange={(e) => handleFollowUpChange(e.target.checked)}
          disabled={!isActive}
          className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
        />
        <span className="text-xs font-bold text-slate-600">{t('follow_up_required')}</span>
      </label>
    </div>
  );
}
