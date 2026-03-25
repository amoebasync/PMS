import { prisma } from '@/lib/prisma';

/**
 * スケジュールに配布員がアサインされた時、該当日のシフトを自動作成する。
 * 既にシフトが存在する場合は何もしない。
 */
export async function ensureShiftExists(
  distributorId: number,
  date: Date,
  tx?: any, // Prisma transaction client
) {
  const db = tx || prisma;
  const dateOnly = new Date(date);
  dateOnly.setUTCHours(0, 0, 0, 0);

  const existing = await db.distributorShift.findUnique({
    where: {
      distributorId_date: {
        distributorId,
        date: dateOnly,
      },
    },
  });

  if (!existing) {
    await db.distributorShift.create({
      data: {
        distributorId,
        date: dateOnly,
        status: 'WORKING',
      },
    });
  }
}
