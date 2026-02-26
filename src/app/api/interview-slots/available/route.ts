import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/interview-slots/available
// 公開API: 未来の空き面接スロット一覧を返す
export async function GET() {
  try {
    const now = new Date();

    const slots = await prisma.interviewSlot.findMany({
      where: {
        isBooked: false,
        startTime: { gte: now },
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Available Slots Fetch Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}
