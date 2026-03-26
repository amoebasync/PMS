import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET: Single announcement with full read details
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const announcement = await prisma.distributorAnnouncement.findUnique({
      where: { id: parseInt(id) },
      include: {
        createdBy: { select: { lastNameJa: true, firstNameJa: true } },
        targets: {
          include: { distributor: { select: { id: true, name: true, staffId: true } } },
        },
        reads: {
          include: { distributor: { select: { id: true, name: true, staffId: true } } },
          orderBy: { readAt: 'asc' },
        },
      },
    });

    if (!announcement) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...announcement,
      imageUrls: announcement.imageUrls ? JSON.parse(announcement.imageUrls) : [],
    });
  } catch (err) {
    console.error('DistributorAnnouncement GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove announcement
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    await prisma.distributorAnnouncement.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DistributorAnnouncement DELETE Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
