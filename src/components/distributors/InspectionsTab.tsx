'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

/* ─── Types ─── */
type InspectionCategory = 'CHECK' | 'GUIDANCE';

interface InspectionForm {
  inspectedAt: string;
  category: InspectionCategory;
  // CHECK fields
  coverageChecked: number | '';
  coverageFound: number | '';
  prohibitedTotal: number | '';
  prohibitedViolations: number | '';
  multipleInsertion: string;
  fraudTrace: string;
  // GUIDANCE fields
  distributionSpeed: string;
  stickerCompliance: string;
  prohibitedCompliance: string;
  mapComprehension: string;
  workAttitude: string;
  // Common
  note: string;
  followUpRequired: boolean;
}

/* ─── Style constants ─── */
const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';

const emptyForm = (): InspectionForm => ({
  inspectedAt: new Date().toISOString().slice(0, 16),
  category: 'CHECK',
  coverageChecked: '',
  coverageFound: '',
  prohibitedTotal: '',
  prohibitedViolations: '',
  multipleInsertion: '',
  fraudTrace: '',
  distributionSpeed: '',
  stickerCompliance: '',
  prohibitedCompliance: '',
  mapComprehension: '',
  workAttitude: '',
  note: '',
  followUpRequired: false,
});

/* ─── Mobile-friendly segment button selector ─── */
function SegmentButtons({ options, value, onChange }: {
  options: { value: string; label: string; color?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const isSelected = value === opt.value;
        const colorClass = isSelected
          ? (opt.color || 'bg-emerald-600 text-white border-emerald-600')
          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 min-w-0 px-2 py-2.5 text-xs font-bold rounded-lg border transition-all ${colorClass} active:scale-95`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function InspectionsTab({ distributorId }: { distributorId: string }) {
  const { showToast } = useNotification();
  const { t } = useTranslation('distributors');

  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InspectionForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/distributors/${distributorId}/inspections`);
      if (res.ok) setInspections(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [distributorId]);

  useEffect(() => { fetchInspections(); }, [fetchInspections]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (insp: any) => {
    setEditId(insp.id.toString());
    setForm({
      inspectedAt: new Date(insp.inspectedAt).toISOString().slice(0, 16),
      category: insp.category,
      coverageChecked: insp.coverageChecked ?? '',
      coverageFound: insp.coverageFound ?? '',
      prohibitedTotal: insp.prohibitedTotal ?? '',
      prohibitedViolations: insp.prohibitedViolations ?? '',
      multipleInsertion: insp.multipleInsertion || '',
      fraudTrace: insp.fraudTrace || '',
      distributionSpeed: insp.distributionSpeed || '',
      stickerCompliance: insp.stickerCompliance || '',
      prohibitedCompliance: insp.prohibitedCompliance || '',
      mapComprehension: insp.mapComprehension || '',
      workAttitude: insp.workAttitude || '',
      note: insp.note || '',
      followUpRequired: insp.followUpRequired || false,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editId
        ? `/api/distributors/${distributorId}/inspections/${editId}`
        : `/api/distributors/${distributorId}/inspections`;
      const method = editId ? 'PUT' : 'POST';

      const body: any = {
        inspectedAt: form.inspectedAt,
        category: form.category,
        note: form.note || null,
        followUpRequired: form.followUpRequired,
      };

      if (form.category === 'CHECK') {
        body.coverageChecked = form.coverageChecked !== '' ? Number(form.coverageChecked) : null;
        body.coverageFound = form.coverageFound !== '' ? Number(form.coverageFound) : null;
        body.prohibitedTotal = form.prohibitedTotal !== '' ? Number(form.prohibitedTotal) : null;
        body.prohibitedViolations = form.prohibitedViolations !== '' ? Number(form.prohibitedViolations) : null;
        body.multipleInsertion = form.multipleInsertion || null;
        body.fraudTrace = form.fraudTrace || null;
      } else {
        body.distributionSpeed = form.distributionSpeed || null;
        body.stickerCompliance = form.stickerCompliance || null;
        body.prohibitedCompliance = form.prohibitedCompliance || null;
        body.mapComprehension = form.mapComprehension || null;
        body.workAttitude = form.workAttitude || null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('inspection_error'));
      }
      showToast(editId ? t('inspection_updated') : t('inspection_created'), 'success');
      setModalOpen(false);
      fetchInspections();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('inspection_error'), 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('inspection_delete_confirm'))) return;
    try {
      const res = await fetch(`/api/distributors/${distributorId}/inspections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(t('inspection_deleted'), 'success');
      fetchInspections();
    } catch {
      showToast(t('inspection_error'), 'error');
    }
  };

  const categoryLabel = (cat: string) =>
    cat === 'CHECK' ? t('inspection_category_check') : t('inspection_category_guidance');

  const categoryCls = (cat: string) =>
    cat === 'CHECK' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">{t('tab_inspections')}</p>
        <button
          onClick={openCreate}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
        >
          <i className="bi bi-plus-lg"></i> {t('inspection_new')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : inspections.length === 0 ? (
          <div className="p-8 text-center">
            <i className="bi bi-clipboard-check text-4xl text-slate-200 block mb-2"></i>
            <p className="text-sm text-slate-400">{t('inspection_no_data')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-500">{t('inspection_date')}</th>
                  <th className="px-3 py-2 text-left text-slate-500">{t('inspection_category')}</th>
                  <th className="px-3 py-2 text-left text-slate-500">{t('inspection_inspector')}</th>
                  <th className="px-3 py-2 text-center text-slate-500">{t('inspection_follow_up')}</th>
                  <th className="px-3 py-2 text-right text-slate-500">{t('th_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map((insp: any) => (
                  <tr key={insp.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600">
                      {new Date(insp.inspectedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryCls(insp.category)}`}>
                        {categoryLabel(insp.category)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {insp.inspector ? `${insp.inspector.lastNameJa} ${insp.inspector.firstNameJa}` : '--'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {insp.followUpRequired && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          {t('inspection_follow_up_required')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(insp)} className="p-1 text-slate-400 hover:text-slate-600" title={t('edit') || '編集'}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button onClick={() => handleDelete(insp.id)} className="p-1 text-slate-400 hover:text-red-500" title={t('delete') || '削除'}>
                          <i className="bi bi-trash"></i>
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

      {/* ─── CRUD Modal ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800">
                {editId ? t('inspection_edit') : t('inspection_new')}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Category toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_category')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['CHECK', 'GUIDANCE'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...emptyForm(),
                        inspectedAt: f.inspectedAt,
                        category: cat,
                        note: f.note,
                        followUpRequired: f.followUpRequired,
                      }))}
                      className={`px-3 py-3 text-sm font-bold rounded-xl border-2 transition-all active:scale-95 ${
                        form.category === cat
                          ? (cat === 'CHECK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-purple-50 border-purple-500 text-purple-700')
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <i className={`bi ${cat === 'CHECK' ? 'bi-search' : 'bi-person-workspace'} mr-1.5`}></i>
                      {cat === 'CHECK' ? t('inspection_category_check') : t('inspection_category_guidance')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('inspection_date')}</label>
                <input
                  type="datetime-local"
                  value={form.inspectedAt}
                  onChange={e => setForm(f => ({ ...f, inspectedAt: e.target.value }))}
                  className={inputCls}
                />
              </div>

              {/* ── CHECK fields ── */}
              {form.category === 'CHECK' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                    <i className="bi bi-search"></i> {t('inspection_check_section')}
                  </p>

                  {/* Coverage */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_coverage')}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 mb-0.5">{t('inspection_coverage_found')}</label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={form.coverageFound}
                          onChange={e => setForm(f => ({ ...f, coverageFound: e.target.value === '' ? '' : Number(e.target.value) }))}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                      <span className="text-slate-400 font-bold mt-4">/</span>
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 mb-0.5">{t('inspection_coverage_checked')}</label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={form.coverageChecked}
                          onChange={e => setForm(f => ({ ...f, coverageChecked: e.target.value === '' ? '' : Number(e.target.value) }))}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                      {form.coverageChecked !== '' && Number(form.coverageChecked) > 0 && form.coverageFound !== '' && (
                        <div className="mt-4 px-2.5 py-1.5 bg-slate-100 rounded-lg shrink-0">
                          <span className="text-sm font-black text-slate-700">
                            {Math.round((Number(form.coverageFound) / Number(form.coverageChecked)) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prohibited */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_prohibited_posting')}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 mb-0.5">{t('inspection_prohibited_violations')}</label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={form.prohibitedViolations}
                          onChange={e => setForm(f => ({ ...f, prohibitedViolations: e.target.value === '' ? '' : Number(e.target.value) }))}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                      <span className="text-slate-400 font-bold mt-4">/</span>
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 mb-0.5">{t('inspection_prohibited_total')}</label>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={form.prohibitedTotal}
                          onChange={e => setForm(f => ({ ...f, prohibitedTotal: e.target.value === '' ? '' : Number(e.target.value) }))}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multiple insertion */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_multiple_insertion')}</label>
                    <SegmentButtons
                      value={form.multipleInsertion}
                      onChange={v => setForm(f => ({ ...f, multipleInsertion: v }))}
                      options={[
                        { value: 'NONE', label: t('inspection_mi_none'), color: 'bg-emerald-600 text-white border-emerald-600' },
                        { value: 'MINOR', label: t('inspection_mi_minor'), color: 'bg-yellow-500 text-white border-yellow-500' },
                        { value: 'SOME', label: t('inspection_mi_some'), color: 'bg-orange-500 text-white border-orange-500' },
                        { value: 'MANY', label: t('inspection_mi_many'), color: 'bg-red-500 text-white border-red-500' },
                      ]}
                    />
                  </div>

                  {/* Fraud trace */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_fraud_trace')}</label>
                    <SegmentButtons
                      value={form.fraudTrace}
                      onChange={v => setForm(f => ({ ...f, fraudTrace: v }))}
                      options={[
                        { value: 'NONE', label: t('inspection_ft_none'), color: 'bg-emerald-600 text-white border-emerald-600' },
                        { value: 'SUSPICIOUS', label: t('inspection_ft_suspicious'), color: 'bg-yellow-500 text-white border-yellow-500' },
                        { value: 'FOUND', label: t('inspection_ft_found'), color: 'bg-red-500 text-white border-red-500' },
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* ── GUIDANCE fields ── */}
              {form.category === 'GUIDANCE' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-purple-600 flex items-center gap-1.5">
                    <i className="bi bi-person-workspace"></i> {t('inspection_guidance_section')}
                  </p>

                  {/* Distribution speed */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_dist_speed')}</label>
                    <SegmentButtons
                      value={form.distributionSpeed}
                      onChange={v => setForm(f => ({ ...f, distributionSpeed: v }))}
                      options={[
                        { value: 'VERY_SLOW', label: t('inspection_speed_very_slow'), color: 'bg-red-500 text-white border-red-500' },
                        { value: 'SLOW', label: t('inspection_speed_slow'), color: 'bg-orange-500 text-white border-orange-500' },
                        { value: 'NORMAL', label: t('inspection_speed_normal'), color: 'bg-yellow-500 text-white border-yellow-500' },
                        { value: 'FAST', label: t('inspection_speed_fast'), color: 'bg-emerald-500 text-white border-emerald-500' },
                        { value: 'VERY_FAST', label: t('inspection_speed_very_fast'), color: 'bg-emerald-600 text-white border-emerald-600' },
                      ]}
                    />
                  </div>

                  {/* Sticker compliance */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_sticker')}</label>
                    <SegmentButtons
                      value={form.stickerCompliance}
                      onChange={v => setForm(f => ({ ...f, stickerCompliance: v }))}
                      options={[
                        { value: 'NO_MISTAKES', label: t('inspection_no_mistakes'), color: 'bg-emerald-600 text-white border-emerald-600' },
                        { value: 'SOME', label: t('inspection_some_mistakes'), color: 'bg-yellow-500 text-white border-yellow-500' },
                        { value: 'MANY', label: t('inspection_many_mistakes'), color: 'bg-red-500 text-white border-red-500' },
                      ]}
                    />
                  </div>

                  {/* Prohibited compliance */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_prohibited_check')}</label>
                    <SegmentButtons
                      value={form.prohibitedCompliance}
                      onChange={v => setForm(f => ({ ...f, prohibitedCompliance: v }))}
                      options={[
                        { value: 'NO_MISTAKES', label: t('inspection_no_mistakes'), color: 'bg-emerald-600 text-white border-emerald-600' },
                        { value: 'SOME', label: t('inspection_some_mistakes'), color: 'bg-yellow-500 text-white border-yellow-500' },
                        { value: 'MANY', label: t('inspection_many_mistakes'), color: 'bg-red-500 text-white border-red-500' },
                      ]}
                    />
                  </div>

                  {/* Map comprehension */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_map_comprehension')}</label>
                    <SegmentButtons
                      value={form.mapComprehension}
                      onChange={v => setForm(f => ({ ...f, mapComprehension: v }))}
                      options={[
                        { value: 'BAD', label: t('inspection_level_bad'), color: 'bg-red-500 text-white border-red-500' },
                        { value: 'NORMAL', label: t('inspection_level_normal'), color: 'bg-yellow-500 text-white border-yellow-500' },
                        { value: 'GOOD', label: t('inspection_level_good'), color: 'bg-emerald-600 text-white border-emerald-600' },
                      ]}
                    />
                  </div>

                  {/* Work attitude */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">{t('inspection_work_attitude')}</label>
                    <SegmentButtons
                      value={form.workAttitude}
                      onChange={v => setForm(f => ({ ...f, workAttitude: v }))}
                      options={[
                        { value: 'BAD', label: t('inspection_level_bad'), color: 'bg-red-500 text-white border-red-500' },
                        { value: 'NORMAL', label: t('inspection_level_normal'), color: 'bg-yellow-500 text-white border-yellow-500' },
                        { value: 'GOOD', label: t('inspection_level_good'), color: 'bg-emerald-600 text-white border-emerald-600' },
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">{t('inspection_note')}</label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={inputCls + ' h-20 resize-none'}
                />
              </div>

              {/* Follow-up required */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.followUpRequired}
                  onChange={e => setForm(f => ({ ...f, followUpRequired: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-600">{t('inspection_follow_up_required')}</span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> {t('save')}</>
                ) : (
                  <><i className="bi bi-check2"></i> {t('save')}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
