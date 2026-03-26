'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/useTranslation';
import { useNotification } from '@/components/ui/NotificationProvider';

type ManualPage = {
  id: number;
  language: string;
  pageNumber: number;
  manualVersion: string;
  imageUrl: string;
  createdAt: string;
};

type ManualVersion = {
  version: string;
  language: string;
  pages: ManualPage[];
  createdAt: string;
};

export default function TrainingManualUpload() {
  const { t } = useTranslation('settings');
  const { showToast, showConfirm } = useNotification();

  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [version, setVersion] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [versions, setVersions] = useState<ManualVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await fetch('/api/training-manuals');
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingVersions(false);
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name));
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (!selectedFiles.length || !language || !version.trim()) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    let successCount = 0;
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
      formData.append('version', version.trim());
      formData.append('pageNumber', String(i + 1));

      try {
        const res = await fetch('/api/training-manuals/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          successCount++;
        } else {
          const d = await res.json();
          showToast(d.error || 'アップロードに失敗しました', 'error');
        }
      } catch {
        showToast('アップロードに失敗しました', 'error');
      }
    }

    setUploading(false);
    setUploadProgress(null);

    if (successCount === selectedFiles.length) {
      showToast(`${successCount}ページをアップロードしました`, 'success');
      setSelectedFiles([]);
      setVersion('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchVersions();
    } else if (successCount > 0) {
      showToast(`${successCount}/${selectedFiles.length}ページをアップロードしました`, 'warning');
      await fetchVersions();
    }
  };

  const handleDelete = async (v: ManualVersion) => {
    const ok = await showConfirm(t('manual_delete_confirm'), { variant: 'danger', confirmLabel: '削除する' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/training-manuals?language=${v.language}&version=${encodeURIComponent(v.version)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(t('toast_deleted'), 'success');
        await fetchVersions();
      } else {
        const d = await res.json();
        showToast(d.error || t('toast_delete_error'), 'error');
      }
    } catch {
      showToast(t('toast_delete_error'), 'error');
    }
  };

  const canUpload = selectedFiles.length > 0 && version.trim() !== '' && !uploading;

  return (
    <div className="space-y-6">
      {/* アップロードセクション */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <i className="bi bi-cloud-upload text-indigo-500"></i>
            {t('manual_upload_title')}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            マニュアルのページ画像（PNG/JPG）を選択してアップロードします。ファイル名の順番でページ番号が割り当てられます。
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 言語選択 */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {t('manual_language')}
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value as 'ja' | 'en')}
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={uploading}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* バージョン */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {t('manual_version')}
              </label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="例: 1.0"
                className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={uploading}
              />
            </div>
          </div>

          {/* ファイル選択 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              {t('manual_select_files')}
            </label>
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
              {selectedFiles.length === 0 ? (
                <>
                  <i className="bi bi-images text-4xl text-slate-300 block mb-2"></i>
                  <p className="text-sm text-slate-500">クリックして画像ファイルを選択</p>
                  <p className="text-xs text-slate-400 mt-1">PNG / JPG / WebP 対応 · 複数ファイル可</p>
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle text-3xl text-emerald-500 block mb-2"></i>
                  <p className="text-sm font-bold text-slate-700">{selectedFiles.length}ファイル選択済み</p>
                  <ul className="mt-2 text-xs text-slate-500 space-y-0.5 max-h-24 overflow-y-auto">
                    {selectedFiles.map((f, i) => (
                      <li key={i}>{i + 1}. {f.name}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-indigo-500 mt-2 underline">クリックして変更</p>
                </>
              )}
            </div>
          </div>

          {/* 進捗 */}
          {uploadProgress && (
            <div className="bg-indigo-50 rounded-xl p-4 flex items-center gap-3">
              <i className="bi bi-hourglass-split animate-spin text-indigo-500"></i>
              <div className="flex-1">
                <p className="text-sm font-bold text-indigo-700">
                  {t('manual_upload_progress', { current: uploadProgress.current, total: uploadProgress.total })}
                </p>
                <div className="mt-1 bg-indigo-200 rounded-full h-1.5">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* アップロードボタン */}
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <i className="bi bi-hourglass-split animate-spin"></i>
                {t('manual_uploading')}
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload"></i>
                {t('manual_upload')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* アップロード済みマニュアル */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <i className="bi bi-book text-slate-500"></i>
            {t('manual_uploaded_list')}
          </h2>
          <button
            onClick={fetchVersions}
            className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
            disabled={loadingVersions}
          >
            <i className={`bi bi-arrow-clockwise ${loadingVersions ? 'animate-spin' : ''}`}></i>
            更新
          </button>
        </div>

        <div className="p-5">
          {loadingVersions ? (
            <div className="flex items-center justify-center h-20 text-slate-400">
              <i className="bi bi-hourglass-split animate-spin text-xl mr-2"></i>
              読み込み中...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <i className="bi bi-book text-4xl block mb-2"></i>
              <p className="text-sm">{t('manual_no_data')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((v, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{v.language === 'ja' ? '🇯🇵' : '🇺🇸'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">v{v.version}</span>
                          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                            {v.language === 'ja' ? '日本語' : 'English'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t('manual_pages', { count: v.pages.length })} ·{' '}
                          {new Date(v.createdAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(v)}
                      className="text-xs text-rose-500 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1"
                    >
                      <i className="bi bi-trash3"></i>
                      削除
                    </button>
                  </div>

                  {/* サムネイルグリッド */}
                  <div className="p-3">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {v.pages.map(page => (
                        <div key={page.id} className="relative group">
                          <div className="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                            <img
                              src={page.imageUrl}
                              alt={`Page ${page.pageNumber}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <p className="text-center text-xs text-slate-500 mt-1">{page.pageNumber}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
