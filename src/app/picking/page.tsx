'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type VerificationResult = 'MATCH' | 'MISMATCH' | 'UNCERTAIN';
type CheckerResult = 'APPROVED' | 'REJECTED';
type PickingStatus = 'PENDING' | 'AI_CHECKED' | 'VERIFIED' | 'REJECTED';

interface DistributionItem {
  id: number;
  slotIndex: number;
  flyerName: string | null;
  flyerCode: string | null;
  plannedCount: number | null;
  remarks: string | null;
  customer: {
    id: number;
    name: string;
  } | null;
  flyer: {
    id: number;
    name: string;
    flyerCode: string | null;
    remarks: string | null;
  } | null;
}

interface PickingVerification {
  id: number;
  photoUrl: string | null;
  pickerId: number;
  pickedAt: string;
  aiResult: VerificationResult | null;
  aiReason: string | null;
  aiCheckedAt: string | null;
  checkerId: number | null;
  checkerResult: CheckerResult | null;
  checkerNote: string | null;
  checkedAt: string | null;
  status: PickingStatus;
  picker: {
    id: number;
    lastNameJa: string;
    firstNameJa: string;
  };
  checker: {
    id: number;
    lastNameJa: string;
    firstNameJa: string;
  } | null;
}

interface Schedule {
  id: number;
  date: string;
  distributor: {
    id: number;
    name: string;
    staffId: string;
  } | null;
  branch: {
    id: number;
    name: string;
  } | null;
  area: {
    chome_name: string;
    town_name: string;
    prefecture: { name: string };
    city: { name: string };
  } | null;
  items: DistributionItem[];
  pickingVerification: PickingVerification | null;
}

interface SimilarFlyerWarning {
  customerId: number;
  customerName: string;
  flyerCodes: string[];
  distributorNames?: string[];
}

interface PickingData {
  date: string;
  schedules: Schedule[];
  similarFlyerWarnings: SimilarFlyerWarning[];
  stats: {
    totalSchedules: number;
    pending: number;
    aiChecked: number;
    verified: number;
    rejected: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PickingPage() {
  const { t } = useTranslation('picking');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<PickingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [expandedDistributors, setExpandedDistributors] = useState<Set<number>>(new Set());
  const [expandedAiReasons, setExpandedAiReasons] = useState<Set<number>>(new Set());
  const [uploadingScheduleId, setUploadingScheduleId] = useState<number | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [rejectNoteMap, setRejectNoteMap] = useState<Record<number, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<number | null>(null);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Fetch current user ---- */
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.id) setCurrentUserId(d.id);
      })
      .catch(() => {});
  }, []);

  /* ---- Fetch picking data ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/picking?date=${date}`);
      if (res.ok) {
        const json: PickingData = await res.json();
        setData(json);
        const ids = new Set<number>();
        json.schedules.forEach((s) => {
          ids.add(s.distributor?.id ?? 0);
        });
        setExpandedDistributors(ids);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useRefreshOnFocus(fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Handlers ---- */

  const toggleDistributor = (id: number) => {
    setExpandedDistributors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAiReason = (id: number) => {
    setExpandedAiReasons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUploadClick = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedScheduleId) return;

    setUploadingScheduleId(selectedScheduleId);
    try {
      const formData = new FormData();
      formData.append('scheduleId', selectedScheduleId.toString());
      formData.append('photo', file);
      if (data?.similarFlyerWarnings && data.similarFlyerWarnings.length > 0) {
        formData.append('similarWarnings', JSON.stringify(data.similarFlyerWarnings));
      }

      const res = await fetch('/api/picking/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchData();
      } else {
        const errBody = await res.json();
        alert(errBody.error || t('upload_error'));
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert(t('upload_error'));
    } finally {
      setUploadingScheduleId(null);
      setSelectedScheduleId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApprove = async (verificationId: number) => {
    setCheckingId(verificationId);
    try {
      const res = await fetch(`/api/picking/${verificationId}/check`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'APPROVED' }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const errBody = await res.json();
        alert(errBody.error || t('check_error'));
      }
    } catch (err) {
      console.error('Check error:', err);
      alert(t('check_error'));
    } finally {
      setCheckingId(null);
    }
  };

  const handleReject = async (verificationId: number) => {
    const note = rejectNoteMap[verificationId] || '';
    if (!confirm(t('confirm_reject'))) return;

    setCheckingId(verificationId);
    try {
      const res = await fetch(`/api/picking/${verificationId}/check`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: 'REJECTED', note: note || undefined }),
      });
      if (res.ok) {
        setShowRejectInput(null);
        setRejectNoteMap((prev) => {
          const copy = { ...prev };
          delete copy[verificationId];
          return copy;
        });
        await fetchData();
      } else {
        const errBody = await res.json();
        alert(errBody.error || t('check_error'));
      }
    } catch (err) {
      console.error('Check error:', err);
      alert(t('check_error'));
    } finally {
      setCheckingId(null);
    }
  };

  const handleRetake = async (verificationId: number) => {
    if (!confirm(t('confirm_retake'))) return;

    try {
      const res = await fetch(`/api/picking/${verificationId}/retake`, {
        method: 'PUT',
      });
      if (res.ok) {
        await fetchData();
      } else {
        const errBody = await res.json();
        alert(errBody.error || t('retake_error'));
      }
    } catch (err) {
      console.error('Retake error:', err);
      alert(t('retake_error'));
    }
  };

  /* ---- Area display (prefecture + city + chome_name) ---- */
  const formatArea = (area: Schedule['area']) => {
    if (!area) return '';
    return `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`;
  };

  /* ---- Status badge ---- */
  const getStatusBadge = (verification: PickingVerification | null) => {
    if (!verification) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          <i className="bi bi-box-seam text-[10px]" />
          {t('status.pending')}
        </span>
      );
    }

    switch (verification.status) {
      case 'AI_CHECKED': {
        const colorMap: Record<string, string> = {
          MATCH: 'bg-green-100 text-green-700',
          MISMATCH: 'bg-red-100 text-red-700',
          UNCERTAIN: 'bg-yellow-100 text-yellow-700',
        };
        const iconMap: Record<string, string> = {
          MATCH: 'bi-check-circle-fill',
          MISMATCH: 'bi-x-circle-fill',
          UNCERTAIN: 'bi-exclamation-triangle-fill',
        };
        const labelMap: Record<string, string> = {
          MATCH: `AI ${t('ai_result.match')}`,
          MISMATCH: `AI ${t('ai_result.mismatch')}`,
          UNCERTAIN: `AI ${t('ai_result.uncertain')}`,
        };
        const result = verification.aiResult || 'UNCERTAIN';
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${colorMap[result]}`}>
            <i className={`bi ${iconMap[result]} text-[10px]`} />
            {labelMap[result]}
          </span>
        );
      }
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <i className="bi bi-check-circle-fill text-[10px]" />
            {t('status.verified')}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <i className="bi bi-x-circle-fill text-[10px]" />
            {t('status.rejected')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
            <i className="bi bi-box-seam text-[10px]" />
            {t('status.pending')}
          </span>
        );
    }
  };

  /* ---- Group schedules by distributor ---- */
  const groupedSchedules = data?.schedules.reduce(
    (acc, schedule) => {
      const key = schedule.distributor?.id ?? 0;
      if (!acc[key]) {
        acc[key] = { distributor: schedule.distributor, schedules: [] };
      }
      acc[key].schedules.push(schedule);
      return acc;
    },
    {} as Record<number, { distributor: Schedule['distributor']; schedules: Schedule[] }>,
  ) || {};

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <i className="bi bi-calendar3 text-gray-400" />
            <label className="text-sm text-gray-500 hidden sm:inline">{t('date_label')}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>
        </div>
      </div>

      {/* ---- Stats summary ---- */}
      {data && (
        <div className="grid grid-cols-5 gap-2 md:gap-4">
          <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
            <div className="text-[10px] md:text-sm text-gray-500 truncate">{t('stats.total')}</div>
            <div className="text-lg md:text-2xl font-bold text-gray-900">{data.stats.totalSchedules}</div>
          </div>
          <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
            <div className="text-[10px] md:text-sm text-gray-500 truncate">{t('stats.pending')}</div>
            <div className="text-lg md:text-2xl font-bold text-gray-500">{data.stats.pending}</div>
          </div>
          <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
            <div className="text-[10px] md:text-sm text-gray-500 truncate">{t('stats.ai_checked')}</div>
            <div className="text-lg md:text-2xl font-bold text-yellow-600">{data.stats.aiChecked}</div>
          </div>
          <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
            <div className="text-[10px] md:text-sm text-gray-500 truncate">{t('stats.verified')}</div>
            <div className="text-lg md:text-2xl font-bold text-green-600">{data.stats.verified}</div>
          </div>
          <div className="bg-white rounded-lg border p-2.5 md:p-4 text-center">
            <div className="text-[10px] md:text-sm text-gray-500 truncate">{t('stats.rejected')}</div>
            <div className="text-lg md:text-2xl font-bold text-red-600">{data.stats.rejected}</div>
          </div>
        </div>
      )}

      {/* ---- Similar flyer warnings ---- */}
      {data?.similarFlyerWarnings && data.similarFlyerWarnings.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-start gap-3">
            <i className="bi bi-exclamation-triangle-fill text-yellow-600 text-lg flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-yellow-800">{t('similar_warning_title')}</h3>
              {data.similarFlyerWarnings.map((warning) => (
                <div key={warning.customerId} className="text-sm text-yellow-700">
                  <p className="font-medium">
                    {t('similar_warning_message', {
                      customerName: warning.customerName,
                      count: String(warning.flyerCodes.length),
                    })}
                  </p>
                  <div className="mt-1 space-y-0.5 ml-2">
                    {warning.flyerCodes.map((code, idx) => (
                      <div key={code} className="text-xs">
                        <span className="font-mono bg-yellow-100 px-1.5 py-0.5 rounded">{code}</span>
                        {warning.distributorNames?.[idx] && (
                          <span className="ml-2 text-yellow-600">
                            {t('assigned_to', { distributorName: warning.distributorNames[idx] })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- Schedule list grouped by distributor ---- */}
      <div className="space-y-3 md:space-y-4">
        {Object.entries(groupedSchedules).map(([distributorId, group]) => (
          <div key={distributorId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {/* Distributor header */}
            <button
              onClick={() => toggleDistributor(Number(distributorId))}
              className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <i className="bi bi-person-fill text-gray-400 text-lg shrink-0" />
                <span className="font-semibold text-gray-900 text-sm md:text-base truncate">
                  {group.distributor?.name || t('unassigned')}
                </span>
                {group.distributor?.staffId && (
                  <span className="text-xs text-gray-400 font-mono shrink-0">({group.distributor.staffId})</span>
                )}
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                  {group.schedules.length}{t('schedules_count')}
                </span>
              </div>
              <i className={`bi ${expandedDistributors.has(Number(distributorId)) ? 'bi-chevron-up' : 'bi-chevron-down'} text-gray-400 shrink-0 ml-2`} />
            </button>

            {/* Schedules */}
            {expandedDistributors.has(Number(distributorId)) && (
              <div className="border-t divide-y">
                {group.schedules.map((schedule) => {
                  const v = schedule.pickingVerification;
                  const isUploading = uploadingScheduleId === schedule.id;
                  const isChecking = v ? checkingId === v.id : false;
                  const userCanCheck = v?.status === 'AI_CHECKED' && currentUserId !== null && v.pickerId !== currentUserId;
                  const isSamePerson = v?.status === 'AI_CHECKED' && currentUserId !== null && v.pickerId === currentUserId;

                  return (
                    <div key={schedule.id} className="p-3 md:p-4">
                      {/* Schedule header row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs font-mono text-gray-400">#{schedule.id}</span>
                        {schedule.area && (
                          <span className="text-sm text-gray-700">
                            <i className="bi bi-geo-alt text-gray-400 mr-1" />
                            {formatArea(schedule.area)}
                          </span>
                        )}
                        {getStatusBadge(v)}
                      </div>

                      {/* Flyer list */}
                      <div className="space-y-1.5 mb-3">
                        {schedule.items.map((item) => {
                          const hasRemarks = !!(item.flyer?.remarks || item.remarks);
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start gap-2 text-sm rounded-lg p-2.5 ${
                                hasRemarks ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                              }`}
                            >
                              <span className="font-medium text-gray-400 w-5 text-right shrink-0">
                                {item.slotIndex}.
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">
                                  {item.flyer?.name || item.flyerName || '-'}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                                  <span>
                                    <span className="text-gray-400">{t('flyer_code')}:</span>{' '}
                                    <span className="font-mono">{item.flyer?.flyerCode || item.flyerCode || '-'}</span>
                                  </span>
                                  <span>
                                    <span className="text-gray-400">{t('customer')}:</span>{' '}
                                    {item.customer?.name || '-'}
                                  </span>
                                  <span>
                                    <span className="text-gray-400">{t('count')}:</span>{' '}
                                    {item.plannedCount?.toLocaleString() || '-'}{t('sheets')}
                                  </span>
                                </div>
                                {hasRemarks && (
                                  <div className="flex items-start gap-1.5 mt-1.5 text-xs text-orange-700">
                                    <i className="bi bi-sticky-fill text-orange-400 mt-0.5 shrink-0" />
                                    <span>{item.flyer?.remarks || item.remarks}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Picker / Checker info */}
                      {v && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                          <span>
                            <i className="bi bi-person-badge text-gray-400 mr-1" />
                            {t('picker_label')}: {v.picker.lastNameJa} {v.picker.firstNameJa}
                          </span>
                          {v.checker && (
                            <span>
                              <i className="bi bi-person-check text-gray-400 mr-1" />
                              {t('checker_label')}: {v.checker.lastNameJa} {v.checker.firstNameJa}
                            </span>
                          )}
                        </div>
                      )}

                      {/* AI reason (collapsible) */}
                      {v?.aiReason && (
                        <div className="mb-3">
                          <button
                            onClick={() => toggleAiReason(v.id)}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <i className={`bi ${expandedAiReasons.has(v.id) ? 'bi-chevron-up' : 'bi-chevron-down'} text-[10px]`} />
                            <i className="bi bi-robot text-gray-400" />
                            {t('ai_reason_label')}
                          </button>
                          {expandedAiReasons.has(v.id) && (
                            <div
                              className={`mt-1.5 text-sm p-3 rounded-lg ${
                                v.aiResult === 'MATCH'
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : v.aiResult === 'MISMATCH'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              }`}
                            >
                              {v.aiReason}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Checker note */}
                      {v?.checkerNote && (
                        <div className="text-sm p-3 bg-gray-50 rounded-lg text-gray-700 mb-3 border">
                          <i className="bi bi-chat-left-text text-gray-400 mr-1.5" />
                          <strong>{t('checker_note')}:</strong> {v.checkerNote}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        {/* Photo preview button */}
                        {v?.photoUrl && (
                          <button
                            onClick={() => setImageModalUrl(v.photoUrl)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <i className="bi bi-image text-gray-500" />
                            {t('photo_preview')}
                          </button>
                        )}

                        {/* Take photo / retake on REJECTED */}
                        {(!v || v.status === 'REJECTED') && (
                          <button
                            onClick={() => handleUploadClick(schedule.id)}
                            disabled={isUploading}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {isUploading ? (
                              <i className="bi bi-arrow-repeat animate-spin" />
                            ) : (
                              <i className="bi bi-camera-fill" />
                            )}
                            {isUploading
                              ? t('uploading')
                              : v?.status === 'REJECTED'
                              ? t('retake_photo')
                              : t('take_photo')}
                          </button>
                        )}

                        {/* Retake button (for AI_CHECKED status) */}
                        {v && v.status === 'AI_CHECKED' && (
                          <button
                            onClick={() => handleRetake(v.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <i className="bi bi-arrow-counterclockwise" />
                            {t('retake_photo')}
                          </button>
                        )}

                        {/* Human check buttons -- only if different user from picker */}
                        {userCanCheck && (
                          <>
                            <button
                              onClick={() => handleApprove(v!.id)}
                              disabled={isChecking}
                              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {isChecking ? (
                                <i className="bi bi-arrow-repeat animate-spin" />
                              ) : (
                                <i className="bi bi-check-lg" />
                              )}
                              {t('approve')}
                            </button>
                            <button
                              onClick={() => {
                                if (showRejectInput === v!.id) {
                                  handleReject(v!.id);
                                } else {
                                  setShowRejectInput(v!.id);
                                }
                              }}
                              disabled={isChecking}
                              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              <i className="bi bi-x-lg" />
                              {t('reject')}
                            </button>
                          </>
                        )}

                        {/* Same person warning */}
                        {isSamePerson && (
                          <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                            <i className="bi bi-info-circle" />
                            {t('same_person_warning')}
                          </span>
                        )}

                        {/* Completed indicator */}
                        {v?.status === 'VERIFIED' && (
                          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium px-3 py-2">
                            <i className="bi bi-check-circle-fill" />
                            {t('completed')}
                          </span>
                        )}
                      </div>

                      {/* Reject note input */}
                      {showRejectInput === v?.id && v && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={rejectNoteMap[v.id] || ''}
                            onChange={(e) =>
                              setRejectNoteMap((prev) => ({ ...prev, [v.id]: e.target.value }))
                            }
                            placeholder={t('reject_note_placeholder')}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleReject(v.id)}
                            disabled={isChecking}
                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shrink-0"
                          >
                            {t('reject')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* No data */}
        {data && data.schedules.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <i className="bi bi-inbox text-4xl mb-3 block" />
            <p>{t('no_schedules')}</p>
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <div className="text-center py-16 text-gray-400">
            <i className="bi bi-arrow-repeat animate-spin text-3xl mb-3 block" />
          </div>
        )}
      </div>

      {/* ---- Hidden file input ---- */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ---- Image modal ---- */}
      {imageModalUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4"
          onClick={() => setImageModalUrl(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImageModalUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <i className="bi bi-x-lg text-2xl" />
            </button>
            <img
              src={imageModalUrl}
              alt={t('photo_preview')}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
