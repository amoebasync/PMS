'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { useNotification } from '@/components/ui/NotificationProvider';

interface LineUser {
  id: number;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  isFollowing: boolean;
  distributorId: number | null;
  distributor: {
    id: number;
    name: string;
    staffId: string;
    avatarUrl: string | null;
  } | null;
}

interface Distributor {
  id: number;
  name: string;
  staffId: string;
  avatarUrl: string | null;
}

type Filter = 'all' | 'linked' | 'unlinked';

export default function LinePage() {
  const { t } = useTranslation('line');
  const { showToast, showConfirm } = useNotification();

  const [users, setUsers] = useState<LineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);

  // 配布員検索 (紐付けモーダル用)
  const [linkingUserId, setLinkingUserId] = useState<number | null>(null);
  const [distributorSearch, setDistributorSearch] = useState('');
  const [distributorResults, setDistributorResults] = useState<Distributor[]>([]);
  const [distributorLoading, setDistributorLoading] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // データ取得
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/line/users?${params}`);
      const data = await res.json();
      setUsers(data);
    } catch {
      showToast('データ取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // フォロワー取込
  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/line/import-followers', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(t('import_success', { imported: data.imported, total: data.total }), 'success');
        fetchUsers();
      } else {
        showToast(data.error || t('import_failed'), 'error');
      }
    } catch {
      showToast(t('import_failed'), 'error');
    } finally {
      setImporting(false);
    }
  };

  // 配布員検索
  const searchDistributors = useCallback(async (q: string) => {
    if (q.length < 1) { setDistributorResults([]); return; }
    setDistributorLoading(true);
    try {
      const res = await fetch(`/api/distributors?search=${encodeURIComponent(q)}&limit=10&activeOnly=true`);
      const data = await res.json();
      const list = (data.distributors || data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        staffId: d.staffId,
        avatarUrl: d.avatarUrl,
      }));
      setDistributorResults(list);
    } catch {
      setDistributorResults([]);
    } finally {
      setDistributorLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchDistributors(distributorSearch);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [distributorSearch, searchDistributors]);

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLinkingUserId(null);
        setDistributorSearch('');
        setDistributorResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 紐付け実行
  const handleLink = async (lineUserId: number, distributorId: number) => {
    try {
      const res = await fetch('/api/line/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId, distributorId }),
      });
      if (res.ok) {
        showToast(t('link_success'), 'success');
        setLinkingUserId(null);
        setDistributorSearch('');
        setDistributorResults([]);
        fetchUsers();
      } else {
        const data = await res.json();
        showToast(data.error, 'error');
      }
    } catch {
      showToast('エラーが発生しました', 'error');
    }
  };

  // 紐付け解除
  const handleUnlink = async (lineUserId: number) => {
    const ok = await showConfirm(t('unlink_confirm'));
    if (!ok) return;
    try {
      const res = await fetch('/api/line/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId }),
      });
      if (res.ok) {
        showToast(t('unlink_success'), 'success');
        fetchUsers();
      }
    } catch {
      showToast('エラーが発生しました', 'error');
    }
  };

  // 統計
  const total = users.length;
  const linked = users.filter(u => u.distributorId).length;
  const unlinked = total - linked;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-chat-dots-fill text-emerald-500" />
            {t('page_title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('stats_description', { total, linked })}
          </p>
        </div>
        <button
          onClick={handleImport}
          disabled={importing}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow transition disabled:opacity-50"
        >
          <i className={`bi ${importing ? 'bi-arrow-repeat animate-spin' : 'bi-cloud-download'}`} />
          {importing ? t('importing') : t('import_followers')}
        </button>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-slate-500">{t('total')}</div>
          <div className="text-2xl font-bold text-slate-800">{total}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-emerald-600">{t('linked')}</div>
          <div className="text-2xl font-bold text-emerald-600">{linked}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-amber-600">{t('unlinked')}</div>
          <div className="text-2xl font-bold text-amber-600">{unlinked}</div>
        </div>
      </div>

      {/* フィルタ＆検索 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex bg-white rounded-lg border shadow-sm overflow-hidden">
          {(['all', 'linked', 'unlinked'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium transition ${
                filter === f
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t(`filter_${f}`)}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <i className="bi bi-chat-dots text-4xl" />
            <p className="mt-2 text-sm">{t('no_users')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">{t('line_user')}</th>
                <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3">{t('linked_distributor')}</th>
                <th className="px-4 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  {/* LINE ユーザー */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.pictureUrl ? (
                        <img
                          src={user.pictureUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border-2 border-emerald-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <i className="bi bi-person-fill text-slate-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm text-slate-800">
                          {user.displayName || '(名前なし)'}
                        </div>
                        {user.statusMessage && (
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">
                            {user.statusMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* フォロー状態 */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      user.isFollowing
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {user.isFollowing ? t('following') : t('unfollowed')}
                    </span>
                  </td>

                  {/* 紐付け配布員 */}
                  <td className="px-4 py-3">
                    {user.distributor ? (
                      <div className="flex items-center gap-2">
                        {user.distributor.avatarUrl ? (
                          <img
                            src={user.distributor.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <i className="bi bi-bicycle text-indigo-500 text-xs" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-slate-800">{user.distributor.name}</div>
                          <div className="text-xs text-slate-400">{user.distributor.staffId}</div>
                        </div>
                      </div>
                    ) : linkingUserId === user.id ? (
                      /* 紐付け中: 配布員検索ドロップダウン */
                      <div ref={dropdownRef} className="relative">
                        <input
                          type="text"
                          autoFocus
                          value={distributorSearch}
                          onChange={e => setDistributorSearch(e.target.value)}
                          placeholder={t('search_distributor')}
                          className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {(distributorResults.length > 0 || distributorLoading) && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                            {distributorLoading ? (
                              <div className="px-3 py-2 text-xs text-slate-400">検索中...</div>
                            ) : (
                              distributorResults.map(d => (
                                <button
                                  key={d.id}
                                  onClick={() => handleLink(user.id, d.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 transition text-left"
                                >
                                  {d.avatarUrl ? (
                                    <img src={d.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                                      <i className="bi bi-bicycle text-indigo-500 text-[10px]" />
                                    </div>
                                  )}
                                  <span className="text-sm font-medium text-slate-800">{d.name}</span>
                                  <span className="text-xs text-slate-400 ml-auto">{d.staffId}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{t('not_linked')}</span>
                    )}
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-3 text-right">
                    {user.distributor ? (
                      <button
                        onClick={() => handleUnlink(user.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                      >
                        <i className="bi bi-x-circle mr-1" />
                        {t('unlink')}
                      </button>
                    ) : linkingUserId === user.id ? (
                      <button
                        onClick={() => { setLinkingUserId(null); setDistributorSearch(''); setDistributorResults([]); }}
                        className="text-xs text-slate-400 hover:text-slate-600 font-medium transition"
                      >
                        <i className="bi bi-x-lg mr-1" />
                        キャンセル
                      </button>
                    ) : (
                      <button
                        onClick={() => setLinkingUserId(user.id)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition"
                      >
                        <i className="bi bi-link-45deg mr-1" />
                        {t('link')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
