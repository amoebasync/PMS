# エリア別GPS履歴比較機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同一エリアの過去の配布員GPS軌跡をポスティングシステムから取得し、現在の配布員のGPSと地図上で重ねて比較表示することで、不正配布の検出精度を向上させる。

**Architecture:** ポスティングシステム（PHP/MySQL）に新規API `GetAreaHistory.php` を追加し、住所コード（`STREET_NUMBER`）ベースでそのエリアの過去配布履歴を返す。PMS側では新規プロキシAPIと共通ユーティリティ関数を追加し、既存の `AllTrajectoriesViewer` パターン（Google Maps + `@react-google-maps/api`）を踏襲した比較ビューアコンポーネントを作成する。不正検知ページ `/quality/fraud-detection` に「エリアGPS比較」タブを追加する形で統合する。

**Tech Stack:** Next.js (App Router), TypeScript, Google Maps API (`@react-google-maps/api`), PHP/MySQL (ポスティングシステム側), Tailwind CSS, i18n (ja/en)

---

## ポスティングシステムDB構造（調査済み）

### `t_terminal_information`（GPSデータ）
| カラム | 型 | 説明 |
|---|---|---|
| `REG_USER_ID` | varchar(7) | スタッフID |
| `TERMINAL_DATE` | date | 日付 |
| `TERMINAL_TIME` | time | 時刻 |
| `LATITUDE` | decimal(8,6) | 緯度 |
| `LONGITUDE` | decimal(9,6) | 経度 |

### `t_posting`（配布スケジュール）
| カラム | 型 | 説明 |
|---|---|---|
| `COMPANY_CD` | char(8) | 会社コード (PK) |
| `CONDITION_DATE` | date | 配布日 (PK) |
| `KEY_CD` | varchar(5) | キーコード (PK) |
| `STREET_NUMBER` | varchar(11) | **住所コード（エリア紐付け）** |
| `MANAGE_CODE` | varchar(7) | **スタッフID** |
| `CITY` | varchar(100) | 市区町村名 |
| `STAFF_NAME` | varchar(100) | 配布員名 |
| `SHEETS1`〜`SHEETS6` | int(5) | 計画枚数 |
| `POSTED1_NUM`〜`POSTED6_NUM` | int(5) | 実績枚数 |
| `FLYER1`〜`FLYER6` | varchar(100) | チラシ名 |

### PMS `areas` テーブル
| カラム | 型 | 説明 |
|---|---|---|
| `address_code` | String @unique | 住所コード（`t_posting.STREET_NUMBER` と対応する想定） |
| `boundary_geojson` | Text | エリアポリゴン（地図表示用） |

---

## ファイル構成

### ポスティングシステム側（PHP）
| ファイル | 操作 | 役割 |
|---|---|---|
| `/var/www/html/postingmanage/GetAreaHistory.php` | **新規** | 住所コードで過去の配布履歴を返すAPI |

### PMS側（TypeScript / Next.js）
| ファイル | 操作 | 役割 |
|---|---|---|
| `src/lib/posting-system.ts` | **新規** | PS API呼び出し共通ユーティリティ（`fetchStaffGps`, `fetchAreaHistory`） |
| `src/app/api/posting-system/area-history/route.ts` | **新規** | PS `GetAreaHistory.php` のプロキシAPI |
| `src/app/api/posting-system/staff-gps/route.ts` | **新規** | PS `GetStaffGPS.php` のプロキシAPI（共通util使用） |
| `src/components/quality/AreaGpsComparison.tsx` | **新規** | エリアGPS比較ビューアコンポーネント |
| `src/app/quality/fraud-detection/page.tsx` | **修正** | タブUI追加（不正検知一覧 / エリアGPS比較） |
| `src/i18n/locales/ja/fraud-detection.json` | **修正** | 日本語翻訳キー追加 |
| `src/i18n/locales/en/fraud-detection.json` | **修正** | 英語翻訳キー追加 |

---

## Task 0: 住所コード対応の確認（前提調査）

**重要:** この調査結果が全タスクの設計前提となる。SSH復旧後に最優先で実施する。

- [ ] **Step 1: ポスティングシステムの `STREET_NUMBER` フォーマットを確認**

```sql
-- t_posting から使われている STREET_NUMBER の例を確認
SELECT DISTINCT STREET_NUMBER, CITY
FROM t_posting
WHERE CITY LIKE '%豊島%'
AND STREET_NUMBER IS NOT NULL
LIMIT 20;

-- STREET_NUMBER のフォーマット全体像
SELECT STREET_NUMBER, COUNT(*) as cnt
FROM t_posting
WHERE STREET_NUMBER IS NOT NULL
GROUP BY STREET_NUMBER
ORDER BY cnt DESC
LIMIT 30;
```

- [ ] **Step 2: PMS `areas.address_code` との対応を確認**

```sql
-- PMS側のaddress_codeのサンプル
SELECT address_code, town_name, chome_name
FROM areas
WHERE town_name LIKE '%豊島%' OR chome_name LIKE '%豊島%'
LIMIT 20;
```

- [ ] **Step 3: 対応方針を確定**

| ケース | 対応 |
|---|---|
| `STREET_NUMBER` = `areas.address_code`（同一フォーマット） | そのまま使用 |
| フォーマットが異なるが変換可能 | 変換ロジックを `src/lib/posting-system.ts` に追加 |
| 独自コードで対応不可 | `GetAreaHistory.php` を `CITY` ベースの検索に変更 |

---

## Task 1: ポスティングシステム側 — `GetAreaHistory.php` 新規作成

**Files:**
- Create: `/var/www/html/postingmanage/GetAreaHistory.php`

### 仕様

**リクエスト:** `POST`
```
STREET_NUMBER=13116008004  (住所コード)
LIMIT=50                   (任意、デフォルト50)
```

**レスポンス:**
```json
[
  {
    "CONDITION_DATE": "2026-03-15",
    "MANAGE_CODE": "T001234",
    "STAFF_NAME": "田中太郎",
    "CITY": "豊島区",
    "STREET_NUMBER": "13116008004",
    "TOTAL_SHEETS": 1500,
    "TOTAL_POSTED": 1480
  }
]
```

- [ ] **Step 1: PHPファイル作成**

```php
<?php
/**
 * エリア別配布履歴取得API
 * STREET_NUMBERで過去の配布スケジュールを検索し、スタッフ・日付・枚数を返す
 */

require_once dirname(__FILE__) . '/config/database.php';

header('Content-Type: application/json; charset=UTF-8');

ob_start();

try {
    // API Key 認証
    $apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
    // 注: GetStaffGPS.php と同じ認証方式。API_KEY定数がconfig側にあれば使用。

    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $streetNumber = isset($_POST['STREET_NUMBER']) ? $_POST['STREET_NUMBER'] : '';
    $limit = isset($_POST['LIMIT']) ? intval($_POST['LIMIT']) : 50;

    if (empty($streetNumber)) {
        http_response_code(400);
        ob_end_clean();
        echo json_encode(["error" => "STREET_NUMBER is required"]);
        exit;
    }

    if ($limit < 1 || $limit > 200) {
        $limit = 50;
    }

    // t_posting から該当住所コードの過去配布履歴を取得
    // MANAGE_CODE が空でないもの（配布員が割り当てられたもの）のみ
    $sql = "SELECT
                CONDITION_DATE,
                MANAGE_CODE,
                STAFF_NAME,
                CITY,
                STREET_NUMBER,
                (IFNULL(SHEETS1,0) + IFNULL(SHEETS2,0) + IFNULL(SHEETS3,0) + IFNULL(SHEETS4,0) + IFNULL(SHEETS5,0) + IFNULL(SHEETS6,0)) AS TOTAL_SHEETS,
                (IFNULL(POSTED1_NUM,0) + IFNULL(POSTED2_NUM,0) + IFNULL(POSTED3_NUM,0) + IFNULL(POSTED4_NUM,0) + IFNULL(POSTED5_NUM,0) + IFNULL(POSTED6_NUM,0)) AS TOTAL_POSTED
            FROM t_posting
            WHERE STREET_NUMBER = :streetNumber
            AND MANAGE_CODE IS NOT NULL
            AND MANAGE_CODE != ''
            ORDER BY CONDITION_DATE DESC
            LIMIT :lmt";

    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':streetNumber', $streetNumber, PDO::PARAM_STR);
    $stmt->bindParam(':lmt', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $results = $stmt->fetchAll();

    ob_end_clean();
    echo json_encode($results);

} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(["error" => "Internal server error"]);
}
?>
```

- [ ] **Step 2: SSH でファイルを配置して動作確認**

```bash
# ポスティングシステムサーバーにSSHして配置
# curl でテスト
curl -X POST https://postingsystem.net/postingmanage/GetAreaHistory.php \
  -d "STREET_NUMBER=13116008004&LIMIT=5"
```

Expected: JSON配列が返ること（データがない住所コードの場合は空配列 `[]`）

---

## Task 2: PMS側 — 共通ユーティリティ＆プロキシAPI

**Files:**
- Create: `src/lib/posting-system.ts`
- Create: `src/app/api/posting-system/area-history/route.ts`
- Create: `src/app/api/posting-system/staff-gps/route.ts`

### 2-A: 共通ユーティリティ関数

- [ ] **Step 1: `src/lib/posting-system.ts` を作成**

既存コードベースの6箇所以上で重複している PS API呼び出しロジックを共通化する。

```typescript
/**
 * ポスティングシステム API 共通ユーティリティ
 */

const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (PS_API_KEY) headers['X-API-Key'] = PS_API_KEY;
  return headers;
}

export function isPostingSystemConfigured(): boolean {
  return !!PS_API_URL;
}

/**
 * PS GetStaffGPS.php を呼び出してPMS形式のGPSポイント配列を返す
 */
export async function fetchStaffGps(
  staffId: string,
  targetDate: string, // YYYY-MM-DD
  options?: { maxPoints?: number }
): Promise<{ lat: number; lng: number; timestamp: string }[]> {
  if (!PS_API_URL) return [];

  const psRes = await fetch(`${PS_API_URL}/GetStaffGPS.php`, {
    method: 'POST',
    headers: getHeaders(),
    body: new URLSearchParams({ STAFF_ID: staffId, TARGET_DATE: targetDate }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!psRes.ok) return [];

  const body = await psRes.text();
  let rows: any[];
  try {
    const parsed = JSON.parse(body);
    rows = Array.isArray(parsed) ? parsed : (parsed.data || []);
  } catch {
    return [];
  }

  const gpsPoints = rows
    .filter((r: any) => {
      const lat = parseFloat(r.LATITUDE || '0');
      const lng = parseFloat(r.LONGITUDE || '0');
      return lat !== 0 && lng !== 0;
    })
    .map((r: any) => {
      const terminalTime = (r.TERMINAL_TIME || '').trim();
      const isoTimestamp = terminalTime
        ? `${targetDate}T${terminalTime}+09:00`
        : new Date().toISOString();
      return {
        lat: parseFloat(r.LATITUDE),
        lng: parseFloat(r.LONGITUDE),
        timestamp: isoTimestamp,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // サンプリング
  const maxPoints = options?.maxPoints ?? 500;
  if (gpsPoints.length > maxPoints) {
    const step = Math.ceil(gpsPoints.length / maxPoints);
    return gpsPoints.filter((_, i) => i % step === 0 || i === gpsPoints.length - 1);
  }

  return gpsPoints;
}

/**
 * PS GetAreaHistory.php を呼び出して過去配布履歴を返す
 */
export type AreaHistoryRecord = {
  conditionDate: string;
  manageCode: string;
  staffName: string;
  city: string;
  streetNumber: string;
  totalSheets: number;
  totalPosted: number;
};

export async function fetchAreaHistory(
  streetNumber: string,
  limit: number = 50
): Promise<AreaHistoryRecord[]> {
  if (!PS_API_URL) return [];

  const psRes = await fetch(`${PS_API_URL}/GetAreaHistory.php`, {
    method: 'POST',
    headers: getHeaders(),
    body: new URLSearchParams({ STREET_NUMBER: streetNumber, LIMIT: String(limit) }).toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!psRes.ok) return [];

  const body = await psRes.text();
  let rows: any[];
  try {
    const parsed = JSON.parse(body);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

  return rows.map((r: any) => ({
    conditionDate: r.CONDITION_DATE || '',
    manageCode: r.MANAGE_CODE || '',
    staffName: r.STAFF_NAME || '',
    city: r.CITY || '',
    streetNumber: r.STREET_NUMBER || '',
    totalSheets: parseInt(r.TOTAL_SHEETS) || 0,
    totalPosted: parseInt(r.TOTAL_POSTED) || 0,
  }));
}
```

### 2-B: プロキシAPI

- [ ] **Step 2: `src/app/api/posting-system/area-history/route.ts` を作成**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAreaHistory, isPostingSystemConfigured } from '@/lib/posting-system';

// GET /api/posting-system/area-history?streetNumber=xxx&limit=50
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get('pms_session')) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    if (!isPostingSystemConfigured()) {
      return NextResponse.json({ error: 'POSTING_SYSTEM_API_URL が設定されていません' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const streetNumber = searchParams.get('streetNumber');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!streetNumber) {
      return NextResponse.json({ error: 'streetNumber は必須です' }, { status: 400 });
    }

    const history = await fetchAreaHistory(streetNumber, limit);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Area History API Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
```

- [ ] **Step 3: `src/app/api/posting-system/staff-gps/route.ts` を作成**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchStaffGps, isPostingSystemConfigured } from '@/lib/posting-system';

// GET /api/posting-system/staff-gps?staffId=xxx&date=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get('pms_session')) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    if (!isPostingSystemConfigured()) {
      return NextResponse.json({ error: 'POSTING_SYSTEM_API_URL が設定されていません' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const date = searchParams.get('date');

    if (!staffId || !date) {
      return NextResponse.json({ error: 'staffId と date は必須です' }, { status: 400 });
    }

    const gpsPoints = await fetchStaffGps(staffId, date);
    return NextResponse.json({ gpsPoints, totalCount: gpsPoints.length });
  } catch (error) {
    console.error('Staff GPS API Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/posting-system.ts src/app/api/posting-system/area-history/route.ts src/app/api/posting-system/staff-gps/route.ts
git commit -m "feat: add posting system utility and proxy APIs for area history and staff GPS"
```

---

## Task 3: i18n 翻訳キー追加

**Files:**
- Modify: `src/i18n/locales/ja/fraud-detection.json`
- Modify: `src/i18n/locales/en/fraud-detection.json`

- [ ] **Step 1: 日本語キー追加**

`ja/fraud-detection.json` に以下を追加:
```json
{
  "tab_fraud_list": "不正検知一覧",
  "tab_area_comparison": "エリアGPS比較",
  "area_search_placeholder": "エリア名で検索（例: 豊島区南長崎）",
  "area_search_button": "検索",
  "area_selected": "選択中",
  "history_title": "過去配布履歴",
  "history_date": "配布日",
  "history_staff": "配布員",
  "history_staff_id": "スタッフID",
  "history_city": "市区町村",
  "history_sheets": "計画枚数",
  "history_posted": "実績枚数",
  "history_no_data": "このエリアの過去履歴はありません",
  "compare_button": "GPS比較表示",
  "compare_selected": "{count}件選択中",
  "compare_max_warning": "最大5件まで選択できます",
  "compare_loading": "GPSデータを取得中...",
  "compare_partial_error": "一部のGPSデータの取得に失敗しました",
  "compare_no_gps": "GPSデータなし",
  "legend_title": "凡例",
  "map_no_data": "比較するGPSデータを選択してください"
}
```

- [ ] **Step 2: 英語キー追加**

`en/fraud-detection.json` に以下を追加:
```json
{
  "tab_fraud_list": "Fraud Detection",
  "tab_area_comparison": "Area GPS Comparison",
  "area_search_placeholder": "Search area (e.g. Toshima Minaminagasaki)",
  "area_search_button": "Search",
  "area_selected": "Selected",
  "history_title": "Past Distribution History",
  "history_date": "Date",
  "history_staff": "Distributor",
  "history_staff_id": "Staff ID",
  "history_city": "City",
  "history_sheets": "Planned",
  "history_posted": "Actual",
  "history_no_data": "No past history for this area",
  "compare_button": "Compare GPS",
  "compare_selected": "{count} selected",
  "compare_max_warning": "Maximum 5 records can be selected",
  "compare_loading": "Loading GPS data...",
  "compare_partial_error": "Some GPS data failed to load",
  "compare_no_gps": "No GPS data",
  "legend_title": "Legend",
  "map_no_data": "Select GPS data to compare"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/ja/fraud-detection.json src/i18n/locales/en/fraud-detection.json
git commit -m "feat: add i18n keys for area GPS comparison"
```

---

## Task 4: エリアGPS比較ビューアコンポーネント

**Files:**
- Create: `src/components/quality/AreaGpsComparison.tsx`

### 設計

**ユーザーフロー:**
1. PMS の `areas` テーブルからエリアを検索（都道府県＋市区町村＋丁目）
2. 選択したエリアの `address_code` でポスティングシステムの過去履歴を取得
3. 履歴一覧から最大5件の過去配布を選択（チェックボックス）
4. 「GPS比較」ボタンで選択した配布のGPSデータを並列取得
5. Google Maps上に色分けして重ねて表示（配布員ごとに異なる色）

**UIレイアウト:**
```
┌──────────────────────────────────────────────────────┐
│  エリア検索: [________🔍]                              │
│  選択中: 東京都豊島区南長崎４丁目                        │
├──────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │ 過去配布履歴一覧       │  │                      │  │
│  │ ☑ 2026-03-15 田中太郎  │  │                      │  │
│  │ ☑ 2026-03-01 鈴木花子  │  │   Google Maps 地図    │  │
│  │ ☐ 2026-02-15 佐藤一郎  │  │   GPS軌跡の重ね表示    │  │
│  │ ☐ 2026-02-01 田中太郎  │  │                      │  │
│  │ ...                   │  │                      │  │
│  │ (最大5件選択可)        │  │                      │  │
│  │ [GPS比較表示]          │  │                      │  │
│  └──────────────────────┘  └──────────────────────┘  │
│                                                      │
│  凡例: ● 田中太郎(3/15) ● 鈴木花子(3/1)              │
└──────────────────────────────────────────────────────┘
```

- [ ] **Step 1: コンポーネント作成**

```typescript
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Polyline } from '@react-google-maps/api';
import { useTranslation } from '@/i18n';

// ============================================================
// Types
// ============================================================
type AreaResult = {
  id: number;
  address_code: string;
  town_name: string;
  chome_name: string;
  boundary_geojson: string | null;
  prefecture: { name: string };
  city: { name: string };
};

type HistoryRecord = {
  conditionDate: string;
  manageCode: string;
  staffName: string;
  city: string;
  streetNumber: string;
  totalSheets: number;
  totalPosted: number;
};

type GpsPoint = { lat: number; lng: number; timestamp: string };

type TrajectoryData = {
  key: string; // `${manageCode}_${conditionDate}`
  staffName: string;
  manageCode: string;
  date: string;
  gpsPoints: GpsPoint[];
  color: string;
};

// ============================================================
// Constants
// ============================================================
const TRAJECTORY_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48', '#0ea5e9', '#a855f7', '#10b981',
  '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed',
];

const MAX_COMPARE_RECORDS = 5;

const MAP_CONTAINER = { width: '100%', height: '500px' };
const MAP_CENTER = { lat: 35.7, lng: 139.7 };

// ============================================================
// GeoJSON parser (same as AllTrajectoriesViewer)
// ============================================================
const extractPaths = (geojsonStr: string) => {
  if (!geojsonStr) return [];
  try {
    const parsed = JSON.parse(geojsonStr.trim());
    const getCoords = (geom: any): any[][] => {
      if (geom.type === 'Polygon') return geom.coordinates;
      if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
      if (geom.type === 'Feature') return getCoords(geom.geometry);
      if (geom.type === 'FeatureCollection') return geom.features.flatMap((f: any) => getCoords(f));
      return [];
    };
    return getCoords(parsed).map((ring: any[]) =>
      ring.map(([lng, lat]: [number, number]) => ({ lat, lng }))
    );
  } catch {
    return [];
  }
};

// ============================================================
// Component
// ============================================================
export default function AreaGpsComparison() {
  const { t } = useTranslation('fraud-detection');
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  // State
  const [areaSearch, setAreaSearch] = useState('');
  const [areaResults, setAreaResults] = useState<AreaResult[]>([]);
  const [selectedArea, setSelectedArea] = useState<AreaResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [trajectories, setTrajectories] = useState<TrajectoryData[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [partialError, setPartialError] = useState(false);

  // Helpers
  const recordKey = (r: HistoryRecord) => `${r.manageCode}_${r.conditionDate}`;

  const formatArea = (area: AreaResult) =>
    `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`;

  // Area search
  const searchAreas = useCallback(async () => {
    if (!areaSearch.trim()) return;
    setLoadingAreas(true);
    try {
      const res = await fetch(`/api/areas?search=${encodeURIComponent(areaSearch)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setAreaResults(Array.isArray(data) ? data : data.areas || []);
      }
    } finally {
      setLoadingAreas(false);
    }
  }, [areaSearch]);

  // Select area → fetch history
  const selectArea = useCallback(async (area: AreaResult) => {
    setSelectedArea(area);
    setHistory([]);
    setSelectedKeys(new Set());
    setTrajectories([]);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/posting-system/area-history?streetNumber=${area.address_code}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Toggle record selection
  const toggleRecord = useCallback((record: HistoryRecord) => {
    const key = recordKey(record);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < MAX_COMPARE_RECORDS) {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Fetch GPS and display
  const compareGps = useCallback(async () => {
    const selected = history.filter(r => selectedKeys.has(recordKey(r)));
    if (selected.length === 0) return;

    setLoadingGps(true);
    setPartialError(false);

    const results: TrajectoryData[] = [];
    let hasError = false;

    await Promise.all(
      selected.map(async (record, idx) => {
        try {
          const res = await fetch(
            `/api/posting-system/staff-gps?staffId=${record.manageCode}&date=${record.conditionDate}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.gpsPoints && data.gpsPoints.length > 0) {
              results.push({
                key: recordKey(record),
                staffName: record.staffName,
                manageCode: record.manageCode,
                date: record.conditionDate,
                gpsPoints: data.gpsPoints,
                color: TRAJECTORY_COLORS[idx % TRAJECTORY_COLORS.length],
              });
            } else {
              hasError = true; // no GPS data
            }
          } else {
            hasError = true;
          }
        } catch {
          hasError = true;
        }
      })
    );

    setTrajectories(results);
    setPartialError(hasError && results.length > 0);
    setLoadingGps(false);
  }, [history, selectedKeys]);

  // Map bounds
  const mapCenter = useMemo(() => {
    if (trajectories.length > 0) {
      const allPts = trajectories.flatMap(t => t.gpsPoints);
      if (allPts.length > 0) {
        const avgLat = allPts.reduce((s, p) => s + p.lat, 0) / allPts.length;
        const avgLng = allPts.reduce((s, p) => s + p.lng, 0) / allPts.length;
        return { lat: avgLat, lng: avgLng };
      }
    }
    return MAP_CENTER;
  }, [trajectories]);

  // Area polygon paths
  const areaPaths = useMemo(() => {
    if (!selectedArea?.boundary_geojson) return [];
    return extractPaths(selectedArea.boundary_geojson);
  }, [selectedArea]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">
              {t('area_search_placeholder')}
            </label>
            <input
              type="text"
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchAreas()}
              placeholder={t('area_search_placeholder')}
              className="w-full border border-slate-300 rounded-lg text-sm px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={searchAreas}
            disabled={loadingAreas}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors"
          >
            {loadingAreas ? '...' : t('area_search_button')}
          </button>
        </div>

        {/* Area results dropdown */}
        {areaResults.length > 0 && !selectedArea && (
          <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
            {areaResults.map((area) => (
              <button
                key={area.id}
                onClick={() => { selectArea(area); setAreaResults([]); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                {formatArea(area)}
                <span className="text-[10px] text-slate-400 ml-2 font-mono">({area.address_code})</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected area */}
        {selectedArea && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">{t('area_selected')}:</span>
            <span className="text-xs font-black text-slate-800">{formatArea(selectedArea)}</span>
            <button
              onClick={() => { setSelectedArea(null); setHistory([]); setTrajectories([]); setSelectedKeys(new Set()); }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <i className="bi bi-x-circle text-xs"></i>
            </button>
          </div>
        )}
      </div>

      {/* Main content: history list + map */}
      {selectedArea && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: History list */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-black text-slate-700">{t('history_title')}</h3>
              {selectedKeys.size > 0 && (
                <span className="text-[10px] text-indigo-600 font-bold">
                  {t('compare_selected', { count: String(selectedKeys.size) })}
                </span>
              )}
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <i className="bi bi-inbox text-2xl mb-2 block"></i>
                {t('history_no_data')}
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                {history.map((record) => {
                  const key = recordKey(record);
                  const isSelected = selectedKeys.has(key);
                  const isDisabled = !isSelected && selectedKeys.size >= MAX_COMPARE_RECORDS;
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50' : isDisabled ? 'opacity-40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleRecord(record)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">{record.conditionDate}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {record.staffName}
                          <span className="font-mono ml-1">({record.manageCode})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">{record.totalPosted}/{record.totalSheets}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Compare button */}
            {selectedKeys.size > 0 && (
              <div className="px-3 py-2.5 border-t border-slate-100">
                <button
                  onClick={compareGps}
                  disabled={loadingGps}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {loadingGps ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('compare_loading')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-map"></i>
                      {t('compare_button')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right: Map */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {!isLoaded ? (
              <div className="flex items-center justify-center h-[500px]">
                <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : trajectories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-slate-400">
                <i className="bi bi-map text-4xl mb-3"></i>
                <p className="text-xs">{t('map_no_data')}</p>
              </div>
            ) : (
              <>
                {partialError && (
                  <div className="px-3 py-1.5 bg-amber-50 text-amber-700 text-[10px] font-bold border-b border-amber-200">
                    <i className="bi bi-exclamation-triangle mr-1"></i>
                    {t('compare_partial_error')}
                  </div>
                )}
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER}
                  center={mapCenter}
                  zoom={15}
                  options={{ mapTypeControl: false, streetViewControl: false }}
                >
                  {/* Area polygon */}
                  {areaPaths.map((path, i) => (
                    <Polygon
                      key={`area-${i}`}
                      paths={path}
                      options={{
                        fillColor: '#6366f1',
                        fillOpacity: 0.08,
                        strokeColor: '#6366f1',
                        strokeOpacity: 0.5,
                        strokeWeight: 2,
                      }}
                    />
                  ))}

                  {/* Trajectory polylines */}
                  {trajectories.map((traj) => (
                    <Polyline
                      key={traj.key}
                      path={traj.gpsPoints}
                      options={{
                        strokeColor: traj.color,
                        strokeOpacity: 0.8,
                        strokeWeight: 3,
                      }}
                    />
                  ))}
                </GoogleMap>

                {/* Legend */}
                <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap gap-3">
                  <span className="text-[10px] font-bold text-slate-500">{t('legend_title')}:</span>
                  {trajectories.map((traj) => (
                    <span key={traj.key} className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: traj.color }}
                      />
                      {traj.staffName} ({traj.date})
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 動作確認**

- エリア検索 → 履歴取得 → GPS比較表示の一連のフローが動作すること
- 最大5件の選択制限が機能すること
- 部分的なGPS取得失敗時に警告が表示されること

- [ ] **Step 3: Commit**

```bash
git add src/components/quality/AreaGpsComparison.tsx
git commit -m "feat: add area GPS comparison viewer component with Google Maps"
```

---

## Task 5: 不正検知ページにタブ追加

**Files:**
- Modify: `src/app/quality/fraud-detection/page.tsx`

- [ ] **Step 1: `fraud-detection/page.tsx` にタブUIを追加**

変更内容:
1. `import dynamic from 'next/dynamic'` と `AreaGpsComparison` の動的インポートを追加
2. `activeTab` state を追加
3. return JSX の `<div className="max-w-[1400px]...">` 直後にタブバーを挿入
4. 既存の KPI badges〜modal までの全JSXを `{activeTab === 'list' && ( <> ... </> )}` で囲む
5. `{activeTab === 'comparison' && <AreaGpsComparison />}` を追加

```typescript
// ファイル先頭に追加
import dynamic from 'next/dynamic';
const AreaGpsComparison = dynamic(() => import('@/components/quality/AreaGpsComparison'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// FraudDetectionPage 内に state 追加
const [activeTab, setActiveTab] = useState<'list' | 'comparison'>('list');

// return JSX 構造:
return (
  <div className="max-w-[1400px] mx-auto space-y-4">
    {/* Tab Bar */}
    <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
      <button
        onClick={() => setActiveTab('list')}
        className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${
          activeTab === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <i className="bi bi-shield-exclamation mr-1.5"></i>{t('tab_fraud_list')}
      </button>
      <button
        onClick={() => setActiveTab('comparison')}
        className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${
          activeTab === 'comparison' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <i className="bi bi-map mr-1.5"></i>{t('tab_area_comparison')}
      </button>
    </div>

    {/* Tab Content */}
    {activeTab === 'list' && (
      <>
        {/* 既存の KPI badges, filter bar, table, pagination, detail modal をすべてここに */}
      </>
    )}

    {activeTab === 'comparison' && <AreaGpsComparison />}
  </div>
);
```

- [ ] **Step 2: 動作確認**

- タブ切替が正常に動作すること
- 不正検知一覧タブの既存機能がそのまま動作すること
- エリアGPS比較タブでコンポーネントが表示されること

- [ ] **Step 3: Commit**

```bash
git add src/app/quality/fraud-detection/page.tsx
git commit -m "feat: add area GPS comparison tab to fraud detection page"
```

---

## Task 6: 全体統合テスト

- [ ] **Step 1: エンドツーエンド確認**
  1. `/quality/fraud-detection` を開く
  2. 「エリアGPS比較」タブに切り替え
  3. エリアを検索して選択
  4. 過去の配布履歴が一覧表示される
  5. 複数の履歴をチェック（最大5件制限の確認も）して「GPS比較表示」
  6. Google Maps上に色分けされた軌跡が表示される
  7. 凡例に配布員名＋日付が正しく表示される
  8. タブを「不正検知一覧」に戻して既存機能が壊れていないことを確認

- [ ] **Step 2: エッジケース確認**
  - ポスティングシステムに履歴がないエリア → 「履歴なし」メッセージ
  - GPSデータがない配布 → 部分エラー警告バナー
  - `POSTING_SYSTEM_API_URL` 未設定時 → エラーメッセージ
  - 6件以上選択しようとする → チェックボックスが disabled

- [ ] **Step 3: `npm run build` 通ることを確認**

- [ ] **Step 4: 最終コミット**

```bash
git add src/lib/posting-system.ts src/app/api/posting-system/area-history/route.ts src/app/api/posting-system/staff-gps/route.ts src/components/quality/AreaGpsComparison.tsx src/app/quality/fraud-detection/page.tsx src/i18n/locales/ja/fraud-detection.json src/i18n/locales/en/fraud-detection.json
git commit -m "feat: area GPS history comparison for fraud detection"
```

---

## 補足: 将来の拡張案

1. **現在の配布員との直接比較**: TrajectoryViewerモーダルに「過去の軌跡を重ねる」ボタンを追加
2. **カバー率の数値比較**: エリアポリゴンに対するGPS軌跡のカバー率（%）を計算して数値で比較
3. **自動異常検出**: 過去の平均的な軌跡パターンと現在の軌跡のずれを自動スコアリング
4. **ヒートマップ表示**: 過去の正常な配布のGPSを集約してヒートマップ化し、「通常配布されるエリア」を可視化
