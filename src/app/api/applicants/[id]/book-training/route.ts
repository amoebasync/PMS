import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { sendTrainingConfirmationEmail } from '@/lib/mailer';

// POST /api/applicants/[id]/book-training
// 管理者: 応募者に研修スロットを予約（または解除）
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const applicantId = parseInt(id);
    const body = await request.json();
    const { trainingSlotId } = body; // null で解除

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 更新前データ取得
    const beforeData = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!beforeData) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    // trainingSlotId が指定されている場合、定員チェック
    let trainingSlot = null;
    if (trainingSlotId != null) {
      trainingSlot = await prisma.trainingSlot.findUnique({
        where: { id: Number(trainingSlotId) },
        include: { _count: { select: { applicants: true } } },
      });

      if (!trainingSlot) {
        return NextResponse.json({ error: '研修スロットが見つかりません' }, { status: 404 });
      }

      // 既に同じスロットに紐付いている場合は定員チェックから除外
      const currentCount = beforeData.trainingSlotId === trainingSlot.id
        ? trainingSlot._count.applicants
        : trainingSlot._count.applicants;

      const effectiveCount = beforeData.trainingSlotId === trainingSlot.id
        ? currentCount
        : currentCount + 1;

      if (effectiveCount > trainingSlot.capacity) {
        return NextResponse.json(
          { error: `この研修スロットは定員（${trainingSlot.capacity}名）に達しています` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        trainingSlotId: trainingSlotId != null ? Number(trainingSlotId) : null,
      };

      // trainingSlotId が設定された場合、flowStatus を TRAINING_WAITING に変更
      if (trainingSlotId != null) {
        updateData.flowStatus = 'TRAINING_WAITING';
      }

      const result = await tx.applicant.update({
        where: { id: applicantId },
        data: updateData,
        include: {
          trainingSlot: true,
          jobCategory: true,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'Applicant',
        targetId: applicantId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        description: trainingSlotId != null
          ? `応募者「${result.name}」の研修スロットを予約（スロットID: ${trainingSlotId}）`
          : `応募者「${result.name}」の研修スロット予約を解除`,
        ipAddress: ip,
        tx,
      });

      return result;
    });

    // 研修確定メール送信（trainingSlotId が設定された場合）
    if (trainingSlotId != null && trainingSlot && updated.email) {
      const lang = updated.language || 'ja';
      const slotStart = new Date(trainingSlot.startTime);
      const slotEnd = new Date(trainingSlot.endTime);

      const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
      const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      const trainingDate = lang === 'en'
        ? slotStart.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
        : `${slotStart.getFullYear()}年${slotStart.getMonth() + 1}月${slotStart.getDate()}日（${WEEKDAYS_JA[slotStart.getDay()]}）`;

      const trainingTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')} - ${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;

      sendTrainingConfirmationEmail(
        updated.email,
        updated.name,
        lang,
        trainingDate,
        trainingTime,
        trainingSlot.location,
        null
      ).catch((err) => console.error('Training confirmation email failed:', err));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Book Training Error:', error);
    return NextResponse.json({ error: '研修スロットの予約に失敗しました' }, { status: 500 });
  }
}
