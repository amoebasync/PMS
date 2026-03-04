import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createGoogleMeetEvent } from '@/lib/google-meet';
import {
  sendApplicantConfirmationEmail,
  sendInterviewBookingAdminNotification,
} from '@/lib/mailer';

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const TZ = 'Asia/Tokyo';

function toJST(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: TZ }));
}

function formatInterviewDate(date: Date, lang: string): string {
  const jst = toJST(date);
  return lang === 'en'
    ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: TZ })
    : `${jst.getFullYear()}年${jst.getMonth() + 1}月${jst.getDate()}日（${WEEKDAYS_JA[jst.getDay()]}）`;
}

function formatTime(start: Date, end: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const jstStart = toJST(start);
  const jstEnd = toJST(end);
  return `${pad(jstStart.getHours())}:${pad(jstStart.getMinutes())} - ${pad(jstEnd.getHours())}:${pad(jstEnd.getMinutes())}`;
}

// GET /api/interview-booking?token=xxx
// 公開API: 応募者がトークンで面接スロット一覧を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 });
    }

    const applicant = await prisma.applicant.findFirst({
      where: { managementToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        language: true,
        jobCategoryId: true,
        interviewSlot: { select: { id: true } },
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 404 });
    }

    if (applicant.interviewSlot) {
      return NextResponse.json({ error: 'すでに面接スロットが予約されています' }, { status: 409 });
    }

    const now = new Date();
    // 4時間後以降のスロットのみ表示
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    // 空きスロット取得（職種フィルタ or 全職種対応）
    const slots = await prisma.interviewSlot.findMany({
      where: {
        isBooked: false,
        startTime: { gt: fourHoursLater },
        OR: [
          { jobCategoryId: applicant.jobCategoryId },
          { jobCategoryId: null },
        ],
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        meetUrl: true,
        interviewer: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
    });

    return NextResponse.json({
      applicant: {
        id: applicant.id,
        name: applicant.name,
        language: applicant.language,
      },
      slots,
    });
  } catch (error) {
    console.error('Interview Booking GET Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/interview-booking
// 公開API: 応募者がトークンで面接スロットを予約
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, interviewSlotId } = body;

    if (!token || !interviewSlotId) {
      return NextResponse.json({ error: 'トークンとスロットIDが必要です' }, { status: 400 });
    }

    const applicant = await prisma.applicant.findFirst({
      where: { managementToken: token },
      include: {
        jobCategory: { select: { nameJa: true, nameEn: true } },
        interviewSlot: { select: { id: true } },
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 404 });
    }

    if (applicant.interviewSlot) {
      return NextResponse.json({ error: 'すでに面接スロットが予約されています' }, { status: 409 });
    }

    // スロットの空き確認
    const slot = await prisma.interviewSlot.findUnique({
      where: { id: Number(interviewSlotId) },
      include: {
        interviewer: { select: { lastNameJa: true, firstNameJa: true, email: true } },
        interviewSlotMaster: true,
      },
    });

    if (!slot) {
      return NextResponse.json({ error: 'スロットが見つかりません' }, { status: 404 });
    }

    if (slot.isBooked) {
      return NextResponse.json({ error: 'このスロットはすでに予約されています' }, { status: 409 });
    }

    const minStartTime = new Date(Date.now() + 4 * 60 * 60 * 1000);
    if (new Date(slot.startTime) <= minStartTime) {
      return NextResponse.json({ error: '開始まで4時間を切っているスロットは予約できません' }, { status: 400 });
    }

    // ミーティングURL決定（マスタのmeetingTypeに応じて分岐）
    const lang = applicant.language || 'ja';
    const jobName = lang === 'en'
      ? (applicant.jobCategory?.nameEn || applicant.jobCategory?.nameJa || '')
      : (applicant.jobCategory?.nameJa || '');

    const slotMaster = slot.interviewSlotMaster;
    let meetUrl: string | null = null;
    let eventId: string | null = null;

    if (slotMaster?.meetingType === 'ZOOM') {
      // Zoom: マスタに設定された固定URLを使用
      meetUrl = slotMaster.zoomUrl || null;
    } else {
      // Google Meet: 既存ロジック
      const meetTitle = lang === 'en'
        ? `Interview: ${applicant.name} — ${jobName}`
        : `面接: ${applicant.name}（${jobName}）`;
      const meetDescription = lang === 'en'
        ? `Interview for ${applicant.name} (${applicant.email})`
        : `${applicant.name}（${applicant.email}）の面接`;

      const meetResult = await createGoogleMeetEvent(
        meetTitle,
        meetDescription,
        slot.startTime,
        slot.endTime,
        applicant.email,
        slot.interviewer?.email ?? undefined,
      );
      meetUrl = meetResult.meetUrl;
      eventId = meetResult.eventId;
    }

    // トランザクション: スロット予約 + 応募者更新
    await prisma.$transaction([
      prisma.interviewSlot.update({
        where: { id: slot.id },
        data: {
          isBooked: true,
          applicantId: applicant.id,
          meetUrl: meetUrl || slot.meetUrl || null,
          calendarEventId: eventId || null,
        },
      }),
      prisma.applicant.update({
        where: { id: applicant.id },
        data: { flowStatus: 'INTERVIEW_WAITING' },
      }),
    ]);

    // 確認メール送信（応募者へ）
    const slotStart = new Date(slot.startTime);
    const slotEnd = new Date(slot.endTime);
    const interviewDate = formatInterviewDate(slotStart, lang);
    const interviewTime = formatTime(slotStart, slotEnd);

    sendApplicantConfirmationEmail(
      applicant.email,
      applicant.name,
      lang,
      interviewDate,
      interviewTime,
      meetUrl,
      jobName,
      applicant.managementToken,
      (slotMaster?.meetingType as string) || 'GOOGLE_MEET',
      slotMaster?.zoomMeetingNumber,
      slotMaster?.zoomPassword,
    ).catch(err => console.error('Interview confirmation email failed:', err));

    // 管理者通知メール
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'recruit@tiramis.co.jp';
    sendInterviewBookingAdminNotification(
      adminEmail,
      applicant.name,
      applicant.email,
      interviewDate,
      interviewTime,
      meetUrl,
      jobName,
    ).catch(err => console.error('Admin notification email failed:', err));

    return NextResponse.json({
      success: true,
      interview: {
        startTime: slot.startTime,
        endTime: slot.endTime,
        meetUrl,
        interviewDate,
        interviewTime,
      },
    });
  } catch (error) {
    console.error('Interview Booking POST Error:', error);
    return NextResponse.json({ error: '面接スロットの予約に失敗しました' }, { status: 500 });
  }
}
