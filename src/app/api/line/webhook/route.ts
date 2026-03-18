import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature, getProfile, isLineConfigured } from '@/lib/line';

/**
 * POST /api/line/webhook — LINE Webhook 受信
 * follow / unfollow イベントを処理
 */
export async function POST(request: Request) {
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const events = payload.events || [];

  for (const event of events) {
    const userId = event.source?.userId;
    if (!userId) continue;

    if (event.type === 'follow') {
      // 友だち追加 → プロフィール取得 → DB保存
      try {
        const profile = await getProfile(userId);
        await prisma.lineUser.upsert({
          where: { lineUserId: userId },
          create: {
            lineUserId: userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl || null,
            statusMessage: profile.statusMessage || null,
            isFollowing: true,
          },
          update: {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl || null,
            statusMessage: profile.statusMessage || null,
            isFollowing: true,
          },
        });
      } catch (e) {
        console.error('[LINE Webhook] follow error:', e);
      }
    } else if (event.type === 'unfollow') {
      // ブロック/友だち解除
      try {
        await prisma.lineUser.updateMany({
          where: { lineUserId: userId },
          data: { isFollowing: false },
        });
      } catch (e) {
        console.error('[LINE Webhook] unfollow error:', e);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
