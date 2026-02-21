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

    // 今週の日曜と土曜を計算
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0(日) 〜 6(土)
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (6 - dayOfWeek));
    endOfWeek.setHours(23, 59, 59, 999);

    const records = await prisma.attendance.findMany({
      where: { employeeId: empId, date: { gte: startOfWeek, lte: endOfWeek } },
      orderBy: { date: 'asc' }
    });

    let totalHours = 0;
    let totalWage = 0;
    records.forEach(r => {
      totalHours += r.workHours;
      totalWage += (r.calculatedWage || 0);
    });

    return NextResponse.json({
      startOfWeek: startOfWeek.toISOString().split('T')[0],
      endOfWeek: endOfWeek.toISOString().split('T')[0],
      records, totalHours, totalWage
    });
  } catch (error) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}