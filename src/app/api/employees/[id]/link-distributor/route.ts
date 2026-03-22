import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// PUT /api/employees/[id]/link-distributor — 配布員を紐付け
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    const body = await request.json();
    const { distributorId } = body;

    if (!distributorId) {
      return NextResponse.json({ error: 'distributorId は必須です' }, { status: 400 });
    }

    // 配布員が存在するか確認
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: parseInt(distributorId) },
      select: { id: true, name: true, staffId: true, linkedEmployeeId: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    // 既に別の社員に紐付いている場合
    if (distributor.linkedEmployeeId && distributor.linkedEmployeeId !== employeeId) {
      return NextResponse.json({ error: 'この配布員は既に別の社員に紐付けられています' }, { status: 409 });
    }

    // この社員に既に別の配布員が紐付いている場合、先に解除
    await prisma.flyerDistributor.updateMany({
      where: { linkedEmployeeId: employeeId },
      data: { linkedEmployeeId: null },
    });

    // 紐付け
    await prisma.flyerDistributor.update({
      where: { id: parseInt(distributorId) },
      data: { linkedEmployeeId: employeeId },
    });

    return NextResponse.json({ success: true, distributorId: distributor.id, distributorName: distributor.name });
  } catch (err) {
    console.error('Link distributor error:', err);
    return NextResponse.json({ error: '紐付けに失敗しました' }, { status: 500 });
  }
}

// DELETE /api/employees/[id]/link-distributor — 紐付け解除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    await prisma.flyerDistributor.updateMany({
      where: { linkedEmployeeId: employeeId },
      data: { linkedEmployeeId: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unlink distributor error:', err);
    return NextResponse.json({ error: '紐付け解除に失敗しました' }, { status: 500 });
  }
}
