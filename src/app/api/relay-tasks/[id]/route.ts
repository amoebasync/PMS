import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function authorize() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  return prisma.employee.findUnique({ where: { id: parseInt(sessionId) } });
}

// PUT: 中継/回収タスク更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const existing = await prisma.relayTask.findUnique({ where: { id: taskId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: any = {};

    if (body.status !== undefined) data.status = body.status;
    if (body.driverId !== undefined) data.driverId = body.driverId || null;
    if (body.driverName !== undefined) data.driverName = body.driverName || null;
    if (body.locationName !== undefined) data.locationName = body.locationName || null;
    if (body.latitude !== undefined) data.latitude = body.latitude;
    if (body.longitude !== undefined) data.longitude = body.longitude;
    if (body.timeSlotStart !== undefined) data.timeSlotStart = body.timeSlotStart || null;
    if (body.timeSlotEnd !== undefined) data.timeSlotEnd = body.timeSlotEnd || null;
    if (body.note !== undefined) data.note = body.note || null;
    if (body.type !== undefined) data.type = body.type;
    if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null;
    if (body.bagCount !== undefined) data.bagCount = parseInt(body.bagCount) || 0;
    if (body.trolleyCount !== undefined) data.trolleyCount = parseInt(body.trolleyCount) || 0;
    if (body.otherCount !== undefined) data.otherCount = parseInt(body.otherCount) || 0;

    const task = await prisma.relayTask.update({
      where: { id: taskId },
      data,
      include: {
        driver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        schedule: {
          select: {
            id: true, jobNumber: true, date: true, status: true,
            distributor: { select: { id: true, staffId: true, name: true } },
            branch: { select: { id: true, nameJa: true } },
            area: { select: { id: true, chome_name: true, prefecture: { select: { name: true } }, city: { select: { name: true } } } },
          },
        },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('RelayTask PUT error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE: 中継/回収タスク削除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    await prisma.relayTask.delete({ where: { id: taskId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('RelayTask DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
