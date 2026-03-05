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

type DataType = 'schedule' | 'branch';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const t = dataType === 'schedule' ? ts : tb;

  const resetState = () => {
    setParsedData([]);
    setMessage('');
    setPasteText('');
  };

  /* ────── スケジュール パース ────── */
  const processScheduleRows = async (rows: any[][]) => {
    if (rows.length < 2) { setMessage(`エラー: ${ts('error_empty_file')}`); return; }

    const headers = rows[0].map((h: any) => String(h ?? '').trim());
    const dataRows = rows.slice(1);

    const idx = (n: string) => headers.indexOf(n);
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
      const excelRowNumber = index + 2;
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

    // Area lookup
    const uniqueAreaCodes = Array.from(new Set(rawSchedules.map(s => s?.areaCode).filter(Boolean)));
    let areaMap: Record<string, any> = {};
    try {
      const res = await fetch('/api/areas/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addressCodes: uniqueAreaCodes }) });
      if (res.ok) areaMap = await res.json();
      else { setMessage(`エラー: ${ts('error_master_fetch')}`); return; }
    } catch { setMessage(`エラー: ${ts('error_master_api')}`); return; }

    const missingAreas: string[] = [];
    const schedules = rawSchedules.map(s => {
      if (!s) return null;
      const dbArea = s.areaCode ? areaMap[s.areaCode] : null;
      if (!dbArea) { missingAreas.push(`${s.excelRowNumber}${ts('row_suffix')} (${ts('area_code_label')}: ${s.areaCode})`); return null; }
      return { ...s, dbPrefectureName: dbArea.prefectureName || '', dbFullAreaName: `${dbArea.cityName || ''} ${dbArea.chomeName || dbArea.townName || ''}`.trim() };
    });

    if (missingAreas.length > 0) { setMessage(`エラー: ${ts('error_missing_areas')}\n\n${missingAreas.join('\n')}`); setParsedData([]); return; }
    setParsedData(schedules.filter(Boolean));
    setMessage('');
  };

  /* ────── 支店 パース ────── */
  const processBranchRows = async (rows: any[][]) => {
    if (rows.length < 2) { setMessage(`エラー: ${tb('import_error_empty')}`); return; }

    const headers = rows[0].map((h: any) => String(h ?? '').trim());
    const dataRows = rows.slice(1);
    const idx = (n: string) => headers.indexOf(n);

    const branches = dataRows.map((row, index) => {
      const nameJa = idx('支店') !== -1 && row[idx('支店')] ? String(row[idx('支店')]).trim() : null;
      if (!nameJa) return null;
      return {
        excelRowNumber: index + 2, nameJa,
        nameEn: idx('Branch') !== -1 && row[idx('Branch')] ? String(row[idx('Branch')]).trim() : nameJa,
        postalCode: idx('Postal Code') !== -1 && row[idx('Postal Code')] ? String(row[idx('Postal Code')]).trim() : null,
        address: idx('住所') !== -1 && row[idx('住所')] ? String(row[idx('住所')]).trim() : null,
        addressEn: idx('Address') !== -1 && row[idx('Address')] ? String(row[idx('Address')]).trim() : null,
        googleMapUrl: idx('Google Map Link') !== -1 && row[idx('Google Map Link')] ? String(row[idx('Google Map Link')]).trim() : null,
        managerName: idx('Manager') !== -1 && row[idx('Manager')] ? String(row[idx('Manager')]).trim() : null,
        subManagerName: idx('Sub Manager') !== -1 && row[idx('Sub Manager')] ? String(row[idx('Sub Manager')]).trim() : null,
        closedDays: idx('Closed on') !== -1 && row[idx('Closed on')] ? String(row[idx('Closed on')]).trim() : null,
        openDate: idx('Open Date') !== -1 ? formatExcelDate(row[idx('Open Date')]) : null,
        openTime: idx('Open Time') !== -1 ? formatExcelTime(row[idx('Open Time')]) : null,
        closeTime: idx('Close Time') !== -1 ? formatExcelTime(row[idx('Close Time')]) : null,
      };
    }).filter(Boolean);

    if (branches.length === 0) { setMessage(`エラー: ${tb('import_error_no_data')}`); return; }
    setParsedData(branches);
    setMessage('');
  };

  /* ────── 入力ハンドラ ────── */
  const processRows = dataType === 'schedule' ? processScheduleRows : processBranchRows;
  const loadingMsg = dataType === 'schedule' ? ts('loading_file') : tb('import_loading');
  const errorReadMsg = dataType === 'schedule' ? ts('error_file_read') : tb('import_error_read');

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

  /* ────── インポート実行 ────── */
  const executeImport = async () => {
    setIsImporting(true);
    setMessage(dataType === 'schedule' ? ts('importing') : tb('import_registering'));
    const apiUrl = dataType === 'schedule' ? '/api/schedules/import' : '/api/branches/import';

    try {
      const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsedData) });
      const data = await res.json();
      if (res.ok) {
        let msg = '';
        if (dataType === 'schedule') {
          msg = `✨ ${ts('import_success', { count: data.count })}`;
          if (data.newDistributorCount > 0) msg += ` ${ts('import_new_distributors', { count: data.newDistributorCount })}`;
        } else {
          msg = `✨ ${tb('import_success', { count: data.count })}`;
          if (data.updatedCount > 0) msg += ` ${tb('import_updated', { count: data.updatedCount })}`;
        }
        setMessage(msg); setParsedData([]); setPasteText('');
      } else {
        setMessage(`❌ エラー: ${data.error}`);
      }
    } catch {
      setMessage(`❌ ${dataType === 'schedule' ? ts('error_import_failed') : tb('import_error_comm')}`);
    }
    setIsImporting(false);
  };

  /* ────── UI ────── */
  const isSchedule = dataType === 'schedule';

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
          onClick={() => { if (!isSchedule) { setDataType('schedule'); resetState(); } }}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            isSchedule ? 'bg-emerald-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <i className="bi bi-calendar-check mr-1.5"></i>
          スケジュール
        </button>
        <button
          onClick={() => { if (isSchedule) { setDataType('branch'); resetState(); } }}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            !isSchedule ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <i className="bi bi-shop mr-1.5"></i>
          支店
        </button>
      </div>

      {/* ── 入力エリア ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setInputMode('file')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
              inputMode === 'file'
                ? isSchedule ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-600' : 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
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
                ? isSchedule ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-600' : 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
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
                  className={`mt-3 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${isSchedule ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-700">{isSchedule ? ts('preview_title') : tb('preview_title')}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {isSchedule ? ts('preview_count') : tb('preview_count')}:{' '}
                <span className={`font-bold ${isSchedule ? 'text-emerald-600' : 'text-blue-600'}`}>{parsedData.length} {isSchedule ? ts('preview_unit') : tb('preview_unit')}</span>
              </p>
            </div>
            <button onClick={executeImport} disabled={isImporting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow disabled:opacity-50 transition-all">
              {isImporting ? (isSchedule ? ts('btn_registering') : tb('btn_registering')) : (isSchedule ? ts('btn_register') : tb('btn_register'))}
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            {dataType === 'schedule' ? (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-500 sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">{ts('col_date')}</th>
                    <th className="px-4 py-3">{ts('col_branch')}</th>
                    <th className="px-4 py-3">{ts('col_distributor_id')}</th>
                    <th className="px-4 py-3">{ts('col_area_info')}</th>
                    <th className="px-4 py-3">{ts('col_area_unit_price')}</th>
                    <th className="px-4 py-3">{ts('col_size_unit_price')}</th>
                    <th className="px-4 py-3">{ts('col_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.map((s, idx) => {
                    const hasActual = s.items?.some((i: any) => i.actualCount !== null && !isNaN(i.actualCount));
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{s.date}</td>
                        <td className="px-4 py-3 font-bold">{s.branchName}</td>
                        <td className="px-4 py-3 text-slate-500">{s.distributorStaffId}</td>
                        <td className="px-4 py-3">{s.dbPrefectureName ? `${s.dbPrefectureName}, ` : ''}{s.dbFullAreaName}</td>
                        <td className="px-4 py-3 text-right">{s.areaUnitPrice != null ? `¥${s.areaUnitPrice.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-3 text-right">{s.sizeUnitPrice != null ? `¥${s.sizeUnitPrice.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-3">
                          {hasActual
                            ? <span className="text-blue-600 font-bold"><i className="bi bi-check-circle-fill"></i> {ts('status_completed')}</span>
                            : <span className="text-slate-400 font-bold">{ts('status_unstarted')}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-500 sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-4 py-3">{tb('col_name_ja')}</th>
                    <th className="px-4 py-3">{tb('col_name_en')}</th>
                    <th className="px-4 py-3">{tb('col_postal_code')}</th>
                    <th className="px-4 py-3">{tb('col_address')}</th>
                    <th className="px-4 py-3">{tb('col_manager')}</th>
                    <th className="px-4 py-3">{tb('col_sub_manager')}</th>
                    <th className="px-4 py-3">{tb('col_closed_on')}</th>
                    <th className="px-4 py-3">{tb('col_open_time')}</th>
                    <th className="px-4 py-3">{tb('col_close_time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold">{b.nameJa}</td>
                      <td className="px-4 py-3">{b.nameEn || '-'}</td>
                      <td className="px-4 py-3">{b.postalCode || '-'}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={b.address || ''}>{b.address || '-'}</td>
                      <td className="px-4 py-3">{b.managerName || '-'}</td>
                      <td className="px-4 py-3">{b.subManagerName || '-'}</td>
                      <td className="px-4 py-3">{b.closedDays || '-'}</td>
                      <td className="px-4 py-3">{b.openTime || '-'}</td>
                      <td className="px-4 py-3">{b.closeTime || '-'}</td>
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
