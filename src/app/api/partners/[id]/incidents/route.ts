import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = { partnerId };
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (dateFrom || dateTo) {
      const occurredAt: Record<string, Date> = {};
      if (dateFrom) occurredAt.gte = new Date(dateFrom);
      if (dateTo) occurredAt.lte = new Date(dateTo);
      where.occurredAt = occurredAt;
    }

    const incidents = await prisma.partnerIncident.findMany({
      where,
      include: {
        resolver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });

    return NextResponse.json(incidents);
  } catch (error) {
    console.error('Get PartnerIncidents Error:', error);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    const body = await request.json();

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const created = await prisma.partnerIncident.create({
      data: {
        partnerId,
        title: body.title,
        description: body.description,
        severity: body.severity || 'MEDIUM',
        occurredAt: new Date(body.occurredAt),
        note: body.note || null,
      },
      include: {
        resolver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'CREATE',
      targetModel: 'PartnerIncident',
      targetId: created.id,
      afterData: created as unknown as Record<string, unknown>,
      ipAddress,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Create PartnerIncident Error:', error);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}
