import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATUS_MAP: Record<string, { label: string, color: string, icon: string }> = {
  DRAFT: { label: '下書き', color: 'bg-slate-100 text-slate-500', icon: 'bi-pencil' },
  PLANNING: { label: '提案中', color: 'bg-slate-100 text-slate-500', icon: 'bi-chat-dots' },
  PENDING_PAYMENT: { label: '入金待ち', color: 'bg-orange-100 text-orange-700', icon: 'bi-coin' },
  PENDING_REVIEW: { label: '審査待ち', color: 'bg-yellow-100 text-yellow-700', icon: 'bi-hourglass-split' },
  ADJUSTING: { label: '要調整・修正', color: 'bg-rose-100 text-rose-700', icon: 'bi-exclamation-triangle-fill' },
  CONFIRMED: { label: '手配中(確定)', color: 'bg-blue-100 text-blue-700', icon: 'bi-check-circle-fill' },
  IN_PROGRESS: { label: '作業・配布中', color: 'bg-indigo-100 text-indigo-700', icon: 'bi-truck' },
  COMPLETED: { label: '完了', color: 'bg-emerald-100 text-emerald-700', icon: 'bi-flag-fill' },
  CANCELED: { label: 'キャンセル', color: 'bg-slate-200 text-slate-500', icon: 'bi-x-circle-fill' },
};

function getTimeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export default async function PortalDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect('/portal/login');
  }

  const contactId = parseInt((session.user as any).id);
  const contact = await prisma.customerContact.findUnique({ where: { id: contactId }, include: { customer: true } });
  
  if (!contact) {
    redirect('/portal/login');
  }

  const customerId = contact.customerId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // --- KPIとリストデータの並行取得 ---
  const [
    activeOrdersCount,
    pendingPayments,
    monthQrScans,
    todayQrScans,
    activeDistributions,
    recentOrders,
    recentScans
  ] = await Promise.all([
    // 1. 進行中の発注数
    prisma.order.count({
      where: { customerId, status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_REVIEW'] } }
    }),
    // 2. 未払いの請求額合計
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { order: { customerId }, status: 'PENDING' }
    }),
    // 3. 今月のQRスキャン数
    prisma.qrScanLog.count({
      where: { qrCode: { flyer: { customerId } }, scannedAt: { gte: startOfMonth } }
    }),
    // 4. 本日のQRスキャン数
    prisma.qrScanLog.count({
      where: { qrCode: { flyer: { customerId } }, scannedAt: { gte: today } }
    }),
    // 5. 現在配布期間中のチラシ総枚数
    prisma.orderDistribution.aggregate({
      _sum: { plannedCount: true },
      where: { 
        order: { customerId }, 
        startDate: { lte: new Date() }, 
        endDate: { gte: new Date() },
        status: { in: ['UNSTARTED', 'IN_PROGRESS', 'CONFIRMED'] }
      }
    }),
    // 6. 最近の受注履歴（直近5件）
    // ★ 修正箇所: createdAt を id に変更しました
    prisma.order.findMany({
      where: { customerId },
      orderBy: { id: 'desc' }, 
      take: 5,
    }),
    // 7. 最新のQRスキャン履歴（直近6件）
    prisma.qrScanLog.findMany({
      where: { qrCode: { flyer: { customerId } } },
      orderBy: { scannedAt: 'desc' },
      include: { qrCode: { include: { flyer: true } } },
      take: 6,
    })
  ]);

  const billingAmount = pendingPayments._sum.amount || 0;
  const currentlyDistributingCount = activeDistributions._sum.plannedCount || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* ヒーローセクション */}
      <div className="relative bg-slate-800 rounded-3xl p-8 sm:p-10 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 right-60 w-[300px] h-[300px] bg-fuchsia-500 rounded-full blur-[80px] opacity-20 -mb-20 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-indigo-300 font-bold tracking-widest text-xs mb-2 uppercase">Dashboard</div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">
              ようこそ、{contact.customer.name} 様
            </h1>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              PMSプラットフォームへようこそ。ポスティングの発注から反響分析まで、すべてを一元管理し、プロモーションの費用対効果を最大化します。
            </p>
          </div>
          <Link href="/portal/orders/new" className="shrink-0 bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 group">
            <i className="bi bi-map-fill text-xl group-hover:scale-110 transition-transform"></i> 
            新しい発注を作成する
          </Link>
        </div>
      </div>

      {/* KPIカード群 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-indigo-300 transition-colors">
          <div className="text-slate-500 font-bold text-[11px] mb-2 flex items-center gap-2"><i className="bi bi-truck text-indigo-500 text-base"></i> 進行中の発注</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800">{activeOrdersCount}</span>
            <span className="text-xs font-bold text-slate-400">件</span>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-indigo-300 transition-colors">
          <div className="text-slate-500 font-bold text-[11px] mb-2 flex items-center gap-2"><i className="bi bi-send-fill text-fuchsia-500 text-base"></i> 現在の配布予定数</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800">{currentlyDistributingCount.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-400">枚</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-indigo-300 transition-colors">
          <div className="text-slate-500 font-bold text-[11px] mb-2 flex items-center gap-2"><i className="bi bi-qr-code-scan text-emerald-500 text-base"></i> 本日のQR反響</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800">{todayQrScans.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-400">回</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-indigo-300 transition-colors">
          <div className="text-slate-500 font-bold text-[11px] mb-2 flex items-center gap-2"><i className="bi bi-graph-up-arrow text-emerald-500 text-base"></i> 今月の累計反響</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800">{monthQrScans.toLocaleString()}</span>
            <span className="text-xs font-bold text-slate-400">回</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:border-indigo-300 transition-colors col-span-2 lg:col-span-1">
          <div className="text-slate-500 font-bold text-[11px] mb-2 flex items-center gap-2"><i className="bi bi-receipt-cutoff text-amber-500 text-base"></i> 未払いご請求額</div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800">¥{billingAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* メインコンテンツ2カラム */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 左側: 最近の発注 */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <i className="bi bi-clock-history text-indigo-600"></i> 最近の発注履歴
            </h3>
            <Link href="/portal/orders" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
              すべて見る <i className="bi bi-chevron-right"></i>
            </Link>
          </div>
          <div className="flex-1 p-2">
            {recentOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                発注履歴はまだありません
              </div>
            ) : (
              <div className="space-y-1">
                {recentOrders.map(order => {
                  const status = STATUS_MAP[order.status] || STATUS_MAP.PLANNING;
                  return (
                    <Link key={order.id} href="/portal/orders" className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 ${status.color}`}>
                            <i className={`bi ${status.icon}`}></i> {status.label}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">{order.orderNo}</span>
                        </div>
                        <div className="font-bold text-slate-700 text-sm group-hover:text-indigo-700 transition-colors">
                          {order.title || '案件名未設定'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-800">¥{order.totalAmount?.toLocaleString() || '-'}</div>
                        <div className="text-[10px] text-slate-400">{new Date(order.orderDate).toLocaleDateString('ja-JP')}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右側: 最新のQRスキャン履歴 */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <i className="bi bi-phone-vibrate text-emerald-600"></i> リアルタイム反響 (QR)
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          </div>
          <div className="flex-1 p-2">
            {recentScans.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">
                QRコードのスキャン履歴はまだありません
              </div>
            ) : (
              <div className="space-y-1">
                {recentScans.map(scan => (
                  <div key={scan.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <i className={`bi ${scan.deviceType === 'Mobile' ? 'bi-phone' : 'bi-pc-display'}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-bold text-sm text-slate-800 truncate pr-2">
                          {scan.qrCode.flyer?.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold shrink-0 whitespace-nowrap">
                          {getTimeAgo(new Date(scan.scannedAt))}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1" title="推定エリア">
                          <i className="bi bi-geo-alt-fill text-slate-400"></i> {scan.location || 'エリア不明'}
                        </span>
                        <span className="flex items-center gap-1" title="ブラウザ/OS">
                          <i className="bi bi-browser-chrome text-slate-400"></i> {scan.browser} / {scan.os}
                        </span>
                        {scan.qrCode.memo && (
                          <span className="bg-slate-100 px-1.5 rounded text-slate-600 font-medium">
                            {scan.qrCode.memo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}