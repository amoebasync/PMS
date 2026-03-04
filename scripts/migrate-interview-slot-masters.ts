/**
 * マイグレーションスクリプト: 面接スロットマスタ導入
 *
 * 1. デフォルトマスタ「デフォルト面接」を作成
 * 2. 既存 DefaultInterviewSlot に masterId を設定
 * 3. 既存 DefaultSlotJobCategory から職種を取得し JobCategory に masterId を設定
 * 4. 未割当の職種もデフォルトマスタに紐付け
 * 5. 既存 InterviewSlot に masterId を設定
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 面接スロットマスタ マイグレーション開始 ===');

  // 1. デフォルトマスタ作成（既に存在する場合はスキップ）
  let master = await prisma.interviewSlotMaster.findFirst({
    where: { name: 'デフォルト面接' },
  });

  if (master) {
    console.log(`既にマスタが存在します: ID=${master.id}, name="${master.name}"`);
  } else {
    master = await prisma.interviewSlotMaster.create({
      data: {
        name: 'デフォルト面接',
        meetingType: 'GOOGLE_MEET',
        isActive: true,
        sortOrder: 1,
      },
    });
    console.log(`マスタ作成: ID=${master.id}, name="${master.name}"`);
  }

  // 2. 既存 DefaultInterviewSlot に masterId を設定
  const updatedDefaults = await prisma.defaultInterviewSlot.updateMany({
    where: { interviewSlotMasterId: null },
    data: { interviewSlotMasterId: master.id },
  });
  console.log(`DefaultInterviewSlot 更新: ${updatedDefaults.count}件`);

  // 3. DefaultSlotJobCategory から職種IDを取得し、JobCategory に masterId を設定
  const jobCatEntries = await prisma.defaultSlotJobCategory.findMany({
    distinct: ['jobCategoryId'],
    select: { jobCategoryId: true },
  });

  for (const { jobCategoryId } of jobCatEntries) {
    await prisma.jobCategory.update({
      where: { id: jobCategoryId },
      data: { interviewSlotMasterId: master.id },
    });
  }
  console.log(`DefaultSlotJobCategory → JobCategory 紐付け: ${jobCatEntries.length}件`);

  // 4. 未割当の職種もデフォルトマスタに
  const updatedJobs = await prisma.jobCategory.updateMany({
    where: { interviewSlotMasterId: null },
    data: { interviewSlotMasterId: master.id },
  });
  console.log(`未割当 JobCategory 更新: ${updatedJobs.count}件`);

  // 5. 既存 InterviewSlot に masterId を設定
  const updatedSlots = await prisma.interviewSlot.updateMany({
    where: { interviewSlotMasterId: null },
    data: { interviewSlotMasterId: master.id },
  });
  console.log(`InterviewSlot 更新: ${updatedSlots.count}件`);

  console.log('=== マイグレーション完了 ===');
}

main()
  .catch((e) => {
    console.error('マイグレーションエラー:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
