'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Checkpoint {
  id: number;
  targetLat: number;
  targetLng: number;
  checkpointType: 'CHECKPOINT' | 'PROBLEM' | 'OUT_OF_AREA';
  result: 'CONFIRMED' | 'NOT_FOUND' | 'UNABLE' | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface Props {
  inspectionId: string;
  checkpoints: Checkpoint[];
  currentPosition: { lat: number; lng: number } | null;
  isActive: boolean;
  onUpdate: () => void;
  highlightedCheckpointId: number | null;
  onCheckpointSelect: (id: number | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CheckpointPanel({ inspectionId, checkpoints, currentPosition, isActive, onUpdate, highlightedCheckpointId, onCheckpointSelect }: Props) {
  const { t } = useTranslation('inspections');
  const { showToast } = useNotification();
  const [editingCheckpointId, setEditingCheckpointId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [recordNote, setRecordNote] = useState('');
  const [recordResult, setRecordResult] = useState<'CONFIRMED' | 'NOT_FOUND'>('CONFIRMED');
  const [submitting, setSubmitting] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ---- Auto-scroll for highlighted checkpoint ---- */
  useEffect(() => {
    if (highlightedCheckpointId && itemRefs.current.has(highlightedCheckpointId)) {
      itemRefs.current.get(highlightedCheckpointId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedCheckpointId]);

  /* ---- Add checkpoint (create immediately, then open edit form) ---- */
  const handleAddCheckpoint = async (type: 'CHECKPOINT' | 'PROBLEM' | 'OUT_OF_AREA', result: 'CONFIRMED' | 'NOT_FOUND') => {
    if (!currentPosition) {
      showToast('GPS位置を取得できません', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('targetLat', currentPosition.lat.toString());
      formData.append('targetLng', currentPosition.lng.toString());
      formData.append('actualLat', currentPosition.lat.toString());
      formData.append('actualLng', currentPosition.lng.toString());
      formData.append('checkpointType', type);
      formData.append('result', result);

      const res = await fetch(`/api/inspections/${inspectionId}/checkpoints`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      showToast(t('success_checkpoint'), 'success');
      onUpdate();
      // Open edit form for the new checkpoint to add photo/note
      setEditingCheckpointId(created.id);
      setRecordNote('');
      setRecordResult(result);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch {
      showToast(t('error_generic'), 'error');
    }
    setSubmitting(false);
  };

  /* ---- Open edit form for existing checkpoint ---- */
  const openEdit = (cp: Checkpoint) => {
    setEditingCheckpointId(cp.id);
    setRecordResult(cp.result === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFIRMED');
    setRecordNote(cp.note || '');
    setSelectedFile(null);
    setPreviewUrl(null);
    onCheckpointSelect(cp.id);
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

  /* ---- Submit update (PUT) ---- */
  const handleSubmitUpdate = async () => {
    if (!editingCheckpointId) return;
    const cp = checkpoints.find(c => c.id === editingCheckpointId);
    if (!cp) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('targetLat', cp.targetLat.toString());
      formData.append('targetLng', cp.targetLng.toString());
      formData.append('result', recordResult);
      if (currentPosition) {
        formData.append('actualLat', currentPosition.lat.toString());
        formData.append('actualLng', currentPosition.lng.toString());
      }
      if (recordNote) formData.append('note', recordNote);
      if (selectedFile) formData.append('photo', selectedFile);

      const res = await fetch(`/api/inspections/${inspectionId}/checkpoints?checkpointId=${editingCheckpointId}`, {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) throw new Error();

      showToast(t('success_checkpoint'), 'success');
      setEditingCheckpointId(null);
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
      if (res.ok) {
        if (editingCheckpointId === checkpointId) {
          setEditingCheckpointId(null);
        }
        onUpdate();
      }
    } catch { showToast(t('error_generic'), 'error'); }
    setDeleting(null);
  };

  /* ---- Stats ---- */
  const checkpointCount = checkpoints.filter(c => c.checkpointType === 'CHECKPOINT').length;
  const problemCount = checkpoints.filter(c => c.checkpointType === 'PROBLEM').length;
  const outOfAreaCount = checkpoints.filter(c => c.checkpointType === 'OUT_OF_AREA').length;

  /* ---- Editing checkpoint data ---- */
  const editingCp = editingCheckpointId ? checkpoints.find(c => c.id === editingCheckpointId) : null;

  /* ---- Type badge helper ---- */
  const typeBadge = (cp: Checkpoint) => {
    const type = cp.checkpointType;
    if (type === 'CHECKPOINT' && cp.result === 'CONFIRMED') {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><i className="bi bi-check-circle-fill"></i>{t('checkpoint_confirmed')}</span>;
    }
    if (type === 'CHECKPOINT' && cp.result === 'NOT_FOUND') {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700"><i className="bi bi-x-circle-fill"></i>{t('checkpoint_not_found')}</span>;
    }
    if (type === 'CHECKPOINT') {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{t('type_checkpoint')}</span>;
    }
    if (type === 'PROBLEM') {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700"><i className="bi bi-exclamation-triangle-fill"></i>{t('type_problem')}</span>;
    }
    if (type === 'OUT_OF_AREA') {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700"><i className="bi bi-geo-alt-fill"></i>{t('type_out_of_area')}</span>;
    }
    return null;
  };

  /* ---- Sorted checkpoints (newest first) ---- */
  const sortedCheckpoints = [...checkpoints].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div ref={panelRef} className="p-3 md:p-4 space-y-3">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500">{t('section_checkpoints')}</h3>
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className="text-emerald-600">{t('checkpoint_confirmed')}: {checkpointCount}</span>
          <span className="text-orange-600">{t('type_problem')}: {problemCount}</span>
          <span className="text-purple-600">{t('type_out_of_area')}: {outOfAreaCount}</span>
        </div>
      </div>

      {/* Action buttons (2x2 grid) */}
      {isActive && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAddCheckpoint('CHECKPOINT', 'CONFIRMED')}
            disabled={submitting}
            className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <i className="bi bi-check-circle-fill"></i>
            {t('add_checkpoint_confirmed')}
          </button>
          <button
            onClick={() => handleAddCheckpoint('CHECKPOINT', 'NOT_FOUND')}
            disabled={submitting}
            className="py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <i className="bi bi-x-circle-fill"></i>
            {t('add_checkpoint_not_found')}
          </button>
          <button
            onClick={() => handleAddCheckpoint('PROBLEM', 'NOT_FOUND')}
            disabled={submitting}
            className="py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <i className="bi bi-exclamation-triangle-fill"></i>
            {t('add_problem')}
          </button>
          <button
            onClick={() => handleAddCheckpoint('OUT_OF_AREA', 'CONFIRMED')}
            disabled={submitting}
            className="py-3 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <i className="bi bi-geo-alt-fill"></i>
            {t('add_out_of_area')}
          </button>
        </div>
      )}

      {/* Edit form (when a checkpoint is selected) */}
      {editingCp && (
        <div className="sticky top-0 z-10 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-700">
                <i className="bi bi-pencil-square mr-1"></i>
              </span>
              {typeBadge(editingCp)}
            </div>
            <button onClick={() => { setEditingCheckpointId(null); onCheckpointSelect(null); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-slate-400 hover:text-slate-600 shadow-sm">
              <i className="bi bi-x-lg text-sm"></i>
            </button>
          </div>

          {/* Result selector (only for CHECKPOINT type) */}
          {editingCp.checkpointType === 'CHECKPOINT' && (
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
          )}

          {/* Photo capture */}
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
            ) : editingCp.photoUrl ? (
              <div className="relative">
                <img src={editingCp.photoUrl} alt="" className="w-full h-28 object-cover rounded-lg cursor-pointer hover:opacity-80" onClick={() => setEnlargedPhoto(editingCp.photoUrl)} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 px-2 py-1 bg-black/50 text-white text-[10px] rounded-md"
                >
                  <i className="bi bi-camera mr-1"></i>{t('btn_take_photo')}
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

          {/* Note textarea */}
          <textarea
            value={recordNote}
            onChange={(e) => setRecordNote(e.target.value)}
            placeholder={
              editingCp.checkpointType === 'PROBLEM' ? t('problem_note_placeholder') :
              editingCp.checkpointType === 'OUT_OF_AREA' ? t('out_of_area_note_placeholder') :
              t('note')
            }
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white h-12 resize-none"
          />

          {/* Save button */}
          <button
            onClick={handleSubmitUpdate}
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

      {/* Checkpoint list (newest first) */}
      {sortedCheckpoints.length > 0 && (
        <div className="space-y-1.5">
          {sortedCheckpoints.map((cp) => {
            const isHighlighted = cp.id === highlightedCheckpointId;
            const isEditing = cp.id === editingCheckpointId;

            return (
              <div
                key={`cp-${cp.id}`}
                ref={(el) => { if (el) itemRefs.current.set(cp.id, el); else itemRefs.current.delete(cp.id); }}
                className={`flex items-center gap-2 rounded-xl border transition-colors ${
                  isHighlighted || isEditing
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                    : cp.checkpointType === 'CHECKPOINT' && cp.result === 'CONFIRMED'
                      ? 'bg-emerald-50 border-emerald-200'
                      : cp.checkpointType === 'CHECKPOINT' && cp.result === 'NOT_FOUND'
                        ? 'bg-rose-50 border-rose-200'
                        : cp.checkpointType === 'PROBLEM'
                          ? 'bg-orange-50 border-orange-200'
                          : cp.checkpointType === 'OUT_OF_AREA'
                            ? 'bg-purple-50 border-purple-200'
                            : 'bg-slate-50 border-slate-200'
                }`}
              >
                <button
                  onClick={() => {
                    if (isActive) openEdit(cp);
                    else onCheckpointSelect(cp.id);
                  }}
                  className="flex-1 flex items-center gap-2.5 p-2.5 text-left"
                >
                  {/* Icon badge */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    cp.checkpointType === 'CHECKPOINT' && cp.result === 'CONFIRMED'
                      ? 'bg-emerald-500 text-white'
                      : cp.checkpointType === 'CHECKPOINT' && cp.result === 'NOT_FOUND'
                        ? 'bg-rose-500 text-white'
                        : cp.checkpointType === 'PROBLEM'
                          ? 'bg-orange-500 text-white'
                          : cp.checkpointType === 'OUT_OF_AREA'
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-400 text-white'
                  }`}>
                    {cp.checkpointType === 'CHECKPOINT' && cp.result === 'CONFIRMED'
                      ? <i className="bi bi-check-lg text-xs"></i>
                      : cp.checkpointType === 'CHECKPOINT' && cp.result === 'NOT_FOUND'
                        ? <i className="bi bi-x-lg text-xs"></i>
                        : cp.checkpointType === 'PROBLEM'
                          ? <i className="bi bi-exclamation-triangle text-[10px]"></i>
                          : cp.checkpointType === 'OUT_OF_AREA'
                            ? <i className="bi bi-geo-alt text-[10px]"></i>
                            : <i className="bi bi-dash-lg text-xs"></i>
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {typeBadge(cp)}
                    </div>
                    {cp.note && <p className="text-[10px] text-slate-500 truncate mt-0.5">{cp.note}</p>}
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {new Date(cp.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
                    </p>
                  </div>
                  {/* Photo thumbnail */}
                  {cp.photoUrl && (
                    <img
                      src={cp.photoUrl}
                      alt=""
                      className="w-9 h-9 object-cover rounded-lg shrink-0 cursor-pointer hover:opacity-80"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEnlargedPhoto(cp.photoUrl); }}
                    />
                  )}
                </button>
                {/* Delete button */}
                {isActive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCheckpoint(cp.id);
                    }}
                    disabled={deleting === cp.id}
                    className="px-2 py-2.5 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    {deleting === cp.id
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
      {checkpoints.length === 0 && (
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
