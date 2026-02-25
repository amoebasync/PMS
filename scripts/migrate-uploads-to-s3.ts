/**
 * 既存のローカルアップロードファイルをS3に移行し、DB内のURLを更新するスクリプト
 *
 * 実行方法:
 *   npx tsx scripts/migrate-uploads-to-s3.ts
 */

import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

// ---- 設定 ----------------------------------------------------------------

const region = process.env.AWS_REGION || 'ap-northeast-1';
const bucket = process.env.AWS_S3_BUCKET || '';

if (!bucket) {
  console.error('❌ AWS_S3_BUCKET が設定されていません。.env を確認してください。');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const prisma = new PrismaClient();

// ---- ユーティリティ -------------------------------------------------------

function getS3Url(key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  ai: 'application/postscript',
  psd: 'image/vnd.adobe.photoshop',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  zip: 'application/zip',
};

function getMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] || 'application/octet-stream';
}

// ---- ファイル移行 ---------------------------------------------------------

async function migrateDirectory(localDir: string, s3Prefix: string): Promise<Map<string, string>> {
  /** 旧URL → 新S3URL のマッピングを返す */
  const urlMap = new Map<string, string>();

  let files: string[];
  try {
    files = await readdir(localDir);
  } catch {
    console.log(`  ディレクトリが存在しないためスキップ: ${localDir}`);
    return urlMap;
  }

  const targets = files.filter(f => !f.startsWith('.'));
  console.log(`  ${targets.length} ファイルを移行します: ${localDir}`);

  for (const filename of targets) {
    const localPath = path.join(localDir, filename);
    const ext = filename.split('.').pop() || 'bin';
    const s3Key = `${s3Prefix}${filename}`;
    const oldUrl = `/${s3Prefix}${filename}`;   // 例: /uploads/avatars/foo.pdf
    const newUrl = getS3Url(s3Key);              // 例: https://bucket.s3.region.amazonaws.com/uploads/avatars/foo.pdf

    try {
      const buffer = await readFile(localPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: getMimeType(ext),
        })
      );
      urlMap.set(oldUrl, newUrl);
      console.log(`  ✅ ${filename}`);
    } catch (err) {
      console.error(`  ❌ ${filename}: ${err}`);
    }
  }

  return urlMap;
}

// ---- DB更新 ---------------------------------------------------------------

async function updateDatabase(urlMap: Map<string, string>): Promise<void> {
  if (urlMap.size === 0) {
    console.log('  更新対象のURLがありません。');
    return;
  }

  for (const [oldUrl, newUrl] of urlMap) {
    // employee.avatarUrl
    const empResult = await prisma.employee.updateMany({
      where: { avatarUrl: oldUrl },
      data: { avatarUrl: newUrl },
    });
    if (empResult.count > 0) {
      console.log(`  employee.avatarUrl: ${empResult.count}件更新`);
    }

    // flyerDistributor.avatarUrl
    const distResult = await prisma.flyerDistributor.updateMany({
      where: { avatarUrl: oldUrl },
      data: { avatarUrl: newUrl },
    });
    if (distResult.count > 0) {
      console.log(`  flyerDistributor.avatarUrl: ${distResult.count}件更新`);
    }

    // orderPrinting.frontDesignUrl
    const frontResult = await prisma.orderPrinting.updateMany({
      where: { frontDesignUrl: oldUrl },
      data: { frontDesignUrl: newUrl },
    });
    if (frontResult.count > 0) {
      console.log(`  orderPrinting.frontDesignUrl: ${frontResult.count}件更新`);
    }

    // orderPrinting.backDesignUrl
    const backResult = await prisma.orderPrinting.updateMany({
      where: { backDesignUrl: oldUrl },
      data: { backDesignUrl: newUrl },
    });
    if (backResult.count > 0) {
      console.log(`  orderPrinting.backDesignUrl: ${backResult.count}件更新`);
    }
  }
}

// ---- メイン ---------------------------------------------------------------

async function main() {
  const publicDir = path.join(process.cwd(), 'public');

  console.log('=== S3移行スクリプト開始 ===');
  console.log(`バケット: ${bucket} (${region})\n`);

  // 1. /public/uploads/avatars/ → S3 uploads/avatars/
  console.log('【1/4】設計ファイル・アバターをS3にアップロード中...');
  const avatarUrlMap = await migrateDirectory(
    path.join(publicDir, 'uploads', 'avatars'),
    'uploads/avatars/'
  );

  // 2. /public/uploads/distributor-avatars/ → S3 uploads/distributor-avatars/
  console.log('\n【2/4】スタッフアバターをS3にアップロード中...');
  const distAvatarUrlMap = await migrateDirectory(
    path.join(publicDir, 'uploads', 'distributor-avatars'),
    'uploads/distributor-avatars/'
  );

  // 3. URLマップをマージ
  const allUrlMap = new Map([...avatarUrlMap, ...distAvatarUrlMap]);
  console.log(`\n合計 ${allUrlMap.size} ファイルをS3にアップロードしました。`);

  // 4. DBのURLを更新
  console.log('\n【3/4】データベースのURLを更新中...');
  await updateDatabase(allUrlMap);

  console.log('\n【4/4】完了！');
  console.log('=== S3移行スクリプト終了 ===');
}

main()
  .catch(err => {
    console.error('スクリプトエラー:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
