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
  paymentMethod: string | null;
  bankName: string | null;
  bankBranchCode: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  bankAccountNameKana: string | null;
  bankCardImageUrl: string | null;
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
  const bankCardInputRef = useRef<HTMLInputElement>(null);

  // 給与受取方法
  const [paymentMethod, setPaymentMethod] = useState<'現金' | '振込' | ''>('');
  const [bankCardStep, setBankCardStep] = useState<'idle' | 'uploading' | 'analyzing' | 'form' | 'error'>('idle');
  const [bankCardError, setBankCardError] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankBranchCode: '',
    bankAccountType: '普通',
    bankAccountNumber: '',
    bankAccountName: '',
    bankAccountNameKana: '',
  });

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
        if (data.paymentMethod) {
          setPaymentMethod(data.paymentMethod as '現金' | '振込');
        }
        if (data.bankName || data.bankBranchCode) {
          setBankForm({
            bankName: data.bankName || '',
            bankBranchCode: data.bankBranchCode || '',
            bankAccountType: data.bankAccountType || '普通',
            bankAccountNumber: data.bankAccountNumber || '',
            bankAccountName: data.bankAccountName || '',
            bankAccountNameKana: data.bankAccountNameKana || '',
          });
          if (data.paymentMethod === '振込' && data.bankAccountNumber) {
            setBankCardStep('form');
          }
        }
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

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const maxW = 1920;
          const maxH = 1920;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
            'image/jpeg',
            0.85,
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  };

  // 給与受取方法: 現金選択時の保存
  const handleCashSelect = async () => {
    setPaymentMethod('現金');
    setMessage(null);
    const res = await fetch('/api/staff/bank-card', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: '現金' }),
    });
    if (res.ok) {
      setProfile((p) => p ? { ...p, paymentMethod: '現金' } : p);
      setMessage({ type: 'success', text: '給与受取方法を「現金」に設定しました' });
      setBankCardStep('idle');
    } else {
      setMessage({ type: 'error', text: '保存に失敗しました' });
    }
  };

  // 給与受取方法: 銀行振込選択
  const handleBankSelect = () => {
    setPaymentMethod('振込');
    // 既に口座情報が登録済みならフォーム表示
    if (profile?.bankAccountNumber) {
      setBankCardStep('form');
    } else {
      setBankCardStep('idle');
    }
  };

  // キャッシュカード撮影・アップロード・解析
  const handleBankCardCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBankCardStep('uploading');
    setBankCardError('');
    setMessage(null);

    try {
      // 1. 画像圧縮
      let uploadBlob: Blob = file;
      try {
        uploadBlob = await compressImage(file);
      } catch {
        // 圧縮失敗時は元ファイルを使用
      }

      // 2. プリサインドURL取得
      const presignRes = await fetch('/api/staff/bank-card');
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setBankCardStep('error');
        setBankCardError(presignData.error || 'URL取得に失敗しました');
        return;
      }

      // 3. S3にアップロード
      const s3Res = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: uploadBlob,
      });
      if (!s3Res.ok) {
        setBankCardStep('error');
        setBankCardError(`S3アップロード失敗 (${s3Res.status})`);
        return;
      }

      // 4. AI解析
      setBankCardStep('analyzing');
      const analyzeRes = await fetch('/api/staff/bank-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: presignData.s3Key }),
      });
      const analyzeData = await analyzeRes.json();

      if (!analyzeData.success) {
        if (analyzeData.manualInput) {
          // Gemini未設定時 → 手動入力フォーム表示
          setBankCardStep('form');
          return;
        }
        setBankCardStep('error');
        setBankCardError(analyzeData.error || 'カードの読み取りに失敗しました');
        return;
      }

      // 5. 解析成功 → フォームに自動入力
      setBankForm({
        bankName: analyzeData.data.bankName || '',
        bankBranchCode: analyzeData.data.branchCode || '',
        bankAccountType: analyzeData.data.accountType || '普通',
        bankAccountNumber: analyzeData.data.accountNumber || '',
        bankAccountName: analyzeData.data.accountHolder || '',
        bankAccountNameKana: analyzeData.data.accountHolderKana || '',
      });
      setBankCardStep('form');
    } catch (err) {
      setBankCardStep('error');
      setBankCardError(err instanceof Error ? err.message : 'エラーが発生しました');
    }

    if (bankCardInputRef.current) bankCardInputRef.current.value = '';
  };

  // 口座情報の保存
  const handleSaveBankInfo = async () => {
    setSavingBank(true);
    setMessage(null);
    const res = await fetch('/api/staff/bank-card', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: '振込',
        ...bankForm,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile((p) => p ? { ...p, ...data } : p);
      setMessage({ type: 'success', text: '口座情報を保存しました' });
    } else {
      setMessage({ type: 'error', text: data.error || '口座情報の保存に失敗しました' });
    }
    setSavingBank(false);
  };

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCard(side);
    setMessage(null);

    try {
      // 1. 画像圧縮
      let uploadBlob: Blob = file;
      try {
        uploadBlob = await compressImage(file);
      } catch {
        // 圧縮失敗時は元ファイルをそのまま使用
      }

      // 2. プリサインドURL取得
      const presignRes = await fetch(`/api/staff/residence-card?side=${side}`);
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setMessage({ type: 'error', text: presignData.error || 'URL取得に失敗しました' });
        return;
      }

      // 3. S3に直接アップロード（WAFをバイパス）
      const s3Res = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: uploadBlob,
      });
      if (!s3Res.ok) {
        setMessage({ type: 'error', text: `S3アップロード失敗 (${s3Res.status})` });
        return;
      }

      // 4. DB更新
      const saveRes = await fetch('/api/staff/residence-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: presignData.s3Key, side }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setMessage({ type: 'error', text: saveData.error || 'DB更新に失敗しました' });
        return;
      }

      setProfile((p) => p ? {
        ...p,
        ...(side === 'front' ? { residenceCardFrontUrl: saveData.url } : { residenceCardBackUrl: saveData.url }),
      } : p);
      setMessage({ type: 'success', text: `在留カード（${side === 'front' ? '表面' : '裏面'}）をアップロードしました` });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: `アップロード失敗: ${detail}` });
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

      {/* 給与受取方法 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <i className="bi bi-cash-stack text-lg text-indigo-600"></i>
          <h2 className="font-bold text-slate-800">給与受取方法</h2>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCashSelect}
            className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
              paymentMethod === '現金'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
            }`}
          >
            <i className="bi bi-cash mr-1.5"></i>現金
          </button>
          <button
            type="button"
            onClick={handleBankSelect}
            className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
              paymentMethod === '振込'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
            }`}
          >
            <i className="bi bi-bank mr-1.5"></i>銀行振込
          </button>
        </div>

        {paymentMethod === '振込' && (
          <>
            {/* カード撮影エリア（フォーム未表示時） */}
            {bankCardStep === 'idle' && (
              <div>
                <p className="text-xs text-slate-500 mb-3">キャッシュカードを撮影すると、口座情報を自動で読み取ります</p>
                <div
                  onClick={() => bankCardInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 transition-colors bg-slate-50"
                >
                  <i className="bi bi-camera-fill text-3xl text-slate-300"></i>
                  <p className="text-sm text-slate-500 mt-2 font-bold">タップしてキャッシュカードを撮影</p>
                  <p className="text-[10px] text-slate-400 mt-1">カードの表面が鮮明に映るように撮影してください</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBankCardStep('form')}
                  className="w-full mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-bold py-2"
                >
                  手動で入力する
                </button>
                <input
                  ref={bankCardInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleBankCardCapture}
                />
              </div>
            )}

            {/* アップロード中 */}
            {bankCardStep === 'uploading' && (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500 mt-3 font-bold">アップロード中...</p>
              </div>
            )}

            {/* AI解析中 */}
            {bankCardStep === 'analyzing' && (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500 mt-3 font-bold">AI解析中...</p>
                <p className="text-[10px] text-slate-400 mt-1">カード情報を読み取っています</p>
              </div>
            )}

            {/* エラー */}
            {bankCardStep === 'error' && (
              <div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                  <i className="bi bi-exclamation-triangle-fill text-2xl text-rose-400"></i>
                  <p className="text-sm text-rose-700 mt-2 font-bold">{bankCardError}</p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBankCardStep('idle');
                      setBankCardError('');
                    }}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    <i className="bi bi-camera-fill mr-1.5"></i>もう一度撮影
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankCardStep('form')}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors"
                  >
                    手動で入力
                  </button>
                </div>
                <input
                  ref={bankCardInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleBankCardCapture}
                />
              </div>
            )}

            {/* 確認フォーム */}
            {bankCardStep === 'form' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600">口座情報</p>
                  <button
                    type="button"
                    onClick={() => {
                      setBankCardStep('idle');
                      if (bankCardInputRef.current) bankCardInputRef.current.value = '';
                    }}
                    className="text-[10px] text-indigo-600 font-bold hover:text-indigo-700"
                  >
                    <i className="bi bi-camera-fill mr-1"></i>再撮影
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1">銀行名</label>
                  <input
                    type="text"
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                    placeholder="例: 三菱UFJ銀行"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1">支店番号</label>
                  <input
                    type="text"
                    value={bankForm.bankBranchCode}
                    onChange={(e) => setBankForm((f) => ({ ...f, bankBranchCode: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                    placeholder="例: 001"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1">口座種別</label>
                  <select
                    value={bankForm.bankAccountType}
                    onChange={(e) => setBankForm((f) => ({ ...f, bankAccountType: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                  >
                    <option value="普通">普通</option>
                    <option value="当座">当座</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1">口座番号</label>
                  <input
                    type="text"
                    value={bankForm.bankAccountNumber}
                    onChange={(e) => setBankForm((f) => ({ ...f, bankAccountNumber: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                    placeholder="例: 1234567"
                    maxLength={8}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 ml-1">名義（カナ）</label>
                  <input
                    type="text"
                    value={bankForm.bankAccountNameKana}
                    onChange={(e) => setBankForm((f) => ({ ...f, bankAccountNameKana: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm"
                    placeholder="例: ヤマダ タロウ"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveBankInfo}
                  disabled={savingBank || !bankForm.bankAccountNumber}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-70 text-sm"
                >
                  {savingBank ? '保存中...' : '口座情報を保存する'}
                </button>

                <input
                  ref={bankCardInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleBankCardCapture}
                />
              </div>
            )}
          </>
        )}
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
