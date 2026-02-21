'use client';

import React, { useState, useEffect } from 'react';

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
    } catch (e) { alert('保存に失敗しました'); }
    setIsSaving(false);
  };

  const del = async (id: number) => {
    if (!confirm('この入出庫履歴を削除しますか？\n(※完了済みの場合は自動的に在庫が再計算されて元に戻ります)')) return;
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { alert('削除に失敗しました'); }
  };

  // ワンクリック完了処理
  const markAsCompleted = async (tx: any) => {
    if (!confirm(`このトランザクションを「完了」に変更し、在庫に反映させますか？`)) return;
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
    } catch (e) { alert('ステータスの更新に失敗しました'); }
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
      {/* ヘッダー */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="bi bi-box-seam text-blue-600"></i> 入出庫・トランザクション管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">チラシの納品、引取、移動などの在庫変動履歴を管理します。</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all">
          <i className="bi bi-plus-lg mr-2"></i>入出庫を登録
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
              <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">アラート</p>
              <p className="text-sm font-bold text-slate-800">
                予定日を過ぎた <span className="text-xl font-black text-rose-600 mx-1">{pastPendingCount}</span> 件の未納品データがあります
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowPastUncompleted(!showPastUncompleted)}
            className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors border ${showPastUncompleted ? 'bg-rose-600 text-white border-rose-600 shadow' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-100'}`}
          >
            {showPastUncompleted ? '抽出を解除' : '該当データを確認する'}
          </button>
        </div>
      )}

      {/* 検索・フィルタバー */}
      <div className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end transition-opacity ${showPastUncompleted ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">期間 (FROM)</label>
          {/* ★ 変更: handleDateFromChange を設定 */}
          <input type="date" value={dateFrom} onChange={handleDateFromChange} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">期間 (TO)</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">ステータス</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="ALL">すべて</option>
            <option value="PENDING">未納品</option>
            <option value="COMPLETED">完了</option>
            <option value="CANCELED">キャンセル</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">キーワード検索</label>
          <div className="relative">
            <i className="bi bi-search absolute left-3 top-2 text-slate-400 text-sm"></i>
            <input type="text" placeholder="チラシ名、顧客名、コード..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-6 py-4">日付 (予定/実績)</th>
              <th className="px-6 py-4">種別</th>
              <th className="px-6 py-4">対象チラシ / クライアント</th>
              <th className="px-6 py-4 text-right">増減枚数</th>
              <th className="px-6 py-4">担当者 / 備考</th>
              <th className="px-6 py-4 text-center">ステータス <span className="font-normal lowercase">(Click to Action)</span></th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">読み込み中...</td></tr> : 
             filtered.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-400">該当するデータがありません</td></tr> :
             filtered.map(t => {
               const type = TYPE_MAP[t.transactionType];
               const sign = t.transactionType === 'RECEIVE' ? '+' : t.transactionType === 'TRANSFER' ? '±' : '-';
               return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-bold text-slate-700 text-base">
                    {new Date(t.expectedAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md border ${type.color}`}>
                      <i className={type.icon}></i> {type.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] text-slate-500 font-bold mb-0.5 truncate max-w-[200px]">{t.flyer?.customer?.name || '顧客不明'}</div>
                    <div className="font-bold text-slate-800 mb-1 truncate max-w-[200px]" title={t.flyer?.name}>{t.flyer?.name}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-black text-lg ${t.transactionType === 'RECEIVE' ? 'text-blue-600' : 'text-rose-600'}`}>
                      {sign}{t.count.toLocaleString()} <span className="text-xs font-normal text-slate-500">枚</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="font-bold text-slate-700">{t.employee ? `${t.employee.lastNameJa} ${t.employee.firstNameJa}` : '未指定'}</div>
                    <div className="text-slate-500 mt-1 truncate max-w-[150px]" title={t.note}>{t.note || '-'}</div>
                  </td>
                  
                  <td className="px-6 py-4 text-center">
                    {t.status === 'PENDING' ? (
                      <button onClick={() => markAsCompleted(t)} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 hover:shadow-sm transition-all flex items-center gap-1.5 border border-amber-300 mx-auto">
                         <i className="bi bi-clock-history"></i> 未納品 <i className="bi bi-chevron-right opacity-50"></i>
                      </button>
                    ) : t.status === 'COMPLETED' ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit mx-auto">
                        <i className="bi bi-check-circle-fill"></i> 完了
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 w-fit mx-auto">
                        <i className="bi bi-x-circle-fill"></i> キャンセル
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openModal(t)} className="p-2 text-slate-400 hover:text-blue-600"><i className="bi bi-pencil-square text-lg"></i></button>
                    <button onClick={() => del(t.id)} className="p-2 text-slate-400 hover:text-rose-600"><i className="bi bi-trash text-lg"></i></button>
                  </td>
                </tr>
               )
             })}
          </tbody>
        </table>
      </div>

      {/* 登録・編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800"><i className="bi bi-box-seam text-blue-600 mr-2"></i>{currentId ? '入出庫の編集' : '入出庫の登録'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><i className="bi bi-x-lg"></i></button>
            </div>
            
            <form onSubmit={save} className="p-6 overflow-y-auto space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">対象チラシ *</label>
                <select required value={form.flyerId} onChange={e => setForm({...form, flyerId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="">選択してください</option>
                  {flyers.map(f => <option key={f.id} value={f.id}>{f.customer?.name} - {f.name} (在庫: {f.stockCount})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">入出庫の種類 *</label>
                  <select required value={form.transactionType} onChange={e => setForm({...form, transactionType: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                    <option value="RECEIVE">納品 (入庫)</option>
                    <option value="PICKUP">引取 (出庫)</option>
                    <option value="TRANSFER">拠点移動</option>
                    <option value="DISPOSE">廃棄・調整</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">対象枚数 *</label>
                  <div className="relative">
                    <input type="number" required min="1" value={form.count} onChange={e => setForm({...form, count: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white pr-8 text-right font-bold text-blue-600 focus:ring-2 focus:ring-blue-500" placeholder="1000" />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">枚</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">発生日 (予定/実績) *</label>
                  <input type="date" required value={form.expectedAt} onChange={e => setForm({...form, expectedAt: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">ステータス *</label>
                  <select required value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold text-indigo-700">
                    <option value="COMPLETED">完了 (在庫に即反映)</option>
                    <option value="PENDING">未納品 (反映待機)</option>
                    <option value="CANCELED">キャンセル</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">担当者 (社内確認者・ドライバー)</label>
                <select value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white">
                  <option value="">(ログインユーザーを自動設定)</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.lastNameJa} {e.firstNameJa}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">備考</label>
                <input type="text" value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="w-full border p-2.5 rounded-lg text-sm bg-white" placeholder="〇〇便にて到着、など" />
              </div>

              <div className="pt-4 flex justify-end gap-3 mt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">キャンセル</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-50">
                  {isSaving ? '保存中...' : '在庫を更新して保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}