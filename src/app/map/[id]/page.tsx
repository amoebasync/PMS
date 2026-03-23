'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { GoogleMap, useJsApiLoader, Polygon, Polyline, Marker } from '@react-google-maps/api';

interface GpsPoint { lat: number; lng: number; t: string }
interface ProgressEvent { count: number; lat: number | null; lng: number | null; t: string }
interface TrajectoryData {
  distributor: string;
  staffId: string;
  date: string;
  areaName: string;
  status: string;
  session: { startedAt: string; finishedAt: string | null } | null;
  gpsPoints: GpsPoint[];
  progressEvents: ProgressEvent[];
  boundary: string | null;
  items: { name: string; planned: number; actual: number | null }[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const mm = String(jst.getMonth() + 1).padStart(2, '0');
  const dd = String(jst.getDate()).padStart(2, '0');
  return `${mm}/${dd}（${DAY_NAMES[jst.getDay()]}）`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<string, string> = {
  UNSTARTED: '未開始', IN_PROGRESS: '進行中', DISTRIBUTING: '配布中', COMPLETED: '完了',
};

export default function PublicMapPage() {
  const { id } = useParams();
  const [data, setData] = useState<TrajectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  useEffect(() => {
    fetch(`/api/public/trajectory?id=${id}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setData)
      .catch(() => setError('データが見つかりません'))
      .finally(() => setLoading(false));
  }, [id]);

  const center = useMemo(() => {
    if (!data?.gpsPoints.length) return { lat: 35.68, lng: 139.76 };
    const pts = data.gpsPoints;
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return { lat, lng };
  }, [data]);

  const boundary = useMemo(() => {
    if (!data?.boundary) return null;
    try {
      const geo = JSON.parse(data.boundary);
      const coords = geo.type === 'Polygon' ? geo.coordinates[0]
        : geo.type === 'MultiPolygon' ? geo.coordinates[0][0] : null;
      return coords?.map((c: number[]) => ({ lat: c[1], lng: c[0] })) || null;
    } catch { return null; }
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <p className="text-slate-500 text-sm">{error || 'データなし'}</p>
      </div>
    );
  }

  const hasGps = data.gpsPoints.length > 0;

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-800 text-sm">{data.distributor}</div>
            <div className="text-xs text-slate-500">{data.staffId} | {formatDate(data.date)} | {data.areaName}</div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            data.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700'
              : data.status === 'DISTRIBUTING' ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
          }`}>
            {STATUS_LABEL[data.status] || data.status}
          </span>
        </div>
        {data.session && (
          <div className="text-[10px] text-slate-400 mt-1">
            {formatTime(data.session.startedAt)} 開始
            {data.session.finishedAt && ` → ${formatTime(data.session.finishedAt)} 終了`}
            {hasGps && ` | ${data.gpsPoints.length} GPS pts`}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1">
        {isLoaded && hasGps ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={16}
            options={{ disableDefaultUI: true, zoomControl: true, mapTypeControl: false }}
          >
            {boundary && (
              <Polygon
                paths={boundary}
                options={{ fillColor: '#6366F1', fillOpacity: 0.08, strokeColor: '#6366F1', strokeWeight: 2, strokeOpacity: 0.5 }}
              />
            )}
            <Polyline
              path={data.gpsPoints.map(p => ({ lat: p.lat, lng: p.lng }))}
              options={{ strokeColor: '#2563EB', strokeWeight: 3, strokeOpacity: 0.8 }}
            />
            {/* Start marker */}
            <Marker
              position={{ lat: data.gpsPoints[0].lat, lng: data.gpsPoints[0].lng }}
              label={{ text: 'S', color: '#FFF', fontSize: '10px', fontWeight: 'bold' }}
              icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#16A34A', fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFF' }}
            />
            {/* End marker */}
            {data.gpsPoints.length > 1 && (
              <Marker
                position={{ lat: data.gpsPoints[data.gpsPoints.length - 1].lat, lng: data.gpsPoints[data.gpsPoints.length - 1].lng }}
                label={{ text: 'E', color: '#FFF', fontSize: '10px', fontWeight: 'bold' }}
                icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#DC2626', fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFF' }}
              />
            )}
            {/* Progress markers */}
            {data.progressEvents.filter(e => e.lat && e.lng).map((e, i) => (
              <Marker
                key={i}
                position={{ lat: e.lat!, lng: e.lng! }}
                label={{ text: String(e.count), color: '#FFF', fontSize: '9px', fontWeight: 'bold' }}
                icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#F59E0B', fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFF' }}
              />
            ))}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-sm">{hasGps ? '地図を読み込み中...' : 'GPSデータがありません'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
