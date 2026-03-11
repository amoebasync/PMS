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

    const dailyRows = attendances
      .filter(a => a.attendanceType?.isWorking || a.attendanceType?.isPaid)
      .map(a => ({
        date: a.date,
        attendanceType: a.attendanceType?.name || '-',
        startTime: a.startTime,
        endTime: a.endTime,
        breakMinutes: a.breakMinutes,
        workHours: a.workHours,
        wage: a.calculatedWage ??
          (financial?.salaryType === 'DAILY'
            ? (financial.dailyRate || 0)
            : Math.floor((financial?.hourlyRate || 0) * (a.workHours || 0))),
      }));

    return NextResponse.json(dailyRows);
  } catch (error) {
    console.error('Payroll daily GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
