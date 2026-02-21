'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';

// --- 定数・ヘルパー関数 ---
const RANK_MAP: Record<string, string> = {
  EXECUTIVE: '役員', DIRECTOR: '本部長・事業部長', MANAGER: 'マネージャー', LEADER: 'リーダー', ASSOCIATE: 'アソシエイト(一般)',
};

// ★ 追加: 全角カタカナ→半角カタカナ変換マップ
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

// ★ 追加: 半角カナ自動変換ロジック
const formatToHalfWidthKana = (str: string) => {
  if (!str) return '';
  // 1. ひらがなを全角カタカナに変換
  let converted = str.replace(/[ぁ-ん]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
  // 2. 全角英数字を半角に変換
  converted = converted.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  // 3. 全角カタカナを半角カタカナに変換
  const reg = new RegExp('(' + Object.keys(KANA_MAP).join('|') + ')', 'g');
  converted = converted.replace(reg, (match) => KANA_MAP[match] || match);
  // 小文字英字も許可するため大文字に統一
  return converted.toUpperCase();
};

// ★ 追加: 半角数字・自動抽出ロジック
const formatToHalfWidthNumber = (str: string) => {
  if (!str) return '';
  // 全角数字を半角に変換してから、数字以外を消去
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
    accountNumber: '', accountName: '', accountNameKana: ''
  });

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
        });
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ★ 追加: フォーカスが外れた（onBlur）時に自動フォーマットする処理
  const handleBlurFormat = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'branchCode' || name === 'accountNumber') {
      formattedValue = formatToHalfWidthNumber(value); // 全角数字→半角数字（数字以外は消去）
    } else if (name === 'accountNameKana') {
      formattedValue = formatToHalfWidthKana(value); // ひらがな・全角カナ→半角カナ
    }

    // フォーマット後の値でStateを上書き
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
        alert(data.error || 'アップロードに失敗しました');
      }
    } catch (e) {
      alert('画像の処理中にエラーが発生しました');
    }
    setIsUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        alert('プロフィール情報を保存しました！');
        fetchData();
      } else {
        alert('保存に失敗しました');
      }
    } catch (err) { alert('通信エラーが発生しました'); }
    setIsSaving(false);
  };

  if (isLoading) return <div className="p-10 text-center text-slate-500">読み込み中...</div>;
  if (!profile) return <div className="p-10 text-center text-rose-500">プロフィール情報が見つかりません。</div>;

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
            <div><div className="text-[10px] font-bold text-slate-400 uppercase">システム権限</div><div className="inline-block mt-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">{profile.role?.name || '一般権限'}</div></div>
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
                    onBlur={handleBlurFormat} // ★ 離れたときに半角数字化
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
                  onBlur={handleBlurFormat} // ★ 離れたときに半角数字化
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
                  onBlur={handleBlurFormat} // ★ 離れたときに半角カナ化
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                  placeholder="ﾔﾏﾀﾞ ﾀﾛｳ" 
                />
                <p className="text-[10px] text-slate-400 mt-1">※ひらがな等で入力しても自動で半角カナに変換されます。</p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-200 flex justify-end">
              <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 flex items-center gap-2">
                {isSaving ? '保存中...' : <><i className="bi bi-cloud-arrow-up-fill"></i> すべての情報を保存する</>}
              </button>
            </div>
          </form>
        </div>
      </div>

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