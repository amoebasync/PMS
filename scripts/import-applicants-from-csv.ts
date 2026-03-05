/**
 * CSVから応募者データをPMSにインポートするスクリプト
 *
 * 処理内容:
 * 1. 全応募者を applicants テーブルに登録
 * 2. Interview Date >= today の場合 → interview_slots を作成して紐付け
 * 3. Training Date >= today の場合 → training_slots を作成 or 既存に紐付け
 *
 * 実行: npx tsx scripts/import-applicants-from-csv.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

const CSV_PATH = path.resolve(
  process.env.HOME || '~',
  'Downloads/Interview&Training - Application.csv'
);

const TODAY = new Date('2026-03-03T00:00:00+09:00');

// ── CSV パーサー（簡易版、ダブルクォート対応） ──
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ── Platform → RecruitingMedia code マッピング ──
const PLATFORM_TO_CODE: Record<string, string> = {
  'YOLO': 'yolo',
  'Indeed': 'indeed',
  'Guidable': 'guidable',
  'Introduce': 'introduce',
  '求人チラシ': 'chirashi',
  'Craiglist': 'craigslist',
  'OTHER': 'other',
};

// ── 面接時間パース（30分枠） ──
function parseInterviewSlotTimes(dateStr: string, timeStr: string): { start: Date; end: Date } | null {
  if (!dateStr || !timeStr) return null;
  try {
    // dateStr: "2026/03/04", timeStr: "16:00"
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00+09:00');
    const start = new Date(d);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    return { start, end };
  } catch {
    return null;
  }
}

// ── 研修時間パース（2時間枠） ──
function parseTrainingSlotTimes(dateStr: string, timeStr: string): { start: Date; end: Date } | null {
  if (!dateStr || !timeStr) return null;
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00+09:00');
    const start = new Date(d);
    start.setHours(h, m || 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 120);
    return { start, end };
  } catch {
    return null;
  }
}

function isDateOnOrAfterToday(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00+09:00');
    return d >= TODAY;
  } catch {
    return false;
  }
}

// ── フローステータス判定 ──
function determineFlowStatus(row: Record<string, string>): string {
  const isTraining = row['IsTraining'] === 'TRUE';
  const trainingDate = row['Training Date']?.trim();
  if (isTraining && trainingDate) {
    return 'TRAINING_COMPLETED';
  }
  if (trainingDate) {
    return 'TRAINING_WAITING';
  }
  return 'INTERVIEW_WAITING';
}

function determineHiringStatus(row: Record<string, string>): string {
  const comment = (row['Cooment'] || '').trim().toLowerCase();
  if (comment.includes('resign') || comment.includes('no show') || comment.includes('invalid')) {
    return 'REJECTED';
  }
  // Accept column
  const accept = (row['Accept'] || '').trim();
  if (accept) return 'HIRED';
  return 'IN_PROGRESS';
}

async function main() {
  console.log('=== 応募者CSVインポート開始 ===');
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`基準日: ${TODAY.toISOString().slice(0, 10)}`);

  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(content);
  const dataRows = rows.filter((r) => r['Name']?.trim());
  console.log(`データ行数: ${dataRows.length}`);

  // ── 1. 求人媒体マスタを取得 or 作成 ──
  const mediaMap = new Map<string, number>(); // code → id
  const existingMedia = await prisma.recruitingMedia.findMany();
  for (const m of existingMedia) {
    mediaMap.set(m.code, m.id);
  }

  // 不足分を作成
  for (const [platform, code] of Object.entries(PLATFORM_TO_CODE)) {
    if (!mediaMap.has(code)) {
      const created = await prisma.recruitingMedia.create({
        data: { nameJa: platform, nameEn: platform, code, isActive: true, sortOrder: 100 },
      });
      mediaMap.set(code, created.id);
      console.log(`  求人媒体作成: ${platform} (${code}) → id=${created.id}`);
    }
  }

  // ── 2. 職種を取得（デフォルトの最初の職種を使う） ──
  const jobCategories = await prisma.jobCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  if (jobCategories.length === 0) {
    console.error('ERROR: 職種マスタが空です。先に職種を登録してください。');
    return;
  }
  const defaultJobCategoryId = jobCategories[0].id;
  console.log(`デフォルト職種: ${jobCategories[0].nameJa} (id=${defaultJobCategoryId})`);

  // ── 3. 面接担当者を取得 ──
  const interviewerMap = new Map<string, number>(); // lowercase last name → employee id
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, lastNameJa: true, firstNameJa: true, lastNameEn: true, firstNameEn: true },
  });
  for (const emp of employees) {
    if (emp.lastNameEn) interviewerMap.set(emp.lastNameEn.toLowerCase(), emp.id);
    if (emp.firstNameEn) interviewerMap.set(emp.firstNameEn.toLowerCase(), emp.id);
  }

  // ── 4. 統計 ──
  let importedCount = 0;
  let skippedDuplicate = 0;
  let interviewSlotCreated = 0;
  let trainingSlotCreated = 0;
  let trainingSlotReused = 0;

  // ── 5. インポート ──
  for (const row of dataRows) {
    const name = row['Name'].trim();
    const email = row['Email']?.trim();
    if (!name || !email) continue;

    // メール重複チェック
    const existing = await prisma.applicant.findUnique({ where: { email } });
    if (existing) {
      skippedDuplicate++;
      continue;
    }

    const platform = row['Platform']?.trim() || '';
    const code = PLATFORM_TO_CODE[platform];
    const recruitingMediaId = code ? mediaMap.get(code) || null : null;

    const language = (row['Language']?.trim().toLowerCase() === 'japanese') ? 'ja' : 'en';

    const flowStatus = determineFlowStatus(row);
    const hiringStatus = determineHiringStatus(row);
    const comment = (row['Cooment'] || '').trim();
    const managementToken = crypto.randomBytes(32).toString('hex');

    // 面接スロット（未来のみ）
    let interviewSlotId: number | null = null;
    const interviewDate = row['Interview Date']?.trim();
    const interviewTime = row['Interview Time']?.trim();
    if (isDateOnOrAfterToday(interviewDate) && interviewTime) {
      const times = parseInterviewSlotTimes(interviewDate, interviewTime);
      if (times) {
        const interviewer = row['Interviewer']?.trim().toLowerCase() || '';
        const interviewerId = interviewerMap.get(interviewer) || null;

        const slot = await prisma.interviewSlot.create({
          data: {
            startTime: times.start,
            endTime: times.end,
            isBooked: true,
            interviewerId,
          },
        });
        interviewSlotId = slot.id;
        interviewSlotCreated++;
      }
    }

    // 研修スロット（未来のみ）
    let trainingSlotId: number | null = null;
    const trainingDate = row['Training Date']?.trim();
    const trainingTime = row['Training Time']?.trim();
    if (isDateOnOrAfterToday(trainingDate) && trainingTime) {
      const times = parseTrainingSlotTimes(trainingDate, trainingTime);
      if (times) {
        const location = row['Training Branch']?.trim() || null;
        // 同じ開始時刻＋場所のスロットが既にあれば再利用（グループ研修）
        const existingSlot = await prisma.trainingSlot.findFirst({
          where: {
            startTime: times.start,
            endTime: times.end,
            location: location,
          },
        });
        if (existingSlot) {
          trainingSlotId = existingSlot.id;
          trainingSlotReused++;
        } else {
          const slot = await prisma.trainingSlot.create({
            data: {
              startTime: times.start,
              endTime: times.end,
              capacity: 10,
              location,
            },
          });
          trainingSlotId = slot.id;
          trainingSlotCreated++;
        }
      }
    }

    // 応募者作成
    await prisma.applicant.create({
      data: {
        name,
        email,
        language,
        jobCategoryId: defaultJobCategoryId,
        recruitingMediaId,
        managementToken,
        flowStatus,
        hiringStatus,
        interviewNotes: comment || null,
        ...(interviewSlotId ? { interviewSlot: { connect: { id: interviewSlotId } } } : {}),
        ...(trainingSlotId ? { trainingSlotId } : {}),
      },
    });

    // interviewSlot の applicantId は InterviewSlot 側で設定されるので、
    // applicant 作成後に slot を更新
    // → 上記の connect で処理済み

    importedCount++;
  }

  console.log('\n=== インポート完了 ===');
  console.log(`  応募者登録: ${importedCount}件`);
  console.log(`  重複スキップ: ${skippedDuplicate}件`);
  console.log(`  面接スロット作成: ${interviewSlotCreated}件`);
  console.log(`  研修スロット作成: ${trainingSlotCreated}件`);
  console.log(`  研修スロット再利用: ${trainingSlotReused}件`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
