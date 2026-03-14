import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function authorize() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  const user = await prisma.employee.findUnique({
    where: { id: parseInt(sessionId) },
    include: { roles: { include: { role: true } } },
  });
  const roles = user?.roles?.map((r: any) => r.role?.code) || [];
  return roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN') ? user : null;
}

// GET: 給与レコードの日別内訳（勤怠＋経費）
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const payrollId = parseInt(id);
    if (isNaN(payrollId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const record = await prisma.payrollRecord.findUnique({
      where: { id: payrollId },
      select: { employeeId: true, periodStart: true, periodEnd: true, status: true },
    });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: record.employeeId,
        date: { gte: record.periodStart, lte: record.periodEnd },
        status: 'APPROVED',
      },
      include: {
        attendanceType: { select: { name: true, isWorking: true, isPaid: true } },
      },
      orderBy: { date: 'asc' },
    });

    const financial = await prisma.employeeFinancial.findUnique({
      where: { employeeId: record.employeeId },
      select: { salaryType: true, hourlyRate: true, dailyRate: true },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        employeeId: record.employeeId,
        date: { gte: record.periodStart, lte: record.periodEnd },
        status: 'APPROVED',
      },
      orderBy: { date: 'asc' },
    });

    type DailyRow = { id: number; date: Date; type: string; attendanceType: string; startTime: string | null; endTime: string | null; breakMinutes: number | null; workHours: number; wage: number; description: string | null; expenseType: string | null; };
    const dailyRows: DailyRow[] = attendances
      .filter(a => a.attendanceType?.isWorking || a.attendanceType?.isPaid)
      .map(a => ({
        id: a.id,
        date: a.date,
        type: 'attendance',
        attendanceType: a.attendanceType?.name || '-',
        startTime: a.startTime,
        endTime: a.endTime,
        breakMinutes: a.breakMinutes,
        workHours: a.workHours,
        wage: a.calculatedWage ??
          (financial?.salaryType === 'DAILY'
            ? (financial.dailyRate || 0)
            : Math.floor((financial?.hourlyRate || 0) * (a.workHours || 0))),
        description: null as string | null,
        expenseType: null as string | null,
      }));

    for (const exp of expenses) {
      dailyRows.push({
        id: exp.id,
        date: exp.date,
        type: 'expense',
        attendanceType: exp.type === 'TRANSPORTATION' ? '交通費' : '経費',
        startTime: null,
        endTime: null,
        breakMinutes: null,
        workHours: 0,
        wage: exp.amount,
        description: exp.description,
        expenseType: exp.type,
      });
    }

    dailyRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ rows: dailyRows, status: record.status });
  } catch (error) {
    console.error('Payroll daily GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// PUT: 日別金額を一括更新 + 給与レコード再計算
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const payrollId = parseInt(id);
    if (isNaN(payrollId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const record = await prisma.payrollRecord.findUnique({ where: { id: payrollId } });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (record.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT records can be edited' }, { status: 400 });

    const body = await request.json();
    const changes: { id: number; type: string; wage: number }[] = body.changes || [];

    // 個別更新
    for (const c of changes) {
      if (c.type === 'attendance') {
        await prisma.attendance.update({
          where: { id: c.id },
          data: { calculatedWage: c.wage },
        });
      } else if (c.type === 'expense') {
        await prisma.expense.update({
          where: { id: c.id },
          data: { amount: c.wage },
        });
      }
    }

    // 給与レコードを再計算
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: record.employeeId,
        date: { gte: record.periodStart, lte: record.periodEnd },
        status: 'APPROVED',
      },
      include: { attendanceType: true },
    });

    const financial = await prisma.employeeFinancial.findUnique({
      where: { employeeId: record.employeeId },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        employeeId: record.employeeId,
        date: { gte: record.periodStart, lte: record.periodEnd },
        status: 'APPROVED',
      },
    });

    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);

    let workGross = 0;
    let totalWorkHours = 0;
    for (const att of attendances) {
      if (!att.attendanceType?.isWorking && !att.attendanceType?.isPaid) continue;
      totalWorkHours += att.workHours || 0;
      workGross += att.calculatedWage ??
        (financial?.salaryType === 'DAILY'
          ? (financial?.dailyRate || 0)
          : Math.floor((financial?.hourlyRate || 0) * (att.workHours || 0)));
    }

    const grossPay = record.paymentCycle === 'MONTHLY'
      ? (record.baseSalary + record.allowance + expenseTotal)
      : (workGross + expenseTotal);

    const totalDeductions = record.absentDeduction + record.healthInsurance + record.pensionInsurance + record.employmentInsurance + record.incomeTax + record.residentTax;
    const netPay = grossPay - totalDeductions;

    await prisma.payrollRecord.update({
      where: { id: payrollId },
      data: { expenseTotal, grossPay, totalDeductions, netPay, totalWorkHours },
    });

    return NextResponse.json({ success: true, grossPay, expenseTotal, totalDeductions, netPay });
  } catch (error) {
    console.error('Payroll daily PUT error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
