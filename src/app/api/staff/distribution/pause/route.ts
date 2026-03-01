import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST /api/staff/distribution/pause — 作業一時停止
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

    // 既に PAUSE 中でないか確認（resumedAt が null の PauseEvent が存在しないこと）
    const existingPause = await prisma.pauseEvent.findFirst({
      where: { sessionId, resumedAt: null },
      select: { id: true },
    });

    if (existingPause) {
      return NextResponse.json({ error: '既に一時停止中です' }, { status: 400 });
    }

    const pauseEvent = await prisma.pauseEvent.create({
      data: {
        sessionId,
        pausedAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({ ok: true, pauseEventId: pauseEvent.id });
  } catch (error) {
    console.error('Pause Event Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
