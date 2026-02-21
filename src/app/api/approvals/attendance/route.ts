import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const attendances = await prisma.attendance.findMany({
      where: { status: 'PENDING' },
      include: {
        employee: { select: { id: true, lastNameJa: true, firstNameJa: true, employeeCode: true, avatarUrl: true } },
        attendanceType: true,
      },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(attendances);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch attendances' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ids, action } = body; // action: 'APPROVE' | 'REJECT'

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await prisma.$transaction(async (tx) => {
      // 1. ステータス更新
      await tx.attendance.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus },
      });

      // 2. 却下の場合、有給（isDeducting）であれば台帳を戻して残日数を回復させる
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
    console.error('Attendance Approval Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}