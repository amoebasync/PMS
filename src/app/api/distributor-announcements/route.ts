import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { pushMessage, isLineConfigured } from '@/lib/line';

// GET: List all distributor announcements with read stats
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = searchParams.get('includeDrafts') !== 'false';

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
        targetCount = await prisma.flyerDistributor.count({ where: { leaveDate: null } });
      } else {
        targetCount = a.targets.length;
      }
      return {
        id: a.id,
        title: a.title,
        content: a.content,
        titleEn: a.titleEn,
        contentEn: a.contentEn,
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
        scheduledAt: a.scheduledAt,
        sentAt: a.sentAt,
        isDraft: a.isDraft,
      };
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('DistributorAnnouncements GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create announcement + send LINE notifications (or schedule)
export async function POST(request: Request) {
  const { employee, error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await request.json();
    const { title, content, titleEn, contentEn, imageUrls, targetAll, targetLanguage, distributorIds, scheduledAt, isDraft } = body;

    if (!isDraft && (!title || !content)) {
      return NextResponse.json({ error: 'title と content は必須です' }, { status: 400 });
    }

    // Determine if this is a scheduled send
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const isScheduled = !isDraft && scheduledDate && scheduledDate > new Date();

    const announcement = await prisma.distributorAnnouncement.create({
      data: {
        title: title || '',
        content: content || '',
        titleEn: titleEn || null,
        contentEn: contentEn || null,
        imageUrls: imageUrls?.length ? JSON.stringify(imageUrls) : null,
        targetAll: targetAll !== false,
        isDraft: isDraft || false,
        createdById: employee!.id,
        scheduledAt: isDraft ? null : (isScheduled ? scheduledDate : null),
        sentAt: isDraft ? null : (isScheduled ? null : new Date()),
        targets: !targetAll && distributorIds?.length
          ? { create: distributorIds.map((id: number) => ({ distributorId: id })) }
          : undefined,
      },
    });

    // Send LINE notifications immediately if not scheduled and not draft
    if (!isDraft && !isScheduled && isLineConfigured()) {
      let targetDistributors: Array<{ lineUserId: string; language: string }> | undefined;
      if (targetAll !== false) {
        const langFilter = targetLanguage === 'ja' || targetLanguage === 'en'
          ? { distributor: { language: targetLanguage } }
          : {};
        targetDistributors = await prisma.lineUser.findMany({
          where: { distributorId: { not: null }, isFollowing: true, ...langFilter },
          select: { lineUserId: true, distributor: { select: { language: true } } },
        }).then(rows => rows.map(r => ({ lineUserId: r.lineUserId, language: r.distributor?.language || 'ja' })));
      } else if (distributorIds?.length) {
        targetDistributors = await prisma.lineUser.findMany({
          where: { distributorId: { in: distributorIds }, isFollowing: true },
          select: { lineUserId: true, distributor: { select: { language: true } } },
        }).then(rows => rows.map(r => ({ lineUserId: r.lineUserId, language: r.distributor?.language || 'ja' })));
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pms.tiramis.co.jp';

      if (targetDistributors?.length) {
        const buildMessages = (lang: string) => {
          const isEn = lang === 'en';
          const t = isEn ? (titleEn || title) : title;
          const portalUrl = `${baseUrl}/staff/line-login`;
          const notice = isEn
            ? 'You have a new announcement.\nPlease read and confirm it on the portal before starting work.'
            : '新しいお知らせがあります。業務開始前にポータルで必ず確認してください。';
          return [
            {
              type: 'flex',
              altText: isEn ? `[Important] ${t}` : `【重要】${t}`,
              contents: {
                type: 'bubble',
                header: {
                  type: 'box', layout: 'vertical',
                  contents: [
                    { type: 'text', text: isEn ? 'Notice' : 'お知らせ', size: 'sm', color: '#FFFFFF', weight: 'bold' },
                  ],
                  backgroundColor: '#4F46E5', paddingAll: '12px',
                },
                body: {
                  type: 'box', layout: 'vertical',
                  contents: [
                    { type: 'text', text: t, weight: 'bold', size: 'md', wrap: true },
                    { type: 'separator', margin: 'md' },
                    { type: 'text', text: notice, size: 'sm', color: '#666666', wrap: true, margin: 'md' },
                  ],
                  paddingAll: '16px',
                },
                footer: {
                  type: 'box', layout: 'vertical',
                  contents: [{
                    type: 'button',
                    action: { type: 'uri', label: isEn ? 'OPEN ANNOUNCEMENT' : 'お知らせを確認する', uri: portalUrl },
                    style: 'primary', color: '#4F46E5',
                  }],
                  paddingAll: '12px',
                },
              },
            },
          ];
        };

        await Promise.allSettled(
          targetDistributors.map(u => pushMessage(u.lineUserId, buildMessages(u.language))),
        );
      }
    }

    return NextResponse.json({ id: announcement.id, success: true });
  } catch (err) {
    console.error('DistributorAnnouncements POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
