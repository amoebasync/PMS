'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';

type FoldingType = { id: number; name: string; unitPrice: number; sortOrder: number; isActive: boolean };
type AreaRank = { id: number; name: string; postingUnitPrice: number; description: string | null };
type PeriodPrice = { id: number; minDays: number; maxDays: number | null; multiplier: number; label: string | null };
type FlyerSize = { id: number; name: string; printUnitPrice: number; basePriceAddon: number };

export default function PricingPage() {
  const { showToast, showConfirm } = useNotification();
  const [tab, setTab] = useState<'folding' | 'areaRank' | 'period' | 'size'>('folding');
  const [data, setData] = useState<{ foldingTypes: FoldingType[]; areaRanks: AreaRank[]; periodPrices: PeriodPrice[]; flyerSizes: FlyerSize[] }>({
    foldingTypes: [], areaRanks: [], periodPrices: [], flyerSizes: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/pricing');
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getDefaultForm = () => {
    if (tab === 'folding') return { name: '', unitPrice: 0, sortOrder: 0, isActive: true };
    if (tab === 'areaRank') return { name: '', postingUnitPrice: 5.0, description: '' };
    if (tab === 'period') return { minDays: 1, maxDays: '', multiplier: 1.0, label: '' };
    if (tab === 'size') return { printUnitPrice: 5.0, basePriceAddon: 0 };
    return {};
  };

  const openCreate = () => {
    setForm(getDefaultForm());
    setEditTarget(null);
    setShowModal('create');
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    if (tab === 'folding') setForm({ name: item.name, unitPrice: item.unitPrice, sortOrder: item.sortOrder, isActive: item.isActive });
    else if (tab === 'areaRank') setForm({ name: item.name, postingUnitPrice: item.postingUnitPrice, description: item.description || '' });
    else if (tab === 'period') setForm({ minDays: item.minDays, maxDays: item.maxDays ?? '', multiplier: item.multiplier, label: item.label || '' });
    else if (tab === 'size') setForm({ printUnitPrice: item.printUnitPrice, basePriceAddon: item.basePriceAddon });
    setShowModal('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (showModal === 'create') {
        await fetch('/api/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: tab, data: form })
        });
      } else if (showModal === 'edit' && editTarget) {
        await fetch('/api/pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: tab, id: editTarget.id, data: form })
        });
      }
      setShowModal(null);
      await fetchData();
    } catch (e) { showToast('エラーが発生しました', 'error'); }
    setIsSubmitting(false);
  };

  const handleDelete = async (item: any) => {
    if (!await showConfirm(`「${item.name || item.label || item.id}」を削除しますか？`, { variant: 'danger', confirmLabel: '削除する' })) return;
    try {
      await fetch(`/api/pricing?type=${tab}&id=${item.id}`, { method: 'DELETE' });
      await fetchData();
    } catch (e) { showToast('削除に失敗しました', 'error'); }
  };

  const tabs = [
    { key: 'folding', label: '折り加工', icon: 'bi-collection' },
    { key: 'areaRank', label: 'エリアランク', icon: 'bi-map' },
    { key: 'period', label: '配布期間乗数', icon: 'bi-calendar-range' },
    { key: 'size', label: 'サイズ単価', icon: 'bi-aspect-ratio' },
  ] as const;

  const canCreate = tab !== 'size';

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* タブ */}
        <div className="flex gap-1 mb-6 bg-slate-200 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-all ${tab === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              <i className={`bi ${t.icon}`}></i> {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-700">{tabs.find(t => t.key === tab)?.label}</h2>
            {canCreate && (
              <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 shadow-sm">
                <i className="bi bi-plus-lg"></i> 追加
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-slate-400">読み込み中...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {tab === 'folding' && (
                    <>
                      <th className="px-5 py-3 text-left font-bold text-slate-600">名前</th>
                      <th className="px-5 py-3 text-right font-bold text-slate-600">単価 (円/枚)</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-600">並び順</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-600">状態</th>
                      <th className="px-5 py-3"></th>
                    </>
                  )}
                  {tab === 'areaRank' && (
                    <>
                      <th className="px-5 py-3 text-left font-bold text-slate-600">ランク名</th>
                      <th className="px-5 py-3 text-right font-bold text-slate-600">配布単価 (円/枚)</th>
                      <th className="px-5 py-3 text-left font-bold text-slate-600">説明</th>
                      <th className="px-5 py-3"></th>
                    </>
                  )}
                  {tab === 'period' && (
                    <>
                      <th className="px-5 py-3 text-left font-bold text-slate-600">ラベル</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-600">最小日数</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-600">最大日数</th>
                      <th className="px-5 py-3 text-center font-bold text-slate-600">乗数</th>
                      <th className="px-5 py-3"></th>
                    </>
                  )}
                  {tab === 'size' && (
                    <>
                      <th className="px-5 py-3 text-left font-bold text-slate-600">サイズ名</th>
                      <th className="px-5 py-3 text-right font-bold text-slate-600">印刷基本単価</th>
                      <th className="px-5 py-3 text-right font-bold text-slate-600">追加料金</th>
                      <th className="px-5 py-3"></th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tab === 'folding' && data.foldingTypes.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-indigo-600">¥{item.unitPrice.toFixed(2)}</td>
                    <td className="px-5 py-3 text-center text-slate-500">{item.sortOrder}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                      <button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                    </td>
                  </tr>
                ))}
                {tab === 'areaRank' && data.areaRanks.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-indigo-600">¥{item.postingUnitPrice.toFixed(2)}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{item.description || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                      <button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                    </td>
                  </tr>
                ))}
                {tab === 'period' && data.periodPrices.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.label || '-'}</td>
                    <td className="px-5 py-3 text-center font-mono text-slate-700">{item.minDays}日〜</td>
                    <td className="px-5 py-3 text-center font-mono text-slate-700">{item.maxDays ? `${item.maxDays}日` : '上限なし'}</td>
                    <td className="px-5 py-3 text-center font-mono font-bold text-amber-600">×{item.multiplier.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 mr-3 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                      <button onClick={() => handleDelete(item)} className="text-rose-400 hover:text-rose-600 font-bold text-xs"><i className="bi bi-trash-fill"></i></button>
                    </td>
                  </tr>
                ))}
                {tab === 'size' && data.flyerSizes.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">{item.name}</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-indigo-600">¥{item.printUnitPrice.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-500">+¥{item.basePriceAddon.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(item)} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs"><i className="bi bi-pencil-fill"></i></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-slate-800 text-lg">
                {showModal === 'create' ? '追加' : '編集'} — {tabs.find(t => t.key === tab)?.label}
              </h2>
              <button onClick={() => setShowModal(null)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center">
                <i className="bi bi-x text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'folding' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">名前</label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例: 2つ折り" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">単価 (円/枚)</label>
                    <input type="number" step="0.1" required value={form.unitPrice ?? 0} onChange={e => setForm((p: any) => ({...p, unitPrice: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">並び順</label>
                    <input type="number" value={form.sortOrder ?? 0} onChange={e => setForm((p: any) => ({...p, sortOrder: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm((p: any) => ({...p, isActive: e.target.checked}))} className="w-4 h-4" />
                    <span className="text-sm font-bold text-slate-700">有効</span>
                  </label>
                </>
              )}
              {tab === 'areaRank' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">ランク名</label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例: A, 都心, 郊外" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">配布単価 (円/枚)</label>
                    <input type="number" step="0.1" required value={form.postingUnitPrice ?? 5} onChange={e => setForm((p: any) => ({...p, postingUnitPrice: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">説明</label>
                    <input type="text" value={form.description || ''} onChange={e => setForm((p: any) => ({...p, description: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例: 都内主要エリア" />
                  </div>
                </>
              )}
              {tab === 'period' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">ラベル</label>
                    <input type="text" value={form.label || ''} onChange={e => setForm((p: any) => ({...p, label: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例: 7日以内(特急)" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">最小日数</label>
                      <input type="number" required value={form.minDays ?? 1} onChange={e => setForm((p: any) => ({...p, minDays: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">最大日数 (空=上限なし)</label>
                      <input type="number" value={form.maxDays ?? ''} onChange={e => setForm((p: any) => ({...p, maxDays: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="空欄=上限なし" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">乗数 (例: 1.3 = 30%増し)</label>
                    <input type="number" step="0.01" required value={form.multiplier ?? 1} onChange={e => setForm((p: any) => ({...p, multiplier: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </>
              )}
              {tab === 'size' && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-600">
                    <i className="bi bi-aspect-ratio mr-1"></i> {editTarget?.name} の単価設定
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">印刷基本単価 (円/枚)</label>
                    <input type="number" step="0.1" required value={form.printUnitPrice ?? 5} onChange={e => setForm((p: any) => ({...p, printUnitPrice: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">追加料金 (円/枚)</label>
                    <input type="number" step="0.1" value={form.basePriceAddon ?? 0} onChange={e => setForm((p: any) => ({...p, basePriceAddon: e.target.value}))} className="w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(null)} className="flex-1 py-2.5 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm disabled:opacity-50">
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
