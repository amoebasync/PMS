import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface AreaKpiRow {
  total_schedules: bigint;
  all_distributed_count: bigint;
  area_done_count: bigint;
  give_up_count: bigint;
  other_count: bigint;
  avg_completion_rate: number | null;
  last_distributed: Date | null;
  first_distributed: Date | null;
}

interface TimeSeriesRow {
  period: string;
  schedules_count: bigint;
  total_actual: bigint;
  avg_completion_rate: number | null;
  all_distributed_count: bigint;
  area_done_count: bigint;
}

// GET /api/analytics/areas/[id]
// Detailed analysis for a single area with time series and paginated history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const areaId = parseInt(id);
    if (isNaN(areaId)) {
      return NextResponse.json({ error: 'Invalid area ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to = searchParams.get('to');     // YYYY-MM-DD
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // 1. Fetch area with prefecture and city
    const area = await prisma.area.findUnique({
      where: { id: areaId },
      include: {
        prefecture: { select: { name: true } },
        city: { select: { name: true } },
      },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Build date filter fragments for raw SQL
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    const dateFilterFrom = fromDate ? Prisma.sql`AND ds.date >= ${fromDate}` : Prisma.empty;
    const dateFilterTo = toDate ? Prisma.sql`AND ds.date <= ${toDate}` : Prisma.empty;

    // 2. KPI aggregation for this area
    const kpiRows = await prisma.$queryRaw<AreaKpiRow[]>`
      WITH schedule_stats AS (
        SELECT
          ds.id AS schedule_id,
          ds.date,
          COALESCE(SUM(di.planned_count), 0) AS total_planned,
          COALESCE(SUM(di.actual_count), 0) AS total_actual,
          dsess.incomplete_reason
        FROM distribution_schedules ds
        LEFT JOIN distribution_items di ON di.schedule_id = ds.id
        LEFT JOIN distribution_sessions dsess ON dsess.schedule_id = ds.id
        WHERE ds.status = 'COMPLETED'
          AND ds.area_id = ${areaId}
          ${dateFilterFrom}
          ${dateFilterTo}
        GROUP BY ds.id, ds.date, dsess.incomplete_reason
        HAVING COALESCE(SUM(di.planned_count), 0) > 1
      )
      SELECT
        COUNT(DISTINCT ss.schedule_id) AS total_schedules,
        SUM(CASE WHEN ss.incomplete_reason IS NULL AND ss.total_actual >= ss.total_planned THEN 1 ELSE 0 END) AS all_distributed_count,
        SUM(CASE WHEN ss.incomplete_reason = 'AREA_DONE' THEN 1 ELSE 0 END) AS area_done_count,
        SUM(CASE WHEN ss.incomplete_reason = 'GIVE_UP' THEN 1 ELSE 0 END) AS give_up_count,
        SUM(CASE WHEN ss.incomplete_reason = 'OTHER' THEN 1 ELSE 0 END) AS other_count,
        ROUND(AVG(CASE WHEN ss.total_planned > 0 THEN ss.total_actual * 100.0 / ss.total_planned ELSE 0 END), 1) AS avg_completion_rate,
        MAX(ss.date) AS last_distributed,
        MIN(ss.date) AS first_distributed
      FROM schedule_stats ss
    `;

    const kpiRow = kpiRows[0] || {
      total_schedules: BigInt(0),
      all_distributed_count: BigInt(0),
      area_done_count: BigInt(0),
      give_up_count: BigInt(0),
      other_count: BigInt(0),
      avg_completion_rate: null,
      last_distributed: null,
      first_distributed: null,
    };

    const totalSchedules = Number(kpiRow.total_schedules);

    // Calculate frequency per month
    let frequencyPerMonth = 0;
    if (totalSchedules > 0 && kpiRow.first_distributed && kpiRow.last_distributed) {
      const firstDate = new Date(kpiRow.first_distributed);
      const lastDate = new Date(kpiRow.last_distributed);
      const monthsDiff =
        (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
        (lastDate.getMonth() - firstDate.getMonth());
      const months = Math.max(1, monthsDiff);
      frequencyPerMonth = Math.round((totalSchedules / months) * 10) / 10;
    }

    const kpi = {
      totalSchedules,
      allDistributedCount: Number(kpiRow.all_distributed_count),
      areaDoneCount: Number(kpiRow.area_done_count),
      giveUpCount: Number(kpiRow.give_up_count),
      otherCount: Number(kpiRow.other_count),
      avgCompletionRate: kpiRow.avg_completion_rate != null ? Number(kpiRow.avg_completion_rate) : 0,
      frequencyPerMonth,
      lastDistributed: kpiRow.last_distributed
        ? new Date(kpiRow.last_distributed).toISOString().split('T')[0]
        : null,
    };

    // 3. Time series (monthly aggregation)
    const timeSeriesRows = await prisma.$queryRaw<TimeSeriesRow[]>`
      WITH schedule_stats AS (
        SELECT
          ds.id AS schedule_id,
          ds.date,
          COALESCE(SUM(di.planned_count), 0) AS total_planned,
          COALESCE(SUM(di.actual_count), 0) AS total_actual,
          dsess.incomplete_reason
        FROM distribution_schedules ds
        LEFT JOIN distribution_items di ON di.schedule_id = ds.id
        LEFT JOIN distribution_sessions dsess ON dsess.schedule_id = ds.id
        WHERE ds.status = 'COMPLETED'
          AND ds.area_id = ${areaId}
          ${dateFilterFrom}
          ${dateFilterTo}
        GROUP BY ds.id, ds.date, dsess.incomplete_reason
        HAVING COALESCE(SUM(di.planned_count), 0) > 1
      )
      SELECT
        DATE_FORMAT(ss.date, '%Y-%m') AS period,
        COUNT(DISTINCT ss.schedule_id) AS schedules_count,
        SUM(ss.total_actual) AS total_actual,
        ROUND(AVG(CASE WHEN ss.total_planned > 0 THEN ss.total_actual * 100.0 / ss.total_planned ELSE 0 END), 1) AS avg_completion_rate,
        SUM(CASE WHEN ss.incomplete_reason IS NULL AND ss.total_actual >= ss.total_planned THEN 1 ELSE 0 END) AS all_distributed_count,
        SUM(CASE WHEN ss.incomplete_reason = 'AREA_DONE' THEN 1 ELSE 0 END) AS area_done_count
      FROM schedule_stats ss
      GROUP BY DATE_FORMAT(ss.date, '%Y-%m')
      ORDER BY period ASC
    `;

    const timeSeries = timeSeriesRows.map((row) => ({
      period: row.period,
      schedulesCount: Number(row.schedules_count),
      totalActual: Number(row.total_actual),
      avgCompletionRate: row.avg_completion_rate != null ? Number(row.avg_completion_rate) : 0,
      allDistributedCount: Number(row.all_distributed_count),
      areaDoneCount: Number(row.area_done_count),
    }));

    // 4. Paginated history using Prisma (for richer includes)
    const dateFilter: Prisma.DistributionScheduleWhereInput = {};
    if (fromDate && toDate) {
      dateFilter.date = { gte: fromDate, lte: toDate };
    } else if (fromDate) {
      dateFilter.date = { gte: fromDate };
    } else if (toDate) {
      dateFilter.date = { lte: toDate };
    }

    const historyWhereClean: Prisma.DistributionScheduleWhereInput = {
      status: 'COMPLETED',
      areaId,
      items: {
        some: {
          plannedCount: { gt: 1 },
        },
      },
      ...dateFilter,
    };

    const [historyTotal, historySchedules] = await Promise.all([
      prisma.distributionSchedule.count({ where: historyWhereClean }),
      prisma.distributionSchedule.findMany({
        where: historyWhereClean,
        include: {
          distributor: { select: { id: true, name: true, staffId: true } },
          items: {
            select: {
              plannedCount: true,
              actualCount: true,
            },
          },
          session: {
            select: {
              startedAt: true,
              finishedAt: true,
              incompleteReason: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const history = historySchedules.map((schedule) => {
      const totalPlanned = schedule.items.reduce(
        (sum, item) => sum + (item.plannedCount || 0),
        0
      );
      const totalActual = schedule.items.reduce(
        (sum, item) => sum + (item.actualCount || 0),
        0
      );
      const completionRate =
        totalPlanned > 0
          ? Math.round((totalActual / totalPlanned) * 1000) / 10
          : 0;

      let completionType: 'all_distributed' | 'area_done' | 'give_up' | 'other';
      const reason = schedule.session?.incompleteReason;
      if (reason === null || reason === undefined) {
        completionType = totalActual >= totalPlanned ? 'all_distributed' : 'other';
      } else if (reason === 'AREA_DONE') {
        completionType = 'area_done';
      } else if (reason === 'GIVE_UP') {
        completionType = 'give_up';
      } else {
        completionType = 'other';
      }

      let sessionDuration: number | null = null;
      if (schedule.session?.startedAt && schedule.session?.finishedAt) {
        const diffMs =
          new Date(schedule.session.finishedAt).getTime() -
          new Date(schedule.session.startedAt).getTime();
        sessionDuration = Math.round(diffMs / 60000); // minutes
      }

      return {
        scheduleId: schedule.id,
        date: schedule.date
          ? new Date(schedule.date).toISOString().split('T')[0]
          : null,
        distributorName: schedule.distributor?.name || '-',
        totalPlanned,
        totalActual,
        completionRate,
        completionType,
        sessionDuration,
      };
    });

    const historyTotalPages = Math.ceil(historyTotal / limit);

    return NextResponse.json({
      area: {
        id: area.id,
        areaName: `${area.town_name || ''}${area.chome_name || ''}`.trim() || '-',
        prefecture: area.prefecture.name,
        city: area.city.name,
        doorToDoorCount: area.door_to_door_count,
        multiFamilyCount: area.multi_family_count,
        postingCapWithNg: area.posting_cap_with_ng,
      },
      kpi,
      timeSeries,
      history,
      historyTotal,
      historyPage: page,
      historyTotalPages,
    });
  } catch (error) {
    console.error('Analytics area detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch area analytics detail' },
      { status: 500 }
    );
  }
}
