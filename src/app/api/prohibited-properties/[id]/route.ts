import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/prohibited-properties/[id]
// 管理者: 配布禁止物件詳細
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const property = await prisma.prohibitedProperty.findUnique({
      where: { id },
      include: {
        prefecture: true,
        city: true,
        area: true,
        customer: { select: { id: true, name: true, customerCode: true } },
        prohibitedReason: true,
        complaint: {
          include: {
            complaintType: true,
            customer: { select: { id: true, name: true } },
            distributor: { select: { id: true, name: true } },
            assignee: { select: { id: true, lastNameJa: true, firstNameJa: true } },
            responses: {
              include: {
                responder: { select: { id: true, lastNameJa: true, firstNameJa: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: '配布禁止物件が見つかりません' }, { status: 404 });
    }

    return NextResponse.json(property);
  } catch (error) {
    console.error('ProhibitedProperty Detail Error:', error);
    return NextResponse.json({ error: '配布禁止物件の取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/prohibited-properties/[id]
// 管理者: 配布禁止物件を更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.prohibitedProperty.findUnique({ where: { id } });
    if (!beforeData) {
      return NextResponse.json({ error: '配布禁止物件が見つかりません' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const property = await tx.prohibitedProperty.update({
        where: { id },
        data: {
          prefectureId: body.prefectureId !== undefined ? (body.prefectureId ? Number(body.prefectureId) : null) : undefined,
          cityId: body.cityId !== undefined ? (body.cityId ? Number(body.cityId) : null) : undefined,
          areaId: body.areaId !== undefined ? (body.areaId ? Number(body.areaId) : null) : undefined,
          postalCode: body.postalCode !== undefined ? (body.postalCode || null) : undefined,
          address: body.address !== undefined ? body.address : undefined,
          buildingName: body.buildingName !== undefined ? (body.buildingName || null) : undefined,
          roomNumber: body.roomNumber !== undefined ? (body.roomNumber || null) : undefined,
          latitude: body.latitude !== undefined ? (body.latitude ? Number(body.latitude) : null) : undefined,
          longitude: body.longitude !== undefined ? (body.longitude ? Number(body.longitude) : null) : undefined,
          boundaryGeojson: body.boundaryGeojson !== undefined ? (body.boundaryGeojson || null) : undefined,
          customerId: body.customerId !== undefined ? (body.customerId ? Number(body.customerId) : null) : undefined,
          prohibitedReasonId: body.prohibitedReasonId !== undefined ? (body.prohibitedReasonId ? Number(body.prohibitedReasonId) : null) : undefined,
          reasonDetail: body.reasonDetail !== undefined ? (body.reasonDetail || null) : undefined,
          originalCode: body.originalCode !== undefined ? (body.originalCode || null) : undefined,
          externalCustomerCode: body.externalCustomerCode !== undefined ? (body.externalCustomerCode || null) : undefined,
          imageUrls: body.imageUrls !== undefined ? (body.imageUrls || null) : undefined,
          isActive: body.isActive !== undefined ? body.isActive : undefined,
          deactivatedAt: body.deactivatedAt !== undefined ? (body.deactivatedAt ? new Date(body.deactivatedAt) : null) : undefined,
          deactivateReason: body.deactivateReason !== undefined ? (body.deactivateReason || null) : undefined,
          complaintId: body.complaintId !== undefined ? (body.complaintId ? Number(body.complaintId) : null) : undefined,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'ProhibitedProperty',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: property as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布禁止物件「${property.address}${property.buildingName ? ' ' + property.buildingName : ''}」を更新`,
        tx,
      });

      return property;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('ProhibitedProperty Update Error:', error);
    return NextResponse.json({ error: '配布禁止物件の更新に失敗しました' }, { status: 500 });
  }
}
