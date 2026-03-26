import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST: Mark announcement as read
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const announcementId = parseInt(id);

    // Verify the announcement exists and targets this distributor
    const announcement = await prisma.distributorAnnouncement.findUnique({
      where: { id: announcementId },
      include: { targets: { where: { distributorId: distributor.id } } },
    });

    if (!announcement) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!announcement.targetAll && announcement.targets.length === 0) {
      return NextResponse.json({ error: 'Not targeted' }, { status: 403 });
    }

    // Upsert read record
    await prisma.distributorAnnouncementRead.upsert({
      where: {
        announcementId_distributorId: {
          announcementId,
          distributorId: distributor.id,
        },
      },
      create: { announcementId, distributorId: distributor.id },
      update: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Staff announcement read Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
