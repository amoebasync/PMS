import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const shiftId = parseInt(id);
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.distributorShift.findUnique({
      where: { id: shiftId },
      include: { distributor: { select: { name: true } } },
    });

    if (!beforeData) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.note !== undefined) updateData.note = body.note || null;

    const updated = await prisma.$transaction(async (tx) => {
      const shift = await tx.distributorShift.update({
        where: { id: shiftId },
        data: updateData,
        include: {
          distributor: {
            select: { id: true, name: true, staffId: true, branch: { select: { id: true, nameJa: true } } },
          },
        },
      });

      const isStatusChange = body.status !== undefined && body.status !== beforeData.status;

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: isStatusChange ? 'STATUS_CHANGE' : 'UPDATE',
        targetModel: 'DistributorShift',
        targetId: shiftId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: shift as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: isStatusChange
          ? `配布員シフトステータス変更: ${beforeData.distributor.name} (${beforeData.status} → ${body.status})`
          : `配布員シフト更新: ${beforeData.distributor.name}`,
        tx,
      });

      return shift;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'この配布員はこの日付に既にシフトが登録されています' }, { status: 409 });
    }
    console.error('DistributorShift Update Error:', error);
    return NextResponse.json({ error: 'シフトの更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const shiftId = parseInt(id);
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.distributorShift.findUnique({
      where: { id: shiftId },
      include: { distributor: { select: { name: true } } },
    });

    if (!beforeData) {
      return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.distributorShift.delete({
        where: { id: shiftId },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'DistributorShift',
        targetId: shiftId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布員シフト削除: ${beforeData.distributor.name} (${beforeData.date.toISOString().split('T')[0]})`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DistributorShift Delete Error:', error);
    return NextResponse.json({ error: 'シフトの削除に失敗しました' }, { status: 500 });
  }
}
