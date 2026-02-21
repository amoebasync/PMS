import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'pending'; // 'pending' or 'history'

    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const empId = parseInt(sessionId);

    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { roles: { include: { role: true } } }
    });
    const roles = employee?.roles.map(r => r.role.code) || [];
    const isHrAdmin = roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN');

    const whereClause: any = {};
    if (view === 'pending') {
      whereClause.status = 'PENDING';
    } else {
      whereClause.status = { in: ['APPROVED', 'REJECTED'] };
    }

    if (!isHrAdmin) {
      whereClause.employee = { managerId: empId };
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, lastNameJa: true, firstNameJa: true, employeeCode: true, avatarUrl: true } },
        attendanceType: true,
        approver: { select: { lastNameJa: true, firstNameJa: true } } // ★ 履歴表示用に追加
      },
      orderBy: view === 'pending' ? { date: 'asc' } : { approvedAt: 'desc' },
      take: view === 'history' ? 100 : undefined // 履歴は直近100件
    });
    return NextResponse.json(attendances);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch attendances' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    const approverId = sessionId ? parseInt(sessionId) : null;

    const body = await request.json();
    const { ids, action, reason } = body; 

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await prisma.$transaction(async (tx) => {
      await tx.attendance.updateMany({
        where: { id: { in: ids } },
        data: { 
          status: newStatus,
          approverId: approverId,
          approvedAt: new Date(),
          rejectionReason: action === 'REJECT' ? reason : null
        },
      });

      if (action === 'REJECT') {
        const targetAttendances = await tx.attendance.findMany({
          where: { id: { in: ids } },
          include: { attendanceType: true }
        });
        
        for (const att of targetAttendances) {
          if (att.attendanceType.isDeducting) {
             await tx.paidLeaveLedger.create({
                data: {
                  employeeId: att.employeeId,
                  date: new Date(),
                  type: 'ADJUSTED',
                  days: 1,
                  note: `勤怠申請(${new Date(att.date).toLocaleDateString('ja-JP')})の却下による有給返還`
                }
             });
             await tx.employeeFinancial.update({
               where: { employeeId: att.employeeId },
               data: { paidLeaveBalance: { increment: 1 } }
             });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}