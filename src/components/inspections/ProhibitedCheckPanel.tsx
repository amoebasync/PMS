'use client';

import React, { useState, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProhibitedProperty {
  id: number;
  lat: number;
  lng: number;
  address: string;
  buildingName: string | null;
  severity: string | null;
}

interface ProhibitedCheck {
  id: number;
  prohibitedPropertyId: number;
  result: 'COMPLIANT' | 'VIOLATION' | 'UNABLE' | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface Props {
  inspectionId: string;
  prohibitedProperties: ProhibitedProperty[];
  prohibitedChecks: ProhibitedCheck[];
  isActive: boolean;
  onUpdate: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const severityBadge = (severity: string | null) => {
  switch (severity) {
    case 'HIGH':
      return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">HIGH</span>;
    case 'MEDIUM':
      return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">MED</span>;
    case 'LOW':
      return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">LOW</span>;
    default:
      return null;
  }
};

const checkStatusCls = (result: string | null) => {
  switch (result) {
    case 'COMPLIANT': return 'border-emerald-200 bg-emerald-50';
    case 'VIOLATION': return 'border-red-300 bg-red-50';
    case 'UNABLE': return 'border-slate-200 bg-slate-50';
    default: return 'border-slate-200 bg-white';
  }
};

const checkStatusIcon = (result: string | null) => {
  switch (result) {
    case 'COMPLIANT': return <i className="bi bi-check-circle-fill text-emerald-500"></i>;
    case 'VIOLATION': return <i className="bi bi-exclamation-triangle-fill text-red-500"></i>;
    case 'UNABLE': return <i className="bi bi-dash-circle-fill text-slate-400"></i>;
    default: return <i className="bi bi-circle text-slate-300"></i>;
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProhibitedCheckPanel({ inspectionId, prohibitedProperties, prohibitedChecks, isActive, onUpdate }: Props) {
  const { t } = useTranslation('inspections');
  const { showToast } = useNotification();

  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [recordResult, setRecordResult] = useState<'COMPLIANT' | 'VIOLATION' | 'UNABLE'>('COMPLIANT');
  const [recordNote, setRecordNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Check map ---- */
  const checkMap = new Map<number, ProhibitedCheck>();
  prohibitedChecks.forEach((c) => checkMap.set(c.prohibitedPropertyId, c));

  const compliantCount = prohibitedChecks.filter((c) => c.result === 'COMPLIANT').length;
  const violationCount = prohibitedChecks.filter((c) => c.result === 'VIOLATION').length;
  const checkedCount = prohibitedChecks.filter((c) => c.result !== null).length;

  /* ---- Open recording (new or edit existing) ---- */
  const openRecording = (propId: number) => {
    const existing = checkMap.get(propId);
    setRecordingId(propId);
    // 既存チェックがある場合はその値をセット
    const resultMapping: Record<string, 'COMPLIANT' | 'VIOLATION' | 'UNABLE'> = {
      COMPLIANT: 'COMPLIANT',
      VIOLATION: 'VIOLATION',
      UNABLE: 'UNABLE',
      UNABLE_TO_CHECK: 'UNABLE',
    };
    setRecordResult(existing?.result ? (resultMapping[existing.result] || 'COMPLIANT') : 'COMPLIANT');
    setRecordNote(existing?.note || '');
    setSelectedFile(null);
    setPreviewUrl(existing?.photoUrl || null);
  };

  /* ---- Handle file ---- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  /* ---- Submit ---- */
  const handleSubmit = async () => {
    if (recordingId === null) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('prohibitedPropertyId', recordingId.toString());
      // API側のenum値にマッピング
      const resultMap: Record<string, string> = { COMPLIANT: 'COMPLIANT', VIOLATION: 'VIOLATION', UNABLE: 'UNABLE_TO_CHECK' };
      formData.append('result', resultMap[recordResult] || recordResult);
      if (recordNote) formData.append('note', recordNote);
      if (selectedFile) formData.append('photo', selectedFile);

      const res = await fetch(`/api/inspections/${inspectionId}/prohibited-checks`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error();

      showToast(t('success_prohibited_check'), 'success');
      setRecordingId(null);
      setSelectedFile(null);
      setPreviewUrl(null);
      onUpdate();
    } catch {
      showToast(t('error_generic'), 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500">{t('section_prohibited')}</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-600">{checkedCount}/{prohibitedProperties.length}</span>
          {violationCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              {violationCount} violation{violationCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Recording UI */}
      {recordingId !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">
              {prohibitedProperties.find((p) => p.id === recordingId)?.address || ''}
            </span>
            <button onClick={() => setRecordingId(null)} className="text-slate-400 hover:text-slate-600">
              <i className="bi bi-x-lg text-sm"></i>
            </button>
          </div>

          {/* Result selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['COMPLIANT', 'VIOLATION', 'UNABLE'] as const).map((r) => {
              const labels: Record<string, string> = {
                COMPLIANT: t('prohibited_compliant'),
                VIOLATION: t('prohibited_violation'),
                UNABLE: t('prohibited_unable'),
              };
              const colors: Record<string, string> = {
                COMPLIANT: 'bg-emerald-600 text-white border-emerald-600',
                VIOLATION: 'bg-red-500 text-white border-red-500',
                UNABLE: 'bg-slate-500 text-white border-slate-500',
              };
              return (
                <button
                  key={r}
                  onClick={() => setRecordResult(r)}
                  className={`py-2.5 text-[10px] font-bold rounded-lg border transition-all active:scale-95 leading-tight ${
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

          {/* Camera */}
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
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-xs text-slate-400 flex items-center justify-center gap-1.5 hover:border-amber-400 hover:text-amber-500 transition-colors"
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
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white h-16 resize-none"
          />

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
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

      {/* Property list */}
      {prohibitedProperties.length > 0 ? (
        <div className="space-y-2">
          {prohibitedProperties.map((pp) => {
            const check = checkMap.get(pp.id);
            const isViolation = check?.result === 'VIOLATION';

            return (
              <button
                key={pp.id}
                onClick={() => isActive && openRecording(pp.id)}
                disabled={!isActive || recordingId !== null}
                className={`w-full flex items-center gap-3 p-3 border rounded-xl transition-colors text-left ${checkStatusCls(check?.result || null)} ${
                  isActive ? 'hover:border-amber-300 cursor-pointer' : ''
                } ${isViolation ? 'ring-1 ring-red-300' : ''}`}
              >
                <div className="shrink-0 text-lg">
                  {checkStatusIcon(check?.result || null)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-700 truncate">{pp.address}</p>
                    {severityBadge(pp.severity)}
                  </div>
                  {pp.buildingName && (
                    <p className="text-[10px] text-slate-400 truncate">{pp.buildingName}</p>
                  )}
                  {check && (
                    <p className={`text-[10px] font-bold mt-0.5 ${
                      check.result === 'COMPLIANT' ? 'text-emerald-600' :
                      check.result === 'VIOLATION' ? 'text-red-600' : 'text-slate-500'
                    }`}>
                      {check.result === 'COMPLIANT' ? t('prohibited_compliant') :
                       check.result === 'VIOLATION' ? t('prohibited_violation') :
                       t('prohibited_unable')}
                    </p>
                  )}
                </div>
                {check?.photoUrl && (
                  <img src={check.photoUrl} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0" />
                )}
                {isActive && (
                  <i className={`bi ${check ? 'bi-pencil' : 'bi-chevron-right'} text-slate-300 shrink-0 text-xs`}></i>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center">
          <i className="bi bi-house-x text-3xl text-slate-200 block mb-2"></i>
          <p className="text-xs text-slate-400">{t('empty_prohibited')}</p>
        </div>
      )}
    </div>
  );
}
