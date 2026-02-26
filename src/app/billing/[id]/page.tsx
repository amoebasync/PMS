'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type BillingStatus = 'DRAFT' | 'CONFIRMED' | 'SENT' | 'PAID';

type BillingItem = {
  id: number;
  orderId: number;
  subtotal: number;
  taxAmount: number;
  amount: number;
  order: { id: number; orderNo: string; title: string | null; status: string };
};

type BillingStatement = {
  id: number;
  statementNo: string;
  billingMonth: string;
  status: BillingStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  note: string | null;
  paymentDueDate: string | null;
  confirmedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  customer: {
    id: number; name: string; customerCode: string;
    postalCode: string | null; address: string | null;
  };
  items: BillingItem[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '下書き', CONFIRMED: '確定済み', SENT: '送付済み', PAID: '入金済み',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
};
const STEPS: BillingStatus[] = ['DRAFT', 'CONFIRMED', 'SENT', 'PAID'];
const STEP_LABEL: Record<string, string> = {
  DRAFT: '下書き', CONFIRMED: '確定', SENT: '送付済み', PAID: '入金済み',
};
const STEP_ICON: Record<string, string> = {
  DRAFT: 'bi-pencil-square', CONFIRMED: 'bi-check-circle-fill',
  SENT: 'bi-send-fill', PAID: 'bi-cash-coin',
};
const PAYMENT_METHODS = ['銀行振込', 'クレジットカード', '現金', 'その他'];

function fmtDate(s: string | null | undefined) {
  if (!s) return '―';
  const d = new Date(s);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtMoney(n: number) { return `¥${n.toLocaleString('ja-JP')}`; }

export default function BillingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [stmt, setStmt] = useState<BillingStatement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // 入金済みモーダル
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [paidMethod, setPaidMethod] = useState('銀行振込');
  const [paidNote, setPaidNote] = useState('');

  // 受注追加モーダル
  const [showAddModal, setShowAddModal] = useState(false);
  const [addableOrders, setAddableOrders] = useState<any[]>([]);
  const [addSelectedIds, setAddSelectedIds] = useState<number[]>([]);
  const [isFetchingAdd, setIsFetchingAdd] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStmt = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch(`/api/billing/${id}`);
    if (res.ok) setStmt(await res.json());
    setIsLoading(false);
  }, [id]);

  useEffect(() => { fetchStmt(); }, [fetchStmt]);

  const updateStatus = async (status: BillingStatus) => {
    const res = await fetch(`/api/billing/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { setStmt(await res.json()); showToast('ステータスを更新しました'); }
    else { showToast('更新に失敗しました', 'error'); }
  };

  const handleMarkPaid = async () => {
    const res = await fetch(`/api/billing/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', paymentMethod: paidMethod, note: paidNote || stmt?.note }),
    });
    if (res.ok) {
      setStmt(await res.json());
      showToast('入金済みに更新しました');
      setShowPaidModal(false);
    } else {
      showToast('更新に失敗しました', 'error');
    }
  };

  const handleRemoveOrder = async (orderId: number) => {
    if (!confirm('この受注をまとめから外しますか？')) return;
    const res = await fetch(`/api/billing/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeOrderIds: [orderId] }),
    });
    if (res.ok) { setStmt(await res.json()); showToast('受注を外しました'); }
    else { showToast('更新に失敗しました', 'error'); }
  };

  const handleDelete = async () => {
    if (!confirm('この請求まとめを削除しますか？')) return;
    const res = await fetch(`/api/billing/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('削除しました'); router.push('/billing'); }
    else { showToast('削除に失敗しました', 'error'); }
  };

  const downloadPdf = async () => {
    if (!stmt) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/billing/${id}/pdf`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${stmt.statementNo}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('PDF生成に失敗しました', 'error');
    }
    setIsDownloading(false);
  };

  const openAddModal = () => {
    if (!stmt) return;
    setIsFetchingAdd(true);
    setShowAddModal(true);
    setAddSelectedIds([]);
    const params = new URLSearchParams({
      customerId: String(stmt.customer.id),
      excludeStatementId: id,
    });
    fetch(`/api/billing/orders?${params}`)
      .then(r => r.json())
      .then(d => setAddableOrders(Array.isArray(d) ? d.filter((o: any) => !stmt.items.find(i => i.orderId === o.id)) : []))
      .finally(() => setIsFetchingAdd(false));
  };

  const handleAddOrders = async () => {
    if (addSelectedIds.length === 0) return;
    setIsAdding(true);
    const res = await fetch(`/api/billing/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addOrderIds: addSelectedIds }),
    });
    setIsAdding(false);
    if (res.ok) {
      setStmt(await res.json());
      showToast('受注を追加しました');
      setShowAddModal(false);
    } else {
      const err = await res.json();
      showToast(err.error ?? '追加に失敗しました', 'error');
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <i className="bi bi-hourglass-split animate-spin text-3xl"></i>
    </div>
  );
  if (!stmt) return (
    <div className="p-8 text-center text-slate-400">
      <i className="bi bi-exclamation-circle text-4xl block mb-3"></i>データが見つかりません
    </div>
  );

  const currentStepIdx = STEPS.indexOf(stmt.status);
  const [y, m] = stmt.billingMonth.split('-').map(Number);
  const periodLabel = `${y}年${m}月分`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-bold ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* パンくず */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Link href="/billing" className="hover:text-indigo-600 transition-colors">
          <i className="bi bi-receipt-cutoff mr-1"></i>請求管理
        </Link>
        <i className="bi bi-chevron-right text-xs"></i>
        <span className="text-slate-800 font-bold">{stmt.statementNo}</span>
      </div>

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold text-slate-800">{stmt.customer.name}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[stmt.status]}`}>
                {STATUS_LABEL[stmt.status]}
              </span>
            </div>
            <div className="text-sm text-slate-500 flex flex-wrap gap-4">
              <span><i className="bi bi-hash mr-1"></i>{stmt.statementNo}</span>
              <span><i className="bi bi-calendar3 mr-1"></i>請求対象: {periodLabel}</span>
              <span><i className="bi bi-file-earmark-text mr-1"></i>{stmt.items.length} 件</span>
              {stmt.paymentDueDate && (
                <span><i className="bi bi-calendar-check mr-1"></i>支払期限: {fmtDate(stmt.paymentDueDate)}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">ご請求金額（税込）</div>
            <div className="text-3xl font-bold text-indigo-700">{fmtMoney(stmt.totalAmount)}</div>
          </div>
        </div>

        {/* ステータスステッパー */}
        <div className="mt-5 flex items-center">
          {STEPS.map((step, idx) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`flex flex-col items-center flex-1 ${idx < STEPS.length - 1 ? 'relative' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all ${
                  idx < currentStepIdx ? 'bg-indigo-600 border-indigo-600 text-white' :
                  idx === currentStepIdx ? 'bg-white border-indigo-600 text-indigo-600' :
                  'bg-white border-slate-200 text-slate-300'
                }`}>
                  {idx < currentStepIdx
                    ? <i className="bi bi-check-lg text-sm"></i>
                    : <i className={`bi ${STEP_ICON[step]} text-sm`}></i>
                  }
                </div>
                <span className={`text-xs mt-1 font-bold ${
                  idx <= currentStepIdx ? 'text-indigo-600' : 'text-slate-300'
                }`}>{STEP_LABEL[step]}</span>
                {idx < STEPS.length - 1 && (
                  <div className={`absolute top-4 left-1/2 w-full h-0.5 ${
                    idx < currentStepIdx ? 'bg-indigo-500' : 'bg-slate-200'
                  }`} style={{ left: '50%' }}></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 左: 受注明細 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">
                <i className="bi bi-list-ul text-indigo-500 mr-2"></i>請求対象受注 ({stmt.items.length}件)
              </h3>
              {stmt.status === 'DRAFT' && (
                <button
                  onClick={openAddModal}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <i className="bi bi-plus-circle"></i> 受注を追加
                </button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">受注番号</th>
                  <th className="px-4 py-2 text-left font-semibold">件名</th>
                  <th className="px-4 py-2 text-right font-semibold">小計</th>
                  <th className="px-4 py-2 text-right font-semibold">税込合計</th>
                  {stmt.status === 'DRAFT' && <th className="px-4 py-2 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stmt.items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${item.orderId}`} className="font-mono text-xs text-indigo-600 hover:underline">
                        {item.order.orderNo}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{item.order.title ?? '（タイトルなし）'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmtMoney(item.subtotal)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmtMoney(item.amount)}</td>
                    {stmt.status === 'DRAFT' && (
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleRemoveOrder(item.orderId)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <i className="bi bi-x-circle"></i>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={stmt.status === 'DRAFT' ? 2 : 2} className="px-4 py-3 text-xs text-slate-500">合計</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">{fmtMoney(stmt.subtotal)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-indigo-700">{fmtMoney(stmt.totalAmount)}</td>
                  {stmt.status === 'DRAFT' && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 金額サマリー */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              <i className="bi bi-calculator text-indigo-500 mr-2"></i>金額内訳
            </h3>
            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">小計（税抜）</span>
                <span className="text-slate-700">{fmtMoney(stmt.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">消費税（10%）</span>
                <span className="text-slate-700">{fmtMoney(stmt.taxAmount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="font-bold text-slate-700">ご請求合計（税込）</span>
                <span className="font-bold text-lg text-indigo-700">{fmtMoney(stmt.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右: アクション・情報 */}
        <div className="space-y-4">
          {/* アクションパネル */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">
              <i className="bi bi-lightning-fill text-amber-500 mr-2"></i>アクション
            </h3>
            <div className="space-y-2">
              {/* PDF ダウンロード */}
              <button
                onClick={downloadPdf}
                disabled={isDownloading}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
              >
                <i className={`bi ${isDownloading ? 'bi-hourglass-split animate-spin' : 'bi-file-earmark-pdf-fill'}`}></i>
                {isDownloading ? 'PDF生成中...' : '請求書PDFをダウンロード'}
              </button>

              {/* 確定 */}
              {stmt.status === 'DRAFT' && (
                <button
                  onClick={() => { if (confirm('請求まとめを確定しますか？確定後は受注の変更ができません。')) updateStatus('CONFIRMED'); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-all"
                >
                  <i className="bi bi-check-circle-fill"></i> 内容を確定する
                </button>
              )}

              {/* 送付済み */}
              {stmt.status === 'CONFIRMED' && (
                <button
                  onClick={() => { if (confirm('請求書を送付済みにしますか？')) updateStatus('SENT'); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm transition-all"
                >
                  <i className="bi bi-send-fill"></i> 送付済みにする
                </button>
              )}

              {/* 入金済み */}
              {stmt.status === 'SENT' && (
                <button
                  onClick={() => setShowPaidModal(true)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm transition-all"
                >
                  <i className="bi bi-cash-coin"></i> 入金済みにする
                </button>
              )}

              {/* 削除 */}
              {stmt.status === 'DRAFT' && (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-sm transition-all border border-red-200"
                >
                  <i className="bi bi-trash3"></i> 削除する
                </button>
              )}
            </div>
          </div>

          {/* 情報パネル */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              <i className="bi bi-info-circle text-slate-400 mr-2"></i>詳細情報
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">顧客</dt>
                <dd className="font-bold text-slate-800">{stmt.customer.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">請求月</dt>
                <dd className="text-slate-700">{periodLabel}</dd>
              </div>
              {stmt.paymentDueDate && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">支払期限</dt>
                  <dd className="text-slate-700">{fmtDate(stmt.paymentDueDate)}</dd>
                </div>
              )}
              {stmt.confirmedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">確定日</dt>
                  <dd className="text-slate-700">{fmtDate(stmt.confirmedAt)}</dd>
                </div>
              )}
              {stmt.sentAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">送付日</dt>
                  <dd className="text-slate-700">{fmtDate(stmt.sentAt)}</dd>
                </div>
              )}
              {stmt.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">入金日</dt>
                  <dd className="font-bold text-green-700">{fmtDate(stmt.paidAt)}</dd>
                </div>
              )}
              {stmt.paymentMethod && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">支払方法</dt>
                  <dd className="text-slate-700">{stmt.paymentMethod}</dd>
                </div>
              )}
              {stmt.note && (
                <div>
                  <dt className="text-slate-500 mb-1">備考</dt>
                  <dd className="text-slate-700 text-xs bg-slate-50 rounded-lg p-2">{stmt.note}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* ─── 入金済みモーダル ─── */}
      {showPaidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                <i className="bi bi-cash-coin text-green-600 mr-2"></i>入金確認
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="text-sm text-green-700 font-bold mb-1">入金金額</div>
                <div className="text-2xl font-bold text-green-800">{fmtMoney(stmt.totalAmount)}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">支払方法</label>
                <select
                  value={paidMethod}
                  onChange={e => setPaidMethod(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">備考（任意）</label>
                <textarea
                  rows={2} value={paidNote}
                  onChange={e => setPaidNote(e.target.value)}
                  placeholder="入金メモなど..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowPaidModal(false)}
                className="flex-1 py-2.5 text-slate-600 font-bold rounded-lg border border-slate-300 hover:bg-slate-100 transition-all text-sm"
              >キャンセル</button>
              <button
                onClick={handleMarkPaid}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow text-sm transition-all"
              >
                <i className="bi bi-check2-circle mr-1"></i>入金済みにする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 受注追加モーダル ─── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">受注を追加</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="p-6">
              {isFetchingAdd ? (
                <div className="py-10 text-center text-slate-400">
                  <i className="bi bi-hourglass-split animate-spin text-2xl block mb-2"></i>読み込み中...
                </div>
              ) : addableOrders.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <i className="bi bi-inbox text-3xl block mb-2"></i>追加できる受注はありません
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 w-8">
                          <input type="checkbox"
                            checked={addSelectedIds.length === addableOrders.length}
                            onChange={e => setAddSelectedIds(e.target.checked ? addableOrders.map((o: any) => o.id) : [])}
                          />
                        </th>
                        <th className="px-3 py-2 text-left">受注番号</th>
                        <th className="px-3 py-2 text-left">件名</th>
                        <th className="px-3 py-2 text-right">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {addableOrders.map((o: any) => (
                        <tr key={o.id}
                          className={`cursor-pointer ${addSelectedIds.includes(o.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                          onClick={() => setAddSelectedIds(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])}
                        >
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={addSelectedIds.includes(o.id)} onChange={() => {}} />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-indigo-600">{o.orderNo}</td>
                          <td className="px-3 py-2">{o.title ?? '（タイトルなし）'}</td>
                          <td className="px-3 py-2 text-right font-bold">¥{o.totalAmount?.toLocaleString('ja-JP') ?? '―'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 text-slate-600 font-bold rounded-lg border border-slate-300 text-sm">
                キャンセル
              </button>
              <button
                onClick={handleAddOrders}
                disabled={isAdding || addSelectedIds.length === 0}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm disabled:opacity-50"
              >
                {isAdding ? '追加中...' : `${addSelectedIds.length}件を追加する`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
