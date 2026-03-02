import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  // SUPER_ADMIN のみアクセス可
  const empId = parseInt(sessionId);
  const employee = await prisma.employee.findUnique({
    where: { id: empId },
    include: { roles: { include: { role: true } } },
  });
  const isSuperAdmin = employee?.roles?.some(r => r.role.code === 'SUPER_ADMIN');
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const logId = parseInt(id);
    if (isNaN(logId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const log = await prisma.auditLog.findUnique({ where: { id: logId } });
    if (!log) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(log);
  } catch (error) {
    console.error('AuditLog Detail GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
