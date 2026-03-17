/**
 * 交通費（DistributorExpense）インポートスクリプト
 *
 * TSVファイルから過去の交通費データをインポートする
 *
 * Usage: npx tsx scripts/import-expenses.ts
 *
 * TSV columns: Branch, Staff ID, Name, Date, ToOffice, ToArea, ToHome, Total
 *
 * - 日付が空/無効な行はスキップ
 * - Total が 0 の行はスキップ
 * - staffId で FlyerDistributor を検索し、見つからない場合はスキップ
 * - status = 'APPROVED'（過去の確定済みデータ）
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExpenseRow {
  branch: string;
  staffId: string;
  name: string;
  date: string;
  toOffice: number;
  toArea: number;
  toHome: number;
  total: number;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const trimmed = dateStr.trim();
  // Check if it matches YYYY-MM-DD pattern
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(trimmed + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return d;
}

async function main() {
  const tsvPath = path.join(__dirname, 'expense-data.tsv');

  if (!fs.existsSync(tsvPath)) {
    console.error('TSVファイルが見つかりません:', tsvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(tsvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');

  // Skip header
  const dataLines = lines.slice(1);
  console.log(`Total lines: ${dataLines.length}`);

  // Parse all rows
  const rows: ExpenseRow[] = [];
  let skippedNoDate = 0;
  let skippedZeroTotal = 0;
  let skippedInvalidDate = 0;

  for (const line of dataLines) {
    const cols = line.split('\t');
    if (cols.length < 8) continue;

    const [branch, staffId, name, dateStr, toOfficeStr, toAreaStr, toHomeStr, totalStr] = cols;
    const total = parseInt(totalStr, 10) || 0;

    if (total === 0) {
      skippedZeroTotal++;
      continue;
    }

    const date = parseDate(dateStr);
    if (!date) {
      if (!dateStr || dateStr.trim() === '') {
        skippedNoDate++;
      } else {
        skippedInvalidDate++;
      }
      continue;
    }

    rows.push({
      branch: branch.trim(),
      staffId: staffId.trim(),
      name: name.trim(),
      date: dateStr.trim(),
      toOffice: parseInt(toOfficeStr, 10) || 0,
      toArea: parseInt(toAreaStr, 10) || 0,
      toHome: parseInt(toHomeStr, 10) || 0,
      total,
    });
  }

  console.log(`Valid rows to import: ${rows.length}`);
  console.log(`Skipped (no date): ${skippedNoDate}`);
  console.log(`Skipped (invalid date): ${skippedInvalidDate}`);
  console.log(`Skipped (zero total): ${skippedZeroTotal}`);

  // Get unique staffIds
  const staffIds = [...new Set(rows.map(r => r.staffId))];
  console.log(`Unique staff IDs: ${staffIds.length}`);

  // Lookup distributors by staffId
  const distributors = await prisma.flyerDistributor.findMany({
    where: { staffId: { in: staffIds } },
    select: { id: true, staffId: true, name: true },
  });

  const distributorMap = new Map<string, number>();
  for (const d of distributors) {
    if (d.staffId) {
      distributorMap.set(d.staffId, d.id);
    }
  }

  console.log(`Matched distributors: ${distributorMap.size} / ${staffIds.length}`);

  // Show unmatched
  const unmatched = staffIds.filter(id => !distributorMap.has(id));
  if (unmatched.length > 0) {
    console.log('Unmatched staff IDs:', unmatched.join(', '));
  }

  // Check for existing expenses to avoid duplicates
  const existingCount = await prisma.distributorExpense.count({
    where: {
      description: { startsWith: '交通費' },
      status: 'APPROVED',
    },
  });

  if (existingCount > 0) {
    console.log(`\n⚠️  既に ${existingCount} 件の交通費レコードが存在します。`);
    console.log('重複を避けるため、既存データを確認してください。');
    console.log('続行するには FORCE=1 npx tsx scripts/import-expenses.ts を実行してください。');
    if (!process.env.FORCE) {
      await prisma.$disconnect();
      process.exit(0);
    }
  }

  // Create expenses in batches
  let created = 0;
  let skippedNoDistributor = 0;
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const createData = [];

    for (const row of batch) {
      const distributorId = distributorMap.get(row.staffId);
      if (!distributorId) {
        skippedNoDistributor++;
        continue;
      }

      const parts: string[] = [];
      if (row.toOffice > 0) parts.push(`事務所: ¥${row.toOffice}`);
      if (row.toArea > 0) parts.push(`エリア: ¥${row.toArea}`);
      if (row.toHome > 0) parts.push(`帰宅: ¥${row.toHome}`);
      const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';

      createData.push({
        distributorId,
        date: new Date(row.date + 'T00:00:00Z'),
        amount: row.total,
        description: `交通費${breakdown}`,
        status: 'APPROVED',
      });
    }

    if (createData.length > 0) {
      await prisma.distributorExpense.createMany({ data: createData });
      created += createData.length;
    }

    if ((i + batchSize) % 500 === 0 || i + batchSize >= rows.length) {
      console.log(`Progress: ${Math.min(i + batchSize, rows.length)} / ${rows.length} (created: ${created})`);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Created: ${created}`);
  console.log(`Skipped (no distributor match): ${skippedNoDistributor}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
