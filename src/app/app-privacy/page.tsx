'use client';

import React, { useState, useEffect } from 'react';

export default function AppPrivacyPage() {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/legal-content?key=appPrivacyPolicy')
      .then(res => res.json())
      .then(data => { if (data.content) setHtmlContent(data.content); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

        <div className="bg-slate-800 px-8 py-10 text-center">
          <p className="text-slate-400 text-xs font-medium tracking-widest uppercase mb-2">PMS Posting App</p>
          <h1 className="text-3xl font-black text-white tracking-widest mb-2">プライバシーポリシー</h1>
          <p className="text-slate-300 text-sm font-medium">個人情報の取り扱いについて</p>
        </div>

        {htmlContent ? (
          <div
            className="legal-content p-8 md:p-12 space-y-8 text-sm leading-loose text-slate-700"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <div className="p-8 md:p-12 space-y-8 text-sm leading-loose text-slate-700">

            <p>
              株式会社ティラミス（以下、「当社」といいます）は、配布業務管理アプリ「PMS Posting App」（以下、「本アプリ」といいます）において、以下のとおり個人情報を取り扱います。
            </p>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                1. 個人情報取扱事業者
              </h2>
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-1">
                <p className="font-bold text-slate-800">株式会社ティラミス</p>
                <p>〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F</p>
                <p>代表取締役　金 鍵煕</p>
                <p>Email：info@tiramis.co.jp</p>
              </div>
            </section>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                2. 収集する情報
              </h2>
              <p className="mb-3">本アプリは、配布業務の管理を目的として、以下の情報を収集します。</p>
              <ul className="space-y-3 bg-slate-50 rounded-xl border border-slate-100 p-5">
                <li className="flex gap-3">
                  <span className="text-slate-400 font-bold shrink-0">●</span>
                  <div>
                    <span className="font-bold text-slate-800">位置情報（GPS）</span><br />
                    配布作業中（STARTからFINISHまで）の現在地を、バックグラウンドを含めて取得します。配布作業外では位置情報を取得しません。配布ルートの記録、リアルタイムの位置報告、配布禁止物件への接近警告（50m以内）の目的にのみ使用します。
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-slate-400 font-bold shrink-0">●</span>
                  <div>
                    <span className="font-bold text-slate-800">モーション・フィットネスデータ</span><br />
                    配布作業中の歩数、歩行距離、消費カロリーを計測します。業務実績の記録にのみ使用します。
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-slate-400 font-bold shrink-0">●</span>
                  <div>
                    <span className="font-bold text-slate-800">電話番号</span><br />
                    スタッフ認証のために使用します。
                  </div>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                3. 情報の利用目的
              </h2>
              <p className="mb-3">収集した情報は、当社の業務管理サーバーに送信され、以下の目的にのみ使用します。</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>配布スタッフの本人認証および業務管理</li>
                <li>配布作業の進捗管理および実績記録</li>
                <li>業務上の安全確認および緊急時の対応</li>
              </ul>
              <p className="mt-3 text-slate-600 bg-blue-50 border border-blue-100 rounded-xl p-4">
                収集した情報は業務管理の目的以外には使用しません。また、法令に基づく場合を除き、第三者に提供することはありません。
              </p>
            </section>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                4. 情報の管理
              </h2>
              <p>
                収集した個人情報は、適切なセキュリティ対策を講じたサーバーにて管理します。不正アクセス・紛失・改ざん・漏洩を防止するために、技術的・組織的な安全管理措置を実施します。
              </p>
            </section>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                5. 情報の保存期間
              </h2>
              <p>
                収集した情報は、業務上必要な期間のみ保存し、不要になった時点で適切な方法により削除します。
              </p>
            </section>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                6. 位置情報の取得について
              </h2>
              <p>
                位置情報の取得は、ご利用のスマートフォンの設定からいつでも無効にすることができます。ただし、位置情報を無効にした場合、本アプリの一部機能が使用できなくなる場合があります。
              </p>
            </section>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                7. プライバシーポリシーの変更
              </h2>
              <p>
                当社は、法令の改正や業務内容の変更等に伴い、本ポリシーを改定することがあります。改定した場合は、本アプリまたは当社ウェブサイトにて通知します。
              </p>
            </section>

            <section>
              <h2 className="font-black text-slate-800 text-base mb-3 border-l-4 border-slate-800 pl-3">
                8. お問い合わせ
              </h2>
              <div className="bg-slate-100 p-5 rounded-xl text-center">
                <p className="font-bold text-slate-800 mb-2">株式会社ティラミス 個人情報保護相談窓口</p>
                <p>Email：info@tiramis.co.jp</p>
                <p className="text-xs text-slate-500 mt-2">（受付時間：10:00〜17:00 / 土・日・祝日・年末年始を除く）</p>
              </div>
            </section>

            <div className="pt-4 text-right text-slate-500 font-bold text-xs">
              <p>制定日：2024年1月1日</p>
              <p className="mt-1">株式会社ティラミス</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
