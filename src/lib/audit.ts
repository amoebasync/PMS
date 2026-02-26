import { Prisma } from '@prisma/client';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// ================================================================
// センシティブフィールド定義
// ================================================================
const SENSITIVE_FIELDS: Record<string, string[]> = {
  Employee: ['passwordHash', 'password_hash', 'passwordResetToken', 'password_reset_token'],
  CustomerContact: ['passwordHash', 'password_hash', 'passwordResetToken', 'password_reset_token'],
  FlyerDistributor: ['passwordHash', 'password_hash'],
  EmployeeFinancial: ['accountNumber', 'account_number'],
};

const GLOBAL_SENSITIVE_FIELDS = [
  'passwordHash',
  'password_hash',
  'passwordResetToken',
  'password_reset_token',
  'token',
];

/**
 * オブジェクトからセンシティブフィールドを除外してスナップショットを返す
 */
export function sanitizeSnapshot(
  data: Record<string, unknown> | null | undefined,
  modelName?: string
): Record<string, unknown> | null {
  if (!data) return null;

  const fieldsToRemove = new Set([
    ...GLOBAL_SENSITIVE_FIELDS,
    ...(modelName ? (SENSITIVE_FIELDS[modelName] ?? []) : []),
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!fieldsToRemove.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

// ================================================================
// 監査ログ書き込み
// ================================================================

export interface WriteAuditLogParams {
  actorType: 'EMPLOYEE' | 'PORTAL_USER' | 'STAFF' | 'SYSTEM';
  actorId?: number | null;
  actorName?: string | null;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'STATUS_CHANGE';
  targetModel?: string;
  targetId?: number | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  description?: string | null;
  tx?: Prisma.TransactionClient;
}

/**
 * 監査ログを書き込む。
 * - tx を渡す場合：トランザクション内で記録（業務操作ログに使用）
 * - tx を渡さない場合：prisma を直接使用（認証ログに使用）
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  const {
    actorType, actorId, actorName, action,
    targetModel, targetId,
    beforeData, afterData,
    ipAddress, userAgent, description,
    tx,
  } = params;

  const client = tx ?? prisma;

  try {
    const sanitizedBefore = beforeData
      ? sanitizeSnapshot(beforeData, targetModel)
      : null;
    const sanitizedAfter = afterData
      ? sanitizeSnapshot(afterData, targetModel)
      : null;

    await client.auditLog.create({
      data: {
        actorType,
        actorId: actorId ?? null,
        actorName: actorName ?? null,
        action,
        targetModel: targetModel ?? null,
        targetId: targetId ?? null,
        beforeData: sanitizedBefore
          ? (sanitizedBefore as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        afterData: sanitizedAfter
          ? (sanitizedAfter as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ? userAgent.substring(0, 500) : null,
        description: description ?? null,
      },
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
    // トランザクション外では握りつぶす（ログ失敗がメイン処理を止めないように）
    // トランザクション内（tx あり）では例外が伝播してロールバックになる
    if (tx) throw err;
  }
}

// ================================================================
// ヘルパー関数
// ================================================================

/**
 * pms_session cookie から管理者（Employee）の情報を取得する
 * ※ Cookie削除前（logout処理等）に呼ぶこと
 */
export async function getAdminActorInfo(): Promise<{
  actorId: number | null;
  actorName: string | null;
}> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return { actorId: null, actorName: null };

    const empId = parseInt(sessionId);
    if (isNaN(empId)) return { actorId: null, actorName: null };

    const emp = await prisma.employee.findUnique({
      where: { id: empId },
      select: { id: true, lastNameJa: true, firstNameJa: true },
    });
    if (!emp) return { actorId: null, actorName: null };

    return {
      actorId: emp.id,
      actorName: `${emp.lastNameJa} ${emp.firstNameJa}`,
    };
  } catch {
    return { actorId: null, actorName: null };
  }
}

/**
 * pms_portal_session cookie からポータルユーザー（CustomerContact）の情報を取得する
 */
export async function getPortalActorInfo(): Promise<{
  actorId: number | null;
  actorName: string | null;
}> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_portal_session')?.value;
    if (!sessionId) return { actorId: null, actorName: null };

    const contactId = parseInt(sessionId);
    if (isNaN(contactId)) return { actorId: null, actorName: null };

    const contact = await prisma.customerContact.findUnique({
      where: { id: contactId },
      select: { id: true, lastName: true, firstName: true },
    });
    if (!contact) return { actorId: null, actorName: null };

    return {
      actorId: contact.id,
      actorName: `${contact.lastName} ${contact.firstName}`,
    };
  } catch {
    return { actorId: null, actorName: null };
  }
}

/**
 * リクエストから実クライアントのIPアドレスを取得する
 * ALB → EC2 構成のため x-forwarded-for のカンマ区切り先頭を優先
 */
export function getIpAddress(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? null;
}
