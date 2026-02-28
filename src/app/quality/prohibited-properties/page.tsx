'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { GoogleMap, useJsApiLoader, Marker, Polygon, InfoWindow, DrawingManager } from '@react-google-maps/api';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import * as XLSX from 'xlsx';

// ===== Types =====
interface ProhibitedProperty {
  id: number;
  prefectureId: number | null;
  cityId: number | null;
  areaId: number | null;
  postalCode: string | null;
  address: string;
  buildingName: string | null;
  roomNumber: string | null;
  unitCount: number | null;
  severity: number | null;
  latitude: number | null;
  longitude: number | null;
  boundaryGeojson: string | null;
  customerId: number | null;
  prohibitedReasonId: number | null;
  reasonDetail: string | null;
  originalCode: string | null;
  imageUrls: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  deactivateReason: string | null;
  complaintId: number | null;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
  prefecture?: { id: number; name: string } | null;
  city?: { id: number; name: string } | null;
  area?: { id: number; town_name: string; chome_name: string } | null;
  customer?: { id: number; name: string; customerCode?: string } | null;
  prohibitedReason?: { id: number; name: string } | null;
  complaint?: { id: number; title: string; status?: string } | null;
}

interface ProhibitedReason {
  id: number;
  name: string;
  isActive: boolean;
}

interface Prefecture {
  id: number;
  name: string;
  cities: { id: number; name: string }[];
}

interface MapProperty {
  id: number;
  latitude: number | null;
  longitude: number | null;
  boundaryGeojson: string | null;
  address: string;
  buildingName: string | null;
  customer: { name: string } | null;
}

interface ImportRow {
  PROHIBITED_CD?: string;
  CLIENT_CD?: string;
  POSTAL_CD?: string;
  ADDRESS_CD?: string;
  ADDRESS?: string;
  BUILDING_NM?: string;
  ROOM_NO?: string;
  LATITUDE?: number | string;
  LONGITUDE?: number | string;
  POLYLINE_PATH?: string;
  REMARK?: string;
}

interface ValidationResult {
  row: number;
  data: ImportRow;
  errors: string[];
  isValid: boolean;
}

// ===== Constants =====
type TabKey = 'list' | 'map' | 'import';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'list', label: '一覧', icon: 'bi-list-ul' },
  { key: 'map', label: '地図', icon: 'bi-geo-alt-fill' },
  { key: 'import', label: 'CSVインポート', icon: 'bi-upload' },
];

const INPUT_CLS = 'w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500';
const SELECT_CLS = 'w-full border border-slate-300 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white';
const CARD_CLS = 'bg-white rounded-2xl shadow-sm border border-slate-200 p-6';

const LIBRARIES: ('geometry' | 'drawing')[] = ['geometry', 'drawing'];

const MAP_CONTAINER = { width: '100%', height: 'calc(100vh - 250px)' };
const TOKYO_CENTER = { lat: 35.6580, lng: 139.7016 };

const CSV_HEADERS = [
  'PROHIBITED_CD', 'CLIENT_CD', 'POSTAL_CD', 'ADDRESS_CD', 'ADDRESS',
  'BUILDING_NM', 'ROOM_NO', 'LATITUDE', 'LONGITUDE', 'POLYLINE_PATH', 'REMARK',
];

// ===== GeoJSON helper =====
const extractPaths = (geojsonStr: string) => {
  if (!geojsonStr) return [];
  const trimmed = geojsonStr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const getCoords = (geom: any): any[][] => {
        if (!geom) return [];
        if (geom.type === 'FeatureCollection') return geom.features.flatMap((f: any) => getCoords(f.geometry || f));
        if (geom.type === 'Feature') return getCoords(geom.geometry);
        if (geom.type === 'Polygon') return [geom.coordinates[0]];
        if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly: any[]) => poly[0]);
        return [];
      };
      const rawPolygons = getCoords(parsed);
      return rawPolygons
        .map(poly =>
          poly
            .map((c: any[]) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) }))
            .filter((c: any) => !isNaN(c.lat) && !isNaN(c.lng))
        )
        .filter(p => p.length > 0);
    } catch {
      // invalid JSON
    }
  }
  return [];
};

// Parse imageUrls JSON string to array
const parseImageUrls = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const fmtDate = (d: string | null) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('ja-JP');
  } catch {
    return d;
  }
};

// ===== Severity helpers =====
const SEVERITY_CONFIG: Record<number, { label: string; color: string; bg: string; border: string; icon: string }> = {
  1: { label: '低', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: 'bi-dash-circle' },
  2: { label: 'やや低', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bi-info-circle' },
  3: { label: '中', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bi-exclamation-circle' },
  4: { label: '高', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: 'bi-exclamation-triangle-fill' },
  5: { label: '最高', color: 'text-rose-700', bg: 'bg-rose-100', border: 'border-rose-300', icon: 'bi-fire' },
};

const SeverityBadge = ({ value }: { value: number | null }) => {
  const cfg = SEVERITY_CONFIG[value ?? 3] || SEVERITY_CONFIG[3];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      <i className={`bi ${cfg.icon}`}></i>{cfg.label}
    </span>
  );
};

// ===== Component =====
export default function ProhibitedPropertiesPage() {
  const { showToast, showConfirm } = useNotification();

  // -- Tab
  const [activeTab, setActiveTab] = useState<TabKey>('list');

  // -- Master data
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);
  const [reasons, setReasons] = useState<ProhibitedReason[]>([]);

  // -- List tab state
  const [items, setItems] = useState<ProhibitedProperty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterPrefecture, setFilterPrefecture] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterIsActive, setFilterIsActive] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');

  // Derived cities
  const filteredCities = filterPrefecture
    ? prefectures.find(p => p.id === Number(filterPrefecture))?.cities ?? []
    : [];

  // -- Detail modal
  const [selectedProperty, setSelectedProperty] = useState<ProhibitedProperty | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editCities, setEditCities] = useState<{ id: number; name: string }[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // -- Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, any>>({});
  const [createCities, setCreateCities] = useState<{ id: number; name: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // -- Deactivate
  const [deactivateReason, setDeactivateReason] = useState('');

  // -- Map tab state
  const [mapProperties, setMapProperties] = useState<MapProperty[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedMapItem, setSelectedMapItem] = useState<MapProperty | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapTotal, setMapTotal] = useState(0);
  const [mapLimited, setMapLimited] = useState(false);
  const [mapZoomTooLow, setMapZoomTooLow] = useState(false);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const nativeMarkersRef = useRef<google.maps.Marker[]>([]);
  const MIN_MAP_ZOOM = 13;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
    language: 'ja',
    region: 'JP',
  });

  // -- CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsed, setCsvParsed] = useState<ValidationResult[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // -- Map draw create state (ポリゴン描画で禁止エリア登録)
  const [showDrawCreate, setShowDrawCreate] = useState(false);
  const [drawnPolygonPaths, setDrawnPolygonPaths] = useState<google.maps.LatLngLiteral[]>([]);
  const [drawnPolygonRef, setDrawnPolygonRef] = useState<google.maps.Polygon | null>(null);
  const [drawCreateForm, setDrawCreateForm] = useState<Record<string, any>>({});
  const [drawCreateCities, setDrawCreateCities] = useState<{ id: number; name: string }[]>([]);
  const [drawCreating, setDrawCreating] = useState(false);
  const drawMapRef = useRef<google.maps.Map | null>(null);

  // ===== Polygon <-> GeoJSON helpers =====
  const polygonPathsToGeoJSON = (paths: google.maps.LatLngLiteral[]): string => {
    if (paths.length < 3) return '';
    // GeoJSON requires the ring to be closed (first point == last point)
    const coords = paths.map(p => [p.lng, p.lat]);
    // Close the ring
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([...first]);
    }
    const geojson = {
      type: 'Polygon',
      coordinates: [coords],
    };
    return JSON.stringify(geojson);
  };

  const calculatePolygonCenter = (paths: google.maps.LatLngLiteral[]): { lat: number; lng: number } | null => {
    if (paths.length === 0) return null;
    const sumLat = paths.reduce((s, p) => s + p.lat, 0);
    const sumLng = paths.reduce((s, p) => s + p.lng, 0);
    return { lat: sumLat / paths.length, lng: sumLng / paths.length };
  };

  // ===== Data fetching =====
  const fetchMaster = useCallback(async () => {
    try {
      const [prefRes, reasonRes] = await Promise.all([
        fetch('/api/locations'),
        fetch('/api/prohibited-reasons'),
      ]);
      if (prefRes.ok) setPrefectures(await prefRes.json());
      if (reasonRes.ok) setReasons(await reasonRes.json());
    } catch (err) {
      console.error('Master fetch error:', err);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filterPrefecture) params.set('prefecture', filterPrefecture);
      if (filterCity) params.set('city', filterCity);
      if (filterSearch) params.set('search', filterSearch);
      if (filterIsActive) params.set('isActive', filterIsActive);
      if (filterCustomer) params.set('customerId', filterCustomer);

      const res = await fetch(`/api/prohibited-properties?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data);
        setTotal(json.total);
      } else {
        showToast('データの取得に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterPrefecture, filterCity, filterSearch, filterIsActive, filterCustomer, showToast]);

  useEffect(() => { fetchMaster(); }, [fetchMaster]);
  useEffect(() => { if (activeTab === 'list') fetchList(); }, [activeTab, fetchList]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filterPrefecture, filterCity, filterSearch, filterIsActive, filterCustomer]);
  // Reset city when prefecture changes
  useEffect(() => { setFilterCity(''); }, [filterPrefecture]);

  // ===== Detail =====
  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setIsEditing(false);
    try {
      const res = await fetch(`/api/prohibited-properties/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProperty(data);
      } else {
        showToast('詳細の取得に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedProperty(null);
    setIsEditing(false);
    setEditForm({});
  };

  // ===== Edit =====
  const startEdit = () => {
    if (!selectedProperty) return;
    setEditForm({
      prefectureId: selectedProperty.prefectureId || '',
      cityId: selectedProperty.cityId || '',
      address: selectedProperty.address || '',
      buildingName: selectedProperty.buildingName || '',
      roomNumber: selectedProperty.roomNumber || '',
      unitCount: selectedProperty.unitCount ?? '',
      severity: selectedProperty.severity ?? '3',
      postalCode: selectedProperty.postalCode || '',
      latitude: selectedProperty.latitude ?? '',
      longitude: selectedProperty.longitude ?? '',
      prohibitedReasonId: selectedProperty.prohibitedReasonId || '',
      reasonDetail: selectedProperty.reasonDetail || '',
    });
    // Load cities for selected prefecture
    if (selectedProperty.prefectureId) {
      const pref = prefectures.find(p => p.id === selectedProperty.prefectureId);
      setEditCities(pref?.cities ?? []);
    } else {
      setEditCities([]);
    }
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!selectedProperty) return;
    try {
      const res = await fetch(`/api/prohibited-properties?id=${selectedProperty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefectureId: editForm.prefectureId ? Number(editForm.prefectureId) : null,
          cityId: editForm.cityId ? Number(editForm.cityId) : null,
          address: editForm.address,
          buildingName: editForm.buildingName || null,
          roomNumber: editForm.roomNumber || null,
          unitCount: editForm.unitCount !== '' ? Number(editForm.unitCount) : null,
          severity: editForm.severity !== '' ? Number(editForm.severity) : null,
          postalCode: editForm.postalCode || null,
          latitude: editForm.latitude !== '' ? Number(editForm.latitude) : null,
          longitude: editForm.longitude !== '' ? Number(editForm.longitude) : null,
          prohibitedReasonId: editForm.prohibitedReasonId ? Number(editForm.prohibitedReasonId) : null,
          reasonDetail: editForm.reasonDetail || null,
        }),
      });
      if (res.ok) {
        showToast('更新しました', 'success');
        setIsEditing(false);
        await openDetail(selectedProperty.id);
        fetchList();
      } else {
        const err = await res.json();
        showToast(err.error || '更新に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    }
  };

  // ===== Deactivate / Activate =====
  const handleDeactivate = async () => {
    if (!selectedProperty) return;
    const ok = await showConfirm(
      'この物件を無効化しますか？',
      { title: '配布禁止物件の無効化', variant: 'danger', confirmLabel: '無効化する' }
    );
    if (!ok) return;

    // Ask for reason
    const reason = deactivateReason.trim();
    try {
      const res = await fetch(`/api/prohibited-properties?id=${selectedProperty.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deactivateReason: reason || null }),
      });
      if (res.ok) {
        showToast('無効化しました', 'success');
        setDeactivateReason('');
        await openDetail(selectedProperty.id);
        fetchList();
      } else {
        const err = await res.json();
        showToast(err.error || '無効化に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    }
  };

  const handleActivate = async () => {
    if (!selectedProperty) return;
    const ok = await showConfirm(
      'この物件を有効化しますか？',
      { title: '配布禁止物件の有効化', variant: 'success', confirmLabel: '有効化する' }
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/prohibited-properties?id=${selectedProperty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true, deactivatedAt: null, deactivateReason: null }),
      });
      if (res.ok) {
        showToast('有効化しました', 'success');
        await openDetail(selectedProperty.id);
        fetchList();
      } else {
        const err = await res.json();
        showToast(err.error || '有効化に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    }
  };

  // ===== Image upload/delete =====
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProperty || !e.target.files?.[0]) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', e.target.files[0]);
      const res = await fetch(`/api/prohibited-properties/${selectedProperty.id}/images`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        showToast('画像をアップロードしました', 'success');
        await openDetail(selectedProperty.id);
      } else {
        const err = await res.json();
        showToast(err.error || 'アップロードに失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleImageDelete = async (imageUrl: string) => {
    if (!selectedProperty) return;
    const ok = await showConfirm(
      'この画像を削除しますか？',
      { title: '画像の削除', variant: 'danger', confirmLabel: '削除する' }
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/prohibited-properties/${selectedProperty.id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      if (res.ok) {
        showToast('画像を削除しました', 'success');
        await openDetail(selectedProperty.id);
      } else {
        const err = await res.json();
        showToast(err.error || '削除に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    }
  };

  // ===== Create =====
  const openCreate = () => {
    setCreateForm({
      prefectureId: '',
      cityId: '',
      address: '',
      buildingName: '',
      roomNumber: '',
      unitCount: '',
      severity: '3',
      postalCode: '',
      latitude: '',
      longitude: '',
      prohibitedReasonId: '',
      reasonDetail: '',
    });
    setCreateCities([]);
    setShowCreate(true);
  };

  const handleCreatePrefChange = (prefId: string) => {
    setCreateForm((f: Record<string, any>) => ({ ...f, prefectureId: prefId, cityId: '' }));
    if (prefId) {
      const pref = prefectures.find(p => p.id === Number(prefId));
      setCreateCities(pref?.cities ?? []);
    } else {
      setCreateCities([]);
    }
  };

  const handleEditPrefChange = (prefId: string) => {
    setEditForm((f: Record<string, any>) => ({ ...f, prefectureId: prefId, cityId: '' }));
    if (prefId) {
      const pref = prefectures.find(p => p.id === Number(prefId));
      setEditCities(pref?.cities ?? []);
    } else {
      setEditCities([]);
    }
  };

  const submitCreate = async () => {
    if (!createForm.address) {
      showToast('住所は必須です', 'warning');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/prohibited-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefectureId: createForm.prefectureId ? Number(createForm.prefectureId) : null,
          cityId: createForm.cityId ? Number(createForm.cityId) : null,
          address: createForm.address,
          buildingName: createForm.buildingName || null,
          roomNumber: createForm.roomNumber || null,
          unitCount: createForm.unitCount !== '' ? Number(createForm.unitCount) : null,
          severity: createForm.severity !== '' ? Number(createForm.severity) : 3,
          postalCode: createForm.postalCode || null,
          latitude: createForm.latitude !== '' ? Number(createForm.latitude) : null,
          longitude: createForm.longitude !== '' ? Number(createForm.longitude) : null,
          prohibitedReasonId: createForm.prohibitedReasonId ? Number(createForm.prohibitedReasonId) : null,
          reasonDetail: createForm.reasonDetail || null,
        }),
      });
      if (res.ok) {
        showToast('配布禁止物件を登録しました', 'success');
        setShowCreate(false);
        fetchList();
      } else {
        const err = await res.json();
        showToast(err.error || '登録に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    } finally {
      setCreating(false);
    }
  };

  // ===== Draw Create (ポリゴン描画による範囲登録) =====
  const openDrawCreate = () => {
    setDrawCreateForm({
      prefectureId: '',
      cityId: '',
      address: '',
      buildingName: '',
      postalCode: '',
      prohibitedReasonId: '',
      reasonDetail: '',
    });
    setDrawCreateCities([]);
    setDrawnPolygonPaths([]);
    if (drawnPolygonRef) {
      drawnPolygonRef.setMap(null);
      setDrawnPolygonRef(null);
    }
    setShowDrawCreate(true);
  };

  const handleDrawCreatePrefChange = (prefId: string) => {
    setDrawCreateForm((f: Record<string, any>) => ({ ...f, prefectureId: prefId, cityId: '' }));
    if (prefId) {
      const pref = prefectures.find(p => p.id === Number(prefId));
      setDrawCreateCities(pref?.cities ?? []);
    } else {
      setDrawCreateCities([]);
    }
  };

  const onPolygonComplete = (polygon: google.maps.Polygon) => {
    // Remove previously drawn polygon if any
    if (drawnPolygonRef) {
      drawnPolygonRef.setMap(null);
    }
    setDrawnPolygonRef(polygon);

    // Extract paths
    const path = polygon.getPath();
    const coords: google.maps.LatLngLiteral[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coords.push({ lat: point.lat(), lng: point.lng() });
    }
    setDrawnPolygonPaths(coords);

    // Make polygon editable
    polygon.setOptions({
      editable: true,
      draggable: true,
      fillColor: '#dc2626',
      fillOpacity: 0.2,
      strokeColor: '#dc2626',
      strokeWeight: 2,
    });

    // Listen for path changes (drag / vertex edit)
    const updatePaths = () => {
      const updatedPath = polygon.getPath();
      const updatedCoords: google.maps.LatLngLiteral[] = [];
      for (let i = 0; i < updatedPath.getLength(); i++) {
        const pt = updatedPath.getAt(i);
        updatedCoords.push({ lat: pt.lat(), lng: pt.lng() });
      }
      setDrawnPolygonPaths(updatedCoords);
    };

    google.maps.event.addListener(polygon.getPath(), 'set_at', updatePaths);
    google.maps.event.addListener(polygon.getPath(), 'insert_at', updatePaths);
    google.maps.event.addListener(polygon.getPath(), 'remove_at', updatePaths);
  };

  const clearDrawnPolygon = () => {
    if (drawnPolygonRef) {
      drawnPolygonRef.setMap(null);
      setDrawnPolygonRef(null);
    }
    setDrawnPolygonPaths([]);
  };

  const closeDrawCreate = () => {
    if (drawnPolygonRef) {
      drawnPolygonRef.setMap(null);
      setDrawnPolygonRef(null);
    }
    setDrawnPolygonPaths([]);
    setShowDrawCreate(false);
  };

  const submitDrawCreate = async () => {
    if (drawnPolygonPaths.length < 3) {
      showToast('地図上でポリゴンを描画してください', 'warning');
      return;
    }
    if (!drawCreateForm.address) {
      showToast('住所は必須です', 'warning');
      return;
    }

    setDrawCreating(true);
    try {
      const center = calculatePolygonCenter(drawnPolygonPaths);
      const geojson = polygonPathsToGeoJSON(drawnPolygonPaths);

      const res = await fetch('/api/prohibited-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefectureId: drawCreateForm.prefectureId ? Number(drawCreateForm.prefectureId) : null,
          cityId: drawCreateForm.cityId ? Number(drawCreateForm.cityId) : null,
          address: drawCreateForm.address,
          buildingName: drawCreateForm.buildingName || null,
          postalCode: drawCreateForm.postalCode || null,
          latitude: center?.lat ?? null,
          longitude: center?.lng ?? null,
          boundaryGeojson: geojson,
          prohibitedReasonId: drawCreateForm.prohibitedReasonId ? Number(drawCreateForm.prohibitedReasonId) : null,
          reasonDetail: drawCreateForm.reasonDetail || null,
        }),
      });

      if (res.ok) {
        showToast('配布禁止エリアを登録しました', 'success');
        closeDrawCreate();
        fetchList();
      } else {
        const err = await res.json();
        showToast(err.error || '登録に失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    } finally {
      setDrawCreating(false);
    }
  };

  // ===== Map =====
  // Cleanup clusterer on unmount / tab change
  useEffect(() => {
    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      nativeMarkersRef.current.forEach(m => m.setMap(null));
      nativeMarkersRef.current = [];
    };
  }, []);

  const updateClusterer = useCallback((properties: MapProperty[], map: google.maps.Map) => {
    // Remove old native markers
    nativeMarkersRef.current.forEach(m => m.setMap(null));
    nativeMarkersRef.current = [];

    // Create new native markers for properties that have coordinates
    const markers = properties
      .filter(p => p.latitude && p.longitude)
      .map(p => {
        const marker = new google.maps.Marker({
          position: { lat: p.latitude!, lng: p.longitude! },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#dc2626',
            fillOpacity: 0.9,
            strokeColor: '#991b1b',
            strokeWeight: 2,
          },
        });
        marker.addListener('click', () => {
          setSelectedMapItem(p);
        });
        return marker;
      });

    nativeMarkersRef.current = markers;

    // Update or create clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.addMarkers(markers);
    } else {
      clustererRef.current = new MarkerClusterer({
        map,
        markers,
        algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 16 }),
      });
    }
  }, []);

  const onMapIdle = useCallback(() => {
    if (!mapRef.current) return;
    const zoom = mapRef.current.getZoom() || 0;

    // Zoom check — too low means too many markers
    if (zoom < MIN_MAP_ZOOM) {
      setMapZoomTooLow(true);
      setMapProperties([]);
      setMapTotal(0);
      setMapLimited(false);
      // Clear markers
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
      nativeMarkersRef.current.forEach(m => m.setMap(null));
      nativeMarkersRef.current = [];
      return;
    }
    setMapZoomTooLow(false);

    const bounds = mapRef.current.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const boundsStr = `${sw.lat()},${sw.lng()},${ne.lat()},${ne.lng()}`;
    fetchMapData(boundsStr);
  }, []);

  const fetchMapData = async (boundsStr: string) => {
    setMapLoading(true);
    try {
      const res = await fetch(`/api/prohibited-properties/map?bounds=${boundsStr}&limit=3000`);
      if (res.ok) {
        const json = await res.json();
        const data: MapProperty[] = json.data || [];
        setMapProperties(data);
        setMapTotal(json.total || 0);
        setMapLimited(json.limited || false);

        // Update clusterer with new data
        if (mapRef.current) {
          updateClusterer(data, mapRef.current);
        }
      }
    } catch {
      // silent
    } finally {
      setMapLoading(false);
    }
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // ===== CSV import =====
  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvResult(null);
    setCsvParsed([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

      if (rows.length < 2) {
        showToast('ファイルの中身が空か、データが見つかりません', 'error');
        return;
      }

      const headers = (rows[0] as any[]).map((h: any) => String(h).trim());
      const dataRows = rows.slice(1);

      // Map header indices
      const headerMap: Record<string, number> = {};
      CSV_HEADERS.forEach(h => {
        const idx = headers.indexOf(h);
        if (idx !== -1) headerMap[h] = idx;
      });

      const validations: ValidationResult[] = dataRows.map((row: any, idx: number) => {
        if (!row || (Array.isArray(row) && row.length === 0)) {
          return { row: idx + 2, data: {}, errors: ['empty row'], isValid: false };
        }

        const getValue = (key: string) => {
          const i = headerMap[key];
          return i !== undefined && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
        };

        const parsed: ImportRow = {
          PROHIBITED_CD: getValue('PROHIBITED_CD'),
          CLIENT_CD: getValue('CLIENT_CD'),
          POSTAL_CD: getValue('POSTAL_CD'),
          ADDRESS_CD: getValue('ADDRESS_CD'),
          ADDRESS: getValue('ADDRESS'),
          BUILDING_NM: getValue('BUILDING_NM'),
          ROOM_NO: getValue('ROOM_NO'),
          LATITUDE: getValue('LATITUDE'),
          LONGITUDE: getValue('LONGITUDE'),
          POLYLINE_PATH: getValue('POLYLINE_PATH'),
          REMARK: getValue('REMARK'),
        };

        const errors: string[] = [];

        // Required: ADDRESS
        if (!parsed.ADDRESS) {
          errors.push('ADDRESS (住所) は必須です');
        }

        // LATITUDE / LONGITUDE must be numbers if present
        if (parsed.LATITUDE && isNaN(Number(parsed.LATITUDE))) {
          errors.push('LATITUDE は数値である必要があります');
        }
        if (parsed.LONGITUDE && isNaN(Number(parsed.LONGITUDE))) {
          errors.push('LONGITUDE は数値である必要があります');
        }

        return { row: idx + 2, data: parsed, errors, isValid: errors.length === 0 };
      }).filter(v => !(v.errors.length === 1 && v.errors[0] === 'empty row' && !v.data.ADDRESS));

      setCsvParsed(validations);
    } catch (err) {
      console.error('CSV parse error:', err);
      showToast('ファイルの読み込みに失敗しました', 'error');
    }
  };

  const executeCsvImport = async () => {
    const validRows = csvParsed.filter(v => v.isValid);
    if (validRows.length === 0) {
      showToast('インポート可能なデータがありません', 'warning');
      return;
    }

    setCsvImporting(true);
    setCsvResult(null);
    try {
      const importRows = validRows.map(v => ({
        PROHIBITED_CD: v.data.PROHIBITED_CD || undefined,
        CLIENT_CD: v.data.CLIENT_CD || undefined,
        POSTAL_CD: v.data.POSTAL_CD || undefined,
        ADDRESS_CD: v.data.ADDRESS_CD || undefined,
        ADDRESS: v.data.ADDRESS,
        BUILDING_NM: v.data.BUILDING_NM || undefined,
        ROOM_NO: v.data.ROOM_NO || undefined,
        LATITUDE: v.data.LATITUDE ? Number(v.data.LATITUDE) : undefined,
        LONGITUDE: v.data.LONGITUDE ? Number(v.data.LONGITUDE) : undefined,
        POLYLINE_PATH: v.data.POLYLINE_PATH || undefined,
        REMARK: v.data.REMARK || undefined,
      }));

      const res = await fetch('/api/prohibited-properties/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importRows }),
      });

      if (res.ok) {
        const result = await res.json();
        setCsvResult(result);
        showToast(`${result.success}件のインポートが完了しました`, 'success');
        fetchList();
      } else {
        const err = await res.json();
        showToast(err.error || 'インポートに失敗しました', 'error');
      }
    } catch {
      showToast('通信エラーが発生しました', 'error');
    } finally {
      setCsvImporting(false);
    }
  };

  const resetCsv = () => {
    setCsvFile(null);
    setCsvParsed([]);
    setCsvResult(null);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // ===== Pagination =====
  const totalPages = Math.ceil(total / limit);

  const pageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  // ===== Render detail images =====
  const detailImages = selectedProperty ? parseImageUrls(selectedProperty.imageUrls) : [];

  // ===== Detail map paths =====
  const detailPaths = selectedProperty?.boundaryGeojson
    ? extractPaths(selectedProperty.boundaryGeojson)
    : [];

  // ===== Render =====
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            <i className="bi bi-shield-exclamation text-rose-500 mr-2"></i>
            配布禁止物件管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">配布禁止対象物件の登録・管理・地図表示</p>
        </div>
        {activeTab === 'list' && (
          <div className="flex items-center gap-2">
            <button
              onClick={openDrawCreate}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
            >
              <i className="bi bi-pentagon"></i> 地図で範囲指定
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
            >
              <i className="bi bi-plus-lg"></i> 新規登録
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <i className={`bi ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== List Tab ===== */}
      {activeTab === 'list' && (
        <>
          {/* Filter bar */}
          <div className={CARD_CLS}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">都道府県</label>
                <select
                  value={filterPrefecture}
                  onChange={e => setFilterPrefecture(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">全て</option>
                  {prefectures.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">市区町村</label>
                <select
                  value={filterCity}
                  onChange={e => setFilterCity(e.target.value)}
                  className={SELECT_CLS}
                  disabled={!filterPrefecture}
                >
                  <option value="">全て</option>
                  {filteredCities.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">キーワード</label>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  placeholder="住所・建物名で検索"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">状態</label>
                <select
                  value={filterIsActive}
                  onChange={e => setFilterIsActive(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">全て</option>
                  <option value="true">有効</option>
                  <option value="false">無効</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">顧客ID</label>
                <input
                  type="text"
                  value={filterCustomer}
                  onChange={e => setFilterCustomer(e.target.value)}
                  placeholder="顧客IDで絞り込み"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <i className="bi bi-arrow-repeat animate-spin text-2xl"></i>
                <p className="mt-2 text-sm font-bold">読み込み中...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <i className="bi bi-inbox text-4xl"></i>
                <p className="mt-2 text-sm font-bold">データがありません</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">住所</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">建物名</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-right">枚数</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-center">重要度</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">禁止理由</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">対象顧客</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">登録日</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">状態</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map(item => (
                        <tr
                          key={item.id}
                          onClick={() => openDetail(item.id)}
                          className="hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800 max-w-[300px] truncate">
                            {item.prefecture?.name && <span className="text-slate-400 mr-1">{item.prefecture.name}</span>}
                            {item.address}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.buildingName || '-'}</td>
                          <td className="px-4 py-3 text-slate-600 text-right">{item.unitCount ? item.unitCount.toLocaleString() : '-'}</td>
                          <td className="px-4 py-3 text-center"><SeverityBadge value={item.severity} /></td>
                          <td className="px-4 py-3 text-slate-600">{item.prohibitedReason?.name || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.customer ? item.customer.name : <span className="text-amber-600 font-bold text-xs">全顧客</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(item.createdAt)}</td>
                          <td className="px-4 py-3">
                            {item.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <i className="bi bi-check-circle-fill"></i> 有効
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                <i className="bi bi-x-circle-fill"></i> 無効
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); openDetail(item.id); }}
                              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs transition-colors"
                            >
                              <i className="bi bi-eye mr-1"></i>詳細
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200 gap-3">
                  <p className="text-xs text-slate-500">
                    {total}件中 {startIdx}-{endIdx}件表示
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    {pageNumbers().map((p, i) =>
                      p === '...' ? (
                        <span key={`dot-${i}`} className="px-2 text-slate-400 text-xs">...</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            page === p
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ===== Map Tab ===== */}
      {activeTab === 'map' && (
        <div className={CARD_CLS + ' !p-0 overflow-hidden'}>
          {isLoaded ? (
            <div className="relative">
              {/* Loading indicator */}
              {mapLoading && (
                <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md">
                  <span className="text-xs font-bold text-slate-600">
                    <i className="bi bi-arrow-repeat animate-spin mr-1"></i>読み込み中...
                  </span>
                </div>
              )}

              {/* Zoom too low banner */}
              {mapZoomTooLow && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-amber-50 border border-amber-300 rounded-lg px-4 py-2 shadow-md max-w-md">
                  <div className="flex items-center gap-2">
                    <i className="bi bi-zoom-in text-amber-600 text-lg"></i>
                    <span className="text-xs font-bold text-amber-800">
                      地図をもう少しズームインしてください。ズームレベル{MIN_MAP_ZOOM}以上で物件が表示されます。
                    </span>
                  </div>
                </div>
              )}

              {/* Limited results banner */}
              {!mapZoomTooLow && mapLimited && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-50 border border-blue-300 rounded-lg px-4 py-2 shadow-md max-w-md">
                  <div className="flex items-center gap-2">
                    <i className="bi bi-info-circle-fill text-blue-600"></i>
                    <span className="text-xs font-bold text-blue-800">
                      表示範囲内に{mapTotal.toLocaleString()}件の物件があります（{mapProperties.length.toLocaleString()}件表示中）。
                      ズームインすると全件表示できます。
                    </span>
                  </div>
                </div>
              )}

              {/* Property count badge */}
              {!mapZoomTooLow && !mapLimited && mapProperties.length > 0 && (
                <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md">
                  <span className="text-xs font-bold text-slate-600">
                    <i className="bi bi-geo-alt-fill text-rose-500 mr-1"></i>
                    {mapProperties.length.toLocaleString()}件
                  </span>
                </div>
              )}

              <GoogleMap
                mapContainerStyle={MAP_CONTAINER}
                center={TOKYO_CENTER}
                zoom={14}
                onLoad={onMapLoad}
                onIdle={onMapIdle}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  minZoom: 8,
                }}
              >
                {/* Polygons rendered via React (not many, so no performance issue) */}
                {mapProperties.map(mp => {
                  const polygonPaths = mp.boundaryGeojson ? extractPaths(mp.boundaryGeojson) : [];
                  if (polygonPaths.length === 0) return null;
                  return (
                    <React.Fragment key={`poly-${mp.id}`}>
                      {polygonPaths.map((path, pi) => (
                        <Polygon
                          key={`${mp.id}-poly-${pi}`}
                          paths={path}
                          options={{
                            fillColor: '#dc2626',
                            fillOpacity: 0.15,
                            strokeColor: '#dc2626',
                            strokeWeight: 2,
                            strokeOpacity: 0.8,
                          }}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* InfoWindow for selected marker */}
                {selectedMapItem && selectedMapItem.latitude && selectedMapItem.longitude && (
                  <InfoWindow
                    position={{ lat: selectedMapItem.latitude, lng: selectedMapItem.longitude }}
                    onCloseClick={() => setSelectedMapItem(null)}
                  >
                    <div className="max-w-[280px] p-1">
                      <p className="font-bold text-sm text-slate-800 mb-1">{selectedMapItem.address}</p>
                      {selectedMapItem.buildingName && (
                        <p className="text-xs text-slate-600 mb-1">{selectedMapItem.buildingName}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        顧客: {selectedMapItem.customer?.name || '全顧客'}
                      </p>
                      <button
                        onClick={() => { setSelectedMapItem(null); openDetail(selectedMapItem.id); }}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        詳細を見る
                      </button>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: MAP_CONTAINER.height }}>
              <div className="text-center text-slate-400">
                <i className="bi bi-geo-alt text-4xl"></i>
                <p className="mt-2 text-sm font-bold">地図を読み込み中...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== CSV Import Tab ===== */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Upload section */}
          <div className={CARD_CLS}>
            <h2 className="text-lg font-black text-slate-800 mb-2">
              <i className="bi bi-file-earmark-spreadsheet text-emerald-600 mr-2"></i>
              CSVインポート
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              CSV / Excel ファイルをアップロードして配布禁止物件を一括登録します。
            </p>

            <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-600 mb-2">必要なカラム:</p>
              <div className="flex flex-wrap gap-1.5">
                {CSV_HEADERS.map(h => (
                  <span key={h} className={`px-2 py-0.5 rounded text-xs font-mono ${h === 'ADDRESS' ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-slate-200 text-slate-600'}`}>
                    {h}{h === 'ADDRESS' && ' *'}
                  </span>
                ))}
              </div>
            </div>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleCsvFile}
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />

            {csvFile && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  <i className="bi bi-file-earmark mr-1"></i>{csvFile.name}
                </span>
                <button
                  onClick={resetCsv}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors"
                >
                  <i className="bi bi-x-lg mr-1"></i>クリア
                </button>
              </div>
            )}
          </div>

          {/* Validation summary */}
          {csvParsed.length > 0 && (
            <div className={CARD_CLS}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-800">プレビュー</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-slate-600">
                      合計: <strong>{csvParsed.length}行</strong>
                    </span>
                    <span className="text-sm text-emerald-600">
                      有効: <strong>{csvParsed.filter(v => v.isValid).length}行</strong>
                    </span>
                    {csvParsed.some(v => !v.isValid) && (
                      <span className="text-sm text-rose-600">
                        エラー: <strong>{csvParsed.filter(v => !v.isValid).length}行</strong>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={executeCsvImport}
                  disabled={csvImporting || csvParsed.filter(v => v.isValid).length === 0}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {csvImporting ? (
                    <><i className="bi bi-arrow-repeat animate-spin"></i>インポート中...</>
                  ) : (
                    <><i className="bi bi-cloud-upload"></i>インポート実行</>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-slate-500 font-bold">行</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">状態</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">PROHIBITED_CD</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">CLIENT_CD</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">ADDRESS</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">BUILDING_NM</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">LATITUDE</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">LONGITUDE</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">REMARK</th>
                      <th className="px-3 py-2 text-slate-500 font-bold">エラー</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvParsed.map((v, i) => (
                      <tr
                        key={i}
                        className={v.isValid ? 'hover:bg-slate-50' : 'bg-rose-50'}
                      >
                        <td className="px-3 py-2 text-slate-500">{v.row}</td>
                        <td className="px-3 py-2">
                          {v.isValid ? (
                            <i className="bi bi-check-circle-fill text-emerald-500"></i>
                          ) : (
                            <i className="bi bi-exclamation-triangle-fill text-rose-500"></i>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{v.data.PROHIBITED_CD || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{v.data.CLIENT_CD || '-'}</td>
                        <td className="px-3 py-2 text-slate-800 font-medium max-w-[200px] truncate">{v.data.ADDRESS || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{v.data.BUILDING_NM || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{v.data.LATITUDE || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{v.data.LONGITUDE || '-'}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">{v.data.REMARK || '-'}</td>
                        <td className="px-3 py-2 text-rose-600 font-bold">{v.errors.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {csvResult && (
            <div className={CARD_CLS}>
              <h3 className="text-base font-black text-slate-800 mb-3">
                <i className="bi bi-clipboard-check text-emerald-600 mr-2"></i>
                インポート結果
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-center">
                  <p className="text-2xl font-black text-emerald-700">{csvResult.success}</p>
                  <p className="text-xs font-bold text-emerald-600 mt-1">成功</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-center">
                  <p className="text-2xl font-black text-amber-700">{csvResult.skipped}</p>
                  <p className="text-xs font-bold text-amber-600 mt-1">スキップ</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-4 border border-rose-200 text-center">
                  <p className="text-2xl font-black text-rose-700">{csvResult.errors.length}</p>
                  <p className="text-xs font-bold text-rose-600 mt-1">エラー</p>
                </div>
              </div>
              {csvResult.errors.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-slate-500 font-bold">行</th>
                        <th className="px-3 py-2 text-slate-500 font-bold">エラー内容</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvResult.errors.map((err, i) => (
                        <tr key={i} className="bg-rose-50">
                          <td className="px-3 py-2 text-slate-600">{err.row}</td>
                          <td className="px-3 py-2 text-rose-700">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== Detail Modal ===== */}
      {(selectedProperty || detailLoading) && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl animate-in slide-in-from-bottom-4 fade-in duration-200">
            {detailLoading && !selectedProperty ? (
              <div className="p-12 text-center text-slate-400">
                <i className="bi bi-arrow-repeat animate-spin text-2xl"></i>
                <p className="mt-2 text-sm font-bold">読み込み中...</p>
              </div>
            ) : selectedProperty && (
              <>
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-slate-800 truncate">
                      {selectedProperty.address}
                      {selectedProperty.buildingName && (
                        <span className="text-slate-500 font-bold ml-2">{selectedProperty.buildingName}</span>
                      )}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      {selectedProperty.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          <i className="bi bi-check-circle-fill"></i> 有効
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          <i className="bi bi-x-circle-fill"></i> 無効
                        </span>
                      )}
                      <span className="text-xs text-slate-400">ID: {selectedProperty.id}</span>
                    </div>
                  </div>
                  <button onClick={closeDetail} className="p-2 hover:bg-slate-100 rounded-xl transition-colors ml-4">
                    <i className="bi bi-x-lg text-slate-500 text-lg"></i>
                  </button>
                </div>

                <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Section 1: Property info */}
                  <div>
                    <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                      <i className="bi bi-building text-indigo-500"></i> 物件情報
                    </h3>
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">都道府県</label>
                          <select
                            value={editForm.prefectureId}
                            onChange={e => handleEditPrefChange(e.target.value)}
                            className={SELECT_CLS}
                          >
                            <option value="">未選択</option>
                            {prefectures.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">市区町村</label>
                          <select
                            value={editForm.cityId}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, cityId: e.target.value }))}
                            className={SELECT_CLS}
                            disabled={!editForm.prefectureId}
                          >
                            <option value="">未選択</option>
                            {editCities.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-500 mb-1 block">住所 <span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            value={editForm.address}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, address: e.target.value }))}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">建物名</label>
                          <input
                            type="text"
                            value={editForm.buildingName}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, buildingName: e.target.value }))}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">部屋番号</label>
                          <input
                            type="text"
                            value={editForm.roomNumber}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, roomNumber: e.target.value }))}
                            className={INPUT_CLS}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">配布可能枚数</label>
                          <input
                            type="number"
                            value={editForm.unitCount}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, unitCount: e.target.value }))}
                            className={INPUT_CLS}
                            placeholder="例: 300"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">重要度（誤配リスク）</label>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(v => {
                              const cfg = SEVERITY_CONFIG[v];
                              const selected = Number(editForm.severity) === v;
                              return (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setEditForm((f: Record<string, any>) => ({ ...f, severity: String(v) }))}
                                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                                    selected
                                      ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current`
                                      : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <i className={`bi ${cfg.icon} block text-sm mb-0.5`}></i>
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">郵便番号</label>
                          <input
                            type="text"
                            value={editForm.postalCode}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, postalCode: e.target.value }))}
                            className={INPUT_CLS}
                            placeholder="123-4567"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 mb-1 block">禁止理由</label>
                          <select
                            value={editForm.prohibitedReasonId}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, prohibitedReasonId: e.target.value }))}
                            className={SELECT_CLS}
                          >
                            <option value="">未選択</option>
                            {reasons.filter(r => r.isActive).map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-500 mb-2 block">
                            <i className="bi bi-geo-alt text-rose-500 mr-1"></i>位置情報（地図をクリックまたはピンをドラッグ）
                          </label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 mb-0.5 block">緯度</label>
                              <input
                                type="number"
                                step="any"
                                value={editForm.latitude}
                                onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, latitude: e.target.value }))}
                                className={INPUT_CLS + ' !py-2 !text-xs'}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 mb-0.5 block">経度</label>
                              <input
                                type="number"
                                step="any"
                                value={editForm.longitude}
                                onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, longitude: e.target.value }))}
                                className={INPUT_CLS + ' !py-2 !text-xs'}
                              />
                            </div>
                          </div>
                          {isLoaded && (
                            <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '250px' }}>
                              <GoogleMap
                                mapContainerStyle={{ width: '100%', height: '100%' }}
                                center={
                                  editForm.latitude && editForm.longitude
                                    ? { lat: Number(editForm.latitude), lng: Number(editForm.longitude) }
                                    : TOKYO_CENTER
                                }
                                zoom={15}
                                onClick={(e) => {
                                  if (e.latLng) {
                                    setEditForm((f: Record<string, any>) => ({
                                      ...f,
                                      latitude: e.latLng!.lat().toFixed(7),
                                      longitude: e.latLng!.lng().toFixed(7),
                                    }));
                                  }
                                }}
                                options={{
                                  streetViewControl: false,
                                  mapTypeControl: false,
                                  fullscreenControl: false,
                                  zoomControl: true,
                                }}
                              >
                                {editForm.latitude && editForm.longitude && (
                                  <Marker
                                    position={{ lat: Number(editForm.latitude), lng: Number(editForm.longitude) }}
                                    draggable={true}
                                    onDragEnd={(e) => {
                                      if (e.latLng) {
                                        setEditForm((f: Record<string, any>) => ({
                                          ...f,
                                          latitude: e.latLng!.lat().toFixed(7),
                                          longitude: e.latLng!.lng().toFixed(7),
                                        }));
                                      }
                                    }}
                                    icon={{
                                      path: google.maps.SymbolPath.CIRCLE,
                                      scale: 10,
                                      fillColor: '#dc2626',
                                      fillOpacity: 0.9,
                                      strokeColor: '#991b1b',
                                      strokeWeight: 2,
                                    }}
                                  />
                                )}
                              </GoogleMap>
                            </div>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold text-slate-500 mb-1 block">理由詳細</label>
                          <textarea
                            value={editForm.reasonDetail}
                            onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, reasonDetail: e.target.value }))}
                            className={INPUT_CLS + ' min-h-[80px]'}
                            rows={3}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                        <InfoRow label="住所" value={`${selectedProperty.prefecture?.name || ''} ${selectedProperty.city?.name || ''} ${selectedProperty.address}`} />
                        <InfoRow label="建物名" value={selectedProperty.buildingName} />
                        <InfoRow label="部屋番号" value={selectedProperty.roomNumber} />
                        <InfoRow label="配布可能枚数" value={selectedProperty.unitCount?.toLocaleString()} />
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">重要度</p>
                          <SeverityBadge value={selectedProperty.severity} />
                        </div>
                        <InfoRow label="郵便番号" value={selectedProperty.postalCode} />
                        <InfoRow label="緯度" value={selectedProperty.latitude?.toString()} />
                        <InfoRow label="経度" value={selectedProperty.longitude?.toString()} />
                        <InfoRow label="禁止理由" value={selectedProperty.prohibitedReason?.name} />
                        <InfoRow label="理由詳細" value={selectedProperty.reasonDetail} />
                        <InfoRow label="対象顧客" value={selectedProperty.customer ? selectedProperty.customer.name : '全顧客'} />
                        <InfoRow label="登録日" value={fmtDate(selectedProperty.createdAt)} />
                        {!selectedProperty.isActive && (
                          <>
                            <InfoRow label="無効化日" value={fmtDate(selectedProperty.deactivatedAt)} />
                            <InfoRow label="無効化理由" value={selectedProperty.deactivateReason} />
                          </>
                        )}
                        {selectedProperty.originalCode && (
                          <InfoRow label="元コード" value={selectedProperty.originalCode} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Images */}
                  <div>
                    <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                      <i className="bi bi-images text-indigo-500"></i> 画像
                      <span className="text-xs font-normal text-slate-400 ml-1">({detailImages.length}件)</span>
                    </h3>
                    {detailImages.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {detailImages.map((url, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100">
                            <img
                              src={url}
                              alt={`画像 ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/logo/logo_Icon_transparent.png'; }}
                            />
                            <button
                              onClick={() => handleImageDelete(url)}
                              className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                              title="削除"
                            >
                              <i className="bi bi-trash text-xs"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">画像はありません</p>
                    )}
                    <div className="mt-3">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        disabled={imageUploading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {imageUploading ? (
                          <><i className="bi bi-arrow-repeat animate-spin"></i>アップロード中...</>
                        ) : (
                          <><i className="bi bi-cloud-upload"></i>画像をアップロード</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Section 3: Related complaint */}
                  {selectedProperty.complaint && (
                    <div>
                      <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                        <i className="bi bi-exclamation-triangle text-amber-500"></i> 紐付きクレーム
                      </h3>
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                        <p className="font-bold text-sm text-slate-800">
                          #{selectedProperty.complaint.id}: {selectedProperty.complaint.title}
                        </p>
                        {selectedProperty.complaint.status && (
                          <p className="text-xs text-slate-500 mt-1">
                            ステータス: {selectedProperty.complaint.status}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Section 4: Map preview */}
                  {(selectedProperty.latitude && selectedProperty.longitude) && (
                    <div>
                      <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                        <i className="bi bi-geo-alt text-indigo-500"></i> 地図プレビュー
                      </h3>
                      {isLoaded ? (
                        <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '300px' }}>
                          <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={{ lat: selectedProperty.latitude!, lng: selectedProperty.longitude! }}
                            zoom={16}
                            options={{
                              streetViewControl: false,
                              mapTypeControl: false,
                              fullscreenControl: false,
                              zoomControl: true,
                            }}
                          >
                            <Marker
                              position={{ lat: selectedProperty.latitude!, lng: selectedProperty.longitude! }}
                              icon={{
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 10,
                                fillColor: '#dc2626',
                                fillOpacity: 0.9,
                                strokeColor: '#991b1b',
                                strokeWeight: 2,
                              }}
                            />
                            {detailPaths.map((path, pi) => (
                              <Polygon
                                key={`detail-poly-${pi}`}
                                paths={path}
                                options={{
                                  fillColor: '#dc2626',
                                  fillOpacity: 0.15,
                                  strokeColor: '#dc2626',
                                  strokeWeight: 2,
                                  strokeOpacity: 0.8,
                                }}
                              />
                            ))}
                          </GoogleMap>
                        </div>
                      ) : (
                        <div className="h-[300px] bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                          地図を読み込み中...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal footer actions */}
                <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEdit}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
                      >
                        <i className="bi bi-check-lg"></i> 保存
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={startEdit}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
                      >
                        <i className="bi bi-pencil"></i> 編集
                      </button>
                      {selectedProperty.isActive ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={deactivateReason}
                            onChange={e => setDeactivateReason(e.target.value)}
                            placeholder="無効化の理由（任意）"
                            className="border border-slate-300 p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 w-48"
                          />
                          <button
                            onClick={handleDeactivate}
                            className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
                          >
                            <i className="bi bi-slash-circle"></i> 無効化
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleActivate}
                          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
                        >
                          <i className="bi bi-check-circle"></i> 有効化
                        </button>
                      )}
                      <button
                        onClick={closeDetail}
                        className="ml-auto px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
                      >
                        閉じる
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Create Modal ===== */}
      {showCreate && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-black text-slate-800">
                <i className="bi bi-plus-circle text-indigo-500 mr-2"></i>
                配布禁止物件の新規登録
              </h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <i className="bi bi-x-lg text-slate-500 text-lg"></i>
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">都道府県</label>
                  <select
                    value={createForm.prefectureId}
                    onChange={e => handleCreatePrefChange(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="">未選択</option>
                    {prefectures.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">市区町村</label>
                  <select
                    value={createForm.cityId}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, cityId: e.target.value }))}
                    className={SELECT_CLS}
                    disabled={!createForm.prefectureId}
                  >
                    <option value="">未選択</option>
                    {createCities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">住所 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={createForm.address}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, address: e.target.value }))}
                    className={INPUT_CLS}
                    placeholder="例: 渋谷区渋谷1-2-3"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">建物名</label>
                  <input
                    type="text"
                    value={createForm.buildingName}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, buildingName: e.target.value }))}
                    className={INPUT_CLS}
                    placeholder="例: ABCマンション"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">部屋番号</label>
                  <input
                    type="text"
                    value={createForm.roomNumber}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, roomNumber: e.target.value }))}
                    className={INPUT_CLS}
                    placeholder="例: 101"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">配布可能枚数</label>
                  <input
                    type="number"
                    value={createForm.unitCount}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, unitCount: e.target.value }))}
                    className={INPUT_CLS}
                    placeholder="例: 300"
                    min="0"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">重要度（誤配リスク）</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(v => {
                      const cfg = SEVERITY_CONFIG[v];
                      const selected = Number(createForm.severity) === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCreateForm((f: Record<string, any>) => ({ ...f, severity: String(v) }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                            selected
                              ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current`
                              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <i className={`bi ${cfg.icon} block text-sm mb-0.5`}></i>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">郵便番号</label>
                  <input
                    type="text"
                    value={createForm.postalCode}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, postalCode: e.target.value }))}
                    className={INPUT_CLS}
                    placeholder="123-4567"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">禁止理由</label>
                  <select
                    value={createForm.prohibitedReasonId}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, prohibitedReasonId: e.target.value }))}
                    className={SELECT_CLS}
                  >
                    <option value="">未選択</option>
                    {reasons.filter(r => r.isActive).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 mb-2 block">
                    <i className="bi bi-geo-alt text-rose-500 mr-1"></i>位置情報（地図をクリックまたはピンをドラッグ）
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 mb-0.5 block">緯度</label>
                      <input
                        type="number"
                        step="any"
                        value={createForm.latitude}
                        onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, latitude: e.target.value }))}
                        className={INPUT_CLS + ' !py-2 !text-xs'}
                        placeholder="35.6580"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 mb-0.5 block">経度</label>
                      <input
                        type="number"
                        step="any"
                        value={createForm.longitude}
                        onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, longitude: e.target.value }))}
                        className={INPUT_CLS + ' !py-2 !text-xs'}
                        placeholder="139.7016"
                      />
                    </div>
                  </div>
                  {isLoaded && (
                    <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '250px' }}>
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={
                          createForm.latitude && createForm.longitude
                            ? { lat: Number(createForm.latitude), lng: Number(createForm.longitude) }
                            : TOKYO_CENTER
                        }
                        zoom={15}
                        onClick={(e) => {
                          if (e.latLng) {
                            setCreateForm((f: Record<string, any>) => ({
                              ...f,
                              latitude: e.latLng!.lat().toFixed(7),
                              longitude: e.latLng!.lng().toFixed(7),
                            }));
                          }
                        }}
                        options={{
                          streetViewControl: false,
                          mapTypeControl: false,
                          fullscreenControl: false,
                          zoomControl: true,
                        }}
                      >
                        {createForm.latitude && createForm.longitude && (
                          <Marker
                            position={{ lat: Number(createForm.latitude), lng: Number(createForm.longitude) }}
                            draggable={true}
                            onDragEnd={(e) => {
                              if (e.latLng) {
                                setCreateForm((f: Record<string, any>) => ({
                                  ...f,
                                  latitude: e.latLng!.lat().toFixed(7),
                                  longitude: e.latLng!.lng().toFixed(7),
                                }));
                              }
                            }}
                            icon={{
                              path: google.maps.SymbolPath.CIRCLE,
                              scale: 10,
                              fillColor: '#dc2626',
                              fillOpacity: 0.9,
                              strokeColor: '#991b1b',
                              strokeWeight: 2,
                            }}
                          />
                        )}
                      </GoogleMap>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">理由詳細</label>
                  <textarea
                    value={createForm.reasonDetail}
                    onChange={e => setCreateForm((f: Record<string, any>) => ({ ...f, reasonDetail: e.target.value }))}
                    className={INPUT_CLS + ' min-h-[80px]'}
                    rows={3}
                    placeholder="禁止理由の詳細を入力..."
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
              >
                キャンセル
              </button>
              <button
                onClick={submitCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <><i className="bi bi-arrow-repeat animate-spin"></i>登録中...</>
                ) : (
                  <><i className="bi bi-check-lg"></i>登録する</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ===== Draw Create Modal (ポリゴン描画で禁止エリア登録) ===== */}
      {showDrawCreate && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-in slide-in-from-bottom-4 fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-black text-slate-800">
                <i className="bi bi-pentagon text-rose-500 mr-2"></i>
                地図で禁止エリアを指定
              </h2>
              <button onClick={closeDrawCreate} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <i className="bi bi-x-lg text-slate-500 text-lg"></i>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Instruction */}
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                <p className="text-sm text-indigo-800 font-bold mb-1">
                  <i className="bi bi-info-circle mr-1"></i> 操作方法
                </p>
                <p className="text-xs text-indigo-700">
                  地図上でクリックしてポリゴン（多角形）を描画してください。頂点をクリックで追加し、最初の頂点をクリックすると閉じます。
                  描画後はドラッグや頂点の移動で調整できます。
                </p>
              </div>

              {/* Map with DrawingManager */}
              {isLoaded ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 relative" style={{ height: '450px' }}>
                  {drawnPolygonPaths.length > 0 && (
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        onClick={clearDrawnPolygon}
                        className="bg-white hover:bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border border-rose-200 transition-colors"
                      >
                        <i className="bi bi-arrow-counterclockwise mr-1"></i>描画をリセット
                      </button>
                    </div>
                  )}
                  {drawnPolygonPaths.length > 0 && (
                    <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700">
                        <i className="bi bi-check-circle-fill mr-1"></i>
                        ポリゴン描画完了（{drawnPolygonPaths.length}頂点）
                      </p>
                    </div>
                  )}
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={TOKYO_CENTER}
                    zoom={13}
                    onLoad={(map) => { drawMapRef.current = map; }}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: true,
                      zoomControl: true,
                    }}
                  >
                    {drawnPolygonPaths.length === 0 && (
                      <DrawingManager
                        onPolygonComplete={onPolygonComplete}
                        options={{
                          drawingMode: google.maps.drawing.OverlayType.POLYGON,
                          drawingControl: false,
                          polygonOptions: {
                            fillColor: '#dc2626',
                            fillOpacity: 0.2,
                            strokeColor: '#dc2626',
                            strokeWeight: 2,
                            editable: true,
                            draggable: true,
                          },
                        }}
                      />
                    )}
                  </GoogleMap>
                </div>
              ) : (
                <div className="h-[450px] bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                  <i className="bi bi-geo-alt text-2xl mr-2"></i>地図を読み込み中...
                </div>
              )}

              {/* GeoJSON Preview */}
              {drawnPolygonPaths.length >= 3 && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 mb-1">
                    <i className="bi bi-braces mr-1"></i>GeoJSON プレビュー
                  </p>
                  <p className="text-xs text-slate-600 font-mono break-all max-h-[60px] overflow-y-auto">
                    {polygonPathsToGeoJSON(drawnPolygonPaths).substring(0, 200)}...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    中心座標: {(() => {
                      const c = calculatePolygonCenter(drawnPolygonPaths);
                      return c ? `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` : '-';
                    })()}
                  </p>
                </div>
              )}

              {/* Form fields */}
              <div>
                <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                  <i className="bi bi-building text-indigo-500"></i> 禁止エリア情報
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">都道府県</label>
                    <select
                      value={drawCreateForm.prefectureId}
                      onChange={e => handleDrawCreatePrefChange(e.target.value)}
                      className={SELECT_CLS}
                    >
                      <option value="">未選択</option>
                      {prefectures.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">市区町村</label>
                    <select
                      value={drawCreateForm.cityId}
                      onChange={e => setDrawCreateForm((f: Record<string, any>) => ({ ...f, cityId: e.target.value }))}
                      className={SELECT_CLS}
                      disabled={!drawCreateForm.prefectureId}
                    >
                      <option value="">未選択</option>
                      {drawCreateCities.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">住所・エリア名 <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      value={drawCreateForm.address}
                      onChange={e => setDrawCreateForm((f: Record<string, any>) => ({ ...f, address: e.target.value }))}
                      className={INPUT_CLS}
                      placeholder="例: 渋谷区渋谷1丁目一帯"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">建物名 / エリア詳細</label>
                    <input
                      type="text"
                      value={drawCreateForm.buildingName}
                      onChange={e => setDrawCreateForm((f: Record<string, any>) => ({ ...f, buildingName: e.target.value }))}
                      className={INPUT_CLS}
                      placeholder="例: ◯◯団地全域"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">郵便番号</label>
                    <input
                      type="text"
                      value={drawCreateForm.postalCode}
                      onChange={e => setDrawCreateForm((f: Record<string, any>) => ({ ...f, postalCode: e.target.value }))}
                      className={INPUT_CLS}
                      placeholder="123-4567"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">禁止理由</label>
                    <select
                      value={drawCreateForm.prohibitedReasonId}
                      onChange={e => setDrawCreateForm((f: Record<string, any>) => ({ ...f, prohibitedReasonId: e.target.value }))}
                      className={SELECT_CLS}
                    >
                      <option value="">未選択</option>
                      {reasons.filter(r => r.isActive).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">理由詳細</label>
                    <textarea
                      value={drawCreateForm.reasonDetail}
                      onChange={e => setDrawCreateForm((f: Record<string, any>) => ({ ...f, reasonDetail: e.target.value }))}
                      className={INPUT_CLS + ' min-h-[80px]'}
                      rows={3}
                      placeholder="禁止理由の詳細を入力..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={closeDrawCreate}
                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200"
              >
                キャンセル
              </button>
              <button
                onClick={submitDrawCreate}
                disabled={drawCreating || drawnPolygonPaths.length < 3}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {drawCreating ? (
                  <><i className="bi bi-arrow-repeat animate-spin"></i>登録中...</>
                ) : (
                  <><i className="bi bi-pentagon"></i>禁止エリアを登録</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Sub-components =====
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5">{value || '-'}</p>
    </div>
  );
}
