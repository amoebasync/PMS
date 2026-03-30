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

// PUT: Update draft announcement (or publish)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { employee, error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const announcementId = parseInt(id);
    const body = await request.json();
    const { title, content, titleEn, contentEn, imageUrls, targetAll, targetLanguage, distributorIds, scheduledAt, isDraft } = body;

    const existing = await prisma.distributorAnnouncement.findUnique({ where: { id: announcementId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!existing.isDraft) {
      return NextResponse.json({ error: '送信済み・予約済みのアナウンスは編集できません' }, { status: 400 });
    }

    // Determine send mode
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const isScheduled = !isDraft && scheduledDate && scheduledDate > new Date();

    // Delete existing targets and recreate
    await prisma.distributorAnnouncementTarget.deleteMany({ where: { announcementId } });

    const announcement = await prisma.distributorAnnouncement.update({
      where: { id: announcementId },
      data: {
        title,
        content,
        titleEn: titleEn || null,
        contentEn: contentEn || null,
        imageUrls: imageUrls?.length ? JSON.stringify(imageUrls) : null,
        targetAll: targetAll !== false,
        isDraft: isDraft || false,
        scheduledAt: isDraft ? null : (isScheduled ? scheduledDate : null),
        sentAt: isDraft ? null : (isScheduled ? null : new Date()),
        targets: !targetAll && distributorIds?.length
          ? { create: distributorIds.map((id: number) => ({ distributorId: id })) }
          : undefined,
      },
    });

    // Send LINE notifications if publishing immediately
    if (!isDraft && !isScheduled) {
      const { pushMessage, isLineConfigured } = await import('@/lib/line');
      if (isLineConfigured()) {
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
            const portalUrl = isEn ? `${baseUrl}/staff/en` : `${baseUrl}/staff`;
            const notice = isEn
              ? 'You have a new announcement.\nPlease read and confirm it on the portal before starting work.'
              : '新しいお知らせがあります。業務開始前にポータルで必ず確認してください。';
            return [{
              type: 'flex',
              altText: isEn ? `[Important] ${t}` : `【重要】${t}`,
              contents: {
                type: 'bubble',
                header: {
                  type: 'box', layout: 'vertical',
                  contents: [{ type: 'text', text: isEn ? 'Notice' : 'お知らせ', size: 'sm', color: '#FFFFFF', weight: 'bold' }],
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
            }];
          };
          await Promise.allSettled(
            targetDistributors.map(u => pushMessage(u.lineUserId, buildMessages(u.language))),
          );
        }
      }
    }

    return NextResponse.json({ id: announcement.id, success: true });
  } catch (err) {
    console.error('DistributorAnnouncement PUT Error:', err);
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
