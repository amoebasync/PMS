import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// GET /api/staff/training-test — 研修テスト状態取得
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    // 未受験の割当を取得
    const pendingAssignment = await prisma.trainingTestAssignment.findFirst({
      where: { distributorId: distributor.id, status: 'PENDING' },
      select: { id: true, assignedAt: true },
    });

    // 過去の受験結果を取得（最新10件）
    const pastResults = await prisma.trainingTestResult.findMany({
      where: { assignment: { distributorId: distributor.id } },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        score: true,
        totalQuestions: true,
        isPassed: true,
        attemptNumber: true,
        completedAt: true,
      },
    });

    return NextResponse.json({
      pendingAssignment: pendingAssignment
        ? { id: pendingAssignment.id, assignedAt: pendingAssignment.assignedAt }
        : null,
      isTrainingTestPassed: distributor.isTrainingTestPassed,
      pastResults,
    });
  } catch (error) {
    console.error('Training Test GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
