import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

interface AnswerEntry {
  questionId: number;
  choiceId: number;
  isCorrect: boolean;
}

// POST /api/staff/training-test/answer — 回答送信
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { resultId, questionId, choiceId } = body;

    if (!resultId || !questionId || !choiceId) {
      return NextResponse.json({ error: 'resultId, questionId, choiceId は必須です' }, { status: 400 });
    }

    // 結果レコードを取得し、この配布員の割当に属するか確認
    const result = await prisma.trainingTestResult.findUnique({
      where: { id: resultId },
      include: {
        assignment: { select: { distributorId: true } },
      },
    });

    if (!result) {
      return NextResponse.json({ error: 'テスト結果が見つかりません' }, { status: 404 });
    }

    if (result.assignment.distributorId !== distributor.id) {
      return NextResponse.json({ error: 'このテスト結果はあなたのものではありません' }, { status: 403 });
    }

    // questionId が出題リストに含まれるか確認
    const questionIds = result.questionIds as number[];
    if (!questionIds.includes(questionId)) {
      return NextResponse.json({ error: 'この問題はテストに含まれていません' }, { status: 400 });
    }

    // 既に回答済みの問題かチェック
    const answers = (result.answers as unknown) as AnswerEntry[];
    const alreadyAnswered = answers.some((a) => a.questionId === questionId);
    if (alreadyAnswered) {
      return NextResponse.json({ error: 'この問題はすでに回答済みです' }, { status: 400 });
    }

    // 選択した選択肢を取得して正誤を確認
    const selectedChoice = await prisma.trainingChoice.findUnique({
      where: { id: choiceId },
      select: { id: true, isCorrect: true, questionId: true },
    });

    if (!selectedChoice) {
      return NextResponse.json({ error: '選択肢が見つかりません' }, { status: 404 });
    }

    if (selectedChoice.questionId !== questionId) {
      return NextResponse.json({ error: 'この選択肢はその問題のものではありません' }, { status: 400 });
    }

    // 正解の選択肢を取得
    const correctChoice = await prisma.trainingChoice.findFirst({
      where: { questionId, isCorrect: true },
      select: { id: true },
    });

    // 問題の解説を取得
    const question = await prisma.trainingQuestion.findUnique({
      where: { id: questionId },
      select: { explanationJa: true, explanationEn: true },
    });

    const lang = distributor.language || 'ja';
    const explanation = question
      ? lang === 'en'
        ? question.explanationEn
        : question.explanationJa
      : '';

    // 回答を追記してスコアを更新
    const newAnswer: AnswerEntry = {
      questionId,
      choiceId,
      isCorrect: selectedChoice.isCorrect,
    };
    const updatedAnswers = [...answers, newAnswer];
    const newScore = result.score + (selectedChoice.isCorrect ? 1 : 0);

    await prisma.trainingTestResult.update({
      where: { id: resultId },
      data: {
        answers: updatedAnswers as unknown as object[],
        score: newScore,
      },
    });

    return NextResponse.json({
      isCorrect: selectedChoice.isCorrect,
      correctChoiceId: correctChoice?.id ?? null,
      explanation,
    });
  } catch (error) {
    console.error('Training Test Answer Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
