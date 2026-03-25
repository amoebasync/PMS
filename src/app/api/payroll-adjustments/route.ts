import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActorInfo } from '@/lib/audit';

// GET /api/payroll-adjustments?distributorId=X&periodStart=YYYY-MM-DD
// or ?employeeId=X&periodStart=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const distributorId = searchParams.get('distributorId');
    const employeeId = searchParams.get('employeeId');
    const periodStart = searchParams.get('periodStart');

    if (!periodStart) {
      return NextResponse.json({ error: 'periodStart is required' }, { status: 400 });
    }

    const where: any = { periodStart: new Date(periodStart) };
    if (distributorId) where.distributorId = parseInt(distributorId);
    if (employeeId) where.employeeId = parseInt(employeeId);

    const adjustments = await prisma.payrollAdjustment.findMany({
      where,
      include: { createdBy: { select: { lastNameJa: true, firstNameJa: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(adjustments);
  } catch (error) {
    console.error('PayrollAdjustment GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST /api/payroll-adjustments
export async function POST(request: Request) {
  try {
    const { actorId } = await getAdminActorInfo();
    const body = await request.json();
    const { distributorId, employeeId, periodStart, type, amount, description } = body;

    if (!periodStart || !type || amount === undefined) {
      return NextResponse.json({ error: 'periodStart, type, amount are required' }, { status: 400 });
    }
    if (!distributorId && !employeeId) {
      return NextResponse.json({ error: 'distributorId or employeeId is required' }, { status: 400 });
    }

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        distributorId: distributorId ? parseInt(distributorId) : null,
        employeeId: employeeId ? parseInt(employeeId) : null,
        periodStart: new Date(periodStart),
        type,
        amount: parseInt(amount),
        description: description || null,
        createdById: actorId ? parseInt(actorId) : null,
      },
    });

    return NextResponse.json(adjustment);
  } catch (error) {
    console.error('PayrollAdjustment POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE /api/payroll-adjustments?id=X
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await prisma.payrollAdjustment.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PayrollAdjustment DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
