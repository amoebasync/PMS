import React from 'react';
import Link from 'next/link';

export default function PortalLandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-in fade-in duration-700">
      <div className="inline-block bg-indigo-50 text-indigo-700 font-bold px-4 py-1.5 rounded-full text-xs mb-6 border border-indigo-100">
        次世代のポスティング＆印刷 ECプラットフォーム
      </div>
      
      <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight leading-tight mb-6">
        チラシの手配から反響分析まで<br className="hidden md:block"/>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-fuchsia-600">すべてをWebで完結。</span>
      </h1>
      
      <p className="text-slate-500 text-lg mb-10 max-w-2xl">
        地図を見ながら直感的にエリアを選択し、印刷から配布までをワンストップで発注。QRコードを使ったリアルタイムな反響測定で、広告の費用対効果を最大化します。
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/portal/signup" className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1">
          無料でアカウントを作成
        </Link>
        <Link href="/portal/login" className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-lg shadow-sm border border-slate-200 transition-all">
          ログイン
        </Link>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full max-w-5xl">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4"><i className="bi bi-map-fill"></i></div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">直感的なエリア選択</h3>
          <p className="text-slate-500 text-sm">システム上のマップから、町丁単位でターゲット層に合わせた細かな配布エリアの設定が可能です。</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center text-2xl mb-4"><i className="bi bi-qr-code-scan"></i></div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">リアルタイム反響測定</h3>
          <p className="text-slate-500 text-sm">チラシに印字されたQRが読み込まれると即座にメールで通知。どのエリアで効果があったか分析できます。</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-2xl mb-4"><i className="bi bi-credit-card-fill"></i></div>
          <h3 className="font-bold text-slate-800 text-lg mb-2">オンライン決済対応</h3>
          <p className="text-slate-500 text-sm">クレジットカードでの即時決済に対応。見積もりを待つことなく、今すぐプロモーションを開始できます。</p>
        </div>
      </div>
    </div>
  );
}