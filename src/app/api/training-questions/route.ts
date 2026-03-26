import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET /api/training-questions
// 管理者: 問題プール一覧取得
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get('isActive');

    const where: { isActive?: boolean } = {};
    if (isActiveParam === 'true') where.isActive = true;
    else if (isActiveParam === 'false') where.isActive = false;

    const questions = await prisma.trainingQuestion.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        choices: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('TrainingQuestion Fetch Error:', error);
    return NextResponse.json({ error: '問題の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/training-questions
// 管理者: 問題を作成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      type,
      questionJa,
      questionEn,
      imageUrl,
      explanationJa,
      explanationEn,
      isActive = true,
      sortOrder = 0,
      choices = [],
    } = body;

    // 必須フィールドの検証
    if (!type || !questionJa || !questionEn || !explanationJa || !explanationEn) {
      return NextResponse.json(
        { error: '問題文（日本語・英語）と解説（日本語・英語）は必須です' },
        { status: 400 }
      );
    }

    if (!['MULTIPLE_CHOICE', 'TRUE_FALSE', 'IMAGE'].includes(type)) {
      return NextResponse.json({ error: '無効な問題種別です' }, { status: 400 });
    }

    // 選択肢の検証
    const correctCount = choices.filter((c: { isCorrect: boolean }) => c.isCorrect).length;

    if (type === 'MULTIPLE_CHOICE') {
      if (choices.length !== 4) {
        return NextResponse.json({ error: '選択問題は選択肢が4つ必要です' }, { status: 400 });
      }
      if (correctCount !== 1) {
        return NextResponse.json({ error: '選択問題は正解が1つ必要です' }, { status: 400 });
      }
    } else if (type === 'TRUE_FALSE') {
      if (choices.length !== 2) {
        return NextResponse.json({ error: '正誤問題は選択肢が2つ必要です' }, { status: 400 });
      }
      if (correctCount !== 1) {
        return NextResponse.json({ error: '正誤問題は正解が1つ必要です' }, { status: 400 });
      }
    } else if (type === 'IMAGE') {
      if (!imageUrl) {
        return NextResponse.json({ error: '画像問題は画像URLが必要です' }, { status: 400 });
      }
      if (choices.length < 2) {
        return NextResponse.json({ error: '画像問題は選択肢が2つ以上必要です' }, { status: 400 });
      }
      if (correctCount !== 1) {
        return NextResponse.json({ error: '画像問題は正解が1つ必要です' }, { status: 400 });
      }
    }

    const created = await prisma.trainingQuestion.create({
      data: {
        type,
        questionJa,
        questionEn,
        imageUrl: imageUrl || null,
        explanationJa,
        explanationEn,
        isActive,
        sortOrder,
        choices: {
          create: choices.map((c: {
            choiceTextJa: string;
            choiceTextEn: string;
            isCorrect: boolean;
            sortOrder: number;
          }) => ({
            choiceTextJa: c.choiceTextJa,
            choiceTextEn: c.choiceTextEn,
            isCorrect: c.isCorrect,
            sortOrder: c.sortOrder,
          })),
        },
      },
      include: {
        choices: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('TrainingQuestion Create Error:', error);
    return NextResponse.json({ error: '問題の作成に失敗しました' }, { status: 500 });
  }
}
