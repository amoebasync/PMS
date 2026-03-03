import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// PUT /api/alert-definitions/[id] — アラート定義更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session');
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { id } = await params;
    const defId = parseInt(id);
    if (isNaN(defId)) {
      return NextResponse.json({ error: '無効なID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      isEnabled,
      categoryId,
      severity,
      frequency,
      targetType,
      targetIds,
      notifyEnabled,
      description,
      scheduleHour,
      scheduleDayOfWeek,
      scheduleDayOfMonth,
      scheduleWeekOrdinal,
    } = body;

    const data: any = {};
    if (typeof isEnabled === 'boolean') data.isEnabled = isEnabled;
    if (categoryId !== undefined) data.categoryId = parseInt(categoryId);
    if (severity) data.severity = severity;
    if (frequency) data.frequency = frequency;
    if (targetType) data.targetType = targetType;
    if (targetIds !== undefined) data.targetIds = targetIds === null ? null : String(targetIds);
    if (typeof notifyEnabled === 'boolean') data.notifyEnabled = notifyEnabled;
    if (description !== undefined) data.description = description;
    if (scheduleHour !== undefined) data.scheduleHour = parseInt(scheduleHour);
    if (scheduleDayOfWeek !== undefined) data.scheduleDayOfWeek = scheduleDayOfWeek === null ? null : parseInt(scheduleDayOfWeek);
    if (scheduleDayOfMonth !== undefined) data.scheduleDayOfMonth = scheduleDayOfMonth === null ? null : parseInt(scheduleDayOfMonth);
    if (scheduleWeekOrdinal !== undefined) data.scheduleWeekOrdinal = scheduleWeekOrdinal === null ? null : parseInt(scheduleWeekOrdinal);

    const updated = await prisma.alertDefinition.update({
      where: { id: defId },
      data,
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Alert Definition PUT Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
