import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partner = await prisma.partner.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        partnerType: true,
        _count: {
          select: {
            coverageAreas: true,
            incidents: true,
            complaints: true,
          }
        }
      }
    });
    if (!partner) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(partner);
  } catch (error) {
    console.error('Get Partner Error:', error);
    return NextResponse.json({ error: 'Failed to fetch partner' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsedId = parseInt(id, 10);
    const body = await request.json();

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeData = await prisma.partner.findUnique({ where: { id: parsedId } });
    if (!beforeData) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.partner.update({
      where: { id: parsedId },
      data: {
        name: body.name,
        partnerTypeId: parseInt(body.partnerTypeId, 10),
        contactInfo: body.contactInfo || null,
        hasGpsTracking: body.hasGpsTracking ?? false,
        contactPerson: body.contactPerson || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        isActive: body.isActive ?? true,
        note: body.note || null,
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'UPDATE',
      targetModel: 'Partner',
      targetId: parsedId,
      beforeData: beforeData as Record<string, unknown>,
      afterData: updated as unknown as Record<string, unknown>,
      ipAddress,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Partner Error:', error);
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsedId = parseInt(id, 10);

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeData = await prisma.partner.findUnique({ where: { id: parsedId } });
    if (!beforeData) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.partner.update({
      where: { id: parsedId },
      data: { isActive: false },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'DELETE',
      targetModel: 'Partner',
      targetId: parsedId,
      beforeData: beforeData as Record<string, unknown>,
      afterData: updated as unknown as Record<string, unknown>,
      ipAddress,
      description: 'Soft-delete (isActive → false)',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Partner Error:', error);
    return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 });
  }
}
