import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { sendInterviewReminderEmail, sendTrainingReminderEmail } from '@/lib/mailer';

const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/send-reminders
// CRON ジョブ: 当日の面接・研修リマインダーメールを送信（UTC 0:00 = JST 9:00）
export async function GET(request: Request) {
  // 2台構成の重複実行防止: CRON_PRIMARY=true のサーバーのみ実行
  if (process.env.CRON_PRIMARY !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'not primary' });
  }

  // Bearer トークン認証
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    // JST の「今日」の範囲を計算（UTC 基準で +9 時間）
    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const todayJSTStart = new Date(Date.UTC(
      jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate(), 0, 0, 0
    ));
    // JST 0:00 → UTC に変換（-9時間）
    const todayUTCStart = new Date(todayJSTStart.getTime() - 9 * 60 * 60 * 1000);
    const todayUTCEnd = new Date(todayUTCStart.getTime() + 24 * 60 * 60 * 1000);

    let interviewSent = 0;
    let interviewFailed = 0;
    let trainingSent = 0;
    let trainingFailed = 0;

    // ────────────────────────────────────────────
    // 1. 面接リマインダー
    // ────────────────────────────────────────────
    const interviewSlotApplicants = await prisma.interviewSlotApplicant.findMany({
      where: {
        interviewSlot: {
          startTime: { gte: todayUTCStart, lt: todayUTCEnd },
        },
        applicant: {
          hiringStatus: { not: 'REJECTED' },
        },
      },
      include: {
        interviewSlot: {
          include: {
            jobCategory: true,
            interviewSlotMaster: true,
          },
        },
        applicant: {
          include: {
            jobCategory: true,
          },
        },
      },
    });

    for (const isa of interviewSlotApplicants) {
      const { applicant, interviewSlot } = isa;
      const isEn = applicant.language === 'en';

      const startTime = interviewSlot.startTime;
      const endTime = interviewSlot.endTime;

      const interviewDate = startTime.toLocaleDateString(isEn ? 'en-US' : 'ja-JP', {
        year: 'numeric',
        month: isEn ? 'long' : 'numeric',
        day: 'numeric',
        weekday: isEn ? 'long' : 'short',
        timeZone: 'Asia/Tokyo',
      });

      const formatTime = (d: Date) => d.toLocaleTimeString(isEn ? 'en-US' : 'ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo',
      });
      const interviewTime = `${formatTime(startTime)} - ${formatTime(endTime)}`;

      const jobCategoryName = isEn
        ? (interviewSlot.jobCategory?.nameEn || interviewSlot.jobCategory?.nameJa || applicant.jobCategory.nameEn || applicant.jobCategory.nameJa)
        : (interviewSlot.jobCategory?.nameJa || applicant.jobCategory.nameJa);

      // Meet URL: InterviewSlotApplicant に個別の meetUrl がある場合はそれを使用
      const meetUrl = isa.meetUrl || interviewSlot.meetUrl || null;

      // ミーティングタイプ・Zoom情報はマスタから取得
      const master = interviewSlot.interviewSlotMaster;
      const meetingType = master?.meetingType || 'GOOGLE_MEET';
      const zoomMeetingNumber = master?.zoomMeetingNumber || null;
      const zoomPassword = master?.zoomPassword || null;

      try {
        await sendInterviewReminderEmail(
          applicant.email,
          applicant.name,
          applicant.language,
          interviewDate,
          interviewTime,
          meetUrl,
          jobCategoryName,
          meetingType,
          zoomMeetingNumber,
          zoomPassword,
        );
        interviewSent++;
        await writeAuditLog({
          actorType: 'SYSTEM',
          action: 'CREATE',
          targetModel: 'Applicant',
          targetId: applicant.id,
          description: `面接リマインダーメール送信成功（${applicant.name} / ${applicant.email}）`,
          afterData: { type: 'interview_reminder', status: 'success', email: applicant.email, interviewDate, interviewTime },
        });
      } catch (err) {
        console.error(`面接リマインダー送信失敗 (applicant=${applicant.id}):`, err);
        interviewFailed++;
        await writeAuditLog({
          actorType: 'SYSTEM',
          action: 'CREATE',
          targetModel: 'Applicant',
          targetId: applicant.id,
          description: `面接リマインダーメール送信失敗（${applicant.name} / ${applicant.email}）`,
          afterData: { type: 'interview_reminder', status: 'failed', email: applicant.email, error: String(err) },
        }).catch(() => {});
      }
    }

    // ────────────────────────────────────────────
    // 2. 研修リマインダー
    // ────────────────────────────────────────────
    const trainingApplicants = await prisma.applicant.findMany({
      where: {
        hiringStatus: { not: 'REJECTED' },
        trainingSlot: {
          startTime: { gte: todayUTCStart, lt: todayUTCEnd },
        },
      },
      include: {
        trainingSlot: true,
        jobCategory: true,
      },
    });

    for (const applicant of trainingApplicants) {
      const trainingSlot = applicant.trainingSlot!;
      const isEn = applicant.language === 'en';

      const trainingDate = trainingSlot.startTime.toLocaleDateString(isEn ? 'en-US' : 'ja-JP', {
        year: 'numeric',
        month: isEn ? 'long' : 'numeric',
        day: 'numeric',
        weekday: isEn ? 'long' : 'short',
        timeZone: 'Asia/Tokyo',
      });

      const formatTime = (d: Date) => d.toLocaleTimeString(isEn ? 'en-US' : 'ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tokyo',
      });
      const trainingTime = `${formatTime(trainingSlot.startTime)} - ${formatTime(trainingSlot.endTime)}`;

      const jobCategoryName = isEn
        ? (applicant.jobCategory.nameEn || applicant.jobCategory.nameJa)
        : applicant.jobCategory.nameJa;

      try {
        await sendTrainingReminderEmail(
          applicant.email,
          applicant.name,
          applicant.language,
          trainingDate,
          trainingTime,
          trainingSlot.location,
          jobCategoryName,
        );
        trainingSent++;
        await writeAuditLog({
          actorType: 'SYSTEM',
          action: 'CREATE',
          targetModel: 'Applicant',
          targetId: applicant.id,
          description: `研修リマインダーメール送信成功（${applicant.name} / ${applicant.email}）`,
          afterData: { type: 'training_reminder', status: 'success', email: applicant.email, trainingDate, trainingTime },
        });
      } catch (err) {
        console.error(`研修リマインダー送信失敗 (applicant=${applicant.id}):`, err);
        trainingFailed++;
        await writeAuditLog({
          actorType: 'SYSTEM',
          action: 'CREATE',
          targetModel: 'Applicant',
          targetId: applicant.id,
          description: `研修リマインダーメール送信失敗（${applicant.name} / ${applicant.email}）`,
          afterData: { type: 'training_reminder', status: 'failed', email: applicant.email, error: String(err) },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      interview: { sent: interviewSent, failed: interviewFailed },
      training: { sent: trainingSent, failed: trainingFailed },
      message: `リマインダー送信完了: 面接${interviewSent}件, 研修${trainingSent}件`,
    });
  } catch (error) {
    console.error('CRON Send Reminders Error:', error);
    return NextResponse.json({ error: 'リマインダー送信に失敗しました' }, { status: 500 });
  }
}
