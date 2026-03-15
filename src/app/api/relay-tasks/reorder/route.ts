import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function authorize() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  return prisma.employee.findUnique({ where: { id: parseInt(sessionId) } });
}

// PUT: 中継/回収タスクの優先順位を一括更新
export async function PUT(request: Request) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { orderedIds } = body; // [taskId1, taskId2, ...]

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
    }

    await prisma.$transaction(
      orderedIds.map((id: number, index: number) =>
        prisma.relayTask.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('RelayTask reorder error:', error);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }
}
