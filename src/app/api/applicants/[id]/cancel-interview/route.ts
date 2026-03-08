import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { deleteGoogleCalendarEvent } from '@/lib/google-meet';
import { unbookSlotForApplicant } from '@/lib/interview-slot-helpers';

// POST /api/applicants/[id]/cancel-interview
// 管理者: 面接をキャンセル（スロット解放）
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
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // リクエストボディからキャンセル理由を取得
    let cancelReason: string | null = null;
    try {
      const body = await request.json();
      cancelReason = body.cancelReason || null;
    } catch { /* bodyが無い場合は無視 */ }

    // 応募者+スロット取得
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: {
        interviewSlot: true,
        interviewSlotApplicants: {
          include: { interviewSlot: true },
          take: 1,
        },
      },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    const linkedSlot = applicant.interviewSlotApplicants[0]?.interviewSlot || applicant.interviewSlot;
    if (!linkedSlot) {
      return NextResponse.json({ error: '面接スロットが紐付いていません' }, { status: 400 });
    }

    const slotId = linkedSlot.id;
    const oldCalendarEventId = linkedSlot.calendarEventId;

    const updated = await prisma.$transaction(async (tx) => {
      // スロット解放（中間テーブル + レガシー）
      await unbookSlotForApplicant(tx, slotId, applicantId);

      // ステータスをキャンセルに変更 + キャンセル理由保存
      await tx.applicant.update({
        where: { id: applicantId },
        data: {
          flowStatus: 'CANCELLED',
          cancelReason,
        },
      });

      // 監査ログ
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'Applicant',
        targetId: applicantId,
        ipAddress: ip,
        description: `応募者「${applicant.name}」の面接をキャンセル（スロットID: ${slotId} を解放）${cancelReason ? `理由: ${cancelReason}` : ''}`,
        tx,
      });

      // 更新後の応募者を返す
      return tx.applicant.findUnique({
        where: { id: applicantId },
        include: {
          jobCategory: true,
          country: true,
          visaType: true,
          interviewSlot: true,
          recruitingMedia: true,
        },
      });
    });

    // Google Calendar イベントを削除（トランザクション外で非同期実行）
    if (oldCalendarEventId) {
      deleteGoogleCalendarEvent(oldCalendarEventId).catch(() => {});
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Cancel Interview Error:', error);
    return NextResponse.json({ error: '面接キャンセルに失敗しました' }, { status: 500 });
  }
}
