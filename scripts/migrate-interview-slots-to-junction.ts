/**
 * 既存の InterviewSlot.applicantId → InterviewSlotApplicant 中間テーブルへのデータ移行スクリプト
 *
 * 実行方法:
 *   npx tsx scripts/migrate-interview-slots-to-junction.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== InterviewSlot → InterviewSlotApplicant 移行開始 ===');

  // 予約済みスロット（applicantId が設定されているもの）を取得
  const bookedSlots = await prisma.interviewSlot.findMany({
    where: {
      applicantId: { not: null },
      isBooked: true,
    },
    select: {
      id: true,
      applicantId: true,
      meetUrl: true,
      calendarEventId: true,
    },
  });

  console.log(`対象スロット数: ${bookedSlots.length}`);

  let migrated = 0;
  let skipped = 0;

  for (const slot of bookedSlots) {
    if (!slot.applicantId) continue;

    // 既に中間テーブルにエントリがあるかチェック
    const existing = await prisma.interviewSlotApplicant.findUnique({
      where: {
        interviewSlotId_applicantId: {
          interviewSlotId: slot.id,
          applicantId: slot.applicantId,
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // 中間テーブルに移行
    await prisma.interviewSlotApplicant.create({
      data: {
        interviewSlotId: slot.id,
        applicantId: slot.applicantId,
        meetUrl: slot.meetUrl,
        calendarEventId: slot.calendarEventId,
      },
    });
    migrated++;
  }

  console.log(`移行完了: ${migrated}件`);
  console.log(`スキップ: ${skipped}件（既に移行済み）`);
  console.log('=== 移行終了 ===');
}

main()
  .catch((e) => {
    console.error('移行エラー:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
