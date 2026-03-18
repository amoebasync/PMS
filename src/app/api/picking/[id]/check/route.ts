import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActorInfo, writeAuditLog, getIpAddress } from '@/lib/audit';

// PUT /api/picking/[id]/check
// 人的チェック（承認/差戻し）
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { actorId, actorName } = await getAdminActorInfo();
    if (!actorId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const params = await context.params;
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { result, note } = body as { result: 'APPROVED' | 'REJECTED'; note?: string };
    
    if (!result || !['APPROVED', 'REJECTED'].includes(result)) {
      return NextResponse.json(
        { error: 'result は APPROVED または REJECTED を指定してください' },
        { status: 400 }
      );
    }
    
    // 既存のverificationを取得
    const beforeData = await prisma.pickingVerification.findUnique({
      where: { id },
      include: {
        picker: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
    });
    
    if (!beforeData) {
      return NextResponse.json(
        { error: 'ピッキング照合レコードが見つかりません' },
        { status: 404 }
      );
    }
    
    // ピッキングした人とチェックする人が同一でないことを確認
    if (beforeData.pickerId === actorId) {
      return NextResponse.json(
        { error: 'ピッキング担当者と同じ人はチェックできません' },
        { status: 400 }
      );
    }
    
    // AI_CHECKEDステータス以外はチェック不可
    if (beforeData.status !== 'AI_CHECKED') {
      return NextResponse.json(
        { error: 'このレコードは人的チェックできる状態ではありません' },
        { status: 400 }
      );
    }
    
    const now = new Date();
    const newStatus = result === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
    
    const verification = await prisma.pickingVerification.update({
      where: { id },
      data: {
        checkerId: actorId,
        checkerResult: result,
        checkerNote: note || null,
        checkedAt: now,
        status: newStatus,
      },
    });
    
    // 監査ログ
    await writeAuditLog({
      actorType: 'EMPLOYEE',
      action: 'UPDATE',
      targetModel: 'PickingVerification',
      targetId: id,
      actorId,
      actorName,
      ipAddress: getIpAddress(request),
      beforeData: beforeData as unknown as Record<string, unknown>,
      afterData: verification as unknown as Record<string, unknown>,
    });
    
    return NextResponse.json({
      success: true,
      verification: {
        id: verification.id,
        status: verification.status,
        checkerResult: verification.checkerResult,
        checkerNote: verification.checkerNote,
        checkedAt: verification.checkedAt,
      },
    });
  } catch (error) {
    console.error('PUT /api/picking/[id]/check error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
