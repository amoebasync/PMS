import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const expenseId = parseInt(id);
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.distributorExpense.findUnique({
      where: { id: expenseId },
      include: { distributor: { select: { name: true } } },
    });

    if (!beforeData) {
      return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.description !== undefined) updateData.description = body.description;

    const updated = await prisma.$transaction(async (tx) => {
      const expense = await tx.distributorExpense.update({
        where: { id: expenseId },
        data: updateData,
        include: {
          distributor: {
            select: {
              id: true,
              name: true,
              staffId: true,
              branch: { select: { id: true, nameJa: true } },
            },
          },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'DistributorExpense',
        targetId: expenseId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: expense as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布員経費更新: ${beforeData.distributor.name}`,
        tx,
      });

      return expense;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('DistributorExpense Update Error:', error);
    return NextResponse.json({ error: '経費の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const expenseId = parseInt(id);
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.distributorExpense.findUnique({
      where: { id: expenseId },
      include: { distributor: { select: { name: true } } },
    });

    if (!beforeData) {
      return NextResponse.json({ error: '経費が見つかりません' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.distributorExpense.delete({
        where: { id: expenseId },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'DistributorExpense',
        targetId: expenseId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布員経費削除: ${beforeData.distributor.name} (${beforeData.date.toISOString().split('T')[0]})`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DistributorExpense Delete Error:', error);
    return NextResponse.json({ error: '経費の削除に失敗しました' }, { status: 500 });
  }
}
