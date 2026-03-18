import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature, getProfile, replyMessage, buildRegistrationFlexMessage, isLineConfigured } from '@/lib/line';

/**
 * POST /api/line/webhook — LINE Webhook 受信
 * - follow: ユーザー登録 + 連携依頼メッセージ自動送信
 * - unfollow: フォロー解除
 * - message, postback, 他: ユーザー登録（未登録の場合）
 *
 * NOTE: CloudFront が x-line-signature ヘッダーを転送しないため、
 * 署名が存在する場合のみ検証し、ない場合はスキップする。
 * TODO: CloudFront で x-line-signature ヘッダーの転送設定を追加する
 */
export async function POST(request: Request) {
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  // 署名がある場合は検証（直接アクセス時）、ない場合はスキップ（CloudFront経由）
  if (signature && !verifySignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

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
        try {
          await replyMessage(event.replyToken, [buildRegistrationFlexMessage()]);
          console.log(`[LINE Webhook] Registration message sent to ${userId}`);
        } catch (e) {
          console.error('[LINE Webhook] reply error:', e);
        }
      }
    } catch (e) {
      console.error('[LINE Webhook] event error:', e);
    }
  }

  return NextResponse.json({ ok: true });
}
