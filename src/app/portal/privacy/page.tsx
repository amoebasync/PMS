'use client';

import React from 'react';
import Link from 'next/link';
import PrivacyContent from '@/components/portal/PrivacyContent'; // ★部品をインポート

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="bg-slate-800 px-8 py-10 text-center">
          <h1 className="text-3xl font-black text-white tracking-widest mb-2">プライバシーポリシー</h1>
          <p className="text-slate-300 text-sm font-medium">個人情報の取り扱いについて</p>
        </div>

        <div className="p-8 md:p-12">
          <PrivacyContent /> {/* ★ここで部品を呼び出す */}
        </div>
        
        <div className="bg-slate-100 px-8 py-6 text-center border-t border-slate-200">
          <Link href="/portal" className="text-slate-600 hover:text-slate-800 font-bold transition-colors">
            トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}