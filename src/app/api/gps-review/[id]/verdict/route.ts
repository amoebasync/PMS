import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// PUT /api/gps-review/[id]/verdict
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: 'Invalid schedule ID' }, { status: 400 });
    }

    const body = await request.json();
    const { result, comment } = body;

    if (!result || !['OK', 'NG'].includes(result)) {
      return NextResponse.json(
        { error: 'result must be "OK" or "NG"' },
        { status: 400 }
      );
    }

    // Verify schedule exists
    const existing = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const updated = await prisma.distributionSchedule.update({
      where: { id: scheduleId },
      data: {
        checkGps: true,
        checkGpsResult: result,
        checkGpsComment: comment || null,
      },
      select: {
        id: true,
        checkGps: true,
        checkGpsResult: true,
        checkGpsComment: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /api/gps-review/[id]/verdict error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
