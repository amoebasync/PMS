import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { cookies } from 'next/headers';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; inspectionId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, inspectionId } = await params;
    const distributorId = parseInt(id);
    const inspId = parseInt(inspectionId);
    if (isNaN(distributorId) || isNaN(inspId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeData = await prisma.fieldInspection.findUnique({
      where: { id: inspId },
    });
    if (!beforeData || beforeData.distributorId !== distributorId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const category = body.category ?? beforeData.category;

    // When category changes, clear the other category's fields
    const clearCheck = category === 'GUIDANCE' ? {
      coverageChecked: null,
      coverageFound: null,
      prohibitedTotal: null,
      prohibitedViolations: null,
      multipleInsertion: null,
      fraudTrace: null,
    } : {};

    const clearGuidance = category === 'CHECK' ? {
      distributionSpeed: null,
      stickerCompliance: null,
      prohibitedCompliance: null,
      mapComprehension: null,
      workAttitude: null,
    } : {};

    const updated = await prisma.fieldInspection.update({
      where: { id: inspId },
      data: {
        inspectedAt: body.inspectedAt ? new Date(body.inspectedAt) : undefined,
        category,
        ...clearCheck,
        ...clearGuidance,
        // CHECK fields
        ...(category === 'CHECK' ? {
          coverageChecked: body.coverageChecked ?? null,
          coverageFound: body.coverageFound ?? null,
          prohibitedTotal: body.prohibitedTotal ?? null,
          prohibitedViolations: body.prohibitedViolations ?? null,
          multipleInsertion: body.multipleInsertion ?? null,
          fraudTrace: body.fraudTrace ?? null,
        } : {}),
        // GUIDANCE fields
        ...(category === 'GUIDANCE' ? {
          distributionSpeed: body.distributionSpeed ?? null,
          stickerCompliance: body.stickerCompliance ?? null,
          prohibitedCompliance: body.prohibitedCompliance ?? null,
          mapComprehension: body.mapComprehension ?? null,
          workAttitude: body.workAttitude ?? null,
        } : {}),
        // Common
        note: body.note ?? null,
        followUpRequired: body.followUpRequired ?? false,
        scheduleId: body.scheduleId !== undefined
          ? (body.scheduleId ? parseInt(body.scheduleId) : null)
          : undefined,
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'UPDATE',
      targetModel: 'FieldInspection',
      targetId: inspId,
      beforeData: beforeData as unknown as Record<string, unknown>,
      afterData: updated as unknown as Record<string, unknown>,
      ipAddress,
      description: '現地確認記録更新',
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update inspection error:', error);
    return NextResponse.json({ error: 'Failed to update inspection' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; inspectionId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, inspectionId } = await params;
    const distributorId = parseInt(id);
    const inspId = parseInt(inspectionId);
    if (isNaN(distributorId) || isNaN(inspId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);

    const beforeData = await prisma.fieldInspection.findUnique({
      where: { id: inspId },
    });
    if (!beforeData || beforeData.distributorId !== distributorId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.fieldInspection.delete({
      where: { id: inspId },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'DELETE',
      targetModel: 'FieldInspection',
      targetId: inspId,
      beforeData: beforeData as unknown as Record<string, unknown>,
      ipAddress,
      description: '現地確認記録削除',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete inspection error:', error);
    return NextResponse.json({ error: 'Failed to delete inspection' }, { status: 500 });
  }
}
