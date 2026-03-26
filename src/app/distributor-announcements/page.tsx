'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DistributorOption {
  id: number;
  name: string;
  staffId: string;
}

interface ReadInfo {
  distributorId: number;
  name: string;
  staffId: string;
  readAt: string;
}

interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  imageUrls: string[];
  targetAll: boolean;
  targets: DistributorOption[];
  readCount: number;
  targetCount: number;
  reads: ReadInfo[];
  createdBy: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DistributorAnnouncementsPage() {
  const { t } = useTranslation('distributor-announcements');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/distributor-announcements');
      if (res.ok) setAnnouncements(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirm_delete'))) return;
    await fetch(`/api/distributor-announcements/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const detailItem = announcements.find(a => a.id === detailId);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
        <span className="text-xs text-slate-500">{t('total')}: {announcements.length}{t('items')}</span>
        <button
          onClick={() => setShowCreate(true)}
          className="md:ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
        >
          <i className="bi bi-plus-lg mr-1" />
          {t('btn_create')}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-12 text-center text-slate-400">
          <i className="bi bi-megaphone text-3xl block mb-2" />
          {t('no_announcements')}
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{a.title}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      a.targetAll ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {a.targetAll ? t('target_all') : `${a.targetCount}${t('persons')}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-2">{a.content}</p>
                  {a.imageUrls.length > 0 && (
                    <div className="flex gap-1 mb-2">
                      {a.imageUrls.map((url, i) => (
                        <div key={i} className="w-10 h-10 rounded bg-slate-100 overflow-hidden">
                          <img src={`/api/s3-proxy?key=${encodeURIComponent(url.replace(/^https:\/\/[^/]+\//, ''))}`} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>{a.createdBy}</span>
                    <span>{new Date(a.createdAt).toLocaleDateString('ja-JP')}</span>
                    <span
                      className="cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => setDetailId(a.id)}
                    >
                      <i className="bi bi-eye mr-0.5" />
                      {t('read_status')}: {a.readCount}/{a.targetCount}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                >
                  <i className="bi bi-trash text-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          t={t}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchAll(); }}
        />
      )}

      {/* Detail Modal (read status) */}
      {detailItem && (
        <DetailModal
          item={detailItem}
          t={t}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Modal                                                       */
/* ------------------------------------------------------------------ */

function CreateModal({ t, onClose, onCreated }: {
  t: (k: string) => string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [contentEn, setContentEn] = useState('');
  const [targetMode, setTargetMode] = useState<'all' | 'ja' | 'en' | 'select'>('all');
  const [distributorIds, setDistributorIds] = useState<number[]>([]);
  const [selectedDistributors, setSelectedDistributors] = useState<Map<number, DistributorOption>>(new Map());
  const [distributorSearch, setDistributorSearch] = useState('');
  const [distributorOptions, setDistributorOptions] = useState<DistributorOption[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Search distributors
  useEffect(() => {
    if (targetMode !== 'select' || !distributorSearch.trim()) {
      setDistributorOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/distributors?search=${encodeURIComponent(distributorSearch)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.distributors || data || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            staffId: d.staffId || '',
          }));
          setDistributorOptions(list);
        }
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [distributorSearch, targetMode]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/distributor-announcements/images', { method: 'POST', body: form });
      if (res.ok) {
        const { url } = await res.json();
        setImageUrls(prev => [...prev, url]);
      }
    } catch (e) { console.error(e); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/distributor-announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, content,
          titleEn: titleEn || undefined,
          contentEn: contentEn || undefined,
          imageUrls,
          targetAll: targetMode !== 'select',
          targetLanguage: targetMode === 'ja' || targetMode === 'en' ? targetMode : undefined,
          distributorIds: targetMode === 'select' ? distributorIds : [],
        }),
      });
      if (res.ok) onCreated();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">{t('create_title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_title')}</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder={t('placeholder_title')}
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_content')} (日本語)</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder={t('placeholder_content')}
            />
          </div>

          {/* English fields */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
              <i className="bi bi-translate" /> English Version
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_title')} (English)</label>
              <input
                value={titleEn}
                onChange={e => setTitleEn(e.target.value)}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter announcement title in English..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_content')} (English)</label>
              <textarea
                value={contentEn}
                onChange={e => setContentEn(e.target.value)}
                rows={4}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Enter announcement content in English..."
              />
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_images')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                  <img src={`/api/s3-proxy?key=${encodeURIComponent(url.replace(/^https:\/\/[^/]+\//, ''))}`} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 text-[10px] flex items-center justify-center rounded-bl"
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
              >
                {uploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" /> : <i className="bi bi-plus-lg text-lg" />}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>

          {/* Target */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_target')}</label>
            <div className="flex flex-wrap gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={targetMode === 'all'} onChange={() => setTargetMode('all')} className="accent-indigo-600" />
                {t('target_all')}
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={targetMode === 'ja'} onChange={() => setTargetMode('ja')} className="accent-indigo-600" />
                🇯🇵 日本語
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={targetMode === 'en'} onChange={() => setTargetMode('en')} className="accent-indigo-600" />
                🇬🇧 English
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={targetMode === 'select'} onChange={() => setTargetMode('select')} className="accent-indigo-600" />
                {t('target_select')}
              </label>
            </div>
            {targetMode === 'select' && (
              <div>
                <input
                  value={distributorSearch}
                  onChange={e => setDistributorSearch(e.target.value)}
                  placeholder={t('search_distributor')}
                  className="w-full border border-slate-300 rounded-lg text-xs px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none mb-2"
                />
                {distributorOptions.length > 0 && (
                  <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto mb-2">
                    {distributorOptions.filter(d => !distributorIds.includes(d.id)).map(d => (
                      <div
                        key={d.id}
                        onClick={() => {
                          setDistributorIds(prev => [...prev, d.id]);
                          setSelectedDistributors(prev => new Map(prev).set(d.id, d));
                          setDistributorSearch('');
                        }}
                        className="px-3 py-1.5 text-xs hover:bg-indigo-50 cursor-pointer flex justify-between"
                      >
                        <span>{d.name}</span>
                        <span className="text-slate-400">{d.staffId}</span>
                      </div>
                    ))}
                  </div>
                )}
                {distributorIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {distributorIds.map(id => {
                      const d = selectedDistributors.get(id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold">
                          {d?.name || `ID:${id}`}{d?.staffId ? ` (${d.staffId})` : ''}
                          <button onClick={() => { setDistributorIds(prev => prev.filter(x => x !== id)); setSelectedDistributors(prev => { const m = new Map(prev); m.delete(id); return m; }); }} className="hover:text-red-500">
                            <i className="bi bi-x" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('btn_cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !content.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
          >
            {saving ? t('sending') : t('btn_send')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Modal (Read Status)                                         */
/* ------------------------------------------------------------------ */

function DetailModal({ item, t, onClose }: {
  item: AnnouncementItem;
  t: (k: string) => string;
  onClose: () => void;
}) {
  const readIds = new Set(item.reads.map(r => r.distributorId));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">{t('read_status_title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg" /></button>
        </div>
        <div className="p-5">
          <div className="mb-3 text-xs text-slate-500">
            {item.title} — {item.readCount}/{item.targetCount} {t('read_count_label')}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${item.targetCount > 0 ? (item.readCount / item.targetCount) * 100 : 0}%` }}
            />
          </div>

          {/* Read list */}
          <div className="space-y-1">
            {item.reads.map(r => (
              <div key={r.distributorId} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <i className="bi bi-check-circle-fill text-emerald-500 text-xs" />
                  <span className="text-xs font-medium text-slate-700">{r.name}</span>
                  <span className="text-[10px] text-slate-400">{r.staffId}</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(r.readAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {/* Unread targets (only for targeted announcements) */}
            {!item.targetAll && item.targets.filter(tgt => !readIds.has(tgt.id)).map(tgt => (
              <div key={tgt.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg">
                <i className="bi bi-circle text-slate-300 text-xs" />
                <span className="text-xs text-slate-400">{tgt.name}</span>
                <span className="text-[10px] text-slate-300">{tgt.staffId}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
