import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/inspections/[id]
// 現地確認詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const inspection = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
      include: {
        distributor: {
          select: { id: true, name: true, staffId: true },
        },
        inspector: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
        schedule: {
          select: {
            id: true,
            jobNumber: true,
            date: true,
            status: true,
            checkGps: true,
            checkGpsResult: true,
            checkGpsComment: true,
            distributor: { select: { id: true, name: true, staffId: true } },
            area: {
              include: {
                prefecture: { select: { name: true } },
                city: { select: { name: true } },
              },
            },
            items: {
              include: {
                customer: { select: { id: true, name: true } },
                flyer: { select: { id: true, name: true, flyerCode: true } },
              },
              orderBy: { slotIndex: 'asc' },
            },
          },
        },
        checkpoints: {
          orderBy: { checkedAt: 'asc' },
        },
        prohibitedChecks: {
          include: {
            prohibitedProperty: {
              select: {
                id: true,
                address: true,
                buildingName: true,
                roomNumber: true,
                latitude: true,
                longitude: true,
              },
            },
          },
          orderBy: { checkedAt: 'asc' },
        },
        inspectionSession: {
          include: {
            gpsPoints: {
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
    });

    if (!inspection) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    return NextResponse.json(inspection);
  } catch (err) {
    console.error('GET /api/inspections/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/inspections/[id]
// 現地確認更新（指導項目・メモ等）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
    });

    if (!beforeData) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    // 更新可能フィールド
    const updateData: Record<string, unknown> = {};

    // 指導項目
    if (body.distributionSpeed !== undefined) updateData.distributionSpeed = body.distributionSpeed || null;
    if (body.stickerCompliance !== undefined) updateData.stickerCompliance = body.stickerCompliance || null;
    if (body.prohibitedCompliance !== undefined) updateData.prohibitedCompliance = body.prohibitedCompliance || null;
    if (body.mapComprehension !== undefined) updateData.mapComprehension = body.mapComprehension || null;
    if (body.workAttitude !== undefined) updateData.workAttitude = body.workAttitude || null;

    // チェック項目
    if (body.multipleInsertion !== undefined) updateData.multipleInsertion = body.multipleInsertion || null;
    if (body.fraudTrace !== undefined) updateData.fraudTrace = body.fraudTrace || null;

    // 共通
    if (body.note !== undefined) updateData.note = body.note || null;
    if (body.followUpRequired !== undefined) updateData.followUpRequired = !!body.followUpRequired;
    if (body.samplePointsJson !== undefined) updateData.samplePointsJson = body.samplePointsJson || null;

    // ステータス変更（完了→巡回中に戻す）
    if (body.status !== undefined) {
      const allowedTransitions: Record<string, string[]> = {
        'COMPLETED': ['IN_PROGRESS'],
        'IN_PROGRESS': ['COMPLETED'],
      };
      const current = beforeData.status;
      if (allowedTransitions[current]?.includes(body.status)) {
        updateData.status = body.status;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.fieldInspection.update({
        where: { id: inspectionId },
        data: updateData,
        include: {
          distributor: { select: { id: true, name: true, staffId: true } },
          inspector: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'FieldInspection',
        targetId: inspectionId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `現地確認を更新（ID: ${inspectionId}）`,
        tx,
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /api/inspections/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/inspections/[id]
// 現地確認キャンセル
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
    });

    if (!beforeData) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    if (beforeData.status === 'CANCELLED') {
      return NextResponse.json({ error: '既にキャンセル済みです' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.fieldInspection.update({
        where: { id: inspectionId },
        data: { status: 'CANCELLED' },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'STATUS_CHANGE',
        targetModel: 'FieldInspection',
        targetId: inspectionId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `現地確認をキャンセル（ID: ${inspectionId}）`,
        tx,
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('DELETE /api/inspections/[id] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
