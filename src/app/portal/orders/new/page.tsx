'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/components/portal/CartContext';
import { useNotification } from '@/components/ui/NotificationProvider';
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

// チラシサイズの表示順（小→大）
const FLYER_SIZE_ORDER = ['ハガキ', 'A5', 'B5', 'A4', 'B4', 'A3', 'B3', 'その他'];

// 配布方法の説明・アイコン定義
const METHOD_META: Record<string, { icon: string; description: string; recommended?: boolean }> = {
  all: {
    icon: 'bi-houses-fill',
    description: '一軒家・マンション・アパートなど、すべての建物にポスティングします。最も広い範囲にリーチできるスタンダードな方法です。',
    recommended: true,
  },
  detached: {
    icon: 'bi-house-fill',
    description: '一軒家（戸建住宅）のみに絞ってポスティングします。ファミリー層や持家世帯への訴求に効果的です。',
  },
  apartment: {
    icon: 'bi-building-fill',
    description: 'マンション・アパートなどの集合住宅のみにポスティングします。都市部の単身・若年世帯への訴求に適しています。',
  },
};

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editItemId = searchParams.get('editItemId');
  const { showToast } = useNotification();

  const { items, addItem, updateItem } = useCart();

  const [projectName, setProjectName] = useState('');
  const [orderType, setOrderType] = useState<'POSTING_ONLY' | 'PRINT_AND_POSTING'>('PRINT_AND_POSTING');
  const [size, setSize] = useState('A4');
  const [customSize, setCustomSize] = useState(''); // 「その他」選択時のカスタムサイズ入力
  const [method, setMethod] = useState(''); // DB取得後に初期値セット
  const [plannedCount, setPlannedCount] = useState<number | ''>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10); // 3日後から7日間
    return d.toISOString().split('T')[0];
  });
  const [spareDate, setSpareDate] = useState('');

  // 印刷仕様
  const [foldingTypeId, setFoldingTypeId] = useState<number | null>(null);
  const [paperType, setPaperType] = useState('コート紙');
  const [paperWeight, setPaperWeight] = useState('73kg (標準)');
  const [colorType, setColorType] = useState('両面カラー');
  const [printCount, setPrintCount] = useState<number | ''>('');
  const [printCountSameAsDistribution, setPrintCountSameAsDistribution] = useState(true);

  // 価格マスター
  const [pricingData, setPricingData] = useState<{
    flyerSizes: any[];
    foldingTypes: any[];
    areaRanks: any[];
    periodPrices: any[];
    distributionMethods: any[];
  }>({ flyerSizes: [], foldingTypes: [], areaRanks: [], periodPrices: [], distributionMethods: [] });

  useEffect(() => {
    fetch('/api/portal/pricing')
      .then(r => r.json())
      .then(d => {
        if (d.error || !d.flyerSizes) return; // 認証エラー等はスキップ
        setPricingData(d);
        // 初回ロード時にデフォルト配布方法をセット
        if (d.distributionMethods?.length > 0 && !method) {
          setMethod(d.distributionMethods[0].name);
        }
      })
      .catch(e => console.error('Pricing fetch error:', e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const minStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  }, []);
  const minEndDate = startDate || minStartDate;
  const minSpareDate = endDate || minEndDate;

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setStartDate(newDate);
    if (endDate && newDate && endDate < newDate) {
      setEndDate('');
      setSpareDate('');
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setEndDate(newDate);
    if (spareDate && newDate && spareDate < newDate) {
      setSpareDate('');
    }
  };

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

  useEffect(() => {
    if (editItemId && items.length > 0 && !isEditLoaded) {
      const editTarget = items.find(i => i.id === editItemId);
      if (editTarget) {
        setProjectName(editTarget.projectName || '');
        setOrderType(editTarget.type as any);
        // 「その他（xxxx）」形式で保存されている場合はカスタム入力を復元
        if (editTarget.size.startsWith('その他（') && editTarget.size.endsWith('）')) {
          setSize('その他');
          setCustomSize(editTarget.size.slice(4, -1));
        } else {
          setSize(editTarget.size);
          setCustomSize('');
        }
        setMethod(editTarget.method);
        setPlannedCount(editTarget.totalCount);
        setStartDate(editTarget.startDate || '');
        setEndDate(editTarget.endDate || '');
        setSpareDate(editTarget.spareDate || '');
        if (editTarget.foldingTypeId) setFoldingTypeId(editTarget.foldingTypeId);
        if (editTarget.paperType) setPaperType(editTarget.paperType);
        if (editTarget.paperWeight) setPaperWeight(editTarget.paperWeight);
        if (editTarget.colorType) setColorType(editTarget.colorType);
        if (editTarget.printCount && editTarget.printCount !== editTarget.totalCount) {
          setPrintCount(editTarget.printCount);
          setPrintCountSameAsDistribution(false);
        } else {
          setPrintCount('');
          setPrintCountSameAsDistribution(true);
        }

        setSelectedAreaIds(new Set(editTarget.selectedAreas.map(a => a.id)));

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
        if (r === 1) setMapZoom(15); else if (r === 2) setMapZoom(14); else if (r === 3) setMapZoom(13); else setMapZoom(12);

        // 中心座標 + 円周上の東西南北4点で逆ジオコーディングし、隣接する区のエリアも読み込む
        const offsetDeg = r * 0.009; // 約1km ≒ 0.009度
        const points = [
          { lat, lng },
          { lat: lat + offsetDeg, lng },
          { lat: lat - offsetDeg, lng },
          { lat, lng: lng + offsetDeg },
          { lat, lng: lng - offsetDeg },
        ];
        await Promise.all(points.map(p => fetchAreasForLocation(p.lat, p.lng)));

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
        }, 1000);
      } else showToast('住所が見つかりませんでした', 'warning');
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

  const selectedMethodObj = pricingData.distributionMethods.find(m => m.name === method) ?? null;
  const methodCapacityType = selectedMethodObj?.capacityType ?? 'all';
  const methodPriceAddon = selectedMethodObj?.priceAddon ?? 0;

  const getCapacity = (a: any) => {
    const doorCount = a.door_to_door_count || 0;
    const multiCount = a.multi_family_count || 0;
    if (methodCapacityType === 'apartment') return multiCount;
    if (methodCapacityType === 'detached') return Math.floor(Math.max(0, doorCount - multiCount) * 0.5);
    return doorCount;
  };

  const selectedAreasList = useMemo(() => mapAreas.filter(a => selectedAreaIds.has(a.id)), [mapAreas, selectedAreaIds]);
  const totalAreaCapacity = useMemo(() => selectedAreasList.reduce((sum, a) => sum + getCapacity(a), 0), [selectedAreasList, methodCapacityType]); // eslint-disable-line react-hooks/exhaustive-deps

  const pCount = typeof plannedCount === 'number' ? plannedCount : 0;
  // 希望配布枚数未入力の場合はエリア合計世帯数を使って金額計算
  const effectiveCount = pCount > 0 ? pCount : totalAreaCapacity;
  const isCapacityEnough = pCount > 0 && totalAreaCapacity >= pCount;

  // 動的価格計算
  const selectedFolding = pricingData.foldingTypes.find(f => f.id === foldingTypeId);
  const selectedSize = pricingData.flyerSizes.find(s => s.name === size);

  // エリアランクの加重平均単価（選択エリアのキャパシティで按分）
  const areaRankUnitPrice = useMemo(() => {
    if (selectedAreasList.length === 0) return 5.0;
    const totalCap = selectedAreasList.reduce((sum, a) => sum + getCapacity(a), 0);
    if (totalCap === 0) return 5.0;
    const weighted = selectedAreasList.reduce((sum, a) => {
      const cap = getCapacity(a);
      const rankPrice = a.areaRank?.postingUnitPrice ?? 5.0;
      return sum + cap * rankPrice;
    }, 0);
    return weighted / totalCap;
  }, [selectedAreasList, methodCapacityType]); // eslint-disable-line react-hooks/exhaustive-deps

  // チラシサイズによる単価加算
  const sizeAddon = selectedSize?.basePriceAddon ?? 0;

  // 配布期間による単価加算
  const periodAddon = useMemo(() => {
    if (!startDate || !endDate || pricingData.periodPrices.length === 0) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    // 開始日・終了日両方を含む日数 (例: 3/1〜3/7 = 7日間)
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const match = pricingData.periodPrices.find((p: any) =>
      days >= p.minDays && (p.maxDays === null || days <= p.maxDays)
    );
    return match ? (match.priceAddon ?? 0) : 0;
  }, [startDate, endDate, pricingData.periodPrices]);

  // 配布期間の日数（表示用）
  const distributionDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  // 実際の配布単価 = エリアランク単価 + サイズ加算 + 期間加算 + 配布方法加算
  const postingUnitPrice = areaRankUnitPrice + sizeAddon + periodAddon + methodPriceAddon;

  // 印刷単価
  const printUnitPricePerSheet = selectedSize
    ? (selectedSize.printUnitPrice + (selectedFolding?.unitPrice || 0))
    : (3.0 + (selectedFolding?.unitPrice || 0));

  // 配布合計 = min(選択エリア合計世帯数, 希望配布枚数) × 配布単価
  // エリア未選択または希望枚数未入力の場合は 0
  const billingCount = totalAreaCapacity > 0 ? Math.min(totalAreaCapacity, effectiveCount) : 0;
  const totalPosting = billingCount * postingUnitPrice;
  // 印刷合計（チェック時は配布枚数と同じ、チェック解除時は入力値）
  const pPrintCount = !printCountSameAsDistribution && typeof printCount === 'number' ? printCount : effectiveCount;
  const totalPrint = orderType === 'PRINT_AND_POSTING' ? pPrintCount * printUnitPricePerSheet : 0;
  const totalPrice = Math.floor(totalPosting + totalPrint);

  const selectedFoldingUnitPrice = selectedFolding?.unitPrice || 0;

  // カートに渡す実際のサイズ名（「その他」の場合はカスタム入力を含む）
  const effectiveSize = size === 'その他' && customSize.trim()
    ? `その他（${customSize.trim()}）`
    : size;

  const handleAddToCart = () => {
    if (pCount <= 0) {
      showToast('希望配布枚数を入力してください', 'warning'); return;
    }
    if (!isCapacityEnough) {
      showToast('選択されたエリアの世帯数が、希望配布枚数に達していません。マップまたは検索からエリアを追加してください', 'warning'); return;
    }
    if (!startDate || !endDate) {
      showToast('「開始予定日」と「完了期限日」を入力してください', 'warning'); return;
    }

    const newTarget = {
      type: orderType,
      title: `${effectiveSize}サイズ ${orderType === 'PRINT_AND_POSTING' ? '印刷＋ポスティング' : 'ポスティングのみ'} (${method})`,
      selectedAreas: selectedAreasList.map(a => ({
        id: a.id,
        name: `${a.city?.name} ${formatAreaName(a.town_name, a.chome_name)}`,
        count: getCapacity(a),
        prefName: a.prefecture?.name,
        cityName: a.city?.name
      })),
      totalCount: pCount,
      billingCount,
      method, size: effectiveSize, price: totalPrice,
      unitPrice: postingUnitPrice,
      areaRankUnitPrice,
      sizeAddon,
      periodAddon,
      methodPriceAddon,
      startDate, endDate, spareDate,
      projectName,
      // 印刷仕様
      foldingTypeId: orderType === 'PRINT_AND_POSTING' ? (foldingTypeId ?? undefined) : undefined,
      foldingTypeName: orderType === 'PRINT_AND_POSTING' ? (selectedFolding?.name ?? undefined) : undefined,
      foldingUnitPrice: orderType === 'PRINT_AND_POSTING' ? selectedFoldingUnitPrice : undefined,
      paperType: orderType === 'PRINT_AND_POSTING' ? paperType : undefined,
      paperWeight: orderType === 'PRINT_AND_POSTING' ? paperWeight : undefined,
      colorType: orderType === 'PRINT_AND_POSTING' ? colorType : undefined,
      printCount: orderType === 'PRINT_AND_POSTING' ? pPrintCount : undefined,
    };

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
      <div className="w-[380px] h-full bg-white flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.06)] z-20 border-r border-slate-200">

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
                <label className="text-[10px] font-bold text-slate-500 block mb-1">希望配布枚数 <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input type="number" required value={plannedCount} onChange={e => setPlannedCount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700 text-right pr-8 transition-shadow" placeholder="例: 10000" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">枚</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">チラシサイズ</label>
                <select
                  value={size}
                  onChange={e => { setSize(e.target.value); if (e.target.value !== 'その他') setCustomSize(''); }}
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer"
                >
                  {(pricingData.flyerSizes.length > 0
                    ? [...pricingData.flyerSizes].sort((a, b) => {
                        const ai = FLYER_SIZE_ORDER.indexOf(a.name);
                        const bi = FLYER_SIZE_ORDER.indexOf(b.name);
                        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                      })
                    : [
                        { id: 'ハガキ', name: 'ハガキ', basePriceAddon: -0.5 },
                        { id: 'A5',   name: 'A5',   basePriceAddon: -0.25 },
                        { id: 'B5',   name: 'B5',   basePriceAddon: -0.25 },
                        { id: 'A4',   name: 'A4',   basePriceAddon: 0 },
                        { id: 'B4',   name: 'B4',   basePriceAddon: 0 },
                        { id: 'A3',   name: 'A3',   basePriceAddon: 0 },
                        { id: 'B3',   name: 'B3',   basePriceAddon: 0 },
                        { id: 'その他', name: 'その他', basePriceAddon: 0 },
                      ]
                  ).map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                      {s.basePriceAddon < 0
                        ? `  (-¥${Math.abs(s.basePriceAddon)}/枚)`
                        : s.basePriceAddon > 0
                          ? `  (+¥${s.basePriceAddon}/枚)`
                          : ''
                      }
                    </option>
                  ))}
                </select>
                {/* 「その他」選択時のカスタムサイズ入力 */}
                {size === 'その他' && (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                      type="text"
                      value={customSize}
                      onChange={e => setCustomSize(e.target.value)}
                      className="w-full border border-indigo-300 bg-indigo-50 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
                      placeholder="サイズを入力（例: B2、正方形 など）"
                      maxLength={30}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-2">配布方法</label>
                <div className="flex flex-col gap-1.5">
                  {pricingData.distributionMethods.map(m => {
                    const meta = METHOD_META[m.capacityType] ?? { icon: 'bi-send-fill', description: '' };
                    const isSelected = method === m.name;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.name)}
                        className={`flex items-center px-3 py-2.5 rounded-xl border-2 transition-all text-left w-full ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        {/* ラジオインジケーター */}
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all mr-2 ${
                          isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[1px]"></div>}
                        </div>

                        {/* アイコン */}
                        <i className={`bi ${meta.icon} text-base mr-2 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}></i>

                        {/* ラベル */}
                        <span className={`font-bold text-xs flex-1 ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {m.name}
                        </span>

                        {/* おすすめバッジ */}
                        {meta.recommended && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 mr-1.5 flex-shrink-0">
                            おすすめ
                          </span>
                        )}

                        {/* 価格加算 */}
                        {m.priceAddon > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium mr-1.5 flex-shrink-0">
                            +¥{m.priceAddon.toFixed(2)}/枚
                          </span>
                        )}

                        {/* ツールチップアイコン */}
                        {meta.description && (
                          <div className="group relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <i className="bi bi-info-circle text-slate-300 hover:text-indigo-400 transition-colors text-sm cursor-help"></i>
                            <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-slate-800 text-white text-[10px] leading-relaxed rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                              {meta.description}
                              <div className="absolute top-full right-3 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 印刷仕様 (PRINT_AND_POSTING のみ) */}
              {orderType === 'PRINT_AND_POSTING' && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                    <i className="bi bi-printer-fill"></i> 印刷仕様
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">折り加工</label>
                    <select
                      value={foldingTypeId ?? ''}
                      onChange={e => setFoldingTypeId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer"
                    >
                      <option value="">折り加工なし (¥0)</option>
                      {pricingData.foldingTypes.map(f => (
                        <option key={f.id} value={f.id}>{f.name} (+¥{f.unitPrice.toFixed(1)}/枚)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">用紙種類</label>
                      <select value={paperType} onChange={e => setPaperType(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer">
                        <option value="コート紙">コート紙</option>
                        <option value="マット紙">マット紙</option>
                        <option value="上質紙">上質紙</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">厚さ</label>
                      <select value={paperWeight} onChange={e => setPaperWeight(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer">
                        <option value="73kg (標準)">73kg (標準)</option>
                        <option value="90kg (少し厚め)">90kg</option>
                        <option value="110kg (厚手)">110kg</option>
                        <option value="135kg (ハガキ厚)">135kg</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">カラー</label>
                    <select value={colorType} onChange={e => setColorType(e.target.value)} className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer">
                      <option value="両面カラー">両面カラー</option>
                      <option value="片面カラー (裏面白紙)">片面カラー</option>
                      <option value="両面モノクロ">両面モノクロ</option>
                      <option value="片面モノクロ">片面モノクロ</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-2">印刷枚数</label>
                    <label className="flex items-center gap-2 cursor-pointer mb-2 select-none">
                      <input
                        type="checkbox"
                        checked={printCountSameAsDistribution}
                        onChange={e => {
                          setPrintCountSameAsDistribution(e.target.checked);
                          if (e.target.checked) setPrintCount('');
                        }}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-600">
                        配布枚数と同じ
                        {pCount > 0 && (
                          <span className="ml-1 text-indigo-600">({pCount.toLocaleString()}枚)</span>
                        )}
                      </span>
                    </label>
                    {!printCountSameAsDistribution && (
                      <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                        <input
                          type="number"
                          value={printCount}
                          onChange={e => setPrintCount(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full border border-slate-300 p-2 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 text-right pr-8"
                          placeholder="印刷枚数を入力"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">枚</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">2</div>
              <h3 className="font-bold text-slate-800">配布期間を選択</h3>
              {/* 期間別料金表ツールチップ */}
              {pricingData.periodPrices.length > 0 && (
                <div className="group relative ml-auto flex-shrink-0">
                  <button type="button" className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition-colors cursor-help">
                    <i className="bi bi-clock-history text-sm"></i>
                    期間料金
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-800 text-white rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-700 text-[10px] font-black text-slate-200 flex items-center gap-1.5">
                      <i className="bi bi-clock-history"></i> 配布期間による単価加算
                    </div>
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="px-3 py-1.5 text-left text-slate-400 font-bold">期間</th>
                          <th className="px-3 py-1.5 text-right text-slate-400 font-bold">単価加算</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingData.periodPrices.map((p: any, i: number) => (
                          <tr key={i} className="border-b border-slate-700/50 last:border-0">
                            <td className="px-3 py-1.5 text-slate-200">
                              {p.label
                                ? p.label
                                : p.maxDays
                                  ? `${p.minDays}〜${p.maxDays}日`
                                  : `${p.minDays}日以上`
                              }
                            </td>
                            <td className={`px-3 py-1.5 text-right font-bold ${p.priceAddon > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                              {p.priceAddon > 0 ? `+¥${p.priceAddon.toFixed(2)}/枚` : '加算なし'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">開始予定日 <span className="text-rose-500">*</span></label>
                <input type="date" required value={startDate} min={minStartDate} onChange={handleStartDateChange} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">完了期限日 <span className="text-rose-500">*</span></label>
                <input type="date" required value={endDate} min={minEndDate} onChange={handleEndDateChange} className="w-full border border-indigo-300 p-2.5 rounded-lg text-sm bg-indigo-50 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700" />
              </div>
              {startDate && endDate && (
                <div className={`text-[10px] font-bold px-3 py-2 rounded-lg border ${periodAddon > 0 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-50 border-slate-200'}`}>
                  <i className="bi bi-clock-fill mr-1"></i>
                  配布期間: {distributionDays}日間
                  {periodAddon > 0
                    ? <span className="ml-2 text-amber-700">→ 単価に +¥{periodAddon.toFixed(2)}/枚 が加算されます</span>
                    : <span className="ml-2 text-slate-400">→ 期間加算なし</span>
                  }
                </div>
              )}
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
                <input type="date" value={spareDate} min={minSpareDate} onChange={e => setSpareDate(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600" />
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
            {searchMarker && <Circle center={searchMarker} radius={appliedRadiusKm * 1000} options={{ fillColor: '#4f46e5', fillOpacity: 0.1, strokeColor: '#4338ca', strokeWeight: 2, clickable: false }} />}
            {mapAreas.map(area => <MemoizedArea key={area.id} area={area} isSelected={selectedAreaIds.has(area.id)} currentZoom={currentZoom} onClick={toggleArea} />)}
          </GoogleMap>
        )}

        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-slate-200 text-[11px] font-bold text-slate-600 pointer-events-none flex items-center gap-2">
          <i className="bi bi-cursor-fill text-indigo-500 text-lg"></i>
          地図上のエリアをクリックして、配布エリアを選択出来ます
        </div>

        {/* --- 右端フローティング: 見積もり＆リストパネル --- */}
        <div className="absolute top-4 right-4 bottom-4 w-[340px] flex flex-col pointer-events-none z-30">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 flex flex-col h-full pointer-events-auto overflow-hidden">

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

              {billingCount > 0 && (
                <div className="text-[10px] text-slate-500 mb-2 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1 flex-wrap">
                      配布費
                      <span className="text-slate-400">
                        ({billingCount.toLocaleString()}枚 × ¥{postingUnitPrice.toFixed(2)}
                        {sizeAddon > 0 && <span> +サイズ:{sizeAddon.toFixed(2)}</span>}
                        {periodAddon > 0 && <span className="text-amber-500"> +期間:{periodAddon.toFixed(2)}</span>}
                        {methodPriceAddon > 0 && <span className="text-violet-500"> +方法:{methodPriceAddon.toFixed(2)}</span>}
                        )
                      </span>
                    </span>
                    <span>¥{Math.floor(totalPosting).toLocaleString()}</span>
                  </div>
                  {orderType === 'PRINT_AND_POSTING' && effectiveCount > 0 && (
                    <div className="flex justify-between">
                      <span>印刷費 <span className="text-slate-400">({pPrintCount.toLocaleString()}枚 × ¥{printUnitPricePerSheet.toFixed(2)})</span></span>
                      <span>¥{Math.floor(totalPrint).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-baseline mb-4 pb-1">
                <span className="text-xs font-bold text-slate-500">合計 (税抜)</span>
                <span className="text-3xl font-black text-indigo-600 tracking-tighter">¥{totalPrice.toLocaleString()}</span>
              </div>

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
