import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getIpAddress } from '@/lib/audit';
import { sendApplicantConfirmationEmail } from '@/lib/mailer';

// POST /api/apply
// 公開API: 応募者情報を送信し、面接スロットを予約する
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      phone,
      language,
      jobCategoryId,
      countryId,
      visaTypeId,
      postalCode,
      address,
      building,
      interviewSlotId,
    } = body;

    // バリデーション
    if (!name || !email || !jobCategoryId || !interviewSlotId) {
      return NextResponse.json(
        { error: '必須項目が入力されていません' },
        { status: 400 }
      );
    }

    // メール重複チェック
    const existing = await prisma.applicant.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 }
      );
    }

    // トランザクション: 応募者作成 + スロット予約
    const result = await prisma.$transaction(async (tx) => {
      // スロットの空き状況を確認
      const slot = await tx.interviewSlot.findUnique({
        where: { id: Number(interviewSlotId) },
      });

      if (!slot || slot.isBooked) {
        throw new Error('SLOT_UNAVAILABLE');
      }

      if (new Date(slot.startTime) <= new Date()) {
        throw new Error('SLOT_EXPIRED');
      }

      // 応募者レコード作成
      const applicant = await tx.applicant.create({
        data: {
          name,
          email,
          phone: phone || null,
          language: language || 'ja',
          jobCategoryId: Number(jobCategoryId),
          countryId: countryId ? Number(countryId) : null,
          visaTypeId: visaTypeId ? Number(visaTypeId) : null,
          postalCode: postalCode || null,
          address: address || null,
          building: building || null,
        },
      });

      // スロットに応募者を紐付け
      const updatedSlot = await tx.interviewSlot.update({
        where: { id: Number(interviewSlotId) },
        data: {
          isBooked: true,
          applicantId: applicant.id,
        },
      });

      // 監査ログ
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'CREATE',
        targetModel: 'Applicant',
        targetId: applicant.id,
        afterData: applicant as unknown as Record<string, unknown>,
        ipAddress: getIpAddress(request),
        description: `応募者「${name}」が応募を完了（面接枠ID: ${interviewSlotId}）`,
        tx,
      });

      return { applicant, slot: updatedSlot };
    });

    // 職種名を取得してメール送信
    const jobCategory = await prisma.jobCategory.findUnique({
      where: { id: Number(jobCategoryId) },
    });

    const lang = language || 'ja';
    const isEn = lang === 'en';

    const interviewDate = new Date(result.slot.startTime).toLocaleDateString(
      isEn ? 'en-US' : 'ja-JP',
      { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
    );
    const interviewTime = `${new Date(result.slot.startTime).toLocaleTimeString(
      isEn ? 'en-US' : 'ja-JP',
      { hour: '2-digit', minute: '2-digit' }
    )} - ${new Date(result.slot.endTime).toLocaleTimeString(
      isEn ? 'en-US' : 'ja-JP',
      { hour: '2-digit', minute: '2-digit' }
    )}`;

    // メール送信（非同期、エラーでもレスポンスは成功とする）
    sendApplicantConfirmationEmail(
      email,
      name,
      lang,
      interviewDate,
      interviewTime,
      result.slot.meetUrl,
      isEn ? (jobCategory?.nameEn || jobCategory?.nameJa || '') : (jobCategory?.nameJa || ''),
    ).catch((err) => console.error('Applicant confirmation email failed:', err));

    return NextResponse.json({
      success: true,
      applicant: {
        id: result.applicant.id,
        name: result.applicant.name,
        email: result.applicant.email,
      },
      interview: {
        date: interviewDate,
        time: interviewTime,
        meetUrl: result.slot.meetUrl,
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
    console.error('Apply Error:', error);
    return NextResponse.json({ error: '応募の処理に失敗しました' }, { status: 500 });
  }
}
