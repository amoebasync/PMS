import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// ---------- Raw row types ----------

interface KpiRow {
  total_planned: bigint;
  total_actual: bigint;
  schedules_count: bigint;
}

interface TrendRow {
  period: string;
  planned: bigint;
  actual: bigint;
}

interface BranchRow {
  branch_id: number;
  branch_name: string;
  planned: bigint;
  actual: bigint;
}

// (StaffRow is defined inline in the handler)

// ---------- Helpers ----------

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Mon=0
  const r = new Date(d);
  r.setDate(r.getDate() - diff);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// GET /api/analytics/distribution
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sp = request.nextUrl.searchParams;
    const period = sp.get('period') || 'monthly'; // daily | weekly | monthly
    const now = new Date();

    let dateFrom: string;
    let dateTo: string;

    if (sp.get('dateFrom') && sp.get('dateTo')) {
      dateFrom = sp.get('dateFrom')!;
      dateTo = sp.get('dateTo')!;
    } else if (period === 'daily') {
      // Current month
      dateFrom = dateStr(startOfMonth(now));
      dateTo = dateStr(endOfMonth(now));
    } else if (period === 'weekly') {
      // Last 12 weeks
      const from = new Date(now);
      from.setDate(from.getDate() - 12 * 7);
      dateFrom = dateStr(startOfWeek(from));
      dateTo = dateStr(now);
    } else {
      // Last 12 months
      const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      dateFrom = dateStr(from);
      dateTo = dateStr(endOfMonth(now));
    }

    const branchId = sp.get('branchId') ? parseInt(sp.get('branchId')!, 10) : null;
    const distributorId = sp.get('distributorId') ? parseInt(sp.get('distributorId')!, 10) : null;

    // Build WHERE clause fragments
    const whereParts: string[] = [
      `ds.status = 'COMPLETED'`,
      `ds.date >= '${dateFrom}'`,
      `ds.date <= '${dateTo}'`,
    ];
    if (branchId) whereParts.push(`ds.branch_id = ${branchId}`);
    if (distributorId) whereParts.push(`ds.distributor_id = ${distributorId}`);
    const WHERE = whereParts.join(' AND ');

    // ---- KPI ----
    const kpiRows = await prisma.$queryRawUnsafe<KpiRow[]>(`
      SELECT
        COALESCE(SUM(di.planned_count), 0) AS total_planned,
        COALESCE(SUM(di.actual_count), 0) AS total_actual,
        COUNT(DISTINCT ds.id) AS schedules_count
      FROM distribution_schedules ds
      LEFT JOIN distribution_items di ON di.schedule_id = ds.id
      WHERE ${WHERE}
    `);

    // Complaint & fraud counts (parallel)
    const complaintWhere: string[] = [
      `c.occurred_at >= '${dateFrom}'`,
      `c.occurred_at <= '${dateTo}'`,
    ];
    if (branchId) complaintWhere.push(`c.branch_id = ${branchId}`);
    if (distributorId) complaintWhere.push(`c.distributor_id = ${distributorId}`);
    const CW = complaintWhere.join(' AND ');

    const [complaintCountResult, fraudCountResult] = await Promise.all([
      prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
        `SELECT COUNT(*) AS cnt FROM complaints c WHERE ${CW}`
      ),
      prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
        `SELECT COUNT(*) AS cnt FROM complaints c WHERE ${CW} AND c.is_fraud = true`
      ),
    ]);

    const kpiRow = kpiRows[0];
    const totalPlanned = Number(kpiRow?.total_planned ?? 0);
    const totalActual = Number(kpiRow?.total_actual ?? 0);

    const kpi = {
      totalPlanned,
      totalActual,
      distributionRate: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 1000) / 10 : 0,
      complaintCount: Number(complaintCountResult[0]?.cnt ?? 0),
      fraudCount: Number(fraudCountResult[0]?.cnt ?? 0),
      schedulesCount: Number(kpiRow?.schedules_count ?? 0),
    };

    // ---- Trend ----
    let dateExpr: string;
    if (period === 'daily') {
      dateExpr = `DATE_FORMAT(ds.date, '%Y-%m-%d')`;
    } else if (period === 'weekly') {
      // ISO week start (Monday)
      dateExpr = `DATE_FORMAT(DATE_SUB(ds.date, INTERVAL (WEEKDAY(ds.date)) DAY), '%Y-%m-%d')`;
    } else {
      dateExpr = `DATE_FORMAT(ds.date, '%Y-%m')`;
    }

    const trendRows = await prisma.$queryRawUnsafe<TrendRow[]>(`
      SELECT
        ${dateExpr} AS period,
        COALESCE(SUM(di.planned_count), 0) AS planned,
        COALESCE(SUM(di.actual_count), 0) AS actual
      FROM distribution_schedules ds
      LEFT JOIN distribution_items di ON di.schedule_id = ds.id
      WHERE ${WHERE}
      GROUP BY period
      ORDER BY period ASC
    `);

    const trend = trendRows.map(r => {
      const planned = Number(r.planned);
      const actual = Number(r.actual);
      return {
        period: r.period,
        planned,
        actual,
        rate: planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0,
      };
    });

    // ---- Branch comparison ----
    const branchRows = await prisma.$queryRawUnsafe<BranchRow[]>(`
      SELECT
        ds.branch_id,
        b.name_ja AS branch_name,
        COALESCE(SUM(di.planned_count), 0) AS planned,
        COALESCE(SUM(di.actual_count), 0) AS actual
      FROM distribution_schedules ds
      LEFT JOIN distribution_items di ON di.schedule_id = ds.id
      LEFT JOIN branches b ON b.id = ds.branch_id
      WHERE ${WHERE} AND ds.branch_id IS NOT NULL
      GROUP BY ds.branch_id, b.name_ja
      ORDER BY planned DESC
    `);

    const branchComparison = branchRows.map(r => {
      const planned = Number(r.planned);
      const actual = Number(r.actual);
      return {
        branchId: r.branch_id,
        branchName: r.branch_name || '-',
        planned,
        actual,
        rate: planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0,
      };
    });

    // ---- Staff list ----
    interface StaffRow {
      distributor_id: number;
      name: string;
      staff_id: string | null;
      branch_name: string | null;
      area_names: string | null;
      flyer_type_count: bigint;
      planned: bigint;
      actual: bigint;
    }

    const staffRows = await prisma.$queryRawUnsafe<StaffRow[]>(`
      SELECT
        ds.distributor_id,
        fd.name,
        fd.staff_id,
        b.name_ja AS branch_name,
        GROUP_CONCAT(DISTINCT a.chome_name ORDER BY a.chome_name SEPARATOR ', ') AS area_names,
        COUNT(DISTINCT di.id) AS flyer_type_count,
        COALESCE(SUM(di.planned_count), 0) AS planned,
        COALESCE(SUM(di.actual_count), 0) AS actual
      FROM distribution_schedules ds
      LEFT JOIN distribution_items di ON di.schedule_id = ds.id
      LEFT JOIN flyer_distributors fd ON fd.id = ds.distributor_id
      LEFT JOIN branches b ON b.id = fd.branch_id
      LEFT JOIN areas a ON a.id = ds.area_id
      WHERE ${WHERE} AND ds.distributor_id IS NOT NULL
      GROUP BY ds.distributor_id, fd.name, fd.staff_id, b.name_ja
      HAVING SUM(di.planned_count) > 0
      ORDER BY fd.name ASC
    `);

    const staffList = staffRows.map(r => {
      const planned = Number(r.planned);
      const actual = Number(r.actual);
      return {
        distributorId: r.distributor_id,
        name: r.name || '-',
        staffId: r.staff_id || '-',
        branchName: r.branch_name || '-',
        areaNames: r.area_names || '-',
        flyerTypeCount: Number(r.flyer_type_count),
        planned,
        actual,
        rate: planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0,
      };
    });

    return NextResponse.json({
      kpi,
      trend,
      branchComparison,
      staffList,
    });
  } catch (error) {
    console.error('Distribution analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch distribution analytics' },
      { status: 500 }
    );
  }
}
