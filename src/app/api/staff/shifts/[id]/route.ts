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

    // 翌日のシフトは削除不可
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const shiftDate = new Date(shift.date);
    shiftDate.setHours(0, 0, 0, 0);

    if (shiftDate >= tomorrow && shiftDate < dayAfterTomorrow) {
      return NextResponse.json({ error: '翌日のシフトは削除できません' }, { status: 400 });
    }

    await prisma.distributorShift.delete({ where: { id: shiftId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Distributor Shift DELETE Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
