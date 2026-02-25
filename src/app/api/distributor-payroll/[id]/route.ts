import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// GET /api/distributor-payroll/[id] — 明細含む詳細取得
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const record = await prisma.distributorPayrollRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        distributor: { select: { id: true, staffId: true, name: true } },
        items: { orderBy: { date: 'asc' } },
      },
    });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// PATCH /api/distributor-payroll/[id] — ステータス更新
// Body: { status: 'DRAFT' | 'CONFIRMED' | 'PAID', note?: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: any = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.note !== undefined) data.note = body.note;

    const record = await prisma.distributorPayrollRecord.update({
      where: { id: parseInt(id) },
      data,
    });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// DELETE /api/distributor-payroll/[id] — レコード削除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.distributorPayrollRecord.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
