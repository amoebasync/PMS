import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PortalDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/portal/login');
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-gradient-to-r from-indigo-600 to-fuchsia-600 p-8 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-3xl font-bold mb-2">ようこそ、{(session.user as any)?.company} 様</h1>
          <p className="text-indigo-100">PMSプラットフォームへようこそ。ポスティングの発注から反響分析まで、すべてを一元管理できます。</p>
        </div>
        <Link href="/portal/orders/new" className="bg-white text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold shadow-md transition-all flex items-center gap-2">
          <i className="bi bi-cart-plus-fill text-lg"></i> 新規発注する
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-40 hover:border-indigo-300 transition-colors">
          <div className="text-slate-500 font-bold text-sm flex items-center gap-2"><i className="bi bi-box-seam text-indigo-500 text-lg"></i> 進行中の発注</div>
          <div className="text-4xl font-black text-slate-800">0 <span className="text-sm font-bold text-slate-400">件</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-40 hover:border-indigo-300 transition-colors">
          <div className="text-slate-500 font-bold text-sm flex items-center gap-2"><i className="bi bi-qr-code-scan text-emerald-500 text-lg"></i> 今月のQRスキャン数</div>
          <div className="text-4xl font-black text-slate-800">0 <span className="text-sm font-bold text-slate-400">回</span></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-40 hover:border-indigo-300 transition-colors">
          <div className="text-slate-500 font-bold text-sm flex items-center gap-2"><i className="bi bi-piggy-bank text-amber-500 text-lg"></i> 今月のご請求予定</div>
          <div className="text-4xl font-black text-slate-800">¥0</div>
        </div>
      </div>
    </div>
  );
}