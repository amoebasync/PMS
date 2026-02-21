import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

function getStockDiff(type: string, count: number) {
  if (type === 'RECEIVE') return count;
  if (type === 'PICKUP' || type === 'DISPOSE') return -count;
  return 0;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const txId = parseInt(id);

    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    const loggedInEmpId = sessionId ? parseInt(sessionId) : null;

    const result = await prisma.$transaction(async (tx) => {
      const oldTx = await tx.flyerTransaction.findUnique({ where: { id: txId } });
      if (!oldTx) throw new Error('Transaction not found');

      // 担当者の自動セットロジック
      let empId = body.employeeId ? parseInt(body.employeeId) : oldTx.employeeId;
      if (body.transactionType === 'RECEIVE' && body.status === 'COMPLETED' && oldTx.status !== 'COMPLETED' && !empId) {
        empId = loggedInEmpId;
      }

      const newTx = await tx.flyerTransaction.update({
        where: { id: txId },
        data: {
          flyerId: parseInt(body.flyerId),
          transactionType: body.transactionType,
          expectedAt: new Date(body.expectedAt),
          actualAt: (body.status === 'COMPLETED' && oldTx.status !== 'COMPLETED') ? new Date() : oldTx.actualAt,
          count: parseInt(body.count),
          status: body.status,
          employeeId: empId,
          note: body.note || null,
        }
      });

      // 在庫の差分計算 (旧データを打ち消し、新データを適用)
      let stockDiff = 0;
      let recDiff = 0;

      if (oldTx.status === 'COMPLETED') {
        stockDiff -= getStockDiff(oldTx.transactionType, oldTx.count);
        if (oldTx.transactionType === 'RECEIVE') recDiff -= oldTx.count;
      }
      if (newTx.status === 'COMPLETED') {
        stockDiff += getStockDiff(newTx.transactionType, newTx.count);
        if (newTx.transactionType === 'RECEIVE') recDiff += newTx.count;
      }

      if (stockDiff !== 0 || recDiff !== 0) {
        await tx.flyer.update({
          where: { id: newTx.flyerId },
          data: {
            stockCount: { increment: stockDiff },
            totalReceived: { increment: recDiff }
          }
        });
      }
      return newTx;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Update Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    await prisma.$transaction(async (tx) => {
      const oldTx = await tx.flyerTransaction.delete({ where: { id: parseInt(id) } });
      
      // 完了済みのデータを消した場合は、在庫を元に戻す
      if (oldTx.status === 'COMPLETED') {
        const stockDiff = -getStockDiff(oldTx.transactionType, oldTx.count);
        const recDiff = oldTx.transactionType === 'RECEIVE' ? -oldTx.count : 0;
        
        if (stockDiff !== 0 || recDiff !== 0) {
          await tx.flyer.update({
            where: { id: oldTx.flyerId },
            data: {
              stockCount: { increment: stockDiff },
              totalReceived: { increment: recDiff }
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Transaction Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}