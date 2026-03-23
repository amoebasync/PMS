'use client';

import React, { useState, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';

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

interface SamplePoint {
  lat: number;
  lng: number;
  index: number;
}

interface Props {
  inspectionId: string;
  checkpoints: Checkpoint[];
  currentPosition: { lat: number; lng: number } | null;
  isActive: boolean;
  onUpdate: () => void;
  samplePoints: SamplePoint[];
  onSamplePointsChange: (points: SamplePoint[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

const resultColor = (result: string | null) => {
  switch (result) {
    case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'NOT_FOUND': return 'bg-red-100 text-red-700 border-red-200';
    case 'UNABLE': return 'bg-slate-100 text-slate-600 border-slate-200';
    default: return 'bg-white text-slate-400 border-slate-200';
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CheckpointPanel({ inspectionId, checkpoints, currentPosition, isActive, onUpdate, samplePoints, onSamplePointsChange }: Props) {
  const { t } = useTranslation('inspections');
  const { showToast } = useNotification();
  const [sampleCount, setSampleCount] = useState(10);
  const [sampleMode, setSampleMode] = useState<'trajectory' | 'area'>('trajectory');
  const [generating, setGenerating] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordResult, setRecordResult] = useState<'CONFIRMED' | 'NOT_FOUND' | 'UNABLE'>('CONFIRMED');
  const [recordNote, setRecordNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ---- Generate samples ---- */
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/sample-points?count=${sampleCount}&mode=${sampleMode}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const points = (data.samplePoints || []).map((p: any) => ({
        lat: p.latitude,
        lng: p.longitude,
        index: p.index,
      }));
      onSamplePointsChange(points);
    } catch {
      showToast(t('error_generic'), 'error');
    }
    setGenerating(false);
  };

  /* ---- Open recording UI for a sample point ---- */
  const openRecording = (index: number) => {
    setRecordingIndex(index);
    setRecordResult('CONFIRMED');
    setRecordNote('');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  /* ---- Handle file selection ---- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  /* ---- Submit checkpoint ---- */
  const handleSubmit = async () => {
    if (recordingIndex === null) return;
    const point = samplePoints[recordingIndex];
    if (!point) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('lat', point.lat.toString());
      formData.append('lng', point.lng.toString());
      formData.append('result', recordResult);
      if (recordNote) formData.append('note', recordNote);
      if (selectedFile) formData.append('photo', selectedFile);

      const res = await fetch(`/api/inspections/${inspectionId}/checkpoints`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();

      showToast(t('success_checkpoint'), 'success');

      // Remove submitted sample from list
      onSamplePointsChange(samplePoints.filter((_, i) => i !== recordingIndex));
      setRecordingIndex(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      onUpdate();
    } catch {
      showToast(t('error_generic'), 'error');
    }
    setSubmitting(false);
  };

  const checkedCount = checkpoints.filter((c) => c.result !== null).length;
  const totalCount = checkpoints.length + samplePoints.length;

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500">{t('section_checkpoints')}</h3>
        <span className="text-xs font-bold text-slate-600">
          {checkedCount} / {totalCount}
        </span>
      </div>

      {/* Sample generation + manual add */}
      {isActive && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">{t('sample_mode')}</span>
            <div className="inline-flex bg-slate-200 rounded-lg p-0.5 flex-1">
              <button
                onClick={() => setSampleMode('trajectory')}
                className={`flex-1 px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${sampleMode === 'trajectory' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                {t('sample_mode_trajectory')}
              </button>
              <button
                onClick={() => setSampleMode('area')}
                className={`flex-1 px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${sampleMode === 'area' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                {t('sample_mode_area')}
              </button>
            </div>
          </div>

          {/* Generate + count */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 shrink-0">{t('sample_count')}</label>
            <input
              type="number"
              min={0}
              max={50}
              value={sampleCount}
              onChange={(e) => setSampleCount(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
              className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {generating ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="bi bi-shuffle"></i>
              )}
              {t('sample_generate')}
            </button>
          </div>

          {/* Manual add */}
          <button
            onClick={() => {
              if (currentPosition) {
                const newPoint = { lat: currentPosition.lat, lng: currentPosition.lng, index: Date.now() };
                onSamplePointsChange([...samplePoints, newPoint]);
                showToast(t('success_checkpoint'), 'success');
              } else {
                showToast('GPS位置を取得できません', 'error');
              }
            }}
            className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-emerald-400 text-slate-500 hover:text-emerald-600 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <i className="bi bi-plus-circle"></i>
            {t('add_manual_checkpoint')}
          </button>
        </div>
      )}

      {/* Recording UI (inline) */}
      {recordingIndex !== null && samplePoints[recordingIndex] && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">
              #{recordingIndex + 1}
            </span>
            <button
              onClick={() => setRecordingIndex(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <i className="bi bi-x-lg text-sm"></i>
            </button>
          </div>

          {/* Result selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['CONFIRMED', 'NOT_FOUND', 'UNABLE'] as const).map((r) => {
              const labels: Record<string, string> = {
                CONFIRMED: t('checkpoint_confirmed'),
                NOT_FOUND: t('checkpoint_not_found'),
                UNABLE: t('checkpoint_unable'),
              };
              const colors: Record<string, string> = {
                CONFIRMED: 'bg-emerald-600 text-white border-emerald-600',
                NOT_FOUND: 'bg-red-500 text-white border-red-500',
                UNABLE: 'bg-slate-500 text-white border-slate-500',
              };
              return (
                <button
                  key={r}
                  onClick={() => setRecordResult(r)}
                  className={`py-2.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${
                    recordResult === r
                      ? colors[r]
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {labels[r]}
                </button>
              );
            })}
          </div>

          {/* Camera capture */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <div className="relative">
                <img src={previewUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <i className="bi bi-x text-sm"></i>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-xs text-slate-400 flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
              >
                <i className="bi bi-camera text-base"></i>
                {t('btn_take_photo')}
              </button>
            )}
          </div>

          {/* Note */}
          <textarea
            value={recordNote}
            onChange={(e) => setRecordNote(e.target.value)}
            placeholder={t('note')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white h-16 resize-none"
          />

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <i className="bi bi-check2"></i>
            )}
            {t('btn_save')}
          </button>
        </div>
      )}

      {/* Pending sample points */}
      {samplePoints.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase">{t('sample_points')}</p>
          {samplePoints.map((point, i) => {
            const dist = currentPosition
              ? haversineM(currentPosition.lat, currentPosition.lng, point.lat, point.lng)
              : null;
            return (
              <div
                key={`sample-${i}`}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors"
              >
                <button
                  onClick={() => isActive && openRecording(i)}
                  disabled={!isActive || recordingIndex !== null}
                  className="flex-1 flex items-center gap-3 p-3 text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-amber-700">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 truncate">
                      {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                    </p>
                    {dist !== null && (
                      <p className="text-[10px] text-slate-400">{formatDistance(dist)}</p>
                    )}
                  </div>
                  <i className="bi bi-chevron-right text-slate-300"></i>
                </button>
                {isActive && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSamplePointsChange(samplePoints.filter((_, j) => j !== i)); }}
                    className="px-2 py-3 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                    title="削除"
                  >
                    <i className="bi bi-trash3 text-sm"></i>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Completed checkpoints */}
      {checkpoints.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase">
            {t('section_checkpoints')} ({checkedCount})
          </p>
          {checkpoints.map((cp) => (
            <div
              key={cp.id}
              className={`flex items-center gap-3 p-3 border rounded-xl ${resultColor(cp.result)}`}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/50">
                {cp.result === 'CONFIRMED' && <i className="bi bi-check-lg text-emerald-600"></i>}
                {cp.result === 'NOT_FOUND' && <i className="bi bi-x-lg text-red-600"></i>}
                {cp.result === 'UNABLE' && <i className="bi bi-dash-lg text-slate-500"></i>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">
                  {cp.result === 'CONFIRMED' ? t('checkpoint_confirmed') : cp.result === 'NOT_FOUND' ? t('checkpoint_not_found') : t('checkpoint_unable')}
                </p>
                {cp.note && <p className="text-[10px] truncate opacity-70">{cp.note}</p>}
              </div>
              {cp.photoUrl && (
                <img src={cp.photoUrl} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {checkpoints.length === 0 && samplePoints.length === 0 && (
        <div className="py-8 text-center">
          <i className="bi bi-check-circle text-3xl text-slate-200 block mb-2"></i>
          <p className="text-xs text-slate-400">{t('empty_checkpoints')}</p>
        </div>
      )}
    </div>
  );
}
