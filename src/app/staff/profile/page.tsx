'use client';

import React, { useEffect, useState, useRef } from 'react';
import { handlePhoneChange, handlePostalInput } from '@/lib/formatters';

type Profile = {
  id: number;
  staffId: string;
  name: string;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  address: string | null;
  buildingName: string | null;
  avatarUrl: string | null;
  residenceCardFrontUrl: string | null;
  residenceCardBackUrl: string | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCard, setUploadingCard] = useState<'front' | 'back' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardFrontInputRef = useRef<HTMLInputElement>(null);
  const cardBackInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    phone: '',
    email: '',
    postalCode: '',
    address: '',
    buildingName: '',
  });

  useEffect(() => {
    fetch('/api/staff/profile')
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setForm({
          phone: data.phone || '',
          email: data.email || '',
          postalCode: data.postalCode || '',
          address: data.address || '',
          buildingName: data.buildingName || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch('/api/staff/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (res.ok) {
      setProfile((p) => p ? { ...p, ...data } : data);
      setMessage({ type: 'success', text: 'プロフィールを更新しました' });
    } else {
      setMessage({ type: 'error', text: data.error || '更新に失敗しました' });
    }
    setSaving(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/staff/avatar', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      setProfile((p) => p ? { ...p, avatarUrl: data.url } : p);
      setMessage({ type: 'success', text: '写真をアップロードしました' });
    } else {
      setMessage({ type: 'error', text: data.error || 'アップロードに失敗しました' });
    }
    setUploading(false);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCard(side);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/staff/residence-card?side=${side}`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      setProfile((p) => p ? {
        ...p,
        ...(side === 'front' ? { residenceCardFrontUrl: data.url } : { residenceCardBackUrl: data.url }),
      } : p);
      setMessage({ type: 'success', text: `在留カード（${side === 'front' ? '表面' : '裏面'}）をアップロードしました` });
    } else {
      setMessage({ type: 'error', text: data.error || 'アップロードに失敗しました' });
    }
    setUploadingCard(null);
    if (side === 'front' && cardFrontInputRef.current) cardFrontInputRef.current.value = '';
    if (side === 'back' && cardBackInputRef.current) cardBackInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-800">プロフィール</h1>

      {message && (
        <div
          className={`p-3 rounded-xl text-sm font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <i className="bi bi-check-circle-fill mr-2"></i>
          ) : (
            <i className="bi bi-exclamation-triangle-fill mr-2"></i>
          )}
          {message.text}
        </div>
      )}

      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <i className="bi bi-person-fill text-5xl text-slate-300"></i>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
          >
            {uploading ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <i className="bi bi-camera-fill text-sm"></i>
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <div className="text-center">
          <p className="font-bold text-slate-800 text-lg">{profile.name}</p>
          <p className="text-sm text-slate-500">{profile.staffId}</p>
        </div>
        <p className="text-xs text-slate-400">カメラアイコンをタップして写真を変更</p>
      </div>

      {/* Residence card upload */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800">在留カード</h2>
          {profile.residenceCardFrontUrl && profile.residenceCardBackUrl ? (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <i className="bi bi-check-circle-fill mr-1"></i>提出済み
            </span>
          ) : (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <i className="bi bi-exclamation-triangle-fill mr-1"></i>未提出
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">在留カードの表面と裏面の写真をそれぞれアップロードしてください</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Front */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">表面</p>
            <div
              onClick={() => cardFrontInputRef.current?.click()}
              className="relative aspect-[3/2] rounded-xl border-2 border-dashed border-slate-200 overflow-hidden cursor-pointer hover:border-indigo-300 transition-colors flex items-center justify-center bg-slate-50"
            >
              {uploadingCard === 'front' ? (
                <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              ) : profile.residenceCardFrontUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.residenceCardFrontUrl} alt="在留カード表面" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-xs font-bold opacity-0 hover:opacity-100 transition-opacity">
                      <i className="bi bi-camera-fill mr-1"></i>変更
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <i className="bi bi-camera-fill text-2xl text-slate-300"></i>
                  <p className="text-[10px] text-slate-400 mt-1">タップして撮影</p>
                </div>
              )}
            </div>
            <input
              ref={cardFrontInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleCardUpload(e, 'front')}
            />
          </div>

          {/* Back */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">裏面</p>
            <div
              onClick={() => cardBackInputRef.current?.click()}
              className="relative aspect-[3/2] rounded-xl border-2 border-dashed border-slate-200 overflow-hidden cursor-pointer hover:border-indigo-300 transition-colors flex items-center justify-center bg-slate-50"
            >
              {uploadingCard === 'back' ? (
                <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              ) : profile.residenceCardBackUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.residenceCardBackUrl} alt="在留カード裏面" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-xs font-bold opacity-0 hover:opacity-100 transition-opacity">
                      <i className="bi bi-camera-fill mr-1"></i>変更
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <i className="bi bi-camera-fill text-2xl text-slate-300"></i>
                  <p className="text-[10px] text-slate-400 mt-1">タップして撮影</p>
                </div>
              )}
            </div>
            <input
              ref={cardBackInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleCardUpload(e, 'back')}
            />
          </div>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="font-bold text-slate-800">連絡先情報</h2>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">電話番号</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => handlePhoneChange(e.target.value, (v) => setForm((f) => ({ ...f, phone: v })))}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base"
            placeholder="例: 090-1234-5678"
            maxLength={13}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">メールアドレス</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base"
            placeholder="例: mail@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">郵便番号</label>
          <input
            type="text"
            value={form.postalCode}
            onChange={(e) => handlePostalInput(
              e.target.value,
              (v) => setForm((f) => ({ ...f, postalCode: v })),
              (v) => setForm((f) => ({ ...f, address: v }))
            )}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base"
            placeholder="例: 160-0022"
            maxLength={8}
          />
          <p className="text-[11px] text-slate-400 mt-1 ml-1">7桁入力で住所を自動補完します</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">住所</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base"
            placeholder="例: 東京都新宿区..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">建物名・部屋番号</label>
          <input
            type="text"
            value={form.buildingName}
            onChange={(e) => setForm((f) => ({ ...f, buildingName: e.target.value }))}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-base"
            placeholder="例: ○○マンション 101号室"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-70 text-base"
        >
          {saving ? '保存中...' : '変更を保存する'}
        </button>
      </form>
    </div>
  );
}
