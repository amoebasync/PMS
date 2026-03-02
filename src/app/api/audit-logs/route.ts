import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


export async function GET(request: Request) {
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
    return NextResponse.json({ error: 'アクセス権限がありません。スーパー管理者のみ閲覧できます' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const action = searchParams.get('action') || '';
    const actorType = searchParams.get('actorType') || '';
    const targetModel = searchParams.get('targetModel') || '';
    const actorName = searchParams.get('actorName') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (action) where.action = action;
    if (actorType) where.actorType = actorType;
    if (targetModel) where.targetModel = targetModel;
    if (actorName) where.actorName = { contains: actorName };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        where.createdAt.lt = end;
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          actorType: true,
          actorId: true,
          actorName: true,
          action: true,
          targetModel: true,
          targetId: true,
          description: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      data: logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('AuditLog GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
