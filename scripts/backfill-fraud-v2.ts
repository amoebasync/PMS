/**
 * V2不正検知分析バックフィルスクリプト
 *
 * v2Detail が null の既存 fraud_analyses に対して v2 分析を実行する。
 *
 * 使い方（本番EC2）:
 *   cd ~/pms_java && npx tsx scripts/backfill-fraud-v2.ts [since-date]
 *   例: npx tsx scripts/backfill-fraud-v2.ts 2026-03-01
 */

import { prisma } from '../src/lib/prisma';
import { analyzeV2Indicators } from '../src/lib/fraud-analysis';

async function main() {
  const sinceDate = process.argv[2] || '2026-03-01';
  console.log(`Backfilling v2 from: ${sinceDate}`);

  // v2Detail が null でセッションが存在するレコードを取得
  const targets = await prisma.fraudAnalysis.findMany({
    where: {
      v2Detail: null,
      sessionId: { not: null },
      createdAt: { gte: new Date(sinceDate) },
    },
    select: { id: true, sessionId: true, scheduleId: true },
  });

  console.log(`Found ${targets.length} fraud analyses without v2Detail`);

  let success = 0;
  let failed = 0;

  for (const fa of targets) {
    if (!fa.sessionId) continue;
    try {
      await analyzeV2Indicators(fa.sessionId);
      success++;
      console.log(`[OK] session=${fa.sessionId} schedule=${fa.scheduleId}`);
    } catch (e: any) {
      failed++;
      console.error(`[FAIL] session=${fa.sessionId}: ${e.message}`);
    }
  }

  const withV2 = await prisma.fraudAnalysis.count({ where: { v2Detail: { not: null } } });
  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
  console.log(`Total with v2Detail: ${withV2}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
