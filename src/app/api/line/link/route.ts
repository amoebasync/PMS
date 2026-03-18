import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/line/link — LINE ユーザーと配布員を紐付け
 * body: { lineUserId: number, distributorId: number }
 */
export async function POST(request: Request) {
  try {
    const { lineUserId, distributorId } = await request.json();

    if (!lineUserId || !distributorId) {
      return NextResponse.json({ error: 'lineUserId と distributorId は必須です' }, { status: 400 });
    }

    // 既に他の配布員に紐付いていないか確認
    const existingLink = await prisma.lineUser.findFirst({
      where: { distributorId },
    });
    if (existingLink) {
      return NextResponse.json({ error: 'この配布員は既に別のLINEユーザーに紐付けられています' }, { status: 400 });
    }

    const updated = await prisma.lineUser.update({
      where: { id: lineUserId },
      data: { distributorId },
      include: {
        distributor: {
          select: { id: true, name: true, staffId: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('[LINE Link] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/line/link — 紐付け解除
 * body: { lineUserId: number }
 */
export async function DELETE(request: Request) {
  try {
    const { lineUserId } = await request.json();

    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId は必須です' }, { status: 400 });
    }

    const updated = await prisma.lineUser.update({
      where: { id: lineUserId },
      data: { distributorId: null },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('[LINE Unlink] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
