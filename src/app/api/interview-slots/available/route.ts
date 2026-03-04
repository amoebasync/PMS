import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/interview-slots/available
// 公開API: 未来の空き面接スロット一覧を返す
// クエリパラメータ: jobCategoryId (職種ID) — 指定した職種用 + 全職種対応（null）のスロットを返す
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobCategoryIdParam = searchParams.get('jobCategoryId');

    const now = new Date();
    // 明日以降のスロットのみ表示（面接日は明日以降のみ選択可能）
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const where: any = {
      isBooked: false,
      startTime: { gte: tomorrow },
    };

    // 職種IDが指定されている場合、その職種用 OR 全職種対応（null）のスロットを返す
    if (jobCategoryIdParam) {
      where.OR = [
        { jobCategoryId: Number(jobCategoryIdParam) },
        { jobCategoryId: null },
      ];
    }

    const slots = await prisma.interviewSlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        jobCategoryId: true,
        jobCategory: {
          select: { id: true, nameJa: true, nameEn: true },
        },
        interviewSlotMaster: {
          select: { id: true, name: true, meetingType: true },
        },
      },
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Available Slots Fetch Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}
