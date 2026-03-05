import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

/**
 * Compute a 0-100 score for a field inspection based on category-specific fields.
 */
function computeInspectionScore(insp: any): number | null {
  if (insp.category === 'CHECK') {
    const scores: number[] = [];
    if (insp.coverageChecked && insp.coverageChecked > 0 && insp.coverageFound != null) {
      scores.push(Math.min(100, (insp.coverageFound / insp.coverageChecked) * 100));
    }
    if (insp.prohibitedTotal && insp.prohibitedTotal > 0) {
      scores.push(insp.prohibitedViolations === 0 ? 100 : Math.max(0, 100 - (insp.prohibitedViolations / insp.prohibitedTotal) * 100));
    }
    const miMap: Record<string, number> = { NONE: 100, MINOR: 70, SOME: 40, MANY: 10 };
    if (insp.multipleInsertion && miMap[insp.multipleInsertion] != null) {
      scores.push(miMap[insp.multipleInsertion]);
    }
    const ftMap: Record<string, number> = { NONE: 100, SUSPICIOUS: 50, FOUND: 0 };
    if (insp.fraudTrace && ftMap[insp.fraudTrace] != null) {
      scores.push(ftMap[insp.fraudTrace]);
    }
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  } else {
    const scores: number[] = [];
    const speedMap: Record<string, number> = { VERY_SLOW: 20, SLOW: 40, NORMAL: 60, FAST: 80, VERY_FAST: 100 };
    const threeMap: Record<string, number> = { NO_MISTAKES: 100, SOME: 50, MANY: 0, BAD: 0, NORMAL: 50, GOOD: 100 };
    if (insp.distributionSpeed && speedMap[insp.distributionSpeed] != null) scores.push(speedMap[insp.distributionSpeed]);
    if (insp.stickerCompliance && threeMap[insp.stickerCompliance] != null) scores.push(threeMap[insp.stickerCompliance]);
    if (insp.prohibitedCompliance && threeMap[insp.prohibitedCompliance] != null) scores.push(threeMap[insp.prohibitedCompliance]);
    if (insp.mapComprehension && threeMap[insp.mapComprehension] != null) scores.push(threeMap[insp.mapComprehension]);
    if (insp.workAttitude && threeMap[insp.workAttitude] != null) scores.push(threeMap[insp.workAttitude]);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'total';
    const month = url.searchParams.get('month'); // e.g. 2026-03

    // Determine date range
    let dateFrom: Date;
    let dateTo: Date;
    const now = new Date();

    if (period === 'monthly' && month) {
      const [year, mon] = month.split('-').map(Number);
      dateFrom = new Date(year, mon - 1, 1);
      dateTo = new Date(year, mon, 1);
    } else {
      dateFrom = new Date(0);
      dateTo = new Date(now.getTime() + 86400000);
    }

    // Fetch distributor basic info
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
      select: { rank: true, currentScore: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Build date filter for schedules/complaints
    const dateFilter = period === 'monthly' && month
      ? { gte: dateFrom, lt: dateTo }
      : undefined;

    // 1. Schedules + Items for KPI
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        distributorId,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: {
        items: { select: { plannedCount: true, actualCount: true } },
        session: {
          select: { startedAt: true, finishedAt: true },
        },
      },
    });

    const totalSchedules = schedules.length;
    let totalPlanned = 0;
    let totalDelivered = 0;
    for (const s of schedules) {
      for (const item of s.items) {
        totalPlanned += item.plannedCount || 0;
        totalDelivered += item.actualCount || 0;
      }
    }
    const completionRate = totalPlanned > 0 ? Math.round((totalDelivered / totalPlanned) * 1000) / 10 : 0;

    // 2. DistributionSession for speed calculation
    const sessions = await prisma.distributionSession.findMany({
      where: {
        distributorId,
        finishedAt: { not: null },
        ...(dateFilter ? { startedAt: dateFilter } : {}),
      },
      include: {
        schedule: {
          include: {
            items: { select: { actualCount: true } },
          },
        },
      },
    });

    let totalSessionDelivered = 0;
    let totalSessionHours = 0;
    for (const session of sessions) {
      if (!session.finishedAt) continue;
      const durationMs = session.finishedAt.getTime() - session.startedAt.getTime();
      const hours = durationMs / (1000 * 60 * 60);
      if (hours <= 0) continue;
      const sessionDelivered = session.schedule.items.reduce(
        (sum, item) => sum + (item.actualCount || 0),
        0
      );
      totalSessionDelivered += sessionDelivered;
      totalSessionHours += hours;
    }
    const avgSpeed = totalSessionHours > 0
      ? Math.round(totalSessionDelivered / totalSessionHours)
      : 0;

    // 3. Complaints
    const complaints = await prisma.complaint.findMany({
      where: {
        distributorId,
        ...(dateFilter ? { occurredAt: dateFilter } : {}),
      },
      include: {
        complaintType: { select: { name: true } },
      },
    });
    const totalComplaints = complaints.length;
    const fraudCount = complaints.filter(c => c.isFraud).length;

    // 4. FieldInspections
    const inspections = await prisma.fieldInspection.findMany({
      where: {
        distributorId,
        ...(dateFilter ? { inspectedAt: dateFilter } : {}),
      },
      include: {
        inspector: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
      orderBy: { inspectedAt: 'desc' },
    });

    // Compute average inspection score (0-100 scale)
    let inspectionScoreSum = 0;
    let inspectionScoreCount = 0;
    for (const insp of inspections) {
      const score = computeInspectionScore(insp);
      if (score != null) {
        inspectionScoreSum += score;
        inspectionScoreCount++;
      }
    }
    const avgInspectionScore = inspectionScoreCount > 0
      ? Math.round(inspectionScoreSum / inspectionScoreCount)
      : 0;

    // 5. Time series (weekly)
    const timeSeriesFrom = period === 'monthly' && month
      ? dateFrom
      : new Date(now.getTime() - 12 * 7 * 86400000);
    const timeSeriesTo = period === 'monthly' && month ? dateTo : now;

    const timeSeriesSchedules = await prisma.distributionSchedule.findMany({
      where: {
        distributorId,
        date: { gte: timeSeriesFrom, lt: timeSeriesTo },
      },
      include: {
        items: { select: { actualCount: true } },
        session: { select: { startedAt: true, finishedAt: true } },
      },
      orderBy: { date: 'asc' },
    });

    const timeSeriesComplaints = await prisma.complaint.findMany({
      where: {
        distributorId,
        occurredAt: { gte: timeSeriesFrom, lt: timeSeriesTo },
      },
      select: { occurredAt: true },
    });

    // Group by ISO week
    const weekMap = new Map<string, { delivered: number; speedNum: number; speedDen: number; complaints: number }>();

    for (const s of timeSeriesSchedules) {
      if (!s.date) continue;
      const weekKey = getISOWeekKey(s.date);
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { delivered: 0, speedNum: 0, speedDen: 0, complaints: 0 });
      }
      const entry = weekMap.get(weekKey)!;
      for (const item of s.items) {
        entry.delivered += item.actualCount || 0;
      }
      if (s.session?.finishedAt) {
        const hours = (s.session.finishedAt.getTime() - s.session.startedAt.getTime()) / (1000 * 60 * 60);
        if (hours > 0) {
          const delivered = s.items.reduce((sum, item) => sum + (item.actualCount || 0), 0);
          entry.speedNum += delivered;
          entry.speedDen += hours;
        }
      }
    }

    for (const c of timeSeriesComplaints) {
      const weekKey = getISOWeekKey(c.occurredAt);
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { delivered: 0, speedNum: 0, speedDen: 0, complaints: 0 });
      }
      weekMap.get(weekKey)!.complaints++;
    }

    const timeSeries = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({
        period,
        delivered: data.delivered,
        speed: data.speedDen > 0 ? Math.round(data.speedNum / data.speedDen) : 0,
        complaints: data.complaints,
      }));

    // 6. Complaint breakdown
    const breakdownMap = new Map<string, { count: number; isFraud: boolean }>();
    for (const c of complaints) {
      const typeName = c.complaintType?.name || 'その他';
      if (!breakdownMap.has(typeName)) {
        breakdownMap.set(typeName, { count: 0, isFraud: false });
      }
      const entry = breakdownMap.get(typeName)!;
      entry.count++;
      if (c.isFraud) entry.isFraud = true;
    }
    const complaintBreakdown = Array.from(breakdownMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      isFraud: data.isFraud,
    }));

    // 7. Recent inspections (top 5)
    const recentInspections = inspections.slice(0, 5).map(insp => ({
      inspectedAt: insp.inspectedAt,
      category: insp.category,
      score: computeInspectionScore(insp),
      inspectorName: `${insp.inspector.lastNameJa} ${insp.inspector.firstNameJa}`,
    }));

    return NextResponse.json({
      kpi: {
        totalSchedules,
        totalDelivered,
        completionRate,
        avgSpeed,
        totalComplaints,
        fraudCount,
        avgInspectionScore,
        currentRank: distributor.rank || '-',
        currentScore: distributor.currentScore,
      },
      timeSeries,
      complaintBreakdown,
      recentInspections,
    });
  } catch (error) {
    console.error('Analytics API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

/**
 * Get ISO week string like "2026-W10"
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
