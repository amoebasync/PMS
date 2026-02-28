import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// POST /api/staff/distribution/skip — 配布禁止物件スキップ記録
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, latitude, longitude, prohibitedPropertyId, reason, timestamp } = body;

    if (!sessionId || latitude == null || longitude == null) {
      return NextResponse.json({ error: 'sessionId, latitude, longitude は必須です' }, { status: 400 });
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

    await prisma.skipEvent.create({
      data: {
        sessionId,
        latitude,
        longitude,
        prohibitedPropertyId: prohibitedPropertyId ?? null,
        reason: reason ?? null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Skip Event Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
