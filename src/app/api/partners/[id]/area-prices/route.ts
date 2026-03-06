import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);

    const prices = await prisma.partnerAreaPrice.findMany({
      where: { partnerId },
      include: {
        prefecture: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        flyerSize: { select: { id: true, name: true } },
      },
      orderBy: [{ prefectureId: 'asc' }, { cityId: 'asc' }],
    });

    return NextResponse.json(prices);
  } catch (error) {
    console.error('Get PartnerAreaPrices Error:', error);
    return NextResponse.json({ error: 'Failed to fetch area prices' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    const body = await request.json();

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const created = await prisma.partnerAreaPrice.create({
      data: {
        partnerId,
        prefectureId: parseInt(body.prefectureId, 10),
        cityId: body.cityId ? parseInt(body.cityId, 10) : null,
        flyerSizeId: parseInt(body.flyerSizeId, 10),
        periodDaysMin: parseInt(body.periodDaysMin, 10),
        periodDaysMax: parseInt(body.periodDaysMax, 10),
        unitPrice: parseFloat(body.unitPrice),
        note: body.note || null,
      },
      include: {
        prefecture: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        flyerSize: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'CREATE',
      targetModel: 'PartnerAreaPrice',
      targetId: created.id,
      afterData: created as unknown as Record<string, unknown>,
      ipAddress,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Create PartnerAreaPrice Error:', error);
    return NextResponse.json({ error: 'Failed to create area price' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const priceId = parseInt(body.id, 10);
    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeData = await prisma.partnerAreaPrice.findFirst({
      where: { id: priceId, partnerId },
    });
    if (!beforeData) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.prefectureId !== undefined) updateData.prefectureId = parseInt(body.prefectureId, 10);
    if (body.cityId !== undefined) updateData.cityId = body.cityId ? parseInt(body.cityId, 10) : null;
    if (body.flyerSizeId !== undefined) updateData.flyerSizeId = parseInt(body.flyerSizeId, 10);
    if (body.periodDaysMin !== undefined) updateData.periodDaysMin = parseInt(body.periodDaysMin, 10);
    if (body.periodDaysMax !== undefined) updateData.periodDaysMax = parseInt(body.periodDaysMax, 10);
    if (body.unitPrice !== undefined) updateData.unitPrice = parseFloat(body.unitPrice);
    if (body.note !== undefined) updateData.note = body.note || null;

    const updated = await prisma.partnerAreaPrice.update({
      where: { id: priceId },
      data: updateData,
      include: {
        prefecture: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        flyerSize: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'UPDATE',
      targetModel: 'PartnerAreaPrice',
      targetId: priceId,
      beforeData: beforeData as unknown as Record<string, unknown>,
      afterData: updated as unknown as Record<string, unknown>,
      ipAddress,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update PartnerAreaPrice Error:', error);
    return NextResponse.json({ error: 'Failed to update area price' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    const body = await request.json();

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    const ids = body.ids.map((i: number | string) => parseInt(String(i), 10));

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeRecords = await prisma.partnerAreaPrice.findMany({
      where: { id: { in: ids }, partnerId },
    });

    const result = await prisma.partnerAreaPrice.deleteMany({
      where: { id: { in: ids }, partnerId },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'DELETE',
      targetModel: 'PartnerAreaPrice',
      targetId: null,
      beforeData: { deletedIds: ids, records: beforeRecords } as unknown as Record<string, unknown>,
      ipAddress,
      description: `Bulk delete ${result.count} area prices`,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Delete PartnerAreaPrice Error:', error);
    return NextResponse.json({ error: 'Failed to delete area prices' }, { status: 500 });
  }
}
