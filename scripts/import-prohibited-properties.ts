/**
 * 配布禁止物件CSVインポートスクリプト
 *
 * Usage:
 *   npx tsx scripts/import-prohibited-properties.ts [--dry-run] [--limit N]
 *
 * Options:
 *   --dry-run   実際にDBに書き込まず、変換結果を確認する
 *   --limit N   先頭N件のみ処理する（テスト用）
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// @ts-ignore
import polyline from '@mapbox/polyline';

const prisma = new PrismaClient();

// ===== 設定 =====
const CSV_PATH = path.join(__dirname, 'm_prohibit_building_202602191417.csv');
const BATCH_SIZE = 500; // 一括挿入のバッチサイズ

// ===== 正規化ユーティリティ =====

/** 全角数字 → 半角数字 */
function fullWidthToHalfWidthNumbers(s: string): string {
  return s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

/** 全角ハイフン類 → 半角ハイフン（カタカナ長音「ー」U+30FC は除外） */
function normalizeHyphens(s: string): string {
  // U+2212(−) U+2015(―) U+2010(‐) U+2013(–) U+2014(—) U+FF0D(－) のみ変換
  // U+30FC(ー) カタカナ長音記号は変換しない
  return s.replace(/[−―‐–—－]/g, '-');
}

/** 住所内の漢数字 → 半角数字（丁目・番・号の直前のみ変換。地名内の漢数字は保持） */
function kanjiToArabicInAddress(s: string): string {
  const kanjiMap: Record<string, number> = {
    '一': 1, '壱': 1,
    '二': 2, '弐': 2,
    '三': 3, '参': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
  };
  const kanjiChars = Object.keys(kanjiMap).join('');

  // パターン: 漢数字+十+漢数字 or 漢数字+十 or 十+漢数字 or 単独漢数字 → 丁目|番|号
  // 「三丁目」→「3丁目」、「二十三番」→「23番」、「五番町」はそのまま
  const kanjiNumPattern = new RegExp(
    `([${kanjiChars}]?十?[${kanjiChars}]?|十[${kanjiChars}]?|[${kanjiChars}]十?)(?=丁目|番地|番(?!町|街)|号(?!棟|館|室))`,
    'g'
  );

  return s.replace(kanjiNumPattern, (match) => {
    let num = 0;
    const chars = [...match];
    let i = 0;

    if (chars.length === 0) return match;

    // 「X十Y」パターンを解析
    let hasTen = false;
    let beforeTen = 0;
    let afterTen = 0;

    for (const ch of chars) {
      if (ch === '十') {
        hasTen = true;
      } else if (!hasTen) {
        beforeTen = kanjiMap[ch] ?? 0;
      } else {
        afterTen = kanjiMap[ch] ?? 0;
      }
    }

    if (hasTen) {
      num = (beforeTen || 1) * 10 + afterTen;
    } else {
      num = beforeTen;
    }

    return num > 0 ? String(num) : match;
  });
}

/** 住所の「丁目・番・号」形式をハイフンに正規化 */
function normalizeChoubanGou(s: string): string {
  // パターン: X丁目Y番Z号 → X-Y-Z
  let result = s;
  // 「X丁目」 → 「X-」
  result = result.replace(/(\d+)\s*丁目\s*/g, '$1-');
  // 「X番地」 → 「X-」（「番」+「地」）
  result = result.replace(/(\d+)\s*番地\s*/g, '$1-');
  // 「X番」 → 「X-」（ただし「X番館」「X番街」等は除く）
  result = result.replace(/(\d+)\s*番(?!館|街|棟|号棟)/g, '$1-');
  // 「X号」 → 「X」 (末尾の号は除去、ただし「X号棟」「X号館」「X号室」は除く)
  result = result.replace(/(\d+)\s*号(?!棟|館|室)/g, '$1');
  // 末尾の余分なハイフンを除去
  result = result.replace(/-$/, '');
  return result;
}

/** 住所を正規化する（メイン） */
function normalizeAddress(raw: string): string {
  let s = raw.trim();
  // 1. 全角数字 → 半角
  s = fullWidthToHalfWidthNumbers(s);
  // 2. 全角ハイフン → 半角
  s = normalizeHyphens(s);
  // 3. 住所内の漢数字 → 算用数字（丁目・番・号の前のみ）
  s = kanjiToArabicInAddress(s);
  // 4. 丁目番号 → ハイフン形式
  s = normalizeChoubanGou(s);
  // 5. 連続ハイフンの除去
  s = s.replace(/-{2,}/g, '-');
  return s;
}

/** 全般的な文字列正規化（数字は半角、クリーンアップ。長音はそのまま） */
function normalizeText(raw: string): string {
  let s = raw.trim();
  s = fullWidthToHalfWidthNumbers(s);
  // ダブルクォートの除去
  s = s.replace(/^"+|"+$/g, '');
  return s;
}

// ===== COMMENT → buildingName / roomNumber / residentName 分離 =====

interface CommentParts {
  buildingName: string | null;
  roomNumber: string | null;
  residentName: string | null;
  extraNote: string | null; // ※以降の注記
}

function parseComment(raw: string): CommentParts {
  let s = raw.trim();
  if (!s) return { buildingName: null, roomNumber: null, residentName: null, extraNote: null };

  // ダブルクォート除去
  s = s.replace(/^"+|"+$/g, '');
  // 全角数字 → 半角
  s = fullWidthToHalfWidthNumbers(s);

  let extraNote: string | null = null;
  let residentName: string | null = null;
  let roomNumber: string | null = null;
  let buildingName: string | null = null;

  // ※以降を注記として抽出
  const noteMatch = s.match(/※(.+)$/);
  if (noteMatch) {
    extraNote = noteMatch[1].trim();
    s = s.substring(0, s.indexOf('※')).trim();
  }

  // スペース区切り（全角/半角）で分割して分析
  const parts = s.split(/[\s　]+/).filter(Boolean);

  if (parts.length === 1) {
    // 単一パーツ: 末尾の「XXX号室」「XXX号」パターンをroomNumberとして分離
    // ただし「X号棟」「X号館」「X番館」は建物名の一部
    const roomMatch = s.match(/^(.+?)(\d+号室?)$/);
    if (roomMatch && !roomMatch[2].match(/号棟|号館/)) {
      buildingName = roomMatch[1];
      roomNumber = roomMatch[2].replace(/号室?$/, '');
    } else {
      buildingName = s;
    }
  } else if (parts.length >= 2) {
    // 複数パーツ: 「BuildingName 101号 名前」のパターンを解析
    const buildingParts: string[] = [];
    const nameParts: string[] = [];
    let roomFound = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      // 号室/号パターン（号棟・号館は除く）
      const roomPartMatch = part.match(/^(\d+)(号室?)?$/);
      if (roomPartMatch && !part.match(/号棟|号館/) && !roomFound) {
        roomNumber = roomPartMatch[1];
        roomFound = true;
        // 以降は名前とみなす
        for (let j = i + 1; j < parts.length; j++) {
          nameParts.push(parts[j]);
        }
        break;
      } else {
        buildingParts.push(part);
      }
    }

    buildingName = buildingParts.join(' ') || null;

    // 名前部分の判定（カタカナ or 漢字1-4文字程度 = 個人名の可能性が高い）
    if (nameParts.length > 0) {
      const nameStr = nameParts.join(' ');
      residentName = nameStr;
    }
  }

  return { buildingName, roomNumber, residentName, extraNote };
}

// ===== Polyline → GeoJSON =====
function polylineToGeoJSON(encoded: string): string | null {
  if (!encoded || encoded.trim() === '') return null;
  try {
    const decoded = polyline.decode(encoded);
    if (!decoded || decoded.length < 3) return null;

    // polyline.decode returns [lat, lng] pairs
    const coords = decoded.map((point: number[]) => [point[1], point[0]]); // [lng, lat]
    // Close the ring
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([...first]);
    }

    return JSON.stringify({
      type: 'Polygon',
      coordinates: [coords],
    });
  } catch (e) {
    console.warn(`Polyline decode error: ${encoded.substring(0, 30)}...`, e);
    return null;
  }
}

// ===== CSV パース =====
interface CsvRow {
  COMPANY_CD: string;
  CLIENT_CD: string;
  LOCATE_PREF_CD: string;
  LOCATE_CITY_CD: string;
  TYPE_DIV: string;
  DETAIL_NO: string;
  FLYER_CD: string;
  CENTER_LO: string;
  CENTER_LA: string;
  POINT_ENCODE: string;
  ADDRESS: string;
  COMMENT: string;
  REMARK: string;
  COLOR: string;
  BACKGROUND: string;
  PLACED_CODE: string;
  PLACED_SUB_CODE: string;
  DISPLAY_NO: string;
  REG_DATE: string;
  UPD_DATE: string;
  REG_USER_ID: string;
  UPD_USER_ID: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');
  const headers = parseCsvLine(lines[0]);

  console.log(`📄 CSV headers: ${headers.join(', ')}`);
  console.log(`📊 Total data rows: ${lines.length - 1}`);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 11) continue; // skip malformed rows

    rows.push({
      COMPANY_CD: fields[0]?.replace(/"/g, '').trim() || '',
      CLIENT_CD: fields[1]?.replace(/"/g, '').trim() || '',
      LOCATE_PREF_CD: fields[2]?.replace(/"/g, '').trim() || '',
      LOCATE_CITY_CD: fields[3]?.replace(/"/g, '').trim() || '',
      TYPE_DIV: fields[4]?.replace(/"/g, '').trim() || '',
      DETAIL_NO: fields[5]?.replace(/"/g, '').trim() || '',
      FLYER_CD: fields[6]?.replace(/"/g, '').trim() || '',
      CENTER_LO: fields[7]?.replace(/"/g, '').trim() || '',
      CENTER_LA: fields[8]?.replace(/"/g, '').trim() || '',
      POINT_ENCODE: fields[9]?.replace(/"/g, '').trim() || '',
      ADDRESS: fields[10]?.replace(/"/g, '').trim() || '',
      COMMENT: fields[11]?.replace(/"/g, '').trim() || '',
      REMARK: fields[12]?.replace(/"/g, '').trim() || '',
      COLOR: fields[13]?.replace(/"/g, '').trim() || '',
      BACKGROUND: fields[14]?.replace(/"/g, '').trim() || '',
      PLACED_CODE: fields[15]?.replace(/"/g, '').trim() || '',
      PLACED_SUB_CODE: fields[16]?.replace(/"/g, '').trim() || '',
      DISPLAY_NO: fields[17]?.replace(/"/g, '').trim() || '',
      REG_DATE: fields[18]?.replace(/"/g, '').trim() || '',
      UPD_DATE: fields[19]?.replace(/"/g, '').trim() || '',
      REG_USER_ID: fields[20]?.replace(/"/g, '').trim() || '',
      UPD_USER_ID: fields[21]?.replace(/"/g, '').trim() || '',
    });
  }

  return rows;
}

// ===== メイン処理 =====
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limitCount = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 0;

  console.log('====================================');
  console.log('配布禁止物件 CSV インポート');
  console.log(`  dry-run: ${dryRun}`);
  console.log(`  limit: ${limitCount || 'ALL'}`);
  console.log('====================================\n');

  // 1. CSV パース
  let rows = parseCsv(CSV_PATH);
  if (limitCount > 0) {
    rows = rows.slice(0, limitCount);
    console.log(`⚠️ Limit applied: processing first ${limitCount} rows\n`);
  }

  // 2. City コードマップ構築
  console.log('🔧 Building city code map...');
  const cities = await prisma.city.findMany({ select: { id: true, code: true } });
  const cityCodeMap = new Map<string, number>();
  for (const c of cities) {
    cityCodeMap.set(c.code, c.id);
  }
  console.log(`   ${cityCodeMap.size} cities loaded\n`);

  // 3. Customer コードマップ構築
  console.log('🔧 Building customer code map...');
  const customers = await prisma.customer.findMany({ select: { id: true, customerCode: true } });
  const customerCodeMap = new Map<string, number>();
  for (const c of customers) {
    if (c.customerCode) {
      customerCodeMap.set(c.customerCode, c.id);
    }
  }
  console.log(`   ${customerCodeMap.size} customers loaded\n`);

  // 4. 変換処理
  console.log('🔄 Converting rows...');
  const records: any[] = [];
  let skipped = 0;
  let polylineConverted = 0;
  let customerResolved = 0;
  let customerNotFound = 0;
  const unmatchedCustomerCodes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // ADDRESS が空の行はスキップ
    if (!row.ADDRESS) {
      skipped++;
      continue;
    }

    // 住所正規化
    const address = normalizeAddress(row.ADDRESS);

    // COMMENT 分離
    const commentParts = parseComment(row.COMMENT);

    // 都道府県ID（JISコード = DB ID）
    const prefectureId = row.LOCATE_PREF_CD ? parseInt(row.LOCATE_PREF_CD) : null;

    // 市区町村ID（プレフィックス + 市区町村コードでcityコードを作成）
    let cityId: number | null = null;
    if (row.LOCATE_PREF_CD && row.LOCATE_CITY_CD) {
      const cityCode = row.LOCATE_PREF_CD + row.LOCATE_CITY_CD;
      cityId = cityCodeMap.get(cityCode) ?? null;
    }

    // 顧客ID
    let customerId: number | null = null;
    const clientCd = row.CLIENT_CD;
    if (clientCd && clientCd !== '00000000') {
      const resolved = customerCodeMap.get(clientCd);
      if (resolved) {
        customerId = resolved;
        customerResolved++;
      } else {
        unmatchedCustomerCodes.add(clientCd);
        customerNotFound++;
        // 顧客が見つからなくてもインポートは続行（customerId=null）
      }
    }

    // 座標
    const latitude = row.CENTER_LA ? parseFloat(row.CENTER_LA) : null;
    const longitude = row.CENTER_LO ? parseFloat(row.CENTER_LO) : null;

    // ポリライン → GeoJSON
    let boundaryGeojson: string | null = null;
    if (row.POINT_ENCODE && row.POINT_ENCODE.length > 5) {
      boundaryGeojson = polylineToGeoJSON(row.POINT_ENCODE);
      if (boundaryGeojson) polylineConverted++;
    }

    // REMARK
    const remarkParts: string[] = [];
    if (row.REMARK) remarkParts.push(normalizeText(row.REMARK));
    if (commentParts.extraNote) remarkParts.push(commentParts.extraNote);
    const reasonDetail = remarkParts.length > 0 ? remarkParts.join(' / ') : null;

    // 登録日
    let importedAt: Date | null = null;
    if (row.REG_DATE) {
      try {
        importedAt = new Date(row.REG_DATE);
        if (isNaN(importedAt.getTime())) importedAt = null;
      } catch {
        importedAt = null;
      }
    }

    // originalCode
    const originalCode = row.PLACED_CODE || null;

    // externalCustomerCode
    const externalCustomerCode = (clientCd && clientCd !== '00000000') ? clientCd : null;

    records.push({
      prefectureId: prefectureId && prefectureId >= 1 && prefectureId <= 47 ? prefectureId : null,
      cityId,
      address,
      buildingName: commentParts.buildingName || null,
      roomNumber: commentParts.roomNumber || null,
      residentName: commentParts.residentName || null,
      latitude: latitude && !isNaN(latitude) ? latitude : null,
      longitude: longitude && !isNaN(longitude) ? longitude : null,
      boundaryGeojson,
      customerId,
      reasonDetail,
      originalCode,
      externalCustomerCode,
      importedAt,
      isActive: true,
    });

    if ((i + 1) % 5000 === 0) {
      console.log(`   processed ${i + 1}/${rows.length}...`);
    }
  }

  console.log(`\n✅ Conversion complete:`);
  console.log(`   Total rows: ${rows.length}`);
  console.log(`   Records to insert: ${records.length}`);
  console.log(`   Skipped (empty address): ${skipped}`);
  console.log(`   Polylines converted: ${polylineConverted}`);
  console.log(`   Customers resolved: ${customerResolved}`);
  console.log(`   Customers not found: ${customerNotFound}`);
  if (unmatchedCustomerCodes.size > 0) {
    console.log(`   Unmatched customer codes: ${[...unmatchedCustomerCodes].slice(0, 10).join(', ')}${unmatchedCustomerCodes.size > 10 ? '...' : ''}`);
  }

  // dry-run: サンプル表示
  if (dryRun) {
    console.log('\n📋 Sample records (first 5):');
    for (const rec of records.slice(0, 5)) {
      console.log(JSON.stringify(rec, null, 2));
    }

    // 住所変換サンプル
    console.log('\n📋 Address normalization samples:');
    const sampleAddresses = rows.slice(0, 20).map(r => ({
      before: r.ADDRESS,
      after: normalizeAddress(r.ADDRESS),
    }));
    for (const s of sampleAddresses) {
      if (s.before !== s.after) {
        console.log(`   "${s.before}" → "${s.after}"`);
      }
    }

    // COMMENT分離サンプル
    console.log('\n📋 Comment parse samples:');
    const commentSamples = rows.slice(0, 30)
      .filter(r => r.COMMENT)
      .map(r => ({
        raw: r.COMMENT,
        ...parseComment(r.COMMENT),
      }));
    for (const s of commentSamples.slice(0, 10)) {
      console.log(`   "${s.raw}" → bldg="${s.buildingName}" room="${s.roomNumber}" name="${s.residentName}" note="${s.extraNote}"`);
    }

    console.log('\n🏁 Dry-run complete. No data was written to the database.');
    return;
  }

  // 5. DB挿入（バッチ）
  console.log(`\n💾 Inserting ${records.length} records in batches of ${BATCH_SIZE}...`);
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      await prisma.prohibitedProperty.createMany({
        data: batch,
        skipDuplicates: true,
      });
      inserted += batch.length;
      console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} (total: ${inserted}/${records.length})`);
    } catch (error) {
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
      // 個別挿入にフォールバック
      for (const record of batch) {
        try {
          await prisma.prohibitedProperty.create({ data: record });
          inserted++;
        } catch (innerError) {
          console.error(`   ❌ Single insert failed for: ${record.address}`, innerError);
        }
      }
    }
  }

  console.log(`\n🏁 Import complete!`);
  console.log(`   Total inserted: ${inserted}`);
  console.log(`   Total in DB: ${await prisma.prohibitedProperty.count()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
