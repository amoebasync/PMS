import { prisma } from '@/lib/prisma';
import type { AlertDefinition } from '@prisma/client';

/**
 * アラート定義のターゲット設定に基づいて対象社員IDリストを解決する
 */
export async function resolveTargetEmployeeIds(def: AlertDefinition): Promise<number[]> {
  switch (def.targetType) {
    case 'ALL': {
      const employees = await prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      return employees.map(e => e.id);
    }
    case 'ROLE': {
      const roleIds = parseTargetIds(def.targetIds);
      if (roleIds.length === 0) return [];
      const employeeRoles = await prisma.employeeRole.findMany({
        where: { roleId: { in: roleIds } },
        select: { employeeId: true },
      });
      return [...new Set(employeeRoles.map(er => er.employeeId))];
    }
    case 'DEPARTMENT': {
      const deptIds = parseTargetIds(def.targetIds);
      if (deptIds.length === 0) return [];
      const employees = await prisma.employee.findMany({
        where: { departmentId: { in: deptIds }, isActive: true },
        select: { id: true },
      });
      return employees.map(e => e.id);
    }
    case 'EMPLOYEE': {
      return parseTargetIds(def.targetIds);
    }
    default:
      return [];
  }
}

function parseTargetIds(targetIds: string | null): number[] {
  if (!targetIds) return [];
  try {
    const parsed = JSON.parse(targetIds);
    if (Array.isArray(parsed)) return parsed.map(Number).filter(n => !isNaN(n));
  } catch {
    // fallback: カンマ区切り
    return targetIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
  }
  return [];
}

/**
 * アラート定義に基づいてAdminNotificationを対象社員に作成する
 */
export async function createAlertNotification(
  def: AlertDefinition,
  alertId: number | null,
  title: string,
  message: string,
): Promise<void> {
  if (!def.notifyEnabled) return;

  const employeeIds = await resolveTargetEmployeeIds(def);
  if (employeeIds.length === 0) return;

  // バルクインサート
  await prisma.adminNotification.createMany({
    data: employeeIds.map(empId => ({
      type: 'ALERT' as const,
      title,
      message,
      recipientId: empId,
      alertDefinitionId: def.id,
      alertId: alertId,
    })),
  });
}
