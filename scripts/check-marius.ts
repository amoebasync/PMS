import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const marius = await prisma.flyerDistributor.findFirst({
    where: { OR: [{ name: { contains: 'Marius' } }, { name: { contains: 'marius' } }] },
    select: { id: true, name: true, staffId: true }
  });
  console.log('Distributor:', marius);
  if (marius === null) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const schedules = await prisma.distributionSchedule.findMany({
    where: { distributorId: marius.id },
    orderBy: { date: 'desc' },
    take: 5,
    include: {
      items: { select: { id: true, flyerName: true, customerId: true, flyerCode: true } },
      area: { select: { id: true, town_name: true, chome_name: true } }
    }
  });

  console.log('Today schedules:', schedules.length);
  for (const s of schedules) {
    const areaName = s.area ? s.area.town_name + s.area.chome_name : 'none';
    console.log(`  Schedule #${s.id}: area=${areaName}, areaId=${s.areaId}`);
    for (const item of s.items) {
      console.log(`    Item #${item.id}: ${item.flyerName}, customerId=${item.customerId}, code=${item.flyerCode}`);
    }
    if (s.areaId) {
      const allProps = await prisma.prohibitedProperty.findMany({
        where: { areaId: s.areaId, isActive: true },
        select: { id: true, buildingName: true, customerId: true, address: true }
      });
      const withCust = allProps.filter(p => p.customerId !== null);
      const noCust = allProps.filter(p => p.customerId === null);
      console.log(`    Prohibited: total=${allProps.length}, 全顧客禁止=${noCust.length}, のみ禁止=${withCust.length}`);
      withCust.slice(0, 5).forEach(p => {
        console.log(`      のみ禁止: id=${p.id}, customerId=${p.customerId}, ${p.buildingName || p.address}`);
      });
    }
  }
}
main().catch(console.error).finally(() => process.exit());
