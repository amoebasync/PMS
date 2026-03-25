'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useTranslation } from '@/i18n';

/* ──────────────────────────────────────────────────
   共通ユーティリティ
   ────────────────────────────────────────────────── */

const formatExcelDate = (val: any) => {
  if (!val) return null;
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  return String(val).trim().replace(/\//g, '-');
};

const formatExcelTime = (val: any): string | null => {
  if (!val && val !== 0) return null;
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  return null;
};

/** XLSX / TSV → 2D配列 */
const readFileToRows = async (file: File): Promise<any[][]> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
};

const textToRows = (text: string): any[][] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  return lines.map(line => line.split('\t'));
};

type DataType = 'schedule' | 'branch' | 'partner';
type InputMode = 'file' | 'paste';

/* ──────────────────────────────────────────────────
   メインコンポーネント
   ────────────────────────────────────────────────── */

export default function DataImportPage() {
  const ts = useTranslation('schedules').t;
  const tb = useTranslation('branches').t;

  const [dataType, setDataType] = useState<DataType>('schedule');
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importStatus, setImportStatus] = useState<'COMPLETED' | 'UNSTARTED'>('UNSTARTED');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // パートナー案件用
  const [partners, setPartners] = useState<{ id: number; name: string }[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [orderTitle, setOrderTitle] = useState('');
  const [partnersLoaded, setPartnersLoaded] = useState(false);

  // 単価マスタ用
  const [flyerPrices, setFlyerPrices] = useState<{ flyerName: string; customerCode: string | null; flyerCode: string | null; unitPrice: number }[]>([]);
  const [priceCount, setPriceCount] = useState<number>(0);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [pricePasteText, setPricePasteText] = useState('');
  const [priceMessage, setPriceMessage] = useState('');

  const loadPartners = async () => {
    if (partnersLoaded) return;
    try {
      const res = await fetch('/api/partners');
      if (res.ok) {
        const data = await res.json();
        setPartners(data);
        setPartnersLoaded(true);
      }
    } catch {}
  };

  const loadFlyerPrices = async (partnerId: number) => {
    try {
      const res = await fetch(`/api/partners/${partnerId}/flyer-prices`);
      if (res.ok) {
        const data = await res.json();
        setFlyerPrices(data);
        setPriceCount(data.length);
      }
    } catch {}
  };

  const lookupPrice = (flyerName: string, customerCode: string | null, flyerCode: string | null): number | null => {
    if (flyerPrices.length === 0 || !flyerName) return null;
    const fn = flyerName.trim();
    const cc = customerCode ? customerCode.trim() : null;
    const fc = flyerCode ? flyerCode.trim() : null;
    let match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === fc);
    if (!match && cc) {
      match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === null);
    }
    if (!match) {
      match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === null && p.flyerCode === null);
    }
    return match ? match.unitPrice : null;
  };

  const importPriceData = async () => {
    if (!selectedPartnerId || !pricePasteText.trim()) return;
    const lines = pricePasteText.split(/\r?\n/).filter(l => l.trim());
    const items = lines.map(line => {
      const cols = line.split('\t');
      return {
        flyerName: (cols[0] || '').trim(),
        customerCode: (cols[1] || '').trim() || null,
        flyerCode: (cols[2] || '').trim() || null,
        unitPrice: parseFloat(cols[3]) || 0,
      };
    }).filter(item => item.flyerName && item.unitPrice > 0);

    if (items.length === 0) return;

    try {
      const res = await fetch(`/api/partners/${selectedPartnerId}/flyer-prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      if (res.ok) {
        const data = await res.json();
        setPriceMessage(`✨ ${ts('price_master_import_success', { count: data.count })}`);
        setPricePasteText('');
        setShowPriceInput(false);
        await loadFlyerPrices(selectedPartnerId);
      } else {
        setPriceMessage(`❌ ${ts('price_master_import_error')}`);
      }
    } catch {
      setPriceMessage(`❌ ${ts('price_master_import_error')}`);
    }
  };

  const t = dataType === 'branch' ? tb : ts;

  const resetState = () => {
    setParsedData([]);
    setMessage('');
    setPasteText('');
    setSelectedPartnerId(null);
    setOrderTitle('');
    setFlyerPrices([]);
    setPriceCount(0);
    setShowPriceInput(false);
    setPricePasteText('');
    setPriceMessage('');
  };

  /* ────── スケジュール パース ────── */
  const SCHEDULE_KNOWN_HEADERS = ['年月日', '店舗', 'ｽﾀｯﾌ管理番号', '仕事管理番号', '丁目番号', 'ｴﾘｱ単価', '市・区', 'Staff', '開始時間', '終了時間', '備考', 'チラシ1'];
  // ヘッダー無し時の固定カラムインデックス
  const SCHEDULE_FIXED: Record<string, number> = {
    '店舗': 2, '年月日': 5, '仕事管理番号': 6, 'ｽﾀｯﾌ管理番号': 8, 'Staff': 9,
    'ｴﾘｱ単価': 18, '市・区': 19, '丁目番号': 21, '備考': 25,
    'チラシ1': 26, 'チラシ2': 35, 'チラシ3': 44, 'チラシ4': 53, 'チラシ5': 62, 'チラシ6': 71,
    '開始時間': 80, '500枚時間': 81, '1000枚時間': 82, '1500枚時間': 83, '2000枚時間': 84, '2500枚時間': 85, '終了時間': 86,
  };

  const processScheduleRows = async (rows: any[][]) => {
    if (rows.length < 1) { setMessage(`エラー: ${ts('error_empty_file')}`); return; }

    // ヘッダー行の有無を自動判定
    const firstRow = rows[0].map((h: any) => String(h ?? '').trim());
    const matchCount = firstRow.filter(cell => SCHEDULE_KNOWN_HEADERS.includes(cell)).length;
    const hasHeader = matchCount >= 2;

    let colIndex: Record<string, number>;
    let dataRows: any[][];

    if (hasHeader) {
      colIndex = {};
      firstRow.forEach((h, i) => { colIndex[h] = i; });
      dataRows = rows.slice(1);
    } else {
      colIndex = { ...SCHEDULE_FIXED };
      dataRows = rows;
    }

    const idx = (n: string) => colIndex[n] ?? -1;
    const idxJobNum = idx('仕事管理番号'), idxDate = idx('年月日'), idxBranch = idx('店舗');
    const idxStaff = idx('ｽﾀｯﾌ管理番号'), idxAreaCode = idx('丁目番号');
    const idxAreaUnitPrice = idx('ｴﾘｱ単価'), idxSizeUnitPrice = idx('ｻｲｽﾞ単価');
    const idxCityName = idx('市・区'), idxStaffName = idx('Staff');
    const idxStartTime = idx('開始時間'), idxEndTime = idx('終了時間'), idxRemarks = idx('備考');

    const milestoneIndices: { count: number; idx: number }[] = [];
    for (let c = 500; c <= 2500; c += 500) {
      const i = idx(`${c}枚時間`);
      if (i !== -1) milestoneIndices.push({ count: c, idx: i });
    }

    const rawSchedules = dataRows.map((row, index) => {
      const excelRowNumber = index + (hasHeader ? 2 : 1);
      if (!row || row.length < 10) return null;

      const items = [];
      for (let i = 1; i <= 6; i++) {
        const fi = idx(`チラシ${i}`);
        if (fi !== -1 && row[fi]) {
          items.push({
            slotIndex: i, flyerName: String(row[fi]),
            customerCode: row[fi + 1] ? String(row[fi + 1]) : null,
            flyerCode: row[fi + 2] ? String(row[fi + 2]) : null,
            actualCount: row[fi + 8] ? parseInt(String(row[fi + 8]).replace(/,/g, '')) : null,
            plannedCount: row[fi + 7] ? parseInt(String(row[fi + 7]).replace(/,/g, '')) : null,
            method: row[fi + 6] ? String(row[fi + 6]) : null,
            startDateStr: formatExcelDate(row[fi + 3]),
            endDateStr: formatExcelDate(row[fi + 4]),
            spareDateStr: formatExcelDate(row[fi + 5]),
          });
        }
      }

      if (!row[idxDate] || !row[idxStaff]) return null;

      const milestones = milestoneIndices.map(({ count, idx: mi }) => ({ count, time: formatExcelTime(row[mi]) }));

      return {
        excelRowNumber, items, milestones,
        jobNumber: idxJobNum !== -1 && row[idxJobNum] ? String(row[idxJobNum]) : null,
        date: formatExcelDate(row[idxDate]),
        branchName: idxBranch !== -1 && row[idxBranch] ? String(row[idxBranch]) : null,
        distributorStaffId: idxStaff !== -1 && row[idxStaff] ? String(row[idxStaff]) : null,
        staffName: idxStaffName !== -1 && row[idxStaffName] ? String(row[idxStaffName]) : null,
        areaCode: idxAreaCode !== -1 && row[idxAreaCode] ? String(row[idxAreaCode]) : null,
        areaUnitPrice: idxAreaUnitPrice !== -1 && row[idxAreaUnitPrice] != null && row[idxAreaUnitPrice] !== '' ? parseFloat(String(row[idxAreaUnitPrice]).replace(/,/g, '')) : null,
        sizeUnitPrice: idxSizeUnitPrice !== -1 && row[idxSizeUnitPrice] != null && row[idxSizeUnitPrice] !== '' ? parseFloat(String(row[idxSizeUnitPrice]).replace(/,/g, '')) : null,
        cityName: idxCityName !== -1 && row[idxCityName] ? String(row[idxCityName]) : null,
        remarks: idxRemarks !== -1 && row[idxRemarks] ? String(row[idxRemarks]) : null,
        startTime: idxStartTime !== -1 ? formatExcelTime(row[idxStartTime]) : null,
        endTime: idxEndTime !== -1 ? formatExcelTime(row[idxEndTime]) : null,
      };
    }).filter(Boolean);

    if (rawSchedules.length === 0) { setMessage(`エラー: ${ts('error_no_data')}`); return; }

    // PMS対象プレフィックスでフィルタリング
    let filteredSchedules = rawSchedules;
    let skippedByPrefix = 0;
    try {
      const prefixRes = await fetch('/api/distributors/prefixes');
      if (prefixRes.ok) {
        const pmsPrefixes: string[] = await prefixRes.json();
        if (pmsPrefixes.length > 0) {
          const beforeCount = filteredSchedules.length;
          filteredSchedules = filteredSchedules.filter(s => {
            if (!s?.distributorStaffId) return false;
            const staffPrefix = s.distributorStaffId.replace(/[0-9]+$/, '');
            return pmsPrefixes.includes(staffPrefix);
          });
          skippedByPrefix = beforeCount - filteredSchedules.length;
        }
      }
    } catch { /* prefixフェッチ失敗時はフィルタリングしない */ }

    if (filteredSchedules.length === 0) {
      setMessage(`エラー: ${ts('error_no_data')}${skippedByPrefix > 0 ? ` (${skippedByPrefix}件はPMS対象外のスタッフのためスキップ)` : ''}`);
      return;
    }

    // Area lookup (batch by 500 to avoid CloudFront/WAF body size limit)
    const uniqueAreaCodes = Array.from(new Set(filteredSchedules.map(s => s?.areaCode).filter(Boolean)));
    let areaMap: Record<string, any> = {};
    const BATCH_SIZE = 500;
    try {
      for (let i = 0; i < uniqueAreaCodes.length; i += BATCH_SIZE) {
        const batch = uniqueAreaCodes.slice(i, i + BATCH_SIZE);
        const res = await fetch('/api/areas/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addressCodes: batch }) });
        if (res.ok) {
          const batchResult = await res.json();
          Object.assign(areaMap, batchResult);
        } else { setMessage(`エラー: ${ts('error_master_fetch')}`); return; }
      }
    } catch { setMessage(`エラー: ${ts('error_master_api')}`); return; }

    const missingAreas: string[] = [];
    const schedules = filteredSchedules.map(s => {
      if (!s) return null;
      const dbArea = s.areaCode ? areaMap[s.areaCode] : null;
      if (!dbArea) { missingAreas.push(`${s.excelRowNumber}${ts('row_suffix')} (${ts('area_code_label')}: ${s.areaCode})`); return null; }
      return { ...s, dbPrefectureName: dbArea.prefectureName || '', dbFullAreaName: `${dbArea.cityName || ''} ${dbArea.chomeName || dbArea.townName || ''}`.trim() };
    });

    if (missingAreas.length > 0) { setMessage(`エラー: ${ts('error_missing_areas')}\n\n${missingAreas.join('\n')}`); setParsedData([]); return; }
    setParsedData(schedules.filter(Boolean));
    setMessage(skippedByPrefix > 0 ? `${skippedByPrefix}件のPMS対象外スタッフをスキップしました` : '');
  };

  /* ────── 支店 パース ────── */
  // 既知のヘッダー名一覧（1行目にこのいずれかがあればヘッダー付きと判定）
  const BRANCH_HEADERS = ['支店', 'Branch', 'Postal Code', '住所', 'Address', 'Google Map Link', 'Manager', 'Sub Manager', 'Closed on', 'Open Date', 'Open Time', 'Close Time'];
  // ヘッダー無し時の固定カラム順（上記と同じ順番）
  const BRANCH_FIXED_ORDER = BRANCH_HEADERS;

  const processBranchRows = async (rows: any[][]) => {
    if (rows.length < 1) { setMessage(`エラー: ${tb('import_error_empty')}`); return; }

    // ヘッダー行の有無を自動判定: 1行目に既知ヘッダー名が2つ以上含まれていればヘッダー付き
    const firstRow = rows[0].map((h: any) => String(h ?? '').trim());
    const matchCount = firstRow.filter(cell => BRANCH_HEADERS.includes(cell)).length;
    const hasHeader = matchCount >= 2;

    let colIndex: Record<string, number>;
    let dataRows: any[][];

    if (hasHeader) {
      colIndex = {};
      firstRow.forEach((h, i) => { colIndex[h] = i; });
      dataRows = rows.slice(1);
    } else {
      // 固定カラム順でインデックスを割り当て
      colIndex = {};
      BRANCH_FIXED_ORDER.forEach((h, i) => { colIndex[h] = i; });
      dataRows = rows; // 全行がデータ
    }

    const ci = (n: string) => colIndex[n] ?? -1;

    const branches = dataRows.map((row, index) => {
      const nameJa = ci('支店') !== -1 && row[ci('支店')] ? String(row[ci('支店')]).trim() : null;
      if (!nameJa) return null;
      return {
        excelRowNumber: index + (hasHeader ? 2 : 1), nameJa,
        nameEn: ci('Branch') !== -1 && row[ci('Branch')] ? String(row[ci('Branch')]).trim() : nameJa,
        postalCode: ci('Postal Code') !== -1 && row[ci('Postal Code')] ? String(row[ci('Postal Code')]).trim() : null,
        address: ci('住所') !== -1 && row[ci('住所')] ? String(row[ci('住所')]).trim() : null,
        addressEn: ci('Address') !== -1 && row[ci('Address')] ? String(row[ci('Address')]).trim() : null,
        googleMapUrl: ci('Google Map Link') !== -1 && row[ci('Google Map Link')] ? String(row[ci('Google Map Link')]).trim() : null,
        managerName: ci('Manager') !== -1 && row[ci('Manager')] ? String(row[ci('Manager')]).trim() : null,
        subManagerName: ci('Sub Manager') !== -1 && row[ci('Sub Manager')] ? String(row[ci('Sub Manager')]).trim() : null,
        closedDays: ci('Closed on') !== -1 && row[ci('Closed on')] ? String(row[ci('Closed on')]).trim() : null,
        openDate: ci('Open Date') !== -1 ? formatExcelDate(row[ci('Open Date')]) : null,
        openTime: ci('Open Time') !== -1 ? formatExcelTime(row[ci('Open Time')]) : null,
        closeTime: ci('Close Time') !== -1 ? formatExcelTime(row[ci('Close Time')]) : null,
      };
    }).filter(Boolean);

    if (branches.length === 0) { setMessage(`エラー: ${tb('import_error_no_data')}`); return; }
    setParsedData(branches);
    setMessage('');
  };

  /* ────── 入力ハンドラ ────── */
  const processRows = dataType === 'branch' ? processBranchRows : processScheduleRows;
  const loadingMsg = dataType === 'branch' ? tb('import_loading') : ts('loading_file');
  const errorReadMsg = dataType === 'branch' ? tb('import_error_read') : ts('error_file_read');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(loadingMsg); setParsedData([]);
    try { await processRows(await readFileToRows(file)); }
    catch { setMessage(errorReadMsg); }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;
    e.preventDefault(); setPasteText(text);
    setMessage(loadingMsg); setParsedData([]);
    try { await processRows(textToRows(text)); }
    catch { setMessage(errorReadMsg); }
  };

  const handleParsePasteText = async () => {
    if (!pasteText.trim()) return;
    setMessage(loadingMsg); setParsedData([]);
    try { await processRows(textToRows(pasteText)); }
    catch { setMessage(errorReadMsg); }
  };

  const resetInput = (e: React.MouseEvent<HTMLInputElement>) => { (e.target as HTMLInputElement).value = ''; };

  /* ────── インポート実行（チャンク分割送信） ────── */
  const CHUNK_SIZE = 10;

  /** 送信用にデータをクリーンアップ（表示専用フィールドを除去） */
  const cleanForSend = (items: any[]) =>
    items.map(({ excelRowNumber, dbPrefectureName, dbFullAreaName, ...rest }) => rest);

  const executeImport = async () => {
    if (dataType === 'partner' && !selectedPartnerId) {
      setMessage(`❌ ${ts('partner_required')}`);
      return;
    }

    // 完了インポート時は確認ダイアログ
    if (importStatus === 'COMPLETED' && dataType !== 'branch') {
      const confirmed = window.confirm(
        '⚠️ 完了インポート\n\n全スケジュールのステータスが「完了」に変更されます。\n配布中のデータに影響する可能性があります。\n\n本当に完了状態でインポートしますか？'
      );
      if (!confirmed) return;
    }

    setIsImporting(true);

    // 支店インポートはチャンク不要（小件数）
    if (dataType === 'branch') {
      setMessage(tb('import_registering'));
      try {
        const res = await fetch('/api/branches/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsedData) });
        const data = await res.json();
        if (res.ok) {
          let msg = `✨ ${tb('import_success', { count: data.count })}`;
          if (data.updatedCount > 0) msg += ` ${tb('import_updated', { count: data.updatedCount })}`;
          setMessage(msg); setParsedData([]); setPasteText('');
        } else {
          setMessage(`❌ エラー: ${data.error}`);
        }
      } catch (e) {
        const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        setMessage(`❌ ${tb('import_error_comm')} [${detail}]`);
      }
      setIsImporting(false);
      return;
    }

    // ── 接続テスト（空データ送信でAPI到達を確認）──
    try {
      setMessage('⏳ API接続確認中...');
      const testBody = JSON.stringify({ schedules: [], importStatus });
      const testRes = await fetch('/api/schedules/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: testBody,
      });
      if (!testRes.ok) {
        let errorMsg: string;
        try {
          const errData = await testRes.json();
          errorMsg = errData.error || `HTTP ${testRes.status}`;
        } catch {
          errorMsg = `HTTP ${testRes.status} ${testRes.statusText}`;
        }
        setMessage(`❌ API接続エラー: ${errorMsg}`);
        setIsImporting(false);
        return;
      }
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      setMessage(`❌ API接続失敗: ${detail}`);
      setIsImporting(false);
      return;
    }

    // スケジュール / パートナー案件: チャンク分割送信
    let totalImported = 0;
    let totalUpdated = 0;
    let totalCleaned = 0;
    let totalNewDistributors = 0;
    let orderId: number | null = null;
    let orderNo = '';

    const cleanData = cleanForSend(parsedData);
    const totalChunks = Math.ceil(cleanData.length / CHUNK_SIZE);
    // マッチ/作成済みIDをチャンク間で蓄積（クリーンアップ時に削除対象から除外するため）
    let keepIds: number[] = [];
    let totalMatched = 0;

    for (let ci = 0; ci < totalChunks; ci++) {
      const chunk = cleanData.slice(ci * CHUNK_SIZE, (ci + 1) * CHUNK_SIZE);
      const progress = Math.min((ci + 1) * CHUNK_SIZE, cleanData.length);
      setMessage(`⏳ ${ts('importing')} ${progress} / ${cleanData.length} 件 (${ci + 1}/${totalChunks})`);

      const isLast = ci === totalChunks - 1;
      const requestBody = dataType === 'partner'
        ? { partnerId: selectedPartnerId, orderTitle: orderTitle || undefined, schedules: chunk, importStatus, ...(orderId ? { orderId } : {}), keepIds, isLastChunk: isLast }
        : { schedules: chunk, importStatus, keepIds, isLastChunk: isLast };

      const bodyStr = JSON.stringify(requestBody);

      try {
        const res = await fetch('/api/schedules/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        });

        if (!res.ok) {
          let errorMsg: string;
          try {
            const errData = await res.json();
            errorMsg = errData.error || `HTTP ${res.status}`;
          } catch {
            errorMsg = `HTTP ${res.status} ${res.statusText}`;
          }
          const partialMsg = totalImported > 0 ? ` (${totalImported}件は登録済み)` : '';
          setMessage(`❌ サーバーエラー (${res.status}): ${errorMsg}${partialMsg} [bodySize=${bodyStr.length}]`);
          setIsImporting(false);
          return;
        }

        const data = await res.json();
        totalImported += data.count || 0;
        totalUpdated += data.updatedCount || 0;
        totalCleaned += data.cleanedCount || 0;
        totalMatched += data.matchedCount || 0;
        totalNewDistributors += data.newDistributorCount || 0;
        // マッチ/作成済みIDを蓄積（次チャンクのkeepIdsとして送信）
        if (data.matchedIds) keepIds = [...keepIds, ...data.matchedIds];
        if (data.createdIds) keepIds = [...keepIds, ...data.createdIds];
        if (data.orderId) orderId = data.orderId;
        if (data.orderNo) orderNo = data.orderNo;
      } catch (e) {
        const partialMsg = totalImported > 0 ? ` (${totalImported}件は登録済み)` : '';
        const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        setMessage(`❌ ネットワークエラー: ${detail}${partialMsg} [bodySize=${bodyStr.length}, chunk=${ci + 1}/${totalChunks}]`);
        setIsImporting(false);
        return;
      }
    }

    // 全チャンク成功
    let msg = '';
    if (dataType === 'partner') {
      msg = `✨ ${ts('import_partner_success', { orderNo, count: totalImported + totalUpdated })}`;
    } else {
      msg = `✨ ${ts('import_success', { count: totalImported + totalUpdated })}`;
    }
    if (totalMatched > 0) msg += ` (${totalMatched}件は既存データを維持)`;
    if (totalUpdated > 0) msg += ` ${ts('import_updated', { count: totalUpdated })}`;
    if (totalCleaned > 0) msg += ` (旧データ${totalCleaned}件を削除)`;
    if (totalNewDistributors > 0) msg += ` ${ts('import_new_distributors', { count: totalNewDistributors })}`;
    setMessage(msg); setParsedData([]); setPasteText('');
    setIsImporting(false);
  };

  /* ────── UI ────── */
  const isSchedule = dataType === 'schedule';
  const isPartner = dataType === 'partner';
  const accentColor = isPartner ? 'purple' : isSchedule ? 'emerald' : 'blue';

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800">
          <i className="bi bi-file-earmark-arrow-up text-slate-600"></i> {ts('import_title')}
        </h1>
        <p className="text-slate-500 text-sm mt-1">{ts('import_description')}</p>
      </div>

      {/* ── データ種別タブ ── */}
      <div className="flex gap-2">
        <button
          onClick={() => { if (dataType !== 'schedule') { setDataType('schedule'); resetState(); } }}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            isSchedule ? 'bg-emerald-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <i className="bi bi-calendar-check mr-1.5"></i>
          スケジュール
        </button>
        <button
          onClick={() => { if (dataType !== 'branch') { setDataType('branch'); resetState(); } }}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            dataType === 'branch' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <i className="bi bi-shop mr-1.5"></i>
          支店
        </button>
        <button
          onClick={() => { if (dataType !== 'partner') { setDataType('partner'); resetState(); loadPartners(); } }}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            isPartner ? 'bg-purple-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <i className="bi bi-briefcase mr-1.5"></i>
          {ts('partner_project')}
        </button>
      </div>

      {/* ── パートナー案件設定 ── */}
      {isPartner && (
        <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{ts('select_partner')} <span className="text-red-500">*</span></label>
            <select
              value={selectedPartnerId || ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setSelectedPartnerId(id);
                if (id) {
                  if (!orderTitle) {
                    const partner = partners.find(p => p.id === id);
                    if (partner) {
                      const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' });
                      setOrderTitle(`${partner.name} ${today}`);
                    }
                  }
                  loadFlyerPrices(id);
                } else {
                  setFlyerPrices([]);
                  setPriceCount(0);
                }
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">{ts('select_partner')}...</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{ts('order_title')}</label>
            <input
              type="text"
              value={orderTitle}
              onChange={(e) => setOrderTitle(e.target.value)}
              placeholder={ts('order_title_placeholder')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* 単価マスタセクション */}
          {selectedPartnerId && (
            <div className="border-t border-purple-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">
                    <i className="bi bi-currency-yen mr-1"></i>
                    {ts('price_master')}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ts('price_master_count', { count: priceCount })}
                  </p>
                </div>
                <button
                  onClick={() => setShowPriceInput(!showPriceInput)}
                  className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors"
                >
                  <i className={`bi ${showPriceInput ? 'bi-chevron-up' : 'bi-plus-circle'} mr-1`}></i>
                  {ts('price_master_import')}
                </button>
              </div>

              {showPriceInput && (
                <div className="space-y-2">
                  <textarea
                    value={pricePasteText}
                    onChange={(e) => setPricePasteText(e.target.value)}
                    placeholder={ts('price_master_placeholder')}
                    className="w-full h-32 p-3 border border-purple-200 rounded-lg text-sm font-mono resize-y focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-slate-400"
                  />
                  <button
                    onClick={importPriceData}
                    disabled={!pricePasteText.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    <i className="bi bi-upload mr-1"></i>
                    {ts('price_master_import')}
                  </button>
                </div>
              )}

              {priceMessage && (
                <div className={`p-2 rounded-lg text-sm font-semibold ${
                  priceMessage.includes('❌') ? 'bg-rose-50 text-rose-700' : 'bg-purple-50 text-purple-700'
                }`}>
                  {priceMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 入力エリア ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setInputMode('file')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
              inputMode === 'file'
                ? isPartner ? 'text-purple-700 bg-purple-50 border-b-2 border-purple-600'
                  : isSchedule ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-600' : 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <i className="bi bi-file-earmark-arrow-up mr-1.5"></i>
            {ts('tab_file')}
          </button>
          <button
            onClick={() => setInputMode('paste')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
              inputMode === 'paste'
                ? isPartner ? 'text-purple-700 bg-purple-50 border-b-2 border-purple-600'
                  : isSchedule ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-600' : 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <i className="bi bi-clipboard mr-1.5"></i>
            {ts('tab_paste')}
          </button>
        </div>

        <div className="p-6">
          {inputMode === 'file' ? (
            <input
              type="file"
              onChange={handleFileUpload}
              onClick={resetInput}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
          ) : (
            <div>
              <p className="text-sm text-slate-500 mb-3">{ts('paste_description')}</p>
              <textarea
                ref={textareaRef}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onPaste={handlePaste}
                placeholder={ts('paste_placeholder')}
                className="w-full h-40 p-3 border border-slate-300 rounded-lg text-sm font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
              />
              {pasteText && (
                <button
                  onClick={handleParsePasteText}
                  className={`mt-3 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${isPartner ? 'bg-purple-600 hover:bg-purple-700' : isSchedule ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  <i className="bi bi-arrow-repeat mr-1.5"></i>
                  {ts('paste_parse_btn')}
                </button>
              )}
            </div>
          )}

          {message && (
            <div className={`mt-4 p-3 rounded-lg font-bold border whitespace-pre-wrap ${
              message.includes('エラー') || message.includes('❌')
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isPartner ? 'bg-purple-50 text-purple-700 border-purple-200'
                : isSchedule ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>

      {/* ── プレビュー ── */}
      {parsedData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* ヘッダー: 件数 + ステータス選択 + インポートボタン */}
          <div className="p-4 bg-slate-50 border-b space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-700">{dataType === 'branch' ? tb('preview_title') : ts('preview_title')}</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {dataType === 'branch' ? tb('preview_count') : ts('preview_count')}:{' '}
                  <span className={`font-bold ${isPartner ? 'text-purple-600' : isSchedule ? 'text-emerald-600' : 'text-blue-600'}`}>{parsedData.length} {dataType === 'branch' ? tb('preview_unit') : ts('preview_unit')}</span>
                </p>
              </div>
              <button onClick={executeImport} disabled={isImporting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow disabled:opacity-50 transition-all whitespace-nowrap">
                <i className={`bi ${isImporting ? 'bi-arrow-repeat animate-spin' : 'bi-database-add'} mr-1.5`}></i>
                {isImporting ? (dataType === 'branch' ? tb('btn_registering') : ts('btn_registering')) : (dataType === 'branch' ? tb('btn_register') : ts('btn_register'))}
              </button>
            </div>
            {dataType !== 'branch' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 mr-1">{ts('import_status_label')}:</span>
                  <label
                    className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      importStatus === 'UNSTARTED'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <input type="radio" name="importStatus" checked={importStatus === 'UNSTARTED'} onChange={() => setImportStatus('UNSTARTED')} className="sr-only" />
                    <i className="bi bi-clock"></i> {ts('import_status_unstarted')}
                  </label>
                  <label
                    className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      importStatus === 'COMPLETED'
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <input type="radio" name="importStatus" checked={importStatus === 'COMPLETED'} onChange={() => setImportStatus('COMPLETED')} className="sr-only" />
                    <i className="bi bi-exclamation-triangle-fill"></i> {ts('import_status_completed')}
                  </label>
                </div>
                {importStatus === 'COMPLETED' && (
                  <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <i className="bi bi-exclamation-triangle-fill text-red-500 mt-0.5"></i>
                    <p className="text-xs text-red-700 font-semibold leading-relaxed">
                      完了インポート: 全スケジュールのステータスが「完了」に変更されます。配布中のデータに影響する可能性があります。通常は「未完了」でインポートしてください。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {dataType !== 'branch' ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-500 sticky top-0 shadow-sm text-xs">
                  <tr>
                    <th className="px-3 py-2.5 whitespace-nowrap">{ts('col_date')}</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">{ts('col_branch')}</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">{ts('col_distributor_id')}</th>
                    <th className="px-3 py-2.5">{ts('col_area_info')}</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">{ts('col_area_unit_price')}</th>
                    <th className="px-3 py-2.5">{ts('th_flyer')}</th>
                    {isPartner && <th className="px-3 py-2.5 text-right whitespace-nowrap">{ts('col_billing_unit_price')}</th>}
                    <th className="px-3 py-2.5 whitespace-nowrap">{ts('col_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.map((s, idx) => {
                    const activeItems = (s.items || []).filter((i: any) => i.flyerName);
                    return (
                      <tr key={idx} className="hover:bg-slate-50 align-top">
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{s.date}</td>
                        <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{s.branchName}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{s.distributorStaffId}</td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="truncate" title={`${s.dbPrefectureName || ''} ${s.dbFullAreaName || ''}`}>
                            {s.dbPrefectureName ? <span className="text-slate-400">{s.dbPrefectureName} </span> : ''}{s.dbFullAreaName}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{s.areaUnitPrice != null ? `¥${s.areaUnitPrice.toLocaleString()}` : <span className="text-slate-300">-</span>}</td>
                        <td className="px-3 py-2.5">
                          {activeItems.length > 0 ? (
                            <div className="space-y-1">
                              {activeItems.map((item: any, ii: number) => (
                                <div key={ii} className="flex items-baseline gap-2 text-xs">
                                  <span className="font-semibold text-slate-700 truncate max-w-[160px]" title={item.flyerName}>{item.flyerName}</span>
                                  {(item.plannedCount != null || item.actualCount != null) && (
                                    <span className="text-slate-400 whitespace-nowrap tabular-nums">
                                      {item.plannedCount != null ? `${ts('th_planned')}${item.plannedCount.toLocaleString()}` : ''}
                                      {item.actualCount != null ? ` / ${ts('th_actual')}${item.actualCount.toLocaleString()}` : ''}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : <span className="text-slate-300 text-xs">-</span>}
                        </td>
                        {isPartner && (
                          <td className="px-3 py-2.5 text-right">
                            {activeItems.map((item: any, ii: number) => {
                              const price = lookupPrice(item.flyerName, item.customerCode, item.flyerCode);
                              return (
                                <div key={ii} className="text-xs whitespace-nowrap">
                                  {price != null
                                    ? <span className="text-emerald-600 font-semibold tabular-nums">¥{price.toLocaleString()}</span>
                                    : <span className="text-orange-400">{ts('price_not_found')}</span>}
                                </div>
                              );
                            })}
                          </td>
                        )}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {importStatus === 'COMPLETED'
                            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"><i className="bi bi-check-circle-fill"></i> {ts('status_completed')}</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><i className="bi bi-clock"></i> {ts('status_unstarted')}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-500 sticky top-0 shadow-sm text-xs">
                  <tr>
                    <th className="px-3 py-2.5">{tb('col_name_ja')}</th>
                    <th className="px-3 py-2.5">{tb('col_name_en')}</th>
                    <th className="px-3 py-2.5">{tb('col_postal_code')}</th>
                    <th className="px-3 py-2.5">{tb('col_address')}</th>
                    <th className="px-3 py-2.5">{tb('col_manager')}</th>
                    <th className="px-3 py-2.5">{tb('col_sub_manager')}</th>
                    <th className="px-3 py-2.5">{tb('col_closed_on')}</th>
                    <th className="px-3 py-2.5">{tb('col_open_time')}</th>
                    <th className="px-3 py-2.5">{tb('col_close_time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold">{b.nameJa}</td>
                      <td className="px-3 py-2.5">{b.nameEn || '-'}</td>
                      <td className="px-3 py-2.5">{b.postalCode || '-'}</td>
                      <td className="px-3 py-2.5 max-w-[200px] truncate" title={b.address || ''}>{b.address || '-'}</td>
                      <td className="px-3 py-2.5">{b.managerName || '-'}</td>
                      <td className="px-3 py-2.5">{b.subManagerName || '-'}</td>
                      <td className="px-3 py-2.5">{b.closedDays || '-'}</td>
                      <td className="px-3 py-2.5">{b.openTime || '-'}</td>
                      <td className="px-3 py-2.5">{b.closeTime || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
