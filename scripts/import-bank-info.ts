/**
 * CSVから配布員の口座情報・支払い方法を本番DBにインポート
 * - 既にDBに値がある項目は上書きしない
 * - CSVに値がない項目はスキップ
 * - 在籍中（leave_date IS NULL）の配布員のみ対象
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].replace(/^\uFEFF/, '').split(',');
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
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

  // Get active distributors from DB
  const dbDistributors = await prisma.flyerDistributor.findMany({
    where: { leaveDate: null },
    select: {
      id: true,
      staffId: true,
      name: true,
      paymentMethod: true,
      bankName: true,
      bankBranchCode: true,
      bankAccountType: true,
      bankAccountNumber: true,
      bankAccountName: true,
      bankAccountNameKana: true,
      transferNumber: true,
    },
  });

  const dbMap = new Map(dbDistributors.map(d => [d.staffId, d]));

  // Build CSV map (latest entry per staffId, active only)
  const csvMap = new Map<string, Record<string, string>>();
  for (const row of csvRows) {
    const sid = row['スタッフID'];
    if (!sid || row['退社日']) continue;
    csvMap.set(sid, row);
  }

  let updated = 0;
  let skipped = 0;
  let noChange = 0;
  const changes: string[] = [];

  for (const [staffId, db] of dbMap) {
    const csv = csvMap.get(staffId);
    if (!csv) { skipped++; continue; }

    const csvPayment = csv['支払い方法'] || '';
    const csvBank = csv['銀行'] || '';
    const csvBranch = csv['支店番号'] || '';
    const csvAccType = csv['口座種類'] || '';
    const csvAccNum = csv['口座番号'] || '';
    const csvAccName = csv['名義'] || '';
    const csvAccKana = csv['名義（半角カナ）'] || '';
    const csvTransfer = csv['振込番号'] || '';

    // Only fill in fields that are empty in DB and have values in CSV
    const updateData: Record<string, string> = {};

    if (!db.paymentMethod && csvPayment) updateData.paymentMethod = csvPayment;
    if (!db.bankName && csvBank) updateData.bankName = csvBank;
    if (!db.bankBranchCode && csvBranch) updateData.bankBranchCode = csvBranch;
    if (!db.bankAccountType && csvAccType) updateData.bankAccountType = csvAccType;
    if (!db.bankAccountNumber && csvAccNum) updateData.bankAccountNumber = csvAccNum;
    if (!db.bankAccountName && csvAccName) updateData.bankAccountName = csvAccName;
    if (!db.bankAccountNameKana && csvAccKana) updateData.bankAccountNameKana = csvAccKana;
    if (!db.transferNumber && csvTransfer) updateData.transferNumber = csvTransfer;

    if (Object.keys(updateData).length === 0) {
      noChange++;
      continue;
    }

    await prisma.flyerDistributor.update({
      where: { id: db.id },
      data: updateData,
    });

    const fields = Object.entries(updateData).map(([k, v]) => `${k}=${v}`).join(', ');
    changes.push(`${staffId} ${db.name}: ${fields}`);
    updated++;
  }

  console.log('\n=== Bank Info Import Results ===');
  console.log(`Updated: ${updated}`);
  console.log(`No change needed: ${noChange}`);
  console.log(`Not in CSV: ${skipped}`);
  console.log('');

  if (changes.length > 0) {
    console.log('--- Changes ---');
    for (const c of changes) console.log(c);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
