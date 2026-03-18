import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcastMessage, isLineConfigured } from '@/lib/line';

/**
 * POST /api/line/import-followers — 全フォロワーにボタン付きメッセージを送信
 * ボタンを押したユーザーのIDをWebhook経由で収集する
 */
export async function POST() {
  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 });
  }

  try {
    // Flex Message でボタン付きメッセージを送信
    await broadcastMessage([
      {
        type: 'flex',
        altText: 'K&Partners 配布員登録確認',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'K&Partners',
                weight: 'bold',
                size: 'lg',
                color: '#10B981',
              },
              {
                type: 'text',
                text: '配布員管理システムとLINEの連携を行います。下のボタンを押してください。',
                wrap: true,
                size: 'sm',
                margin: 'md',
                color: '#555555',
              },
            ],
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '連携する',
                  data: 'action=register',
                  displayText: '連携します',
                },
                style: 'primary',
                color: '#10B981',
              },
            ],
          },
        },
      },
    ]);

    // 現在のDB登録数を返す
    const count = await prisma.lineUser.count();

    return NextResponse.json({
      success: true,
      message: 'ブロードキャスト送信完了。フォロワーがボタンを押すとユーザーが登録されます。',
      currentCount: count,
    });
  } catch (e: any) {
    console.error('[LINE Broadcast] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
