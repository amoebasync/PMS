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
    const { date, startTime, endTime, breakMinutes, note, saveAsDefault } = body;

    const startMins = timeToMinutes(startTime);
    let endMins = timeToMinutes(endTime);
    if (endMins < startMins) endMins += 24 * 60; 
    
    const actualWorkMins = (endMins - startMins) - parseInt(breakMinutes);
    const workHours = Math.max(0, actualWorkMins / 60);

    const financial = await prisma.employeeFinancial.findUnique({ where: { employeeId: empId } });
    const hourlyRate = financial?.hourlyRate || 0;
    const calculatedWage = Math.floor(workHours * hourlyRate);

    // ★ 勤怠の保存（Upsertなので、同日の再送信は「編集」扱いになります）
    const attendance = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: empId, date: new Date(date) } },
      update: { startTime, endTime, breakMinutes: parseInt(breakMinutes), workHours, calculatedWage, note },
      create: { employeeId: empId, date: new Date(date), startTime, endTime, breakMinutes: parseInt(breakMinutes), workHours, calculatedWage, note }
    });

    // ★ デフォルト時間の更新（チェックが入っていた場合）
    if (saveAsDefault) {
      await prisma.employeeFinancial.updateMany({
        where: { employeeId: empId },
        data: { defaultStartTime: startTime, defaultEndTime: endTime, defaultBreakMins: parseInt(breakMinutes) }
      });
    }

    return NextResponse.json(attendance);
  } catch (error) {
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}

// ★ 追加: 未承認の勤怠を取り下げる（削除する）API
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    // PENDING（未承認）のものだけ削除を許可
    await prisma.attendance.deleteMany({
      where: { employeeId: parseInt(sessionId), date: new Date(dateStr), status: 'PENDING' }
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
      take: 30
    });
    return NextResponse.json(attendances);
  } catch (error) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}