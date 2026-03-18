/**
 * 初期パスワード未変更の配布員のパスワードハッシュを更新するスクリプト
 *
 * isPasswordTemp=true かつ birthday が設定されている配布員を対象に、
 * パスワードハッシュを誕生日（YYYYMMDD）のbcryptハッシュに更新する。
 *
 * 実行: npx tsx scripts/fix-distributor-passwords.ts
 * ドライラン: npx tsx scripts/fix-distributor-passwords.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const prisma = new PrismaClient();

function birthdayToYYYYMMDD(birthday: Date): string {
  const y = birthday.getFullYear();
  const m = String(birthday.getMonth() + 1).padStart(2, '0');
  const d = String(birthday.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('=== DRY RUN モード（実際の更新は行いません） ===\n');
  }

  // isPasswordTemp=true かつ birthday がある配布員を取得
  const distributors = await prisma.flyerDistributor.findMany({
    where: {
      isPasswordTemp: true,
      birthday: { not: null },
    },
    select: {
      id: true,
      name: true,
      staffId: true,
      birthday: true,
      passwordHash: true,
    },
  });

  console.log(`対象配布員: ${distributors.length} 名\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const dist of distributors) {
    if (!dist.birthday) {
      skippedCount++;
      continue;
    }

    const yyyymmdd = birthdayToYYYYMMDD(dist.birthday);

    // 既にbcryptハッシュの場合、誕生日と一致するか確認
    if (dist.passwordHash?.startsWith('$2')) {
      const matches = await bcrypt.compare(yyyymmdd, dist.passwordHash);
      if (matches) {
        console.log(`  [SKIP] ${dist.staffId} ${dist.name} — 既にbcrypt(誕生日)で正しい`);
        skippedCount++;
        continue;
      }
    }

    // bcryptハッシュを生成して更新
    const newHash = await bcrypt.hash(yyyymmdd, BCRYPT_ROUNDS);

    console.log(`  [UPDATE] ${dist.staffId} ${dist.name} — birthday=${yyyymmdd}`);

    if (!dryRun) {
      await prisma.flyerDistributor.update({
        where: { id: dist.id },
        data: { passwordHash: newHash },
      });
    }
    updatedCount++;
  }

  console.log(`\n--- 結果 ---`);
  console.log(`更新: ${updatedCount} 名`);
  console.log(`スキップ: ${skippedCount} 名`);
  console.log(`合計: ${distributors.length} 名`);

  if (dryRun && updatedCount > 0) {
    console.log('\n※ ドライランのため実際の更新は行われていません。');
    console.log('  実行するには --dry-run を外してください。');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('エラー:', e);
  prisma.$disconnect();
  process.exit(1);
});
