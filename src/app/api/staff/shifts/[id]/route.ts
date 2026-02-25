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

    await prisma.distributorShift.delete({ where: { id: shiftId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Distributor Shift DELETE Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
