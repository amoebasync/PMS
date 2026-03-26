import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// POST /api/staff/training-test/start — 研修テスト開始
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { assignmentId } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId は必須です' }, { status: 400 });
    }

    // 割当の検証: 存在するか・この配布員のものか・PENDINGか
    const assignment = await prisma.trainingTestAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return NextResponse.json({ error: '割当が見つかりません' }, { status: 404 });
    }

    if (assignment.distributorId !== distributor.id) {
      return NextResponse.json({ error: 'この割当はあなたのものではありません' }, { status: 403 });
    }

    if (assignment.status !== 'PENDING') {
      return NextResponse.json({ error: 'この割当はすでに完了しています' }, { status: 400 });
    }

    // 出題数を取得
    const questionCountSetting = await prisma.systemSetting.findUnique({
      where: { key: 'trainingTestQuestionCount' },
    });
    const questionCount = parseInt(questionCountSetting?.value || '10');

    // アクティブな問題IDを全件取得
    const allQuestions = await prisma.trainingQuestion.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (allQuestions.length === 0) {
      return NextResponse.json({ error: '問題が登録されていません' }, { status: 400 });
    }

    // Fisher-Yatesシャッフルして先頭N件を選択
    const shuffledIds = shuffle(allQuestions.map((q) => q.id));
    const selectedIds = shuffledIds.slice(0, Math.min(questionCount, shuffledIds.length));
    const actualCount = selectedIds.length;

    // 選択した問題を選択肢付きで取得
    const questions = await prisma.trainingQuestion.findMany({
      where: { id: { in: selectedIds } },
      include: {
        choices: {
          select: {
            id: true,
            choiceTextJa: true,
            choiceTextEn: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // selectedIds の順序に並び替え（DBの返却順は保証されないため）
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = selectedIds
      .map((id) => questionMap.get(id))
      .filter(Boolean) as typeof questions;

    // この割当の既存受験回数を取得
    const existingResultCount = await prisma.trainingTestResult.count({
      where: { assignmentId },
    });
    const attemptNumber = existingResultCount + 1;

    // テスト結果レコードを作成
    const result = await prisma.trainingTestResult.create({
      data: {
        assignmentId,
        score: 0,
        totalQuestions: actualCount,
        isPassed: false,
        attemptNumber,
        questionIds: selectedIds,
        answers: [],
      },
    });

    // 言語に基づいて問題テキストと選択肢テキストを設定（isCorrectは含めない）
    const lang = distributor.language || 'ja';
    const responseQuestions = orderedQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      question: lang === 'en' ? q.questionEn : q.questionJa,
      imageUrl: q.imageUrl,
      choices: shuffle(
        q.choices.map((c) => ({
          id: c.id,
          text: lang === 'en' ? c.choiceTextEn : c.choiceTextJa,
        }))
      ),
    }));

    return NextResponse.json({
      resultId: result.id,
      questions: responseQuestions,
    });
  } catch (error) {
    console.error('Training Test Start Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
