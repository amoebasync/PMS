'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

// ─── Types ───
type DetailTab = 'overview' | 'coverage' | 'prices' | 'incidents' | 'evaluation';
type Partner = {
  id: number;
  name: string;
  contactInfo: string | null;
  partnerTypeId: number;
  partnerType: { id: number; name: string };
  hasGpsTracking: boolean;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  note: string | null;
  _count: { coverageAreas: number; incidents: number; complaints: number };
};
type CoverageSummary = {
  prefectureId: number;
  prefectureName: string;
  cities: { cityId: number; cityName: string; areaCount: number }[];
  totalAreas: number;
};
type AreaPrice = {
  id: number;
  prefectureId: number;
  cityId: number | null;
  flyerSizeId: number;
  periodDaysMin: number;
  periodDaysMax: number;
  unitPrice: number;
  note: string | null;
  prefecture: { id: number; name: string };
  city: { id: number; name: string } | null;
  flyerSize: { id: number; name: string };
};
type Incident = {
  id: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  occurredAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
  note: string | null;
  resolver: { id: number; lastNameJa: string; firstNameJa: string } | null;
};
type EvalData = {
  totalIncidents: number;
  incidentsBySeverity: { severity: string; count: number }[];
  avgResolutionDays: number | null;
  totalComplaints: number;
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-rose-100 text-rose-700',
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-rose-100 text-rose-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white';

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const partnerId = parseInt(rawId, 10);
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const { t } = useTranslation('partners');

  const [tab, setTab] = useState<DetailTab>('overview');
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);

  const TABS: { key: DetailTab; label: string; icon: string }[] = [
    { key: 'overview', label: t('tab_overview'), icon: 'bi-building' },
    { key: 'coverage', label: t('tab_coverage'), icon: 'bi-geo-alt' },
    { key: 'prices', label: t('tab_prices'), icon: 'bi-currency-yen' },
    { key: 'incidents', label: t('tab_incidents'), icon: 'bi-exclamation-triangle' },
    { key: 'evaluation', label: t('tab_evaluation'), icon: 'bi-graph-up' },
  ];

  const fetchPartner = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners/${partnerId}`);
      if (res.ok) setPartner(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { fetchPartner(); }, [fetchPartner]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>;
  if (!partner) return <div className="text-center py-20 text-slate-400">{t('no_data')}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/partners" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <i className="bi bi-arrow-left text-xl"></i>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{partner.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">{partner.partnerType?.name}</span>
            {partner.isActive ? (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">{t('status_active')}</span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-400">{t('status_inactive')}</span>
            )}
            {partner.hasGpsTracking && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700"><i className="bi bi-geo-alt-fill mr-1"></i>{t('has_gps')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                tab === tb.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}>
              <i className={`bi ${tb.icon} mr-1.5`}></i>{tb.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab partner={partner} onUpdate={fetchPartner} t={t} showToast={showToast} />}
      {tab === 'coverage' && <CoverageTab partnerId={partnerId} t={t} showToast={showToast} showConfirm={showConfirm} />}
      {tab === 'prices' && <PricesTab partnerId={partnerId} t={t} showToast={showToast} showConfirm={showConfirm} />}
      {tab === 'incidents' && <IncidentsTab partnerId={partnerId} t={t} showToast={showToast} showConfirm={showConfirm} />}
      {tab === 'evaluation' && <EvaluationTab partnerId={partnerId} t={t} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab 1: Overview
// ═══════════════════════════════════════════════════════════
function OverviewTab({ partner, onUpdate, t, showToast }: { partner: Partner; onUpdate: () => void; t: (k: string) => string; showToast: (msg: string, type?: string) => void }) {
  const [partnerTypes, setPartnerTypes] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({
    name: partner.name,
    partnerTypeId: partner.partnerTypeId.toString(),
    contactInfo: partner.contactInfo || '',
    contactPerson: partner.contactPerson || '',
    phone: partner.phone || '',
    email: partner.email || '',
    address: partner.address || '',
    hasGpsTracking: partner.hasGpsTracking,
    isActive: partner.isActive,
    note: partner.note || '',
  });

  useEffect(() => {
    fetch('/api/partners/types').then(r => r.json()).then(setPartnerTypes).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          partnerTypeId: parseInt(form.partnerTypeId, 10),
        }),
      });
      if (!res.ok) throw new Error();
      showToast(t('save_success') || 'Saved', 'success');
      onUpdate();
    } catch { showToast(t('save_error') || 'Error', 'error'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* KPI Cards */}
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 font-bold mb-1"><i className="bi bi-geo-alt mr-1"></i>{t('coverage_count')}</div>
          <div className="text-3xl font-black text-slate-800">{partner._count.coverageAreas}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 font-bold mb-1"><i className="bi bi-exclamation-triangle mr-1"></i>{t('incident_count')}</div>
          <div className={`text-3xl font-black ${partner._count.incidents > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{partner._count.incidents}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-xs text-slate-500 font-bold mb-1"><i className="bi bi-chat-dots mr-1"></i>{t('complaint_count')}</div>
          <div className={`text-3xl font-black ${partner._count.complaints > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{partner._count.complaints}</div>
        </div>
      </div>

      {/* Basic Info Form */}
      <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4"><i className="bi bi-building mr-1"></i>{t('basic_info')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_company_name')} <span className="text-rose-500">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_type')} <span className="text-rose-500">*</span></label>
            <select value={form.partnerTypeId} onChange={e => setForm(f => ({ ...f, partnerTypeId: e.target.value }))} className={inputCls}>
              {partnerTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('contact_person')}</label>
            <input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} className={inputCls} placeholder={t('form_contact_person_placeholder')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('phone') || 'Phone'}</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder={t('form_phone_placeholder')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('email') || 'Email'}</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder={t('form_email_placeholder')} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('address') || 'Address'}</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} placeholder={t('form_address_placeholder')} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_contact')}</label>
            <textarea value={form.contactInfo} onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))} rows={2} className={inputCls} placeholder={t('form_contact_placeholder')} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-600 block mb-1">{t('note') || 'Note'}</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className={inputCls} />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hasGpsTracking} onChange={e => setForm(f => ({ ...f, hasGpsTracking: e.target.checked }))} className="w-4 h-4 rounded text-teal-600" />
              <span className="text-sm font-bold text-slate-700">{t('has_gps_tracking')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded text-teal-600" />
              <span className="text-sm font-bold text-slate-700">{t('is_active')}</span>
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={handleSave} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md transition-all">
            <i className="bi bi-check-lg mr-1"></i>{t('btn_update')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab 2: Coverage Areas
// ═══════════════════════════════════════════════════════════
function CoverageTab({ partnerId, t, showToast, showConfirm }: { partnerId: number; t: (k: string, p?: Record<string, unknown>) => string; showToast: (m: string, ty?: string) => void; showConfirm: (m: string, o?: Record<string, unknown>) => Promise<boolean> }) {
  const [summary, setSummary] = useState<CoverageSummary[]>([]);
  const [totalCoverage, setTotalCoverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prefectures, setPrefectures] = useState<{ id: number; name: string }[]>([]);
  const [cities, setCities] = useState<{ id: number; name: string; prefecture_id: number }[]>([]);
  const [selPref, setSelPref] = useState('');
  const [selCity, setSelCity] = useState('');
  const [expandedPref, setExpandedPref] = useState<number | null>(null);

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners/${partnerId}/coverage-areas`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTotalCoverage(data.totalCoverage);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [partnerId]);

  useEffect(() => { fetchCoverage(); }, [fetchCoverage]);
  const [locations, setLocations] = useState<{ id: number; name: string; cities: { id: number; name: string }[] }[]>([]);
  useEffect(() => {
    fetch('/api/locations').then(r => r.ok ? r.json() : []).then((data: { id: number; name: string; cities: { id: number; name: string }[] }[]) => {
      setLocations(data);
      setPrefectures(data.map(p => ({ id: p.id, name: p.name })));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (selPref) {
      const loc = locations.find(l => l.id === parseInt(selPref));
      setCities(loc ? loc.cities.map(c => ({ ...c, prefecture_id: loc.id })) : []);
    } else {
      setCities([]);
    }
    setSelCity('');
  }, [selPref, locations]);

  const addByPrefecture = async () => {
    if (!selPref) return;
    try {
      const res = await fetch(`/api/partners/${partnerId}/coverage-areas/by-prefecture`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefectureId: parseInt(selPref) }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(t('areas_added', { count: data.count }), 'success');
        fetchCoverage();
      }
    } catch { showToast(t('save_coverage_error'), 'error'); }
  };

  const addByCity = async () => {
    if (!selCity) return;
    try {
      const res = await fetch(`/api/partners/${partnerId}/coverage-areas/by-city`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId: parseInt(selCity) }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(t('areas_added', { count: data.count }), 'success');
        fetchCoverage();
      }
    } catch { showToast(t('save_coverage_error'), 'error'); }
  };

  const removeByCityId = async (cityId: number) => {
    if (!await showConfirm(t('confirm_remove_area'))) return;
    try {
      const res = await fetch(`/api/partners/${partnerId}/coverage-areas/by-city`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(t('areas_removed', { count: data.count }), 'success');
        fetchCoverage();
      }
    } catch { showToast(t('save_coverage_error'), 'error'); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>;

  return (
    <div className="space-y-6">
      {/* Add controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3"><i className="bi bi-plus-circle mr-1"></i>{t('add_areas')}</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">{t('prefecture')}</label>
            <select value={selPref} onChange={e => setSelPref(e.target.value)} className={inputCls + ' w-48'}>
              <option value="">{t('select_prefecture')}</option>
              {prefectures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={addByPrefecture} disabled={!selPref} className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            <i className="bi bi-plus-lg mr-1"></i>{t('add_by_prefecture')}
          </button>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">{t('city')}</label>
            <select value={selCity} onChange={e => setSelCity(e.target.value)} className={inputCls + ' w-48'} disabled={!selPref}>
              <option value="">{t('select_city')}</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={addByCity} disabled={!selCity} className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            <i className="bi bi-plus-lg mr-1"></i>{t('add_by_city')}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-700"><i className="bi bi-tree mr-1"></i>{t('coverage_summary')}</h3>
          <span className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full">{totalCoverage} {t('area_count')}</span>
        </div>
        {summary.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">{t('no_coverage')}</p>
        ) : (
          <div className="space-y-1">
            {summary.map(pref => (
              <div key={pref.prefectureId} className="border border-slate-100 rounded-lg overflow-hidden">
                <button onClick={() => setExpandedPref(expandedPref === pref.prefectureId ? null : pref.prefectureId)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left">
                  <span className="font-bold text-sm text-slate-700">{pref.prefectureName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{pref.totalAreas} {t('area_count')}</span>
                    <i className={`bi bi-chevron-${expandedPref === pref.prefectureId ? 'up' : 'down'} text-slate-400`}></i>
                  </div>
                </button>
                {expandedPref === pref.prefectureId && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {pref.cities.map(city => (
                      <div key={city.cityId} className="flex items-center justify-between px-6 py-2 border-b border-slate-100 last:border-0">
                        <span className="text-sm text-slate-600">{city.cityName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{city.areaCount}</span>
                          <button onClick={() => removeByCityId(city.cityId)} className="p-1 text-slate-400 hover:text-rose-500" title={t('remove_by_city')}>
                            <i className="bi bi-trash text-xs"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab 3: Area Prices
// ═══════════════════════════════════════════════════════════
function PricesTab({ partnerId, t, showToast, showConfirm }: { partnerId: number; t: (k: string) => string; showToast: (m: string, ty?: string) => void; showConfirm: (m: string, o?: Record<string, unknown>) => Promise<boolean> }) {
  const [prices, setPrices] = useState<AreaPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<AreaPrice | null>(null);
  const [prefectures, setPrefectures] = useState<{ id: number; name: string }[]>([]);
  const [cities, setCities] = useState<{ id: number; name: string }[]>([]);
  const [flyerSizes, setFlyerSizes] = useState<{ id: number; name: string }[]>([]);

  const emptyForm = { prefectureId: '', cityId: '', flyerSizeId: '', periodDaysMin: '', periodDaysMax: '', unitPrice: '', note: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners/${partnerId}/area-prices`);
      if (res.ok) setPrices(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [partnerId]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);
  const [locations, setLocations] = useState<{ id: number; name: string; cities: { id: number; name: string }[] }[]>([]);
  useEffect(() => {
    Promise.all([
      fetch('/api/locations').then(r => r.json()),
      fetch('/api/flyers/masters').then(r => r.json()),
    ]).then(([loc, masters]) => {
      setLocations(loc);
      setPrefectures(loc.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })));
      if (masters.sizes) setFlyerSizes(masters.sizes);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.prefectureId) {
      const loc = locations.find(l => l.id === parseInt(form.prefectureId));
      setCities(loc ? loc.cities : []);
    } else { setCities([]); }
  }, [form.prefectureId, locations]);

  const openAdd = () => { setEditingPrice(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (p: AreaPrice) => {
    setEditingPrice(p);
    setForm({
      prefectureId: p.prefectureId.toString(),
      cityId: p.cityId?.toString() || '',
      flyerSizeId: p.flyerSizeId.toString(),
      periodDaysMin: p.periodDaysMin.toString(),
      periodDaysMax: p.periodDaysMax.toString(),
      unitPrice: p.unitPrice.toString(),
      note: p.note || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingPrice ? 'PUT' : 'POST';
      const body = editingPrice ? { id: editingPrice.id, ...form } : form;
      const res = await fetch(`/api/partners/${partnerId}/area-prices`, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      showToast(t('save_price_success'), 'success');
      setShowModal(false);
      fetchPrices();
    } catch { showToast(t('save_price_error'), 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!await showConfirm(t('confirm_delete_price'))) return;
    try {
      const res = await fetch(`/api/partners/${partnerId}/area-prices`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error();
      showToast(t('delete_price_success'), 'success');
      fetchPrices();
    } catch { showToast(t('delete_price_error'), 'error'); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg shadow-md">
          <i className="bi bi-plus-lg mr-1"></i>{t('add_price')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">{t('prefecture')}</th>
                <th className="px-4 py-3">{t('city')}</th>
                <th className="px-4 py-3">{t('flyer_size')}</th>
                <th className="px-4 py-3">{t('period_days')}</th>
                <th className="px-4 py-3 text-right">{t('unit_price')}</th>
                <th className="px-4 py-3">{t('note') || 'Note'}</th>
                <th className="px-4 py-3 text-right">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prices.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('no_prices')}</td></tr>
              ) : prices.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{p.prefecture.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.city?.name || '-'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold">{p.flyerSize.name}</span></td>
                  <td className="px-4 py-3 text-slate-600">{p.periodDaysMin}〜{p.periodDaysMax}{t('period_days').includes('日') ? '' : ' days'}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">¥{p.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{p.note || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-teal-600"><i className="bi bi-pencil"></i></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><i className="bi bi-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{editingPrice ? t('edit_price') : t('add_price')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('prefecture')} <span className="text-rose-500">*</span></label>
                  <select required value={form.prefectureId} onChange={e => setForm(f => ({ ...f, prefectureId: e.target.value, cityId: '' }))} className={inputCls}>
                    <option value="">{t('select_prefecture')}</option>
                    {prefectures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('city')}</label>
                  <select value={form.cityId} onChange={e => setForm(f => ({ ...f, cityId: e.target.value }))} className={inputCls}>
                    <option value="">-</option>
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('flyer_size')} <span className="text-rose-500">*</span></label>
                <select required value={form.flyerSizeId} onChange={e => setForm(f => ({ ...f, flyerSizeId: e.target.value }))} className={inputCls}>
                  <option value="">{t('form_select_placeholder')}</option>
                  {flyerSizes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('period_days_min')} <span className="text-rose-500">*</span></label>
                  <input required type="number" min="1" value={form.periodDaysMin} onChange={e => setForm(f => ({ ...f, periodDaysMin: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('period_days_max')} <span className="text-rose-500">*</span></label>
                  <input required type="number" min="1" value={form.periodDaysMax} onChange={e => setForm(f => ({ ...f, periodDaysMax: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('unit_price')} ({t('price_yen_per_unit')}) <span className="text-rose-500">*</span></label>
                <input required type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('note') || 'Note'}</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className={inputCls} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md">
                  {editingPrice ? t('btn_update') : t('btn_register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab 4: Incidents
// ═══════════════════════════════════════════════════════════
function IncidentsTab({ partnerId, t, showToast, showConfirm }: { partnerId: number; t: (k: string) => string; showToast: (m: string, ty?: string) => void; showConfirm: (m: string, o?: Record<string, unknown>) => Promise<boolean> }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const emptyForm = { title: '', description: '', severity: 'MEDIUM', status: 'OPEN', occurredAt: new Date().toISOString().split('T')[0], note: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchIncidents = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.append('status', filterStatus);
    if (filterSeverity) params.append('severity', filterSeverity);
    try {
      const res = await fetch(`/api/partners/${partnerId}/incidents?${params}`);
      if (res.ok) setIncidents(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [partnerId, filterStatus, filterSeverity]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const openAdd = () => { setEditingIncident(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (inc: Incident) => {
    setEditingIncident(inc);
    setForm({
      title: inc.title,
      description: inc.description,
      severity: inc.severity,
      status: inc.status,
      occurredAt: inc.occurredAt.split('T')[0],
      note: inc.note || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!editingIncident;
      const url = isEdit ? `/api/partners/${partnerId}/incidents/${editingIncident!.id}` : `/api/partners/${partnerId}/incidents`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      showToast(t('save_incident_success'), 'success');
      setShowModal(false);
      fetchIncidents();
    } catch { showToast(t('save_incident_error'), 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!await showConfirm(t('confirm_delete_incident'))) return;
    try {
      const res = await fetch(`/api/partners/${partnerId}/incidents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(t('delete_incident_success'), 'success');
      fetchIncidents();
    } catch { showToast(t('delete_incident_error'), 'error'); }
  };

  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const severityLabel = (s: string) => t(`severity_${s.toLowerCase()}`);
  const statusLabel = (s: string) => t(`status_${s.toLowerCase()}`);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm outline-none">
            <option value="">{t('incident_status')}: {t('filter_all')}</option>
            {statuses.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm outline-none">
            <option value="">{t('severity')}: {t('filter_all')}</option>
            {severities.map(s => <option key={s} value={s}>{severityLabel(s)}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg shadow-md">
          <i className="bi bi-plus-lg mr-1"></i>{t('add_incident')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">{t('incident_title')}</th>
                <th className="px-4 py-3">{t('severity')}</th>
                <th className="px-4 py-3">{t('incident_status')}</th>
                <th className="px-4 py-3">{t('occurred_at')}</th>
                <th className="px-4 py-3">{t('resolved_by')}</th>
                <th className="px-4 py-3 text-right">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidents.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('no_incidents')}</td></tr>
              ) : incidents.map(inc => (
                <tr key={inc.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{inc.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{inc.description}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-bold rounded-full ${SEVERITY_COLORS[inc.severity]}`}>{severityLabel(inc.severity)}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-bold rounded-full ${STATUS_COLORS[inc.status]}`}>{statusLabel(inc.status)}</span></td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{new Date(inc.occurredAt).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{inc.resolver ? `${inc.resolver.lastNameJa} ${inc.resolver.firstNameJa}` : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(inc)} className="p-1.5 text-slate-400 hover:text-teal-600"><i className="bi bi-pencil"></i></button>
                    <button onClick={() => handleDelete(inc.id)} className="p-1.5 text-slate-400 hover:text-rose-600"><i className="bi bi-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800">{editingIncident ? t('edit_incident') : t('add_incident')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('incident_title')} <span className="text-rose-500">*</span></label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('incident_description')} <span className="text-rose-500">*</span></label>
                <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('severity')}</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={inputCls}>
                    {severities.map(s => <option key={s} value={s}>{severityLabel(s)}</option>)}
                  </select>
                </div>
                {editingIncident && (
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">{t('incident_status')}</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                      {statuses.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('occurred_at')} <span className="text-rose-500">*</span></label>
                <input required type="date" value={form.occurredAt} onChange={e => setForm(f => ({ ...f, occurredAt: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('note') || 'Note'}</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className={inputCls} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
                <button type="submit" className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-md">
                  {editingIncident ? t('btn_update') : t('btn_register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab 5: Evaluation
// ═══════════════════════════════════════════════════════════
function EvaluationTab({ partnerId, t }: { partnerId: number; t: (k: string) => string }) {
  const [data, setData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchEval = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    try {
      const res = await fetch(`/api/partners/${partnerId}/evaluation?${params}`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [partnerId, dateFrom, dateTo]);

  useEffect(() => { fetchEval(); }, [fetchEval]);

  const severityLabel = (s: string) => t(`severity_${s.toLowerCase()}`);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>;

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3"><i className="bi bi-calendar-range mr-1"></i>{t('evaluation_period')}</h3>
        <div className="flex gap-3 items-center">
          <div>
            <label className="text-xs text-slate-500 block mb-1">{t('date_from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls + ' w-44'} />
          </div>
          <span className="text-slate-400 pt-5">〜</span>
          <div>
            <label className="text-xs text-slate-500 block mb-1">{t('date_to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls + ' w-44'} />
          </div>
        </div>
      </div>

      {!data ? (
        <p className="text-center text-slate-400 py-8">{t('no_evaluation_data')}</p>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 font-bold mb-1">{t('total_incidents')}</div>
              <div className="text-3xl font-black text-slate-800">{data.totalIncidents}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 font-bold mb-1">{t('total_complaints')}</div>
              <div className="text-3xl font-black text-slate-800">{data.totalComplaints}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 font-bold mb-1">{t('avg_resolution_days')}</div>
              <div className="text-3xl font-black text-slate-800">{data.avgResolutionDays !== null ? `${data.avgResolutionDays}` : '-'}</div>
              {data.avgResolutionDays !== null && <div className="text-xs text-slate-400 mt-0.5">days</div>}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 font-bold mb-1">{t('severity_breakdown')}</div>
              <div className="space-y-1 mt-2">
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => {
                  const item = data.incidentsBySeverity.find(i => i.severity === sev);
                  return (
                    <div key={sev} className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${SEVERITY_COLORS[sev]}`}>{severityLabel(sev)}</span>
                      <span className="text-sm font-bold text-slate-700">{item?.count ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
