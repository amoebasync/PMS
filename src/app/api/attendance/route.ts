import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


const timeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

async function getSessionInfo() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  const empId = parseInt(sessionId);
  const user = await prisma.employee.findUnique({
    where: { id: empId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) return null;
  const roles = user.roles?.map((r: any) => r.role?.code) || [];
  const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN');
  return { empId, isAdmin };
}

export async function POST(request: Request) {
  try {
    const session = await getSessionInfo();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { empId, isAdmin } = session;

    const body = await request.json();
    const { date, attendanceTypeId, startTime, endTime, breakMinutes, note, saveAsDefault, targetEmployeeId } = body;

    // HR管理者は他社員の勤怠も登録可能
    const targetId = (isAdmin && targetEmployeeId) ? parseInt(targetEmployeeId) : empId;

    const [financial, attType] = await Promise.all([
      prisma.employeeFinancial.findUnique({ where: { employeeId: targetId } }),
      prisma.attendanceType.findUnique({ where: { id: parseInt(attendanceTypeId) } })
    ]);

    if (!attType) return NextResponse.json({ error: 'Invalid attendance type' }, { status: 400 });

    let workHours = 0;
    let calculatedWage = 0;
    let finalStartTime = null;
    let finalEndTime = null;
    let finalBreakMinutes = null;

    if (attType.isWorking) {
      if (!startTime || !endTime) return NextResponse.json({ error: '時間は必須です' }, { status: 400 });

      const startMins = timeToMinutes(startTime);
      let endMins = timeToMinutes(endTime);
      if (endMins < startMins) endMins += 24 * 60;

      const actualWorkMins = (endMins - startMins) - parseInt(breakMinutes || '0');
      workHours = Math.max(0, actualWorkMins / 60);

      const hourlyRate = financial?.hourlyRate || 0;
      calculatedWage = Math.floor(workHours * hourlyRate * attType.wageMultiplier);

      finalStartTime = startTime;
      finalEndTime = endTime;
      finalBreakMinutes = parseInt(breakMinutes || '0');
    } else if (attType.isPaid) {
      if (financial?.salaryType === 'HOURLY') {
        calculatedWage = Math.floor((financial?.hourlyRate || 0) * 8 * attType.wageMultiplier);
      } else if (financial?.salaryType === 'DAILY') {
        calculatedWage = Math.floor((financial?.dailyRate || 0) * attType.wageMultiplier);
      }
    }

    const attendance = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: { employeeId_date: { employeeId: targetId, date: new Date(date) } },
        include: { attendanceType: true }
      });

      const oldDeducting = existing?.attendanceType?.isDeducting ? 1 : 0;
      const newDeducting = attType.isDeducting ? 1 : 0;
      const deductDiff = newDeducting - oldDeducting;

      if (deductDiff === 1) {
        await tx.paidLeaveLedger.create({
          data: { employeeId: targetId, date: new Date(date), type: 'USED', days: -1, note: '勤怠入力による自動消化' }
        });
        await tx.employeeFinancial.update({
          where: { employeeId: targetId }, data: { paidLeaveBalance: { decrement: 1 } }
        });
      } else if (deductDiff === -1) {
        await tx.paidLeaveLedger.create({
          data: { employeeId: targetId, date: new Date(date), type: 'ADJUSTED', days: 1, note: '勤怠修正による有給返還' }
        });
        await tx.employeeFinancial.update({
          where: { employeeId: targetId }, data: { paidLeaveBalance: { increment: 1 } }
        });
      }

      return await tx.attendance.upsert({
        where: { employeeId_date: { employeeId: targetId, date: new Date(date) } },
        update: { attendanceTypeId: attType.id, startTime: finalStartTime, endTime: finalEndTime, breakMinutes: finalBreakMinutes, workHours, calculatedWage, note },
        create: { employeeId: targetId, date: new Date(date), attendanceTypeId: attType.id, startTime: finalStartTime, endTime: finalEndTime, breakMinutes: finalBreakMinutes, workHours, calculatedWage, note }
      });
    });

    // デフォルト保存は自分自身の場合のみ
    if (saveAsDefault && attType.isWorking && targetId === empId) {
      await prisma.employeeFinancial.updateMany({
        where: { employeeId: empId },
        data: { defaultStartTime: startTime, defaultEndTime: endTime, defaultBreakMins: parseInt(breakMinutes || '0') }
      });
    }

    return NextResponse.json(attendance);
  } catch (error: any) {
    console.error('Attendance save error:', error);
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionInfo();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { empId, isAdmin } = session;

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    const targetIdParam = searchParams.get('employeeId');
    const targetId = (isAdmin && targetIdParam) ? parseInt(targetIdParam) : empId;
    const isOtherEmployee = targetId !== empId;

    // HR管理者が他社員の勤怠を削除する場合は権限確認
    if (isOtherEmployee && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // HR管理者が他社員を削除する場合はステータス制限なし、自分は PENDING のみ
      const existing = isOtherEmployee
        ? await tx.attendance.findFirst({
            where: { employeeId: targetId, date: new Date(dateStr) },
            include: { attendanceType: true }
          })
        : await tx.attendance.findFirst({
            where: { employeeId: empId, date: new Date(dateStr), status: 'PENDING' },
            include: { attendanceType: true }
          });

      if (!existing) return;

      if (existing.attendanceType.isDeducting) {
        await tx.paidLeaveLedger.create({
          data: { employeeId: targetId, date: new Date(dateStr), type: 'ADJUSTED', days: 1, note: '申請取り下げによる有給返還' }
        });
        await tx.employeeFinancial.update({
          where: { employeeId: targetId }, data: { paidLeaveBalance: { increment: 1 } }
        });
      }

      await tx.attendance.delete({ where: { id: existing.id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSessionInfo();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { empId, isAdmin } = session;

    const { searchParams } = new URL(request.url);
    const targetIdParam = searchParams.get('employeeId');
    const targetId = (isAdmin && targetIdParam) ? parseInt(targetIdParam) : empId;

    const attendances = await prisma.attendance.findMany({
      where: { employeeId: targetId },
      orderBy: { date: 'desc' },
      include: { attendanceType: true },
      take: 30
    });
    return NextResponse.json(attendances);
  } catch (error) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}
