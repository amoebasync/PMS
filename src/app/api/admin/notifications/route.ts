import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET /api/admin/notifications — 管理者通知一覧取得
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session');
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const currentEmployeeId = parseInt(session.value);

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const sinceId = searchParams.get('sinceId') ? parseInt(searchParams.get('sinceId')!) : undefined;

    // recipientId が null（全員向け）または自分宛の通知のみ表示
    const recipientFilter = isNaN(currentEmployeeId)
      ? { recipientId: null }
      : { OR: [{ recipientId: null }, { recipientId: currentEmployeeId }] };

    const where: any = { ...recipientFilter };
    if (unreadOnly) {
      where.isRead = false;
    }
    if (sinceId) {
      where.id = { gt: sinceId };
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          distributor: { select: { name: true, staffId: true } },
        },
      }),
      prisma.adminNotification.count({
        where: {
          isRead: false,
          ...recipientFilter,
        },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        scheduleId: n.scheduleId,
        distributorId: n.distributorId,
        distributorName: n.distributor?.name,
        alertDefinitionId: n.alertDefinitionId,
        alertId: n.alertId,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('Admin Notifications Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
