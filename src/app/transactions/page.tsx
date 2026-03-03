'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '@/components/ui/NotificationProvider';
import { useTranslation } from '@/i18n';

const TYPE_MAP: Record<string, { label: string, color: string, icon: string }> = {
  RECEIVE: { label: '納品(入庫)', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'bi-box-arrow-in-down' },
  PICKUP: { label: '引取(出庫)', color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', icon: 'bi-box-arrow-up' },
  TRANSFER: { label: '移動', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'bi-arrow-left-right' },
  DISPOSE: { label: '廃棄・調整', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'bi-trash' },
};

// 本日の日付文字列 (YYYY-MM-DD) を取得するヘルパー
const getTodayStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function TransactionsPage() {
  const { t } = useTranslation('transactions');
  const { showToast, showConfirm } = useNotification();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [flyers, setFlyers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 検索・フィルタ用State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [showPastUncompleted, setShowPastUncompleted] = useState(false); // 過去の未納品アラート用

  // --- モーダル・フォーム用State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const [form, setForm] = useState({
    flyerId: '', transactionType: 'RECEIVE', expectedAt: getTodayStr(), count: '', status: 'COMPLETED', employeeId: '', note: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // データ取得
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [txRes, flyerRes, empRes] = await Promise.all([
        fetch('/api/transactions'), fetch('/api/flyers'), fetch('/api/employees')
      ]);
      if (txRes.ok) setTransactions(await txRes.json());
      if (flyerRes.ok) setFlyers(await flyerRes.json());
      if (empRes.ok) setEmployees((await empRes.json()).filter((e:any) => e.isActive));
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ★ 追加: From日付変更時に、ToがFromより前になれば自動的に揃えるロジック
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = e.target.value;
    setDateFrom(newFrom);
    if (newFrom > dateTo) {
      setDateTo(newFrom);
    }
  };

  // --- 操作アクション ---
  const openModal = (tx?: any) => {
    if (tx) {
      setCurrentId(tx.id);
      setForm({
        flyerId: tx.flyerId.toString(),
        transactionType: tx.transactionType,
        expectedAt: tx.expectedAt.split('T')[0], // 時間を削って日付だけセット
        count: tx.count.toString(),
        status: tx.status,
        employeeId: tx.employeeId?.toString() || '',
        note: tx.note || ''
      });
    } else {
      setCurrentId(null);
      setForm({
        flyerId: '', transactionType: 'RECEIVE', expectedAt: getTodayStr(),
        count: '', status: 'COMPLETED', employeeId: '', note: ''
      });
    }
    setIsModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        expectedAt: form.expectedAt + 'T00:00:00Z' // サーバーには0時として送信
      };
      const res = await fetch(currentId ? `/api/transactions/${currentId}` : '/api/transactions', {
        method: currentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      setIsModalOpen(false);
      fetchData();
    } catch (e) { showToast(t('save_error'), 'error'); }
    setIsSaving(false);
  };

  const del = async (id: number) => {
    if (!await showConfirm(t('confirm_delete'), { variant: 'danger', detail: t('confirm_delete_detail'), confirmLabel: t('confirm_delete_btn') })) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { showToast(t('delete_error'), 'error'); }
  };

  // ワンクリック完了処理
  const markAsCompleted = async (tx: any) => {
    if (!await showConfirm(t('confirm_complete'), { variant: 'primary', confirmLabel: t('confirm_complete_btn') })) return;
    try {
      const payload = {
        flyerId: tx.flyerId.toString(),
        transactionType: tx.transactionType,
        expectedAt: tx.expectedAt, // 既存の時間をそのまま使用
        count: tx.count.toString(),
        status: 'COMPLETED',
        employeeId: tx.employeeId?.toString() || '',
        note: tx.note || ''
      };

      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();
      fetchData();
    } catch (e) { showToast(t('error_status_update'), 'error'); }
  };

  // --- フィルタリング ---
  const todayTime = new Date(getTodayStr() + 'T00:00:00').getTime();

  // 過去の未納品件数をカウント
  const pastPendingCount = transactions.filter(t => 
    t.status === 'PENDING' && new Date(t.expectedAt).getTime() < todayTime
  ).length;

  const filtered = transactions.filter(t => {
    // 過去の未納品アラートモード
    if (showPastUncompleted) {
      const exp = new Date(t.expectedAt).getTime();
      if (!(t.status === 'PENDING' && exp < todayTime)) return false;
    } else {
      // 通常のフィルタモード
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      
      const fromTime = new Date(dateFrom + 'T00:00:00').getTime();
      const toTime = new Date(dateTo + 'T23:59:59').getTime();
      const exp = new Date(t.expectedAt).getTime();
      if (exp < fromTime || exp > toTime) return false;
    }

    // キーワード検索
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const target = `${t.flyer?.name || ''} ${t.flyer?.flyerCode || ''} ${t.flyer?.customer?.name || ''}`.toLowerCase();
      if (!target.includes(q)) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all">
          <i className="bi bi-plus-lg mr-2"></i>{t('btn_new')}
        </button>
      </div>

      {/* 過去の未納品アラートパネル */}
      {pastPendingCount > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </div>
            <div>
              <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">{t('alert_label')}</p>
              <p className="text-sm font-bold text-slate-800">
                {t('alert_past_pending')} <span className="text-xl font-black text-rose-600 mx-1">{pastPendingCount}</span> {t('alert_past_pending_suffix')}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowPastUncompleted(!showPastUncompleted)}
            className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors border ${showPastUncompleted ? 'bg-rose-600 text-white border-rose-600 shadow' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-100'}`}
          >
            {showPastUncompleted ? t('alert_release') : t('alert_show')}
          </button>
        </div>
      )}

      {/* 検索・フィルタバー */}
      <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end transition-opacity ${showPastUncompleted ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('period_from')}</label>
          {/* ★ 変更: handleDateFromChange を設定 */}
          <input type="date" value={dateFrom} onChange={handleDateFromChange} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('period_to')}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('filter_status')}</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="ALL">{t('filter_all')}</option>
            <option value="PENDING">{t('filter_pending')}</option>
            <option value="COMPLETED">{t('filter_completed')}</option>
            <option value="CANCELED">{t('filter_canceled')}</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t('search_keyword')}</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2 text-slate-400 text-sm"></i>
            <input type="text" placeholder={t('search_placeholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">{t('table_date')}</th>
              <th className="px-6 py-4">{t('table_type')}</th>
              <th className="px-6 py-4">{t('table_flyer_client')}</th>
              <th className="px-6 py-4 text-right">{t('table_count')}</th>
              <th className="px-6 py-4">{t('table_person_note')}</th>
              <th className="px-6 py-4 text-center">{t('table_status')} <span className="font-normal lowercase">{t('table_status_hint')}</span></th>
              <th className="px-6 py-4 text-right">{t('table_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('loading')}</td></tr> :
             filtered.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('no_data')}</td></tr> :
             filtered.map(tx => {
               const type = TYPE_MAP[tx.transactionType];
               const typeLabel = t(`type_${tx.transactionType.toLowerCase()}`);
               const sign = tx.transactionType === 'RECEIVE' ? '+' : tx.transactionType === 'TRANSFER' ? '±' : '-';
               return (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-bold text-slate-700 text-base">
                    {new Date(tx.expectedAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md border ${type.color}`}>
                      <i className={type.icon}></i> {typeLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] text-slate-500 font-bold mb-0.5 truncate max-w-[200px]">{tx.flyer?.customer?.name || t('customer_unknown')}</div>
                    <div className="font-bold text-slate-800 mb-1 truncate max-w-[200px]" title={tx.flyer?.name}>{tx.flyer?.name}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-black text-lg ${tx.transactionType === 'RECEIVE' ? 'text-blue-600' : 'text-rose-600'}`}>
                      {sign}{tx.count.toLocaleString()} <span className="text-xs font-normal text-slate-500">{t('sheets')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="font-bold text-slate-700">{tx.employee ? `${tx.employee.lastNameJa} ${tx.employee.firstNameJa}` : t('person_unset')}</div>
                    <div className="text-slate-500 mt-1 truncate max-w-[150px]" title={tx.note}>{tx.note || '-'}</div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    {tx.status === 'PENDING' ? (
                      <button onClick={() => markAsCompleted(tx)} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 hover:shadow-sm transition-all flex items-center gap-1.5 border border-amber-300 mx-auto">
                         <i className="bi bi-clock-history"></i> {t('status_pending')} <i className="bi bi-chevron-right opacity-50"></i>
                      </button>
                    ) : tx.status === 'COMPLETED' ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit mx-auto">
                        <i className="bi bi-check-circle-fill"></i> {t('status_completed')}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit mx-auto">
                        <i className="bi bi-x-circle-fill"></i> {t('status_canceled')}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openModal(tx)} className="p-2 text-slate-400 hover:text-blue-600"><i className="bi bi-pencil-square text-lg"></i></button>
                    <button onClick={() => del(tx.id)} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash text-lg"></i></button>
                  </td>
                </tr>
               )
             })}
          </tbody>
        </table>
        </div>
      </div>

      {/* 登録・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800"><i className="bi bi-box-seam text-blue-600 mr-2"></i>{currentId ? t('modal_title_edit') : t('modal_title_new')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_flyer')}</label>
                <select required value={form.flyerId} onChange={e => setForm({...form, flyerId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="">{t('form_select_placeholder')}</option>
                  {flyers.map(f => <option key={f.id} value={f.id}>{f.customer?.name} - {f.name} ({t('form_flyer_option', { count: f.stockCount })})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_type')}</label>
                  <select required value={form.transactionType} onChange={e => setForm({...form, transactionType: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                    <option value="RECEIVE">{t('form_type_receive')}</option>
                    <option value="PICKUP">{t('form_type_pickup')}</option>
                    <option value="TRANSFER">{t('form_type_transfer')}</option>
                    <option value="DISPOSE">{t('form_type_dispose')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_count')}</label>
                  <div className="relative">
                    <input type="number" required min="1" value={form.count} onChange={e => setForm({...form, count: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white pr-8 text-right font-bold text-blue-600 focus:ring-2 focus:ring-blue-500" placeholder="1000" />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">{t('sheets')}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_date')}</label>
                  <input type="date" required value={form.expectedAt} onChange={e => setForm({...form, expectedAt: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_status')}</label>
                  <select required value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold text-indigo-700">
                    <option value="COMPLETED">{t('form_status_completed')}</option>
                    <option value="PENDING">{t('form_status_pending')}</option>
                    <option value="CANCELED">{t('form_status_canceled')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_person')}</label>
                <select value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white">
                  <option value="">{t('form_person_auto')}</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">{t('form_note')}</label>
                <input type="text" value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" placeholder={t('form_note_placeholder')} />
              </div>

              <div className="pt-4 flex justify-end gap-3 mt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50">
                  {isSaving ? t('saving') : t('btn_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}