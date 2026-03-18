import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActorInfo } from '@/lib/audit';

// PUT /api/picking/[id]/retake
// 撮り直し（リセット）- 全フィールドをリセットしてPENDINGに戻す
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { actorId } = await getAdminActorInfo();
    if (!actorId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const params = await context.params;
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    // 既存のverificationを取得
    const existing = await prisma.pickingVerification.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'ピッキング照合レコードが見つかりません' },
        { status: 404 }
      );
    }

    // 全フィールドをリセットしてPENDINGに戻す
    const verification = await prisma.pickingVerification.update({
      where: { id },
      data: {
        photoUrl: null,
        aiResult: null,
        aiReason: null,
        aiCheckedAt: null,
        checkerResult: null,
        checkerId: null,
        checkerNote: null,
        checkedAt: null,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      verification: {
        id: verification.id,
        scheduleId: verification.scheduleId,
        status: verification.status,
      },
      message: 'ピッキング照合をリセットしました。再度写真をアップロードしてください。',
    });
  } catch (error) {
    console.error('PUT /api/picking/[id]/retake error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
