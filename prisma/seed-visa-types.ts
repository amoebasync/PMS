import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const visaTypes = [
  // 永住・定住系
  { name: '永住者',               sortOrder: 1 },
  { name: '特別永住者',           sortOrder: 2 },
  { name: '日本人の配偶者等',     sortOrder: 3 },
  { name: '永住者の配偶者等',     sortOrder: 4 },
  { name: '定住者',               sortOrder: 5 },
  { name: '家族滞在',             sortOrder: 6 },
  // 就労系
  { name: '技術・人文知識・国際業務', sortOrder: 10 },
  { name: '特定技能1号',          sortOrder: 11 },
  { name: '特定技能2号',          sortOrder: 12 },
  { name: '高度専門職1号',        sortOrder: 13 },
  { name: '高度専門職2号',        sortOrder: 14 },
  { name: '経営・管理',           sortOrder: 15 },
  { name: '技能',                 sortOrder: 16 },
  { name: '介護',                 sortOrder: 17 },
  { name: '医療',                 sortOrder: 18 },
  // 技能実習
  { name: '技能実習1号',          sortOrder: 20 },
  { name: '技能実習2号',          sortOrder: 21 },
  { name: '技能実習3号',          sortOrder: 22 },
  // 特定活動
  { name: '特定活動（ワーキングホリデー）', sortOrder: 30 },
  { name: '特定活動（その他）',   sortOrder: 31 },
  // その他
  { name: '留学',                 sortOrder: 40 },
  { name: '短期滞在',             sortOrder: 50 },
  { name: '文化活動',             sortOrder: 60 },
];

async function main() {
  let count = 0;
  for (const vt of visaTypes) {
    await prisma.visaType.upsert({
      where: { name: vt.name },
      update: { sortOrder: vt.sortOrder },
      create: vt,
    });
    count++;
  }
  console.log(`✅ VisaType: ${count} records upserted`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
