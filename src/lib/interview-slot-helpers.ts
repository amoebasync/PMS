import { Prisma, PrismaClient } from '@prisma/client';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * スロットの予約済み人数を取得
 */
export async function getSlotBookedCount(tx: TxClient, slotId: number): Promise<number> {
  return tx.interviewSlotApplicant.count({
    where: { interviewSlotId: slotId },
  });
}

/**
 * スロットのcapacityを取得（マスタから）
 * マスタ未設定の場合はデフォルト1
 */
export async function getSlotCapacity(tx: TxClient, slotId: number): Promise<number> {
  const slot = await tx.interviewSlot.findUnique({
    where: { id: slotId },
    select: {
      interviewSlotMaster: {
        select: { capacity: true },
      },
    },
  });
  return slot?.interviewSlotMaster?.capacity ?? 1;
}

/**
 * スロットが予約可能かチェック
 * capacity=0 なら無制限（常にtrue）
 */
export async function isSlotAvailable(tx: TxClient, slotId: number): Promise<boolean> {
  const capacity = await getSlotCapacity(tx, slotId);
  if (capacity === 0) return true; // 無制限

  const count = await getSlotBookedCount(tx, slotId);
  return count < capacity;
}

/**
 * スロットに応募者を予約（中間テーブルINSERT + レガシーisBooked更新）
 */
export async function bookSlotForApplicant(
  tx: TxClient,
  slotId: number,
  applicantId: number,
  meetUrl?: string | null,
  calendarEventId?: string | null
): Promise<void> {
  // 中間テーブルにINSERT
  await tx.interviewSlotApplicant.create({
    data: {
      interviewSlotId: slotId,
      applicantId,
      meetUrl: meetUrl || null,
      calendarEventId: calendarEventId || null,
    },
  });

  // レガシー互換: isBooked + applicantId を更新
  const capacity = await getSlotCapacity(tx, slotId);
  const count = await getSlotBookedCount(tx, slotId);

  // capacity=1の場合はレガシーフィールドも更新（後方互換）
  if (capacity === 1) {
    await tx.interviewSlot.update({
      where: { id: slotId },
      data: {
        isBooked: true,
        applicantId,
        meetUrl: meetUrl || undefined,
        calendarEventId: calendarEventId || undefined,
      },
    });
  } else {
    // capacity>1: isBookedは満員時のみtrue
    const isFull = capacity > 0 && count >= capacity;
    await tx.interviewSlot.update({
      where: { id: slotId },
      data: {
        isBooked: isFull,
        // applicantId はcapacity>1の場合は設定しない（1:1制約があるため）
        meetUrl: meetUrl || undefined,
        calendarEventId: calendarEventId || undefined,
      },
    });
  }
}

/**
 * スロットから応募者の予約を解除（中間テーブルDELETE + レガシーisBooked更新）
 */
export async function unbookSlotForApplicant(
  tx: TxClient,
  slotId: number,
  applicantId: number
): Promise<void> {
  // 中間テーブルからDELETE
  await tx.interviewSlotApplicant.deleteMany({
    where: {
      interviewSlotId: slotId,
      applicantId,
    },
  });

  // レガシー互換: 残りの予約数を確認してisBookedを更新
  const count = await getSlotBookedCount(tx, slotId);
  const capacity = await getSlotCapacity(tx, slotId);

  if (count === 0) {
    // 全員キャンセル済み
    await tx.interviewSlot.update({
      where: { id: slotId },
      data: {
        isBooked: false,
        applicantId: null,
      },
    });
  } else if (capacity === 1) {
    // capacity=1で残りがある場合（理論上ここには来ない）
    // そのまま
  } else {
    // capacity>1: 満員でなくなったのでisBooked=false
    const isFull = capacity > 0 && count >= capacity;
    await tx.interviewSlot.update({
      where: { id: slotId },
      data: {
        isBooked: isFull,
      },
    });
  }
}
