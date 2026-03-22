'use client';

import React from 'react';
import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

        <div className="bg-slate-800 px-8 py-10 text-center">
          <h1 className="text-3xl font-black text-white tracking-widest mb-2">サポート</h1>
          <p className="text-slate-300 text-sm font-medium">Support</p>
        </div>

        <div className="p-8 md:p-12 space-y-10">

          {/* お問い合わせ */}
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">お問い合わせ</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              サービスに関するご質問・ご要望・不具合のご報告は、下記メールアドレスまでお問い合わせください。
            </p>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-slate-500 font-medium min-w-[80px]">メール</span>
                  <a href="mailto:info@tiramis.co.jp" className="text-blue-600 hover:text-blue-800 font-medium">
                    info@tiramis.co.jp
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-slate-500 font-medium min-w-[80px]">受付時間</span>
                  <span className="text-slate-700">平日 9:00〜18:00（土日祝を除く）</span>
                </div>
              </div>
            </div>
          </section>

          {/* 運営会社 */}
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">運営会社</h2>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-slate-500 font-medium min-w-[80px]">会社名</span>
                  <span className="text-slate-700">株式会社ティラミス</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-slate-500 font-medium min-w-[80px]">所在地</span>
                  <span className="text-slate-700">〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F</span>
                </div>
              </div>
            </div>
          </section>

          {/* 関連リンク */}
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">関連リンク</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/portal/terms" className="text-blue-600 hover:text-blue-800 font-medium underline underline-offset-4">
                利用規約
              </Link>
              <Link href="/portal/privacy" className="text-blue-600 hover:text-blue-800 font-medium underline underline-offset-4">
                プライバシーポリシー
              </Link>
              <Link href="/app-privacy" className="text-blue-600 hover:text-blue-800 font-medium underline underline-offset-4">
                アプリプライバシーポリシー
              </Link>
            </div>
          </section>

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
