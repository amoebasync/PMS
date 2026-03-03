import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: '配布員',     icon: 'bi-bicycle',        colorCls: 'bg-blue-100 text-blue-700',     sortOrder: 10 },
  { name: '現場',       icon: 'bi-truck',           colorCls: 'bg-green-100 text-green-700',   sortOrder: 20 },
  { name: '営業',       icon: 'bi-briefcase-fill',  colorCls: 'bg-amber-100 text-amber-700',   sortOrder: 30 },
  { name: 'システム',   icon: 'bi-gear-fill',       colorCls: 'bg-slate-100 text-slate-700',   sortOrder: 40 },
  { name: 'アドミン',   icon: 'bi-shield-check',    colorCls: 'bg-purple-100 text-purple-700', sortOrder: 50 },
];

async function main() {
  for (const cat of CATEGORIES) {
    const existing = await prisma.alertCategory.findFirst({
      where: { name: cat.name },
    });
    if (existing) {
      console.log(`既存スキップ: ${cat.name}`);
      continue;
    }
    await prisma.alertCategory.create({ data: { ...cat, isActive: true } });
    console.log(`作成: ${cat.name}`);
  }
  console.log('アラートカテゴリのシード完了');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
