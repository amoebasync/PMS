import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { pushMessage, isLineConfigured } from '@/lib/line';

// GET: List all distributor announcements with read stats
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const announcements = await prisma.distributorAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { lastNameJa: true, firstNameJa: true } },
        targets: {
          include: {
            distributor: { select: { id: true, name: true, staffId: true } },
          },
        },
        reads: {
          include: {
            distributor: { select: { id: true, name: true, staffId: true } },
          },
        },
      },
    });

    // Compute stats
    const result = await Promise.all(announcements.map(async (a) => {
      let targetCount: number;
      if (a.targetAll) {
        targetCount = await prisma.flyerDistributor.count({ where: { isActive: true } });
      } else {
        targetCount = a.targets.length;
      }
      return {
        id: a.id,
        title: a.title,
        content: a.content,
        imageUrls: a.imageUrls ? JSON.parse(a.imageUrls) : [],
        targetAll: a.targetAll,
        targets: a.targets.map(t => t.distributor),
        readCount: a.reads.length,
        targetCount,
        reads: a.reads.map(r => ({
          distributorId: r.distributorId,
          name: r.distributor.name,
          staffId: r.distributor.staffId,
          readAt: r.readAt,
        })),
        createdBy: `${a.createdBy.lastNameJa} ${a.createdBy.firstNameJa}`,
        createdAt: a.createdAt,
      };
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('DistributorAnnouncements GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create announcement + send LINE notifications
export async function POST(request: Request) {
  const { session, error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await request.json();
    const { title, content, imageUrls, targetAll, distributorIds } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'title と content は必須です' }, { status: 400 });
    }

    const announcement = await prisma.distributorAnnouncement.create({
      data: {
        title,
        content,
        imageUrls: imageUrls?.length ? JSON.stringify(imageUrls) : null,
        targetAll: targetAll !== false,
        createdById: session!.id,
        targets: !targetAll && distributorIds?.length
          ? { create: distributorIds.map((id: number) => ({ distributorId: id })) }
          : undefined,
      },
    });

    // Send LINE notifications
    if (isLineConfigured()) {
      let targetDistributors;
      if (targetAll !== false) {
        targetDistributors = await prisma.lineUser.findMany({
          where: { distributorId: { not: null }, isFollowing: true },
          select: { lineUserId: true },
        });
      } else if (distributorIds?.length) {
        targetDistributors = await prisma.lineUser.findMany({
          where: { distributorId: { in: distributorIds }, isFollowing: true },
          select: { lineUserId: true },
        });
      }

      const portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://pms.tiramis.co.jp'}/staff`;

      if (targetDistributors?.length) {
        const messages = [
          {
            type: 'flex',
            altText: `【お知らせ】${title}`,
            contents: {
              type: 'bubble',
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: 'お知らせ', size: 'sm', color: '#FFFFFF', weight: 'bold' },
                ],
                backgroundColor: '#4F46E5',
                paddingAll: '12px',
              },
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: title, weight: 'bold', size: 'md', wrap: true },
                  { type: 'text', text: content.substring(0, 100) + (content.length > 100 ? '...' : ''), size: 'sm', color: '#666666', wrap: true, margin: 'md' },
                ],
                paddingAll: '16px',
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: { type: 'uri', label: '確認する', uri: portalUrl },
                    style: 'primary',
                    color: '#4F46E5',
                  },
                ],
                paddingAll: '12px',
              },
            },
          },
        ];

        // Send in parallel, don't fail on individual errors
        await Promise.allSettled(
          targetDistributors.map(u => pushMessage(u.lineUserId, messages)),
        );
      }
    }

    return NextResponse.json({ id: announcement.id, success: true });
  } catch (err) {
    console.error('DistributorAnnouncements POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
