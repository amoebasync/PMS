import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = fields[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

async function main() {
  const csvText = fs.readFileSync('/Users/kuenheekim/Downloads/distributors.csv', 'utf-8');
  const csvRows = parseCSV(csvText);

  // Get all active distributors from DB
  const dbDistributors = await prisma.flyerDistributor.findMany({
    where: { leaveDate: null },
    select: {
      staffId: true,
      name: true,
      ratePlan: true,
      rate1Type: true,
      rate2Type: true,
      rate3Type: true,
      rate4Type: true,
      rate5Type: true,
      rate6Type: true,
      rateMode: true,
    },
  });

  const dbMap = new Map(dbDistributors.map(d => [d.staffId, d]));

  // Build CSV map (latest entry per staffId)
  const csvMap = new Map<string, Record<string, string>>();
  for (const row of csvRows) {
    const sid = row['スタッフID'];
    if (!sid) continue;
    // Only keep rows without 退社日 (active) or override with latest
    csvMap.set(sid, row);
  }

  const diffs: string[] = [];
  let checked = 0;

  for (const [staffId, db] of dbMap) {
    const csv = csvMap.get(staffId);
    if (!csv) continue; // Not in CSV, skip

    // Skip if CSV has 退社日 (resigned)
    if (csv['退社日']) continue;

    checked++;

    const csvRate = csv['Rate'] || '';
    const csv1 = parseFloat(csv['1type']) || null;
    const csv2 = parseFloat(csv['2type']) || null;
    const csv3 = parseFloat(csv['3type']) || null;
    const csv4 = parseFloat(csv['4type']) || null;
    const csv5 = parseFloat(csv['5type']) || null;
    const csv6 = parseFloat(csv['6type']) || null;

    const db1 = db.rate1Type;
    const db2 = db.rate2Type;
    const db3 = db.rate3Type;
    const db4 = db.rate4Type;
    const db5 = db.rate5Type;
    const db6 = db.rate6Type;

    const mismatches: string[] = [];

    // Compare rate plan
    if (csvRate && db.ratePlan && csvRate.toLowerCase() !== db.ratePlan.toLowerCase()) {
      mismatches.push(`  Plan: CSV="${csvRate}" DB="${db.ratePlan}"`);
    }

    // Compare rates
    const compareRate = (label: string, csvVal: number | null, dbVal: number | null) => {
      // Both null/0 → match
      if (!csvVal && !dbVal) return;
      if (csvVal !== dbVal) {
        mismatches.push(`  ${label}: CSV=${csvVal ?? '—'} DB=${dbVal ?? '—'}`);
      }
    };

    compareRate('1type', csv1, db1);
    compareRate('2type', csv2, db2);
    compareRate('3type', csv3, db3);
    compareRate('4type', csv4, db4);
    compareRate('5type', csv5, db5);
    compareRate('6type', csv6, db6);

    if (mismatches.length > 0) {
      diffs.push(`${staffId} ${db.name}\n${mismatches.join('\n')}`);
    }
  }

  console.log(`\n=== Rate Comparison ===`);
  console.log(`Checked: ${checked} active distributors (in both CSV & DB)`);
  console.log(`Mismatches: ${diffs.length}\n`);

  if (diffs.length === 0) {
    console.log('All rates match!');
  } else {
    for (const d of diffs) {
      console.log(d);
      console.log('---');
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
