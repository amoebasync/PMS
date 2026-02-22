'use client';

import React from 'react';
import Link from 'next/link';
import TermsContent from '@/components/portal/TermsContent'; // ★部品をインポート

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="bg-indigo-600 px-8 py-10 text-center">
          <h1 className="text-3xl font-black text-white tracking-widest mb-2">利用規約</h1>
          <p className="text-indigo-100 text-sm font-medium">Terms of Service</p>
        </div>

        <div className="p-8 md:p-12">
          <TermsContent /> {/* ★ここで部品を呼び出す */}
        </div>
        
        <div className="bg-slate-100 px-8 py-6 text-center border-t border-slate-200">
          <Link href="/portal" className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors">
            トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}