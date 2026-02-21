import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

// 在庫増減の計算ヘルパー
function getStockDiff(type: string, count: number) {
  if (type === 'RECEIVE') return count;
  if (type === 'PICKUP' || type === 'DISPOSE') return -count;
  return 0; // TRANSFER(移動)は総在庫には影響しない
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const flyerId = searchParams.get('flyerId');

  try {
    const whereClause = flyerId ? { flyerId: parseInt(flyerId) } : {};
    const transactions = await prisma.flyerTransaction.findMany({
      where: whereClause,
      orderBy: { expectedAt: 'desc' },
      include: { 
        flyer: { include: { customer: true } }, 
        employee: true 
      }
    });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Fetch Transactions Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    const loggedInEmpId = sessionId ? parseInt(sessionId) : null;

    const result = await prisma.$transaction(async (tx) => {
      // 納品(RECEIVE)かつ完了処理で、担当者が空なら、ログインユーザーをセット
      let empId = body.employeeId ? parseInt(body.employeeId) : null;
      if (body.transactionType === 'RECEIVE' && body.status === 'COMPLETED' && !empId) {
        empId = loggedInEmpId;
      }

      const newTx = await tx.flyerTransaction.create({
        data: {
          flyerId: parseInt(body.flyerId),
          transactionType: body.transactionType,
          expectedAt: new Date(body.expectedAt),
          actualAt: body.status === 'COMPLETED' ? new Date() : null,
          count: parseInt(body.count),
          status: body.status,
          employeeId: empId,
          note: body.note || null,
        }
      });

      // 完了ステータスなら即座に在庫を更新
      if (newTx.status === 'COMPLETED') {
        const stockDiff = getStockDiff(newTx.transactionType, newTx.count);
        const recDiff = newTx.transactionType === 'RECEIVE' ? newTx.count : 0;

        if (stockDiff !== 0 || recDiff !== 0) {
          await tx.flyer.update({
            where: { id: newTx.flyerId },
            data: {
              stockCount: { increment: stockDiff },
              totalReceived: { increment: recDiff }
            }
          });
        }
      }
      return newTx;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Create Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}