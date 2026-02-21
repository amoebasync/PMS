'use client';

// ★ 変更: useSearchParams と Suspense のインポート追加
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/components/portal/CartContext';
import { GoogleMap, useJsApiLoader, Polygon, Circle, Marker } from '@react-google-maps/api';
import * as turf from '@turf/turf';

const initialCenter = { lat: 35.6580, lng: 139.7016 }; 
const mapContainerStyle = { width: '100%', height: '100%' };
const LIBRARIES: ("geometry")[] = ["geometry"];

const mapOptions = {
  mapTypeControl: false,
  streetViewControl: false,
  clickableIcons: false,
  minZoom: 12,
  styles: [
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
  ]
};

const PRICES = {
  postingBase: 5.0,
  printingBase: { 'A4': 3.0, 'B4': 4.5, 'A3': 6.0, 'ハガキ': 2.5 } as Record<string, number>
};

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

const formatAreaName = (town?: string | null, chome?: string | null) => {
  const t = town || '';
  const c = chome || '';
  if (!t && !c) return '-';
  if (t === c) return c; 
  if (c.includes(t)) return c; 
  const baseTown = t.replace(/[一二三四五六七八九十]+丁目$/, ''); 
  if (baseTown && c.includes(baseTown)) return c;
  return t && c ? `${t} ${c}` : (c || t); 
};

const MemoizedArea = React.memo(({ area, isSelected, currentZoom, onClick }: { area: any, isSelected: boolean, currentZoom: number, onClick: (id: number) => void }) => {
  if (!area.parsedPaths || area.parsedPaths.length === 0) return null;
  return (
    <React.Fragment>
      <Polygon
        paths={area.parsedPaths}
        options={{
          fillColor: isSelected ? '#4f46e5' : '#94a3b8',
          fillOpacity: isSelected ? 0.6 : 0.15,
          strokeColor: isSelected ? '#312e81' : '#64748b',
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


// ★ 追加: Suspenseで囲むための中身コンポーネント
function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editItemId = searchParams.get('editItemId'); // URLからの編集ID取得

  const { items, addItem, updateItem } = useCart();
  
  const [projectName, setProjectName] = useState('');
  const [orderType, setOrderType] = useState<'POSTING_ONLY' | 'PRINT_AND_POSTING'>('PRINT_AND_POSTING');
  const [size, setSize] = useState('A4');
  const [method, setMethod] = useState('軒並み配布');
  const [plannedCount, setPlannedCount] = useState<number | ''>(''); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [spareDate, setSpareDate] = useState('');

  const [locations, setLocations] = useState<any[]>([]);
  const [selectedPref, setSelectedPref] = useState<number | null>(13); 
  const [selectedPanelCities, setSelectedPanelCities] = useState<Set<string>>(new Set());

  const [mapAreas, setMapAreas] = useState<any[]>([]);
  const [loadedCities, setLoadedCities] = useState<Set<string>>(new Set());
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<number>>(new Set());
  
  const [searchAddress, setSearchAddress] = useState('');
  const [radiusKm, setRadiusKm] = useState<number>(1);
  const [appliedRadiusKm, setAppliedRadiusKm] = useState<number>(1);

  const [mapZoom, setMapZoom] = useState(15);
  const [currentZoom, setCurrentZoom] = useState(15);
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [searchMarker, setSearchMarker] = useState<{lat: number, lng: number} | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [isEditLoaded, setIsEditLoaded] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
    language: 'ja', region: 'JP',
  });

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLocations(d); })
      .catch(e => console.error(e));
  }, []);

  const loadCityAreas = async (prefName: string, cityName: string) => {
    if (!cityName) return;
    const cacheKey = `${prefName}_${cityName}`;
    if (loadedCities.has(cacheKey)) return;
    
    setLoadedCities(prev => new Set(prev).add(cacheKey));
    try {
      const query = new URLSearchParams();
      if (prefName) query.append('prefName', prefName);
      if (cityName) query.append('cityName', cityName);
      
      const res = await fetch(`/api/areas/map?${query.toString()}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const enrichedData = data.map(a => {
          const paths = extractPaths(a.boundary_geojson);
          const feature = createTurfFeature(paths);
          return { ...a, parsedPaths: paths, turfFeature: feature, centerLabel: calcCenterAndSize(feature) };
        }).filter(a => a.parsedPaths && a.parsedPaths.length > 0);
        
        setMapAreas(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newAreas = enrichedData.filter(a => !existingIds.has(a.id));
          return [...prev, ...newAreas];
        });
      }
    } catch (e) {}
  };

  const fetchAreasForLocation = useCallback(async (lat: number, lng: number) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
      if (status === 'OK' && results && results[0]) {
        let cityName = '', prefName = '';
        for (const component of results[0].address_components) {
          if (component.types.includes('administrative_area_level_1')) prefName = component.long_name;
          if ((component.types.includes('locality') || component.types.includes('ward')) && !component.types.includes('administrative_area_level_1')) {
            cityName = component.long_name;
          }
        }
        await loadCityAreas(prefName, cityName);
      }
    });
  }, [loadedCities]);

  useEffect(() => { 
    if (isLoaded && mapAreas.length === 0) {
      loadCityAreas('東京都', '渋谷区');
      loadCityAreas('東京都', '港区');
      loadCityAreas('東京都', '目黒区');
      loadCityAreas('東京都', '新宿区');
      loadCityAreas('東京都', '世田谷区');
    } 
  }, [isLoaded, mapAreas.length]);

  // ★ 追加: 編集モード時のデータ復元処理
  useEffect(() => {
    if (editItemId && items.length > 0 && !isEditLoaded) {
      const editTarget = items.find(i => i.id === editItemId);
      if (editTarget) {
        setProjectName(editTarget.projectName || '');
        setOrderType(editTarget.type as any);
        setSize(editTarget.size);
        setMethod(editTarget.method);
        setPlannedCount(editTarget.totalCount);
        setStartDate(editTarget.startDate || '');
        setEndDate(editTarget.endDate || '');
        setSpareDate(editTarget.spareDate || '');
        
        // エリアの選択状態を復元
        setSelectedAreaIds(new Set(editTarget.selectedAreas.map(a => a.id)));

        // 必要なポリゴンをロード（カートのアイテムはprefName, cityNameを持っている）
        const citySet = new Set<string>();
        editTarget.selectedAreas.forEach(a => {
           if (a.prefName && a.cityName) citySet.add(`${a.prefName}_${a.cityName}`);
        });
        citySet.forEach(key => {
           const [p, c] = key.split('_');
           if (p && c) loadCityAreas(p, c);
        });

        setIsEditLoaded(true);
      }
    }
  }, [editItemId, items, isEditLoaded]);

  const handleMapIdle = () => {
    if (mapRef) {
      const center = mapRef.getCenter();
      if (center) fetchAreasForLocation(center.lat(), center.lng());
    }
  };

  const handleSearchAndSelect = () => {
    if (!searchAddress || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchAddress }, async (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat(), lng = location.lng();
        setMapCenter({ lat, lng });
        setSearchMarker({ lat, lng });
        setAppliedRadiusKm(radiusKm);
        
        const r = Number(radiusKm);
        if (r === 1) setMapZoom(14); else if (r === 2) setMapZoom(13); else if (r === 3) setMapZoom(12); else setMapZoom(11);

        await fetchAreasForLocation(lat, lng);
        
        setTimeout(() => {
          const newSelected = new Set<number>();
          const centerPoint = turf.point([lng, lat]);
          const searchCircle = turf.circle(centerPoint, Number(radiusKm), { steps: 64, units: 'kilometers' });
          setMapAreas(currentAreas => {
            currentAreas.forEach(area => {
              if (area.turfFeature && turf.booleanIntersects(searchCircle, area.turfFeature)) newSelected.add(area.id);
            });
            setSelectedAreaIds(newSelected);
            return currentAreas;
          });
        }, 500);

      } else alert('住所が見つかりませんでした。');
    });
  };

  const handleCityPanelClick = async (prefName: string, cityName: string) => {
    const address = `${prefName}${cityName}`;
    const cacheKey = `${prefName}_${cityName}`;
    setSearchMarker(null); setSearchAddress(''); setMapZoom(13);
    
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

    await loadCityAreas(prefName, cityName);

    const cleanPrefName = prefName.replace(/(都|道|府|県)$/gi, '');
    const cleanCityName = cityName.replace(/(区|市|町|村)$/gi, '');
    setSelectedAreaIds(prev => {
      const next = new Set(prev);
      mapAreas.forEach(area => {
        if ((area.prefecture?.name && area.prefecture.name.includes(cleanPrefName)) && (area.city?.name && area.city.name.includes(cleanCityName))) {
          if (isCurrentlySelected) next.delete(area.id); else next.add(area.id);
        }
      });
      return next;
    });
  };

  const toggleArea = useCallback((id: number) => {
    setSelectedAreaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const getCapacity = (a: any) => {
    const doorCount = a.door_to_door_count || 0;
    const multiCount = a.multi_family_count || 0;
    if (method === '集合住宅限定') return multiCount;
    if (method === '戸建限定') return Math.floor(Math.max(0, doorCount - multiCount) * 0.5);
    return doorCount;
  };

  const selectedAreasList = useMemo(() => mapAreas.filter(a => selectedAreaIds.has(a.id)), [mapAreas, selectedAreaIds]);
  const totalAreaCapacity = useMemo(() => selectedAreasList.reduce((sum, a) => sum + getCapacity(a), 0), [selectedAreasList, method]);
  
  const pCount = typeof plannedCount === 'number' ? plannedCount : 0;
  const isCapacityEnough = pCount > 0 && totalAreaCapacity >= pCount;
  
  const unitPrice = PRICES.postingBase + (orderType === 'PRINT_AND_POSTING' ? (PRICES.printingBase[size] || 3) : 0);
  const totalPrice = pCount * unitPrice; 

  const handleAddToCart = () => {
    if (pCount <= 0) {
      alert('希望配布枚数を入力してください。');
      return;
    }
    if (!isCapacityEnough) {
      alert('選択されたエリアの世帯数が、希望配布枚数に達していません。\nマップまたは検索からエリアを追加してください。');
      return;
    }
    if (!startDate || !endDate) {
      alert('「開始予定日」と「完了期限日」を入力してください。');
      return;
    }

    const newTarget = {
      type: orderType,
      title: `${size}サイズ ${orderType === 'PRINT_AND_POSTING' ? '印刷＋ポスティング' : 'ポスティングのみ'} (${method})`,
      selectedAreas: selectedAreasList.map(a => ({ 
        id: a.id, 
        name: `${a.city?.name} ${formatAreaName(a.town_name, a.chome_name)}`, 
        count: getCapacity(a),
        prefName: a.prefecture?.name,
        cityName: a.city?.name
      })),
      totalCount: pCount, 
      method, size, price: totalPrice,
      unitPrice, 
      startDate, endDate, spareDate,
      projectName 
    };

    // ★ 変更: 編集時は既存のアイテムを更新、新規時は追加
    if (editItemId) {
      updateItem(editItemId, newTarget);
    } else {
      addItem(newTarget);
    }
    
    router.push('/portal/cart');
  };

  const handleClearAll = () => {
    setSelectedAreaIds(new Set());
    setSelectedPanelCities(new Set());
    setSearchMarker(null);
  };

  return (
    <div className="absolute inset-0 flex bg-slate-50 overflow-hidden font-sans">
      
      {/* --- 左側: 固定幅サイドパネル --- */}
      <div className="w-[360px] h-full bg-white flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.06)] z-20 border-r border-slate-200">
        
        <div className="p-5 border-b border-slate-100 shrink-0 bg-white">
          <h1 className="text-xl font-black text-slate-800 tracking-tight">発注シミュレーション</h1>
          <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">地図からエリアを選び、リアルタイムで見積もりを確認できます。</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
          
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black"><i className="bi bi-tag-fill"></i></div>
              <h3 className="font-bold text-slate-800">基本情報</h3>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <label className="text-[10px] font-bold text-slate-500 block mb-1">案件名</label>
              <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-shadow" placeholder="例: 春のキャンペーン配布" />
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">1</div>
              <h3 className="font-bold text-slate-800">プランの選択</h3>
            </div>
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">依頼タイプ</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setOrderType('PRINT_AND_POSTING')} className={`py-2 text-xs font-bold rounded-lg border-2 transition-all ${orderType === 'PRINT_AND_POSTING' ? 'border-indigo-600 bg-white text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'}`}>
                    印刷 ＋ 配布
                  </button>
                  <button onClick={() => setOrderType('POSTING_ONLY')} className={`py-2 text-xs font-bold rounded-lg border-2 transition-all ${orderType === 'POSTING_ONLY' ? 'border-indigo-600 bg-white text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'}`}>
                    配布のみ
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">希望配布枚数 (印刷枚数) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input type="number" required value={plannedCount} onChange={e => setPlannedCount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700 text-right pr-8 transition-shadow" placeholder="例: 10000" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">枚</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">チラシサイズ</label>
                  <select value={size} onChange={e => setSize(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer">
                    <option value="A4">A4</option><option value="B4">B4</option><option value="A3">A3</option><option value="ハガキ">ハガキ</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">配布方法</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer">
                    <option value="軒並み配布">軒並配布</option><option value="戸建限定">戸建限定</option><option value="集合住宅限定">集合限定</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">2</div>
              <h3 className="font-bold text-slate-800">配布期間を選択</h3>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">開始予定日 <span className="text-rose-500">*</span></label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" />
                </div>
                <div className="text-slate-400 pt-4"><i className="bi bi-arrow-right"></i></div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">完了期限日 <span className="text-rose-500">*</span></label>
                  <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-indigo-300 p-2.5 rounded-lg text-sm bg-indigo-50 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700" />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 border-dashed">
                <label className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1.5">
                  予備期限
                  <div className="group relative cursor-help flex items-center">
                    <i className="bi bi-question-circle text-slate-400 hover:text-indigo-500 transition-colors"></i>
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] leading-relaxed rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                      悪天候（台風や大雪など）や不測の事態により、指定期間内に配布が完了できなかった場合の延長許容日です。
                      <div className="absolute top-full left-2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                </label>
                <input type="date" value={spareDate} onChange={e => setSpareDate(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600" />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">3</div>
              <h3 className="font-bold text-slate-800">配布エリアを選択</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 block">住所・半径検索</label>
                <div className="relative">
                  <i className="bi bi-geo-alt absolute left-3 top-2.5 text-slate-400"></i>
                  <input 
                    type="text" 
                    placeholder="例: 渋谷区道玄坂" 
                    value={searchAddress} 
                    onChange={e => setSearchAddress(e.target.value)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!e.nativeEvent.isComposing) {
                          handleSearchAndSelect();
                        }
                      }
                    }} 
                    className="w-full border border-slate-300 pl-9 pr-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div className="flex gap-2">
                  <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))} className="flex-1 border border-slate-300 px-3 py-2 rounded-lg text-sm bg-white outline-none cursor-pointer">
                    <option value={1}>半径 1km</option><option value={2}>半径 2km</option><option value={3}>半径 3km</option><option value={5}>半径 5km</option>
                  </select>
                  <button onClick={handleSearchAndSelect} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors shadow-sm whitespace-nowrap">
                    検索・選択
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="text-[10px] font-bold text-slate-500 block mb-2">市区町村 全域選択</label>
                <select value={selectedPref || ''} onChange={e => setSelectedPref(Number(e.target.value))} className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none mb-2 cursor-pointer">
                  <option value="">都道府県を選択</option>
                  {locations.map(pref => <option key={pref.id} value={pref.id}>{pref.name}</option>)}
                </select>
                
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-lg border border-slate-100">
                  {locations.find(p => p.id === selectedPref)?.cities.map((city: any) => {
                    const prefName = locations.find(p => p.id === selectedPref)?.name || '';
                    const cacheKey = `${prefName}_${city.name}`;
                    const isCitySelected = selectedPanelCities.has(cacheKey);
                    return (
                      <button key={city.id} type="button" onClick={() => handleCityPanelClick(prefName, city.name)} className={`px-2.5 py-1 border rounded-md text-[11px] font-bold transition-all ${isCitySelected ? 'bg-indigo-100 border-indigo-400 text-indigo-800' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                        {isCitySelected && <i className="bi bi-check2 mr-1"></i>}{city.name}
                      </button>
                    );
                  })}
                  {!selectedPref && <div className="text-xs text-slate-400 w-full text-center py-2">都道府県を選択してください</div>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* --- 中央〜右側: フルスクリーンマップ --- */}
      <div className="flex-1 h-full relative z-10 bg-slate-200">
        {!isLoaded ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 font-bold">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            Map Loading...
          </div>
        ) : (
          <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={mapZoom} options={mapOptions} onLoad={map => setMapRef(map)} onIdle={handleMapIdle} onZoomChanged={() => { if(mapRef) setCurrentZoom(mapRef.getZoom() || 15) }}>
            {searchMarker && <Marker position={searchMarker} />}
            {searchMarker && <Circle center={searchMarker} radius={appliedRadiusKm * 1000} options={{ fillColor: '#4f46e5', fillOpacity: 0.1, strokeColor: '#4338ca', strokeWeight: 2, borderStyle: 'dashed', clickable: false }} />}
            {mapAreas.map(area => <MemoizedArea key={area.id} area={area} isSelected={selectedAreaIds.has(area.id)} currentZoom={currentZoom} onClick={toggleArea} />)}
          </GoogleMap>
        )}

        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-slate-200 text-[11px] font-bold text-slate-600 pointer-events-none flex items-center gap-2">
          <i className="bi bi-cursor-fill text-indigo-500 text-lg"></i>
          地図上のエリアをクリックして、配布エリアを選択出来ます
        </div>
        
        {/* --- 右端フローティング: 統合された見積もり＆リストパネル --- */}
        <div className="absolute top-4 right-4 bottom-4 w-[340px] flex flex-col pointer-events-none z-30">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 flex flex-col h-full pointer-events-auto overflow-hidden">
            
            {/* 上部: リストヘッダー */}
            <div className="p-3 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-700 text-sm flex items-center gap-1.5"><i className="bi bi-list-check text-indigo-600"></i> 選択エリア</h4>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{selectedAreaIds.size} 件</span>
              </div>
              {selectedAreaIds.size > 0 && (
                <button onClick={handleClearAll} className="text-[10px] text-rose-500 font-bold hover:bg-rose-50 px-2 py-1 rounded transition-colors flex items-center">
                  <i className="bi bi-trash mr-1"></i>クリア
                </button>
              )}
            </div>
            
            {/* 中部: エリアリスト */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-slate-50">
              {selectedAreasList.length === 0 ? (
                <div className="text-center text-slate-400 text-xs py-10 flex flex-col items-center justify-center h-full">
                  <i className="bi bi-map text-4xl mb-3 block opacity-20"></i>
                  左の検索、または地図のクリックで<br/>エリアを選択してください
                </div>
              ) : (
                selectedAreasList.map(a => (
                  <div key={a.id} className="flex justify-between items-center bg-white p-2.5 hover:bg-indigo-50/80 rounded-lg shadow-sm border border-slate-100 transition-colors group relative">
                    
                    <div className="overflow-hidden flex-1 mr-2">
                      <div className="text-[10px] text-slate-400 leading-tight mb-0.5">{a.prefecture?.name} {a.city?.name}</div>
                      <div className="text-xs font-bold text-slate-700 truncate" title={`${a.prefecture?.name} ${a.city?.name} ${formatAreaName(a.town_name, a.chome_name)}`}>
                        {formatAreaName(a.town_name, a.chome_name)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-black text-indigo-600">{getCapacity(a).toLocaleString()}</div>
                        <div className="text-[9px] text-slate-400 leading-none">枚</div>
                      </div>
                      
                      <button 
                        onClick={() => toggleArea(a.id)}
                        className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="選択解除"
                      >
                        <i className="bi bi-x-circle-fill text-lg"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 下部: 見積もり＆カートボタン */}
            <div className="bg-white border-t border-slate-200 p-5 shrink-0 relative shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
              
              <div className="flex justify-between items-end mb-1">
                <span className="text-xs font-bold text-slate-500">希望配布枚数</span>
                <span className="font-bold text-lg tracking-tight text-slate-800">{pCount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">枚</span></span>
              </div>
              
              <div className="flex justify-between items-end mb-3 pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500">エリアカバー数</span>
                <span className={`font-bold text-sm tracking-tight ${isCapacityEnough ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {totalAreaCapacity.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">枚</span>
                </span>
              </div>
              
              {pCount > 0 && !isCapacityEnough && (
                <div className="text-[10px] text-rose-500 font-bold mb-3 flex items-start gap-1">
                  <i className="bi bi-exclamation-triangle-fill mt-0.5"></i>
                  選択エリアの世帯数が希望枚数に達していません。
                </div>
              )}

              <div className="flex justify-between items-baseline mb-4 pb-1">
                <span className="text-xs font-bold text-slate-500">合計 (税抜)</span>
                <span className="text-3xl font-black text-indigo-600 tracking-tighter">¥{totalPrice.toLocaleString()}</span>
              </div>

              {/* ★ 変更: 編集時は「更新」、新規時は「カートへ」のテキストに */}
              <button 
                onClick={handleAddToCart} 
                disabled={pCount === 0 || !isCapacityEnough}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {editItemId ? (
                  <><i className="bi bi-arrow-repeat text-lg"></i> カート内容を更新</>
                ) : (
                  <><i className="bi bi-cart-plus-fill text-lg"></i> カートに入れる</>
                )}
              </button>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}

// ★ 追加: Next.js 15+ で useSearchParams を使うためのラップコンポーネント
export default function NewOrderPageWrapper() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold">読み込み中...</p>
      </div>
    }>
      <NewOrderContent />
    </Suspense>
  );
}