import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

const prisma = new PrismaClient();

// PUT /api/staff/schedules/report
// 自分のスケジュールアイテムの actualCount を報告する
export async function PUT(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { itemId, actualCount } = await request.json();
    if (itemId === undefined || actualCount === undefined) {
      return NextResponse.json({ error: 'itemId と actualCount は必須です' }, { status: 400 });
    }

    // アイテムが本当に自分のスケジュールに属するか確認
    const item = await prisma.distributionItem.findUnique({
      where: { id: parseInt(itemId) },
      include: {
        schedule: { select: { distributorId: true } },
      },
    });

    if (!item || item.schedule?.distributorId !== distributor.id) {
      return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 });
    }

    const updated = await prisma.distributionItem.update({
      where: { id: parseInt(itemId) },
      data: { actualCount: parseInt(actualCount) },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Staff Schedule Report Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
