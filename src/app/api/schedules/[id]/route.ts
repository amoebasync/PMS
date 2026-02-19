import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 最新のNext.jsに合わせて params を Promise として受け取る
export async function PATCH(
  request: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. まず params を await して id を確実に取り出す
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);

    // 万が一数値に変換できなかった場合の安全対策
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const body = await request.json();

    // 2. データベースの更新
    const updatedSchedule = await prisma.distributionSchedule.update({
      where: { id: id },
      data: {
        remarks: body.remarks,
      },
    });

    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error('Failed to update schedule:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}