import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pushMessage, isLineConfigured } from '@/lib/line';

const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/send-announcements
// CRON: 予約送信のアナウンスをLINE送信する
export async function GET(request: Request) {
  // 2台構成の重複実行防止: CRON_PRIMARY=true のサーバーのみ実行
  if (process.env.CRON_PRIMARY !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'not primary' });
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    // Find announcements where scheduledAt <= now AND sentAt IS NULL AND not draft
    const pending = await prisma.distributorAnnouncement.findMany({
      where: {
        scheduledAt: { lte: new Date() },
        sentAt: null,
        isDraft: false,
      },
      include: {
        targets: {
          include: {
            distributor: { select: { id: true } },
          },
        },
      },
    });

    if (pending.length === 0) {
      return NextResponse.json({ message: '送信待ちのアナウンスはありません', sent: 0 });
    }

    let sentCount = 0;

    for (const a of pending) {
      if (isLineConfigured()) {
        const distributorIds = !a.targetAll
          ? a.targets.map(t => t.distributorId)
          : undefined;

        let targetDistributors: Array<{ lineUserId: string; language: string }> | undefined;

        if (a.targetAll) {
          targetDistributors = await prisma.lineUser.findMany({
            where: { distributorId: { not: null }, isFollowing: true },
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
            const t = isEn ? (a.titleEn || a.title) : a.title;
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

      // Mark as sent
      await prisma.distributorAnnouncement.update({
        where: { id: a.id },
        data: { sentAt: new Date() },
      });

      sentCount++;
    }

    return NextResponse.json({ message: `${sentCount}件のアナウンスを送信しました`, sent: sentCount });
  } catch (err) {
    console.error('CRON send-announcements Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
