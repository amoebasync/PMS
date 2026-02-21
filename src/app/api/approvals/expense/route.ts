import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'pending';

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

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, lastNameJa: true, firstNameJa: true, employeeCode: true, avatarUrl: true } },
        approver: { select: { lastNameJa: true, firstNameJa: true } } // 履歴表示用
      },
      orderBy: view === 'pending' ? { date: 'asc' } : { approvedAt: 'desc' },
      take: view === 'history' ? 100 : undefined
    });
    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
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

    await prisma.expense.updateMany({
      where: { id: { in: ids } },
      data: {
        status: newStatus,
        approverId: approverId,
        approvedAt: new Date(), 
        rejectionReason: action === 'REJECT' ? reason : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}