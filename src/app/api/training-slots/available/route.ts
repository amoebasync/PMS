import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/training-slots/available
// 公開API: 未来の定員未満の研修スロット一覧を返す
// クエリパラメータ: token（managementToken）— 指定がある場合、その応募者の現在の予約スロットも含む
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    const now = new Date();

    // token がある場合、その応募者の現在の trainingSlotId を取得
    let currentApplicantSlotId: number | null = null;
    if (token) {
      const applicant = await prisma.applicant.findFirst({
        where: { managementToken: token },
        select: { trainingSlotId: true },
      });
      currentApplicantSlotId = applicant?.trainingSlotId ?? null;
    }

    // 今日より後（今より後）の研修スロットを取得
    const allSlots = await prisma.trainingSlot.findMany({
      where: {
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
      include: {
        _count: { select: { applicants: true } },
      },
    });

    // 定員未満のスロット（または現在の予約スロット）をフィルタ
    const slots = allSlots
      .filter(
        (slot) =>
          slot._count.applicants < slot.capacity ||
          (currentApplicantSlotId !== null && slot.id === currentApplicantSlotId)
      )
      .map((slot) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        location: slot.location,
        note: slot.note,
        bookedCount: slot._count.applicants,
        remainingCapacity: slot.capacity - slot._count.applicants,
        isCurrentBooking: currentApplicantSlotId !== null && slot.id === currentApplicantSlotId,
      }));

    return NextResponse.json({ slots });
  } catch (error) {
    console.error('Available Training Slots Fetch Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}
