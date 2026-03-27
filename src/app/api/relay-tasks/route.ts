import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function authorize() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  return prisma.employee.findUnique({ where: { id: parseInt(sessionId) } });
}

// GET: 中継/回収タスク一覧
export async function GET(request: Request) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const type = searchParams.get('type'); // RELAY | COLLECTION
    const status = searchParams.get('status'); // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
    const driverId = searchParams.get('driverId');
    const scheduleId = searchParams.get('scheduleId');

    const where: any = {};

    if (scheduleId) {
      where.scheduleId = parseInt(scheduleId);
    } else if (date) {
      // date フィールドがセットされたタスク OR dateがnullでschedule.dateが一致するタスク OR スケジュール無し+date一致
      where.OR = [
        { date: new Date(date) },
        { date: null, schedule: { date: new Date(date) } },
        { scheduleId: null, date: new Date(date) },
      ];
    }

    if (type) where.type = type;
    if (status) where.status = status;
    if (driverId) where.driverId = parseInt(driverId);

    const tasks = await prisma.relayTask.findMany({
      where,
      include: {
        driver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        schedule: {
          select: {
            id: true, jobNumber: true, date: true, status: true,
            distributor: { select: { id: true, staffId: true, name: true } },
            branch: { select: { id: true, nameJa: true } },
            area: { select: { id: true, chome_name: true, prefecture: { select: { name: true } }, city: { select: { name: true } } } },
            items: { select: { id: true, flyerName: true, plannedCount: true, actualCount: true } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('RelayTask GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST: 中継/回収タスク作成
export async function POST(request: Request) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { scheduleId, type, driverId, driverName, distributorName, locationName, latitude, longitude, timeSlotStart, timeSlotEnd, note, force, date } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    // 重複チェック: スケジュール紐付きの場合のみ
    if (scheduleId && !force) {
      const existing = await prisma.relayTask.findMany({
        where: {
          scheduleId: parseInt(scheduleId),
          type,
          status: { not: 'CANCELLED' },
        },
        include: {
          driver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        },
      });
      if (existing.length > 0) {
        return NextResponse.json({
          duplicate: true,
          existingTasks: existing.map(t => ({
            id: t.id,
            type: t.type,
            status: t.status,
            driverName: t.driver ? `${t.driver.lastNameJa} ${t.driver.firstNameJa}` : t.driverName || null,
            timeSlotStart: t.timeSlotStart,
            timeSlotEnd: t.timeSlotEnd,
          })),
        }, { status: 409 });
      }
    }

    // sortOrder計算
    const maxSort = scheduleId
      ? await prisma.relayTask.aggregate({ where: { scheduleId: parseInt(scheduleId) }, _max: { sortOrder: true } })
      : await prisma.relayTask.aggregate({ where: { scheduleId: null }, _max: { sortOrder: true } });

    const task = await prisma.relayTask.create({
      data: {
        scheduleId: scheduleId ? parseInt(scheduleId) : null,
        type,
        driverId: driverId ? parseInt(driverId) : null,
        driverName: driverName || null,
        distributorName: distributorName || null,
        locationName: locationName || null,
        latitude: latitude || null,
        longitude: longitude || null,
        timeSlotStart: timeSlotStart || null,
        timeSlotEnd: timeSlotEnd || null,
        note: note || null,
        date: date ? new Date(date) : null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
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

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('RelayTask POST error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
