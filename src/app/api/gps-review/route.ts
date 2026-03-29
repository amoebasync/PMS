import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET /api/gps-review?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get('date');

    // Default to yesterday (JST)
    let targetDate: Date;
    if (dateStr) {
      targetDate = new Date(dateStr);
    } else {
      const nowJst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
      nowJst.setDate(nowJst.getDate() - 1);
      targetDate = new Date(nowJst.getFullYear(), nowJst.getMonth(), nowJst.getDate());
    }

    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        date: targetDate,
        distributorId: { not: null },
      },
      include: {
        distributor: {
          select: {
            id: true,
            name: true,
            staffId: true,
          },
        },
        area: {
          include: {
            prefecture: { select: { name: true } },
            city: { select: { name: true } },
          },
        },
        items: {
          select: {
            plannedCount: true,
            actualCount: true,
          },
        },
        session: {
          include: {
            pauseEvents: {
              select: {
                pausedAt: true,
                resumedAt: true,
              },
            },
            _count: {
              select: {
                gpsPoints: true,
              },
            },
          },
        },
        fraudAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            coverageDiff: true,
            speedDeviation: true,
            fastMoveRatio: true,
            outOfAreaPct: true,
            pauseMinutes: true,
            riskScoreV2: true,
            riskLevelV2: true,
          },
        },
      },
    });

    // Transform schedules
    const result = schedules.map((s) => {
      const plannedCount = s.items.length > 0
        ? Math.max(...s.items.map((i) => i.plannedCount ?? 0))
        : 0;
      const actualCount = s.items.length > 0
        ? Math.max(...s.items.map((i) => i.actualCount ?? 0))
        : 0;

      // Compute work minutes (session duration minus pause time)
      let workMinutes = 0;
      let startTime: string | null = null;
      let endTime: string | null = null;
      let totalDistanceKm = 0;
      let gpsPointCount = 0;

      if (s.session) {
        const sessionStarted = new Date(s.session.startedAt);
        const sessionFinished = s.session.finishedAt ? new Date(s.session.finishedAt) : null;

        startTime = sessionStarted.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Tokyo',
        });
        endTime = sessionFinished
          ? sessionFinished.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Asia/Tokyo',
            })
          : null;

        if (sessionFinished) {
          const totalMs = sessionFinished.getTime() - sessionStarted.getTime();

          // Calculate total pause time
          let pauseMs = 0;
          for (const pe of s.session.pauseEvents) {
            const pauseEnd = pe.resumedAt ? new Date(pe.resumedAt).getTime() : sessionFinished.getTime();
            pauseMs += pauseEnd - new Date(pe.pausedAt).getTime();
          }

          workMinutes = Math.round((totalMs - pauseMs) / 60000);
        }

        totalDistanceKm = Math.round((s.session.totalDistance / 1000) * 10) / 10;
        gpsPointCount = s.session._count.gpsPoints;
      }

      const workHours = workMinutes / 60;
      const speedPerHour = workHours > 0 ? Math.round(actualCount / workHours) : 0;

      const fa = s.fraudAnalyses[0] ?? null;

      // Area name: {prefecture.name}{city.name}{chome_name || town_name}
      let areaName = '';
      if (s.area) {
        const prefName = s.area.prefecture?.name ?? '';
        const cityName = s.area.city?.name ?? '';
        const chomeName = s.area.chome_name || s.area.town_name || '';
        areaName = `${prefName}${cityName}${chomeName}`;
      }

      return {
        id: s.id,
        status: s.status,
        distributorId: s.distributorId,
        distributorName: s.distributor?.name ?? '',
        distributorStaffId: s.distributor?.staffId ?? '',
        areaName,
        plannedCount,
        actualCount,
        startTime,
        endTime,
        workMinutes,
        totalDistanceKm,
        gpsPointCount,
        speedPerHour,
        coverageDiff: fa?.coverageDiff ?? null,
        speedDeviation: fa?.speedDeviation ?? null,
        fastMoveRatio: fa?.fastMoveRatio ?? null,
        outOfAreaPct: fa?.outOfAreaPct ?? null,
        pauseMinutes: fa?.pauseMinutes ?? null,
        riskScoreV2: fa?.riskScoreV2 ?? null,
        riskLevelV2: fa?.riskLevelV2 ?? null,
        checkGps: s.checkGps,
        checkGpsResult: s.checkGpsResult,
        checkGpsComment: s.checkGpsComment,
        hasSession: !!s.session,
      };
    });

    // Sort by riskScoreV2 DESC (nulls last), then id ASC
    result.sort((a, b) => {
      const aScore = a.riskScoreV2 ?? -1;
      const bScore = b.riskScoreV2 ?? -1;
      if (bScore !== aScore) return bScore - aScore;
      return a.id - b.id;
    });

    // Summary stats
    const total = result.length;
    const reviewed = result.filter((r) => r.checkGps).length;
    const unreviewedHigh = result.filter(
      (r) => (r.riskScoreV2 ?? 0) >= 50 && !r.checkGps
    ).length;

    const dateFormatted = targetDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Tokyo',
    }).replace(/\//g, '-');

    return NextResponse.json({
      date: dateFormatted,
      schedules: result,
      summary: {
        total,
        reviewed,
        unreviewedHigh,
      },
    });
  } catch (err) {
    console.error('GET /api/gps-review error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
