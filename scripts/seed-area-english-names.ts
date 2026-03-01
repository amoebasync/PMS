/**
 * seed-area-english-names.ts
 *
 * Kuroshiro (kuromoji) を使って Area テーブルの chome_name をローマ字化し、
 * name_en カラムに格納するスクリプト。
 *
 * Usage:
 *   npx tsx scripts/seed-area-english-names.ts
 *
 * 冪等: name_en IS NULL のレコードのみ処理。再実行安全。
 */

import { PrismaClient } from '@prisma/client';
// @ts-ignore - kuroshiro has no type definitions
import Kuroshiro from 'kuroshiro';
// @ts-ignore
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

const prisma = new PrismaClient();
const kuroshiro = new Kuroshiro();

const BATCH_SIZE = 500;

// ── helpers ───────────────────────────────────────────

/** Full-width digits → ASCII */
function normalizeFullWidth(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/** Kanji numeral → digit */
function kanjiToDigit(kanji: string): string {
  const map: Record<string, string> = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
  };
  // Handle compound numbers like 十一(11), 二十(20), 二十三(23)
  let result = kanji;
  // Simple single kanji
  if (map[result]) return map[result];
  // 十X pattern (10+X)
  const juMatch = result.match(/^十(.?)$/);
  if (juMatch) {
    const ones = juMatch[1] ? map[juMatch[1]] || '0' : '0';
    return `1${ones}`;
  }
  // X十Y pattern
  const fullMatch = result.match(/^(.)十(.?)$/);
  if (fullMatch) {
    const tens = map[fullMatch[1]] || '1';
    const ones = fullMatch[2] ? map[fullMatch[2]] || '0' : '0';
    return `${tens}${ones}`;
  }
  return kanji;
}

/** Remove macrons and apostrophes: ō→o, ū→u, ' → '' */
function cleanRomaji(str: string): string {
  return str
    .replace(/ā/g, 'a').replace(/ī/g, 'i').replace(/ū/g, 'u')
    .replace(/ē/g, 'e').replace(/ō/g, 'o')
    .replace(/Ā/g, 'A').replace(/Ī/g, 'I').replace(/Ū/g, 'U')
    .replace(/Ē/g, 'E').replace(/Ō/g, 'O')
    .replace(/'/g, '');
}

/** Title Case: "harumi" → "Harumi" */
function toTitleCase(str: string): string {
  return cleanRomaji(str)
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ── core romanization ─────────────────────────────────

async function romanizeAreaName(chomeName: string): Promise<string> {
  // 1. Normalize full-width numbers
  let name = normalizeFullWidth(chomeName);

  // 2. Check for N丁目 pattern with Arabic digits: "晴海5丁目"
  const chomeDigitMatch = name.match(/^(.+?)(\d+)丁目$/);
  if (chomeDigitMatch) {
    const base = chomeDigitMatch[1];
    const num = chomeDigitMatch[2];
    const romaji = await kuroshiro.convert(base, { to: 'romaji', mode: 'normal' });
    return `${toTitleCase(romaji.trim())} ${num}-chome`;
  }

  // 3. Check for N丁目 pattern with kanji digits: "晴海五丁目"
  const chomeKanjiMatch = name.match(/^(.+?)([一二三四五六七八九十]+)丁目$/);
  if (chomeKanjiMatch) {
    const base = chomeKanjiMatch[1];
    const num = kanjiToDigit(chomeKanjiMatch[2]);
    const romaji = await kuroshiro.convert(base, { to: 'romaji', mode: 'normal' });
    return `${toTitleCase(romaji.trim())} ${num}-chome`;
  }

  // 4. No 丁目 — romanize the entire name
  const romaji = await kuroshiro.convert(name, { to: 'romaji', mode: 'normal' });
  return toTitleCase(romaji.trim());
}

// ── main ──────────────────────────────────────────────

async function main() {
  console.log('Initializing Kuroshiro (loading kuromoji dictionary)...');
  await kuroshiro.init(new KuromojiAnalyzer());
  console.log('Kuroshiro ready.\n');

  // Quick test
  const test = await romanizeAreaName('晴海５丁目');
  console.log(`Test: "晴海５丁目" → "${test}"`);
  const test2 = await romanizeAreaName('岩本町２丁目');
  console.log(`Test: "岩本町２丁目" → "${test2}"`);
  const test3 = await romanizeAreaName('富久町');
  console.log(`Test: "富久町" → "${test3}"\n`);

  const totalCount = await prisma.area.count({ where: { name_en: null } });
  console.log(`Total areas to process: ${totalCount.toLocaleString()}`);

  if (totalCount === 0) {
    console.log('All areas already have name_en. Nothing to do.');
    return;
  }

  let processed = 0;
  let errors = 0;
  let cursor: number | undefined = undefined;
  const startTime = Date.now();

  while (true) {
    const areas = await prisma.area.findMany({
      where: { name_en: null },
      select: { id: true, chome_name: true, town_name: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (areas.length === 0) break;

    const updates: { id: number; nameEn: string }[] = [];

    for (const area of areas) {
      try {
        const source = area.chome_name || area.town_name;
        const nameEn = await romanizeAreaName(source);
        updates.push({ id: area.id, nameEn });
      } catch (err) {
        console.error(`  Error area ${area.id} (${area.chome_name}):`, err);
        errors++;
        // Push with fallback so we don't re-process on next run
        updates.push({ id: area.id, nameEn: area.chome_name || area.town_name });
      }
    }

    // Batch update in transaction
    await prisma.$transaction(
      updates.map(u =>
        prisma.area.update({
          where: { id: u.id },
          data: { name_en: u.nameEn },
        })
      )
    );

    cursor = areas[areas.length - 1].id;
    processed += areas.length;

    const pct = ((processed / totalCount) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(0);
    const eta = (((totalCount - processed) / Number(rate))).toFixed(0);
    console.log(
      `  Progress: ${processed.toLocaleString()}/${totalCount.toLocaleString()} (${pct}%) ` +
      `| ${elapsed}s elapsed | ~${rate}/s | ETA ~${eta}s | Errors: ${errors}`
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! Processed: ${processed.toLocaleString()}, Errors: ${errors}, Time: ${totalTime}s`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
