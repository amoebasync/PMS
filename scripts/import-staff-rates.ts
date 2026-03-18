/**
 * Posting System → PMS 配布員単価の一括インポートスクリプト（一度だけ実行）
 *
 * PMS に登録されている配布員の staffId をもとに、
 * Posting System の m_staff_salary_detail から 1種〜6種の単価を取得し、
 * PMS の FlyerDistributor.rate1Type〜rate6Type にインポートする。
 *
 * 使い方: npx tsx scripts/import-staff-rates.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const POSTING_SYSTEM_URL = 'https://postingsystem.net/postingmanage/GetStaffRatesV2.php';
const API_KEY = 'pms-posting-sync-2026';

interface StaffRate {
  staffCd: string;
  rate1: number | null;
  rate2: number | null;
  rate3: number | null;
  rate4: number | null;
  rate5: number | null;
  rate6: number | null;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('=== DRY RUN モード（実際のDB更新はしません）===\n');
  }

  // 1. PMS の全配布員を取得
  const distributors = await prisma.flyerDistributor.findMany({
    select: {
      id: true,
      staffId: true,
      name: true,
      rate1Type: true,
      rate2Type: true,
      rate3Type: true,
      rate4Type: true,
      rate5Type: true,
      rate6Type: true,
    },
  });

  console.log(`PMS 配布員数: ${distributors.length}`);

  if (distributors.length === 0) {
    console.log('配布員がいません。終了します。');
    return;
  }

  // 2. Posting System から単価を取得
  const staffCodes = distributors.map(d => d.staffId);
  console.log(`Posting System から単価を取得中... (${staffCodes.length}人)`);

  const response = await fetch(POSTING_SYSTEM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ staffCodes }),
  });

  if (!response.ok) {
    throw new Error(`Posting System API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as { success: boolean; count: number; data: StaffRate[] };

  if (!result.success) {
    throw new Error(`Posting System API returned error: ${JSON.stringify(result)}`);
  }

  console.log(`Posting System から ${result.count} 人分の単価を取得\n`);

  // 3. マッピング作成
  const rateMap = new Map<string, StaffRate>();
  for (const rate of result.data) {
    rateMap.set(rate.staffCd, rate);
  }

  // 4. インポート
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const dist of distributors) {
    const rate = rateMap.get(dist.staffId);

    if (!rate) {
      console.log(`  ✗ ${dist.staffId} (${dist.name}) — Posting System にデータなし`);
      notFound++;
      continue;
    }

    // 変更があるかチェック
    const hasChange =
      dist.rate1Type !== rate.rate1 ||
      dist.rate2Type !== rate.rate2 ||
      dist.rate3Type !== rate.rate3 ||
      dist.rate4Type !== rate.rate4 ||
      dist.rate5Type !== rate.rate5 ||
      dist.rate6Type !== rate.rate6;

    if (!hasChange) {
      console.log(`  - ${dist.staffId} (${dist.name}) — 変更なし`);
      skipped++;
      continue;
    }

    console.log(`  ✓ ${dist.staffId} (${dist.name}) — ${rate.rate1}/${rate.rate2}/${rate.rate3}/${rate.rate4}/${rate.rate5}/${rate.rate6}`);

    if (!isDryRun) {
      await prisma.flyerDistributor.update({
        where: { id: dist.id },
        data: {
          rate1Type: rate.rate1,
          rate2Type: rate.rate2,
          rate3Type: rate.rate3,
          rate4Type: rate.rate4,
          rate5Type: rate.rate5,
          rate6Type: rate.rate6,
        },
      });
    }

    updated++;
  }

  console.log(`\n=== 結果 ===`);
  console.log(`更新: ${updated}`);
  console.log(`変更なし: ${skipped}`);
  console.log(`Posting System にデータなし: ${notFound}`);
  console.log(`合計: ${distributors.length}`);

  if (isDryRun) {
    console.log('\n※ dry-run のため実際の更新はされていません。実行するには --dry-run を外してください。');
  }
}

main()
  .catch(e => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
