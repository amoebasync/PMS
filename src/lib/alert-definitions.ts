import { prisma } from '@/lib/prisma';
import { createAlert } from '@/lib/alerts';
import type { AlertDefinition } from '@prisma/client';

// --- 型定義 ---
interface AlertCheckResult {
  alerts: {
    title: string;
    message: string;
    entityType?: string;
    entityId?: number;
  }[];
}

type AlertCheckFn = (definition: AlertDefinition) => Promise<AlertCheckResult>;

// --- レジストリ ---
const registry: Record<string, AlertCheckFn> = {};

export function registerAlertCheck(code: string, fn: AlertCheckFn) {
  registry[code] = fn;
}

export function getAlertCheck(code: string): AlertCheckFn | undefined {
  return registry[code];
}

// --- ヘルパー: JST日時算出 ---
function getJSTDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}

function getLastWeekRange(): { start: Date; end: Date } {
  const jstNow = getJSTDate();
  const dayOfWeek = jstNow.getDay(); // 0=Sun, 1=Mon, ...
  // 今週の月曜日
  const thisMondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(jstNow);
  thisMonday.setDate(jstNow.getDate() + thisMondayOffset);
  thisMonday.setHours(0, 0, 0, 0);

  // 先週の月曜日・日曜日
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  lastSunday.setHours(23, 59, 59, 999);

  return { start: lastMonday, end: lastSunday };
}

function getYYYYWW(date: Date): number {
  const jst = getJSTDate(date);
  const year = jst.getFullYear();
  // ISO week number
  const d = new Date(Date.UTC(jst.getFullYear(), jst.getMonth(), jst.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return year * 100 + weekNo;
}

// ========================================
// 1. PENDING_APPROVALS: 前週の未承認人事・経費
// ========================================
registerAlertCheck('PENDING_APPROVALS', async () => {
  const { start, end } = getLastWeekRange();
  const weekId = getYYYYWW(start);

  // 勤怠: PENDING で前週の日付
  const pendingAttendance = await prisma.attendance.count({
    where: {
      status: 'PENDING',
      date: { gte: start, lte: end },
    },
  });

  // 経費: PENDING で前週の日付
  const pendingExpense = await prisma.expense.count({
    where: {
      status: 'PENDING',
      date: { gte: start, lte: end },
    },
  });

  if (pendingAttendance === 0 && pendingExpense === 0) {
    return { alerts: [] };
  }

  const parts: string[] = [];
  if (pendingAttendance > 0) parts.push(`勤怠承認 ${pendingAttendance}件`);
  if (pendingExpense > 0) parts.push(`経費承認 ${pendingExpense}件`);

  return {
    alerts: [
      {
        title: `前週の承認処理未対応: ${parts.join('・')}`,
        message: `前週分の承認処理が完了していません。${parts.join('、')}が未処理です。`,
        entityType: 'WeeklyApprovalCheck',
        entityId: weekId,
      },
    ],
  };
});

// ========================================
// 2. RESIDENCE_CARD_MISMATCH: 在留カード不一致
// イベント駆動型 — CRONでは何もしない
// ========================================
registerAlertCheck('RESIDENCE_CARD_MISMATCH', async () => {
  return { alerts: [] };
});

// ========================================
// メインの実行関数
// ========================================
export async function runAlertDefinitionChecks(): Promise<{
  checked: number;
  alertsCreated: number;
  errors: string[];
}> {
  const { createAlertNotification } = await import('@/lib/alert-notifications');

  const definitions = await prisma.alertDefinition.findMany({
    where: { isEnabled: true },
    include: { category: true },
  });

  const jstNow = getJSTDate();
  const dayOfWeek = jstNow.getDay();
  const dayOfMonth = jstNow.getDate();

  let checked = 0;
  let alertsCreated = 0;
  const errors: string[] = [];

  for (const def of definitions) {
    // 周期チェック
    if (def.frequency === 'WEEKLY' && dayOfWeek !== 1) continue;  // 月曜のみ
    if (def.frequency === 'MONTHLY' && dayOfMonth !== 1) continue; // 1日のみ
    // DAILY は毎日実行

    const checkFn = getAlertCheck(def.code);
    if (!checkFn) {
      errors.push(`No check function registered for code: ${def.code}`);
      continue;
    }

    try {
      checked++;
      const result = await checkFn(def);

      for (const alertData of result.alerts) {
        await createAlert({
          categoryId: def.categoryId,
          severity: def.severity,
          title: alertData.title,
          message: alertData.message,
          entityType: alertData.entityType,
          entityId: alertData.entityId,
        });

        // 通知生成
        if (def.notifyEnabled) {
          // alertId を取得（直前に作成されたアラート）
          const latestAlert = alertData.entityType && alertData.entityId
            ? await prisma.alert.findFirst({
                where: {
                  entityType: alertData.entityType,
                  entityId: alertData.entityId,
                  categoryId: def.categoryId,
                  status: 'OPEN',
                },
                orderBy: { createdAt: 'desc' },
              })
            : null;

          await createAlertNotification(
            def,
            latestAlert?.id ?? null,
            alertData.title,
            alertData.message,
          );
        }

        alertsCreated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error checking ${def.code}: ${msg}`);
    }
  }

  return { checked, alertsCreated, errors };
}
