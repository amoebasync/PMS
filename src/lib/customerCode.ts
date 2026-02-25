import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

/**
 * 重複しないランダム8桁の顧客コードを生成する
 * 例: TS15673561 / EC24891034
 * 衝突した場合は最大10回リトライする
 */
export async function generateUniqueCustomerCode(
  prisma: PrismaClient,
  prefix: 'TS' | 'EC',
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    // 10000000〜99999999 の範囲でランダム8桁
    const num = crypto.randomInt(10_000_000, 100_000_000);
    const code = `${prefix}${num}`;
    const existing = await prisma.customer.findUnique({
      where: { customerCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error('顧客コードの生成に失敗しました（リトライ上限超過）');
}
