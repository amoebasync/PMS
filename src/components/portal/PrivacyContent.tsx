import React from 'react';

export default function PrivacyContent() {
  return (
    <div className="space-y-6 text-sm leading-loose text-slate-700">
      <p>
        株式会社KP（以下、「当社」といいます）は、印刷、配布等のサービス（以下、「本サービス」といいます）を営む企業として、個人情報の保護に関する法律に規定される「個人情報」を適正に取り扱っております。本サービスにおける個人情報の取り扱いについて、以下のとおりお知らせいたします。
      </p>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">1. 個人情報の取扱事業者の名称等</h4>
        <p>
          株式会社KP<br />
          〒104-0061 東京都中央区銀座一丁目22番11号 銀座大竹ビジデンス 2F<br />
          代表取締役　金 鍵煕
        </p>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">2. 個人情報の取得</h4>
        <p>当社が皆様の個人情報を利用する際は、事前に明示した利用目的の範囲内でのみ利用します。目的外利用を行わないために、適切な管理措置を講じ、目的外利用を行う場合は、その目的を明らかにし、あらかじめ対象者より承諾をいただきます。</p>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">3. 個人情報の利用目的</h4>
        <p className="mb-2">当社が事業活動において取得し、または保有する個人情報の利用目的は、次のとおりといたします。</p>
        <ul className="list-disc pl-5 space-y-2 bg-slate-50 p-6 rounded-xl border border-slate-100">
          <li>
            <strong>本サービスのユーザーの皆様に関する情報（氏名、連絡先等）</strong><br/>
            本サービスのお問合せ等への対応、本サービスの提供（本人認証、通知等を含む）、利用状況の集計・分析、マーケティング目的での利用（電子メールマガジンの配信等）
          </li>
          <li>
            <strong>本サービスのお客様から提供された情報（製品の配送先情報、入稿データ等）</strong><br/>
            本サービスの提供（印刷・配布手配等）、利用状況の集計・分析
          </li>
        </ul>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">4. 個人情報の管理と安全管理措置</h4>
        <p>取得した個人情報に関しては、適切な対策を施し、個人情報の不正取得や、紛失、改ざん、漏洩などが起こらないよう、技術面、組織面で安全管理措置を講じ、滅失又はき損の防止及び是正に取り組みます。</p>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">5. 個人情報の任意性</h4>
        <p>当社が運営する本サービスの提供において、それぞれ必要となる情報項目を入力いただけない場合は、当社が運営する本サービスを受けられない場合があります。</p>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">6. 個人情報の第三者への情報提供</h4>
        <p className="mb-2">当社では、個人情報を提供された皆様の同意を得ずに個人情報を第三者に提供することはありません。ただし、以下の場合は、本人の同意なく皆様の個人情報を提供することがあります。</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>法律の定めにより、国、地方自治体、裁判所、警察その他法律で定められた権限を持つ機関より要請があった場合</li>
          <li>人の生命、身体又は財産の保護のために必要がある場合であって、本人の同意を得ることが困難である場合</li>
          <li>利用目的の達成に必要な範囲内において、個人情報取扱業務を、機密保持を含む契約を締結した第三者へ委託する場合（印刷・ポスティング手配のパートナー企業等）</li>
          <li>当社に対して支払うべき料金の決済を行うために、金融機関や決済代行業者に提供する場合</li>
        </ol>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">7. 委託先の監督</h4>
        <p>当社は、個人情報の取り扱いの全部又は一部を委託する場合がございます。取り扱いを委託する場合には、委託先と機密保持を含む契約を締結し、委託先において個人情報の安全管理が図られるよう、必要かつ適切な監督を行います。</p>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">8. 開示対象個人情報の「開示等の求め」に応じる手続き等</h4>
        <p>当社は、皆様から利用目的の通知、開示、内容の訂正、追加又は削除、利用の停止、消去及び、第三者への提供の停止を求められた場合、個人情報保護法において保護される範囲内において、遅滞なくこれに応じます。お申し出をされる場合は、当社の個人情報に関するお問合せ窓口までご連絡ください。</p>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-slate-800 pl-2">9. 個人情報に関するお問合せ窓口</h4>
        <div className="bg-slate-100 p-5 rounded-xl text-center mt-2">
          <p className="font-bold text-slate-800 mb-1">株式会社KP 個人情報保護相談窓口</p>
          <p>Email: info@tiramis.co.jp</p>
          <p className="text-xs text-slate-500 mt-2">（受付時間：10:00～17:00 / 土・日・祝日・年末年始を除く）</p>
        </div>
      </section>

      <div className="pt-8 text-right text-slate-500 font-bold">
        <p>制定日：2022年10月1日</p>
        <p>株式会社KP</p>
      </div>
    </div>
  );
}