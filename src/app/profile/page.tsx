'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { useNotification } from '@/components/ui/NotificationProvider';

// --- 定数・ヘルパー関数 ---
const RANK_MAP: Record<string, string> = {
  EXECUTIVE: '役員', DIRECTOR: '本部長・事業部長', MANAGER: 'マネージャー', LEADER: 'リーダー', ASSOCIATE: 'アソシエイト(一般)',
};

const KANA_MAP: Record<string, string> = {
  'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', 'グ': 'ｸﾞ', 'ゲ': 'ｹﾞ', 'ゴ': 'ｺﾞ',
  'ザ': 'ｻﾞ', 'ジ': 'ｼﾞ', 'ズ': 'ｽﾞ', 'ゼ': 'ｾﾞ', 'ゾ': 'ｿﾞ',
  'ダ': 'ﾀﾞ', 'ヂ': 'ﾁﾞ', 'ヅ': 'ﾂﾞ', 'デ': 'ﾃﾞ', 'ド': 'ﾄﾞ',
  'バ': 'ﾊﾞ', 'ビ': 'ﾋﾞ', 'ブ': 'ﾌﾞ', 'ベ': 'ﾍﾞ', 'ボ': 'ﾎﾞ',
  'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', 'プ': 'ﾌﾟ', 'ペ': 'ﾍﾟ', 'ポ': 'ﾎﾟ',
  'ヴ': 'ｳﾞ', 'ヷ': 'ﾜﾞ', 'ヺ': 'ｦﾞ',
  'ア': 'ｱ', 'イ': 'ｲ', 'ウ': 'ｳ', 'エ': 'ｴ', 'オ': 'ｵ',
  'カ': 'ｶ', 'キ': 'ｷ', 'ク': 'ｸ', 'ケ': 'ｹ', 'コ': 'ｺ',
  'サ': 'ｻ', 'シ': 'ｼ', 'ス': 'ｽ', 'セ': 'ｾ', 'ソ': 'ｿ',
  'タ': 'ﾀ', 'チ': 'ﾁ', 'ツ': 'ﾂ', 'テ': 'ﾃ', 'ト': 'ﾄ',
  'ナ': 'ﾅ', 'ニ': 'ﾆ', 'ヌ': 'ﾇ', 'ネ': 'ﾈ', 'ノ': 'ﾉ',
  'ハ': 'ﾊ', 'ヒ': 'ﾋ', 'フ': 'ﾌ', 'ヘ': 'ﾍ', 'ホ': 'ﾎ',
  'マ': 'ﾏ', 'ミ': 'ﾐ', 'ム': 'ﾑ', 'メ': 'ﾒ', 'モ': 'ﾓ',
  'ヤ': 'ﾔ', 'ユ': 'ﾕ', 'ヨ': 'ﾖ',
  'ラ': 'ﾗ', 'リ': 'ﾘ', 'ル': 'ﾙ', 'レ': 'ﾚ', 'ロ': 'ﾛ',
  'ワ': 'ﾜ', 'ヲ': 'ｦ', 'ン': 'ﾝ',
  'ァ': 'ｧ', 'ィ': 'ｨ', 'ゥ': 'ｩ', 'ェ': 'ｪ', 'ォ': 'ｫ',
  'ッ': 'ｯ', 'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ',
  'ー': 'ｰ', '、': '､', '。': '｡', '・': '･', '　': ' '
};

const formatToHalfWidthKana = (str: string) => {
  if (!str) return '';
  let converted = str.replace(/[ぁ-ん]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
  converted = converted.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  const reg = new RegExp('(' + Object.keys(KANA_MAP).join('|') + ')', 'g');
  converted = converted.replace(reg, (match) => KANA_MAP[match] || match);
  return converted.toUpperCase();
};

const formatToHalfWidthNumber = (str: string) => {
  if (!str) return '';
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/[^0-9]/g, '');
};

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not found');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas is empty'));
    }, 'image/jpeg', 0.9);
  });
}

// --- メインコンポーネント ---
export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- 社員プロフィール閲覧モーダル用State ---
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);
  const [isViewModalLoading, setIsViewModalLoading] = useState(false);

  // --- 上司変更用State ---
  const [isEditingManager, setIsEditingManager] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [managerCandidates, setManagerCandidates] = useState<any[]>([]);
  const [selectedNewManager, setSelectedNewManager] = useState<any>(null);
  const [isSavingManager, setIsSavingManager] = useState(false);
  const managerSearchRef = useRef<HTMLInputElement>(null);
  const managerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- トリミング用State ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    lastNameJa: '', firstNameJa: '', lastNameEn: '', firstNameEn: '',
    email: '', phone: '', avatarUrl: '',
    bankId: '', branchName: '', branchCode: '', accountType: 'ORDINARY',
    accountNumber: '', accountName: '', accountNameKana: '',
    password: '', confirmPassword: ''
  });

  const { showToast, showConfirm } = useNotification();

  // ★ パスワードのバリデーションチェック
  const hasUpper = /[A-Z]/.test(formData.password);
  const hasLower = /[a-z]/.test(formData.password);
  const hasNumOrSym = /[0-9!@#$%^&*(),.?":{}|<>\-_]/.test(formData.password);
  const isLongEnough = formData.password.length >= 8;
  const passwordsMatch = formData.password === formData.confirmPassword && formData.password !== '';
  const isPasswordValid = hasUpper && hasLower && hasNumOrSym && isLongEnough;

  // ★ パスワードルールインジケーターコンポーネント
  const RuleIndicator = ({ isValid, text }: { isValid: boolean, text: string }) => (
    <div className={`flex items-center gap-1.5 text-xs transition-colors duration-300 ${isValid ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
      <i className={`bi ${isValid ? 'bi-check-circle-fill' : 'bi-circle'}`}></i>
      <span>{text}</span>
    </div>
  );

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profileRes, banksRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/banks')
      ]);
      
      if (banksRes.ok) setBanks(await banksRes.json());

      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data);
        setFormData({
          lastNameJa: data.lastNameJa || '', firstNameJa: data.firstNameJa || '',
          lastNameEn: data.lastNameEn || '', firstNameEn: data.firstNameEn || '',
          email: data.email || '', phone: data.phone || '', avatarUrl: data.avatarUrl || '',
          bankId: data.financial?.bankId?.toString() || '',
          branchName: data.financial?.branchName || '',
          branchCode: data.financial?.branchCode || '',
          accountType: data.financial?.accountType || 'ORDINARY',
          accountNumber: data.financial?.accountNumber || '',
          accountName: data.financial?.accountName || '',
          accountNameKana: data.financial?.accountNameKana || '',
          password: '', confirmPassword: '' 
        });
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 上司検索オートコンプリート
  const handleManagerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManagerSearch(val);
    setSelectedNewManager(null);
    if (managerTimerRef.current) clearTimeout(managerTimerRef.current);
    if (!val.trim()) { setManagerCandidates([]); return; }
    managerTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/employees?search=${encodeURIComponent(val)}`);
        if (res.ok) setManagerCandidates(await res.json());
      } catch { /* ignore */ }
    }, 250);
  };

  const handleSelectManager = (emp: any) => {
    setSelectedNewManager(emp);
    setManagerSearch(`${emp.lastNameJa} ${emp.firstNameJa}`);
    setManagerCandidates([]);
  };

  const handleSaveManager = async () => {
    setIsSavingManager(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId: selectedNewManager ? selectedNewManager.id : null })
      });
      if (res.ok) {
        setIsEditingManager(false);
        setManagerSearch('');
        setSelectedNewManager(null);
        setManagerCandidates([]);
        fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || '上司の変更に失敗しました', 'error');
      }
    } catch { showToast('通信エラーが発生しました', 'error'); }
    setIsSavingManager(false);
  };

  const handleCancelManagerEdit = () => {
    setIsEditingManager(false);
    setManagerSearch('');
    setSelectedNewManager(null);
    setManagerCandidates([]);
  };

  const openEmployeeView = async (id: number) => {
    setIsViewModalLoading(true);
    setViewingEmployee({}); // モーダルを即座に開く（ローディング状態）
    try {
      const res = await fetch(`/api/employees/${id}`);
      if (res.ok) setViewingEmployee(await res.json());
    } catch { /* ignore */ }
    setIsViewModalLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlurFormat = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'branchCode' || name === 'accountNumber') {
      formattedValue = formatToHalfWidthNumber(value);
    } else if (name === 'accountNameKana') {
      formattedValue = formatToHalfWidthKana(value);
    }

    if (formattedValue !== value) {
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setTempImageSrc(reader.result?.toString() || null);
        setIsUploadModalOpen(true);
        setZoom(1);
      });
      reader.readAsDataURL(file);
      e.target.value = ''; 
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const executeCropAndUpload = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    setIsUploading(true);
    try {
      const croppedImageBlob = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      const uploadData = new FormData();
      uploadData.append('file', croppedImageBlob, 'avatar.jpg'); 

      const res = await fetch('/api/upload', { method: 'POST', body: uploadData });
      const data = await res.json();

      if (data.url) {
        setFormData(prev => ({ ...prev, avatarUrl: data.url }));
        setIsUploadModalOpen(false);
        setTempImageSrc(null);
      } else {
        showToast(data.error || 'アップロードに失敗しました', 'error');
      }
    } catch (e) {
      showToast('画像の処理中にエラーが発生しました', 'error');
    }
    setIsUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password && !isPasswordValid) {
      showToast('新しいパスワードが要件を満たしていません。', 'warning'); return;
    }

    if (formData.password && !passwordsMatch) {
      showToast('新しいパスワードと確認用パスワードが一致しません。', 'error'); return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        showToast('プロフィール情報を保存しました', 'success');
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        fetchData();
      } else {
        showToast('保存に失敗しました', 'error');
      }
    } catch (err) { showToast('通信エラーが発生しました', 'error'); }
    setIsSaving(false);
  };

  if (isLoading) return <div className="p-10 text-center text-slate-500">読み込み中...</div>;
  if (!profile) return <div className="p-10 text-center text-rose-500">プロフィール情報が見つかりません。</div>;

  const isAuthorized = profile.roles?.some((r: any) => r.role?.code === 'SUPER_ADMIN' || r.role?.code === 'HR_ADMIN');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10 relative">
      <div className="flex justify-between items-end border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-person-badge text-indigo-600"></i> マイプロフィール
          </h1>
          <p className="text-slate-500 text-sm mt-1">あなたのアカウント情報と、社内・組織情報の確認が行えます。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center">
            <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-100 flex items-center justify-center relative">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <i className="bi bi-person-fill text-6xl text-slate-300 mt-4"></i>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="bi bi-camera-fill text-white text-2xl"></i>
                  <span className="absolute bottom-2 text-xs text-white font-bold">変更</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
            </div>
            <h2 className="text-xl font-black text-slate-800">{profile.lastNameJa} {profile.firstNameJa}</h2>
            <p className="text-sm font-bold text-indigo-600 mt-1">{profile.jobTitle || '役職未設定'}</p>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 flex items-center gap-2">
              <i className="bi bi-building"></i> 組織・権限情報
            </h3>
            <div><div className="text-[10px] font-bold text-slate-400 uppercase">所属部署</div><div className="font-bold text-slate-800">{profile.department?.name || '未設定'}</div></div>
            <div><div className="text-[10px] font-bold text-slate-400 uppercase">所属支店</div><div className="font-bold text-slate-800">{profile.branch?.nameJa || '未設定'}</div></div>
            <div><div className="text-[10px] font-bold text-slate-400 uppercase">階級 (等級)</div><div className="font-bold text-slate-800">{RANK_MAP[profile.rank] || profile.rank}</div></div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">システム権限</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {profile.roles && profile.roles.length > 0 ? (
                  profile.roles.map((r: any) => (
                    <span key={r.id} className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
                      {r.role?.name}
                    </span>
                  ))
                ) : (
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold rounded">
                    一般ユーザー
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* --- 上司・部下 カード --- */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-5">
            <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><i className="bi bi-diagram-3"></i> 上司・部下</span>
              {isAuthorized && !isEditingManager && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingManager(true);
                    setManagerSearch(profile.manager ? `${profile.manager.lastNameJa} ${profile.manager.firstNameJa}` : '');
                    setTimeout(() => managerSearchRef.current?.focus(), 50);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors"
                >
                  <i className="bi bi-pencil text-[10px]"></i> 変更
                </button>
              )}
            </h3>

            {/* 上司セクション */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">上司</div>
              {!isEditingManager ? (
                profile.manager ? (
                  <button
                    type="button"
                    onClick={() => openEmployeeView(profile.manager.id)}
                    className="flex items-center gap-3 w-full text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-300">
                      {profile.manager.avatarUrl ? (
                        <img src={profile.manager.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <i className="bi bi-person-fill text-slate-400 text-xl mt-1"></i>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-indigo-600 group-hover:text-indigo-800 group-hover:underline transition-colors">
                        {profile.manager.lastNameJa} {profile.manager.firstNameJa}
                      </div>
                      <div className="text-xs text-slate-500">{profile.manager.jobTitle || '役職未設定'}</div>
                    </div>
                  </button>
                ) : (
                  <p className="text-sm text-slate-400">未設定</p>
                )
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <i className="bi bi-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                    <input
                      ref={managerSearchRef}
                      type="text"
                      value={managerSearch}
                      onChange={handleManagerSearchChange}
                      placeholder="名前で検索..."
                      className="w-full border border-slate-300 bg-white py-2 pl-8 pr-3 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    {managerCandidates.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {managerCandidates.map((emp: any) => (
                          <button
                            key={emp.id}
                            type="button"
                            onMouseDown={() => handleSelectManager(emp)}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm border-b border-slate-100 last:border-0 transition-colors"
                          >
                            <span className="font-bold text-slate-800">{emp.lastNameJa} {emp.firstNameJa}</span>
                            {emp.department && <span className="text-xs text-slate-400 ml-2">{emp.department.name}</span>}
                            {emp.jobTitle && <span className="text-xs text-slate-500 ml-1">/ {emp.jobTitle}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveManager}
                      disabled={isSavingManager}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      {isSavingManager ? '保存中...' : <><i className="bi bi-check-lg"></i> 保存</>}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelManagerEdit}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 rounded-lg transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!await showConfirm('上司の設定を解除しますか？', { title: '上司の設定を解除', confirmLabel: '解除する', variant: 'danger' })) return;
                        setIsSavingManager(true);
                        try {
                          const res = await fetch('/api/profile', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ managerId: null })
                          });
                          if (res.ok) { setIsEditingManager(false); setManagerSearch(''); setSelectedNewManager(null); fetchData(); }
                          else { const d = await res.json(); showToast(d.error || '解除に失敗しました', 'error'); }
                        } catch { showToast('通信エラー', 'error'); }
                        setIsSavingManager(false);
                      }}
                      disabled={isSavingManager}
                      className="text-xs text-rose-400 hover:text-rose-600 font-bold px-2 py-2 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
                      title="上司の設定を解除"
                    >
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 部下セクション */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                部下 ({profile.subordinates?.length || 0}名)
              </div>
              {profile.subordinates && profile.subordinates.length > 0 ? (
                <div className="space-y-2.5">
                  {profile.subordinates.map((sub: any) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => openEmployeeView(sub.id)}
                      className="flex items-center gap-3 w-full text-left group"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-300">
                        {sub.avatarUrl ? (
                          <img src={sub.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <i className="bi bi-person-fill text-slate-400 text-base mt-0.5"></i>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-indigo-600 group-hover:text-indigo-800 group-hover:underline transition-colors">
                          {sub.lastNameJa} {sub.firstNameJa}
                        </div>
                        <div className="text-xs text-slate-500">{sub.jobTitle || RANK_MAP[sub.rank] || '役職未設定'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">なし</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
            
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <i className="bi bi-person-lines-fill text-slate-400"></i> 基本情報の編集
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="block text-xs font-bold text-slate-600 mb-2">姓 (漢字) *</label><input required type="text" name="lastNameJa" value={formData.lastNameJa} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-2">名 (漢字) *</label><input required type="text" name="firstNameJa" value={formData.firstNameJa} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-2">姓 (カナ/英)</label><input type="text" name="lastNameEn" value={formData.lastNameEn} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-2">名 (カナ/英)</label><input type="text" name="firstNameEn" value={formData.firstNameEn} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div className="md:col-span-2 border-t border-slate-100 pt-6">
                <label className="block text-xs font-bold text-slate-600 mb-2">ログイン用メールアドレス *</label>
                <div className="relative"><i className="bi bi-envelope absolute left-3 top-2.5 text-slate-400"></i><input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full border border-slate-300 py-2.5 pl-9 pr-3 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-2">電話番号</label>
                <div className="relative"><i className="bi bi-telephone absolute left-3 top-2.5 text-slate-400"></i><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full border border-slate-300 py-2.5 pl-9 pr-3 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="090-1234-5678" /></div>
              </div>
            </div>

            {/* --- ★ パスワード変更セクション --- */}
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6 mt-10 border-t border-slate-200 pt-8">
              <i className="bi bi-shield-lock text-slate-400"></i> パスワードの変更
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500 mb-2">
                  <i className="bi bi-info-circle mr-1"></i>
                  パスワードを変更する場合のみ入力してください。変更しない場合は空欄のままで構いません。
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">新しいパスワード</label>
                <div className="relative">
                  <i className="bi bi-key absolute left-3 top-2.5 text-slate-400"></i>
                  <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full border border-slate-300 py-2.5 pl-9 pr-3 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="新しいパスワード" />
                </div>
                {/* ★ 条件インジケーター（入力がある時のみ表示） */}
                {formData.password && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-2 gap-2 shadow-sm">
                    <RuleIndicator isValid={isLongEnough} text="8文字以上" />
                    <RuleIndicator isValid={hasUpper} text="大文字を含む" />
                    <RuleIndicator isValid={hasLower} text="小文字を含む" />
                    <RuleIndicator isValid={hasNumOrSym} text="数字/記号を含む" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">新しいパスワード (確認用)</label>
                <div className="relative">
                  <i className="bi bi-key-fill absolute left-3 top-2.5 text-slate-400"></i>
                  <input 
                    type="password" 
                    name="confirmPassword" 
                    value={formData.confirmPassword} 
                    onChange={handleInputChange} 
                    className={`w-full border py-2.5 pl-9 pr-3 rounded-lg text-sm font-mono outline-none bg-white transition-all ${formData.confirmPassword ? (passwordsMatch ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500' : 'border-rose-500 focus:ring-2 focus:ring-rose-500') : 'border-slate-300 focus:ring-2 focus:ring-indigo-500'}`} 
                    placeholder="もう一度入力" 
                  />
                  {formData.confirmPassword && (
                    <i className={`bi absolute right-3 top-2.5 text-lg ${passwordsMatch ? 'bi-check-circle-fill text-emerald-500' : 'bi-x-circle-fill text-rose-500'}`}></i>
                  )}
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6 mt-10 border-t border-slate-200 pt-8">
              <i className="bi bi-bank text-slate-400"></i> 給与振込口座の登録
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-2">銀行名</label>
                <select name="bankId" value={formData.bankId} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="">選択してください</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-4 md:col-span-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 mb-2">支店名</label>
                  <input type="text" name="branchName" value={formData.branchName} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="例: 新宿支店" />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-600 mb-2">支店コード</label>
                  <input 
                    type="text" 
                    name="branchCode" 
                    value={formData.branchCode} 
                    onChange={handleInputChange}
                    onBlur={handleBlurFormat}
                    className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                    placeholder="123" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">口座種別</label>
                <select name="accountType" value={formData.accountType} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="ORDINARY">普通 (Ordinary)</option>
                  <option value="CURRENT">当座 (Current)</option>
                  <option value="SAVINGS">貯蓄 (Savings)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">口座番号</label>
                <input 
                  type="text" 
                  name="accountNumber" 
                  value={formData.accountNumber} 
                  onChange={handleInputChange}
                  onBlur={handleBlurFormat}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                  placeholder="1234567" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">口座名義 (漢字)</label>
                <input type="text" name="accountName" value={formData.accountName} onChange={handleInputChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="山田 太郎" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">口座名義 (カナ)</label>
                <input 
                  type="text" 
                  name="accountNameKana" 
                  value={formData.accountNameKana} 
                  onChange={handleInputChange} 
                  onBlur={handleBlurFormat}
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                  placeholder="ﾔﾏﾀﾞ ﾀﾛｳ" 
                />
                <p className="text-[10px] text-slate-400 mt-1">※ひらがな等で入力しても自動で半角カナに変換されます。</p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-200 flex justify-end">
              {/* ★ 変更: パスワード入力時、要件を満たさないとボタンを押せなくする */}
              <button 
                type="submit" 
                disabled={isSaving || (formData.password !== '' && (!isPasswordValid || !passwordsMatch))} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? '保存中...' : <><i className="bi bi-cloud-arrow-up-fill"></i> すべての情報を保存する</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* --- 社員プロフィール閲覧モーダル --- */}
      {viewingEmployee && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setViewingEmployee(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <i className="bi bi-person-badge text-slate-300"></i> 社員プロフィール
              </h3>
              <button
                onClick={() => setViewingEmployee(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {isViewModalLoading || !viewingEmployee.id ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin mr-3"></div>
                読み込み中...
              </div>
            ) : (
              <div className="p-6">
                {/* アバター・名前 */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {viewingEmployee.avatarUrl ? (
                      <img src={viewingEmployee.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <i className="bi bi-person-fill text-3xl text-slate-300 mt-2"></i>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                      {viewingEmployee.employeeCode}
                    </p>
                    <h4 className="text-xl font-black text-slate-800">
                      {viewingEmployee.lastNameJa} {viewingEmployee.firstNameJa}
                    </h4>
                    <p className="text-sm text-indigo-600 font-bold">{viewingEmployee.jobTitle || '役職未設定'}</p>
                  </div>
                </div>

                {/* 組織情報 */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">所属部署</div>
                      <div className="font-bold text-slate-700">{viewingEmployee.department?.name || '未設定'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">所属支店</div>
                      <div className="font-bold text-slate-700">{viewingEmployee.branch?.nameJa || '未設定'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">階級</div>
                      <div className="font-bold text-slate-700">{RANK_MAP[viewingEmployee.rank] || viewingEmployee.rank || '未設定'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">システム権限</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {viewingEmployee.roles && viewingEmployee.roles.length > 0 ? (
                          viewingEmployee.roles.map((r: any) => (
                            <span key={r.id} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
                              {r.role?.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-xs">一般</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 上司・部下 */}
                <div className="space-y-3 text-sm">
                  {viewingEmployee.manager && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-12 shrink-0">上司</span>
                      <button
                        type="button"
                        onClick={() => openEmployeeView(viewingEmployee.manager.id)}
                        className="flex items-center gap-2 group"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {viewingEmployee.manager.avatarUrl ? (
                            <img src={viewingEmployee.manager.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <i className="bi bi-person-fill text-slate-400 text-sm mt-0.5"></i>
                          )}
                        </div>
                        <span className="font-bold text-indigo-600 group-hover:text-indigo-800 group-hover:underline transition-colors">
                          {viewingEmployee.manager.lastNameJa} {viewingEmployee.manager.firstNameJa}
                        </span>
                      </button>
                    </div>
                  )}
                  {viewingEmployee.subordinates && viewingEmployee.subordinates.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-12 shrink-0 mt-1">部下</span>
                      <div className="flex flex-wrap gap-2">
                        {viewingEmployee.subordinates.map((sub: any) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => openEmployeeView(sub.id)}
                            className="flex items-center gap-1.5 group"
                          >
                            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                              {sub.avatarUrl ? (
                                <img src={sub.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <i className="bi bi-person-fill text-slate-400 text-xs mt-0.5"></i>
                              )}
                            </div>
                            <span className="font-bold text-indigo-600 group-hover:text-indigo-800 group-hover:underline text-xs transition-colors">
                              {sub.lastNameJa} {sub.firstNameJa}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 画像トリミングモーダル --- */}
      {isUploadModalOpen && tempImageSrc && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-lg md:max-w-2xl m-4">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800"><i className="bi bi-crop text-indigo-600 mr-2"></i>写真の切り抜きと調整</h3>
              <button onClick={() => { setIsUploadModalOpen(false); setTempImageSrc(null); }} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="p-6">
              <div className="relative w-full h-[300px] md:h-[400px] bg-slate-100 rounded-xl overflow-hidden border-2 border-slate-200 mb-6">
                <Cropper image={tempImageSrc} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} classes={{ containerClassName: 'rounded-xl' }} />
              </div>
              <div className="flex items-center gap-4 px-4">
                <i className="bi bi-dash-lg text-slate-400"></i>
                <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                <i className="bi bi-plus-lg text-slate-600"></i>
              </div>
              <p className="text-center text-xs text-slate-500 mt-2">ドラッグして移動、スライダーで拡大・縮小できます</p>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => { setIsUploadModalOpen(false); setTempImageSrc(null); }} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">キャンセル</button>
              <button onClick={executeCropAndUpload} disabled={isUploading} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-2">
                {isUploading ? '処理中...' : <><i className="bi bi-check-lg"></i> この範囲で適用する</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}