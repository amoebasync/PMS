'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ★ Google Maps と Turf のインポート
import { GoogleMap, useJsApiLoader, Polygon, Circle, Marker } from '@react-google-maps/api';
import * as turf from '@turf/turf';

// GoogleMapのコンテナスタイル
const mapContainerStyle = { width: '100%', height: '100%' };
const initialCenter = { lat: 35.6581, lng: 139.7414 }; // 東京タワー初期位置

// GeoJSONからGoogle Maps用の座標(paths)を抽出するヘルパー関数
const extractPaths = (geojsonStr: string) => {
  try {
    const geojson = JSON.parse(geojsonStr);
    let coords: any[] = [];
    if (geojson.type === 'Polygon') {
      coords = geojson.coordinates[0];
    } else if (geojson.type === 'MultiPolygon') {
      coords = geojson.coordinates[0][0]; // 簡易的に最初のポリゴンを使用
    } else if (geojson.geometry && geojson.geometry.type === 'Polygon') {
      coords = geojson.geometry.coordinates[0];
    } else if (geojson.geometry && geojson.geometry.type === 'MultiPolygon') {
      coords = geojson.geometry.coordinates[0][0];
    }
    return coords.map((c: any[]) => ({ lat: c[1], lng: c[0] })); // GeoJSONは[lng, lat]なので反転
  } catch (e) {
    return [];
  }
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

  // 基本情報フォーム
  const [formData, setFormData] = useState({
    orderNo: '', customerId: '', salesRepId: '', orderDate: new Date().toISOString().split('T')[0],
    totalAmount: '', status: 'PLANNING', remarks: ''
  });

  // 配布タブフォーム
  const [distForm, setDistForm] = useState({
    flyerId: '', method: '軒並み配布', plannedCount: '', startDate: '', endDate: '', spareDate: '', remarks: ''
  });

  // --- マップ・エリア選択用のState ---
  const [mapAreas, setMapAreas] = useState<any[]>([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<number>>(new Set());
  const [searchAddress, setSearchAddress] = useState('');
  const [radiusKm, setRadiusKm] = useState(1);
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [searchMarker, setSearchMarker] = useState<{lat: number, lng: number} | null>(null);

  // Google Maps APIのロード
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  // 初期データ取得
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
              // 登録済みのエリアがあれば選択状態にする (今回は簡略化のため新規選択にフォーカスします)
            }
          }
        }
      } catch (e) { console.error(e); }
      setIsLoading(false);
    };
    fetchInitialData();
  }, [id, isNew]);

  // 配布タブが開かれたらマップ用エリアデータを取得
  useEffect(() => {
    if (activeTab === 'DIST' && mapAreas.length === 0) {
      fetch('/api/areas/map').then(r => r.json()).then(data => setMapAreas(data));
    }
  }, [activeTab]);

  // 基本情報の入力ハンドラ
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 配布情報の入力ハンドラ
  const handleDistChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDistForm(prev => ({ ...prev, [name]: value }));
  };

  // --- ★ 住所検索 ＆ 半径による自動選択ロジック ---
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

        // 1. Turf.js で中心点から指定半径の「円ポリゴン」を作成
        const centerPoint = turf.point([lng, lat]);
        const searchCircle = turf.circle(centerPoint, radiusKm, { steps: 64, units: 'kilometers' });

        // 2. 現在の選択状態をクリアして、新しく交差判定する
        const newSelected = new Set<number>();

        mapAreas.forEach(area => {
          if (!area.boundary_geojson) return;
          try {
            let geojsonData = JSON.parse(area.boundary_geojson);
            // Featureオブジェクトに変換
            if (geojsonData.type !== 'Feature') {
              geojsonData = turf.feature(geojsonData);
            }
            
            // 3. Turf.js で円とエリアポリゴンが重なっているか(Intersect)を判定
            if (turf.booleanIntersects(searchCircle, geojsonData)) {
              newSelected.add(area.id);
            }
          } catch (e) { /* 解析エラーはスキップ */ }
        });

        setSelectedAreaIds(newSelected);
      } else {
        alert('入力された住所が見つかりませんでした。');
      }
    });
  };

  // マップ上のポリゴンを直接クリックしたときのトグル処理
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

  // --- ★ 配布可能枚数の集計とバリデーション ---
  const totalCapacity = mapAreas
    .filter(a => selectedAreaIds.has(a.id))
    .reduce((sum, a) => sum + (a.posting_cap_with_ng || 0), 0);

  const plannedCount = parseInt(distForm.plannedCount) || 0;
  
  // 選択エリアの合計可能枚数が、予定枚数を上回っていればOK
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
        
        {/* --- 基本情報タブ --- */}
        {activeTab === 'BASIC' && (
          <form onSubmit={saveBasicInfo} className="space-y-6 max-w-4xl">
            {/* 略 (前回の内容と同じ) */}
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

        {/* --- 配布(ポスティング)タブ --- */}
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
                  <select name="method" value={distForm.method} onChange={handleDistChange} className="w-full border p-2.5 rounded-lg text-sm bg-white">
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

            {/* --- 地図連携エリア --- */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* マップ操作バー */}
              <div className="bg-slate-800 p-4 text-white flex flex-wrap gap-4 justify-between items-center">
                <h3 className="font-bold flex items-center gap-2 whitespace-nowrap"><i className="bi bi-2-circle-fill"></i> マップによるエリア選択</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <i className="bi bi-geo-alt absolute left-3 top-2 text-slate-400"></i>
                    <input 
                      type="text" 
                      placeholder="住所で検索 (例: 港区芝公園)" 
                      value={searchAddress}
                      onChange={e => setSearchAddress(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchAndSelect()}
                      className="pl-9 pr-3 py-1.5 rounded-lg text-sm text-slate-900 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))} className="px-3 py-1.5 rounded-lg text-sm text-slate-900 bg-white outline-none">
                    <option value={1}>半径 1km</option>
                    <option value={2}>半径 2km</option>
                    <option value={3}>半径 3km</option>
                    <option value={5}>半径 5km</option>
                  </select>
                  <button onClick={handleSearchAndSelect} className="bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors">
                    検索 ＆ エリア自動選択
                  </button>
                  <button onClick={() => setSelectedAreaIds(new Set())} className="bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ml-2">
                    クリア
                  </button>
                </div>
              </div>
              
              {/* Google Maps 描画エリア */}
              <div className="h-[600px] w-full bg-slate-100 relative">
                {!isLoaded ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold"><i className="bi bi-arrow-repeat animate-spin mr-2"></i>地図を読み込んでいます...</div>
                ) : (
                  <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={13} options={{ mapTypeControl: false, streetViewControl: false }}>
                    
                    {/* 検索中心ピン */}
                    {searchMarker && <Marker position={searchMarker} />}
                    
                    {/* 検索半径の円（視覚的ガイド） */}
                    {searchMarker && (
                      <Circle 
                        center={searchMarker} 
                        radius={radiusKm * 1000} 
                        options={{ fillColor: '#10b981', fillOpacity: 0.1, strokeColor: '#059669', strokeWeight: 2, borderStyle: 'dashed' }} 
                      />
                    )}

                    {/* エリアポリゴンの一括描画 */}
                    {mapAreas.map(area => {
                      if (!area.boundary_geojson) return null;
                      const paths = extractPaths(area.boundary_geojson);
                      if (paths.length === 0) return null;
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
                
                {/* 選択状況＆バリデーションのフローティングパネル */}
                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur p-5 rounded-2xl shadow-2xl border border-slate-200 w-80">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b pb-2 flex justify-between">
                    エリア選択状況
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px]">{selectedAreaIds.size} エリア</span>
                  </h4>
                  
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-sm font-bold text-slate-600">配布可能枚数 (合計)</span>
                    <div className="text-right">
                      <span className={`text-2xl font-black ${isCapacityEnough ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {totalCapacity.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">枚</span>
                    </div>
                  </div>
                  
                  {/* バリデーション表示 */}
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
                  {(!distForm.flyerId) && (
                    <p className="text-[10px] text-center text-slate-400 mt-2">※上部で「配布するチラシ」を選択してください</p>
                  )}
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