'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

type PayrollItem = {
  id: number;
  date: string;
  flyerTypeCount: number;
  unitPrice: number;
  actualCount: number;
  earnedAmount: number;
};

type PayrollRecord = {
  id: number;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  schedulePay: number;
  expensePay: number;
  grossPay: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PAID';
  cashReceivedAt: string | null;
  cashSignatureUrl: string | null;
  items: PayrollItem[];
};

const statusConfig = {
  DRAFT:     { label: '計算中',  color: 'bg-slate-100 text-slate-500' },
  CONFIRMED: { label: '確定済',  color: 'bg-amber-100 text-amber-700' },
  PAID:      { label: '支払済',  color: 'bg-emerald-100 text-emerald-700' },
};

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ===== 署名パッドコンポーネント =====
function SignaturePad({ onSave, onCancel, grossPay }: { onSave: (dataUrl: string) => void; onCancel: () => void; grossPay: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // High DPI support
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (!canvasRef.current || !hasDrawn) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="px-5 pb-2">
          <h3 className="text-lg font-bold text-slate-800">現金受取確認</h3>
          <p className="text-xs text-slate-500 mt-1">以下の金額を現金で受け取ったことを確認します</p>
        </div>

        {/* 金額表示 */}
        <div className="mx-5 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div className="text-xs text-emerald-600 font-bold">受取金額</div>
          <div className="text-3xl font-black text-emerald-700 mt-1">¥{grossPay.toLocaleString()}</div>
        </div>

        {/* 確認文言 */}
        <div className="mx-5 mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-600">
            <i className="bi bi-check-circle text-emerald-500 mr-1"></i>
            上記の金額を現金で受け取り、金額に間違いがないことを確認しました。
          </p>
        </div>

        {/* 署名エリア */}
        <div className="px-5 mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-600">署名 (サイン)</label>
            <button onClick={clearCanvas} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">
              <i className="bi bi-arrow-counterclockwise mr-0.5"></i>クリア
            </button>
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none cursor-crosshair"
              style={{ height: 140 }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-center">上の枠内にサインしてください</p>
        </div>

        {/* ボタン */}
        <div className="flex gap-3 px-5 py-4 mt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!hasDrawn}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i className="bi bi-check-lg mr-1"></i>受取確認
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffPayrollPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [confirmingRecord, setConfirmingRecord] = useState<PayrollRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/staff/payroll?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setRecords(data.records || []);
      setPaymentMethod(data.paymentMethod || null);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // URLパラメータから confirm=payrollId を取得して自動で確認モーダルを開く
  useEffect(() => {
    if (loading || records.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const confirmId = params.get('confirm');
    if (confirmId) {
      const rec = records.find(r => r.id === parseInt(confirmId));
      if (rec && rec.status === 'PAID' && !rec.cashReceivedAt) {
        setConfirmingRecord(rec);
      }
      // URLからパラメータを削除
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loading, records]);

  const handleConfirmCash = async (signature: string) => {
    if (!confirmingRecord) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/payroll/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollId: confirmingRecord.id, signature }),
      });
      if (res.ok) {
        setConfirmingRecord(null);
        fetchRecords();
      }
    } catch { /* silent */ }
    setSubmitting(false);
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const isCash = paymentMethod === '現金';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-800">給与履歴</h1>
        <p className="text-xs text-slate-500 mt-1">週ごとの配布報酬・交通費の支払い履歴です</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <button onClick={prevMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-left text-lg"></i>
        </button>
        <span className="font-bold text-slate-700 text-sm">{year}年{month}月</span>
        <button onClick={nextMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
          <i className="bi bi-chevron-right text-lg"></i>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
          この期間の給与データはありません
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const isExpanded = expandedId === record.id;
            const needsConfirm = isCash && record.status === 'PAID' && !record.cashReceivedAt;
            const isConfirmed = isCash && record.cashReceivedAt;
            return (
              <div key={record.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${needsConfirm ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-100'}`}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">
                      {formatDateJa(record.periodStart)}〜{formatDateJa(record.periodEnd)}
                      　支払: {formatDateJa(record.paymentDate)}
                    </p>
                    <p className="text-xl font-black text-slate-800 mt-0.5">
                      ¥{record.grossPay.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      配布 ¥{record.schedulePay.toLocaleString()} ＋ 交通費 ¥{record.expensePay.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusConfig[record.status].color}`}>
                      {statusConfig[record.status].label}
                    </span>
                    {isConfirmed && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        <i className="bi bi-check-circle-fill mr-0.5"></i>受取確認済
                      </span>
                    )}
                  </div>
                  <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-300`}></i>
                </button>

                {/* 受取確認ボタン */}
                {needsConfirm && (
                  <div className="px-5 pb-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmingRecord(record); }}
                      className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <i className="bi bi-pen text-base"></i>
                      現金受取を確認する
                    </button>
                  </div>
                )}

                {isExpanded && record.items.length > 0 && (
                  <div className="border-t border-slate-50 px-5 py-3">
                    <p className="text-[11px] font-bold text-slate-400 mb-2">配布明細</p>
                    <div className="space-y-2">
                      {record.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">{formatDateJa(item.date)}</span>
                          <span className="text-slate-500">{item.flyerTypeCount}種 × ¥{item.unitPrice % 1 === 0 ? item.unitPrice : item.unitPrice.toFixed(2)}</span>
                          <span className="text-slate-600">{item.actualCount.toLocaleString()}ポスト</span>
                          <span className="font-bold text-slate-800">¥{item.earnedAmount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* 受取確認情報 */}
                    {isConfirmed && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400">
                          <i className="bi bi-check-circle-fill text-blue-500 mr-1"></i>
                          受取確認日時: {new Date(record.cashReceivedAt!).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 署名パッドモーダル */}
      {confirmingRecord && !submitting && (
        <SignaturePad
          grossPay={confirmingRecord.grossPay}
          onCancel={() => setConfirmingRecord(null)}
          onSave={handleConfirmCash}
        />
      )}
      {submitting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl text-center">
            <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-600 mt-3">送信中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
