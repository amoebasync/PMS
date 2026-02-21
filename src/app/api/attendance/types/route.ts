import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // データが0件なら初期データを自動投入する
    const count = await prisma.attendanceType.count();
    if (count === 0) {
      await prisma.attendanceType.createMany({
        data: [
          { code: 'WORK', name: '出勤', wageMultiplier: 1.0, isWorking: true, isPaid: true, isDeducting: false },
          { code: 'HOLIDAY_WORK', name: '休日出勤', wageMultiplier: 1.25, isWorking: true, isPaid: true, isDeducting: false },
          { code: 'PAID_LEAVE', name: '有給休暇', wageMultiplier: 1.0, isWorking: false, isPaid: true, isDeducting: true },
          { code: 'UNPAID_LEAVE', name: '無給休暇', wageMultiplier: 0.0, isWorking: false, isPaid: false, isDeducting: false },
          { code: 'ABSENCE', name: '欠勤', wageMultiplier: 0.0, isWorking: false, isPaid: false, isDeducting: false },
        ]
      });
    }

    const types = await prisma.attendanceType.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error('Fetch Attendance Types Error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance types' }, { status: 500 });
  }
}