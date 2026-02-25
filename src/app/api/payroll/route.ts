import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


// --- ヘルパー関数 ---

// 期間内の指定曜日の日付数を数える (1=月 ... 7=日)
function countTargetWeekdays(start: Date, end: Date, targetDays: number[]): number {
  // JS の getDay(): 0=日, 1=月, ... 6=土  → 変換: JS_day → 1=月...7=日
  const toJsDay = (d: number) => d === 7 ? 0 : d; // 7(日) → 0
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (targetDays.map(toJsDay).includes(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// 期間内の指定曜日の全日付セットを返す (YYYY-MM-DD)
function getTargetWeekdayDates(start: Date, end: Date, targetDays: number[]): Set<string> {
  const toJsDay = (d: number) => d === 7 ? 0 : d;
  const set = new Set<string>();
  const cur = new Date(start);
  while (cur <= end) {
    if (targetDays.map(toJsDay).includes(cur.getDay())) {
      set.add(cur.toISOString().split('T')[0]);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return set;
}

// 週開始日（月曜）から periodStart/End を計算
function getWeekBounds(weekStart: string): { periodStart: Date; periodEnd: Date } {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return { periodStart: start, periodEnd: end };
}

// 月の periodStart/End を計算
function getMonthBounds(year: number, month: number): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0); // 月末
  return { periodStart, periodEnd };
}

// 正社員の欠勤日数・休日出勤日数を計算
function calcFullTimeAttendance(
  attendances: any[],
  periodStart: Date,
  periodEnd: Date,
  workingDayDates: Set<string>,
  hireDate: Date | null
) {
  // カバー済み日付（有給含む）
  const coveredDates = new Set<string>();
  let holidayWorkDays = 0;

  for (const att of attendances) {
    const dateStr = new Date(att.date).toISOString().split('T')[0];
    if (att.attendanceType?.isPaid || att.attendanceType?.isWorking) {
      coveredDates.add(dateStr);
    }
    // 通常出勤日以外での勤務 = 休日出勤
    if ((att.attendanceType?.isWorking) && !workingDayDates.has(dateStr)) {
      holidayWorkDays++;
    }
  }

  // 欠勤: 通常出勤日のうち、入社日以降で、カバーされていない日
  let absentDays = 0;
  for (const dateStr of workingDayDates) {
    if (hireDate && new Date(dateStr) < hireDate) continue;
    if (!coveredDates.has(dateStr)) absentDays++;
  }

  return { absentDays, holidayWorkDays };
}

// --- GET: 給与明細一覧 ---
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUser = await prisma.employee.findUnique({
      where: { id: parseInt(sessionId) },
      include: { roles: { include: { role: true } } },
    });
    const userRoles = currentUser?.roles?.map((r: any) => r.role?.code) || [];
    if (!userRoles.includes('SUPER_ADMIN') && !userRoles.includes('HR_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cycle = searchParams.get('cycle') || 'MONTHLY';
    const status = searchParams.get('status') || 'ALL';
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const weekStart = searchParams.get('weekStart');

    let periodStart: Date, periodEnd: Date;
    if (cycle === 'WEEKLY' && weekStart) {
      ({ periodStart, periodEnd } = getWeekBounds(weekStart));
    } else {
      ({ periodStart, periodEnd } = getMonthBounds(year, month));
    }

    const where: any = {
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    };
    if (status !== 'ALL') where.status = status;

    const records = await prisma.payrollRecord.findMany({
      where,
      include: {
        employee: {
          select: { id: true, employeeCode: true, lastNameJa: true, firstNameJa: true, employmentType: true, branch: { select: { nameJa: true } }, department: { select: { name: true } } }
        }
      },
      orderBy: { employee: { employeeCode: 'asc' } },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error('Payroll GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// --- POST: 一括給与計算 ---
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUser = await prisma.employee.findUnique({
      where: { id: parseInt(sessionId) },
      include: { roles: { include: { role: true } } },
    });
    const userRoles = currentUser?.roles?.map((r: any) => r.role?.code) || [];
    if (!userRoles.includes('SUPER_ADMIN') && !userRoles.includes('HR_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const cycle: string = body.cycle || 'MONTHLY';
    const year: number = body.year || new Date().getFullYear();
    const month: number = body.month || new Date().getMonth() + 1;
    const weekStart: string | undefined = body.weekStart;

    let periodStart: Date, periodEnd: Date;
    if (cycle === 'WEEKLY' && weekStart) {
      ({ periodStart, periodEnd } = getWeekBounds(weekStart));
    } else {
      ({ periodStart, periodEnd } = getMonthBounds(year, month));
    }

    // 対象社員: 月次 → 正社員, 週次 → アルバイト + 業務委託
    const targetEmploymentTypes = cycle === 'MONTHLY' ? ['FULL_TIME'] : ['PART_TIME', 'OUTSOURCE'];

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        employmentType: { in: targetEmploymentTypes as any },
      },
      include: {
        financial: true,
        attendances: {
          where: {
            date: { gte: periodStart, lte: periodEnd },
            status: 'APPROVED',
          },
          include: { attendanceType: true },
        },
      },
    });

    let created = 0, updated = 0, skipped = 0;
    const results: any[] = [];

    for (const emp of employees) {
      const fin = emp.financial;
      if (!fin) { skipped++; continue; }

      // 既存の CONFIRMED/PAID はスキップ
      const existing = await prisma.payrollRecord.findUnique({
        where: { employeeId_periodStart_periodEnd: { employeeId: emp.id, periodStart, periodEnd } },
      });
      if (existing && (existing.status === 'CONFIRMED' || existing.status === 'PAID')) {
        skipped++;
        continue;
      }

      let record: any;

      if (cycle === 'MONTHLY') {
        // ===== 正社員: 月次計算 =====
        const workingDays = (fin.workingWeekdays || '1,2,3,4,5').split(',').map(Number).filter(Boolean);
        const workingDayDates = getTargetWeekdayDates(periodStart, periodEnd, workingDays);
        const workingDaysInPeriod = workingDayDates.size;
        const baseSalary = fin.baseSalary || 0;
        const allowance = fin.allowance || 0;

        const { absentDays, holidayWorkDays } = calcFullTimeAttendance(
          emp.attendances, periodStart, periodEnd, workingDayDates, emp.hireDate
        );

        const dailyUnit = workingDaysInPeriod > 0 ? Math.floor(baseSalary / workingDaysInPeriod) : 0;
        const absentDeduction = Math.floor(dailyUnit * absentDays);
        const grossPay = baseSalary + allowance;
        const healthInsurance = fin.healthInsurance || 0;
        const pensionInsurance = fin.pensionInsurance || 0;
        const employmentInsurance = fin.employmentInsurance || 0;
        const incomeTax = fin.incomeTax || 0;
        const residentTax = fin.residentTax || 0;
        const totalDeductions = absentDeduction + healthInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax;
        const netPay = grossPay - totalDeductions;

        record = {
          employeeId: emp.id,
          employmentType: emp.employmentType,
          periodStart,
          periodEnd,
          paymentCycle: 'MONTHLY',
          baseSalary,
          allowance,
          workingDaysInPeriod,
          absentDays,
          absentDeduction,
          holidayWorkDays,
          totalWorkHours: 0,
          healthInsurance,
          pensionInsurance,
          employmentInsurance,
          incomeTax,
          residentTax,
          grossPay,
          totalDeductions,
          netPay,
          status: 'DRAFT',
        };
      } else {
        // ===== アルバイト・業務委託: 週次計算 =====
        let grossPay = 0;
        let totalWorkHours = 0;

        for (const att of emp.attendances) {
          if (!att.attendanceType?.isWorking && !att.attendanceType?.isPaid) continue;
          totalWorkHours += att.workHours || 0;
          if (fin.salaryType === 'DAILY') {
            grossPay += fin.dailyRate || 0;
          } else {
            // HOURLY (デフォルト)
            grossPay += Math.floor((fin.hourlyRate || 0) * (att.workHours || 0));
          }
        }

        // 業務委託は控除なし, アルバイトは設定済みのものを週割り
        const isOutsource = emp.employmentType === 'OUTSOURCE';
        const weeklyFactor = 1 / 4.33;
        const healthInsurance = isOutsource ? 0 : Math.floor((fin.healthInsurance || 0) * weeklyFactor);
        const pensionInsurance = isOutsource ? 0 : Math.floor((fin.pensionInsurance || 0) * weeklyFactor);
        const employmentInsurance = isOutsource ? 0 : Math.floor((fin.employmentInsurance || 0) * weeklyFactor);
        const incomeTax = isOutsource ? 0 : Math.floor((fin.incomeTax || 0) * weeklyFactor);
        const residentTax = isOutsource ? 0 : Math.floor((fin.residentTax || 0) * weeklyFactor);
        const totalDeductions = healthInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax;
        const netPay = grossPay - totalDeductions;

        record = {
          employeeId: emp.id,
          employmentType: emp.employmentType,
          periodStart,
          periodEnd,
          paymentCycle: 'WEEKLY',
          baseSalary: 0,
          allowance: 0,
          workingDaysInPeriod: 0,
          absentDays: 0,
          absentDeduction: 0,
          holidayWorkDays: 0,
          totalWorkHours,
          healthInsurance,
          pensionInsurance,
          employmentInsurance,
          incomeTax,
          residentTax,
          grossPay,
          totalDeductions,
          netPay,
          status: 'DRAFT',
        };
      }

      await prisma.payrollRecord.upsert({
        where: { employeeId_periodStart_periodEnd: { employeeId: emp.id, periodStart, periodEnd } },
        create: record,
        update: { ...record, status: undefined }, // DRAFT の場合のみ上書き（status は保持）
      });

      if (existing) updated++;
      else created++;

      results.push({ employeeId: emp.id, ...record });
    }

    return NextResponse.json({ created, updated, skipped, total: employees.length });
  } catch (error) {
    console.error('Payroll POST error:', error);
    return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 });
  }
}
