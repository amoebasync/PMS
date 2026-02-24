import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

const prisma = new PrismaClient();

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { id } = await params;
    const expenseId = parseInt(id);
    if (isNaN(expenseId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const expense = await prisma.distributorExpense.findUnique({
      where: { id: expenseId },
    });

    if (!expense || expense.distributorId !== distributor.id) {
      return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 });
    }

    if (expense.status !== 'PENDING') {
      return NextResponse.json({ error: '申請中の経費のみ取消できます' }, { status: 400 });
    }

    await prisma.distributorExpense.delete({ where: { id: expenseId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Distributor Expense DELETE Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
