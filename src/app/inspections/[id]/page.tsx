'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';
import InspectionMap from '@/components/inspections/InspectionMap';
import CheckpointPanel from '@/components/inspections/CheckpointPanel';
import ProhibitedCheckPanel from '@/components/inspections/ProhibitedCheckPanel';
import GuidancePanel from '@/components/inspections/GuidancePanel';
import InspectionSummary from '@/components/inspections/InspectionSummary';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface InspectionDetail {
  id: number;
  date: string;
  status: InspectionStatus;
  category: string;
  confirmationRate: number | null;
  complianceRate: number | null;
  note: string | null;
  followUpRequired: boolean;
  distributor: {
    id: number;
    name: string;
    staffId: string;
  } | null;
  distributionSpeed: string | null;
  stickerCompliance: string | null;
  prohibitedCompliance: string | null;
  mapComprehension: string | null;
  workAttitude: string | null;
  multipleInsertion: string | null;
  fraudTrace: string | null;
  schedule: {
    id: number;
    status: string;
    checkGps: boolean;
    checkGpsResult: string | null;
    checkGpsComment: string | null;
    distributor: {
      id: number;
      name: string;
      staffId: string;
    } | null;
    area: {
      chome_name: string;
      town_name: string;
      prefecture: { name: string };
      city: { name: string };
    } | null;
    items: {
      id: number;
      slotIndex: number;
      flyerName: string | null;
      plannedCount: number | null;
      actualCount: number | null;
      customer: { id: number; name: string } | null;
      flyer: { id: number; name: string; flyerCode: string | null } | null;
    }[];
  } | null;
  inspector: {
    id: number;
    lastNameJa: string;
    firstNameJa: string;
  } | null;
  checkpoints: Checkpoint[];
  prohibitedChecks: ProhibitedCheck[];
}

interface Checkpoint {
  id: number;
  targetLat: number;
  targetLng: number;
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

interface MapData {
  areaBoundary: string | null;
  distributorGpsPoints: { lat: number; lng: number; timestamp: string }[];
  prohibitedProperties: {
    id: number;
    lat: number;
    lng: number;
    address: string;
    buildingName: string | null;
    severity: string | null;
  }[];
  inspectorGpsPoints: { lat: number; lng: number; timestamp: string }[];
  checkpoints: Checkpoint[];
  prohibitedChecks: (ProhibitedCheck & { lat: number; lng: number })[];
}

type TabKey = 'checkpoints' | 'prohibited' | 'guidance' | 'summary';

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

const statusBadge = (status: InspectionStatus, t: (k: string) => string) => {
  const map: Record<InspectionStatus, { cls: string; key: string }> = {
    PENDING: { cls: 'bg-slate-100 text-slate-600', key: 'status_pending' },
    IN_PROGRESS: { cls: 'bg-emerald-100 text-emerald-700', key: 'status_in_progress' },
    COMPLETED: { cls: 'bg-blue-100 text-blue-700', key: 'status_completed' },
    CANCELLED: { cls: 'bg-red-100 text-red-700', key: 'status_cancelled' },
  };
  const { cls, key } = map[status] || map.PENDING;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${cls}`}>
      {t(key)}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation('inspections');
  const { showToast } = useNotification();

  const inspectionId = params.id as string;

  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('checkpoints');
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // GPS tracking refs
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [inspectorPosition, setInspectorPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [samplePoints, setSamplePoints] = useState<{ lat: number; lng: number; index: number }[]>([]);
  const sampleSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Request geolocation permission on page load
  useEffect(() => {
    if (!navigator.geolocation) return;
    // Trigger permission prompt by making a one-time request
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInspectorPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.warn('Geolocation permission denied or unavailable:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // サンプルポイントが変更されたらDBに自動保存（デバウンス1秒）
  useEffect(() => {
    if (!inspection || inspection.status === 'COMPLETED') return;
    if (sampleSaveRef.current) clearTimeout(sampleSaveRef.current);
    sampleSaveRef.current = setTimeout(() => {
      const json = samplePoints.length > 0 ? JSON.stringify(samplePoints) : null;
      fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samplePointsJson: json }),
      }).catch(() => {});
    }, 1000);
    return () => { if (sampleSaveRef.current) clearTimeout(sampleSaveRef.current); };
  }, [samplePoints, inspectionId, inspection]);

  /* ---- Fetch inspection detail ---- */
  const fetchInspection = useCallback(async () => {
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInspection(data);
      // DBに保存されたサンプルポイントを復元（まだstateが空の場合のみ）
      if (data.samplePointsJson && samplePoints.length === 0) {
        try {
          const saved = JSON.parse(data.samplePointsJson);
          if (Array.isArray(saved) && saved.length > 0) setSamplePoints(saved);
        } catch { /* ignore parse error */ }
      }
    } catch {
      // エラーハンドリングは useEffect 内で行う（無限ループ防止）
    }
  }, [inspectionId]);

  /* ---- Fetch map data ---- */
  const fetchMapData = useCallback(async () => {
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/map-data`);
      if (!res.ok) throw new Error();
      const raw = await res.json();
      // APIレスポンスのフィールド名をフロントの期待する形式に変換
      setMapData({
        areaBoundary: raw.areaGeojson || null,
        distributorGpsPoints: (raw.distributorTrajectory || []).map((p: any) => ({
          lat: p.latitude, lng: p.longitude, timestamp: p.timestamp,
        })),
        inspectorGpsPoints: (raw.inspectorTrajectory || []).map((p: any) => ({
          lat: p.latitude, lng: p.longitude, timestamp: p.timestamp,
        })),
        prohibitedProperties: (raw.prohibitedProperties || []).map((p: any) => ({
          id: p.id, lat: p.latitude, lng: p.longitude,
          address: p.address, buildingName: p.buildingName, severity: null,
        })),
        checkpoints: raw.checkpoints || [],
        prohibitedChecks: (raw.prohibitedChecks || []).map((pc: any) => ({
          ...pc,
          lat: pc.prohibitedProperty?.latitude || pc.latitude || 0,
          lng: pc.prohibitedProperty?.longitude || pc.longitude || 0,
        })),
      });
    } catch {
      /* map data is optional */
    }
  }, [inspectionId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchInspection(), fetchMapData()]);
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [fetchInspection, fetchMapData]);

  /* ---- GPS tracking when IN_PROGRESS ---- */
  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) return;

    // Watch position for real-time display
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        lastPositionRef.current = { lat: latitude, lng: longitude };
        setInspectorPosition({ lat: latitude, lng: longitude });
      },
      () => { /* ignore errors */ },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    watchIdRef.current = wid;

    // Send GPS every 10 seconds
    const interval = setInterval(async () => {
      const pos = lastPositionRef.current;
      if (!pos) return;
      try {
        await fetch(`/api/inspections/${inspectionId}/gps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
        });
      } catch { /* ignore */ }
    }, 10000);
    gpsIntervalRef.current = interval;

    setGpsActive(true);
  }, [inspectionId]);

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
    setGpsActive(false);
  }, []);

  // Auto-start GPS if status is IN_PROGRESS
  useEffect(() => {
    if (inspection?.status === 'IN_PROGRESS') {
      startGpsTracking();
    }
    return () => stopGpsTracking();
  }, [inspection?.status, startGpsTracking, stopGpsTracking]);

  /* ---- Action handlers ---- */
  const handleStart = async () => {
    setActionLoading(true);
    try {
      // 現在位置を取得してstartリクエストに含める
      let body: Record<string, any> = {};
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        body = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch { /* GPS取得失敗でもstartは可能 */ }

      const res = await fetch(`/api/inspections/${inspectionId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'start failed');
      }
      showToast(t('success_started'), 'success');
      await fetchInspection();
      startGpsTracking();
    } catch (e: any) {
      showToast(e.message || t('error_generic'), 'error');
    }
    setActionLoading(false);
  };

  const handleFinish = async () => {
    if (!window.confirm(t('confirm_finish'))) return;
    setActionLoading(true);
    try {
      stopGpsTracking();
      const res = await fetch(`/api/inspections/${inspectionId}/finish`, { method: 'POST' });
      if (!res.ok) throw new Error();
      showToast(t('success_finished'), 'success');
      await fetchInspection();
    } catch {
      showToast(t('error_generic'), 'error');
    }
    setActionLoading(false);
  };

  /* ---- Tab definitions ---- */
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'checkpoints', label: t('section_checkpoints'), icon: 'bi-check-circle' },
    { key: 'prohibited', label: t('section_prohibited'), icon: 'bi-house-x' },
    { key: 'guidance', label: t('section_guidance'), icon: 'bi-person-workspace' },
    { key: 'summary', label: t('section_summary'), icon: 'bi-bar-chart' },
  ];

  /* ---- Area display name ---- */
  const areaName = inspection?.schedule?.area
    ? `${inspection.schedule.area.prefecture.name}${inspection.schedule.area.city.name}${inspection.schedule.area.chome_name || inspection.schedule.area.town_name}`
    : '';

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-[200]">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-[200] gap-4">
        <p className="text-sm text-slate-500">{t('error_generic')}</p>
        <button onClick={() => router.back()} className="text-emerald-600 text-sm font-bold">{t('btn_back')}</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 z-[200]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-2 md:px-4 py-1.5 md:py-3 flex items-center gap-1.5 md:gap-3 shrink-0">
        <button
          onClick={() => router.push('/inspections')}
          className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors shrink-0"
        >
          <i className="bi bi-arrow-left text-base md:text-lg text-slate-600"></i>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs md:text-sm font-bold text-slate-800 truncate">
              {inspection.distributor?.name || inspection.schedule?.distributor?.name || '--'}
            </span>
            {statusBadge(inspection.status, t)}
          </div>
          <p className="text-[10px] md:text-[11px] text-slate-400 truncate">{areaName}</p>
        </div>
        {/* GPS indicator */}
        {gpsActive && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[9px] md:text-[10px] font-bold text-emerald-700 whitespace-nowrap">{t('gps_tracking_active')}</span>
          </div>
        )}
      </div>

      {/* ── Schedule info bar (GPS result + flyers) ── */}
      {inspection.schedule && (
        <div className="bg-slate-50 border-b border-slate-200 px-2 md:px-4 py-1 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* GPS check result */}
            {inspection.schedule.checkGpsResult ? (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0 text-[10px] font-bold ${
                inspection.schedule.checkGpsResult === 'OK'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}>
                <i className={`bi ${inspection.schedule.checkGpsResult === 'OK' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                GPS {inspection.schedule.checkGpsResult}
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold shrink-0">
                <i className="bi bi-geo-alt"></i>GPS --
              </div>
            )}
            {inspection.schedule.checkGpsResult === 'NG' && inspection.schedule.checkGpsComment && (
              <span className="text-[10px] text-rose-600 truncate max-w-[120px] md:max-w-[200px]" title={inspection.schedule.checkGpsComment}>
                {inspection.schedule.checkGpsComment}
              </span>
            )}
            {/* Flyer items — compact horizontal scroll */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
              {(inspection.schedule.items || []).filter(i => i.flyerName).map((item, idx) => (
                <div key={item.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] md:text-[10px] whitespace-nowrap shrink-0">
                  <span className="w-3.5 h-3.5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold shrink-0">{idx + 1}</span>
                  <span className="text-slate-600 truncate max-w-[80px] md:max-w-[120px]" title={item.flyerName || ''}>{item.flyerName}</span>
                  <span className="text-slate-400 tabular-nums">
                    {item.actualCount != null ? item.actualCount.toLocaleString() : '-'}/{item.plannedCount?.toLocaleString() || '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content: Map + Panel ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* ── Map area ── */}
      <div className="flex-1 relative">
        <InspectionMap
          mapData={mapData}
          checkpoints={inspection.checkpoints}
          prohibitedChecks={inspection.prohibitedChecks}
          inspectorPosition={inspectorPosition}
          inspectorGpsPoints={mapData?.inspectorGpsPoints || []}
          samplePoints={samplePoints}
          onSamplePointsChange={inspection.status !== 'COMPLETED' ? setSamplePoints : undefined}
        />

        {/* Action button overlay */}
        {inspection.status === 'PENDING' && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="bi bi-play-fill text-xl"></i>
              )}
              {t('btn_start')}
            </button>
          </div>
        )}

        {inspection.status === 'IN_PROGRESS' && !sheetExpanded && (
          <div className="absolute bottom-16 left-4 right-4 z-10">
            <button
              onClick={handleFinish}
              disabled={actionLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="bi bi-stop-fill text-xl"></i>
              )}
              {t('btn_finish')}
            </button>
          </div>
        )}
      </div>

      {/* ── Side panel (desktop) / Bottom sheet (mobile) ── */}
      {(inspection.status === 'IN_PROGRESS' || inspection.status === 'COMPLETED') && (
        <div
          className={`bg-white border-t md:border-t-0 md:border-l border-slate-200 rounded-t-2xl md:rounded-none shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:shadow-none transition-all duration-300 shrink-0 flex flex-col md:w-[400px] md:h-full ${
            sheetExpanded ? 'max-h-[40vh] md:max-h-none' : 'h-[44px] md:max-h-none'
          }`}
        >
          {/* Drag handle (mobile only) */}
          <div
            className="md:hidden flex flex-col items-center pt-2 pb-1 cursor-pointer"
            onClick={() => setSheetExpanded(!sheetExpanded)}
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full"></div>
          </div>

          {/* Tab bar — icon only on mobile, icon + short label on desktop */}
          <div className="flex border-b border-slate-100 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSheetExpanded(true);
                }}
                className={`flex-1 py-2 text-center transition-colors relative ${
                  activeTab === tab.key ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                <i className={`bi ${tab.icon} text-lg`}></i>
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-emerald-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={`flex-1 overflow-y-auto overscroll-contain ${!sheetExpanded ? 'hidden md:block' : ''}`}>
              {activeTab === 'checkpoints' && (
                <CheckpointPanel
                  inspectionId={inspectionId}
                  checkpoints={inspection.checkpoints}
                  currentPosition={inspectorPosition}
                  isActive={inspection.status === 'IN_PROGRESS'}
                  onUpdate={() => { fetchInspection(); fetchMapData(); }}
                  samplePoints={samplePoints}
                  onSamplePointsChange={setSamplePoints}
                />
              )}
              {activeTab === 'prohibited' && (
                <ProhibitedCheckPanel
                  inspectionId={inspectionId}
                  prohibitedProperties={mapData?.prohibitedProperties || []}
                  prohibitedChecks={inspection.prohibitedChecks}
                  isActive={inspection.status === 'IN_PROGRESS'}
                  onUpdate={() => { fetchInspection(); fetchMapData(); }}
                />
              )}
              {activeTab === 'guidance' && (
                <GuidancePanel
                  inspectionId={inspectionId}
                  inspection={inspection}
                  category={inspection.category as 'CHECK' | 'GUIDANCE'}
                  isActive={inspection.status === 'IN_PROGRESS'}
                  onUpdate={fetchInspection}
                />
              )}
              {activeTab === 'summary' && (
                <InspectionSummary
                  inspection={inspection}
                  checkpoints={inspection.checkpoints}
                  prohibitedChecks={inspection.prohibitedChecks}
                />
              )}
            </div>

          {/* Finish button in sheet */}
          {inspection.status === 'IN_PROGRESS' && (
            <div className={`px-4 py-3 border-t border-slate-100 shrink-0 safe-area-bottom ${!sheetExpanded ? 'hidden md:block' : ''}`}>
              <button
                onClick={handleFinish}
                disabled={actionLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className="bi bi-stop-fill"></i>
                )}
                {t('btn_finish')}
              </button>
            </div>
          )}
        </div>
      )}
      </div>{/* end flex-1 flex-col md:flex-row */}
    </div>
  );
}
