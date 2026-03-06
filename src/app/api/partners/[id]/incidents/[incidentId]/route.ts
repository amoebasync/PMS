import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  try {
    const { id, incidentId } = await params;
    const partnerId = parseInt(id, 10);
    const parsedIncidentId = parseInt(incidentId, 10);

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeData = await prisma.partnerIncident.findFirst({
      where: { id: parsedIncidentId, partnerId },
    });
    if (!beforeData) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.severity !== undefined) updateData.severity = body.severity;
    if (body.status !== undefined) {
      updateData.status = body.status;
      // Auto-set resolvedAt when status changes to RESOLVED
      if (body.status === 'RESOLVED' && beforeData.status !== 'RESOLVED') {
        updateData.resolvedAt = new Date();
      }
    }
    if (body.occurredAt !== undefined) updateData.occurredAt = new Date(body.occurredAt);
    if (body.resolvedAt !== undefined) updateData.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : null;
    if (body.resolvedBy !== undefined) updateData.resolvedBy = body.resolvedBy ? parseInt(body.resolvedBy, 10) : null;
    if (body.note !== undefined) updateData.note = body.note || null;

    const updated = await prisma.partnerIncident.update({
      where: { id: parsedIncidentId },
      data: updateData,
      include: {
        resolver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'UPDATE',
      targetModel: 'PartnerIncident',
      targetId: parsedIncidentId,
      beforeData: beforeData as unknown as Record<string, unknown>,
      afterData: updated as unknown as Record<string, unknown>,
      ipAddress,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update PartnerIncident Error:', error);
    return NextResponse.json({ error: 'Failed to update incident' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; incidentId: string }> }
) {
  try {
    const { id, incidentId } = await params;
    const partnerId = parseInt(id, 10);
    const parsedIncidentId = parseInt(incidentId, 10);

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeData = await prisma.partnerIncident.findFirst({
      where: { id: parsedIncidentId, partnerId },
    });
    if (!beforeData) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.partnerIncident.delete({
      where: { id: parsedIncidentId },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'DELETE',
      targetModel: 'PartnerIncident',
      targetId: parsedIncidentId,
      beforeData: beforeData as unknown as Record<string, unknown>,
      ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete PartnerIncident Error:', error);
    return NextResponse.json({ error: 'Failed to delete incident' }, { status: 500 });
  }
}
