import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// GET: Get unread blocking announcements for current distributor (oldest first)
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find announcements targeting this distributor that haven't been read
    const readIds = await prisma.distributorAnnouncementRead.findMany({
      where: { distributorId: distributor.id },
      select: { announcementId: true },
    });
    const readAnnouncementIds = readIds.map(r => r.announcementId);

    const announcements = await prisma.distributorAnnouncement.findMany({
      where: {
        id: { notIn: readAnnouncementIds.length > 0 ? readAnnouncementIds : undefined },
        OR: [
          { targetAll: true },
          { targets: { some: { distributorId: distributor.id } } },
        ],
      },
      orderBy: { createdAt: 'asc' }, // oldest first
      select: {
        id: true,
        title: true,
        content: true,
        imageUrls: true,
        createdAt: true,
      },
    });

    const result = announcements.map(a => ({
      ...a,
      imageUrls: a.imageUrls ? JSON.parse(a.imageUrls) : [],
    }));

    return NextResponse.json({ announcements: result, count: result.length });
  } catch (err) {
    console.error('Staff announcements GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
