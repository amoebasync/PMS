/**
 * 重複面接スロットのクリーンアップスクリプト
 *
 * 2台のEC2で同時にCRONが実行され、同一条件のスロットが重複作成された問題の修正用。
 * 同じ (startTime, endTime, jobCategoryId, interviewSlotMasterId) を持つスロットのうち、
 * 予約済みでないものを1つだけ残して残りを削除する。
 *
 * 使い方:
 *   npx tsx scripts/cleanup-duplicate-slots.ts          # ドライラン（確認のみ）
 *   npx tsx scripts/cleanup-duplicate-slots.ts --execute # 実際に削除
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const execute = process.argv.includes('--execute');

  console.log(execute ? '=== 実行モード ===' : '=== ドライラン（--execute で実際に削除） ===');
  console.log('');

  // 重複グループを検出: 同じ startTime + endTime + jobCategoryId + interviewSlotMasterId
  const duplicateGroups = await prisma.$queryRaw<
    { start_time: Date; end_time: Date; job_category_id: number | null; interview_slot_master_id: number | null; cnt: bigint }[]
  >`
    SELECT start_time, end_time, job_category_id, interview_slot_master_id, COUNT(*) as cnt
    FROM interview_slots
    GROUP BY start_time, end_time, job_category_id, interview_slot_master_id
    HAVING COUNT(*) > 1
    ORDER BY start_time
  `;

  console.log(`重複グループ数: ${duplicateGroups.length}`);

  let totalToDelete = 0;
  let totalProtected = 0;
  const idsToDelete: number[] = [];

  for (const group of duplicateGroups) {
    // このグループの全スロットを取得
    const slots = await prisma.interviewSlot.findMany({
      where: {
        startTime: group.start_time,
        endTime: group.end_time,
        jobCategoryId: group.job_category_id,
        interviewSlotMasterId: group.interview_slot_master_id,
      },
      include: {
        _count: { select: { interviewSlotApplicants: true } },
      },
      orderBy: { id: 'asc' },
    });

    // 予約済みスロット（isBooked=true or applicantId != null or interviewSlotApplicants > 0）を特定
    const booked = slots.filter(
      (s) => s.isBooked || s.applicantId !== null || s._count.interviewSlotApplicants > 0
    );
    const notBooked = slots.filter(
      (s) => !s.isBooked && s.applicantId === null && s._count.interviewSlotApplicants === 0
    );

    // 保持するスロット: 予約済みは全て保持 + 未予約から1つ保持
    let keepOne = booked.length > 0;
    const toDelete: number[] = [];

    for (const slot of notBooked) {
      if (!keepOne) {
        // 最初の未予約スロットは保持
        keepOne = true;
        continue;
      }
      toDelete.push(slot.id);
    }

    if (toDelete.length > 0) {
      const timeStr = group.start_time.toISOString().replace('T', ' ').substring(0, 16);
      console.log(`  ${timeStr} | 全${slots.length}件 → 削除${toDelete.length}件 (予約済み${booked.length}件保護)`);
      idsToDelete.push(...toDelete);
      totalToDelete += toDelete.length;
      totalProtected += booked.length;
    }
  }

  console.log('');
  console.log(`削除対象: ${totalToDelete}件`);
  console.log(`予約済み保護: ${totalProtected}件`);

  if (execute && idsToDelete.length > 0) {
    // バッチ削除
    const result = await prisma.interviewSlot.deleteMany({
      where: { id: { in: idsToDelete } },
    });
    console.log(`\n✅ ${result.count}件の重複スロットを削除しました`);
  } else if (idsToDelete.length > 0) {
    console.log('\n⚠️  削除を実行するには --execute オプションを付けてください');
  } else {
    console.log('\n✅ 重複スロットはありません');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
