'use client';

import React, { useState, useEffect, useRef } from 'react';
import liff from '@line/liff';

interface ScheduleItem { flyerName: string; plannedCount: number }
interface Photo { id: number; photoUrl: string; type: string; createdAt: string }
interface Schedule {
  id: number;
  areaName: string;
  items: ScheduleItem[];
  photos: Photo[];
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_PHOTO_ID || process.env.NEXT_PUBLIC_LIFF_ID || '';

export default function FlyerPhotoPage() {
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [distributorName, setDistributorName] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<string | null>(null); // "scheduleId-type"
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // LIFF 初期化
  useEffect(() => {
    if (!LIFF_ID) {
      setError('LIFF未設定');
      setLoading(false);
      return;
    }
    liff.init({ liffId: LIFF_ID })
      .then(() => {
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        return liff.getProfile();
      })
      .then(profile => {
        if (profile) {
          setLineUserId(profile.userId);
        }
      })
      .catch(err => {
        console.error('LIFF init error:', err);
        setError('LINE認証に失敗しました');
        setLoading(false);
      });
  }, []);

  // スケジュール取得
  useEffect(() => {
    if (!lineUserId) return;
    fetch(`/api/public/schedule-photos?lineUserId=${lineUserId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setDistributorName(data.distributor?.name || '');
        setSchedules(data.schedules || []);
      })
      .catch(() => setError('スケジュールの取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [lineUserId]);

  const handleUpload = async (scheduleId: number, type: 'FLYER' | 'MAP', file: File) => {
    const key = `${scheduleId}-${type}`;
    setUploading(key);
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('scheduleId', String(scheduleId));
      formData.append('lineUserId', lineUserId!);
      formData.append('type', type);
      formData.append('photo', file);

      const res = await fetch('/api/public/schedule-photos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error();

      const { photo } = await res.json();
      setSchedules(prev => prev.map(s =>
        s.id === scheduleId
          ? { ...s, photos: [photo, ...s.photos] }
          : s
      ));
      setSuccessMsg('Saved!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      alert('Upload failed');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-3">
        <div className="text-lg font-bold">Submit Photo</div>
        <div className="text-xs text-indigo-200 mt-0.5">{distributorName}</div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <i className="bi bi-check-circle-fill" />
          {successMsg}
        </div>
      )}

      {/* Schedules */}
      <div className="px-4 py-4 space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <i className="bi bi-calendar-x text-3xl mb-2 block" />
            <p className="text-sm">No schedules for today</p>
          </div>
        ) : (
          schedules.map(s => {
            const flyerPhotos = s.photos.filter(p => p.type === 'FLYER');
            const mapPhotos = s.photos.filter(p => p.type === 'MAP');
            const flyerKey = `${s.id}-FLYER`;
            const mapKey = `${s.id}-MAP`;

            return (
              <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Area header */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="font-bold text-sm text-slate-800">{s.areaName}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {s.items.map((item, i) => (
                      <span key={i}>
                        {i > 0 && ' / '}
                        {item.flyerName} ({item.plannedCount.toLocaleString()})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Flyer photos section */}
                <div className="px-4 py-3 border-b border-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="bi bi-file-earmark-image text-indigo-500" />
                    <span className="text-xs font-bold text-slate-600">Flyer Photo</span>
                    {flyerPhotos.length > 0 && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">{flyerPhotos.length}</span>
                    )}
                  </div>
                  {flyerPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mb-2">
                      {flyerPhotos.map(p => (
                        <img key={p.id} src={p.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0" />
                      ))}
                    </div>
                  )}
                  <input
                    ref={el => { fileInputRefs.current[flyerKey] = el; }}
                    type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(s.id, 'FLYER', f); e.target.value = ''; }}
                  />
                  <button
                    onClick={() => fileInputRefs.current[flyerKey]?.click()}
                    disabled={uploading === flyerKey}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {uploading === flyerKey ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                    ) : (
                      <><i className="bi bi-camera" /> Take photo of Flyer</>
                    )}
                  </button>
                </div>

                {/* Map photos section */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="bi bi-map text-amber-500" />
                    <span className="text-xs font-bold text-slate-600">Finished Map</span>
                    {mapPhotos.length > 0 && (
                      <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">{mapPhotos.length}</span>
                    )}
                  </div>
                  {mapPhotos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mb-2">
                      {mapPhotos.map(p => (
                        <img key={p.id} src={p.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0" />
                      ))}
                    </div>
                  )}
                  <input
                    ref={el => { fileInputRefs.current[mapKey] = el; }}
                    type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(s.id, 'MAP', f); e.target.value = ''; }}
                  />
                  <button
                    onClick={() => fileInputRefs.current[mapKey]?.click()}
                    disabled={uploading === mapKey}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {uploading === mapKey ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                    ) : (
                      <><i className="bi bi-camera" /> Take photo of Finished Map</>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
