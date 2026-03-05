import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { cookies } from 'next/headers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const inspections = await prisma.fieldInspection.findMany({
      where: { distributorId },
      orderBy: { inspectedAt: 'desc' },
      include: {
        inspector: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
    });

    return NextResponse.json(inspections);
  } catch (error) {
    console.error('List inspections error:', error);
    return NextResponse.json({ error: 'Failed to fetch inspections' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ipAddress = getIpAddress(request);
    if (!actorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const category = body.category || 'CHECK';

    const created = await prisma.fieldInspection.create({
      data: {
        distributorId,
        inspectorId: actorId,
        scheduleId: body.scheduleId ? parseInt(body.scheduleId) : null,
        inspectedAt: new Date(body.inspectedAt),
        category,
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
      },
    });

    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'CREATE',
      targetModel: 'FieldInspection',
      targetId: created.id,
      afterData: created as unknown as Record<string, unknown>,
      ipAddress,
      description: '現地確認記録作成',
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Create inspection error:', error);
    return NextResponse.json({ error: 'Failed to create inspection' }, { status: 500 });
  }
}
