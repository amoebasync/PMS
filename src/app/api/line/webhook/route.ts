import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature, getProfile, replyMessage, buildRegistrationFlexMessage, isLineConfigured } from '@/lib/line';

/**
 * POST /api/line/webhook — LINE Webhook 受信
 * - follow: ユーザー登録 + 連携依頼メッセージ自動送信
 * - unfollow: フォロー解除
 * - message, postback, 他: ユーザー登録（未登録の場合）
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

    if (event.type === 'unfollow') {
      try {
        await prisma.lineUser.updateMany({
          where: { lineUserId: userId },
          data: { isFollowing: false },
        });
      } catch (e) {
        console.error('[LINE Webhook] unfollow error:', e);
      }
      continue;
    }

    // follow, message, postback, その他 → ユーザーを登録/更新
    try {
      const existing = await prisma.lineUser.findUnique({
        where: { lineUserId: userId },
      });

      if (!existing) {
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
        console.log(`[LINE Webhook] New user registered: ${profile.displayName}`);
      } else if (!existing.isFollowing) {
        const profile = await getProfile(userId);
        await prisma.lineUser.update({
          where: { lineUserId: userId },
          data: {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl || null,
            statusMessage: profile.statusMessage || null,
            isFollowing: true,
          },
        });
      }

      // 友だち追加時: 連携依頼メッセージを自動送信
      if (event.type === 'follow' && event.replyToken) {
        await replyMessage(event.replyToken, [buildRegistrationFlexMessage()]);
      }
    } catch (e) {
      console.error('[LINE Webhook] event error:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
