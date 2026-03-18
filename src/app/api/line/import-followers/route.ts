import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcastMessage, buildRegistrationFlexMessage, isLineConfigured } from '@/lib/line';

/**
 * POST /api/line/import-followers — 全フォロワーにLINE連携依頼メッセージを送信
 * ボタンを押したユーザーのIDをWebhook経由で収集する
 */
export async function POST() {
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 });
  }

  try {
    await broadcastMessage([buildRegistrationFlexMessage()]);

    const count = await prisma.lineUser.count();

    return NextResponse.json({
      success: true,
      currentCount: count,
    });
  } catch (e: any) {
    console.error('[LINE Broadcast] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
