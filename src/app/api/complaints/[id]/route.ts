import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/complaints/[id]
// クレーム詳細取得（全リレーション含む）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        complaintType: true,
        customer: true,
        distributor: {
          select: { id: true, name: true, staffId: true },
        },
        schedule: {
          select: { id: true, jobNumber: true, date: true },
        },
        branch: {
          select: { id: true, nameJa: true },
        },
        assignee: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
        sourcePartner: {
          select: { id: true, name: true },
        },
        responses: {
          include: {
            responder: {
              select: { id: true, lastNameJa: true, firstNameJa: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        prohibitedProperties: {
          select: { id: true, address: true, buildingName: true, isActive: true },
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, lastNameJa: true, firstNameJa: true },
            },
            taskCategory: {
              select: { id: true, name: true, code: true, icon: true, colorCls: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: 'クレームが見つかりません' }, { status: 404 });
    }

    return NextResponse.json(complaint);
  } catch (error) {
    console.error('Complaint Detail Error:', error);
    return NextResponse.json({ error: 'クレームの取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/complaints/[id]
// クレーム更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 更新前データ取得
    const beforeData = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!beforeData) {
      return NextResponse.json({ error: 'クレームが見つかりません' }, { status: 404 });
    }

    // 更新可能フィールドの構築
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) updateData.status = body.status;
    if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId ? Number(body.assigneeId) : null;
    if (body.complaintTypeId !== undefined) updateData.complaintTypeId = body.complaintTypeId ? Number(body.complaintTypeId) : null;
    if (body.customerId !== undefined) updateData.customerId = body.customerId ? Number(body.customerId) : null;
    if (body.distributorId !== undefined) updateData.distributorId = body.distributorId ? Number(body.distributorId) : null;
    if (body.scheduleId !== undefined) updateData.scheduleId = body.scheduleId ? Number(body.scheduleId) : null;
    if (body.branchId !== undefined) updateData.branchId = body.branchId ? Number(body.branchId) : null;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.buildingName !== undefined) updateData.buildingName = body.buildingName || null;
    if (body.roomNumber !== undefined) updateData.roomNumber = body.roomNumber || null;
    if (body.latitude !== undefined) updateData.latitude = body.latitude != null ? Number(body.latitude) : null;
    if (body.longitude !== undefined) updateData.longitude = body.longitude != null ? Number(body.longitude) : null;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrls !== undefined) updateData.imageUrls = body.imageUrls ? JSON.stringify(body.imageUrls) : null;
    // 新フィールド
    if (body.source !== undefined) updateData.source = body.source || null;
    if (body.sourceContactName !== undefined) updateData.sourceContactName = body.sourceContactName || null;
    if (body.sourceContactPhone !== undefined) updateData.sourceContactPhone = body.sourceContactPhone || null;
    if (body.sourcePartnerId !== undefined) updateData.sourcePartnerId = body.sourcePartnerId ? Number(body.sourcePartnerId) : null;
    if (body.needsResponse !== undefined) updateData.needsResponse = !!body.needsResponse;
    if (body.needsCustomerReport !== undefined) updateData.needsCustomerReport = !!body.needsCustomerReport;
    if (body.penaltyScore !== undefined) updateData.penaltyScore = body.penaltyScore !== null ? Number(body.penaltyScore) : null;

    const isStatusChange = body.status !== undefined && body.status !== beforeData.status;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.complaint.update({
        where: { id: complaintId },
        data: updateData,
        include: {
          complaintType: true,
          customer: true,
          distributor: {
            select: { id: true, name: true, staffId: true },
          },
          schedule: {
            select: { id: true, jobNumber: true, date: true },
          },
          branch: {
            select: { id: true, nameJa: true },
          },
          assignee: {
            select: { id: true, lastNameJa: true, firstNameJa: true },
          },
          sourcePartner: {
            select: { id: true, name: true },
          },
          responses: {
            include: {
              responder: {
                select: { id: true, lastNameJa: true, firstNameJa: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          prohibitedProperties: {
            select: { id: true, address: true, buildingName: true, isActive: true },
          },
          tasks: {
            include: {
              assignee: {
                select: { id: true, lastNameJa: true, firstNameJa: true },
              },
              taskCategory: {
                select: { id: true, name: true, code: true, icon: true, colorCls: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: isStatusChange ? 'STATUS_CHANGE' : 'UPDATE',
        targetModel: 'Complaint',
        targetId: complaintId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: isStatusChange
          ? `クレーム「${result.title}」のステータスを変更（${beforeData.status} -> ${result.status}）`
          : `クレーム「${result.title}」を更新`,
        tx,
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Complaint Update Error:', error);
    return NextResponse.json({ error: 'クレームの更新に失敗しました' }, { status: 500 });
  }
}
