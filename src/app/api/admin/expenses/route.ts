import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * DELETE /api/admin/expenses?id=xxx
 * 管理者による交通費削除（ステータス制限なし）
 */
export async function DELETE(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const expenseId = parseInt(request.nextUrl.searchParams.get('id') || '');
  if (isNaN(expenseId)) {
    return NextResponse.json({ error: '無効なID' }, { status: 400 });
  }

  try {
    await prisma.distributorExpense.delete({ where: { id: expenseId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin expense delete error:', err);
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
  }
}
