import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

interface ScheduleStatsRow {
  area_id: number;
  prefecture_name: string | null;
  city_name: string | null;
  chome_name: string | null;
  schedules_count: bigint;
  avg_completion_rate: number | null;
  all_distributed_count: bigint;
  area_done_count: bigint;
  last_distributed: Date | null;
}

interface KpiRow {
  total_areas: bigint;
  total_completed_schedules: bigint;
  total_all_distributed: bigint;
  total_area_done: bigint;
}

// GET /api/analytics/areas/overview
// Dashboard overview: KPI totals, top 10 areas needing review, top 10 most frequent areas
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // KPI totals
    const kpiRows = await prisma.$queryRaw<KpiRow[]>`
      WITH schedule_stats AS (
        SELECT
          ds.id AS schedule_id,
          ds.area_id,
          COALESCE(SUM(di.planned_count), 0) AS total_planned,
          COALESCE(SUM(di.actual_count), 0) AS total_actual,
          dsess.incomplete_reason
        FROM distribution_schedules ds
        LEFT JOIN distribution_items di ON di.schedule_id = ds.id AND di.planned_count > 1
        LEFT JOIN distribution_sessions dsess ON dsess.schedule_id = ds.id
        WHERE ds.status = 'COMPLETED'
          AND ds.area_id IS NOT NULL
        GROUP BY ds.id, ds.area_id, dsess.incomplete_reason
        HAVING COALESCE(SUM(di.planned_count), 0) > 1
      )
      SELECT
        COUNT(DISTINCT ss.area_id) AS total_areas,
        COUNT(DISTINCT ss.schedule_id) AS total_completed_schedules,
        SUM(CASE WHEN ss.incomplete_reason IS NULL AND ss.total_actual >= ss.total_planned THEN 1 ELSE 0 END) AS total_all_distributed,
        SUM(CASE WHEN ss.incomplete_reason = 'AREA_DONE' THEN 1 ELSE 0 END) AS total_area_done
      FROM schedule_stats ss
    `;

    const kpiRow = kpiRows[0] || {
      total_areas: BigInt(0),
      total_completed_schedules: BigInt(0),
      total_all_distributed: BigInt(0),
      total_area_done: BigInt(0),
    };

    const kpi = {
      totalAreas: Number(kpiRow.total_areas),
      totalCompletedSchedules: Number(kpiRow.total_completed_schedules),
      totalAllDistributed: Number(kpiRow.total_all_distributed),
      totalAreaDone: Number(kpiRow.total_area_done),
    };

    // Areas needing review (lowest avg completion rate, limit 10)
    const needsReviewRows = await prisma.$queryRaw<ScheduleStatsRow[]>`
      WITH schedule_stats AS (
        SELECT
          ds.id AS schedule_id,
          ds.area_id,
          ds.date,
          COALESCE(SUM(di.planned_count), 0) AS total_planned,
          COALESCE(SUM(di.actual_count), 0) AS total_actual,
          dsess.incomplete_reason
        FROM distribution_schedules ds
        LEFT JOIN distribution_items di ON di.schedule_id = ds.id AND di.planned_count > 1
        LEFT JOIN distribution_sessions dsess ON dsess.schedule_id = ds.id
        WHERE ds.status = 'COMPLETED'
          AND ds.area_id IS NOT NULL
        GROUP BY ds.id, ds.area_id, ds.date, dsess.incomplete_reason
        HAVING COALESCE(SUM(di.planned_count), 0) > 1
      )
      SELECT
        ss.area_id,
        p.name AS prefecture_name,
        c.name AS city_name,
        a.chome_name,
        COUNT(DISTINCT ss.schedule_id) AS schedules_count,
        ROUND(AVG(CASE WHEN ss.total_planned > 0 THEN LEAST(ss.total_actual * 100.0 / ss.total_planned, 100.0) ELSE 0 END), 1) AS avg_completion_rate,
        SUM(CASE WHEN ss.incomplete_reason IS NULL AND ss.total_actual >= ss.total_planned THEN 1 ELSE 0 END) AS all_distributed_count,
        SUM(CASE WHEN ss.incomplete_reason = 'AREA_DONE' THEN 1 ELSE 0 END) AS area_done_count,
        MAX(ss.date) AS last_distributed
      FROM schedule_stats ss
      JOIN areas a ON a.id = ss.area_id
      JOIN prefectures p ON p.id = a.prefecture_id
      JOIN cities c ON c.id = a.city_id
      GROUP BY ss.area_id, p.name, c.name, a.chome_name
      ORDER BY avg_completion_rate ASC
      LIMIT 10
    `;

    // Most frequently distributed areas (limit 10)
    const mostFrequentRows = await prisma.$queryRaw<ScheduleStatsRow[]>`
      WITH schedule_stats AS (
        SELECT
          ds.id AS schedule_id,
          ds.area_id,
          ds.date,
          COALESCE(SUM(di.planned_count), 0) AS total_planned,
          COALESCE(SUM(di.actual_count), 0) AS total_actual,
          dsess.incomplete_reason
        FROM distribution_schedules ds
        LEFT JOIN distribution_items di ON di.schedule_id = ds.id AND di.planned_count > 1
        LEFT JOIN distribution_sessions dsess ON dsess.schedule_id = ds.id
        WHERE ds.status = 'COMPLETED'
          AND ds.area_id IS NOT NULL
        GROUP BY ds.id, ds.area_id, ds.date, dsess.incomplete_reason
        HAVING COALESCE(SUM(di.planned_count), 0) > 1
      )
      SELECT
        ss.area_id,
        p.name AS prefecture_name,
        c.name AS city_name,
        a.chome_name,
        COUNT(DISTINCT ss.schedule_id) AS schedules_count,
        ROUND(AVG(CASE WHEN ss.total_planned > 0 THEN LEAST(ss.total_actual * 100.0 / ss.total_planned, 100.0) ELSE 0 END), 1) AS avg_completion_rate,
        SUM(CASE WHEN ss.incomplete_reason IS NULL AND ss.total_actual >= ss.total_planned THEN 1 ELSE 0 END) AS all_distributed_count,
        SUM(CASE WHEN ss.incomplete_reason = 'AREA_DONE' THEN 1 ELSE 0 END) AS area_done_count,
        MAX(ss.date) AS last_distributed
      FROM schedule_stats ss
      JOIN areas a ON a.id = ss.area_id
      JOIN prefectures p ON p.id = a.prefecture_id
      JOIN cities c ON c.id = a.city_id
      GROUP BY ss.area_id, p.name, c.name, a.chome_name
      ORDER BY schedules_count DESC
      LIMIT 10
    `;

    const mapRow = (row: ScheduleStatsRow) => ({
      areaId: row.area_id,
      areaName: `${row.prefecture_name || ''}${row.city_name || ''}${row.chome_name || ''}`.trim() || '-',
      schedulesCount: Number(row.schedules_count),
      avgCompletionRate: row.avg_completion_rate != null ? Number(row.avg_completion_rate) : 0,
      allDistributedCount: Number(row.all_distributed_count),
      areaDoneCount: Number(row.area_done_count),
      lastDistributed: row.last_distributed
        ? row.last_distributed.toISOString().split('T')[0]
        : null,
    });

    return NextResponse.json({
      kpi,
      needsReview: needsReviewRows.map(mapRow),
      mostFrequent: mostFrequentRows.map(mapRow),
    });
  } catch (error) {
    console.error('Analytics areas overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch area analytics overview' },
      { status: 500 }
    );
  }
}
