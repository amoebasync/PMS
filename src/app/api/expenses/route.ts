import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const expenses = await prisma.expense.findMany({
      where: { employeeId: parseInt(sessionId) },
      orderBy: { date: 'desc' },
      include: { approver: { select: { lastNameJa: true, firstNameJa: true } } }
    });
    return NextResponse.json(expenses);
  } catch (error) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await request.json();
    const { date, type, amount, description } = body;

    const expense = await prisma.expense.create({
      data: {
        employeeId: parseInt(sessionId),
        date: new Date(date),
        type,
        amount: parseInt(amount),
        description
      }
    });

    return NextResponse.json(expense);
  } catch (error) {
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}