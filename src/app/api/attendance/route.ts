import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

const timeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const empId = parseInt(sessionId);

    const body = await request.json();
    const { date, attendanceTypeId, startTime, endTime, breakMinutes, note, saveAsDefault } = body;

    // 1. 社員の給与情報と、選択された勤怠マスタを取得
    const [financial, attType] = await Promise.all([
      prisma.employeeFinancial.findUnique({ where: { employeeId: empId } }),
      prisma.attendanceType.findUnique({ where: { id: parseInt(attendanceTypeId) } })
    ]);

    if (!attType) return NextResponse.json({ error: 'Invalid attendance type' }, { status: 400 });

    let workHours = 0;
    let calculatedWage = 0;
    let finalStartTime = null;
    let finalEndTime = null;
    let finalBreakMinutes = null;

    // 2. 「出勤」扱いの場合（実労働時間の計算）
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
    } 
    // 3. 「有給」などのみなし給与が発生する場合
    else if (attType.isPaid) {
      if (financial?.salaryType === 'HOURLY') {
        calculatedWage = Math.floor((financial?.hourlyRate || 0) * 8 * attType.wageMultiplier);
      } else if (financial?.salaryType === 'DAILY') {
        calculatedWage = Math.floor((financial?.dailyRate || 0) * attType.wageMultiplier);
      }
    }

    // 4. トランザクションで勤怠保存 ＆ 有給台帳の更新
    const attendance = await prisma.$transaction(async (tx) => {
      // 既存の勤怠を取得（上書き時の差分チェック用）
      const existing = await tx.attendance.findUnique({
        where: { employeeId_date: { employeeId: empId, date: new Date(date) } },
        include: { attendanceType: true }
      });
      
      const oldDeducting = existing?.attendanceType?.isDeducting ? 1 : 0;
      const newDeducting = attType.isDeducting ? 1 : 0;
      const deductDiff = newDeducting - oldDeducting; // 1なら新規消化, -1なら消化取消

      // 有給を新しく消化する場合
      if (deductDiff === 1) {
        await tx.paidLeaveLedger.create({
          data: { employeeId: empId, date: new Date(date), type: 'USED', days: -1, note: '勤怠入力による自動消化' }
        });
        await tx.employeeFinancial.update({
          where: { employeeId: empId }, data: { paidLeaveBalance: { decrement: 1 } }
        });
      } 
      // 有給を取り消して出勤等に変更した場合（返還）
      else if (deductDiff === -1) {
        await tx.paidLeaveLedger.create({
          data: { employeeId: empId, date: new Date(date), type: 'ADJUSTED', days: 1, note: '勤怠修正による有給返還' }
        });
        await tx.employeeFinancial.update({
          where: { employeeId: empId }, data: { paidLeaveBalance: { increment: 1 } }
        });
      }

      // 勤怠本体の保存 (Upsert)
      return await tx.attendance.upsert({
        where: { employeeId_date: { employeeId: empId, date: new Date(date) } },
        update: { attendanceTypeId: attType.id, startTime: finalStartTime, endTime: finalEndTime, breakMinutes: finalBreakMinutes, workHours, calculatedWage, note },
        create: { employeeId: empId, date: new Date(date), attendanceTypeId: attType.id, startTime: finalStartTime, endTime: finalEndTime, breakMinutes: finalBreakMinutes, workHours, calculatedWage, note }
      });
    });

    if (saveAsDefault && attType.isWorking) {
      await prisma.employeeFinancial.updateMany({
        where: { employeeId: empId },
        data: { defaultStartTime: startTime, defaultEndTime: endTime, defaultBreakMins: parseInt(breakMinutes || '0') }
      });
    }

    return NextResponse.json(attendance);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '保存に失敗しました' }, { status: 500 });
  }
}

// 削除（取り下げ）API
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const empId = parseInt(sessionId);
    
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findFirst({
        where: { employeeId: empId, date: new Date(dateStr), status: 'PENDING' },
        include: { attendanceType: true }
      });
      if (!existing) return;

      // 消す勤怠が有給(isDeducting)だったら台帳を戻す
      if (existing.attendanceType.isDeducting) {
        await tx.paidLeaveLedger.create({
          data: { employeeId: empId, date: new Date(dateStr), type: 'ADJUSTED', days: 1, note: '申請取り下げによる有給返還' }
        });
        await tx.employeeFinancial.update({
          where: { employeeId: empId }, data: { paidLeaveBalance: { increment: 1 } }
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
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const attendances = await prisma.attendance.findMany({
      where: { employeeId: parseInt(sessionId) },
      orderBy: { date: 'desc' },
      include: { attendanceType: true }, // ★ 追加: 画面表示用にマスタ情報を結合
      take: 30
    });
    return NextResponse.json(attendances);
  } catch (error) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}