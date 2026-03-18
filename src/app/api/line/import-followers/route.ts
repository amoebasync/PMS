import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllFollowerIds, getProfile, isLineConfigured } from '@/lib/line';

/**
 * POST /api/line/import-followers — 既存フォロワーを一括取込
 */
export async function POST() {
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 });
  }

  try {
    // 1. 全フォロワーIDを取得
    const followerIds = await getAllFollowerIds();

    // 2. DB に既に存在するIDを取得
    const existing = await prisma.lineUser.findMany({
      select: { lineUserId: true },
    });
    const existingSet = new Set(existing.map(e => e.lineUserId));

    // 3. 新規のみ処理
    const newIds = followerIds.filter(id => !existingSet.has(id));
    let imported = 0;
    let failed = 0;

    // 5件ずつ並行処理（API rate limit 考慮）
    for (let i = 0; i < newIds.length; i += 5) {
      const batch = newIds.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (userId) => {
          const profile = await getProfile(userId);
          await prisma.lineUser.create({
            data: {
              lineUserId: userId,
              displayName: profile.displayName,
              pictureUrl: profile.pictureUrl || null,
              statusMessage: profile.statusMessage || null,
              isFollowing: true,
            },
          });
        })
      );
      imported += results.filter(r => r.status === 'fulfilled').length;
      failed += results.filter(r => r.status === 'rejected').length;
    }

    // 4. ブロック済みユーザーをチェック（DBにいるがフォロワーにいない）
    const followerSet = new Set(followerIds);
    await prisma.lineUser.updateMany({
      where: {
        lineUserId: { notIn: followerIds },
        isFollowing: true,
      },
      data: { isFollowing: false },
    });

    return NextResponse.json({
      total: followerIds.length,
      imported,
      failed,
      alreadyExists: existingSet.size,
    });
  } catch (e: any) {
    console.error('[LINE Import] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
