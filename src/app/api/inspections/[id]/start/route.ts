import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// POST /api/inspections/[id]/start
// 現地確認を開始（巡回セッション作成・GPS記録開始）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, employee } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    let latitude: any = null, longitude: any = null;
    try {
      const body = await request.json();
      latitude = body.latitude;
      longitude = body.longitude;
    } catch { /* bodyなしでもOK */ }

    const inspection = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    if (inspection.status !== 'PENDING') {
      return NextResponse.json({ error: '開始できるのはPENDINGステータスの現地確認のみです' }, { status: 400 });
    }

    // 既存セッションチェック
    const existingSession = await prisma.inspectionSession.findUnique({
      where: { inspectionId },
    });

    if (existingSession) {
      return NextResponse.json({ error: '既にセッションが作成されています' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // InspectionSession作成
      const session = await tx.inspectionSession.create({
        data: {
          inspectionId,
          inspectorId: employee!.id,
          startedAt: now,
        },
      });

      // 初回GPS座標を記録
      if (latitude != null && longitude != null) {
        await tx.inspectionGpsPoint.create({
          data: {
            sessionId: session.id,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            timestamp: now,
          },
        });
      }

      // FieldInspectionステータス更新
      const updated = await tx.fieldInspection.update({
        where: { id: inspectionId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: now,
        },
        include: {
          distributor: { select: { id: true, name: true, staffId: true } },
          inspector: { select: { id: true, lastNameJa: true, firstNameJa: true } },
          inspectionSession: true,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'STATUS_CHANGE',
        targetModel: 'FieldInspection',
        targetId: inspectionId,
        beforeData: inspection as unknown as Record<string, unknown>,
        afterData: updated as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `現地確認を開始（ID: ${inspectionId}）`,
        tx,
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/inspections/[id]/start error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
