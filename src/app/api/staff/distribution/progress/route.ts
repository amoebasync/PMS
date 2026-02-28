import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST /api/staff/distribution/progress — 進捗マイルストーン報告（500枚完了）
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, mailboxCount, latitude, longitude, timestamp } = body;

    if (!sessionId || mailboxCount == null) {
      return NextResponse.json({ error: 'sessionId, mailboxCount は必須です' }, { status: 400 });
    }

    // セッション所有権チェック
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

    await prisma.progressEvent.create({
      data: {
        sessionId,
        mailboxCount,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Progress Event Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
