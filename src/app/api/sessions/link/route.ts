import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// POST /api/sessions/link — 孤児セッションをスケジュールに紐付け
export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await request.json();
    const { sessionId, scheduleId } = body;

    if (!sessionId || !scheduleId) {
      return NextResponse.json({ error: 'sessionId と scheduleId は必須です' }, { status: 400 });
    }

    // セッション存在確認
    const session = await prisma.distributionSession.findUnique({
      where: { id: sessionId },
      select: { id: true, scheduleId: true, distributorId: true, finishedAt: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    if (session.scheduleId !== null) {
      return NextResponse.json({ error: 'このセッションは既にスケジュールに紐付いています' }, { status: 400 });
    }

    // スケジュール存在確認
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, distributorId: true, status: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }

    // 既にセッションが紐付いていないか確認
    const existingSession = await prisma.distributionSession.findUnique({
      where: { scheduleId },
    });

    if (existingSession) {
      return NextResponse.json({ error: 'このスケジュールには既にセッションが紐付いています' }, { status: 400 });
    }

    // 紐付け実行（トランザクション）
    const updatedSession = await prisma.$transaction(async (tx) => {
      const linked = await tx.distributionSession.update({
        where: { id: sessionId },
        data: { scheduleId },
      });

      // セッション完了済みならスケジュールもCOMPLETEDに
      if (session.finishedAt) {
        await tx.distributionSchedule.update({
          where: { id: scheduleId },
          data: { status: 'COMPLETED' },
        });
      } else {
        // 未完了セッションならDISTRIBUTINGに
        await tx.distributionSchedule.update({
          where: { id: scheduleId },
          data: { status: 'DISTRIBUTING' },
        });
      }

      return linked;
    });

    return NextResponse.json({ success: true, sessionId: updatedSession.id, scheduleId });
  } catch (error) {
    console.error('Session link error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
