import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 有給休暇の履歴（台帳）を取得する
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    const ledgers = await prisma.paidLeaveLedger.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 20 // 直近20件
    });

    return NextResponse.json(ledgers);
  } catch (error) {
    console.error('Fetch Leave Ledgers Error:', error);
    return NextResponse.json({ error: 'Failed to fetch leave ledgers' }, { status: 500 });
  }
}

// 有給休暇を付与・調整する
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    const body = await request.json();
    const { date, type, days, validUntil, note } = body; 

    const parsedDays = parseFloat(days);
    if (isNaN(parsedDays) || parsedDays === 0) {
      return NextResponse.json({ error: '日数が無効です' }, { status: 400 });
    }

    // トランザクション：台帳に記録しつつ、残日数を自動更新
    const result = await prisma.$transaction(async (tx) => {
      const ledger = await tx.paidLeaveLedger.create({
        data: {
          employeeId,
          date: new Date(date),
          type, // 'GRANTED' (付与) または 'ADJUSTED' (調整)
          days: parsedDays,
          validUntil: validUntil ? new Date(validUntil) : null,
          note: note || null,
        }
      });

      const updatedFinancial = await tx.employeeFinancial.update({
        where: { employeeId },
        data: { paidLeaveBalance: { increment: parsedDays } } // 付与なら増え、マイナス調整なら減る
      });

      return { ledger, newBalance: updatedFinancial.paidLeaveBalance };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Leave POST Error:', error);
    return NextResponse.json({ error: 'Failed to add leave' }, { status: 500 });
  }
}