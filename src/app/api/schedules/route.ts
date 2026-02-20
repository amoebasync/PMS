import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    const whereClause: any = {};
    if (from || to) {
      whereClause.date = {};
      if (from) whereClause.date.gte = new Date(from);
      if (to) whereClause.date.lte = new Date(to);
    }

    const schedules = await prisma.distributionSchedule.findMany({
      where: whereClause,
      include: {
        branch: true, distributor: true, city: true,
        area: { include: { prefecture: true, city: true } },
        items: { 
          orderBy: { slotIndex: 'asc' },
          include: { flyer: { include: { size: true } } } // ★ サイズ情報を追加
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Failed to fetch schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'CREATE_FROM_UNASSIGNED') {
      const { date, odaId } = body;
      const oda = await prisma.orderDistributionArea.findUnique({
        where: { id: parseInt(odaId) },
        include: { orderDistribution: { include: { order: true, flyer: true } }, area: true }
      });
      if (!oda || !oda.orderDistribution) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const newSchedule = await prisma.distributionSchedule.create({
        data: {
          date: new Date(date),
          areaId: oda.areaId,
          cityId: oda.area.city_id,
          status: 'UNSTARTED'
        }
      });

      const od = oda.orderDistribution;
      const areaCap = od.method === '集合住宅限定' ? oda.area.multi_family_count : oda.area.door_to_door_count;
      await prisma.distributionItem.create({
        data: {
          scheduleId: newSchedule.id, slotIndex: 1,
          flyerId: od.flyerId, orderId: od.orderId, customerId: od.order.customerId,
          flyerName: od.flyer.name, flyerCode: od.flyer.flyerCode, method: od.method,
          plannedCount: areaCap || 0, startDate: od.startDate, endDate: od.endDate, spareDate: od.spareDate,
        }
      });
      return NextResponse.json(newSchedule);
    }

    const newSchedule = await prisma.distributionSchedule.create({
      data: {
        date: body.date ? new Date(body.date) : null,
        areaId: body.areaId ? parseInt(body.areaId) : null,
        branchId: body.branchId ? parseInt(body.branchId) : null,
        distributorId: body.distributorId ? parseInt(body.distributorId) : null,
        status: 'UNSTARTED'
      }
    });
    return NextResponse.json(newSchedule);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}