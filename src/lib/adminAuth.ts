import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 管理者セッションを検証する。
 * pms_session Cookie の値（Employee ID）をDBで確認し、有効な社員を返す。
 * 無効な場合は null を返す。
 */
export async function getAdminSession() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return null;

    const empId = parseInt(sessionId);
    if (isNaN(empId)) return null;

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: { id: true, lastNameJa: true, firstNameJa: true, isActive: true },
    });

    if (!employee || !employee.isActive) return null;

    return employee;
  } catch {
    return null;
  }
}

/**
 * 管理者セッション必須のAPIルート用ガード。
 * 認証失敗時は 401 レスポンスを返す。
 * 成功時は Employee 情報を返す。
 */
export async function requireAdminSession() {
  const employee = await getAdminSession();
  if (!employee) {
    return { error: NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 }), employee: null };
  }
  return { error: null, employee };
}
