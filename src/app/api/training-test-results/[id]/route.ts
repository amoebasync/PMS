import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session')?.value;
  if (!session) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const { id } = await params;
  const resultId = parseInt(id, 10);

  if (isNaN(resultId)) {
    return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
  }

  const result = await prisma.trainingTestResult.findUnique({
    where: { id: resultId },
    include: {
      assignment: {
        include: {
          distributor: { select: { id: true, staffId: true, name: true } },
          assignedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        },
      },
    },
  });

  if (!result) {
    return NextResponse.json({ error: 'テスト結果が見つかりません' }, { status: 404 });
  }

  const questionIds = result.questionIds as number[];
  const questions = await prisma.trainingQuestion.findMany({
    where: { id: { in: questionIds } },
    include: { choices: { orderBy: { sortOrder: 'asc' } } },
  });

  return NextResponse.json({ result, questions });
}
