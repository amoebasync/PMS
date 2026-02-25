require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const region = process.env.AWS_REGION || 'ap-northeast-1';
const bucket = process.env.AWS_S3_BUCKET || '';
const S3_PREFIX = `https://${bucket}.s3.${region}.amazonaws.com/`;

function toProxyUrl(s3Url) {
  if (!s3Url) return s3Url;
  if (s3Url.startsWith('/api/s3-proxy')) return s3Url;
  const key = s3Url.startsWith(S3_PREFIX) ? s3Url.slice(S3_PREFIX.length) : s3Url;
  return '/api/s3-proxy?key=' + encodeURIComponent(key);
}

async function main() {
  // employee.avatarUrl
  const employees = await prisma.employee.findMany({
    select: { id: true, avatarUrl: true },
    where: { avatarUrl: { startsWith: 'https://' } }
  });
  for (const e of employees) {
    const newUrl = toProxyUrl(e.avatarUrl);
    await prisma.employee.update({ where: { id: e.id }, data: { avatarUrl: newUrl } });
    console.log('employee', e.id, '->', newUrl);
  }

  // flyerDistributor.avatarUrl
  const dists = await prisma.flyerDistributor.findMany({
    select: { id: true, avatarUrl: true },
    where: { avatarUrl: { startsWith: 'https://' } }
  });
  for (const d of dists) {
    const newUrl = toProxyUrl(d.avatarUrl);
    await prisma.flyerDistributor.update({ where: { id: d.id }, data: { avatarUrl: newUrl } });
    console.log('distributor', d.id, '->', newUrl);
  }

  // orderPrinting.frontDesignUrl
  const fronts = await prisma.orderPrinting.findMany({
    select: { id: true, frontDesignUrl: true },
    where: { frontDesignUrl: { startsWith: 'https://' } }
  });
  for (const p of fronts) {
    const newUrl = toProxyUrl(p.frontDesignUrl);
    await prisma.orderPrinting.update({ where: { id: p.id }, data: { frontDesignUrl: newUrl } });
    console.log('printing.front', p.id, '->', newUrl);
  }

  // orderPrinting.backDesignUrl
  const backs = await prisma.orderPrinting.findMany({
    select: { id: true, backDesignUrl: true },
    where: { backDesignUrl: { startsWith: 'https://' } }
  });
  for (const p of backs) {
    const newUrl = toProxyUrl(p.backDesignUrl);
    await prisma.orderPrinting.update({ where: { id: p.id }, data: { backDesignUrl: newUrl } });
    console.log('printing.back', p.id, '->', newUrl);
  }

  console.log('\n✅ DB更新完了');
}

main().catch(console.error).finally(() => prisma.$disconnect());
