import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const empId = parseInt(sessionId);

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0');

    const emp = await prisma.employee.findUnique({ where: { id: empId }, include: { financial: true } });
    const salaryType = emp?.financial?.salaryType || 'MONTHLY';

    let startDate = new Date();
    let endDate = new Date();
    let isPast = false;

    if (salaryType === 'MONTHLY') {
      startDate.setMonth(startDate.getMonth() + offset, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      isPast = offset < 0; 
    } else {
      const dayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek + (offset * 7));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      isPast = offset < 0;
    }

    const records = await prisma.attendance.findMany({
      where: { employeeId: empId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' }
    });

    let totalHours = 0;
    let totalWage = 0;
    records.forEach(r => {
      totalHours += r.workHours;
      totalWage += (r.calculatedWage || 0);
    });

    return NextResponse.json({
      salaryType,
      isPast,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      records,
      totalHours,
      totalWage,
      employmentType: emp?.employmentType || 'FULL_TIME',      // ★ 追加: 正社員かどうかの判定用
      paidLeaveBalance: emp?.financial?.paidLeaveBalance || 0, // ★ 追加: 有給残日数
      defaults: {
        startTime: emp?.financial?.defaultStartTime || '09:00',
        endTime: emp?.financial?.defaultEndTime || '18:00',
        breakMinutes: emp?.financial?.defaultBreakMins ?? 60,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}