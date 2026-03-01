/**
 * マスタデータ投入スクリプト
 * 禁止理由・クレーム種別・求人媒体を upsert する
 * Usage: npx tsx scripts/seed-master-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('マスタデータ投入開始...');

  // ===== 禁止理由 =====
  const prohibitedReasons = [
    { id: 1, name: '住民からのクレーム',           sortOrder: 10 },
    { id: 2, name: '管理会社からの警告',            sortOrder: 20 },
    { id: 3, name: '管理組合の決議',               sortOrder: 30 },
    { id: 4, name: 'オーナー指定禁止',             sortOrder: 40 },
    { id: 5, name: '「チラシお断り」表示あり',      sortOrder: 50 },
    { id: 6, name: '過去に訴訟・法的措置の示唆あり', sortOrder: 60 },
    { id: 7, name: '配布物の廃棄確認（繰り返し）',  sortOrder: 70 },
    { id: 8, name: '顧客指定の禁止エリア',          sortOrder: 80 },
    { id: 9, name: 'セキュリティ上の理由',          sortOrder: 90 },
    { id: 10, name: 'その他',                      sortOrder: 100 },
  ];

  for (const r of prohibitedReasons) {
    await prisma.prohibitedReason.upsert({
      where: { id: r.id },
      update: { name: r.name, sortOrder: r.sortOrder, isActive: true },
      create: { id: r.id, name: r.name, sortOrder: r.sortOrder, isActive: true },
    });
  }
  console.log(`✅ 禁止理由: ${prohibitedReasons.length} 件 upsert 完了`);

  // ===== クレーム種別 =====
  const complaintTypes = [
    { id: 1, name: '投函禁止違反',          sortOrder: 10 },
    { id: 2, name: '誤配（別住所への投函）', sortOrder: 20 },
    { id: 3, name: '共用部への散乱',         sortOrder: 30 },
    { id: 4, name: 'ポスト破損・汚損',       sortOrder: 40 },
    { id: 5, name: '敷地内無断侵入',         sortOrder: 50 },
    { id: 6, name: 'チラシの濡れ・破れ',     sortOrder: 60 },
    { id: 7, name: '深夜・早朝の配布',       sortOrder: 70 },
    { id: 8, name: '態度・マナー',           sortOrder: 80 },
    { id: 9, name: 'オートロック突破',       sortOrder: 90 },
    { id: 10, name: 'その他',               sortOrder: 100 },
  ];

  for (const t of complaintTypes) {
    await prisma.complaintType.upsert({
      where: { id: t.id },
      update: { name: t.name, sortOrder: t.sortOrder, isActive: true },
      create: { id: t.id, name: t.name, sortOrder: t.sortOrder, isActive: true },
    });
  }
  console.log(`✅ クレーム種別: ${complaintTypes.length} 件 upsert 完了`);

  // ===== 求人媒体 =====
  const recruitingMedia = [
    { code: 'indeed',     nameJa: 'Indeed',      nameEn: 'Indeed',      sortOrder: 10 },
    { code: 'yolojapan',  nameJa: 'YOLO JAPAN',  nameEn: 'YOLO JAPAN',  sortOrder: 20 },
    { code: 'guidable',   nameJa: 'Guidable',    nameEn: 'Guidable',    sortOrder: 30 },
    { code: 'craiglist',  nameJa: 'Craiglist',   nameEn: 'Craiglist',   sortOrder: 40 },
  ];

  for (const m of recruitingMedia) {
    await prisma.recruitingMedia.upsert({
      where: { code: m.code },
      update: { nameJa: m.nameJa, nameEn: m.nameEn, sortOrder: m.sortOrder, isActive: true },
      create: { code: m.code, nameJa: m.nameJa, nameEn: m.nameEn, sortOrder: m.sortOrder, isActive: true },
    });
  }
  console.log(`✅ 求人媒体: ${recruitingMedia.length} 件 upsert 完了`);

  console.log('\n✅ マスタデータ投入完了');
}

main()
  .catch((e) => {
    console.error('❌ エラー:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
