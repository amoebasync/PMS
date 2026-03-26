import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

interface AnswerEntry {
  questionId: number;
  choiceId: number;
  isCorrect: boolean;
}

// POST /api/staff/training-test/complete — 研修テスト完了
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { resultId } = body;

    if (!resultId) {
      return NextResponse.json({ error: 'resultId は必須です' }, { status: 400 });
    }

    // 結果レコードを取得し、割当情報も含めてこの配布員のものか確認
    const result = await prisma.trainingTestResult.findUnique({
      where: { id: resultId },
      include: {
        assignment: { select: { id: true, distributorId: true } },
      },
    });

    if (!result) {
      return NextResponse.json({ error: 'テスト結果が見つかりません' }, { status: 404 });
    }

    if (result.assignment.distributorId !== distributor.id) {
      return NextResponse.json({ error: 'このテスト結果はあなたのものではありません' }, { status: 403 });
    }

    // 全問回答済みか確認
    const answers = (result.answers as unknown) as AnswerEntry[];
    if (answers.length !== result.totalQuestions) {
      return NextResponse.json(
        {
          error: `まだ回答が揃っていません（${answers.length}/${result.totalQuestions}）`,
        },
        { status: 400 }
      );
    }

    // 合格基準を取得
    const passingRateSetting = await prisma.systemSetting.findUnique({
      where: { key: 'trainingTestPassingRate' },
    });
    const passingRate = parseInt(passingRateSetting?.value || '80');

    const { score, totalQuestions } = result;
    const isPassed = (score / totalQuestions) * 100 >= passingRate;
    const passingScore = Math.ceil(totalQuestions * passingRate / 100);
    const assignmentId = result.assignment.id;

    if (isPassed) {
      // 合格の場合: トランザクションでまとめて更新
      await prisma.$transaction(async (tx) => {
        // テスト結果を合格として更新
        await tx.trainingTestResult.update({
          where: { id: resultId },
          data: { isPassed: true },
        });

        // 割当ステータスを PASSED に更新
        await tx.trainingTestAssignment.update({
          where: { id: assignmentId },
          data: { status: 'PASSED', passedAt: new Date() },
        });

        // 配布員の合格フラグを更新
        await tx.flyerDistributor.update({
          where: { id: distributor.id },
          data: { isTrainingTestPassed: true, trainingTestPassedAt: new Date() },
        });

        // 管理者通知を作成
        await tx.adminNotification.create({
          data: {
            type: 'TRAINING_TEST_PASSED',
            title: `${distributor.name}さんが研修テストに合格しました`,
            message: `スコア: ${score}/${totalQuestions}`,
            distributorId: distributor.id,
          },
        });
      });
    } else {
      // 不合格の場合: 結果レコードのみ更新（isPassed は既に false だが明示的に更新）
      await prisma.trainingTestResult.update({
        where: { id: resultId },
        data: { isPassed: false },
      });
    }

    return NextResponse.json({
      score,
      totalQuestions,
      isPassed,
      passingScore,
    });
  } catch (error) {
    console.error('Training Test Complete Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
