import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature, getProfile, getGroupSummary, replyMessage, buildRegistrationFlexMessage, isLineConfigured } from '@/lib/line';

/**
 * POST /api/line/webhook — LINE Webhook 受信
 * - follow: ユーザー登録 + 連携依頼メッセージ自動送信
 * - unfollow: フォロー解除
 * - join: グループ参加 → groupId を SystemSetting に保存
 * - message, postback, 他: ユーザー登録（未登録の場合）+ グループID取得
 *
 * NOTE: CloudFront が x-line-signature ヘッダーを転送しないため、
 * 署名が存在する場合のみ検証し、ない場合はスキップする。
 */
export async function POST(request: Request) {
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

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
    // ── グループイベント処理 ──
    if (event.source?.type === 'group' && event.source.groupId) {
      await handleGroupEvent(event);
    }

    // ── ユーザーイベント処理 ──
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

    // follow, message, postback → ユーザー登録/更新
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

/** グループイベント処理: join またはメッセージ受信時に groupId を保存 */
async function handleGroupEvent(event: any) {
  const groupId = event.source.groupId;
  try {
    // グループ名を取得して SystemSetting に保存
    const summary = await getGroupSummary(groupId);
    const key = `lineGroup_${groupId}`;
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify({ groupId, groupName: summary.groupName, pictureUrl: summary.pictureUrl }) },
      update: { value: JSON.stringify({ groupId, groupName: summary.groupName, pictureUrl: summary.pictureUrl }) },
    });
    console.log(`[LINE Webhook] Group registered: ${summary.groupName} (${groupId})`);
  } catch (e) {
    console.error('[LINE Webhook] group event error:', e);
  }
}
