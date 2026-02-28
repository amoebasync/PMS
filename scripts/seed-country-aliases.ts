import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 主要な国の別名（エイリアス）データ
// カンマ区切りで複数の別名を登録。応募ページの国検索で日本語・英語両方でマッチするようになる。
const COUNTRY_ALIASES: Record<string, string> = {
  KR: '韓国,大韓民国,Republic of Korea,South Korea',
  GB: 'イギリス,英国,Britain,Great Britain,United Kingdom,UK',
  US: 'アメリカ,アメリカ合衆国,米国,America,United States of America,USA',
  CN: '中華人民共和国,People\'s Republic of China,PRC',
  TW: '中華民国,Republic of China,Taiwan',
  VN: 'ヴェトナム,越南,Viet Nam',
  PH: '比国,フィリピン共和国,Republic of the Philippines',
  BR: 'Brasil,ブラジル連邦共和国,Federative Republic of Brazil',
  NP: 'ネパール連邦民主共和国,Federal Democratic Republic of Nepal',
  MM: 'ビルマ,Burma,Republic of the Union of Myanmar',
  RU: 'ロシア連邦,Russian Federation',
  HK: 'ホンコン,Hong Kong SAR,Hong Kong',
  TH: 'タイ王国,Kingdom of Thailand,Siam',
  ID: 'インドネシア共和国,Republic of Indonesia',
  MY: 'マレー,Federation of Malaysia',
  SG: 'シンガポール共和国,Republic of Singapore',
  IN: 'インド共和国,Republic of India,Bharat',
  BD: 'バングラ,バングラデシュ人民共和国,People\'s Republic of Bangladesh',
  LK: 'セイロン,Ceylon,Democratic Socialist Republic of Sri Lanka',
  PK: 'パキスタン・イスラム共和国,Islamic Republic of Pakistan',
  AU: 'オーストラリア連邦,豪州,Commonwealth of Australia,Oz',
  NZ: 'ニュージーランド,新西蘭,Aotearoa',
  FR: '仏国,フランス共和国,French Republic',
  DE: '独国,ドイツ連邦共和国,Federal Republic of Germany',
  IT: '伊国,イタリア共和国,Italian Republic',
  ES: '西班牙,スペイン王国,Kingdom of Spain',
  PT: '葡萄牙,ポルトガル共和国,Portuguese Republic',
  CA: 'カナダ',
  MX: 'メキシコ合衆国,United Mexican States',
  PE: 'ペルー共和国,Republic of Peru',
  CO: 'コロンビア共和国,Republic of Colombia',
  AR: 'アルゼンチン共和国,Argentine Republic',
  KH: 'カンボジア王国,Kingdom of Cambodia,Kampuchea',
  LA: 'ラオス人民民主共和国,Lao People\'s Democratic Republic',
  MN: 'モンゴル国,Mongolia',
};

async function main() {
  console.log('🌍 国エイリアスデータの投入を開始します...\n');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    const country = await prisma.country.findFirst({
      where: { code },
    });

    if (!country) {
      console.log(`  ⚠️  ${code}: 国マスタに存在しません（スキップ）`);
      notFound++;
      continue;
    }

    if (country.aliases) {
      console.log(`  ⏭️  ${code} (${country.name}): 既にエイリアスが設定済み → "${country.aliases}"`);
      skipped++;
      continue;
    }

    await prisma.country.update({
      where: { id: country.id },
      data: { aliases },
    });

    console.log(`  ✅ ${code} (${country.name}): "${aliases}"`);
    updated++;
  }

  console.log(`\n📊 結果: 更新 ${updated} 件 / スキップ ${skipped} 件 / 未検出 ${notFound} 件`);
  console.log('🏁 完了');
}

main()
  .catch((e) => {
    console.error('❌ エラーが発生しました:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
