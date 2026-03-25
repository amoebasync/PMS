import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface CsvRow {
  timestamp: string;
  branch: string;
  name: string;
  weekStart: string;
  date: string;
  available: boolean;
  note: string;
}

function parseDate(dateStr: string): string {
  // "2025/9/1" → "2025-09-01"
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

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

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const csvPath = args[0] || '/Users/kuenheekim/Downloads/shift.csv';
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  // --week=YYYY-MM-DD,YYYY-MM-DD filter (matches WeekStart, comma-separated)
  const weekArg = process.argv.find(a => a.startsWith('--week='));
  const weekFilters = weekArg ? weekArg.split('=')[1].split(',') : null;

  // Parse CSV (skip header)
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 6 || !cols[3] || !cols[4]) continue;
    const weekParsed = parseDate(cols[3]);
    if (!weekParsed) continue;

    // Apply week filter if specified
    if (weekFilters) {
      if (!weekFilters.includes(weekParsed)) continue;
    }

    rows.push({
      timestamp: cols[0],
      branch: cols[1],
      name: cols[2],
      weekStart: cols[3],
      date: cols[4],
      available: cols[5] === 'TRUE',
      note: cols[6] || '',
    });
  }
  console.log(`CSV: ${rows.length} rows parsed${weekFilters ? ` (weeks: ${weekFilters.join(', ')})` : ''}`);

  // Get all distributors from DB
  const distributors = await prisma.flyerDistributor.findMany({
    select: { id: true, name: true, staffId: true },
  });
  console.log(`DB: ${distributors.length} distributors`);

  // CSV名 → DB名 のエイリアス（CSV側をDB側に合わせる）
  const nameAliases: Record<string, string> = {
    'yaël lezwijn': 'yael lezwijn',
    'ylva mathilda hansson': 'ylva hansson',
  };

  // Build name → id map (case-insensitive, trim)
  const nameMap = new Map<string, number>();
  for (const d of distributors) {
    nameMap.set(d.name.trim().toLowerCase(), d.id);
  }

  // Group CSV by (name, weekStart) → keep last submission per week (latest timestamp)
  // Each group has 7 days
  const grouped = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = `${row.name}|||${row.weekStart}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }
  console.log(`Grouped: ${grouped.size} distributor-weeks`);

  // For each group, keep only the latest submission (by timestamp)
  // If same person submitted multiple times for the same week, use the latest
  const finalGroups = new Map<string, CsvRow[]>();
  for (const [key, groupRows] of grouped) {
    // Group by timestamp within this week
    const byTimestamp = new Map<string, CsvRow[]>();
    for (const r of groupRows) {
      if (!byTimestamp.has(r.timestamp)) byTimestamp.set(r.timestamp, []);
      byTimestamp.get(r.timestamp)!.push(r);
    }
    // Pick the latest timestamp
    const latestTimestamp = [...byTimestamp.keys()].sort().pop()!;
    finalGroups.set(key, byTimestamp.get(latestTimestamp)!);
  }

  // Match names and track unmatched
  const unmatchedNames = new Set<string>();
  let matchedWeeks = 0;
  let skippedExisting = 0;
  let insertedShifts = 0;
  let skippedNoAvailable = 0;

  // Get all existing shifts to check in bulk
  const existingShifts = await prisma.distributorShift.findMany({
    select: { distributorId: true, date: true },
  });
  // Build set: "distributorId|YYYY-MM-DD"
  const existingSet = new Set<string>();
  for (const s of existingShifts) {
    existingSet.add(`${s.distributorId}|${s.date.toISOString().split('T')[0]}`);
  }
  console.log(`Existing shifts in DB: ${existingShifts.length}`);

  // Process each distributor-week
  const toInsert: { distributorId: number; date: Date; note: string | null }[] = [];

  for (const [key, weekRows] of finalGroups) {
    const name = key.split('|||')[0];
    const weekStartStr = key.split('|||')[1];

    const nameLower = name.trim().toLowerCase();
    const resolvedName = nameAliases[nameLower] || nameLower;
    const distributorId = nameMap.get(resolvedName);
    if (!distributorId) {
      unmatchedNames.add(name);
      continue;
    }
    matchedWeeks++;

    // Check if any shift exists for this distributor in this week
    const weekStartDate = parseDate(weekStartStr);
    const ws = new Date(weekStartDate + 'T00:00:00.000Z');
    let hasExisting = false;
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setUTCDate(d.getUTCDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      if (existingSet.has(`${distributorId}|${dateKey}`)) {
        hasExisting = true;
        break;
      }
    }

    if (hasExisting) {
      skippedExisting++;
      continue;
    }

    // Collect available dates for insertion
    const availableRows = weekRows.filter(r => r.available);
    if (availableRows.length === 0) {
      skippedNoAvailable++;
      continue;
    }

    for (const row of availableRows) {
      const dateStr = parseDate(row.date);
      toInsert.push({
        distributorId,
        date: new Date(dateStr + 'T00:00:00.000Z'),
        note: row.note || null,
      });
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Matched distributor-weeks: ${matchedWeeks}`);
  console.log(`Skipped (already has shifts): ${skippedExisting}`);
  console.log(`Skipped (no available days): ${skippedNoAvailable}`);
  console.log(`Shifts to insert: ${toInsert.length}`);

  if (unmatchedNames.size > 0) {
    console.log(`\nUnmatched names (${unmatchedNames.size}):`);
    for (const name of [...unmatchedNames].sort()) {
      console.log(`  - ${name}`);
    }
  }

  if (toInsert.length === 0) {
    console.log('\nNothing to insert.');
    await prisma.$disconnect();
    return;
  }

  // Dry run check
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    // Show details of what would be inserted
    const byDistributor = new Map<number, { name: string; dates: string[] }>();
    for (const item of toInsert) {
      if (!byDistributor.has(item.distributorId)) {
        const d = distributors.find(d => d.id === item.distributorId);
        byDistributor.set(item.distributorId, { name: d?.name || '?', dates: [] });
      }
      byDistributor.get(item.distributorId)!.dates.push(item.date.toISOString().split('T')[0]);
    }
    console.log('\nShifts to insert:');
    for (const [id, info] of [...byDistributor.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
      console.log(`  ${info.name} (id=${id}): ${info.dates.join(', ')}`);
    }
    console.log('\n[DRY RUN] No changes made.');
    await prisma.$disconnect();
    return;
  }

  // Bulk insert in batches of 500
  const BATCH_SIZE = 500;
  let created = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const result = await prisma.distributorShift.createMany({
      data: batch.map(r => ({
        distributorId: r.distributorId,
        date: r.date,
        status: 'WORKING',
        note: r.note,
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
