import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// POST /api/complaints/[id]/register-prohibited
// クレームから禁止物件を登録
export async function POST(
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
    const { prohibitedReasonId, customerId, reasonDetail } = body;

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // クレーム取得
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
    });

    if (!complaint) {
      return NextResponse.json({ error: 'クレームが見つかりません' }, { status: 404 });
    }

    const created = await prisma.$transaction(async (tx) => {
      // クレーム情報から禁止物件を作成
      const prohibitedProperty = await tx.prohibitedProperty.create({
        data: {
          address: complaint.address,
          buildingName: complaint.buildingName,
          roomNumber: complaint.roomNumber,
          latitude: complaint.latitude,
          longitude: complaint.longitude,
          complaintId: complaint.id,
          prohibitedReasonId: prohibitedReasonId ? Number(prohibitedReasonId) : null,
          customerId: customerId ? Number(customerId) : (complaint.customerId ?? null),
          reasonDetail: reasonDetail || null,
        },
        include: {
          complaint: {
            select: { id: true, title: true },
          },
          prohibitedReason: true,
          customer: true,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'ProhibitedProperty',
        targetId: prohibitedProperty.id,
        afterData: prohibitedProperty as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `クレーム「${complaint.title}」(ID:${complaint.id})から禁止物件を登録（${complaint.address}）`,
        tx,
      });

      return prohibitedProperty;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Register Prohibited Property Error:', error);
    return NextResponse.json({ error: '禁止物件の登録に失敗しました' }, { status: 500 });
  }
}
