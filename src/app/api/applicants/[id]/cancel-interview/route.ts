import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

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

    // 応募者+スロット取得
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      include: { interviewSlot: true },
    });

    if (!applicant) {
      return NextResponse.json({ error: '応募者が見つかりません' }, { status: 404 });
    }

    if (!applicant.interviewSlot) {
      return NextResponse.json({ error: '面接スロットが紐付いていません' }, { status: 400 });
    }

    const slotId = applicant.interviewSlot.id;

    const updated = await prisma.$transaction(async (tx) => {
      // スロット解放
      await tx.interviewSlot.update({
        where: { id: slotId },
        data: {
          isBooked: false,
          applicantId: null,
        },
      });

      // 監査ログ
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'InterviewSlot',
        targetId: slotId,
        ipAddress: ip,
        description: `応募者「${applicant.name}」の面接をキャンセル（スロットID: ${slotId} を解放）`,
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Cancel Interview Error:', error);
    return NextResponse.json({ error: '面接キャンセルに失敗しました' }, { status: 500 });
  }
}
