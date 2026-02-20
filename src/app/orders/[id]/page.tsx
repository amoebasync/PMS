'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { GoogleMap, useJsApiLoader, Polygon, Circle, Marker } from '@react-google-maps/api';
import * as turf from '@turf/turf';

const mapContainerStyle = { width: '100%', height: '100%' };
const initialCenter = { lat: 35.6581, lng: 139.7414 }; // 東京タワー

const LIBRARIES: ("geometry" | "drawing" | "places")[] = ["geometry"];

const extractPaths = (geojsonStr: string, areaName: string = '') => {
  if (!geojsonStr) return [];
  const trimmed = geojsonStr.trim();
  
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const getCoords = (geom: any): any[][] => {
        if (!geom) return [];
        if (geom.type === 'FeatureCollection') return geom.features.flatMap((f: any) => getCoords(f.geometry || f));
        if (geom.type === 'Feature') return getCoords(geom.geometry);
        if (geom.type === 'GeometryCollection') return geom.geometries.flatMap((g: any) => getCoords(g));
        if (geom.type === 'Polygon') return [geom.coordinates[0]];
        if (geom.type === 'MultiPolygon') return geom.coordinates.map((poly: any[]) => poly[0]);
        return [];
      };
      const rawPolygons = getCoords(parsed);
      const paths = rawPolygons.map(poly => 
        poly.map((c: any[]) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) })).filter((c: any) => !isNaN(c.lat) && !isNaN(c.lng))
      );
      return paths.length > 0 ? paths : [];
    } catch (e) {}
  }
  
  if (trimmed.includes('|') && !/[a-zA-Z]/.test(trimmed)) {
    try {
      const paths = trimmed.split('|').map(point => {
        const parts = point.split(/[,\s]+/).filter(Boolean);
        if (parts.length >= 2) return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
        return null;
      }).filter(p => p !== null) as {lat: number, lng: number}[];
      return paths.length > 0 ? [paths.map(p => ({ lat: p.lat < 90 ? p.lat : p.lng, lng: p.lat > 90 ? p.lat : p.lng }))] : [];
    } catch(e) { return []; }
  }

  try {
    const sanitizedStr = trimmed.replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\f/g, '\\f');
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.geometry) {
      try {
        return [window.google.maps.geometry.encoding.decodePath(trimmed).map(p => ({ lat: p.lat(), lng: p.lng() }))];
      } catch (err) {
        return [window.google.maps.geometry.encoding.decodePath(sanitizedStr).map(p => ({ lat: p.lat(), lng: p.lng() }))];
      }
    }
  } catch (e) {}
  return [];
};

const createTurfFeature = (paths: any[][]) => {
  if (!paths || paths.length === 0 || paths[0].length < 3) return null;
  const coords = paths[0].map((p: any) => [p.lng, p.lat]);
  const first = coords[0], last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first]);
  if (coords.length >= 4) {
    try { return turf.polygon([coords]); } catch (e) { return null; }
  }
  return null;
};

const calcCenterAndSize = (feature: any) => {
  if (!feature) return null;
  try {
    const center = turf.centerOfMass(feature);
    const areaSqM = turf.area(feature);
    let fontSize = '10px';
    if (areaSqM < 20000) fontSize = '8px';
    else if (areaSqM < 50000) fontSize = '10px';
    else if (areaSqM < 150000) fontSize = '12px';
    else fontSize = '14px';
    return { lat: center.geometry.coordinates[1], lng: center.geometry.coordinates[0], fontSize };
  } catch(e) { return null; }
};

const MemoizedArea = React.memo(({ area, isSelected, currentZoom, onClick }: { area: any, isSelected: boolean, currentZoom: number, onClick: (id: number) => void }) => {
  if (!area.parsedPaths || area.parsedPaths.length === 0) return null;
  return (
    <React.Fragment>
      <Polygon
        paths={area.parsedPaths}
        options={{
          fillColor: isSelected ? '#3b82f6' : '#94a3b8',
          fillOpacity: isSelected ? 0.6 : 0.2,
          strokeColor: isSelected ? '#1d4ed8' : '#64748b',
          strokeWeight: isSelected ? 2 : 1,
        }}
        onClick={() => onClick(area.id)}
      />
      {currentZoom >= 14 && area.centerLabel && (
        <Marker
          position={{ lat: area.centerLabel.lat, lng: area.centerLabel.lng }}
          icon={{ url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E" }}
          label={{
            text: area.chome_name || area.town_name || '',
            color: isSelected ? '#1e3a8a' : '#475569',
            fontSize: area.centerLabel.fontSize,
            fontWeight: 'bold',
          }}
          options={{ clickable: false }}
        />
      )}
    </React.Fragment>
  );
}, (prev, next) => prev.isSelected === next.isSelected && (prev.currentZoom >= 14) === (next.currentZoom >= 14));


export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const isNew = id === 'new';
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('BASIC'); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customerFlyers, setCustomerFlyers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  const [locations, setLocations] = useState<any[]>([]);
  const [selectedPref, setSelectedPref] = useState<number | null>(13); 
  const [selectedPanelCities, setSelectedPanelCities] = useState<Set<string>>(new Set());

  // ★ 追加: チラシ登録モーダル用のState
  const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
  const [flyerMasters, setFlyerMasters] = useState({ industries: [], sizes: [] });
  const [newFlyerForm, setNewFlyerForm] = useState({
    name: '', flyerCode: '', bundleCount: '', industryId: '', sizeId: '', foldStatus: 'NO_FOLDING_REQUIRED', remarks: ''
  });
  const [isSavingFlyer, setIsSavingFlyer] = useState(false);
  const [activeFlyerSelectTab, setActiveFlyerSelectTab] = useState<'DIST' | 'PRINT'>('DIST');

  // --- 各タブのフォームState ---
  const [formData, setFormData] = useState({
    orderNo: '', customerId: '', salesRepId: '', orderDate: new Date().toISOString().split('T')[0],
    totalAmount: '', status: 'PLANNING', remarks: ''
  });

  const [distForm, setDistForm] = useState({
    id: '', flyerId: '', method: '軒並み配布', plannedCount: '', startDate: '', endDate: '', spareDate: '', remarks: ''
  });

  const [printForm, setPrintForm] = useState({
    id: '', flyerId: '', partnerId: '', printCount: '', paperType: 'コート紙', paperWeight: '90kg', colorType: '両面カラー', orderDate: '', expectedDeliveryDate: '', status: 'UNORDERED'
  });

  const [newsForm, setNewsForm] = useState({
    id: '', partnerId: '', insertDate: '', plannedCount: '', newspaperName: '', areaSpecification: '', status: 'UNORDERED'
  });

  const [designForm, setDesignForm] = useState({
    id: '', partnerId: '', employeeId: '', designConcept: '', firstDraftDeadline: '', finalDeadline: '', status: 'NOT_STARTED'
  });

  const [mapAreas, setMapAreas] = useState<any[]>([]);
  const [loadedCities, setLoadedCities] = useState<Set<string>>(new Set());
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<number>>(new Set());
  
  const [searchAddress, setSearchAddress] = useState('');
  const [radiusKm, setRadiusKm] = useState<number | 'ALL'>(1);
  const [mapZoom, setMapZoom] = useState(14);
  const [currentZoom, setCurrentZoom] = useState(14);
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [searchMarker, setSearchMarker] = useState<{lat: number, lng: number} | null>(null);
  
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
    language: 'ja',
    region: 'JP',
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // ★ 修正: fetch('/api/flyers/masters') もここで一緒に呼び出す
        const [custRes, empRes, locRes, partRes, flyerMasterRes] = await Promise.all([ 
          fetch('/api/customers'), 
          fetch('/api/employees'),
          fetch('/api/locations'),
          fetch('/api/partners'),
          fetch('/api/flyers/masters')
        ]);
        if (custRes.ok) setCustomers(await custRes.json());
        if (empRes.ok) setEmployees((await empRes.json()).filter((e:any) => e.isActive));
        if (locRes.ok) setLocations(await locRes.json());
        if (partRes.ok) setPartners(await partRes.json());
        if (flyerMasterRes.ok) {
          const fm = await flyerMasterRes.json();
          setFlyerMasters({ industries: fm.industries || [], sizes: fm.sizes || [] });
        }

        if (!isNew) {
          const orderRes = await fetch(`/api/orders/${id}`);
          if (orderRes.ok) {
            const order = await orderRes.json();
            setFormData({
              orderNo: order.orderNo, customerId: order.customerId?.toString() || '', salesRepId: order.salesRepId?.toString() || '',
              orderDate: order.orderDate ? order.orderDate.split('T')[0] : '', totalAmount: order.totalAmount?.toString() || '',
              status: order.status, remarks: order.remarks || ''
            });
            if (order.customerId) {
              const flyerRes = await fetch(`/api/flyers/customer/${order.customerId}`);
              if (flyerRes.ok) setCustomerFlyers(await flyerRes.json());
            }
            
            if (order.distributions && order.distributions.length > 0) {
              const dist = order.distributions[0];
              setDistForm({
                id: dist.id?.toString() || '',
                flyerId: dist.flyerId?.toString() || '', method: dist.method, plannedCount: dist.plannedCount?.toString() || '',
                startDate: dist.startDate ? dist.startDate.split('T')[0] : '', endDate: dist.endDate ? dist.endDate.split('T')[0] : '',
                spareDate: dist.spareDate ? dist.spareDate.split('T')[0] : '', remarks: dist.remarks || ''
              });
              if (dist.areas && dist.areas.length > 0) {
                setSelectedAreaIds(new Set(dist.areas.map((a:any) => a.areaId)));
              }
            }
            if (order.printings && order.printings.length > 0) {
              const pr = order.printings[0];
              setPrintForm({
                id: pr.id?.toString() || '', flyerId: pr.flyerId?.toString() || '', partnerId: pr.partnerId?.toString() || '',
                printCount: pr.printCount?.toString() || '', paperType: pr.paperType || '', paperWeight: pr.paperWeight || '', colorType: pr.colorType || '',
                orderDate: pr.orderDate ? pr.orderDate.split('T')[0] : '', expectedDeliveryDate: pr.expectedDeliveryDate ? pr.expectedDeliveryDate.split('T')[0] : '', status: pr.status || 'UNORDERED'
              });
            }
            if (order.newspaperInserts && order.newspaperInserts.length > 0) {
              const nw = order.newspaperInserts[0];
              setNewsForm({
                id: nw.id?.toString() || '', partnerId: nw.partnerId?.toString() || '', insertDate: nw.insertDate ? nw.insertDate.split('T')[0] : '',
                plannedCount: nw.plannedCount?.toString() || '', newspaperName: nw.newspaperName || '', areaSpecification: nw.areaSpecification || '', status: nw.status || 'UNORDERED'
              });
            }
            if (order.designs && order.designs.length > 0) {
              const ds = order.designs[0];
              setDesignForm({
                id: ds.id?.toString() || '', partnerId: ds.partnerId?.toString() || '', employeeId: ds.employeeId?.toString() || '',
                designConcept: ds.designConcept || '', firstDraftDeadline: ds.firstDraftDeadline ? ds.firstDraftDeadline.split('T')[0] : '',
                finalDeadline: ds.finalDeadline ? ds.finalDeadline.split('T')[0] : '', status: ds.status || 'NOT_STARTED'
              });
            }
          }
        }
      } catch (e) { console.error(e); }
      setIsLoading(false);
    };
    fetchInitialData();
  }, [id, isNew]);

  // ★ 追加: 新規チラシの保存＆自動選択ロジック
  const saveNewFlyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingFlyer(true);
    try {
      const payload = { ...newFlyerForm, customerId: formData.customerId };
      const res = await fetch('/api/flyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'チラシの登録に失敗しました。');
      }
      
      const newFlyer = await res.json();
      
      // 顧客のチラシリストを再取得
      const flyerRes = await fetch(`/api/flyers/customer/${formData.customerId}`);
      if (flyerRes.ok) setCustomerFlyers(await flyerRes.json());
      
      // 呼び出し元のプルダウンに即座にセット
      if (activeFlyerSelectTab === 'DIST') {
        setDistForm(prev => ({ ...prev, flyerId: newFlyer.id.toString() }));
      } else if (activeFlyerSelectTab === 'PRINT') {
        setPrintForm(prev => ({ ...prev, flyerId: newFlyer.id.toString() }));
      }

      setIsFlyerModalOpen(false);
      setNewFlyerForm({ name: '', flyerCode: '', bundleCount: '', industryId: '', sizeId: '', foldStatus: 'NO_FOLDING_REQUIRED', remarks: '' });
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingFlyer(false);
    }
  };

  const fetchAreasForLocation = useCallback((lat: number, lng: number, onFetched?: (newAreas: any[], pref: string, city: string) => void) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
      if (status === 'OK' && results && results[0]) {
        let cityName = '', prefName = '';
        for (const component of results[0].address_components) {
          if (component.types.includes('administrative_area_level_1')) prefName = component.long_name;
          if ((component.types.includes('locality') || component.types.includes('ward') || /(区|市|町|村)$/.test(component.long_name)) && !component.types.includes('administrative_area_level_1')) {
            cityName = component.long_name;
          }
        }
        const cacheKey = `${prefName}_${cityName}`;
        if (cityName && !loadedCities.has(cacheKey)) {
          setLoadedCities(prev => new Set(prev).add(cacheKey));
          try {
            const query = new URLSearchParams();
            if (prefName) query.append('prefName', prefName);
            if (cityName) query.append('cityName', cityName);
            const res = await fetch(`/api/areas/map?${query.toString()}`);
            const data = await res.json();
            if (Array.isArray(data)) {
              const enrichedData = data.map(a => {
                const paths = extractPaths(a.boundary_geojson, a.town_name);
                const feature = createTurfFeature(paths);
                return { ...a, parsedPaths: paths, turfFeature: feature, centerLabel: calcCenterAndSize(feature) };
              }).filter(a => a.parsedPaths && a.parsedPaths.length > 0);
              setMapAreas(prev => {
                const existingIds = new Set(prev.map(a => a.id));
                const newAreas = enrichedData.filter(a => !existingIds.has(a.id));
                if (onFetched) onFetched([...prev, ...newAreas], prefName, cityName); 
                return [...prev, ...newAreas];
              });
            }
          } catch (e) {}
        } else {
          if (onFetched) onFetched(mapAreas, prefName, cityName);
        }
      }
    });
  }, [loadedCities, mapAreas]);

  useEffect(() => {
    if (activeTab === 'DIST' && isLoaded && mapAreas.length === 0) {
      fetchAreasForLocation(initialCenter.lat, initialCenter.lng);
    }
  }, [activeTab, isLoaded, fetchAreasForLocation, mapAreas.length]);

  const handleMapIdle = () => {
    if (mapRef) {
      const center = mapRef.getCenter();
      if (center) fetchAreasForLocation(center.lat(), center.lng());
    }
  };

  const handleSearchAndSelect = () => {
    if (!searchAddress || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat(), lng = location.lng();
        setMapCenter({ lat, lng });
        setSearchMarker({ lat, lng });
        if (radiusKm === 'ALL') setMapZoom(13);
        else {
          const r = Number(radiusKm);
          if (r === 1) setMapZoom(14); else if (r === 2) setMapZoom(13); else if (r === 3) setMapZoom(12); else setMapZoom(11);
        }
        fetchAreasForLocation(lat, lng, (currentAreas, geoPrefName, geoCityName) => {
          const newSelected = new Set<number>();
          if (radiusKm === 'ALL') {
            const cleanPrefName = geoPrefName ? geoPrefName.replace(/(都|道|府|県)$/gi, '') : '';
            const cleanCityName = geoCityName ? geoCityName.replace(/(区|市|City|Ku|Ward|Town|Village|\s)/gi, '') : '';
            currentAreas.forEach(area => {
              const matchPref = !cleanPrefName || (area.prefecture?.name && area.prefecture.name.includes(cleanPrefName));
              const matchCity = !cleanCityName || (area.city?.name && area.city.name.includes(cleanCityName));
              if (matchPref && matchCity) newSelected.add(area.id);
            });
          } else {
            const centerPoint = turf.point([lng, lat]);
            const searchCircle = turf.circle(centerPoint, Number(radiusKm), { steps: 64, units: 'kilometers' });
            currentAreas.forEach(area => {
              if (area.turfFeature && turf.booleanIntersects(searchCircle, area.turfFeature)) newSelected.add(area.id);
            });
          }
          setSelectedAreaIds(newSelected);
        });
      } else alert('入力された住所が見つかりませんでした。');
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault(); handleSearchAndSelect();
    }
  };

  const handleCityPanelClick = async (prefName: string, cityName: string) => {
    const address = `${prefName}${cityName}`;
    const cacheKey = `${prefName}_${cityName}`;
    setRadiusKm('ALL'); setSearchMarker(null); setSearchAddress(''); setMapZoom(12);
    const isCurrentlySelected = selectedPanelCities.has(cacheKey);
    setSelectedPanelCities(prev => {
      const next = new Set(prev);
      if (isCurrentlySelected) next.delete(cacheKey); else next.add(cacheKey);
      return next;
    });

    if (!isCurrentlySelected && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK' && results && results[0]) setMapCenter({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
      });
    }

    let targetAreas = mapAreas;
    if (!loadedCities.has(cacheKey)) {
      setLoadedCities(prev => new Set(prev).add(cacheKey));
      try {
        const query = new URLSearchParams();
        if (prefName) query.append('prefName', prefName);
        if (cityName) query.append('cityName', cityName);
        const res = await fetch(`/api/areas/map?${query.toString()}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const enrichedData = data.map(a => {
            const paths = extractPaths(a.boundary_geojson, a.town_name);
            const feature = createTurfFeature(paths);
            return { ...a, parsedPaths: paths, turfFeature: feature, centerLabel: calcCenterAndSize(feature) };
          }).filter(a => a.parsedPaths && a.parsedPaths.length > 0);
          setMapAreas(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newAreas = enrichedData.filter(a => !existingIds.has(a.id));
            targetAreas = [...prev, ...newAreas];
            return targetAreas;
          });
        }
      } catch (e) {}
    }

    const cleanPrefName = prefName.replace(/(都|道|府|県)$/gi, '');
    const cleanCityName = cityName.replace(/(区|市|町|村)$/gi, '');
    setSelectedAreaIds(prev => {
      const next = new Set(prev);
      targetAreas.forEach(area => {
        if ((area.prefecture?.name && area.prefecture.name.includes(cleanPrefName)) && (area.city?.name && area.city.name.includes(cleanCityName))) {
          if (isCurrentlySelected) next.delete(area.id); else next.add(area.id);
        }
      });
      return next;
    });
  };

  const toggleAreaSelection = useCallback((areaId: number) => {
    setSelectedAreaIds(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId); else next.add(areaId);
      return next;
    });
  }, []);

  const handleClearAll = () => {
    setSelectedAreaIds(new Set()); setSelectedPanelCities(new Set()); setSearchMarker(null); setSearchAddress(''); setRadiusKm(1);
  };

  const saveTabInfo = async (tabName: string, dataToSave: any) => {
    try {
      const payload = { ...dataToSave, tab: tabName };
      const res = await fetch(isNew && tabName === 'BASIC' ? '/api/orders' : `/api/orders/${id}`, {
        method: isNew && tabName === 'BASIC' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedData = await res.json();
        alert(`${TABS.find(t => t.id === tabName)?.label} を保存しました！`);
        
        if (isNew && tabName === 'BASIC') {
          router.push(`/orders/${savedData.id}`);
        } else {
          if (tabName === 'DIST') setDistForm(p => ({ ...p, id: savedData.id.toString() }));
          if (tabName === 'PRINT') setPrintForm(p => ({ ...p, id: savedData.id.toString() }));
          if (tabName === 'NEWS') setNewsForm(p => ({ ...p, id: savedData.id.toString() }));
          if (tabName === 'DESIGN') setDesignForm(p => ({ ...p, id: savedData.id.toString() }));
        }
      } else {
        alert('保存に失敗しました');
      }
    } catch (err) { alert('通信エラーが発生しました'); }
  };

  const getAreaCapacity = (a: any) => {
    if (distForm.method === '軒並み配布') return a.door_to_door_count || 0;
    if (distForm.method === '集合住宅限定') return a.multi_family_count || 0;
    if (distForm.method === '戸建限定') return Math.max(0, (a.door_to_door_count || 0) - (a.multi_family_count || 0));
    return a.posting_cap_with_ng || 0;
  };

  const selectedAreasList = mapAreas.filter(a => selectedAreaIds.has(a.id));
  const totalCapacity = selectedAreasList.reduce((sum, a) => sum + getAreaCapacity(a), 0);

  const plannedCount = parseInt(distForm.plannedCount) || 0;
  const isCapacityEnough = plannedCount > 0 && totalCapacity >= plannedCount;

  const TABS = [
    { id: 'BASIC', label: '基本情報', icon: 'bi-info-circle' },
    { id: 'DIST', label: 'ポスティング', icon: 'bi-send' },
    { id: 'PRINT', label: '印刷手配', icon: 'bi-printer' },
    { id: 'NEWS', label: '新聞折込', icon: 'bi-newspaper' },
    { id: 'DESIGN', label: 'デザイン', icon: 'bi-palette' },
  ];

  if (isLoading) return <div className="p-10 text-center">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Link href="/orders" className="text-sm text-indigo-600 hover:underline mb-2 inline-block"><i className="bi bi-arrow-left"></i> 戻る</Link>
          <h1 className="text-2xl font-bold text-slate-800">
            {isNew ? '新規受注の登録' : `受注詳細: ${formData.orderNo}`}
          </h1>
        </div>
      </div>

      <div className="flex border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} disabled={isNew && tab.id !== 'BASIC'} 
              className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all whitespace-nowrap ${
                isActive ? 'border-indigo-600 text-indigo-600' : 
                isNew && tab.id !== 'BASIC' ? 'border-transparent text-slate-300 cursor-not-allowed' :
                'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <i className={`bi ${tab.icon}`}></i> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        
        {/* --- 基本情報タブ --- */}
        {activeTab === 'BASIC' && (
          <form onSubmit={(e) => { e.preventDefault(); saveTabInfo('BASIC', formData); }} className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-2 gap-6">
              {!isNew && (
                <div><label className="text-xs font-bold text-slate-600 block mb-1">受注番号</label><input name="orderNo" value={formData.orderNo} onChange={e => setFormData({...formData, orderNo: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 font-mono" readOnly /></div>
              )}
              <div className={isNew ? 'col-span-2' : ''}>
                <label className="text-xs font-bold text-slate-600 block mb-1">顧客 (クライアント) *</label>
                <select required value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">担当営業</label>
                <select value={formData.salesRepId} onChange={e => setFormData({...formData, salesRepId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">受注日 *</label><input type="date" required value={formData.orderDate} onChange={e => setFormData({...formData, orderDate: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">受注総額 (円)</label><input type="number" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" placeholder="例: 150000" /></div>
            </div>
            <div className="pt-4 border-t flex justify-end">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg">{isNew ? '基本情報を登録して次へ' : '基本情報を更新する'}</button>
            </div>
          </form>
        )}

        {/* --- 配布タブ --- */}
        {activeTab === 'DIST' && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-indigo-700 mb-4 flex items-center gap-2"><i className="bi bi-1-circle-fill"></i> 配布条件・チラシの設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-slate-600 block mb-1">配布するチラシ *</label>
                  {/* ★ 変更: 新規作成ボタンをインライン(モーダル起動)に変更 */}
                  <div className="flex gap-2">
                    <select required value={distForm.flyerId} onChange={e => setDistForm({...distForm, flyerId: e.target.value})} className="flex-1 border p-2.5 rounded-lg text-sm bg-white font-bold text-slate-700">
                      <option value="">-- この顧客のチラシから選択 --</option>
                      {customerFlyers.map(f => (
                        <option key={f.id} value={f.id}>{f.name} (有効在庫: {f.stockCount.toLocaleString()}枚 / {f.size?.name})</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      disabled={!formData.customerId}
                      onClick={() => { setActiveFlyerSelectTab('DIST'); setIsFlyerModalOpen(true); }}
                      className="bg-fuchsia-100 text-fuchsia-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-fuchsia-200 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + 新規作成
                    </button>
                  </div>
                  {!formData.customerId && <p className="text-[10px] text-rose-500 mt-1">※チラシを新規作成するには、基本情報タブで「顧客」を登録・選択してください。</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">配布方法 *</label>
                  <select value={distForm.method} onChange={e => setDistForm({...distForm, method: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 transition-shadow">
                    <option value="軒並み配布">軒並み配布 (標準)</option>
                    <option value="戸建限定">戸建限定</option>
                    <option value="集合住宅限定">集合住宅限定</option>
                    <option value="事業所限定">事業所限定</option>
                  </select>
                </div>
                <div><label className="text-xs font-bold text-slate-600 block mb-1">配布予定枚数 *</label><input type="number" required value={distForm.plannedCount} onChange={e => setDistForm({...distForm, plannedCount: e.target.value})} className="w-full border p-2.5 rounded-lg text-lg font-bold text-indigo-600 text-right pr-4" placeholder="10000" /></div>
                <div><label className="text-xs font-bold text-slate-600 block mb-1">配布開始日</label><input type="date" value={distForm.startDate} onChange={e => setDistForm({...distForm, startDate: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="text-xs font-bold text-slate-600 block mb-1">完了期限日 *</label><input type="date" required value={distForm.endDate} onChange={e => setDistForm({...distForm, endDate: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
                  <div className="flex-1"><label className="text-xs font-bold text-rose-500 block mb-1">予備期限 (雨天順延など)</label><input type="date" value={distForm.spareDate} onChange={e => setDistForm({...distForm, spareDate: e.target.value})} className="w-full border border-rose-200 p-2.5 rounded-lg text-sm bg-rose-50" /></div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              {/* マップ操作部分 */}
              <div className="bg-slate-800 p-4 text-white flex flex-wrap gap-4 justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 whitespace-nowrap"><i className="bi bi-2-circle-fill"></i> マップによるエリア選択</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <i className="bi bi-geo-alt absolute left-3 top-2.5 text-slate-400"></i>
                    <input type="text" placeholder="住所で検索 (例: 新宿区高田馬場)" value={searchAddress} onChange={e => setSearchAddress(e.target.value)} onKeyDown={handleKeyDown} className="pl-9 pr-3 py-2 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900" style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }} />
                  </div>
                  <select value={radiusKm} onChange={e => setRadiusKm(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className="px-3 py-2 rounded-lg text-sm outline-none text-slate-900" style={{ backgroundColor: '#ffffff' }}>
                    <option value={1}>半径 1km</option><option value={2}>半径 2km</option><option value={3}>半径 3km</option><option value={5}>半径 5km</option><option value="ALL">市区町村 全域</option>
                  </select>
                  <button type="button" onClick={handleSearchAndSelect} className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors">検索 ＆ エリア選択</button>
                  <button type="button" onClick={handleClearAll} className="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded-lg text-sm font-bold transition-colors ml-2">クリア</button>
                </div>
              </div>
              
              {/* マップ描画部分 */}
              <div className="h-[600px] w-full bg-slate-100 relative">
                {!isLoaded ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold"><i className="bi bi-arrow-repeat animate-spin mr-2"></i>地図を読み込んでいます...</div>
                ) : (
                  <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={mapZoom} options={{ mapTypeControl: false, streetViewControl: false }} onLoad={map => setMapRef(map)} onIdle={handleMapIdle} onZoomChanged={() => { if(mapRef) setCurrentZoom(mapRef.getZoom() || 14) }}>
                    {searchMarker && <Marker position={searchMarker} />}
                    {searchMarker && radiusKm !== 'ALL' && <Circle center={searchMarker} radius={Number(radiusKm) * 1000} options={{ fillColor: '#10b981', fillOpacity: 0.1, strokeColor: '#059669', strokeWeight: 2, borderStyle: 'dashed', clickable: false }} />}
                    {mapAreas.map(area => <MemoizedArea key={area.id} area={area} isSelected={selectedAreaIds.has(area.id)} currentZoom={currentZoom} onClick={toggleAreaSelection} />)}
                  </GoogleMap>
                )}
                
                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur p-5 rounded-2xl shadow-2xl border border-slate-200 w-80 flex flex-col max-h-[500px]">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-2 flex justify-between shrink-0">
                    エリア選択状況<span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px]">{selectedAreaIds.size} エリア</span>
                  </h4>
                  <div className="flex-1 overflow-y-auto min-h-[100px] mb-4 border border-slate-200 rounded-lg bg-slate-50 p-2 space-y-1 custom-scrollbar">
                     {selectedAreasList.length === 0 ? <div className="text-xs text-slate-400 text-center py-4">エリアが選択されていません</div> : selectedAreasList.map(a => (
                         <div key={a.id} className="flex justify-between items-center text-[11px] border-b border-slate-200 pb-1.5 pt-1 last:border-0 last:pb-0">
                           <span className="text-slate-600 truncate mr-2 font-medium" title={`${a.prefecture?.name || ''} ${a.city?.name || ''} ${a.chome_name || a.town_name || ''}`}>
                             {a.prefecture?.name || ''} {a.city?.name || ''} {a.chome_name || a.town_name || ''}
                           </span>
                           <span className="font-bold text-slate-800 whitespace-nowrap">{getAreaCapacity(a).toLocaleString()} <span className="font-normal text-[9px] text-slate-500">枚</span></span>
                         </div>
                     ))}
                  </div>
                  <div className="flex justify-between items-end mb-2 shrink-0"><span className="text-sm font-bold text-slate-600">配布方法</span><span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{distForm.method}</span></div>
                  <div className="flex justify-between items-end mb-4 shrink-0"><span className="text-sm font-bold text-slate-600">配布可能枚数 (計)</span><div className="text-right"><span className={`text-2xl font-black ${isCapacityEnough ? 'text-emerald-600' : 'text-rose-500'}`}>{totalCapacity.toLocaleString()}</span><span className="text-xs text-slate-500 ml-1">枚</span></div></div>
                  <div className="shrink-0">
                    {plannedCount > 0 && !isCapacityEnough ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-bold mb-4 flex items-start gap-2"><i className="bi bi-exclamation-triangle-fill text-rose-500 text-base"></i><p>予定枚数 ({plannedCount.toLocaleString()}枚) を下回っています。</p></div>
                    ) : plannedCount > 0 && isCapacityEnough ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-bold mb-4 flex items-center gap-2"><i className="bi bi-check-circle-fill text-emerald-500 text-base"></i><p>予定枚数をカバーするエリアが確保されました！</p></div>
                    ) : null}
                    
                    <button type="button" onClick={() => saveTabInfo('DIST', { ...distForm, areaIds: Array.from(selectedAreaIds) })} disabled={!isCapacityEnough || !distForm.flyerId} className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all ${isCapacityEnough && distForm.flyerId ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                      <i className="bi bi-cloud-arrow-up-fill mr-2"></i>配布依頼を保存する
                    </button>
                  </div>
                </div>
              </div>

              {/* 市区町村クイック選択パネル */}
              <div className="bg-white p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center text-indigo-600 mr-2"><i className="bi bi-geo-fill text-lg mr-1"></i><span className="text-sm font-bold whitespace-nowrap">対象エリアの<br/>クイック全域選択:</span></div>
                  {locations.map(pref => (
                    <button key={pref.id} type="button" onClick={() => setSelectedPref(pref.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${selectedPref === pref.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{pref.name}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar pt-1 pr-2">
                  {locations.find(p => p.id === selectedPref)?.cities.map((city: any) => {
                    const prefName = locations.find(p => p.id === selectedPref)?.name || '';
                    const cacheKey = `${prefName}_${city.name}`;
                    const isCitySelected = selectedPanelCities.has(cacheKey);
                    return (
                      <button key={city.id} type="button" onClick={() => handleCityPanelClick(prefName, city.name)} className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-sm ${isCitySelected ? 'bg-blue-100 border-blue-400 text-blue-800 ring-2 ring-blue-400 ring-offset-1' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'}`}>
                        {isCitySelected && <i className="bi bi-check2 mr-1"></i>}{city.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 印刷手配タブ --- */}
        {activeTab === 'PRINT' && (
          <div className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-slate-600 block mb-1">印刷するチラシ *</label>
                {/* ★ 変更: 新規作成ボタンを追加 */}
                <div className="flex gap-2">
                  <select value={printForm.flyerId} onChange={e => setPrintForm({...printForm, flyerId: e.target.value})} className="flex-1 border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                    <option value="">選択してください</option>
                    {customerFlyers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button 
                    type="button" 
                    disabled={!formData.customerId}
                    onClick={() => { setActiveFlyerSelectTab('PRINT'); setIsFlyerModalOpen(true); }}
                    className="bg-fuchsia-100 text-fuchsia-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-fuchsia-200 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    + 新規作成
                  </button>
                </div>
                {!formData.customerId && <p className="text-[10px] text-rose-500 mt-1">※顧客が未選択です。</p>}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-slate-600 block mb-1">印刷発注先パートナー *</label>
                <select value={printForm.partnerId} onChange={e => setPrintForm({...printForm, partnerId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {partners.filter(p => p.partnerType?.name === '印刷会社').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              
              <div><label className="text-xs font-bold text-slate-600 block mb-1">印刷枚数 *</label><input type="number" value={printForm.printCount} onChange={e => setPrintForm({...printForm, printCount: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" placeholder="例: 20000" /></div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">用紙種類</label>
                <select value={printForm.paperType} onChange={e => setPrintForm({...printForm, paperType: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white">
                  <option value="コート紙">コート紙</option><option value="マットコート紙">マットコート紙</option><option value="上質紙">上質紙</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">用紙の厚さ</label>
                <select value={printForm.paperWeight} onChange={e => setPrintForm({...printForm, paperWeight: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white">
                  <option value="73kg">73kg</option><option value="90kg">90kg</option><option value="110kg">110kg</option><option value="135kg">135kg</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">カラー設定</label>
                <select value={printForm.colorType} onChange={e => setPrintForm({...printForm, colorType: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white">
                  <option value="両面カラー">両面カラー</option><option value="片面カラー/片面モノクロ">片面カラー/片面モノクロ</option><option value="片面カラー">片面カラー</option><option value="両面モノクロ">両面モノクロ</option>
                </select>
              </div>
              
              <div><label className="text-xs font-bold text-slate-600 block mb-1">発注日</label><input type="date" value={printForm.orderDate} onChange={e => setPrintForm({...printForm, orderDate: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">納品予定日</label><input type="date" value={printForm.expectedDeliveryDate} onChange={e => setPrintForm({...printForm, expectedDeliveryDate: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
              
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">進行ステータス</label>
                <select value={printForm.status} onChange={e => setPrintForm({...printForm, status: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="UNORDERED">未発注</option><option value="ORDERED">発注済 (印刷中)</option><option value="COMPLETED">納品完了</option>
                </select>
              </div>
            </div>
            <div className="pt-4 border-t flex justify-end">
               <button type="button" onClick={() => saveTabInfo('PRINT', printForm)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg">印刷手配を保存する</button>
            </div>
          </div>
        )}

        {/* --- 新聞折込タブ --- */}
        {activeTab === 'NEWS' && (
          <div className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">折込手配パートナー</label>
                <select value={newsForm.partnerId} onChange={e => setNewsForm({...newsForm, partnerId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {partners.filter(p => p.partnerType?.name === '新聞折込').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">指定紙 (新聞名)</label><input type="text" value={newsForm.newspaperName} onChange={e => setNewsForm({...newsForm, newspaperName: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" placeholder="例: 読売・朝日・日経" /></div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">折込指定日</label><input type="date" value={newsForm.insertDate} onChange={e => setNewsForm({...newsForm, insertDate: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">折込枚数</label><input type="number" value={newsForm.plannedCount} onChange={e => setNewsForm({...newsForm, plannedCount: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" placeholder="10000" /></div>
              
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">エリア指定・特記事項</label>
                <textarea value={newsForm.areaSpecification} onChange={e => setNewsForm({...newsForm, areaSpecification: e.target.value})} rows={3} className="w-full border p-2.5 rounded-lg text-sm" placeholder="〇〇販売店管轄など" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">進行ステータス</label>
                <select value={newsForm.status} onChange={e => setNewsForm({...newsForm, status: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="UNORDERED">未手配</option><option value="ORDERED">手配済</option><option value="COMPLETED">完了</option>
                </select>
              </div>
            </div>
            <div className="pt-4 border-t flex justify-end">
               <button type="button" onClick={() => saveTabInfo('NEWS', newsForm)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg">新聞折込を保存する</button>
            </div>
          </div>
        )}

        {/* --- デザイン制作タブ --- */}
        {activeTab === 'DESIGN' && (
          <div className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">社内デザイナー</label>
                <select value={designForm.employeeId} onChange={e => setDesignForm({...designForm, employeeId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">(外注の場合は未選択)</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.lastNameJa} {emp.firstNameJa}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">外注パートナー</label>
                <select value={designForm.partnerId} onChange={e => setDesignForm({...designForm, partnerId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">(社内の場合は未選択)</option>
                  {partners.filter(p => p.partnerType?.name === 'デザイン').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              
              <div><label className="text-xs font-bold text-slate-600 block mb-1">初校 提出期限</label><input type="date" value={designForm.firstDraftDeadline} onChange={e => setDesignForm({...designForm, firstDraftDeadline: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">最終 校了期限</label><input type="date" value={designForm.finalDeadline} onChange={e => setDesignForm({...designForm, finalDeadline: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm" /></div>
              
              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">デザインコンセプト・要望</label>
                <textarea value={designForm.designConcept} onChange={e => setDesignForm({...designForm, designConcept: e.target.value})} rows={4} className="w-full border p-2.5 rounded-lg text-sm" placeholder="ターゲット層やキーカラーなど" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">進行ステータス</label>
                <select value={designForm.status} onChange={e => setDesignForm({...designForm, status: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="NOT_STARTED">未着手</option><option value="IN_PROGRESS">制作中</option><option value="CHECKING">校正中</option><option value="COMPLETED">校了 (完成)</option>
                </select>
              </div>
            </div>
            <div className="pt-4 border-t flex justify-end">
               <button type="button" onClick={() => saveTabInfo('DESIGN', designForm)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg">デザイン依頼を保存する</button>
            </div>
          </div>
        )}

      </div>

      {/* --- ★追加: チラシ新規登録モーダル --- */}
      {isFlyerModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-file-earmark-plus text-fuchsia-600"></i> 新規チラシの登録
              </h3>
              <button onClick={() => setIsFlyerModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={saveNewFlyer} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">チラシ名 *</label>
                <input required value={newFlyerForm.name} onChange={e => setNewFlyerForm({...newFlyerForm, name: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none" placeholder="例: 春の入会キャンペーン" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">チラシコード</label>
                  <input value={newFlyerForm.flyerCode} onChange={e => setNewFlyerForm({...newFlyerForm, flyerCode: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-fuchsia-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none" placeholder="独自のIDなど" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">1束の枚数</label>
                  <input type="number" min="1" value={newFlyerForm.bundleCount} onChange={e => setNewFlyerForm({...newFlyerForm, bundleCount: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-fuchsia-500 outline-none" placeholder="例: 500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">業種 *</label>
                  <select required value={newFlyerForm.industryId} onChange={e => setNewFlyerForm({...newFlyerForm, industryId: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none">
                    <option value="">選択してください</option>
                    {flyerMasters.industries.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">サイズ *</label>
                  <select required value={newFlyerForm.sizeId} onChange={e => setNewFlyerForm({...newFlyerForm, sizeId: e.target.value})} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none">
                    <option value="">選択してください</option>
                    {flyerMasters.sizes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mt-2">
                <label className="text-xs font-bold text-slate-600 block mb-2">折りステータス</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="NO_FOLDING_REQUIRED" checked={newFlyerForm.foldStatus === 'NO_FOLDING_REQUIRED'} onChange={e => setNewFlyerForm({...newFlyerForm, foldStatus: e.target.value})} />
                    <span className="text-sm">折無し</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="NEEDS_FOLDING" checked={newFlyerForm.foldStatus === 'NEEDS_FOLDING'} onChange={e => setNewFlyerForm({...newFlyerForm, foldStatus: e.target.value})} />
                    <span className="text-sm text-rose-600 font-bold">要折</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="FOLDED" checked={newFlyerForm.foldStatus === 'FOLDED'} onChange={e => setNewFlyerForm({...newFlyerForm, foldStatus: e.target.value})} />
                    <span className="text-sm text-blue-600 font-bold">折済</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsFlyerModalOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-bold hover:bg-slate-100 rounded-lg transition-colors">キャンセル</button>
                <button type="submit" disabled={isSavingFlyer} className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-bold shadow-md transition-all disabled:opacity-50">
                  {isSavingFlyer ? '登録中...' : '登録して選択する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}