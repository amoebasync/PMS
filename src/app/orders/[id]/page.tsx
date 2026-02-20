'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { GoogleMap, useJsApiLoader, Polygon, Circle, Marker } from '@react-google-maps/api';
import * as turf from '@turf/turf';

const mapContainerStyle = { width: '100%', height: '100%' };
const initialCenter = { lat: 35.6581, lng: 139.7414 }; // デフォルト: 東京タワー

const LIBRARIES: ("geometry" | "drawing" | "places")[] = ["geometry"];

// --- 座標抽出・デコード関数 ---
const decodePolyline = (str: string) => {
  let index = 0, lat = 0, lng = 0, coordinates = [];
  let shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, 5);
  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = result = 0;
    do { if (index >= str.length) break; byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change; lng += longitude_change;
    coordinates.push({ lat: lat / factor, lng: lng / factor });
  }
  return coordinates;
};

const extractPaths = (geojsonStr: string) => {
  if (!geojsonStr) return [];
  try {
    if (geojsonStr.trim().startsWith('{')) {
      const geojson = JSON.parse(geojsonStr);
      let feature = geojson;
      if (geojson.type === 'FeatureCollection' && geojson.features.length > 0) feature = geojson.features[0];
      const geometry = feature.geometry || feature;
      let rawCoords: any[] = [];
      if (geometry.type === 'Polygon') rawCoords = geometry.coordinates[0];
      else if (geometry.type === 'MultiPolygon') rawCoords = geometry.coordinates[0][0];
      return rawCoords.map((c: any[]) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) }));
    }
    if (geojsonStr.includes('|') && !/[a-zA-Z]/.test(geojsonStr)) {
      return geojsonStr.split('|').map(point => {
        const parts = point.split(/[,\s]+/).filter(Boolean);
        if (parts.length >= 2) {
          const val1 = parseFloat(parts[0]), val2 = parseFloat(parts[1]);
          return { lat: val1 < 90 ? val1 : val2, lng: val1 > 90 ? val1 : val2 };
        }
        return { lat: NaN, lng: NaN };
      });
    }
    const sanitizedStr = geojsonStr.replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\f/g, '\\f');
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.geometry) {
      const decodedPath = window.google.maps.geometry.encoding.decodePath(sanitizedStr);
      return decodedPath.map(p => ({ lat: p.lat(), lng: p.lng() }));
    }
  } catch (e) { console.error("Extraction error:", e); }
  return [];
};

const createTurfFeature = (geojsonStr: string) => {
  if (!geojsonStr) return null;
  if (geojsonStr.trim().startsWith('{')) {
    try {
      const geojson = JSON.parse(geojsonStr);
      return geojson.type === 'FeatureCollection' ? geojson.features[0] : geojson;
    } catch (e) { return null; }
  }
  const paths = extractPaths(geojsonStr);
  if (paths.length === 0) return null;
  const coords = paths.map(p => [p.lng, p.lat]);
  const first = coords[0], last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first]);
  if (coords.length >= 4) return turf.polygon([coords]);
  return null;
};

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

  const [formData, setFormData] = useState({
    orderNo: '', customerId: '', salesRepId: '', orderDate: new Date().toISOString().split('T')[0],
    totalAmount: '', status: 'PLANNING', remarks: ''
  });

  const [distForm, setDistForm] = useState({
    flyerId: '', method: '軒並み配布', plannedCount: '', startDate: '', endDate: '', spareDate: '', remarks: ''
  });

  // --- 地図とポリゴン動的ロード用のState ---
  const [mapAreas, setMapAreas] = useState<any[]>([]);
  const [loadedCities, setLoadedCities] = useState<Set<string>>(new Set()); // 取得済みの市区町村名を記録
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<number>>(new Set());
  
  const [searchAddress, setSearchAddress] = useState('');
  const [radiusKm, setRadiusKm] = useState(1);
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [searchMarker, setSearchMarker] = useState<{lat: number, lng: number} | null>(null);
  
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [custRes, empRes] = await Promise.all([ fetch('/api/customers'), fetch('/api/employees') ]);
        if (custRes.ok) setCustomers(await custRes.json());
        if (empRes.ok) setEmployees((await empRes.json()).filter((e:any) => e.isActive));

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
                flyerId: dist.flyerId?.toString() || '', method: dist.method, plannedCount: dist.plannedCount?.toString() || '',
                startDate: dist.startDate ? dist.startDate.split('T')[0] : '', endDate: dist.endDate ? dist.endDate.split('T')[0] : '',
                spareDate: dist.spareDate ? dist.spareDate.split('T')[0] : '', remarks: dist.remarks || ''
              });
            }
          }
        }
      } catch (e) { console.error(e); }
      setIsLoading(false);
    };
    fetchInitialData();
  }, [id, isNew]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDistChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDistForm(prev => ({ ...prev, [name]: value }));
  };

  // ★ 追加: 地図の中心座標から市区町村を調べ、未取得ならAPIを叩いてポリゴンを追加する関数
  const fetchAreasForLocation = (lat: number, lng: number, onFetched?: (newAreas: any[]) => void) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
      if (status === 'OK' && results && results[0]) {
        let cityName = '';
        for (const component of results[0].address_components) {
          if (component.types.includes('locality') || component.types.includes('ward')) {
            cityName = component.long_name;
            break;
          }
        }
        
        // 未取得の市区町村ならAPIで取得
        if (cityName && !loadedCities.has(cityName)) {
          setLoadedCities(prev => new Set(prev).add(cityName));
          try {
            const res = await fetch(`/api/areas/map?cityName=${encodeURIComponent(cityName)}`);
            const data = await res.json();
            if (Array.isArray(data)) {
              setMapAreas(prev => {
                const existingIds = new Set(prev.map(a => a.id));
                const newAreas = data.filter(a => !existingIds.has(a.id));
                if (onFetched) onFetched([...prev, ...newAreas]); // 検索時の処理用
                return [...prev, ...newAreas];
              });
            }
          } catch (e) { console.error(e); }
        } else {
          if (onFetched) onFetched(mapAreas);
        }
      }
    });
  };

  // 地図のスクロール・移動が止まったら発火し、周辺ポリゴンをロードする
  const handleMapIdle = () => {
    if (mapRef) {
      const center = mapRef.getCenter();
      if (center) fetchAreasForLocation(center.lat(), center.lng());
    }
  };

  // 検索＆自動選択ロジック
  const handleSearchAndSelect = () => {
    if (!searchAddress || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        
        setMapCenter({ lat, lng });
        setSearchMarker({ lat, lng });

        const centerPoint = turf.point([lng, lat]);
        const searchCircle = turf.circle(centerPoint, radiusKm, { steps: 64, units: 'kilometers' });

        // 周辺データを取得してから交差判定を行う
        fetchAreasForLocation(lat, lng, (currentAreas) => {
          const newSelected = new Set<number>(); // 検索のたびに選択をリセット（上書き）

          currentAreas.forEach(area => {
            const feature = createTurfFeature(area.boundary_geojson);
            if (feature) {
              try {
                const features = feature.type === 'FeatureCollection' ? feature.features : [feature];
                for (const f of features) {
                  if (turf.booleanIntersects(searchCircle, f)) {
                    newSelected.add(area.id);
                    break; 
                  }
                }
              } catch (e) { /* skip */ }
            }
          });
          setSelectedAreaIds(newSelected);
        });
      } else {
        alert('入力された住所が見つかりませんでした。');
      }
    });
  };

  const toggleAreaSelection = (areaId: number) => {
    setSelectedAreaIds(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const saveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(isNew ? '/api/orders' : `/api/orders/${id}`, {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
      });
      if (res.ok) {
        const savedOrder = await res.json();
        alert('基本情報を保存しました！');
        if (isNew) router.push(`/orders/${savedOrder.id}`); 
      } else alert('保存に失敗しました');
    } catch (err) { alert('通信エラーが発生しました'); }
  };

  // 配布方法に応じた枚数計算ロジック
  const totalCapacity = mapAreas
    .filter(a => selectedAreaIds.has(a.id))
    .reduce((sum, a) => {
      if (distForm.method === '軒並み配布') {
        return sum + (a.door_to_door_count || 0);
      } else if (distForm.method === '集合住宅限定') {
        return sum + (a.multi_family_count || 0);
      } else if (distForm.method === '戸建限定') {
        return sum + Math.max(0, (a.door_to_door_count || 0) - (a.multi_family_count || 0));
      } else {
        return sum + (a.posting_cap_with_ng || 0);
      }
    }, 0);

  const plannedCount = parseInt(distForm.plannedCount) || 0;
  const isCapacityEnough = plannedCount > 0 && totalCapacity >= plannedCount;

  const TABS = [
    { id: 'BASIC', label: '基本情報', icon: 'bi-info-circle' },
    { id: 'DIST', label: 'ポスティング (配布)', icon: 'bi-send' },
    { id: 'PRINT', label: '印刷手配', icon: 'bi-printer' },
    { id: 'NEWS', label: '新聞折込', icon: 'bi-newspaper' },
    { id: 'DESIGN', label: 'デザイン制作', icon: 'bi-palette' },
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

      <div className="flex border-b border-slate-200">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} disabled={isNew && tab.id !== 'BASIC'} 
              className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all ${
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
        
        {activeTab === 'BASIC' && (
          <form onSubmit={saveBasicInfo} className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-2 gap-6">
              {!isNew && (
                <div><label className="text-xs font-bold text-slate-600 block mb-1">受注番号</label><input name="orderNo" value={formData.orderNo} onChange={handleInputChange} className="w-full border p-2.5 rounded-lg text-sm bg-slate-50 font-mono" readOnly /></div>
              )}
              <div className={isNew ? 'col-span-2' : ''}>
                <label className="text-xs font-bold text-slate-600 block mb-1">顧客 (クライアント) *</label>
                <select required name="customerId" value={formData.customerId} onChange={handleInputChange} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">担当営業</label>
                <select name="salesRepId" value={formData.salesRepId} onChange={handleInputChange} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">選択してください</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">受注日 *</label><input type="date" required name="orderDate" value={formData.orderDate} onChange={handleInputChange} className="w-full border p-2.5 rounded-lg text-sm" /></div>
              <div><label className="text-xs font-bold text-slate-600 block mb-1">受注総額 (円)</label><input type="number" name="totalAmount" value={formData.totalAmount} onChange={handleInputChange} className="w-full border p-2.5 rounded-lg text-sm" placeholder="例: 150000" /></div>
            </div>
            <div className="pt-4 border-t flex justify-end">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg">{isNew ? '基本情報を登録して次へ' : '基本情報を更新する'}</button>
            </div>
          </form>
        )}

        {activeTab === 'DIST' && (
          <div className="space-y-8">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-indigo-700 mb-4 flex items-center gap-2"><i className="bi bi-1-circle-fill"></i> 配布条件・チラシの設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-slate-600 block mb-1">配布するチラシ *</label>
                  <div className="flex gap-2">
                    <select required name="flyerId" value={distForm.flyerId} onChange={handleDistChange} className="flex-1 border p-2.5 rounded-lg text-sm bg-white font-bold text-slate-700">
                      <option value="">-- この顧客のチラシから選択 --</option>
                      {customerFlyers.map(f => (
                        <option key={f.id} value={f.id}>{f.name} (有効在庫: {f.stockCount.toLocaleString()}枚 / {f.size?.name})</option>
                      ))}
                    </select>
                    <a href="/flyers" target="_blank" className="bg-fuchsia-100 text-fuchsia-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-fuchsia-200 transition-colors whitespace-nowrap">
                      + 新規作成
                    </a>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">配布方法 *</label>
                  <select name="method" value={distForm.method} onChange={handleDistChange} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500">
                    <option value="軒並み配布">軒並み配布 (標準)</option>
                    <option value="戸建限定">戸建限定</option>
                    <option value="集合住宅限定">集合住宅限定</option>
                    <option value="事業所限定">事業所限定</option>
                  </select>
                </div>
                <div><label className="text-xs font-bold text-slate-600 block mb-1">配布予定枚数 *</label><input type="number" required name="plannedCount" value={distForm.plannedCount} onChange={handleDistChange} className="w-full border p-2.5 rounded-lg text-lg font-bold text-indigo-600 text-right pr-4" placeholder="10000" /></div>
                <div><label className="text-xs font-bold text-slate-600 block mb-1">配布開始日</label><input type="date" name="startDate" value={distForm.startDate} onChange={handleDistChange} className="w-full border p-2.5 rounded-lg text-sm" /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><label className="text-xs font-bold text-slate-600 block mb-1">完了期限日 *</label><input type="date" required name="endDate" value={distForm.endDate} onChange={handleDistChange} className="w-full border p-2.5 rounded-lg text-sm" /></div>
                  <div className="flex-1"><label className="text-xs font-bold text-rose-500 block mb-1">予備期限 (雨天順延など)</label><input type="date" name="spareDate" value={distForm.spareDate} onChange={handleDistChange} className="w-full border border-rose-200 p-2.5 rounded-lg text-sm bg-rose-50" /></div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-800 p-4 text-white flex flex-wrap gap-4 justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 whitespace-nowrap"><i className="bi bi-2-circle-fill"></i> マップによるエリア選択</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <i className="bi bi-geo-alt absolute left-3 top-2.5 text-slate-400"></i>
                    <input 
                      type="text" 
                      placeholder="住所で検索 (例: 新宿区高田馬場)" 
                      value={searchAddress}
                      onChange={e => setSearchAddress(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchAndSelect()}
                      className="pl-9 pr-3 py-2 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))} className="px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                    <option value={1}>半径 1km</option>
                    <option value={2}>半径 2km</option>
                    <option value={3}>半径 3km</option>
                    <option value={5}>半径 5km</option>
                  </select>
                  <button onClick={handleSearchAndSelect} className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    検索 ＆ エリア自動選択
                  </button>
                  <button onClick={() => setSelectedAreaIds(new Set())} className="bg-slate-600 hover:bg-slate-500 px-3 py-2 rounded-lg text-sm font-bold transition-colors ml-2">
                    クリア
                  </button>
                </div>
              </div>
              
              <div className="h-[600px] w-full bg-slate-100 relative">
                {!isLoaded ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold"><i className="bi bi-arrow-repeat animate-spin mr-2"></i>地図を読み込んでいます...</div>
                ) : (
                  <GoogleMap 
                    mapContainerStyle={mapContainerStyle} 
                    center={mapCenter} 
                    zoom={15} 
                    options={{ mapTypeControl: false, streetViewControl: false }}
                    onLoad={map => setMapRef(map)}
                    onIdle={handleMapIdle} // ★地図の移動が止まるたびに周辺のエリアを取得
                  >
                    {searchMarker && <Marker position={searchMarker} />}
                    {searchMarker && (
                      <Circle center={searchMarker} radius={radiusKm * 1000} options={{ fillColor: '#10b981', fillOpacity: 0.1, strokeColor: '#059669', strokeWeight: 2, borderStyle: 'dashed' }} />
                    )}

                    {mapAreas.map(area => {
                      if (!area.boundary_geojson) return null;
                      const paths = extractPaths(area.boundary_geojson);
                      if (!paths || paths.length === 0) return null; 
                      
                      const isSelected = selectedAreaIds.has(area.id);

                      return (
                        <Polygon
                          key={area.id}
                          paths={paths}
                          options={{
                            fillColor: isSelected ? '#3b82f6' : '#94a3b8',
                            fillOpacity: isSelected ? 0.6 : 0.2,
                            strokeColor: isSelected ? '#1d4ed8' : '#64748b',
                            strokeWeight: isSelected ? 2 : 1,
                          }}
                          onClick={() => toggleAreaSelection(area.id)}
                        />
                      );
                    })}
                  </GoogleMap>
                )}
                
                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur p-5 rounded-2xl shadow-2xl border border-slate-200 w-80">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-2 flex justify-between">
                    エリア選択状況
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px]">{selectedAreaIds.size} エリア</span>
                  </h4>
                  
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-slate-600">配布方法</span>
                    <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{distForm.method}</span>
                  </div>

                  <div className="flex justify-between items-end mb-4">
                    <span className="text-sm font-bold text-slate-600">配布可能枚数 (合計)</span>
                    <div className="text-right">
                      <span className={`text-2xl font-black ${isCapacityEnough ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {totalCapacity.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">枚</span>
                    </div>
                  </div>
                  
                  {plannedCount > 0 && !isCapacityEnough ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-bold mb-4 flex items-start gap-2">
                      <i className="bi bi-exclamation-triangle-fill text-rose-500 text-base"></i>
                      <p>予定枚数 ({plannedCount.toLocaleString()}枚) を下回っています。エリアを追加選択してください。</p>
                    </div>
                  ) : plannedCount > 0 && isCapacityEnough ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-bold mb-4 flex items-center gap-2">
                      <i className="bi bi-check-circle-fill text-emerald-500 text-base"></i>
                      <p>予定枚数をカバーするエリアが確保されました！</p>
                    </div>
                  ) : null}

                  <button 
                    disabled={!isCapacityEnough || !distForm.flyerId} 
                    className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all ${
                      isCapacityEnough && distForm.flyerId
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <i className="bi bi-cloud-arrow-up-fill mr-2"></i>
                    配布依頼を保存する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* プレースホルダー（他のタブ用） */}
        {activeTab !== 'BASIC' && activeTab !== 'DIST' && (
          <div className="py-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-3xl mb-4">
              <i className="bi bi-tools"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">この機能は次のステップで実装します！</h3>
            <p className="text-sm text-slate-500 max-w-md">
              ここに、選択したタブ（{TABS.find(t => t.id === activeTab)?.label}）の依頼内容を入力・管理するフォームが表示される予定です。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}