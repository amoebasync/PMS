import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { id } = await params;
    const shiftId = parseInt(id);
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const shift = await prisma.distributorShift.findUnique({
      where: { id: shiftId },
    });

    if (!shift || shift.distributorId !== distributor.id) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 });
    }

    // 当日・翌日（9時以降）のシフトはキャンセル不可
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const hour = now.getHours();

    const shiftDate = new Date(shift.date);
    shiftDate.setHours(0, 0, 0, 0);

    // 当日のシフトは常にキャンセル不可
    if (shiftDate.getTime() === today.getTime()) {
      return NextResponse.json({ error: '当日のシフトはキャンセルできません。もしもの場合はLINEで会社にご相談ください' }, { status: 400 });
    }

    // 翌日のシフトは9時以降キャンセル不可
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (shiftDate.getTime() === tomorrow.getTime() && hour >= 9) {
      return NextResponse.json({ error: '午前9時以降は翌日のシフトをキャンセルできません。もしもの場合はLINEで会社にご相談ください' }, { status: 400 });
    }

    await prisma.distributorShift.delete({ where: { id: shiftId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Distributor Shift DELETE Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
