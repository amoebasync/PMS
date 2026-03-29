import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET /api/gps-review/[id]/indicators
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: 'Invalid schedule ID' }, { status: 400 });
    }

    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        session: true,
        items: {
          select: {
            plannedCount: true,
            actualCount: true,
          },
        },
        fraudAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const fa = schedule.fraudAnalyses[0] ?? null;

    if (!fa) {
      return NextResponse.json({
        coverage: null,
        speed: null,
        fastMove: null,
        auxiliary: null,
        riskScoreV2: null,
        riskLevelV2: null,
      });
    }

    // If v2Detail JSON exists, parse and return it
    if (fa.v2Detail) {
      try {
        const detail = JSON.parse(fa.v2Detail);
        return NextResponse.json({
          coverage: detail.coverage ?? null,
          speed: detail.speed ?? null,
          fastMove: detail.fastMove ?? null,
          auxiliary: detail.auxiliary ?? {
            outOfAreaPct: fa.outOfAreaPct ?? 0,
            outOfAreaWarning: (fa.outOfAreaPct ?? 0) > 20,
            pauseMinutes: fa.pauseMinutes ?? 0,
            pauseWarning: (fa.pauseMinutes ?? 0) > 60,
          },
          riskScoreV2: fa.riskScoreV2 ?? null,
          riskLevelV2: fa.riskLevelV2 ?? null,
        });
      } catch {
        // Fall through to basic response if JSON parse fails
      }
    }

    // Fallback: return basic info from raw v2 fields
    return NextResponse.json({
      coverage: {
        score: fa.coverageDiff ?? 0,
        currentInsideRatio: null,
        pastAvgInsideRatio: null,
        diffPercent: fa.coverageDiff != null ? Math.round(fa.coverageDiff * -100) : null,
        pastSamples: null,
        isDeliverAll: null,
        reason: 'raw_fields',
      },
      speed: {
        score: fa.speedDeviation ?? 0,
        currentSpeed: null,
        avgSpeed: null,
        stdSpeed: null,
        zScore: null,
        pastSamples: null,
        reason: 'raw_fields',
      },
      fastMove: {
        score: fa.fastMoveRatio ?? 0,
        fastRatio: fa.fastMoveRatio ?? 0,
        totalInsideMinutes: null,
        fastMinutes: null,
        reason: 'raw_fields',
      },
      auxiliary: {
        outOfAreaPct: fa.outOfAreaPct ?? 0,
        outOfAreaWarning: (fa.outOfAreaPct ?? 0) > 20,
        pauseMinutes: fa.pauseMinutes ?? 0,
        pauseWarning: (fa.pauseMinutes ?? 0) > 60,
      },
      riskScoreV2: fa.riskScoreV2 ?? null,
      riskLevelV2: fa.riskLevelV2 ?? null,
    });
  } catch (err) {
    console.error('GET /api/gps-review/[id]/indicators error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
