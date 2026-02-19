'use client';

import React, { useState, useEffect } from 'react';

// エリアデータの型定義
type Area = {
  id: number;
  address_code: string;
  town_name: string;
  chome_name: string;
  postal_code: string;
  door_to_door_count: number;
  posting_cap_with_ng: number;
  city?: { name: string };
};

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // データをAPIから取得
  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await fetch('/api/areas');
        const json = await res.json();
        setAreas(json.data || []);
      } catch (err) {
        console.error('データ取得失敗:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAreas();
  }, []);

  // 検索フィルタリング
  const filteredAreas = areas.filter(area => 
    area.town_name.includes(searchTerm) || 
    area.address_code.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">エリア管理</h1>
          <p className="text-slate-500 text-sm">配布エリアのマスタ情報と世帯数統計を管理します。</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-sm">
          + 新規登録
        </button>
      </div>

      {/* 検索バー */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="町名やエリアコードで検索..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">コード</th>
              <th className="px-6 py-4 font-semibold">市区町村 / 町名</th>
              <th className="px-6 py-4 font-semibold text-right">総世帯数</th>
              <th className="px-6 py-4 font-semibold text-right text-blue-600">配布可能数</th>
              <th className="px-6 py-4 font-semibold text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">読み込み中...</td></tr>
            ) : filteredAreas.map((area) => (
              <tr key={area.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-slate-500">{area.address_code}</td>
                <td className="px-6 py-4 font-medium text-slate-800">
                  {area.city?.name} {area.town_name} {area.chome_name}
                </td>
                <td className="px-6 py-4 text-sm text-right text-slate-600">{area.door_to_door_count.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-right font-bold text-blue-600">{area.posting_cap_with_ng.toLocaleString()}</td>
                <td className="px-6 py-4 text-center">
                  <button className="text-slate-400 hover:text-blue-600"><i className="bi bi-pencil-square"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}