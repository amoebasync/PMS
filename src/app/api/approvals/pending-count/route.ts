import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ total: 0, attendance: 0, expense: 0 });
    const empId = parseInt(sessionId);

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { roles: { include: { role: true } } }
    });
    
    const roles = employee?.roles.map(r => r.role.code) || [];
    const isHrAdmin = roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN');

    const whereClause: any = { status: 'PENDING' };
    if (!isHrAdmin) {
      whereClause.employee = { managerId: empId };
    }

    // 勤怠と経費の件数を個別にカウント
    const [attCount, expCount] = await Promise.all([
      prisma.attendance.count({ where: whereClause }),
      prisma.expense.count({ where: whereClause })
    ]);

    return NextResponse.json({ 
      total: attCount + expCount, 
      attendance: attCount, 
      expense: expCount 
    });
  } catch (error) {
    console.error('Pending count error', error);
    return NextResponse.json({ total: 0, attendance: 0, expense: 0 });
  }
}