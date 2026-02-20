import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { scheduleId, slotIndex, odaId } = await request.json();

    const oda = await prisma.orderDistributionArea.findUnique({
      where: { id: parseInt(odaId) },
      include: { orderDistribution: { include: { order: true, flyer: true } }, area: true }
    });
    if (!oda || !oda.orderDistribution) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const od = oda.orderDistribution;
    const areaCap = od.method === '集合住宅限定' ? oda.area.multi_family_count : oda.area.door_to_door_count;

    const newItem = await prisma.distributionItem.create({
      data: {
        scheduleId: parseInt(scheduleId), slotIndex: parseInt(slotIndex),
        flyerId: od.flyerId, orderId: od.orderId, customerId: od.order.customerId,
        flyerName: od.flyer.name, flyerCode: od.flyer.flyerCode, method: od.method,
        plannedCount: areaCap || 0, startDate: od.startDate, endDate: od.endDate, spareDate: od.spareDate,
      }
    });
    return NextResponse.json(newItem);
  } catch (error) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const data: any = {};
    if (body.targetScheduleId !== undefined) data.scheduleId = parseInt(body.targetScheduleId);
    if (body.targetSlotIndex !== undefined) data.slotIndex = parseInt(body.targetSlotIndex);
    // ★ 追加: 手配枚数を変更できるようにする
    if (body.plannedCount !== undefined) data.plannedCount = parseInt(body.plannedCount);

    const updated = await prisma.distributionItem.update({
      where: { id: parseInt(body.itemId) },
      data
    });
    return NextResponse.json(updated);
  } catch (error) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await prisma.distributionItem.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}