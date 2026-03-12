'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';

type ItemData = {
  id: number;
  flyerName: string | null;
  flyerCode: string | null;
  plannedCount: number | null;
  actualCount: number | null;
  billingUnitPrice: number | null;
  orderId: number | null;
  scheduleId: number;
  schedule: {
    date: string;
    branch: { nameJa: string } | null;
    distributor: { name: string; staffId: string } | null;
  };
  customer: { customerCode: string } | null;
};

type OrderData = {
  id: number;
  orderNo: string;
  title: string | null;
  orderDate: string;
};

type PriceEdit = {
  unitPrice: number | null;
  source: string;
  changed: boolean;
};

type TabType = 'all' | 'unpriced' | 'priced';

export default function PartnerPricesPage() {
  const { t } = useTranslation('partner-prices');
  const params = useParams();
  const router = useRouter();
  const partnerId = Number(params.id);

  const [items, setItems] = useState<ItemData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('unpriced');
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 各アイテムの編集状態: itemId → PriceEdit
  const [priceEdits, setPriceEdits] = useState<Map<number, PriceEdit>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, partnerRes] = await Promise.all([
        fetch(`/api/partners/${partnerId}/unpriced-items`),
        fetch(`/api/partners/${partnerId}`),
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
        setOrders(data.orders || []);

        // 初期化: 既存の billingUnitPrice を priceEdits にセット
        const edits = new Map<number, PriceEdit>();
        for (const item of data.items || []) {
          edits.set(item.id, {
            unitPrice: item.billingUnitPrice,
            source: item.billingUnitPrice != null ? 'existing' : 'not_found',
            changed: false,
          });
        }
        setPriceEdits(edits);
      }

      if (partnerRes.ok) {
        const pData = await partnerRes.json();
        setPartnerName(pData.name || '');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [partnerId]);

  useEffect(() => {
    if (partnerId) fetchData();
  }, [partnerId, fetchData]);

  // フィルタリング
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const edit = priceEdits.get(item.id);
      const hasPrice = edit?.unitPrice != null;
      if (tab === 'unpriced') return !hasPrice;
      if (tab === 'priced') return hasPrice;
      return true;
    });
  }, [items, tab, priceEdits]);

  // チラシ名のユニーク一覧（自動取得用）
  const uniqueFlyers = useMemo(() => {
    const map = new Map<string, { flyerName: string; flyerCode: string | null; customerCode: string | null }>();
    for (const item of items) {
      if (!item.flyerName) continue;
      const edit = priceEdits.get(item.id);
      if (edit?.unitPrice != null) continue; // 既に単価あり
      const key = `${item.flyerName}||${item.flyerCode || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          flyerName: item.flyerName,
          flyerCode: item.flyerCode,
          customerCode: item.customer?.customerCode || null,
        });
      }
    }
    return Array.from(map.values());
  }, [items, priceEdits]);

  // サマリー
  const summary = useMemo(() => {
    let total = 0;
    let priced = 0;
    let unpriced = 0;
    let totalAmount = 0;

    for (const item of items) {
      total++;
      const edit = priceEdits.get(item.id);
      if (edit?.unitPrice != null) {
        priced++;
        const count = item.actualCount || item.plannedCount || 0;
        totalAmount += Math.floor(edit.unitPrice * count);
      } else {
        unpriced++;
      }
    }
    return { total, priced, unpriced, totalAmount };
  }, [items, priceEdits]);

  // 単価自動取得
  const handleAutoResolve = async () => {
    if (uniqueFlyers.length === 0) return;
    setResolving(true);
    setMessage('');

    try {
      const res = await fetch(`/api/partners/${partnerId}/resolve-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: uniqueFlyers }),
      });

      if (!res.ok) {
        setMessage('❌ 自動取得に失敗しました');
        setResolving(false);
        return;
      }

      const data = await res.json();
      const resultMap = new Map<string, { unitPrice: number | null; source: string }>();
      for (const r of data.results || []) {
        const key = `${r.flyerName}||${r.flyerCode || ''}`;
        resultMap.set(key, { unitPrice: r.unitPrice, source: r.source });
      }

      // priceEditsに反映
      const newEdits = new Map(priceEdits);
      let resolved = 0;
      for (const item of items) {
        if (!item.flyerName) continue;
        const existing = newEdits.get(item.id);
        if (existing?.unitPrice != null) continue;

        const key = `${item.flyerName}||${item.flyerCode || ''}`;
        const result = resultMap.get(key);
        if (result?.unitPrice != null) {
          newEdits.set(item.id, {
            unitPrice: result.unitPrice,
            source: result.source,
            changed: true,
          });
          resolved++;
        }
      }
      setPriceEdits(newEdits);

      const total = uniqueFlyers.length;
      setMessage(`✨ ${t('resolve_complete', { resolved: String(resolved), total: String(total) })}`);
    } catch {
      setMessage('❌ 自動取得に失敗しました');
    }
    setResolving(false);
  };

  // 手動単価入力
  const handlePriceChange = (itemId: number, value: string) => {
    const newEdits = new Map(priceEdits);
    const numVal = value === '' ? null : parseFloat(value);
    newEdits.set(itemId, {
      unitPrice: numVal != null && !isNaN(numVal) ? numVal : null,
      source: 'manual',
      changed: true,
    });
    setPriceEdits(newEdits);
  };

  // 同じチラシ名+コードの他アイテムにも単価を一括適用
  const applyToSameFlyer = (item: ItemData, unitPrice: number) => {
    const newEdits = new Map(priceEdits);
    for (const other of items) {
      if (other.flyerName === item.flyerName && other.flyerCode === item.flyerCode) {
        const existing = newEdits.get(other.id);
        if (!existing?.unitPrice) {
          newEdits.set(other.id, { unitPrice, source: 'manual', changed: true });
        }
      }
    }
    setPriceEdits(newEdits);
  };

  // 保存
  const handleSave = async () => {
    const updates: { itemId: number; billingUnitPrice: number | null }[] = [];
    for (const [itemId, edit] of priceEdits) {
      if (edit.changed) {
        updates.push({ itemId, billingUnitPrice: edit.unitPrice });
      }
    }

    if (updates.length === 0) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(`/api/partners/${partnerId}/update-item-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`✨ ${t('save_success', { count: String(data.updatedCount) })}`);
        // changed フラグをリセット
        const newEdits = new Map(priceEdits);
        for (const [id, edit] of newEdits) {
          if (edit.changed) newEdits.set(id, { ...edit, changed: false });
        }
        setPriceEdits(newEdits);
      } else {
        setMessage(`❌ ${t('save_error')}`);
      }
    } catch {
      setMessage(`❌ ${t('save_error')}`);
    }
    setSaving(false);
  };

  const changedCount = useMemo(() => {
    let count = 0;
    for (const edit of priceEdits.values()) {
      if (edit.changed) count++;
    }
    return count;
  }, [priceEdits]);

  const sourceLabel = (source: string) => {
    const key = `source_${source}`;
    return t(key) || source;
  };

  const sourceColor = (source: string) => {
    switch (source) {
      case 'price_master_exact': return 'text-emerald-600 bg-emerald-50';
      case 'price_master_customer': return 'text-emerald-600 bg-emerald-50';
      case 'price_master_name': return 'text-teal-600 bg-teal-50';
      case 'external_api': return 'text-blue-600 bg-blue-50';
      case 'manual': return 'text-purple-600 bg-purple-50';
      case 'existing': return 'text-slate-600 bg-slate-50';
      default: return 'text-orange-600 bg-orange-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="bi bi-arrow-repeat animate-spin text-2xl text-slate-400 mr-2"></i>
        <span className="text-slate-500">{t('loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="border-b pb-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => router.push('/partners')} className="text-slate-400 hover:text-slate-600">
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">
            <i className="bi bi-currency-yen text-purple-600 mr-2"></i>
            {t('page_title')}
          </h1>
        </div>
        <p className="text-slate-500 text-sm">{partnerName} — {t('page_description')}</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-slate-500 font-semibold">{t('summary_total')}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{summary.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-emerald-600 font-semibold">{t('summary_priced')}</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.priced.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-orange-600 font-semibold">{t('summary_unpriced')}</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{summary.unpriced.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-slate-500 font-semibold">{t('summary_total_amount')}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">¥{summary.totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* アクションバー */}
      <div className="flex flex-wrap items-center gap-3">
        {/* タブ */}
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {(['all', 'unpriced', 'priced'] as TabType[]).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                tab === tabKey ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t(`tab_${tabKey}`)}
              <span className="ml-1 text-xs opacity-70">
                ({tabKey === 'all' ? summary.total : tabKey === 'unpriced' ? summary.unpriced : summary.priced})
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1"></div>

        {/* 自動取得ボタン */}
        <button
          onClick={handleAutoResolve}
          disabled={resolving || uniqueFlyers.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <i className={`bi ${resolving ? 'bi-arrow-repeat animate-spin' : 'bi-magic'} mr-1.5`}></i>
          {resolving ? t('btn_resolving') : t('btn_auto_resolve')}
          {!resolving && uniqueFlyers.length > 0 && (
            <span className="ml-1 opacity-70">({uniqueFlyers.length})</span>
          )}
        </button>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={saving || changedCount === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          <i className={`bi ${saving ? 'bi-arrow-repeat animate-spin' : 'bi-check-lg'} mr-1.5`}></i>
          {saving ? t('btn_saving') : t('btn_save')}
          {changedCount > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded">{changedCount}</span>}
        </button>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-semibold ${
          message.includes('❌') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {message}
        </div>
      )}

      {/* テーブル */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-slate-400">
          <i className="bi bi-check-circle text-4xl block mb-2"></i>
          {tab === 'unpriced' ? t('all_priced') : t('no_items')}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 text-xs">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t('th_date')}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t('th_branch')}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t('th_distributor')}</th>
                  <th className="px-3 py-2.5">{t('th_flyer_name')}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t('th_flyer_code')}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t('th_planned')}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t('th_actual')}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap" style={{ minWidth: 120 }}>{t('th_unit_price')}</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">{t('th_source')}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t('th_amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const edit = priceEdits.get(item.id);
                  const count = item.actualCount || item.plannedCount || 0;
                  const amount = edit?.unitPrice != null ? Math.floor(edit.unitPrice * count) : null;
                  const dateStr = item.schedule.date
                    ? new Date(item.schedule.date).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' })
                    : '-';

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 ${edit?.changed ? 'bg-yellow-50/50' : ''}`}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600 tabular-nums">{dateStr}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.schedule.branch?.nameJa || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {item.schedule.distributor ? (
                          <span>{item.schedule.distributor.name} <span className="text-slate-400">({item.schedule.distributor.staffId})</span></span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate font-semibold" title={item.flyerName || ''}>{item.flyerName || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500 font-mono">{item.flyerCode || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.plannedCount?.toLocaleString() || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{item.actualCount?.toLocaleString() || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={edit?.unitPrice ?? ''}
                            onChange={e => handlePriceChange(item.id, e.target.value)}
                            placeholder={t('price_placeholder')}
                            className={`w-20 text-right px-2 py-1 border rounded text-sm tabular-nums ${
                              edit?.changed ? 'border-yellow-400 bg-yellow-50' : 'border-slate-200'
                            } focus:ring-1 focus:ring-purple-400 focus:border-purple-400`}
                          />
                          {edit?.unitPrice != null && (
                            <button
                              onClick={() => applyToSameFlyer(item, edit.unitPrice!)}
                              title="同じチラシに一括適用"
                              className="text-slate-400 hover:text-purple-600 transition-colors"
                            >
                              <i className="bi bi-copy text-xs"></i>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${sourceColor(edit?.source || 'not_found')}`}>
                          {sourceLabel(edit?.source || 'not_found')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {amount != null ? `¥${amount.toLocaleString()}` : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
