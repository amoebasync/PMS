import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const methods = [
  { name: '軒並み配布', capacityType: 'all',       priceAddon: 0.0, sortOrder: 10 },
  { name: '戸建限定',   capacityType: 'detached',  priceAddon: 0.0, sortOrder: 20 },
  { name: '集合住宅限定', capacityType: 'apartment', priceAddon: 0.0, sortOrder: 30 },
];

async function main() {
  for (const m of methods) {
    await prisma.distributionMethod.upsert({
      where: { name: m.name },
      update: {},
      create: m,
    });
    console.log(`✓ ${m.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
