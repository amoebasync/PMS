import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/** Parse transportationFee string to number (e.g. "15000" -> 15000, null/undefined -> 0) */
function parseFee(fee: string | null | undefined): number {
  if (!fee) return 0;
  const n = parseInt(fee, 10);
  return isNaN(n) ? 0 : n;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Align a date to its week's Sunday (00:00 UTC) */
function toSunday(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  r.setUTCDate(r.getUTCDate() - r.getUTCDay());
  return r;
}

/** Align a date to its week's Saturday */
function toSaturday(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  r.setUTCDate(r.getUTCDate() + (6 - r.getUTCDay()));
  return r;
}

/** Generate all week-start Sundays between start and end */
function weekStarts(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  const cur = toSunday(start);
  const last = toSunday(end);
  while (cur <= last) {
    weeks.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return weeks;
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Count working weekdays in a given month based on workingWeekdays config (e.g. "1,2,3,4,5") */
function workingDaysInMonth(year: number, month: number, workingWeekdays: string): number {
  const days = (workingWeekdays || '1,2,3,4,5').split(',').map(Number);
  let count = 0;
  const d = new Date(Date.UTC(year, month - 1, 1));
  while (d.getUTCMonth() === month - 1) {
    // JS getDay: 0=Sun..6=Sat; workingWeekdays: 1=Mon..7=Sun
    const jsDay = d.getUTCDay();
    const wDay = jsDay === 0 ? 7 : jsDay;
    if (days.includes(wDay)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count || 1; // avoid division by zero
}

/* ------------------------------------------------------------------ */
/*  Tab: summary                                                       */
/* ------------------------------------------------------------------ */

async function fetchSummary(startDate: Date, endDate: Date) {
  // 1) Employee wages from Attendance
  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'APPROVED',
      calculatedWage: { not: null },
    },
    select: { date: true, calculatedWage: true, employeeId: true },
  });

  // 2) Distributor payroll records
  const distPayrolls = await prisma.distributorPayrollRecord.findMany({
    where: {
      periodStart: { gte: startDate, lte: endDate },
    },
    select: { periodStart: true, schedulePay: true, expensePay: true },
  });

  // 3) Employee transport: pro-rate monthly fee by attendance days
  const employeesWithTransport = await prisma.employeeFinancial.findMany({
    where: { transportationFee: { not: null } },
    select: {
      employeeId: true,
      transportationFee: true,
      workingWeekdays: true,
    },
  });
  const transportMap = new Map(
    employeesWithTransport
      .filter(e => parseFee(e.transportationFee) > 0)
      .map(e => [e.employeeId, e]),
  );

  // Calculate employee attendance days per week for transport
  const empAttendancesForTransport = await prisma.attendance.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'APPROVED',
      attendanceType: { isWorking: true },
    },
    select: { date: true, employeeId: true },
  });

  // Build weekly aggregation
  const weeks = weekStarts(startDate, endDate);
  const weeklyMap = new Map<string, {
    employeeSalary: number;
    distributorSalary: number;
    employeeTransport: number;
    distributorTransport: number;
  }>();

  for (const w of weeks) {
    weeklyMap.set(dateKey(w), {
      employeeSalary: 0,
      distributorSalary: 0,
      employeeTransport: 0,
      distributorTransport: 0,
    });
  }

  // Aggregate employee wages per week
  for (const att of attendances) {
    const wk = dateKey(toSunday(att.date));
    const entry = weeklyMap.get(wk);
    if (entry) entry.employeeSalary += att.calculatedWage || 0;
  }

  // Aggregate distributor pay per week
  for (const dp of distPayrolls) {
    const wk = dateKey(toSunday(dp.periodStart));
    const entry = weeklyMap.get(wk);
    if (entry) {
      entry.distributorSalary += dp.schedulePay;
      entry.distributorTransport += dp.expensePay;
    }
  }

  // Calculate employee transport per week (pro-rated)
  // Cache: { employeeId -> { "YYYY-MM" -> dailyTransport } }
  const dailyTransportCache = new Map<number, Map<string, number>>();

  for (const att of empAttendancesForTransport) {
    const emp = transportMap.get(att.employeeId);
    if (!emp || !emp.transportationFee) continue;

    const year = att.date.getUTCFullYear();
    const month = att.date.getUTCMonth() + 1;
    const monthKey = `${year}-${month}`;

    if (!dailyTransportCache.has(att.employeeId)) {
      dailyTransportCache.set(att.employeeId, new Map());
    }
    const empCache = dailyTransportCache.get(att.employeeId)!;
    if (!empCache.has(monthKey)) {
      const wd = workingDaysInMonth(year, month, emp.workingWeekdays || '1,2,3,4,5');
      empCache.set(monthKey, parseFee(emp.transportationFee) / wd);
    }

    const dailyT = empCache.get(monthKey)!;
    const wk = dateKey(toSunday(att.date));
    const entry = weeklyMap.get(wk);
    if (entry) entry.employeeTransport += dailyT;
  }

  // Build response
  const weekly = weeks.map(w => {
    const k = dateKey(w);
    const e = weeklyMap.get(k)!;
    return {
      weekStart: k,
      employeeSalary: Math.round(e.employeeSalary),
      distributorSalary: Math.round(e.distributorSalary),
      employeeTransport: Math.round(e.employeeTransport),
      distributorTransport: Math.round(e.distributorTransport),
    };
  });

  const totals = weekly.reduce(
    (acc, w) => ({
      employeeSalary: acc.employeeSalary + w.employeeSalary,
      distributorSalary: acc.distributorSalary + w.distributorSalary,
      employeeTransport: acc.employeeTransport + w.employeeTransport,
      distributorTransport: acc.distributorTransport + w.distributorTransport,
      grandTotal:
        acc.grandTotal +
        w.employeeSalary +
        w.distributorSalary +
        w.employeeTransport +
        w.distributorTransport,
    }),
    { employeeSalary: 0, distributorSalary: 0, employeeTransport: 0, distributorTransport: 0, grandTotal: 0 },
  );

  return { totals, weekly };
}

/* ------------------------------------------------------------------ */
/*  Tab: employees                                                     */
/* ------------------------------------------------------------------ */

async function fetchEmployees(startDate: Date, endDate: Date) {
  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'APPROVED',
    },
    select: {
      date: true,
      calculatedWage: true,
      employeeId: true,
      attendanceType: { select: { isWorking: true } },
    },
  });

  const employeeIds = [...new Set(attendances.map(a => a.employeeId))];

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      employeeCode: true,
      lastNameJa: true,
      firstNameJa: true,
      employmentType: true,
      departmentId: true,
      branchId: true,
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, nameJa: true } },
      financial: {
        select: { transportationFee: true, workingWeekdays: true },
      },
    },
  });
  const empMap = new Map(employees.map(e => [e.id, e]));

  // Per-employee weekly breakdown
  const result: Record<number, {
    totalWage: number;
    totalTransport: number;
    weeklyBreakdown: Record<string, { wage: number; transport: number }>;
  }> = {};

  const dailyTransportCache = new Map<number, Map<string, number>>();

  for (const att of attendances) {
    if (!result[att.employeeId]) {
      result[att.employeeId] = { totalWage: 0, totalTransport: 0, weeklyBreakdown: {} };
    }
    const r = result[att.employeeId];
    const wk = dateKey(toSunday(att.date));

    if (!r.weeklyBreakdown[wk]) {
      r.weeklyBreakdown[wk] = { wage: 0, transport: 0 };
    }

    const wage = att.calculatedWage || 0;
    r.totalWage += wage;
    r.weeklyBreakdown[wk].wage += wage;

    // Transport
    if (att.attendanceType?.isWorking) {
      const emp = empMap.get(att.employeeId);
      const feeNum = parseFee(emp?.financial?.transportationFee);
      if (feeNum > 0) {
        const year = att.date.getUTCFullYear();
        const month = att.date.getUTCMonth() + 1;
        const monthKey = `${year}-${month}`;

        if (!dailyTransportCache.has(att.employeeId)) {
          dailyTransportCache.set(att.employeeId, new Map());
        }
        const cache = dailyTransportCache.get(att.employeeId)!;
        if (!cache.has(monthKey)) {
          const wd = workingDaysInMonth(year, month, emp!.financial!.workingWeekdays || '1,2,3,4,5');
          cache.set(monthKey, feeNum / wd);
        }
        const daily = cache.get(monthKey)!;
        r.totalTransport += daily;
        r.weeklyBreakdown[wk].transport += daily;
      }
    }
  }

  // Also include employees who have no attendance but have financial data (monthly salary employees)
  // They might have a baseSalary but no attendance yet

  const employeeList = Object.entries(result).map(([idStr, data]) => {
    const emp = empMap.get(Number(idStr));
    return {
      id: Number(idStr),
      employeeCode: emp?.employeeCode || '',
      name: `${emp?.lastNameJa || ''} ${emp?.firstNameJa || ''}`.trim(),
      employmentType: emp?.employmentType || '',
      department: emp?.department?.name || '',
      departmentId: emp?.departmentId || null,
      branch: emp?.branch?.nameJa || '',
      branchId: emp?.branchId || null,
      totalWage: Math.round(data.totalWage),
      totalTransport: Math.round(data.totalTransport),
      total: Math.round(data.totalWage + data.totalTransport),
      weeklyBreakdown: Object.entries(data.weeklyBreakdown).map(([wk, v]) => ({
        weekStart: wk,
        wage: Math.round(v.wage),
        transport: Math.round(v.transport),
      })),
    };
  });

  employeeList.sort((a, b) => b.total - a.total);

  return { employees: employeeList };
}

/* ------------------------------------------------------------------ */
/*  Tab: distributors                                                  */
/* ------------------------------------------------------------------ */

async function fetchDistributors(startDate: Date, endDate: Date) {
  const payrolls = await prisma.distributorPayrollRecord.findMany({
    where: {
      periodStart: { gte: startDate, lte: endDate },
    },
    select: {
      distributorId: true,
      periodStart: true,
      schedulePay: true,
      expensePay: true,
      grossPay: true,
      status: true,
      distributor: {
        select: {
          id: true,
          staffId: true,
          name: true,
          branchId: true,
          branch: { select: { id: true, nameJa: true } },
        },
      },
    },
    orderBy: { periodStart: 'asc' },
  });

  // Group by distributor
  const grouped: Record<number, {
    distributor: typeof payrolls[0]['distributor'];
    totalSchedulePay: number;
    totalExpensePay: number;
    totalGrossPay: number;
    weeklyBreakdown: Array<{ weekStart: string; schedulePay: number; expensePay: number }>;
  }> = {};

  for (const p of payrolls) {
    if (!grouped[p.distributorId]) {
      grouped[p.distributorId] = {
        distributor: p.distributor,
        totalSchedulePay: 0,
        totalExpensePay: 0,
        totalGrossPay: 0,
        weeklyBreakdown: [],
      };
    }
    const g = grouped[p.distributorId];
    g.totalSchedulePay += p.schedulePay;
    g.totalExpensePay += p.expensePay;
    g.totalGrossPay += p.grossPay;
    g.weeklyBreakdown.push({
      weekStart: dateKey(p.periodStart),
      schedulePay: p.schedulePay,
      expensePay: p.expensePay,
    });
  }

  const distributors = Object.values(grouped).map(g => ({
    id: g.distributor.id,
    staffId: g.distributor.staffId || '',
    name: g.distributor.name,
    branch: g.distributor.branch?.nameJa || '',
    branchId: g.distributor.branch?.id || null,
    totalSchedulePay: g.totalSchedulePay,
    totalExpensePay: g.totalExpensePay,
    totalGrossPay: g.totalGrossPay,
    weeklyBreakdown: g.weeklyBreakdown,
  }));

  distributors.sort((a, b) => b.totalGrossPay - a.totalGrossPay);

  return { distributors };
}

/* ------------------------------------------------------------------ */
/*  Tab: departments                                                   */
/* ------------------------------------------------------------------ */

async function fetchDepartments(startDate: Date, endDate: Date) {
  // Fetch employee data
  const { employees } = await fetchEmployees(startDate, endDate);
  const { distributors } = await fetchDistributors(startDate, endDate);

  // Group employees by department
  const deptMap: Record<string, {
    id: number | null;
    name: string;
    employeeCount: number;
    totalWage: number;
    totalTransport: number;
  }> = {};

  for (const emp of employees) {
    const deptName = emp.department || '(未所属)';
    if (!deptMap[deptName]) {
      deptMap[deptName] = { id: emp.departmentId, name: deptName, employeeCount: 0, totalWage: 0, totalTransport: 0 };
    }
    deptMap[deptName].employeeCount++;
    deptMap[deptName].totalWage += emp.totalWage;
    deptMap[deptName].totalTransport += emp.totalTransport;
  }

  // Group by branch (employees + distributors)
  const branchMap: Record<string, {
    id: number | null;
    name: string;
    employeeCount: number;
    distributorCount: number;
    employeeTotalWage: number;
    distributorTotalWage: number;
    distributorTotalTransport: number;
    employeeTotalTransport: number;
  }> = {};

  for (const emp of employees) {
    const branchName = emp.branch || '(未所属)';
    if (!branchMap[branchName]) {
      branchMap[branchName] = {
        id: emp.branchId,
        name: branchName,
        employeeCount: 0,
        distributorCount: 0,
        employeeTotalWage: 0,
        distributorTotalWage: 0,
        distributorTotalTransport: 0,
        employeeTotalTransport: 0,
      };
    }
    branchMap[branchName].employeeCount++;
    branchMap[branchName].employeeTotalWage += emp.totalWage;
    branchMap[branchName].employeeTotalTransport += emp.totalTransport;
  }

  for (const dist of distributors) {
    const branchName = dist.branch || '(未所属)';
    if (!branchMap[branchName]) {
      branchMap[branchName] = {
        id: dist.branchId,
        name: branchName,
        employeeCount: 0,
        distributorCount: 0,
        employeeTotalWage: 0,
        distributorTotalWage: 0,
        distributorTotalTransport: 0,
        employeeTotalTransport: 0,
      };
    }
    branchMap[branchName].distributorCount++;
    branchMap[branchName].distributorTotalWage += dist.totalSchedulePay;
    branchMap[branchName].distributorTotalTransport += dist.totalExpensePay;
  }

  const departments = Object.values(deptMap).sort((a, b) => (b.totalWage + b.totalTransport) - (a.totalWage + a.totalTransport));
  const branches = Object.values(branchMap).sort((a, b) => {
    const aTotal = a.employeeTotalWage + a.distributorTotalWage + a.employeeTotalTransport + a.distributorTotalTransport;
    const bTotal = b.employeeTotalWage + b.distributorTotalWage + b.employeeTotalTransport + b.distributorTotalTransport;
    return bTotal - aTotal;
  });

  return { departments, branches };
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'summary';
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    if (!startParam || !endParam) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = toSunday(new Date(startParam + 'T00:00:00Z'));
    const endDate = toSaturday(new Date(endParam + 'T00:00:00Z'));

    let data;
    switch (tab) {
      case 'summary':
        data = await fetchSummary(startDate, endDate);
        break;
      case 'employees':
        data = await fetchEmployees(startDate, endDate);
        break;
      case 'distributors':
        data = await fetchDistributors(startDate, endDate);
        break;
      case 'departments':
        data = await fetchDepartments(startDate, endDate);
        break;
      default:
        return NextResponse.json({ error: 'Invalid tab parameter' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Salary analysis error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
