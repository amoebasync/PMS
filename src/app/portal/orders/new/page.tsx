'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/portal/CartContext';
import { GoogleMap, useJsApiLoader, Polygon, Marker } from '@react-google-maps/api';
import * as turf from '@turf/turf';

const initialCenter = { lat: 35.6581, lng: 139.7414 }; // 東京タワー
const mapContainerStyle = { width: '100%', height: '100%', borderRadius: '0.75rem' };
const LIBRARIES: ("geometry")[] = ["geometry"];

// 単価設定（仮）
const PRICES = {
  postingBase: 5.0,
  printingBase: { 'A4': 3.0, 'B4': 4.5, 'A3': 6.0, 'ハガキ': 2.5 } as Record<string, number>
};

export default function NewOrderPage() {
  const router = useRouter();
  const { addItem, items } = useCart();
  
  const [orderType, setOrderType] = useState<'POSTING_ONLY' | 'PRINT_AND_POSTING'>('PRINT_AND_POSTING');
  const [size, setSize] = useState('A4');
  const [method, setMethod] = useState('軒並み配布');

  const [mapAreas, setMapAreas] = useState<any[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<number>>(new Set());
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [searchAddress, setSearchAddress] = useState('');
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
    language: 'ja', region: 'JP',
  });

  const handleSearch = () => {
    if (!searchAddress || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        setMapCenter({ lat: location.lat(), lng: location.lng() });
        fetchAreasForLocation(location.lat(), location.lng());
      } else alert('住所が見つかりませんでした。');
    });
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
        if (cityName) {
          const res = await fetch(`/api/areas/map?cityName=${cityName}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            const enriched = data.map(a => {
              if(!a.boundary_geojson) return null;
              try {
                const parsed = JSON.parse(a.boundary_geojson);
                const coords = parsed.type === 'FeatureCollection' ? parsed.features[0].geometry.coordinates[0] : parsed.coordinates[0];
                const paths = coords.map((c: any) => ({ lat: parseFloat(c[1]), lng: parseFloat(c[0]) }));
                return { ...a, parsedPaths: paths };
              } catch(e) { return null; }
            }).filter(Boolean);
            setMapAreas(enriched);
          }
        }
      }
    });
  }, []);

  useEffect(() => { if (isLoaded) fetchAreasForLocation(initialCenter.lat, initialCenter.lng); }, [isLoaded, fetchAreasForLocation]);

  const toggleArea = (id: number) => {
    setSelectedAreaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getCapacity = (a: any) => {
    if (method === '集合住宅限定') return a.multi_family_count;
    if (method === '戸建限定') return Math.max(0, a.door_to_door_count - a.multi_family_count);
    return a.posting_cap_with_ng;
  };

  const selectedAreasList = mapAreas.filter(a => selectedAreaIds.has(a.id));
  const totalCount = selectedAreasList.reduce((sum, a) => sum + getCapacity(a), 0);
  
  // 概算見積計算
  const unitPrice = PRICES.postingBase + (orderType === 'PRINT_AND_POSTING' ? (PRICES.printingBase[size] || 3) : 0);
  const totalPrice = totalCount * unitPrice;

  const handleAddToCart = () => {
    addItem({
      type: orderType,
      title: `${size}サイズ ${orderType === 'PRINT_AND_POSTING' ? '印刷＋ポスティング' : 'ポスティングのみ'} (${method})`,
      selectedAreas: selectedAreasList.map(a => ({ id: a.id, name: `${a.city?.name} ${a.town_name} ${a.chome_name}`, count: getCapacity(a) })),
      totalCount, method, size, price: totalPrice
    });
    router.push('/portal/cart');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-800">新規発注 (シミュレーション)</h1>
        <p className="text-sm text-slate-500">地図からエリアを選び、リアルタイムで見積もりを確認できます。</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* 左側: 条件設定 */}
        <div className="w-[340px] bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <h3 className="font-bold text-indigo-700 mb-4 border-b border-indigo-100 pb-2">1. プランの選択</h3>
          <div className="space-y-4 mb-8">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-2">依頼タイプ</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setOrderType('PRINT_AND_POSTING')} className={`py-2 text-xs font-bold rounded-lg border-2 transition-all ${orderType === 'PRINT_AND_POSTING' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  印刷 ＋ 配布
                </button>
                <button onClick={() => setOrderType('POSTING_ONLY')} className={`py-2 text-xs font-bold rounded-lg border-2 transition-all ${orderType === 'POSTING_ONLY' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  配布のみ (持込)
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-2">サイズ</label>
              <select value={size} onChange={e => setSize(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="A4">A4</option><option value="B4">B4</option><option value="A3">A3</option><option value="ハガキ">ハガキ</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-2">配布方法 (ターゲット)</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="軒並み配布">軒並み配布 (すべての世帯)</option>
                <option value="戸建限定">戸建限定</option>
                <option value="集合住宅限定">集合住宅限定</option>
              </select>
            </div>
          </div>

          <h3 className="font-bold text-indigo-700 mb-4 border-b border-indigo-100 pb-2">2. エリア検索</h3>
          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="住所を入力..." value={searchAddress} onChange={e => setSearchAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            <button onClick={handleSearch} className="bg-slate-800 text-white px-3 rounded-lg"><i className="bi bi-search"></i></button>
          </div>

          {/* 見積もり計算結果 */}
          <div className="mt-auto bg-slate-800 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
            <h4 className="text-xs font-bold text-slate-300 mb-3 relative z-10">お見積もり概算</h4>
            
            <div className="flex justify-between items-end mb-2 relative z-10">
              <span className="text-sm">選択エリア</span>
              <span className="font-bold">{selectedAreaIds.size} ヶ所</span>
            </div>
            <div className="flex justify-between items-end mb-4 border-b border-white/20 pb-3 relative z-10">
              <span className="text-sm">配布予定数</span>
              <span className="font-bold text-xl">{totalCount.toLocaleString()} <span className="text-xs font-normal">枚</span></span>
            </div>
            
            <div className="flex justify-between items-baseline relative z-10 mb-4">
              <span className="text-sm font-bold">合計 (税抜)</span>
              <span className="text-3xl font-black text-emerald-400">¥{totalPrice.toLocaleString()}</span>
            </div>

            <button 
              onClick={handleAddToCart} 
              disabled={totalCount === 0}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10"
            >
              <i className="bi bi-cart-plus-fill text-lg"></i>
              カートに入れる
            </button>
          </div>
        </div>

        {/* 右側: Google Map */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 relative">
          {!isLoaded ? <div className="w-full h-full flex items-center justify-center text-slate-400">Loading Map...</div> : (
            <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={14} options={{ mapTypeControl: false, streetViewControl: false }}>
              {mapAreas.map(area => (
                <Polygon
                  key={area.id}
                  paths={area.parsedPaths}
                  options={{
                    fillColor: selectedAreaIds.has(area.id) ? '#4f46e5' : '#94a3b8',
                    fillOpacity: selectedAreaIds.has(area.id) ? 0.6 : 0.2,
                    strokeColor: selectedAreaIds.has(area.id) ? '#312e81' : '#64748b',
                    strokeWeight: selectedAreaIds.has(area.id) ? 2 : 1,
                  }}
                  onClick={() => toggleArea(area.id)}
                />
              ))}
            </GoogleMap>
          )}
          
          <div className="absolute top-6 left-6 bg-white/95 backdrop-blur px-4 py-2 rounded-lg shadow-md border border-slate-200 text-sm font-bold text-slate-700 pointer-events-none">
            <i className="bi bi-info-circle-fill text-indigo-600 mr-2"></i>
            地図上のエリア（ポリゴン）をクリックして選択してください
          </div>
        </div>

      </div>
    </div>
  );
}