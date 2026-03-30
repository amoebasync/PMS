'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { AnnouncementBody } from '@/components/staff/AnnouncementRenderer';

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
  titleEn: string | null;
  contentEn: string | null;
  imageUrls: string[];
  targetAll: boolean;
  targets: DistributorOption[];
  readCount: number;
  targetCount: number;
  reads: ReadInfo[];
  createdBy: string;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
  isDraft: boolean;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DistributorAnnouncementsPage() {
  const { t } = useTranslation('distributor-announcements');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<AnnouncementItem | null>(null);
  const [copyItem, setCopyItem] = useState<AnnouncementItem | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<AnnouncementItem | null>(null);

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

  const getStatusBadge = (a: AnnouncementItem) => {
    if (a.isDraft) {
      return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">{t('status_draft')}</span>;
    }
    if (a.sentAt) {
      return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">{t('status_sent')}</span>;
    }
    if (a.scheduledAt && new Date(a.scheduledAt) > new Date()) {
      const d = new Date(a.scheduledAt);
      const label = `${t('status_scheduled')} ${d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}`;
      return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">{label}</span>;
    }
    // Legacy data (no sentAt, no scheduledAt)
    return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">{t('status_sent')}</span>;
  };

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
            <div key={a.id} className={`bg-white rounded-xl shadow-sm border p-4 ${a.isDraft ? 'border-dashed border-slate-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => a.isDraft ? setEditItem(a) : setViewItem(a)}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{a.title}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      a.targetAll ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {a.targetAll ? t('target_all') : `${a.targetCount}${t('persons')}`}
                    </span>
                    {getStatusBadge(a)}
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
                </div>
                <div className="flex items-center gap-1">
                  {a.isDraft && (
                    <button
                      onClick={() => setEditItem(a)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                      title={t('btn_edit')}
                    >
                      <i className="bi bi-pencil text-sm" />
                    </button>
                  )}
                  {!a.isDraft && (
                    <button
                      onClick={() => setCopyItem(a)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                      title={t('btn_copy')}
                    >
                      <i className="bi bi-copy text-sm" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  >
                    <i className="bi bi-trash text-sm" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span>{a.createdBy}</span>
                <span>{new Date(a.createdAt).toLocaleDateString('ja-JP')}</span>
                {!a.isDraft && (
                  <span
                    className="cursor-pointer hover:text-indigo-600 transition-colors"
                    onClick={() => setDetailId(a.id)}
                  >
                    <i className="bi bi-eye mr-0.5" />
                    {t('read_status')}: {a.readCount}/{a.targetCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateEditModal
          t={t}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchAll(); }}
        />
      )}

      {/* Edit Modal */}
      {editItem && (
        <CreateEditModal
          t={t}
          editData={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); fetchAll(); }}
        />
      )}

      {/* Copy Modal */}
      {copyItem && (
        <CreateEditModal
          t={t}
          copyFrom={copyItem}
          onClose={() => setCopyItem(null)}
          onSaved={() => { setCopyItem(null); fetchAll(); }}
        />
      )}

      {/* View Modal (full content detail) */}
      {viewItem && (
        <ViewModal
          item={viewItem}
          t={t}
          onClose={() => setViewItem(null)}
          onShowReadStatus={(id) => { setViewItem(null); setDetailId(id); }}
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
/*  Markdown Toolbar                                                   */
/* ------------------------------------------------------------------ */

function MarkdownToolbar({ textareaRef, value, onChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  const insertFormat = (prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const newText = value.slice(0, start) + prefix + (selected || 'テキスト') + suffix + value.slice(end);
    onChange(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + (selected || 'テキスト').length);
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);

    if (selected) {
      // Apply prefix to each selected line
      const lines = selected.split('\n');
      const formatted = lines.map((line, i) => {
        if (!line.trim()) return line;
        if (prefix === '1. ') return `${i + 1}. ${line}`;
        return `${prefix}${line}`;
      }).join('\n');
      const newText = value.slice(0, start) + formatted + value.slice(end);
      onChange(newText);
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start, start + formatted.length); }, 0);
    } else {
      // Insert a single list item on new line
      const beforeCursor = value.slice(0, start);
      const needsNewLine = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const insert = (needsNewLine ? '\n' : '') + prefix;
      const newText = value.slice(0, start) + insert + value.slice(end);
      onChange(newText);
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start + insert.length, start + insert.length); }, 0);
    }
  };

  return (
    <div className="flex gap-1 mb-1">
      <button type="button" onClick={() => insertFormat('**', '**')} className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded transition-colors" title="太字">B</button>
      <button type="button" onClick={() => insertFormat('*', '*')} className="px-2 py-1 text-xs italic bg-slate-100 hover:bg-slate-200 rounded transition-colors" title="斜体">I</button>
      <button type="button" onClick={() => insertFormat('## ', '')} className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded transition-colors" title="見出し2">H2</button>
      <button type="button" onClick={() => insertFormat('### ', '')} className="px-2 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded transition-colors" title="見出し3">H3</button>
      <div className="w-px bg-slate-200 mx-0.5" />
      <button type="button" onClick={() => insertLinePrefix('- ')} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors" title="箇条書き"><i className="bi bi-list-ul" /></button>
      <button type="button" onClick={() => insertLinePrefix('1. ')} className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded transition-colors" title="番号付きリスト"><i className="bi bi-list-ol" /></button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  View Modal (full content detail)                                   */
/* ------------------------------------------------------------------ */

function ViewModal({ item, t, onClose, onShowReadStatus }: {
  item: AnnouncementItem;
  t: (k: string) => string;
  onClose: () => void;
  onShowReadStatus: (id: number) => void;
}) {
  const [viewLang, setViewLang] = useState<'ja' | 'en'>('ja');
  const hasEn = !!(item.titleEn || item.contentEn);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800 truncate flex-1 mr-2">
              {viewLang === 'en' && item.titleEn ? item.titleEn : item.title}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg" /></button>
          </div>
          {hasEn && (
            <div className="flex gap-1">
              <button
                onClick={() => setViewLang('ja')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  viewLang === 'ja'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                JP 日本語
              </button>
              <button
                onClick={() => setViewLang('en')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  viewLang === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                EN English
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Images full size */}
          {item.imageUrls.length > 0 && (
            <div className="space-y-3">
              {item.imageUrls.map((url, i) => (
                <img
                  key={i}
                  src={`/api/s3-proxy?key=${encodeURIComponent(url.replace(/^https:\/\/[^/]+\//, ''))}`}
                  alt=""
                  className="w-full rounded-lg border border-slate-200"
                />
              ))}
            </div>
          )}

          {/* Content based on selected language */}
          <div>
            <AnnouncementBody text={
              viewLang === 'en' && item.contentEn ? item.contentEn : item.content
            } />
          </div>

          {/* Meta info */}
          <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-3 border-t border-slate-100">
            <span>{item.createdBy}</span>
            <span>{new Date(item.createdAt).toLocaleDateString('ja-JP')}</span>
            <span className={`inline-flex px-2 py-0.5 rounded-md font-bold ${
              item.targetAll ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {item.targetAll ? t('target_all') : `${item.targetCount}${t('persons')}`}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
          <button
            onClick={() => onShowReadStatus(item.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <i className="bi bi-eye mr-1" />
            {t('read_status_title')} ({item.readCount}/{item.targetCount})
          </button>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('btn_cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create / Edit Modal                                                */
/* ------------------------------------------------------------------ */

function CreateEditModal({ t, editData, copyFrom, onClose, onSaved }: {
  t: (k: string, params?: Record<string, string | number>) => string;
  editData?: AnnouncementItem;
  copyFrom?: AnnouncementItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!editData;
  const source = editData || copyFrom;
  const [title, setTitle] = useState(source?.title || '');
  const [content, setContent] = useState(source?.content || '');
  const [titleEn, setTitleEn] = useState(source?.titleEn || '');
  const [contentEn, setContentEn] = useState(source?.contentEn || '');
  const [targetMode, setTargetMode] = useState<'all' | 'ja' | 'en' | 'select'>(
    source ? (source.targetAll ? 'all' : 'select') : 'all'
  );
  const [distributorIds, setDistributorIds] = useState<number[]>(
    source?.targets?.map(t => t.id) || []
  );
  const [selectedDistributors, setSelectedDistributors] = useState<Map<number, DistributorOption>>(
    new Map(source?.targets?.map(t => [t.id, t]) || [])
  );
  const [distributorSearch, setDistributorSearch] = useState('');
  const [distributorOptions, setDistributorOptions] = useState<DistributorOption[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(source?.imageUrls || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState(
    editData?.scheduledAt ? new Date(editData.scheduledAt).toISOString().split('T')[0] : ''
  );
  const [scheduledTime, setScheduledTime] = useState(
    editData?.scheduledAt ? new Date(editData.scheduledAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' }) : '09:00'
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const contentEnRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = async (asDraft: boolean) => {
    if (!asDraft && (!title.trim() || !content.trim())) return;
    setSaving(true);
    try {
      const payload = {
        title, content,
        titleEn: titleEn || undefined,
        contentEn: contentEn || undefined,
        imageUrls,
        targetAll: targetMode !== 'select',
        targetLanguage: targetMode === 'ja' || targetMode === 'en' ? targetMode : undefined,
        distributorIds: targetMode === 'select' ? distributorIds : [],
        scheduledAt: !asDraft && sendMode === 'scheduled' && scheduledDate
          ? new Date(`${scheduledDate}T${scheduledTime || '09:00'}`).toISOString()
          : undefined,
        isDraft: asDraft,
      };

      const url = isEdit ? `/api/distributor-announcements/${editData!.id}` : '/api/distributor-announcements';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const isScheduled = sendMode === 'scheduled';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-800">
            {isEdit ? t('edit_title') : copyFrom ? t('copy_title') : t('create_title')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Japanese section */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold">JP</span>
              日本語
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_title')}</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={t('placeholder_title')}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">{t('field_content')}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <MarkdownToolbar textareaRef={contentRef} value={content} onChange={setContent} />
                  <textarea
                    ref={contentRef}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={6}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder={t('placeholder_content')}
                  />
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 min-h-[160px] max-h-[200px] overflow-y-auto">
                  <p className="text-[10px] text-slate-400 mb-1">{t('preview')}</p>
                  {content ? <AnnouncementBody text={content} /> : <p className="text-xs text-slate-300 italic">{t('placeholder_content')}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* English section */}
          <div className="border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white text-[10px] font-bold">EN</span>
              English Version
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <MarkdownToolbar textareaRef={contentEnRef} value={contentEn} onChange={setContentEn} />
                  <textarea
                    ref={contentEnRef}
                    value={contentEn}
                    onChange={e => setContentEn(e.target.value)}
                    rows={6}
                    className="w-full border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Enter announcement content in English..."
                  />
                </div>
                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50 min-h-[160px] max-h-[200px] overflow-y-auto">
                  <p className="text-[10px] text-slate-400 mb-1">{t('preview')}</p>
                  {contentEn ? <AnnouncementBody text={contentEn} /> : <p className="text-xs text-slate-300 italic">Preview will appear here...</p>}
                </div>
              </div>
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
                日本語
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={targetMode === 'en'} onChange={() => setTargetMode('en')} className="accent-indigo-600" />
                English
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

          {/* Send Timing */}
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">{t('schedule_timing')}</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={sendMode === 'now'} onChange={() => setSendMode('now')} className="accent-indigo-600" />
                {t('send_now')}
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={sendMode === 'scheduled'} onChange={() => setSendMode('scheduled')} className="accent-indigo-600" />
                {t('send_scheduled')}
              </label>
            </div>
            {sendMode === 'scheduled' && (
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 mb-0.5 block">{t('field_date') || '日付'}</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 mb-0.5 block">{t('field_time') || '時間'}</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
            {t('btn_cancel')}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {saving ? '...' : t('btn_save_draft')}
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving || !title.trim() || !content.trim() || (isScheduled && !scheduledDate)}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
          >
            {saving ? t('sending') : (isScheduled ? t('btn_schedule') : t('btn_send'))}
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
