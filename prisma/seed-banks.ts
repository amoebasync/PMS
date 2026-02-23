import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const banks = [
  // メガバンク
  { code: '0001', name: 'みずほ銀行',            nameKana: 'ミズホギンコウ',         sortOrder: 1 },
  { code: '0005', name: '三菱UFJ銀行',            nameKana: 'ミツビシユーエフジェイギンコウ', sortOrder: 2 },
  { code: '0009', name: '三井住友銀行',           nameKana: 'ミツイスミトモギンコウ',  sortOrder: 3 },
  { code: '0010', name: 'りそな銀行',             nameKana: 'リソナギンコウ',          sortOrder: 4 },
  { code: '0017', name: '埼玉りそな銀行',         nameKana: 'サイタマリソナギンコウ',  sortOrder: 5 },
  // ゆうちょ・郵便
  { code: '9900', name: 'ゆうちょ銀行',           nameKana: 'ユウチョギンコウ',        sortOrder: 6 },
  // 地方銀行（主要）
  { code: '0138', name: '横浜銀行',               nameKana: 'ヨコハマギンコウ',        sortOrder: 20 },
  { code: '0134', name: '千葉銀行',               nameKana: 'チバギンコウ',            sortOrder: 21 },
  { code: '0149', name: '静岡銀行',               nameKana: 'シズオカギンコウ',        sortOrder: 22 },
  { code: '0128', name: '常陽銀行',               nameKana: 'ジョウヨウギンコウ',      sortOrder: 23 },
  { code: '0157', name: '八十二銀行',             nameKana: 'ハチジュウニギンコウ',    sortOrder: 24 },
  { code: '0177', name: '福岡銀行',               nameKana: 'フクオカギンコウ',        sortOrder: 25 },
  { code: '0178', name: '西日本シティ銀行',       nameKana: 'ニシニホンシティギンコウ', sortOrder: 26 },
  { code: '0159', name: '関西みらい銀行',         nameKana: 'カンサイミライギンコウ',  sortOrder: 27 },
  { code: '0173', name: '広島銀行',               nameKana: 'ヒロシマギンコウ',        sortOrder: 28 },
  { code: '0532', name: '東京東信用金庫',         nameKana: 'トウキョウヒガシシンヨウキンコ', sortOrder: 40 },
  // ネット銀行
  { code: '0033', name: 'PayPay銀行',             nameKana: 'ペイペイギンコウ',        sortOrder: 50 },
  { code: '0036', name: '楽天銀行',               nameKana: 'ラクテンギンコウ',        sortOrder: 51 },
  { code: '0038', name: '住信SBIネット銀行',      nameKana: 'スミシンエスビーアイネットギンコウ', sortOrder: 52 },
  { code: '0039', name: 'auじぶん銀行',           nameKana: 'エーユージブンギンコウ',  sortOrder: 53 },
  { code: '0310', name: 'GMOあおぞらネット銀行',  nameKana: 'ジーエムオーアオゾラネットギンコウ', sortOrder: 54 },
  { code: '0040', name: 'イオン銀行',             nameKana: 'イオンギンコウ',          sortOrder: 55 },
  { code: '0034', name: 'セブン銀行',             nameKana: 'セブンギンコウ',          sortOrder: 56 },
];

async function main() {
  let count = 0;
  for (const bank of banks) {
    await prisma.bank.upsert({
      where: { code: bank.code },
      update: { name: bank.name, nameKana: bank.nameKana, sortOrder: bank.sortOrder },
      create: bank,
    });
    count++;
  }
  console.log(`✅ Bank: ${count} records upserted`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
