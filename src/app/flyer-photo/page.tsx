'use client';

import React, { useState, useEffect, useRef } from 'react';
import liff from '@line/liff';

interface ScheduleItem { flyerName: string; plannedCount: number }
interface Photo { id: number; photoUrl: string; createdAt: string }
interface Schedule {
  id: number;
  areaName: string;
  items: ScheduleItem[];
  photos: Photo[];
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '';

export default function FlyerPhotoPage() {
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [distributorName, setDistributorName] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

  const handleUpload = async (scheduleId: number, file: File) => {
    setUploading(scheduleId);
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('scheduleId', String(scheduleId));
      formData.append('lineUserId', lineUserId!);
      formData.append('photo', file);

      const res = await fetch('/api/public/schedule-photos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error();

      const { photo } = await res.json();
      // 写真をリストに追加
      setSchedules(prev => prev.map(s =>
        s.id === scheduleId
          ? { ...s, photos: [photo, ...s.photos] }
          : s
      ));
      setSuccessMsg('写真を保存しました');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      alert('アップロードに失敗しました');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">読み込み中...</p>
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
        <div className="text-lg font-bold">チラシ写真アップロード</div>
        <div className="text-xs text-indigo-200 mt-0.5">{distributorName}</div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <i className="bi bi-check-circle-fill" />
          {successMsg}
        </div>
      )}

      {/* Schedules */}
      <div className="px-4 py-4 space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <i className="bi bi-calendar-x text-3xl mb-2 block" />
            <p className="text-sm">本日のスケジュールがありません</p>
          </div>
        ) : (
          schedules.map(s => (
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

              {/* Existing photos */}
              {s.photos.length > 0 && (
                <div className="px-4 py-2 flex gap-2 overflow-x-auto">
                  {s.photos.map(p => (
                    <img
                      key={p.id}
                      src={p.photoUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ))}
                </div>
              )}

              {/* Upload button */}
              <div className="px-4 py-3">
                <input
                  ref={el => { fileInputRefs.current[s.id] = el; }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(s.id, file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[s.id]?.click()}
                  disabled={uploading === s.id}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {uploading === s.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      アップロード中...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-camera" />
                      写真を撮影 / 選択
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
