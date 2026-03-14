import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET: 給与レコードの日別内訳（勤怠データ）を取得
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const payrollId = parseInt(id);
    if (isNaN(payrollId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const record = await prisma.payrollRecord.findUnique({
      where: { id: payrollId },
      select: { employeeId: true, periodStart: true, periodEnd: true },
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

    // 日別の給与を計算
    const financial = await prisma.employeeFinancial.findUnique({
      where: { employeeId: record.employeeId },
      select: { salaryType: true, hourlyRate: true, dailyRate: true },
    });

    // 経費データを取得
    const expenses = await prisma.expense.findMany({
      where: {
        employeeId: record.employeeId,
        date: { gte: record.periodStart, lte: record.periodEnd },
        status: 'APPROVED',
      },
      orderBy: { date: 'asc' },
    });

    type DailyRow = { date: Date; type: string; attendanceType: string; startTime: string | null; endTime: string | null; breakMinutes: number | null; workHours: number; wage: number; description: string | null; expenseType: string | null; };
    const dailyRows: DailyRow[] = attendances
      .filter(a => a.attendanceType?.isWorking || a.attendanceType?.isPaid)
      .map(a => ({
        date: a.date,
        type: 'attendance' as const,
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

    // 経費行を追加
    for (const exp of expenses) {
      dailyRows.push({
        date: exp.date,
        type: 'expense' as const,
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

    // 日付順にソート
    dailyRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json(dailyRows);
  } catch (error) {
    console.error('Payroll daily GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
