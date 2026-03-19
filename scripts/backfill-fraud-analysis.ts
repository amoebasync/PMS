/**
 * 不正検知分析バックフィルスクリプト
 *
 * fraud_analyses テーブルが空の状態で完了済みセッションに対して
 * 分析を実行し、結果をDBに保存する。
 *
 * 使い方（本番EC2）:
 *   cd ~/pms_java && npx tsx scripts/backfill-fraud-analysis.ts
 */

import { prisma } from '../src/lib/prisma';
import { analyzeFraudIndicators } from '../src/lib/fraud-analysis';

async function main() {
  const sessions = await prisma.distributionSession.findMany({
    where: {
      finishedAt: { not: null },
      fraudAnalysis: null,
    },
    orderBy: { finishedAt: 'desc' },
    select: { id: true, finishedAt: true, distributorId: true },
  });

  console.log(`Found ${sessions.length} sessions without fraud analysis`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      await analyzeFraudIndicators(session.id);
      success++;
      console.log(`[OK] session=${session.id} distributor=${session.distributorId} finished=${session.finishedAt?.toISOString()}`);
    } catch (e: any) {
      failed++;
      console.error(`[FAIL] session=${session.id}: ${e.message}`);
    }
  }

  // Check how many were actually saved (some may have been skipped by early return)
  const totalAnalyses = await prisma.fraudAnalysis.count();
  skipped = sessions.length - success - failed;

  console.log(`\nDone: ${success} succeeded, ${failed} failed, ${skipped} skipped (early return)`);
  console.log(`Total fraud_analyses in DB: ${totalAnalyses}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
