import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// PUT /api/admin/notifications/read — 通知既読
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session');
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, all } = body;

    if (all) {
      // 全て既読
      await prisma.adminNotification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
    } else if (Array.isArray(ids) && ids.length > 0) {
      // 指定IDを既読
      await prisma.adminNotification.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      });
    } else {
      return NextResponse.json({ error: 'ids または all: true を指定してください' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Notification Read Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
