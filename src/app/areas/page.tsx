'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

type Area = {
  id: number;
  address_code: string;
  town_name: string;
  chome_name: string;
  door_to_door_count: number;
  posting_cap_raw: number;
  posting_cap_with_ng: number;
  multi_family_count: number;
  is_client_visible: number;
  area_rank_id: number | null;
  prefecture?: { id: number; name: string };
  city?: { id: number; name: string };
  areaRank?: { id: number; name: string; postingUnitPrice: number } | null;
};

type Prefecture = { id: number; name: string };
type City = { id: number; name: string; prefecture_id: number };
type AreaRank = { id: number; name: string; postingUnitPrice: number };

const LIMIT = 50;

// --- 編集モーダル ---
function EditModal({
  area,
  areaRanks,
  onClose,
  onSaved,
}: {
  area: Area;
  areaRanks: AreaRank[];
  onClose: () => void;
  onSaved: (updated: Area) => void;
}) {
  const { t } = useTranslation('areas');
  const { showToast } = useNotification();
  const [form, setForm] = useState({
    town_name: area.town_name,
    chome_name: area.chome_name,
    door_to_door_count: String(area.door_to_door_count),
    posting_cap_raw: String(area.posting_cap_raw),
    posting_cap_with_ng: String(area.posting_cap_with_ng),
    multi_family_count: String(area.multi_family_count),
    is_client_visible: String(area.is_client_visible),
    area_rank_id: area.area_rank_id ? String(area.area_rank_id) : '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/areas/${area.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          area_rank_id: form.area_rank_id || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      showToast(t('toast_update_success'), 'success');
      onSaved(updated);
    } catch {
      showToast(t('toast_update_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <p className="text-xs text-slate-500 font-mono">{area.address_code}</p>
            <h2 className="text-base font-bold text-slate-800">
              {area.prefecture?.name}{area.city?.name}　{area.town_name}{area.chome_name ? ` ${area.chome_name}` : ''}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 町名 / 丁目 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_town_name')}</label>
              <input
                name="town_name"
                value={form.town_name}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_chome_name')}</label>
              <input
                name="chome_name"
                value={form.chome_name}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* 世帯数 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_total_households')}</label>
              <input
                name="door_to_door_count"
                type="number"
                min="0"
                value={form.door_to_door_count}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_multi_family')}</label>
              <input
                name="multi_family_count"
                type="number"
                min="0"
                value={form.multi_family_count}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* 配布可能数 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_cap_raw')}</label>
              <input
                name="posting_cap_raw"
                type="number"
                min="0"
                value={form.posting_cap_raw}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_cap_ng')}</label>
              <input
                name="posting_cap_with_ng"
                type="number"
                min="0"
                value={form.posting_cap_with_ng}
                onChange={handleChange}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* エリアランク / 有効/無効 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('modal_area_rank')}</label>
              <select
                name="area_rank_id"
                value={form.area_rank_id}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="">{t('unset')}</option>
                {areaRanks.map(r => (
                  <option key={r.id} value={String(r.id)}>{r.name}{t('per_unit', { price: r.postingUnitPrice })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">{t('status')}</label>
              <select
                name="is_client_visible"
                value={form.is_client_visible}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="1">{t('modal_status_active')}</option>
                <option value="0">{t('modal_status_inactive')}</option>
              </select>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow transition-colors disabled:opacity-50"
            >
              {saving ? t('saving') : t('save_btn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- メインページ ---
export default function AreasPage() {
  const { t } = useTranslation('areas');
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areaRanks, setAreaRanks] = useState<AreaRank[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [prefectureId, setPrefectureId] = useState('');
  const [cityId, setCityId] = useState('');
  const [isVisible, setIsVisible] = useState('');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [editTarget, setEditTarget] = useState<Area | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初期マスタデータ取得
  useEffect(() => {
    Promise.all([
      fetch('/api/prefectures').then(r => r.json()),
      fetch('/api/area-ranks').then(r => r.json()),
    ]).then(([prefs, ranks]) => {
      setPrefectures(Array.isArray(prefs) ? prefs : []);
      setAreaRanks(Array.isArray(ranks) ? ranks : []);
    }).catch(() => {});
  }, []);

  // 都道府県変更 → 市区町村を再取得
  useEffect(() => {
    setCityId('');
    if (!prefectureId) { setCities([]); return; }
    fetch(`/api/cities?prefectureId=${prefectureId}`)
      .then(r => r.json())
      .then(data => setCities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [prefectureId]);

  const buildQuery = useCallback((overrides: Record<string, unknown> = {}) => {
    const params = new URLSearchParams();
    const q = (overrides.searchQuery ?? searchQuery) as string;
    const pref = (overrides.prefectureId ?? prefectureId) as string;
    const city = (overrides.cityId ?? cityId) as string;
    const vis = (overrides.isVisible ?? isVisible) as string;
    const p = (overrides.page ?? page) as number;
    if (q) params.set('search', q);
    if (pref) params.set('prefectureId', pref);
    if (city) params.set('cityId', city);
    if (vis !== '') params.set('isVisible', vis);
    params.set('page', String(p));
    params.set('limit', String(LIMIT));
    return params.toString();
  }, [searchQuery, prefectureId, cityId, isVisible, page]);

  const fetchAreas = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/areas?${query}`);
      const json = await res.json();
      setAreas(json.data || []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err) {
      console.error('データ取得失敗:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas(buildQuery({ page: 1 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchAreas(buildQuery({ searchQuery: value, page: 1 }));
    }, 400);
  };

  const handleFilterChange = (overrides: Record<string, unknown>) => {
    const merged = { page: 1, ...overrides };
    setPage(1);
    if ('prefectureId' in overrides) setPrefectureId(overrides.prefectureId as string);
    if ('cityId' in overrides) setCityId(overrides.cityId as string);
    if ('isVisible' in overrides) setIsVisible(overrides.isVisible as string);
    fetchAreas(buildQuery(merged));
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchAreas(buildQuery({ page: newPage }));
  };

  // 編集保存後にリスト上のデータを即時更新
  const handleSaved = (updated: Area) => {
    setAreas(prev => prev.map(a => a.id === updated.id ? updated : a));
    setEditTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-4">
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all">
          <i className="bi bi-plus-lg"></i> {t('btn_new')}
        </button>
      </div>

      {/* フィルターバー */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        {/* キーワード（複合住所検索対応） */}
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('search_keyword')}</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* 都道府県 */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_prefecture')}</label>
          <select
            value={prefectureId}
            onChange={(e) => {
              setPrefectureId(e.target.value);
              handleFilterChange({ prefectureId: e.target.value, cityId: '' });
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[130px] bg-white cursor-pointer"
          >
            <option value="">{t('filter_all')}</option>
            {prefectures.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* 市区町村（都道府県選択後に有効化） */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('filter_city')}</label>
          <select
            value={cityId}
            onChange={(e) => handleFilterChange({ cityId: e.target.value })}
            disabled={!prefectureId}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[150px] bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{t('filter_all')}</option>
            {cities.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 有効/無効 */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">{t('status')}</label>
          <select
            value={isVisible}
            onChange={(e) => handleFilterChange({ isVisible: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[120px] bg-white cursor-pointer"
          >
            <option value="">{t('filter_all')}</option>
            <option value="1">{t('filter_active_only')}</option>
            <option value="0">{t('filter_inactive_only')}</option>
          </select>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">{t('table_code')}</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">{t('table_prefecture')}</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">{t('table_city')}</th>
              <th className="px-4 py-3 font-semibold">{t('table_town_chome')}</th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">{t('table_total_households')}</th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-indigo-600">{t('table_distribution_cap')}</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">{t('table_rank')}</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">{t('table_state')}</th>
              <th className="px-4 py-3 font-semibold text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : areas.length === 0 ? (
              <EmptyState
                icon="bi-map"
                title={t('empty_title')}
                description={t('empty_description')}
              />
            ) : areas.map((area) => (
              <tr key={area.id} className={`hover:bg-slate-50 transition-colors ${area.is_client_visible === 0 ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-slate-500 text-xs">{area.address_code}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{area.prefecture?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{area.city?.name ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {area.town_name}{area.chome_name ? `　${area.chome_name}` : ''}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{area.door_to_door_count.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-bold text-indigo-600">{area.posting_cap_with_ng.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {area.areaRank ? (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                      {area.areaRank.name}
                    </span>
                  ) : <span className="text-slate-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {area.is_client_visible === 1 ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{t('active')}</span>
                  ) : (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{t('inactive')}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setEditTarget(area)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50"
                    title={t('edit')}
                  >
                    <i className="bi bi-pencil-square"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={handlePageChange}
        />
      </div>

      {/* 編集モーダル */}
      {editTarget && (
        <EditModal
          area={editTarget}
          areaRanks={areaRanks}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
