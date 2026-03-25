import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseDate(dateStr: string): string | null {
  // "2025/9/1" → "2025-09-01"
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const d = parseInt(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface FeeRow {
  timestamp: string;
  branch: string;
  staffId: string;
  name: string;
  date: string; // YYYY-MM-DD
  toOffice: number;
  toArea: number;
  toHome: number;
  total: number;
}

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const csvPath = args[0] || '/Users/kuenheekim/Downloads/transportation_fee.csv';
  const dryRun = process.argv.includes('--dry-run');

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  // Parse CSV - transportation fee rows only (numeric values in col 6-9)
  const rows: FeeRow[] = [];
  let skippedNoDate = 0;
  let skippedZero = 0;
  let skippedShiftData = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 9) continue;

    // Skip shift data (col 6 is TRUE/FALSE)
    if (cols[5] === 'TRUE' || cols[5] === 'FALSE') {
      skippedShiftData++;
      continue;
    }

    // Parse numeric fields
    const toOffice = parseInt(cols[5]) || 0;
    const toArea = parseInt(cols[6]) || 0;
    const toHome = parseInt(cols[7]) || 0;
    const total = parseInt(cols[8]) || 0;

    // Skip if all zero or no numeric data
    if (total === 0 && toOffice === 0 && toArea === 0 && toHome === 0) {
      skippedZero++;
      continue;
    }

    // Parse date
    const date = parseDate(cols[4]);
    if (!date) {
      skippedNoDate++;
      continue;
    }

    rows.push({
      timestamp: cols[0],
      branch: cols[1],
      staffId: cols[2],
      name: cols[3],
      date,
      toOffice,
      toArea,
      toHome,
      total,
    });
  }

  console.log(`CSV parsed: ${rows.length} valid rows`);
  console.log(`  Skipped: ${skippedShiftData} shift data, ${skippedNoDate} no date, ${skippedZero} zero total`);

  // Get all distributors
  const distributors = await prisma.flyerDistributor.findMany({
    select: { id: true, staffId: true, name: true },
  });
  const staffIdMap = new Map<string, number>();
  for (const d of distributors) {
    staffIdMap.set(d.staffId, d.id);
  }

  // Group by (staffId, date) → keep latest timestamp
  const grouped = new Map<string, FeeRow>();
  for (const row of rows) {
    const key = `${row.staffId}|${row.date}`;
    const existing = grouped.get(key);
    if (!existing || row.timestamp > existing.timestamp) {
      grouped.set(key, row);
    }
  }
  console.log(`After dedup: ${grouped.size} unique (staffId, date) entries`);

  // Check existing expenses
  const existingExpenses = await prisma.distributorExpense.findMany({
    select: { distributorId: true, date: true },
  });
  const existingSet = new Set<string>();
  for (const e of existingExpenses) {
    existingSet.add(`${e.distributorId}|${e.date.toISOString().split('T')[0]}`);
  }
  console.log(`Existing expenses in DB: ${existingExpenses.length}`);

  // Prepare inserts
  const toInsert: { distributorId: number; date: Date; amount: number; description: string }[] = [];
  const unmatchedStaffIds = new Set<string>();
  let skippedExisting = 0;

  for (const [, row] of grouped) {
    const distributorId = staffIdMap.get(row.staffId);
    if (!distributorId) {
      unmatchedStaffIds.add(`${row.staffId} (${row.name})`);
      continue;
    }

    const dateObj = new Date(row.date + 'T00:00:00.000Z');
    if (existingSet.has(`${distributorId}|${row.date}`)) {
      skippedExisting++;
      continue;
    }

    const parts: string[] = [];
    if (row.toOffice) parts.push(`事務所: ¥${row.toOffice}`);
    if (row.toArea) parts.push(`現場: ¥${row.toArea}`);
    if (row.toHome) parts.push(`帰宅: ¥${row.toHome}`);
    const description = parts.join(' / ');

    toInsert.push({
      distributorId,
      date: dateObj,
      amount: row.total,
      description,
    });
  }

  console.log('\n--- Summary ---');
  console.log(`To insert: ${toInsert.length}`);
  console.log(`Skipped (already exists): ${skippedExisting}`);
  if (unmatchedStaffIds.size > 0) {
    console.log(`Unmatched staff IDs (${unmatchedStaffIds.size}):`);
    for (const id of [...unmatchedStaffIds].sort()) {
      console.log(`  - ${id}`);
    }
  }

  if (toInsert.length === 0) {
    console.log('\nNothing to insert.');
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    // Show sample
    console.log(`\nSample (first 10):`);
    for (const item of toInsert.slice(0, 10)) {
      const d = distributors.find(d => d.id === item.distributorId);
      console.log(`  ${d?.staffId} ${d?.name}: ${item.date.toISOString().split('T')[0]} ¥${item.amount} (${item.description})`);
    }
    console.log('\n[DRY RUN] No changes made.');
    await prisma.$disconnect();
    return;
  }

  // Bulk insert
  const BATCH_SIZE = 500;
  let created = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const result = await prisma.distributorExpense.createMany({
      data: batch.map(r => ({
        distributorId: r.distributorId,
        date: r.date,
        amount: r.amount,
        description: r.description,
        status: 'APPROVED',
      })),
      skipDuplicates: true,
    });
    created += result.count;
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${result.count}`);
  }

  console.log(`\nDone! Total inserted: ${created}`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
