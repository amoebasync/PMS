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
      startTime: { gte: tomorrow },
    };

    // 職種IDが指定されている場合、その職種に紐付くマスタのスロットのみ返す
    if (jobCategoryIdParam) {
      const jobCategory = await prisma.jobCategory.findUnique({
        where: { id: Number(jobCategoryIdParam) },
        select: { interviewSlotMasterId: true },
      });

      if (jobCategory?.interviewSlotMasterId) {
        // 職種にマスタが紐付いている → そのマスタのスロットのみ
        where.interviewSlotMasterId = jobCategory.interviewSlotMasterId;
      } else {
        // マスタ紐付けがない → 従来通り職種IDまたはnullでフィルタ
        where.OR = [
          { jobCategoryId: Number(jobCategoryIdParam) },
          { jobCategoryId: null },
        ];
      }
    }

    const allSlots = await prisma.interviewSlot.findMany({
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
          select: { id: true, name: true, meetingType: true, capacity: true },
        },
        _count: { select: { interviewSlotApplicants: true } },
      },
    });

    // 容量ベースで空きスロットをフィルタし、残りキャパシティ情報を付与
    const availableSlots = allSlots
      .filter(s => {
        const capacity = s.interviewSlotMaster?.capacity ?? 1;
        return capacity === 0 || s._count.interviewSlotApplicants < capacity;
      })
      .map(s => {
        const capacity = s.interviewSlotMaster?.capacity ?? 1;
        const booked = s._count.interviewSlotApplicants;
        return {
          ...s,
          remainingCapacity: capacity === 0 ? null : capacity - booked,
          bookedCount: booked,
          capacity,
        };
      });

    return NextResponse.json({ slots: availableSlots });
  } catch (error) {
    console.error('Available Slots Fetch Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}
