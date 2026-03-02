import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTrainingConfirmationEmail } from '@/lib/mailer';

// GET /api/training-booking
// 応募者: 利用可能な研修スロット一覧取得（managementToken必須）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
    }

    // トークンで応募者を検索
    const applicant = await prisma.applicant.findFirst({
      where: { managementToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        language: true,
        hiringStatus: true,
        trainingSlotId: true,
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 404 });
    }

    // HIRED かつ trainingSlotId が未設定の場合のみ許可
    if (applicant.hiringStatus !== 'HIRED') {
      return NextResponse.json({ error: 'この機能は採用者のみ利用できます' }, { status: 403 });
    }

    if (applicant.trainingSlotId !== null) {
      return NextResponse.json({ error: '既に研修スロットが予約されています' }, { status: 400 });
    }

    const now = new Date();

    // 今日より後の定員未満のスロットを取得
    const allSlots = await prisma.trainingSlot.findMany({
      where: {
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
      include: {
        _count: { select: { applicants: true } },
      },
    });

    const slots = allSlots
      .filter((slot) => slot._count.applicants < slot.capacity)
      .map((slot) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        location: slot.location,
        note: slot.note,
        bookedCount: slot._count.applicants,
        remainingCapacity: slot.capacity - slot._count.applicants,
      }));

    return NextResponse.json({
      applicant: {
        id: applicant.id,
        name: applicant.name,
        language: applicant.language,
      },
      slots,
    });
  } catch (error) {
    console.error('Training Booking GET Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/training-booking
// 応募者: 研修スロットをセルフ予約（managementToken必須）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, trainingSlotId } = body;

    if (!token) {
      return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
    }

    if (!trainingSlotId) {
      return NextResponse.json({ error: '研修スロットIDが必要です' }, { status: 400 });
    }

    // トークンで応募者を検索
    const applicant = await prisma.applicant.findFirst({
      where: { managementToken: token },
      include: { jobCategory: true },
    });

    if (!applicant) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 404 });
    }

    // HIRED かつ trainingSlotId が未設定の場合のみ許可
    if (applicant.hiringStatus !== 'HIRED') {
      return NextResponse.json({ error: 'この機能は採用者のみ利用できます' }, { status: 403 });
    }

    if (applicant.trainingSlotId !== null) {
      return NextResponse.json({ error: '既に研修スロットが予約されています' }, { status: 400 });
    }

    // スロット取得・定員チェック
    const trainingSlot = await prisma.trainingSlot.findUnique({
      where: { id: Number(trainingSlotId) },
      include: { _count: { select: { applicants: true } } },
    });

    if (!trainingSlot) {
      return NextResponse.json({ error: '研修スロットが見つかりません' }, { status: 404 });
    }

    if (trainingSlot._count.applicants >= trainingSlot.capacity) {
      return NextResponse.json(
        { error: `この研修スロットは定員（${trainingSlot.capacity}名）に達しています` },
        { status: 400 }
      );
    }

    // 研修スロットを予約し、flowStatus を TRAINING_WAITING に変更
    const updated = await prisma.applicant.update({
      where: { id: applicant.id },
      data: {
        trainingSlotId: Number(trainingSlotId),
        flowStatus: 'TRAINING_WAITING',
      },
    });

    // 研修確定メール送信
    const lang = updated.language || 'ja';
    const slotStart = new Date(trainingSlot.startTime);
    const slotEnd = new Date(trainingSlot.endTime);

    const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

    const trainingDate = lang === 'en'
      ? slotStart.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
      : `${slotStart.getFullYear()}年${slotStart.getMonth() + 1}月${slotStart.getDate()}日（${WEEKDAYS_JA[slotStart.getDay()]}）`;

    const trainingTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')} - ${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`;

    const jobName = applicant.jobCategory?.nameJa || applicant.jobCategory?.nameEn || '';

    sendTrainingConfirmationEmail(
      updated.email,
      updated.name,
      lang,
      trainingDate,
      trainingTime,
      trainingSlot.location,
      null,
      jobName,
      trainingSlot.startTime,
      trainingSlot.endTime,
    ).catch((err) => console.error('Training confirmation email failed:', err));

    return NextResponse.json({
      success: true,
      trainingSlot: {
        id: trainingSlot.id,
        startTime: trainingSlot.startTime,
        endTime: trainingSlot.endTime,
        location: trainingSlot.location,
      },
    });
  } catch (error) {
    console.error('Training Booking POST Error:', error);
    return NextResponse.json({ error: '研修スロットの予約に失敗しました' }, { status: 500 });
  }
}
