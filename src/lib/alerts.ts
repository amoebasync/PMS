import { prisma } from '@/lib/prisma';
import type { Prisma, AlertSeverity } from '@prisma/client';

/**
 * アラートを作成する（同一 entity + category の OPEN アラート重複防止付き）
 */
export async function createAlert({
  categoryId,
  severity,
  title,
  message,
  entityType,
  entityId,
  tx,
}: {
  categoryId: number;
  severity: AlertSeverity;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: number;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const db = tx || prisma;

  // 重複防止: 同一 entity + category で OPEN なアラートがあればスキップ
  if (entityType && entityId) {
    const existing = await db.alert.findFirst({
      where: {
        entityType,
        entityId,
        categoryId,
        status: 'OPEN',
      },
    });
    if (existing) return;
  }

  await db.alert.create({
    data: {
      categoryId,
      severity,
      title,
      message: message || null,
      entityType: entityType || null,
      entityId: entityId || null,
    },
  });
}

/**
 * 指定エンティティに紐づく OPEN アラートを一括解決する
 */
export async function resolveAlertsByEntity(
  entityType: string,
  entityId: number,
  resolvedById?: number,
  resolvedNote?: string,
): Promise<number> {
  const result = await prisma.alert.updateMany({
    where: {
      entityType,
      entityId,
      status: 'OPEN',
    },
    data: {
      status: 'RESOLVED',
      resolvedById: resolvedById || null,
      resolvedAt: new Date(),
      resolvedNote: resolvedNote || null,
    },
  });

  return result.count;
}
