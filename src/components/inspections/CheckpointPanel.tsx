'use client';

import React, { useState, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Checkpoint {
  id: number;
  targetLat: number;
  targetLng: number;
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CheckpointPanel({ inspectionId, checkpoints, currentPosition, isActive, onUpdate, samplePoints, onSamplePointsChange }: Props) {
  const { t } = useTranslation('inspections');
  const { showToast } = useNotification();
  const [sampleCount, setSampleCount] = useState(10);
  const [sampleMode, setSampleMode] = useState<'trajectory' | 'area'>('area');
  const [generating, setGenerating] = useState(false);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordResult, setRecordResult] = useState<'CONFIRMED' | 'NOT_FOUND'>('CONFIRMED');
  const [editingCheckpointId, setEditingCheckpointId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [recordNote, setRecordNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ---- Match sample point to checkpoint ---- */
  const getMatchedCheckpoint = (sp: SamplePoint): Checkpoint | null => {
    return checkpoints.find(
      (cp) => Math.abs(cp.targetLat - sp.lat) < 0.0002 && Math.abs(cp.targetLng - sp.lng) < 0.0002
    ) || null;
  };

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

  /* ---- Open recording UI ---- */
  const openRecording = (index: number, existingCheckpoint?: any) => {
    setRecordingIndex(index);
    setRecordResult(existingCheckpoint?.result === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFIRMED');
    setRecordNote(existingCheckpoint?.note || '');
    setEditingCheckpointId(existingCheckpoint?.id || null);
    setSelectedFile(null);
    setPreviewUrl(null);
    requestAnimationFrame(() => {
      panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  /* ---- Handle file selection ---- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  /* ---- Submit checkpoint (create or update) ---- */
  const handleSubmit = async () => {
    if (recordingIndex === null) return;
    const point = samplePoints[recordingIndex];
    if (!point) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('targetLat', point.lat.toString());
      formData.append('targetLng', point.lng.toString());
      formData.append('result', recordResult);
      if (currentPosition) {
        formData.append('actualLat', currentPosition.lat.toString());
        formData.append('actualLng', currentPosition.lng.toString());
      }
      if (recordNote) formData.append('note', recordNote);
      if (selectedFile) formData.append('photo', selectedFile);

      // 編集モードの場合はPUT、新規の場合はPOST
      const url = editingCheckpointId
        ? `/api/inspections/${inspectionId}/checkpoints?checkpointId=${editingCheckpointId}`
        : `/api/inspections/${inspectionId}/checkpoints`;
      const res = await fetch(url, {
        method: editingCheckpointId ? 'PUT' : 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();

      showToast(t('success_checkpoint'), 'success');
      setRecordingIndex(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      onUpdate();
    } catch {
      showToast(t('error_generic'), 'error');
    }
    setSubmitting(false);
  };

  /* ---- Delete checkpoint ---- */
  const handleDeleteCheckpoint = async (checkpointId: number) => {
    setDeleting(checkpointId);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/checkpoints?checkpointId=${checkpointId}`, { method: 'DELETE' });
      if (res.ok) onUpdate();
    } catch { showToast(t('error_generic'), 'error'); }
    setDeleting(null);
  };

  const checkedCount = samplePoints.filter((sp) => getMatchedCheckpoint(sp) !== null).length;
  const totalCount = samplePoints.length;

  return (
    <div ref={panelRef} className="p-3 md:p-4 space-y-3">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500">{t('section_checkpoints')}</h3>
        <span className="text-xs font-bold text-slate-600">
          {checkedCount} / {totalCount}
        </span>
      </div>

      {/* Sample generation */}
      {isActive && (
        <div className="bg-slate-50 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-200 rounded-lg p-0.5 flex-1">
              <button
                onClick={() => setSampleMode('trajectory')}
                className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${sampleMode === 'trajectory' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                {t('sample_mode_trajectory')}
              </button>
              <button
                onClick={() => setSampleMode('area')}
                className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${sampleMode === 'area' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                {t('sample_mode_area')}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={50}
              value={sampleCount}
              onChange={(e) => setSampleCount(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
              className="w-14 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {generating ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="bi bi-shuffle text-xs"></i>
              )}
              {t('sample_generate')}
            </button>
            <button
              onClick={() => {
                if (currentPosition) {
                  onSamplePointsChange([...samplePoints, { lat: currentPosition.lat, lng: currentPosition.lng, index: Date.now() }]);
                } else if (samplePoints.length > 0) {
                  const avgLat = samplePoints.reduce((s, p) => s + p.lat, 0) / samplePoints.length;
                  const avgLng = samplePoints.reduce((s, p) => s + p.lng, 0) / samplePoints.length;
                  onSamplePointsChange([...samplePoints, { lat: avgLat, lng: avgLng, index: Date.now() }]);
                }
              }}
              className="w-8 h-8 border border-dashed border-slate-300 hover:border-emerald-400 text-slate-400 hover:text-emerald-600 rounded-lg flex items-center justify-center transition-colors shrink-0"
              title={t('add_manual_checkpoint')}
            >
              <i className="bi bi-plus text-base"></i>
            </button>
          </div>
        </div>
      )}

      {/* Recording UI (sticky at top) */}
      {recordingIndex !== null && samplePoints[recordingIndex] && (
        <div className="sticky top-0 z-10 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-700">
              <i className="bi bi-pencil-square mr-1"></i>#{recordingIndex + 1}
            </span>
            <button onClick={() => setRecordingIndex(null)} className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-slate-400 hover:text-slate-600 shadow-sm">
              <i className="bi bi-x-lg text-sm"></i>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['CONFIRMED', 'NOT_FOUND'] as const).map((r) => {
              const labels: Record<string, string> = {
                CONFIRMED: t('checkpoint_confirmed'),
                NOT_FOUND: t('checkpoint_not_found'),
              };
              const colors: Record<string, string> = {
                CONFIRMED: 'bg-emerald-600 text-white border-emerald-600',
                NOT_FOUND: 'bg-red-500 text-white border-red-500',
              };
              const icons: Record<string, string> = {
                CONFIRMED: 'bi-check-circle-fill',
                NOT_FOUND: 'bi-x-circle-fill',
              };
              return (
                <button
                  key={r}
                  onClick={() => setRecordResult(r)}
                  className={`py-3 text-sm font-bold rounded-xl border-2 transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    recordResult === r ? colors[r] : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <i className={`bi ${icons[r]}`}></i>
                  {labels[r]}
                </button>
              );
            })}
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            {previewUrl ? (
              <div className="relative">
                <img src={previewUrl} alt="Preview" className="w-full h-28 object-cover rounded-lg" />
                <button
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <i className="bi bi-x text-sm"></i>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-xs text-slate-400 flex items-center justify-center gap-1.5 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
              >
                <i className="bi bi-camera text-base"></i>
                {t('btn_take_photo')}
              </button>
            )}
          </div>
          <textarea
            value={recordNote}
            onChange={(e) => setRecordNote(e.target.value)}
            placeholder={t('note')}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white h-12 resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
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

      {/* Unified sample points list */}
      {samplePoints.length > 0 && (
        <div className="space-y-1.5">
          {samplePoints.map((point, i) => {
            const matched = getMatchedCheckpoint(point);
            const dist = currentPosition
              ? haversineM(currentPosition.lat, currentPosition.lng, point.lat, point.lng)
              : null;
            const isChecked = matched !== null;

            return (
              <div
                key={`sample-${i}`}
                className={`flex items-center gap-2 rounded-xl border transition-colors ${
                  isChecked
                    ? matched.result === 'CONFIRMED'
                      ? 'bg-emerald-50 border-emerald-200'
                      : matched.result === 'NOT_FOUND'
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-slate-50 border-slate-200'
                    : 'bg-white border-slate-200 hover:border-emerald-300'
                }`}
              >
                <button
                  onClick={() => isActive && (isChecked ? openRecording(i, matched) : openRecording(i))}
                  disabled={!isActive || recordingIndex !== null}
                  className="flex-1 flex items-center gap-2.5 p-2.5 text-left disabled:opacity-70"
                >
                  {/* Number badge */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isChecked
                      ? matched.result === 'CONFIRMED'
                        ? 'bg-emerald-500 text-white'
                        : matched.result === 'NOT_FOUND'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-400 text-white'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isChecked
                      ? <i className={`bi ${matched.result === 'CONFIRMED' ? 'bi-check-lg' : matched.result === 'NOT_FOUND' ? 'bi-x-lg' : 'bi-dash-lg'} text-xs`}></i>
                      : <span className="text-[10px] font-black">{i + 1}</span>
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {isChecked ? (
                      <>
                        <p className="text-[11px] font-bold truncate">
                          {matched.result === 'CONFIRMED' ? t('checkpoint_confirmed') : matched.result === 'NOT_FOUND' ? t('checkpoint_not_found') : t('checkpoint_unable')}
                        </p>
                        {matched.note && <p className="text-[10px] text-slate-500 truncate">{matched.note}</p>}
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-500">#{i + 1}</p>
                        {dist !== null && (
                          <p className="text-[10px] text-slate-400">{formatDistance(dist)}</p>
                        )}
                      </>
                    )}
                  </div>
                  {/* Photo thumbnail or chevron */}
                  {isChecked && matched.photoUrl ? (
                    <img
                      src={matched.photoUrl}
                      alt=""
                      className="w-9 h-9 object-cover rounded-lg shrink-0 cursor-pointer hover:opacity-80"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEnlargedPhoto(matched.photoUrl); }}
                    />
                  ) : !isChecked ? (
                    <i className="bi bi-chevron-right text-slate-300 text-xs"></i>
                  ) : null}
                </button>
                {/* Delete button */}
                {isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isChecked && matched) {
                        handleDeleteCheckpoint(matched.id);
                      } else {
                        onSamplePointsChange(samplePoints.filter((_, j) => j !== i));
                      }
                    }}
                    disabled={deleting === matched?.id}
                    className="px-2 py-2.5 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    {deleting === matched?.id
                      ? <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                      : <i className="bi bi-trash3 text-xs"></i>
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {samplePoints.length === 0 && checkpoints.length === 0 && (
        <div className="py-6 text-center">
          <i className="bi bi-check-circle text-2xl text-slate-200 block mb-2"></i>
          <p className="text-xs text-slate-400">{t('empty_checkpoints')}</p>
        </div>
      )}

      {/* Photo enlargement modal */}
      {enlargedPhoto && (
        <div
          className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setEnlargedPhoto(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img src={enlargedPhoto} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              onClick={() => setEnlargedPhoto(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
