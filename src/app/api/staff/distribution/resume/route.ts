import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST /api/staff/distribution/resume — 作業再開
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, timestamp } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId は必須です' }, { status: 400 });
    }

    // セッション所有権チェック（アクティブセッションのみ）
    const session = await prisma.distributionSession.findFirst({
      where: {
        id: sessionId,
        distributorId: distributor.id,
        finishedAt: null,
      },
      select: { id: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'アクティブなセッションが見つかりません' }, { status: 404 });
    }

    // 現在 PAUSE 中の PauseEvent を取得
    const activePause = await prisma.pauseEvent.findFirst({
      where: { sessionId, resumedAt: null },
      orderBy: { pausedAt: 'desc' },
    });

    if (!activePause) {
      return NextResponse.json({ error: '一時停止中のセッションがありません' }, { status: 400 });
    }

    // resumedAt を設定して RESUME 完了
    await prisma.pauseEvent.update({
      where: { id: activePause.id },
      data: {
        resumedAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Resume Event Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
