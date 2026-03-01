'use client';

import React, { useState, useEffect } from 'react';

type JobCategory = {
  id: number;
  nameJa: string;
  nameEn: string | null;
};

type DefaultSlot = {
  id: number | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  isEnabled: boolean;
  jobCategoryIds: number[];
};

const DAY_LABELS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const INTERVAL_OPTIONS = [
  { value: 15, label: '15分' },
  { value: 30, label: '30分' },
  { value: 45, label: '45分' },
  { value: 60, label: '60分' },
  { value: 90, label: '90分' },
  { value: 120, label: '120分' },
];

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function DefaultSlotSettings() {
  const [slots, setSlots] = useState<DefaultSlot[]>([]);
  const [jobCategories, setJobCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(getTomorrowStr());

  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/settings/default-slots');
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchJobCategories = async () => {
    try {
      const res = await fetch('/api/job-categories');
      if (res.ok) {
        const data = await res.json();
        setJobCategories(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSlots();
    fetchJobCategories();
  }, []);

  const handleSlotChange = (dayOfWeek: number, field: keyof DefaultSlot, value: string | boolean | number | number[]) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
      )
    );
  };

  const handleToggleJobCategory = (dayOfWeek: number, jcId: number) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.dayOfWeek !== dayOfWeek) return s;
        const ids = s.jobCategoryIds.includes(jcId)
          ? s.jobCategoryIds.filter((id) => id !== jcId)
          : [...s.jobCategoryIds, jcId];
        return { ...s, jobCategoryIds: ids };
      })
    );
  };

  const handleCopyToOthers = (fromDay: number) => {
    const source = slots.find((s) => s.dayOfWeek === fromDay);
    if (!source) return;

    setSlots((prev) =>
      prev.map((s) =>
        s.dayOfWeek === fromDay
          ? s
          : {
              ...s,
              startTime: source.startTime,
              endTime: source.endTime,
              intervalMinutes: source.intervalMinutes,
              isEnabled: source.isEnabled,
              jobCategoryIds: [...source.jobCategoryIds],
            }
      )
    );
    setCopyFromDay(fromDay);
    setTimeout(() => setCopyFromDay(null), 2000);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/settings/default-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, effectiveFrom: effectiveFrom || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        fetchSlots();

        if (data.cleanup) {
          const { deleted, created } = data.cleanup as { deleted: number; created: number; effectiveFrom: string };
          setSaveResult({
            type: 'success',
            message: `設定を保存しました。${effectiveFrom} 以降のスロットを更新：${deleted}件削除・${created}件追加`,
          });
        } else {
          setSaveResult({ type: 'success', message: '設定を保存しました（スロットの再調整なし）' });
        }
      } else {
        setSaveResult({ type: 'error', message: `エラー: ${data.error || '保存に失敗しました'}` });
      }
    } catch (e) {
      setSaveResult({ type: 'error', message: 'エラー: 保存に失敗しました' });
      console.error(e);
    }
    setSaving(false);
    setTimeout(() => setSaveResult(null), 6000);
  };

  const handleGenerate = async () => {
    if (!confirm('デフォルト設定に基づいて、今後2週間分の面接スロットを自動生成します。よろしいですか？')) {
      return;
    }

    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch('/api/interview-slots/generate', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setGenerateResult(`${data.created}件のスロットを作成しました（${data.skipped}件は既存のためスキップ）`);
      } else {
        setGenerateResult(`エラー: ${data.error || '生成に失敗しました'}`);
      }
    } catch (e) {
      setGenerateResult('エラー: スロット生成に失敗しました');
      console.error(e);
    }
    setGenerating(false);
    setTimeout(() => setGenerateResult(null), 5000);
  };

  // スロットのプレビュー数を計算
  const calcSlotCount = (slot: DefaultSlot) => {
    if (!slot.isEnabled) return 0;
    const [startH, startM] = slot.startTime.split(':').map(Number);
    const [endH, endM] = slot.endTime.split(':').map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMinutes <= 0) return 0;
    const count = Math.floor(totalMinutes / slot.intervalMinutes);
    const categories = slot.jobCategoryIds.length || 1;
    return count * categories;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400">
        <i className="bi bi-hourglass-split text-2xl animate-spin mr-3" />
        読み込み中...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-700">デフォルト面接スロット設定</h2>
            <p className="text-xs text-slate-500 mt-1">
              曜日ごとのデフォルトの面接時間枠を設定します。CRON ジョブまたは手動で面接スロットを一括生成する際に使用されます。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !slots.some((s) => s.isEnabled)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <i className="bi bi-hourglass-split animate-spin" /> 生成中...
                </>
              ) : (
                <>
                  <i className="bi bi-lightning-charge" /> 今すぐ生成
                </>
              )}
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
            >
              {saved ? (
                <>
                  <i className="bi bi-check2" /> 保存済み
                </>
              ) : saving ? (
                '保存中...'
              ) : (
                <>
                  <i className="bi bi-floppy" /> 全て保存
                </>
              )}
            </button>
          </div>
        </div>

        {/* 適用開始日 */}
        <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <i className="bi bi-calendar-event text-amber-600 text-base mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-700 mb-0.5">適用開始日</p>
            <p className="text-xs text-amber-600">
              この日以降の<span className="font-bold">未予約スロット</span>を新しい設定に合わせて削除・再生成します。予約済みのスロットには影響しません。
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={effectiveFrom}
              min={getTomorrowStr()}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="border border-amber-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-amber-400 outline-none bg-white"
            />
            {effectiveFrom && (
              <button
                type="button"
                onClick={() => setEffectiveFrom('')}
                className="text-xs text-amber-600 hover:text-amber-800 underline whitespace-nowrap"
                title="適用開始日をクリアすると、スロットの再調整は行われません"
              >
                クリア
              </button>
            )}
          </div>
        </div>
        {!effectiveFrom && (
          <p className="mt-2 text-xs text-slate-400 pl-1">
            <i className="bi bi-info-circle mr-1" />
            適用開始日が未設定の場合、マスタの保存のみ行います（既存スロットは変更されません）
          </p>
        )}

        {/* 保存結果メッセージ */}
        {saveResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
            saveResult.type === 'error'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            <i className={`bi ${saveResult.type === 'error' ? 'bi-exclamation-triangle' : 'bi-check-circle'} mr-2`} />
            {saveResult.message}
          </div>
        )}

        {generateResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
            generateResult.startsWith('エラー')
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            <i className={`bi ${generateResult.startsWith('エラー') ? 'bi-exclamation-triangle' : 'bi-check-circle'} mr-2`} />
            {generateResult}
          </div>
        )}
      </div>

      <div className="p-5 space-y-3">
        {slots.map((slot) => {
          const isExpanded = expandedDay === slot.dayOfWeek;
          const slotCount = calcSlotCount(slot);

          return (
            <div
              key={slot.dayOfWeek}
              className={`rounded-xl border transition-all ${
                slot.isEnabled
                  ? 'bg-indigo-50/50 border-indigo-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              {/* メイン行 */}
              <div className="flex items-center gap-4 p-4">
                {/* 曜日ラベル */}
                <div className="w-20 shrink-0">
                  <span
                    className={`font-bold text-sm ${
                      slot.dayOfWeek === 0
                        ? 'text-rose-600'
                        : slot.dayOfWeek === 6
                        ? 'text-blue-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {DAY_LABELS[slot.dayOfWeek]}
                  </span>
                </div>

                {/* 有効/無効トグル */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slot.isEnabled}
                    onChange={(e) =>
                      handleSlotChange(slot.dayOfWeek, 'isEnabled', e.target.checked)
                    }
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-500">有効</span>
                </label>

                {/* 開始時刻 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">開始</label>
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) =>
                      handleSlotChange(slot.dayOfWeek, 'startTime', e.target.value)
                    }
                    disabled={!slot.isEnabled}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                {/* 終了時刻 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">終了</label>
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) =>
                      handleSlotChange(slot.dayOfWeek, 'endTime', e.target.value)
                    }
                    disabled={!slot.isEnabled}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                {/* 間隔 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">間隔</label>
                  <select
                    value={slot.intervalMinutes}
                    onChange={(e) =>
                      handleSlotChange(slot.dayOfWeek, 'intervalMinutes', Number(e.target.value))
                    }
                    disabled={!slot.isEnabled}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* スロット数プレビュー */}
                {slot.isEnabled && (
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                    {slotCount}枠/日
                  </span>
                )}

                {/* 展開/折りたたみ（職種選択） */}
                <button
                  type="button"
                  onClick={() => setExpandedDay(isExpanded ? null : slot.dayOfWeek)}
                  disabled={!slot.isEnabled}
                  className="px-2 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent flex items-center gap-1"
                >
                  <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                  職種
                  {slot.jobCategoryIds.length > 0 && (
                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                      {slot.jobCategoryIds.length}
                    </span>
                  )}
                </button>

                {/* 他の曜日にコピー */}
                <button
                  type="button"
                  onClick={() => handleCopyToOthers(slot.dayOfWeek)}
                  disabled={!slot.isEnabled}
                  className="ml-auto px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent flex items-center gap-1"
                >
                  {copyFromDay === slot.dayOfWeek ? (
                    <>
                      <i className="bi bi-check2" /> コピー完了
                    </>
                  ) : (
                    <>
                      <i className="bi bi-copy" /> 他にコピー
                    </>
                  )}
                </button>
              </div>

              {/* 展開エリア: 職種マルチ選択 */}
              {isExpanded && slot.isEnabled && (
                <div className="px-4 pb-4 pt-0">
                  <div className="bg-white rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-600">
                        <i className="bi bi-briefcase mr-1" />
                        対象職種（未選択の場合は全職種対応）
                      </p>
                      {slot.jobCategoryIds.length === 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                          全職種
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {jobCategories.map((jc) => {
                        const isSelected = slot.jobCategoryIds.includes(jc.id);
                        return (
                          <label
                            key={jc.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all ${
                              isSelected
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleJobCategory(slot.dayOfWeek, jc.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {jc.nameJa}
                          </label>
                        );
                      })}
                      {jobCategories.length === 0 && (
                        <p className="text-xs text-slate-400">職種が登録されていません</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          <i className="bi bi-info-circle mr-1" />
          「今すぐ生成」で今後2週間分の面接スロットを作成します（不一致スロットの削除は行いません）。
          設定変更後は「全て保存」で適用開始日以降のスロットを自動的に再調整します。
          CRON ジョブ（毎日自動実行）でも新規スロットの生成が行われます。
        </p>
      </div>
    </div>
  );
}
