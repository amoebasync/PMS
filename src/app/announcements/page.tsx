'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '@/i18n';

// カテゴリ設定マップ（ラベルはi18nキーとして保持）
const CATEGORY_STYLE: Record<string, { labelKey: string; color: string; icon: string }> = {
  UPDATE:      { labelKey: 'cat_update',      color: 'indigo',  icon: 'bi-stars' },
  MAINTENANCE: { labelKey: 'cat_maintenance', color: 'rose',    icon: 'bi-tools' },
  IMPORTANT:   { labelKey: 'cat_important',   color: 'amber',   icon: 'bi-exclamation-triangle-fill' },
  NOTICE:      { labelKey: 'cat_notice',      color: 'emerald', icon: 'bi-bell-fill' },
  OTHER:       { labelKey: 'cat_other',       color: 'slate',   icon: 'bi-megaphone-fill' },
};

interface Announcement {
  id: number;
  title: string;
  content: string;
  category: string;
  createdById: number;
  createdBy: { lastNameJa: string; firstNameJa: string };
  createdAt: string;
  updatedAt: string;
}

const initialForm = { title: '', content: '', category: 'OTHER' };

// カテゴリバッジコンポーネント
const CategoryBadge = ({ category, t }: { category: string; t: (key: string) => string }) => {
  const style = CATEGORY_STYLE[category] || CATEGORY_STYLE.OTHER;
  const colorMap: Record<string, string> = {
    indigo:  'bg-indigo-50 text-indigo-600 border-indigo-200',
    rose:    'bg-rose-50 text-rose-600 border-rose-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    slate:   'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${colorMap[style.color] || colorMap.slate}`}>
      <i className={`bi ${style.icon}`}></i> {t(style.labelKey)}
    </span>
  );
};

export default function AnnouncementsPage() {
  const { t } = useTranslation('announcements');

  const CATEGORY_CONFIG = useMemo(() => {
    const result: Record<string, { label: string; color: string; icon: string }> = {};
    for (const [key, style] of Object.entries(CATEGORY_STYLE)) {
      result[key] = { label: t(style.labelKey), color: style.color, icon: style.icon };
    }
    return result;
  }, [t]);
  const CATEGORIES = useMemo(() => Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => ({ value, ...cfg })), [CATEGORY_CONFIG]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // モーダル状態
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // フォームデータ
  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profileRes, announcementsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/announcements'),
      ]);
      if (profileRes.ok) {
        const profile = await profileRes.json();
        const roles: string[] = profile?.roles?.map((r: any) => r.role?.code) || [];
        const primaryRoleCode: string = profile?.role?.code || '';
        setIsSuperAdmin(roles.includes('SUPER_ADMIN') || primaryRoleCode === 'SUPER_ADMIN');
      }
      if (announcementsRes.ok) {
        const data = await announcementsRes.json();
        setAnnouncements(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setCurrentId(null);
    setFormData(initialForm);
    setIsFormModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setCurrentId(a.id);
    setFormData({ title: a.title, content: a.content, category: a.category });
    setIsFormModalOpen(true);
  };

  const openDelete = (id: number) => {
    setCurrentId(id);
    setIsDeleteModalOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const method = currentId ? 'PUT' : 'POST';
      const url = currentId ? `/api/announcements/${currentId}` : '/api/announcements';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Save failed');
      setIsFormModalOpen(false);
      await fetchData();
    } catch {
      alert(t('save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  const del = async () => {
    if (!currentId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/announcements/${currentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setIsDeleteModalOpen(false);
      setCurrentId(null);
      await fetchData();
    } catch {
      alert(t('delete_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';
  const inputClass = 'w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-end border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <i className="bi bi-megaphone-fill text-indigo-600"></i> {t('page_title')}
            </h1>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="bi bi-shield-lock-fill text-2xl"></i>
          </div>
          <h3 className="font-bold text-rose-800 text-lg mb-2">{t('access_denied_title')}</h3>
          <p className="text-rose-600 text-sm">{t('access_denied_message')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      {/* アクションボタン */}
      <div className="flex justify-end mb-4">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all"
        >
          <i className="bi bi-plus-lg"></i> {t('btn_new_post')}
        </button>
      </div>

      {/* お知らせ一覧 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {announcements.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-megaphone text-2xl"></i>
            </div>
            <p className="text-slate-500 font-medium">{t('empty_title')}</p>
            <p className="text-slate-400 text-sm mt-1">{t('empty_message')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">{t('col_category')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('col_title')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">{t('col_author')}</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">{t('col_posted_date')}</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {announcements.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <CategoryBadge category={a.category} t={t} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800 text-sm">{a.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{a.content}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {a.createdBy.lastNameJa} {a.createdBy.firstNameJa}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                    {new Date(a.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(a)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                        title={t('edit')}
                      >
                        <i className="bi bi-pencil-square text-base"></i>
                      </button>
                      <button
                        onClick={() => openDelete(a.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title={t('delete')}
                      >
                        <i className="bi bi-trash3 text-base"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* 作成/編集モーダル */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* ヘッダー */}
            <div className="px-6 py-5 border-b border-slate-200 bg-white flex justify-between items-center rounded-t-2xl">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <i className="bi bi-megaphone-fill text-indigo-600"></i>
                {currentId ? t('modal_title_edit') : t('modal_title_create')}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* フォーム */}
            <form onSubmit={save} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                {/* カテゴリ */}
                <div>
                  <label className={labelClass}>{t('label_category')}</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={inputClass + ' cursor-pointer'}
                    required
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* タイトル */}
                <div>
                  <label className={labelClass}>{t('label_title')} <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={inputClass}
                    placeholder={t('placeholder_title')}
                    maxLength={255}
                    required
                  />
                </div>

                {/* 本文 */}
                <div>
                  <label className={labelClass}>{t('label_content')} <span className="text-rose-500">*</span></label>
                  <textarea
                    name="content"
                    value={formData.content}
                    onChange={handleInputChange}
                    className={inputClass + ' resize-none'}
                    rows={6}
                    placeholder={t('placeholder_content')}
                    required
                  />
                </div>
              </div>
            </form>

            {/* フッター */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={save}
                disabled={isSaving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all"
              >
                {isSaving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('saving')}</>
                ) : (
                  <><i className="bi bi-check-lg"></i> {currentId ? t('btn_save_changes') : t('btn_post')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200 mx-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
            </div>
            <h3 className="font-black text-slate-800 text-lg mb-2">{t('delete_confirm_title')}</h3>
            <p className="text-slate-500 text-sm mb-6">{t('delete_confirm_message')}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { setIsDeleteModalOpen(false); setCurrentId(null); }}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={del}
                disabled={isDeleting}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
              >
                {isDeleting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('deleting')}</>
                ) : (
                  <><i className="bi bi-trash3-fill"></i> {t('btn_delete')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
