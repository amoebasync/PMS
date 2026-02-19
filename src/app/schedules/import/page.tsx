'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const formatExcelDate = (val: any) => {
  if (!val) return null;
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  return String(val).trim().replace(/\//g, '-');
};

export default function ScheduleImportPage() {
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage('ファイルを読み込み、データベースと照合しています...');
    setParsedData([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

      if (rows.length < 2) {
        setMessage('エラー: ファイルの中身が空か、データが見つかりません。');
        return;
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const idxJobNum = headers.indexOf('仕事管理番号');
      const idxDate = headers.indexOf('年月日');
      const idxBranch = headers.indexOf('店舗');
      const idxStaff = headers.indexOf('ｽﾀｯﾌ管理番号');
      const idxAreaCode = headers.indexOf('丁目番号');
      
      let skippedCount = 0;

      // 1. まずはエクセルの行データをパース
      const rawSchedules = dataRows.map((row, index) => {
        // エクセルの行番号（ヘッダーが1行目なので、データは2行目から開始）
        const excelRowNumber = index + 2;

        if (!row || row.length < 10) {
          skippedCount++;
          return null;
        }

        const items = [];
        for (let i = 1; i <= 6; i++) {
          const flyerIdx = headers.indexOf(`チラシ${i}`);
          if (flyerIdx !== -1 && row[flyerIdx]) {
            items.push({
              slotIndex: i,
              flyerName: String(row[flyerIdx]),
              customerCode: row[flyerIdx + 1] ? String(row[flyerIdx + 1]) : null,
              flyerCode: row[flyerIdx + 2] ? String(row[flyerIdx + 2]) : null,
              actualCount: row[flyerIdx + 8] ? parseInt(String(row[flyerIdx + 8]).replace(/,/g, '')) : null,
              plannedCount: row[flyerIdx + 7] ? parseInt(String(row[flyerIdx + 7]).replace(/,/g, '')) : null,
              method: row[flyerIdx + 6] ? String(row[flyerIdx + 6]) : null,
              startDateStr: formatExcelDate(row[flyerIdx + 3]),
              endDateStr: formatExcelDate(row[flyerIdx + 4]),
              spareDateStr: formatExcelDate(row[flyerIdx + 5]),
            });
          }
        }

        if (!row[idxDate] || !row[idxStaff]) {
          skippedCount++;
          return null;
        }

        return {
          excelRowNumber, // エラー表示用に行番号を保持
          jobNumber: idxJobNum !== -1 && row[idxJobNum] ? String(row[idxJobNum]) : null,
          date: formatExcelDate(row[idxDate]),
          branchName: idxBranch !== -1 && row[idxBranch] ? String(row[idxBranch]) : null,
          distributorStaffId: idxStaff !== -1 && row[idxStaff] ? String(row[idxStaff]) : null,
          areaCode: idxAreaCode !== -1 && row[idxAreaCode] ? String(row[idxAreaCode]) : null,
          items: items
        };
      }).filter(Boolean);

      if (rawSchedules.length === 0) {
        setMessage(`エラー: 読み込めるデータが0件でした。`);
        return;
      }

      // 2. パースした areaCode (丁目番号) のリストを作って、DBマスタを参照する
      const uniqueAreaCodes = Array.from(new Set(rawSchedules.map(s => s?.areaCode).filter(Boolean)));
      let areaMap: Record<string, any> = {};

      try {
        const lookupRes = await fetch('/api/areas/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addressCodes: uniqueAreaCodes })
        });
        if (lookupRes.ok) {
          areaMap = await lookupRes.json();
        } else {
          setMessage(`エラー: マスタデータの取得に失敗しました。サーバーを確認してください。`);
          return;
        }
      } catch (err) {
        console.error('Failed to lookup areas', err);
        setMessage(`エラー: マスタデータ参照APIとの通信に失敗しました。`);
        return;
      }

      // 3. マスタ照合とエラーチェック
      const missingAreas: string[] = [];

      const schedules = rawSchedules.map(s => {
        if (!s) return null;
        const dbArea = s.areaCode ? areaMap[s.areaCode] : null;
        
        // ★ マスタに存在しないエリアコードが含まれていた場合、エラー情報を収集
        if (!dbArea) {
          missingAreas.push(`${s.excelRowNumber}行目 (エリアコード: ${s.areaCode})`);
          return null;
        }

        return {
          ...s,
          dbPrefectureName: dbArea.prefectureName || '',
          // ★ 重複しないように chomeName を優先（無ければ townName）し、間にスペースを空ける
          dbFullAreaName: `${dbArea.cityName || ''} ${dbArea.chomeName || dbArea.townName || ''}`.trim()
        };
      });

      // 🚨 マスタにないエリアコードが一つでもあれば、プレビューを表示させずにエラーを返す
      if (missingAreas.length > 0) {
        setMessage(`エラー: 以下の行のエリアコードがマスタに登録されていません。\nエクセルのデータを修正して、再度インポートし直してください。\n\n${missingAreas.join('\n')}`);
        setParsedData([]); // インポートできないようにデータをクリア
        return;
      }

      // エラーがなければプレビューへデータをセット
      setParsedData(schedules.filter(Boolean));
      setMessage('');

    } catch (error: any) {
      console.error(error);
      setMessage(`ファイルの読み込みに失敗しました。`);
    }
  };

  const resetInput = (e: React.MouseEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).value = '';
  };

  const executeImport = async () => {
    setIsImporting(true);
    setMessage('データベースへ登録中です...');
    try {
      const res = await fetch('/api/schedules/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✨ インポート成功！ ${data.count}件のスケジュールを登録しました。`);
        setParsedData([]); 
      } else {
        setMessage(`❌ エラー: ${data.error}`);
      }
    } catch (e) {
      setMessage('❌ 通信エラーが発生しました。');
    }
    setIsImporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-800"><i className="bi bi-file-earmark-spreadsheet text-emerald-600"></i> スケジュール インポート</h1>
        <p className="text-slate-500 text-sm mt-1">システムから出力したエクセル（.xlsx）またはCSVファイルをアップロードしてください。</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <input 
          type="file" 
          onChange={handleFileUpload} 
          onClick={resetInput}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" 
        />
        {message && (
          <div className={`mt-4 p-3 rounded-lg font-bold border whitespace-pre-wrap ${message.includes('エラー') || message.includes('❌') ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {message}
          </div>
        )}
      </div>

      {parsedData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-700">インポート内容プレビュー</h3>
              <p className="text-sm text-slate-500 mt-1">読み込み件数: <span className="font-bold text-emerald-600">{parsedData.length} 件</span></p>
            </div>
            <button onClick={executeImport} disabled={isImporting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow disabled:opacity-50 transition-all">
              {isImporting ? '登録中...' : 'データベースへ登録する'}
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-500 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-4 py-3">年月日</th>
                  <th className="px-4 py-3">店舗</th>
                  <th className="px-4 py-3">配布員ID</th>
                  <th className="px-4 py-3">エリア情報</th>
                  <th className="px-4 py-3">判定ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedData.map((s, idx) => {
                  const hasActual = s.items.some((i:any) => i.actualCount !== null && !isNaN(i.actualCount));
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{s.date}</td>
                      <td className="px-4 py-3 font-bold">{s.branchName}</td>
                      <td className="px-4 py-3 text-slate-500">{s.distributorStaffId}</td>
                      
                      {/* ★ DBマスタから引っ張ってきた正確な都道府県と市区町村を表示 */}
                      <td className="px-4 py-3">
                        {s.dbPrefectureName ? `${s.dbPrefectureName}, ` : ''}{s.dbFullAreaName}
                      </td>

                      <td className="px-4 py-3">
                        {hasActual 
                          ? <span className="text-blue-600 font-bold"><i className="bi bi-check-circle-fill"></i> 完了</span>
                          : <span className="text-slate-400 font-bold">未開始</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}