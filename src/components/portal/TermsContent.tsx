import React from 'react';

export default function TermsContent() {
  return (
    <div className="space-y-6 text-sm leading-loose text-slate-700">
      <p>
        本利用規約（以下「本規約」といいます。）は、株式会社KP（以下「当社」といいます。）が提供する、印刷、配布等のサービス（以下総称して「本サービス」といいます。）の利用条件及び本サービスの利用者と当社との間の権利義務関係について定められています。本サービスの利用に際しては、本規約の全文をお読みいただいた上で、本規約に同意していただく必要があります。
      </p>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-indigo-500 pl-2">第1条（目的及び適用）</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li>本規約は、本サービスの利用条件及び本サービスの利用に関する当社と「ユーザー」との間の権利義務関係を定めることを目的とし、当社とユーザーとの間の本サービスの利用にかかる一切の関係に適用されます。</li>
          <li>当社が当社ウェブサイト上に掲載する本サービス利用に関するルール及びガイドラインは、本規約の一部を構成するものとします。</li>
        </ol>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-indigo-500 pl-2">第2条（定義）</h4>
        <p className="mb-2">本規約において使用する以下の用語は、それぞれ以下に定める意味を有するものとします。</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>「アカウント情報」とは、本サービスにおいてユーザーが使用するメールアドレス、及びパスワードを意味します。</li>
          <li>「印刷サービス」とは、本サービスのうち、ユーザーが入稿した印刷データを当社が用意する商品仕様の中からユーザーが選択した内容で印刷・加工し、ユーザーが指定する場所に配送または配布するサービスを意味します。</li>
          <li>「印刷データ」とは、印刷サービスの対象となる原稿のことを意味します。</li>
          <li>「配布手配サービス」とは、本サービスのうち、印刷サービスで印刷した印刷物を、ポスティング等の方法でユーザーの指定した範囲の地域に配布するサービスを意味します。</li>
          <li>「パートナー企業」とは、当社がユーザーに対して本サービスの提供を行うための補助者として、当社との間で本サービスに関する契約を締結した個人又は法人を意味します。</li>
        </ol>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-indigo-500 pl-2">第3条（本サービスの内容及び当社の役割）</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li>本サービスの提供に当たって、当社は、自らの裁量で本サービスの一部の実施をパートナー企業等に委託することができ、ユーザーは、当社が、ユーザーに対する本サービスの一部をパートナー企業その他の第三者に委託することを予め承諾し、一切の異議を述べることができないものとします。</li>
          <li>当社は、本サービスにおいて提供する商品、サービスその他の情報等の内容について、予告なく変更することがあります。</li>
        </ol>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-indigo-500 pl-2">第4条（権利帰属等）</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li>当社ウェブサイト及び本サービスに関する知的財産権は全て当社又は当社にライセンスを許諾している者に帰属しています。</li>
          <li>ユーザーが入稿した印刷データに関する知的財産権については、ユーザー又はユーザーに当該権利を許諾した第三者に帰属するものとし、ユーザーは、当社に対し、本サービスの提供に必要な範囲で、当該印刷データの利用を無償で許諾するものとします。</li>
          <li>ユーザーは、当該印刷データの利用が第三者の知的財産権、肖像権、プライバシー権、名誉権その他一切の権利を侵害しないことを、当社に対して表明し、及び保証するものとします。</li>
        </ol>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-indigo-500 pl-2">第5条（個別契約の成立手続等）</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li>ユーザーは、当社ウェブサイトを通じて契約条件及び料金を確認した上で、個別契約の申込みを行うことができるものとします。当社がユーザーに対して注文内容の確認通知を行った時をもって成立するものとします。</li>
          <li>個別契約における入稿等の作業完了を当社が確認した時点で、当社は、ユーザーに対して受付日確定通知を行い、当該個別契約における具体的なサービス内容を確定させるものとし、当該受付日確定通知の時点以降、ユーザーはその理由にかかわらず、当該個別契約をシステム上から解除することができないものとします。</li>
        </ol>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-indigo-500 pl-2">第6条（禁止事項）</h4>
        <p className="mb-2">ユーザーは、本サービスの利用に当たり、以下の各号のいずれかに該当する行為をしてはなりません。</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>法令に違反する行為又は犯罪行為に関連する行為</li>
          <li>公序良俗に反する行為</li>
          <li>当社、パートナー企業、その他の第三者の知的財産権、肖像権、プライバシー権、名誉権その他の権利又は利益を侵害する行為</li>
          <li>本サービスのネットワーク又はシステム等に過度な負荷をかける行為</li>
          <li>第三者に成りすます行為</li>
          <li>反社会的勢力等への利益供与</li>
        </ol>
      </section>

      <section>
        <h4 className="font-black text-slate-800 text-base mb-2 border-l-4 border-indigo-500 pl-2">第7条（準拠法及び管轄裁判所）</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li>本規約の準拠法は日本法とします。</li>
          <li>本規約に起因し、又はこれらに関連する一切の紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
        </ol>
      </section>

      <div className="pt-8 text-right text-slate-500 font-bold">
        <p>制定日：2022年10月1日</p>
        <p>株式会社KP</p>
      </div>
    </div>
  );
}