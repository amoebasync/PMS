import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    const distributorId = searchParams.get('distributorId');
    const whereClause: any = {};
    if (distributorId) {
      whereClause.distributorId = parseInt(distributorId);
    }
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      whereClause.date = { gte: d, lt: nextDay };
    } else if (from || to) {
      whereClause.date = {};
      if (from) whereClause.date.gte = new Date(from);
      if (to) whereClause.date.lte = new Date(to);
    }

    const schedules = await prisma.distributionSchedule.findMany({
      where: whereClause,
      include: {
        branch: true, distributor: true, city: true,
        area: {
          select: {
            id: true, address_code: true, town_name: true, chome_name: true,
            door_to_door_count: true, multi_family_count: true,
            prefecture: { select: { id: true, name: true } },
            city: { select: { id: true, name: true } },
          },
        },
        items: {
          orderBy: { slotIndex: 'asc' },
          include: { flyer: { include: { size: true } } }
        },
        session: { select: { id: true, startedAt: true, finishedAt: true } },
        checkedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
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