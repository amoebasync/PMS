import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// PUT /api/training-questions/[id]
// 管理者: 問題を更新
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
    const questionId = parseInt(id);
    if (isNaN(questionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    // 問題の存在確認
    const existing = await prisma.trainingQuestion.findUnique({ where: { id: questionId } });
    if (!existing) {
      return NextResponse.json({ error: '問題が見つかりません' }, { status: 404 });
    }

    const body = await request.json();
    const {
      type,
      questionJa,
      questionEn,
      imageUrl,
      explanationJa,
      explanationEn,
      isActive,
      sortOrder,
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

    // 既存の選択肢を削除して再作成（トランザクション）
    const updated = await prisma.$transaction(async (tx) => {
      await tx.trainingChoice.deleteMany({ where: { questionId } });

      return tx.trainingQuestion.update({
        where: { id: questionId },
        data: {
          type,
          questionJa,
          questionEn,
          imageUrl: imageUrl || null,
          explanationJa,
          explanationEn,
          isActive: isActive !== undefined ? isActive : existing.isActive,
          sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
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
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('TrainingQuestion Update Error:', error);
    return NextResponse.json({ error: '問題の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/training-questions/[id]
// 管理者: 問題を論理削除（isActive = false）
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const questionId = parseInt(id);
    if (isNaN(questionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const existing = await prisma.trainingQuestion.findUnique({ where: { id: questionId } });
    if (!existing) {
      return NextResponse.json({ error: '問題が見つかりません' }, { status: 404 });
    }

    await prisma.trainingQuestion.update({
      where: { id: questionId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('TrainingQuestion Delete Error:', error);
    return NextResponse.json({ error: '問題の削除に失敗しました' }, { status: 500 });
  }
}
