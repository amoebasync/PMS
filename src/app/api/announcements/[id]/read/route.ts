import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// POST: アナウンスメントを既読にする
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const empId = parseInt(sessionId);
    const { id } = await params;
    const announcementId = parseInt(id);

    if (isNaN(announcementId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.announcementRead.upsert({
      where: {
        announcementId_employeeId: {
          announcementId,
          employeeId: empId,
        },
      },
      create: {
        announcementId,
        employeeId: empId,
      },
      update: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Announcement read POST Error:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
