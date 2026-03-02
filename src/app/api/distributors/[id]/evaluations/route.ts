import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/distributors/[id]/evaluations
// 管理者: 配布員の評価履歴を取得
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
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
      select: { id: true, name: true, staffId: true, rank: true, currentScore: true },
    });

    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    // Last 12 evaluations
    const evaluations = await prisma.distributorEvaluation.findMany({
      where: { distributorId },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });

    // Complaints from the last 12 weeks
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const complaints = await prisma.complaint.findMany({
      where: {
        distributorId,
        occurredAt: { gte: twelveWeeksAgo },
      },
      include: {
        complaintType: { select: { id: true, name: true, penaltyScore: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });

    return NextResponse.json({
      distributor,
      evaluations,
      complaints,
    });
  } catch (error) {
    console.error('Distributor Evaluations Error:', error);
    return NextResponse.json({ error: '評価履歴の取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/distributors/[id]/evaluations
// 管理者: ランクの手動上書き
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
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { determinedRank, note } = body;

    if (!determinedRank || !['S', 'A', 'B', 'C', 'D'].includes(determinedRank)) {
      return NextResponse.json({ error: 'ランクはS/A/B/C/Dのいずれかを指定してください' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // Find the latest evaluation
    const latestEval = await prisma.distributorEvaluation.findFirst({
      where: { distributorId },
      orderBy: { periodStart: 'desc' },
    });

    if (!latestEval) {
      return NextResponse.json({ error: 'この配布員にはまだ評価履歴がありません' }, { status: 404 });
    }

    const beforeData = { ...latestEval } as unknown as Record<string, unknown>;

    const updated = await prisma.$transaction(async (tx) => {
      // Update evaluation
      const updatedEval = await tx.distributorEvaluation.update({
        where: { id: latestEval.id },
        data: {
          determinedRank,
          note: note ?? latestEval.note,
          isManualOverride: true,
        },
      });

      // Update distributor's rank
      await tx.flyerDistributor.update({
        where: { id: distributorId },
        data: { rank: determinedRank },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'DistributorEvaluation',
        targetId: latestEval.id,
        beforeData,
        afterData: updatedEval as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布員ID:${distributorId}の評価ランクを手動変更（${latestEval.determinedRank} → ${determinedRank}）`,
        tx,
      });

      return updatedEval;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Distributor Evaluation Override Error:', error);
    return NextResponse.json({ error: '評価の更新に失敗しました' }, { status: 500 });
  }
}
