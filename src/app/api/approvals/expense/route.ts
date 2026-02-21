import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      where: { status: 'PENDING' },
      include: {
        employee: { select: { id: true, lastNameJa: true, firstNameJa: true, employeeCode: true, avatarUrl: true } }
      },
      orderBy: { date: 'asc' },
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
    const { ids, action, reason } = body; // action: 'APPROVE' | 'REJECT'

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await prisma.expense.updateMany({
      where: { id: { in: ids } },
      data: {
        status: newStatus,
        approverId: approverId,
        approvedAt: action === 'APPROVE' ? new Date() : null,
        rejectionReason: action === 'REJECT' ? reason : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Expense Approval Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}