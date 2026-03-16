import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET /api/sessions/orphans — 孤児セッション一覧（scheduleId=null）
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const distributorId = searchParams.get('distributorId');

    const where: any = {
      scheduleId: null,
    };

    if (date) {
      const start = new Date(`${date}T00:00:00+09:00`);
      const end = new Date(`${date}T23:59:59+09:00`);
      where.startedAt = { gte: start, lte: end };
    }

    if (distributorId) {
      where.distributorId = parseInt(distributorId);
    }

    const sessions = await prisma.distributionSession.findMany({
      where,
      include: {
        distributor: { select: { id: true, name: true, staffId: true } },
        gpsPoints: { select: { id: true }, take: 1 },
        progressEvents: { select: { id: true, mailboxCount: true }, orderBy: { mailboxCount: 'desc' }, take: 1 },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    const result = sessions.map((s) => ({
      id: s.id,
      distributorId: s.distributorId,
      distributorName: s.distributor.name,
      distributorStaffId: s.distributor.staffId,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      hasGpsData: s.gpsPoints.length > 0,
      lastMailboxCount: s.progressEvents[0]?.mailboxCount ?? 0,
      totalSteps: s.totalSteps,
      totalDistance: s.totalDistance,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Orphan sessions fetch error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
