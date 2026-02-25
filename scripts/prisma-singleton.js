/**
 * プロジェクト全体の `new PrismaClient()` をシングルトンインポートに一括変換する
 * 対象: src/ 以下の全 .ts ファイル（src/lib/prisma.ts は除外）
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 対象ファイルを取得
const files = execSync(
  'grep -rl "new PrismaClient()" /Users/kuenheekim/PMS/src --include="*.ts"',
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter(f => f && !f.endsWith('src/lib/prisma.ts'));

let changed = 0;
let skipped = 0;

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // 1. コメント行（PrismaClientのインスタンス作成…）を削除
  src = src.replace(/^\/\/ PrismaClient[^\n]*\n/gm, '');

  // 2. import { PrismaClient } from '@prisma/client'; を削除（シングル/ダブルクォート両対応）
  src = src.replace(/^import \{ PrismaClient \} from ['"]@prisma\/client['"];?\n/gm, '');

  // 3. const prisma = new PrismaClient(); を削除
  src = src.replace(/^const prisma = new PrismaClient\(\);?\n/gm, '');

  // 4. シングルトンimportを先頭付近に追加（最初のimport行の直後）
  if (!src.includes("from '@/lib/prisma'")) {
    // 最初の import 行を探して直後に挿入
    src = src.replace(
      /(^import .+\n)/m,
      `$1import { prisma } from '@/lib/prisma';\n`
    );
  }

  if (src !== original) {
    fs.writeFileSync(file, src, 'utf8');
    console.log(`✅ ${path.relative('/Users/kuenheekim/PMS', file)}`);
    changed++;
  } else {
    console.log(`⏭  ${path.relative('/Users/kuenheekim/PMS', file)} (変更なし)`);
    skipped++;
  }
}

console.log(`\n完了: ${changed}件変更 / ${skipped}件スキップ`);
