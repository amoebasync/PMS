import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getIpAddress } from '@/lib/audit';
import { sendInterviewChangeEmail, sendInterviewCancelEmail } from '@/lib/mailer';
import { createGoogleMeetEvent, isGoogleMeetConfigured, deleteGoogleCalendarEvent } from '@/lib/google-meet';
import { isSlotAvailable, bookSlotForApplicant, unbookSlotForApplicant } from '@/lib/interview-slot-helpers';

// 応募者をトークンで検索し、面接スロットと職種情報を含めて返す
async function findApplicantByToken(token: string) {
  return prisma.applicant.findFirst({
    where: { managementToken: token },
    include: {
      interviewSlot: true,
      interviewSlotApplicants: {
        include: { interviewSlot: true },
        take: 1,
      },
      jobCategory: true,
    },
  });
}

// 変更・キャンセルが可能かチェック
function canModify(applicant: { flowStatus: string; hiringStatus: string }) {
  return (
    applicant.flowStatus === 'INTERVIEW_WAITING' &&
    applicant.hiringStatus === 'IN_PROGRESS'
  );
}

// 面接日が前日以前かチェック（当日変更は不可）
function isBeforeInterviewDay(slotStartTime: Date): boolean {
  const now = new Date();
  const interviewDate = new Date(slotStartTime);
  interviewDate.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today < interviewDate;
}

// GET /api/apply/manage/[token]
// 公開API: トークンで応募者の面接情報を取得
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const applicant = await findApplicantByToken(token);
    if (!applicant) {
      return NextResponse.json(
        { error: '無効なリンクです' },
        { status: 404 }
      );
    }

    const slot = applicant.interviewSlotApplicants[0]?.interviewSlot || applicant.interviewSlot;
    const canChange = canModify(applicant) && slot && isBeforeInterviewDay(slot.startTime);

    const isEn = applicant.language === 'en';

    // 面接日時のフォーマット
    let interviewDate = null;
    let interviewTime = null;
    if (slot) {
      interviewDate = new Date(slot.startTime).toLocaleDateString(
        isEn ? 'en-US' : 'ja-JP',
        { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
      );
      interviewTime = `${new Date(slot.startTime).toLocaleTimeString(
        isEn ? 'en-US' : 'ja-JP',
        { hour: '2-digit', minute: '2-digit' }
      )} - ${new Date(slot.endTime).toLocaleTimeString(
        isEn ? 'en-US' : 'ja-JP',
        { hour: '2-digit', minute: '2-digit' }
      )}`;
    }

    return NextResponse.json({
      applicant: {
        name: applicant.name,
        language: applicant.language,
        jobCategory: isEn
          ? (applicant.jobCategory.nameEn || applicant.jobCategory.nameJa)
          : applicant.jobCategory.nameJa,
        jobCategoryId: applicant.jobCategoryId,
      },
      interview: slot
        ? {
            date: interviewDate,
            time: interviewTime,
            meetUrl: slot.meetUrl,
            startTime: slot.startTime,
          }
        : null,
      canChange: !!canChange,
      status: {
        flowStatus: applicant.flowStatus,
        hiringStatus: applicant.hiringStatus,
      },
    });
  } catch (error) {
    console.error('Manage Interview GET Error:', error);
    return NextResponse.json(
      { error: '情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// PUT /api/apply/manage/[token]
// 公開API: 面接時間を変更する
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { newSlotId } = body;

    if (!newSlotId) {
      return NextResponse.json(
        { error: '新しい面接枠を選択してください' },
        { status: 400 }
      );
    }

    const applicant = await findApplicantByToken(token);
    if (!applicant) {
      return NextResponse.json(
        { error: '無効なリンクです' },
        { status: 404 }
      );
    }

    if (!canModify(applicant)) {
      return NextResponse.json(
        { error: '面接の変更はできません' },
        { status: 403 }
      );
    }

    const currentSlot = applicant.interviewSlotApplicants[0]?.interviewSlot || applicant.interviewSlot;
    if (!currentSlot) {
      return NextResponse.json(
        { error: '面接予約が見つかりません' },
        { status: 404 }
      );
    }

    if (!isBeforeInterviewDay(currentSlot.startTime)) {
      return NextResponse.json(
        { error: '面接当日の変更はできません。前日までに変更してください。' },
        { status: 400 }
      );
    }

    // トランザクション: 旧スロット解放 → 新スロット予約
    const result = await prisma.$transaction(async (tx) => {
      // 新スロットの空き確認
      const newSlot = await tx.interviewSlot.findUnique({
        where: { id: Number(newSlotId) },
        include: { interviewer: { select: { email: true } } },
      });

      if (!newSlot) {
        throw new Error('SLOT_UNAVAILABLE');
      }

      const newSlotAvailable = await isSlotAvailable(tx, newSlot.id);
      if (!newSlotAvailable) {
        throw new Error('SLOT_UNAVAILABLE');
      }

      if (new Date(newSlot.startTime) <= new Date()) {
        throw new Error('SLOT_EXPIRED');
      }

      // Google Meet イベントを作成（設定されている場合のみ）
      let meetUrl = newSlot.meetUrl;
      let calendarEventId: string | null = null;
      if (!meetUrl && isGoogleMeetConfigured()) {
        const isEn = applicant.language === 'en';
        const jobName = isEn
          ? (applicant.jobCategory.nameEn || applicant.jobCategory.nameJa)
          : applicant.jobCategory.nameJa;
        const meetTitle = `【ティラミス】${applicant.name}様 ${jobName} 面接`;
        const meetDescription = `応募者: ${applicant.name}\nメール: ${applicant.email}\n職種: ${jobName}`;

        const meetResult = await createGoogleMeetEvent(
          meetTitle,
          meetDescription,
          newSlot.startTime,
          newSlot.endTime,
          applicant.email,
          newSlot.interviewer?.email || undefined
        );
        meetUrl = meetResult.meetUrl;
        calendarEventId = meetResult.eventId;
      }

      // 旧スロット解放（中間テーブル + レガシー）
      await unbookSlotForApplicant(tx, currentSlot.id, applicant.id);

      // 新スロット予約（中間テーブル + レガシー）
      await bookSlotForApplicant(tx, Number(newSlotId), applicant.id, meetUrl || newSlot.meetUrl, calendarEventId);

      // 更新後のスロット情報を取得
      const updatedSlot = await tx.interviewSlot.findUnique({ where: { id: Number(newSlotId) } });

      // 監査ログ
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'UPDATE',
        targetModel: 'InterviewSlot',
        targetId: applicant.id,
        beforeData: { slotId: currentSlot.id, startTime: currentSlot.startTime } as unknown as Record<string, unknown>,
        afterData: { slotId: updatedSlot!.id, startTime: updatedSlot!.startTime } as unknown as Record<string, unknown>,
        ipAddress: getIpAddress(request),
        description: `応募者「${applicant.name}」が面接時間を変更（旧枠ID: ${currentSlot.id} → 新枠ID: ${updatedSlot!.id}）`,
        tx,
      });

      return updatedSlot!;
    });

    // 旧 Google Calendar イベントを削除（トランザクション外で非同期実行）
    if (currentSlot.calendarEventId) {
      deleteGoogleCalendarEvent(currentSlot.calendarEventId).catch(() => {});
    }

    // 変更後の面接日時フォーマット
    const isEn = applicant.language === 'en';
    const newDate = new Date(result.startTime).toLocaleDateString(
      isEn ? 'en-US' : 'ja-JP',
      { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
    );
    const newTime = `${new Date(result.startTime).toLocaleTimeString(
      isEn ? 'en-US' : 'ja-JP',
      { hour: '2-digit', minute: '2-digit' }
    )} - ${new Date(result.endTime).toLocaleTimeString(
      isEn ? 'en-US' : 'ja-JP',
      { hour: '2-digit', minute: '2-digit' }
    )}`;

    const jobCategoryName = isEn
      ? (applicant.jobCategory.nameEn || applicant.jobCategory.nameJa)
      : applicant.jobCategory.nameJa;

    // 変更通知メール送信（非同期）
    sendInterviewChangeEmail(
      applicant.email,
      applicant.name,
      applicant.language,
      newDate,
      newTime,
      result.meetUrl,
      jobCategoryName,
      applicant.managementToken!,
    ).catch((err) => console.error('Interview change email failed:', err));

    return NextResponse.json({
      success: true,
      interview: {
        date: newDate,
        time: newTime,
        meetUrl: result.meetUrl,
        startTime: result.startTime,
      },
    });
  } catch (error: any) {
    if (error.message === 'SLOT_UNAVAILABLE') {
      return NextResponse.json(
        { error: 'この面接枠は既に予約されています。別の枠を選択してください。' },
        { status: 409 }
      );
    }
    if (error.message === 'SLOT_EXPIRED') {
      return NextResponse.json(
        { error: 'この面接枠は既に過ぎています。別の枠を選択してください。' },
        { status: 400 }
      );
    }
    console.error('Manage Interview PUT Error:', error);
    return NextResponse.json(
      { error: '面接時間の変更に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/apply/manage/[token]
// 公開API: 面接をキャンセルする
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const applicant = await findApplicantByToken(token);
    if (!applicant) {
      return NextResponse.json(
        { error: '無効なリンクです' },
        { status: 404 }
      );
    }

    if (!canModify(applicant)) {
      return NextResponse.json(
        { error: '面接のキャンセルはできません' },
        { status: 403 }
      );
    }

    const currentSlot = applicant.interviewSlotApplicants[0]?.interviewSlot || applicant.interviewSlot;
    if (!currentSlot) {
      return NextResponse.json(
        { error: '面接予約が見つかりません' },
        { status: 404 }
      );
    }

    if (!isBeforeInterviewDay(currentSlot.startTime)) {
      return NextResponse.json(
        { error: '面接当日のキャンセルはできません。前日までにキャンセルしてください。' },
        { status: 400 }
      );
    }

    // トランザクション: スロット解放 + ステータス更新
    await prisma.$transaction(async (tx) => {
      // スロット解放（中間テーブル + レガシー）
      await unbookSlotForApplicant(tx, currentSlot.id, applicant.id);

      // 応募者ステータス更新（自己キャンセル）
      await tx.applicant.update({
        where: { id: applicant.id },
        data: {
          hiringStatus: 'REJECTED',
        },
      });

      // 監査ログ
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'STATUS_CHANGE',
        targetModel: 'Applicant',
        targetId: applicant.id,
        beforeData: { hiringStatus: 'IN_PROGRESS', slotId: currentSlot.id } as unknown as Record<string, unknown>,
        afterData: { hiringStatus: 'REJECTED', slotId: null } as unknown as Record<string, unknown>,
        ipAddress: getIpAddress(request),
        description: `応募者「${applicant.name}」が面接をキャンセル（枠ID: ${currentSlot.id}を解放）`,
        tx,
      });
    });

    // Google Calendar イベントを削除（トランザクション外で非同期実行）
    if (currentSlot.calendarEventId) {
      deleteGoogleCalendarEvent(currentSlot.calendarEventId).catch(() => {});
    }

    const isEn = applicant.language === 'en';
    const jobCategoryName = isEn
      ? (applicant.jobCategory.nameEn || applicant.jobCategory.nameJa)
      : applicant.jobCategory.nameJa;

    // キャンセル通知メール送信（非同期）
    sendInterviewCancelEmail(
      applicant.email,
      applicant.name,
      applicant.language,
      jobCategoryName,
    ).catch((err) => console.error('Interview cancel email failed:', err));

    return NextResponse.json({
      success: true,
      message: isEn
        ? 'Your interview has been cancelled.'
        : '面接のキャンセルが完了しました。',
    });
  } catch (error) {
    console.error('Manage Interview DELETE Error:', error);
    return NextResponse.json(
      { error: '面接のキャンセルに失敗しました' },
      { status: 500 }
    );
  }
}
