import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { sendHiringNotificationEmail, sendRejectionNotificationEmail } from '@/lib/mailer';

// GET /api/applicants/[id]
// 管理者: 応募者詳細取得
export async function GET(
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

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: {
        jobCategory: true,
        country: true,
        visaType: true,
        interviewSlot: {
          include: {
            interviewer: { select: { id: true, lastNameJa: true, firstNameJa: true, email: true } },
            interviewSlotMaster: { select: { id: true, name: true, meetingType: true, zoomMeetingNumber: true, zoomPassword: true } },
          },
        },
        recruitingMedia: true,
        trainingSlot: true,
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    // 配布員登録済みかチェック（メールアドレスで照合）
    const registeredDistributor = applicant.email
      ? await prisma.flyerDistributor.findFirst({
          where: { email: applicant.email },
          select: { id: true },
        })
      : null;

    return NextResponse.json({
      ...applicant,
      registeredDistributorId: registeredDistributor?.id ?? null,
    });
  } catch (error) {
    console.error('Applicant Detail Error:', error);
    return NextResponse.json({ error: '応募者の取得に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/applicants/[id]
// 管理者: 応募者削除（面接スロット解放含む）
export async function DELETE(
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
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { interviewSlot: true },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 面接スロットが紐付いている場合は解放
      if (applicant.interviewSlot) {
        await tx.interviewSlot.update({
          where: { id: applicant.interviewSlot.id },
          data: { applicantId: null, isBooked: false },
        });
      }

      // 応募者を削除
      await tx.applicant.delete({ where: { id: applicantId } });

      // 監査ログ
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'Applicant',
        targetId: applicantId,
        beforeData: applicant as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `応募者「${applicant.name}」を削除`,
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Applicant Delete Error:', error);
    return NextResponse.json({ error: '応募者の削除に失敗しました' }, { status: 500 });
  }
}

// PUT /api/applicants/[id]
// 管理者: 応募者情報・評価・ステータスの更新
export async function PUT(
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
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 更新前データ取得
    const beforeData = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { jobCategory: true },
    });

    if (!beforeData) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    const previousHiringStatus = beforeData.hiringStatus;

    // 更新可能フィールド
    const updateData: any = {};

    // 基本情報の修正（面接時に修正可能）
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.jobCategoryId !== undefined) updateData.jobCategoryId = body.jobCategoryId ? Number(body.jobCategoryId) : null;
    if (body.countryId !== undefined) updateData.countryId = body.countryId ? Number(body.countryId) : null;
    if (body.visaTypeId !== undefined) updateData.visaTypeId = body.visaTypeId ? Number(body.visaTypeId) : null;
    if (body.postalCode !== undefined) updateData.postalCode = body.postalCode || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.building !== undefined) updateData.building = body.building || null;
    if (body.birthday !== undefined) updateData.birthday = body.birthday ? new Date(body.birthday) : null;
    if (body.gender !== undefined) updateData.gender = body.gender || null;

    // ステータス
    if (body.flowStatus !== undefined) updateData.flowStatus = body.flowStatus;
    if (body.hiringStatus !== undefined) updateData.hiringStatus = body.hiringStatus;

    // 評価項目
    if (body.hasOtherJob !== undefined) updateData.hasOtherJob = body.hasOtherJob;
    if (body.otherJobDetails !== undefined) updateData.otherJobDetails = body.otherJobDetails || null;
    if (body.hasBankInJapan !== undefined) updateData.hasBankInJapan = body.hasBankInJapan;
    if (body.japaneseLevel !== undefined) updateData.japaneseLevel = body.japaneseLevel != null ? Number(body.japaneseLevel) : null;
    if (body.englishLevel !== undefined) updateData.englishLevel = body.englishLevel != null ? Number(body.englishLevel) : null;
    if (body.communicationScore !== undefined) updateData.communicationScore = body.communicationScore != null ? Number(body.communicationScore) : null;
    if (body.impressionScore !== undefined) updateData.impressionScore = body.impressionScore != null ? Number(body.impressionScore) : null;
    if (body.interviewNotes !== undefined) updateData.interviewNotes = body.interviewNotes || null;
    if (body.recruitingMediaId !== undefined) updateData.recruitingMediaId = body.recruitingMediaId ? Number(body.recruitingMediaId) : null;

    // 研修評価項目
    if (body.trainingAttendance !== undefined) updateData.trainingAttendance = body.trainingAttendance || null;
    if (body.trainingUnderstandingScore !== undefined) updateData.trainingUnderstandingScore = body.trainingUnderstandingScore != null ? Number(body.trainingUnderstandingScore) : null;
    if (body.trainingCommunicationScore !== undefined) updateData.trainingCommunicationScore = body.trainingCommunicationScore != null ? Number(body.trainingCommunicationScore) : null;
    if (body.trainingSpeedScore !== undefined) updateData.trainingSpeedScore = body.trainingSpeedScore != null ? Number(body.trainingSpeedScore) : null;
    if (body.trainingMotivationScore !== undefined) updateData.trainingMotivationScore = body.trainingMotivationScore != null ? Number(body.trainingMotivationScore) : null;
    if (body.trainingNotes !== undefined) updateData.trainingNotes = body.trainingNotes || null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.applicant.update({
        where: { id: applicantId },
        data: updateData,
        include: {
          jobCategory: true,
          country: true,
          visaType: true,
          interviewSlot: {
            include: {
              interviewer: { select: { id: true, lastNameJa: true, firstNameJa: true, email: true } },
              interviewSlotMaster: { select: { id: true, name: true, meetingType: true, zoomMeetingNumber: true, zoomPassword: true } },
            },
          },
          recruitingMedia: true,
          trainingSlot: true,
        },
      });

      const action = body.hiringStatus && body.hiringStatus !== previousHiringStatus
        ? 'STATUS_CHANGE' as const
        : 'UPDATE' as const;

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action,
        targetModel: 'Applicant',
        targetId: applicantId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: result as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: action === 'STATUS_CHANGE'
          ? `応募者「${result.name}」のステータスを変更（${previousHiringStatus} → ${result.hiringStatus}）`
          : `応募者「${result.name}」の情報を更新`,
        tx,
      });

      return result;
    });

    // 採用に変更された場合、採用通知メールを送信（システム設定で無効化可能）
    if (
      body.hiringStatus === 'HIRED' &&
      previousHiringStatus !== 'HIRED'
    ) {
      const sendHiringSetting = await prisma.systemSetting.findUnique({
        where: { key: 'sendHiringEmail' },
      });
      const shouldSend = sendHiringSetting?.value !== 'false';

      if (shouldSend) {
        const lang = updated.language || 'ja';
        const jobName = lang === 'en'
          ? (updated.jobCategory?.nameEn || updated.jobCategory?.nameJa || '')
          : (updated.jobCategory?.nameJa || '');

        sendHiringNotificationEmail(
          updated.email,
          updated.name,
          lang,
          jobName,
        ).catch((err) => console.error('Hiring notification email failed:', err));
      }
    }

    // 不採用に変更された場合、不採用通知メールを送信（システム設定で有効化が必要、デフォルトOFF）
    if (
      body.hiringStatus === 'REJECTED' &&
      previousHiringStatus !== 'REJECTED'
    ) {
      const sendRejectionSetting = await prisma.systemSetting.findUnique({
        where: { key: 'sendRejectionEmail' },
      });
      const shouldSend = sendRejectionSetting?.value === 'true';

      if (shouldSend) {
        const lang = updated.language || 'ja';
        const jobName = lang === 'en'
          ? (updated.jobCategory?.nameEn || updated.jobCategory?.nameJa || '')
          : (updated.jobCategory?.nameJa || '');

        sendRejectionNotificationEmail(
          updated.email,
          updated.name,
          lang,
          jobName,
        ).catch((err) => console.error('Rejection notification email failed:', err));
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Applicant Update Error:', error);
    return NextResponse.json({ error: '応募者の更新に失敗しました' }, { status: 500 });
  }
}
