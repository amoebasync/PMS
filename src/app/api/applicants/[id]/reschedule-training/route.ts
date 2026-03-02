import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { sendTrainingConfirmationEmail } from '@/lib/mailer';

// POST /api/applicants/[id]/reschedule-training
// 管理者: 研修日程を変更（旧スロット解放 → 新スロット予約）
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
    const { newTrainingSlotId } = body;

    if (!newTrainingSlotId) {
      return NextResponse.json({ error: '新しい研修スロットIDが必要です' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { trainingSlot: true, jobCategory: true },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    const oldSlotId = applicant.trainingSlotId;

    // 新スロットの存在・定員チェック
    const newSlot = await prisma.trainingSlot.findUnique({
      where: { id: Number(newTrainingSlotId) },
      include: { _count: { select: { applicants: true } } },
    });

    if (!newSlot) {
      return NextResponse.json({ error: '指定された研修スロットが見つかりません' }, { status: 404 });
    }

    if (new Date(newSlot.startTime) <= new Date()) {
      return NextResponse.json({ error: '過去のスロットは選択できません' }, { status: 400 });
    }

    // 定員チェック（同じスロットへの変更は除外）
    if (oldSlotId !== newSlot.id) {
      if (newSlot._count.applicants >= newSlot.capacity) {
        return NextResponse.json(
          { error: `この研修スロットは定員（${newSlot.capacity}名）に達しています` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.applicant.update({
        where: { id: applicantId },
        data: { trainingSlotId: Number(newTrainingSlotId) },
        include: {
          jobCategory: true,
          country: true,
          visaType: true,
          interviewSlot: {
            include: { interviewer: { select: { id: true, lastNameJa: true, firstNameJa: true, email: true } } },
          },
          recruitingMedia: true,
          trainingSlot: true,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'Applicant',
        targetId: applicantId,
        beforeData: applicant as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `応募者「${applicant.name}」の研修日程を変更（旧スロットID: ${oldSlotId || 'なし'} → 新スロットID: ${newTrainingSlotId}）`,
        tx,
      });

      return result;
    });

    // 研修確定メール送信
    if (updated.email) {
      const lang = updated.language || 'ja';
      const slotStart = new Date(newSlot.startTime);
      const slotEnd = new Date(newSlot.endTime);

      const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

      const trainingDate = lang === 'en'
        ? slotStart.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
        : `${slotStart.getFullYear()}年${slotStart.getMonth() + 1}月${slotStart.getDate()}日（${WEEKDAYS_JA[slotStart.getDay()]}）`;

      const trainingTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')} - ${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;

      const jobName = updated.jobCategory?.nameJa || updated.jobCategory?.nameEn || '';

      sendTrainingConfirmationEmail(
        updated.email,
        updated.name,
        lang,
        trainingDate,
        trainingTime,
        newSlot.location,
        null,
        jobName,
        newSlot.startTime,
        newSlot.endTime,
      ).catch((err) => console.error('Training confirmation email failed:', err));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Reschedule Training Error:', error);
    return NextResponse.json({ error: '研修日程変更に失敗しました' }, { status: 500 });
  }
}
