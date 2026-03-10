import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET: 未読のブロッキングアナウンスメントを返す
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const empId = parseInt(sessionId);

    const announcements = await prisma.announcement.findMany({
      where: {
        isBlocking: true,
        reads: {
          none: {
            employeeId: empId,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { lastNameJa: true, firstNameJa: true },
        },
      },
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    console.error('Blocking announcements GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch blocking announcements' }, { status: 500 });
  }
}
