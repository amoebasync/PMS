import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isGeminiConfigured } from '@/lib/gemini';
import { verifyResidenceCard } from '@/lib/residence-card-verification';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    // Check system setting
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'residenceCardAiVerification' },
    });
    if (setting?.value !== 'true') {
      return NextResponse.json({ error: 'AI検証機能が無効です' }, { status: 400 });
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'Gemini APIキーが設定されていません' }, { status: 503 });
    }

    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
      select: { id: true, residenceCardFrontUrl: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }
    if (!distributor.residenceCardFrontUrl) {
      return NextResponse.json({ error: '在留カード表面画像がアップロードされていません' }, { status: 400 });
    }

    // Set PENDING
    await prisma.flyerDistributor.update({
      where: { id: distributorId },
      data: { residenceCardVerificationStatus: 'PENDING' },
    });

    try {
      const result = await verifyResidenceCard('FlyerDistributor', distributorId);

      const updated = await prisma.flyerDistributor.update({
        where: { id: distributorId },
        data: {
          residenceCardVerificationStatus: result.overallMatch ? 'VERIFIED' : 'MISMATCH',
          residenceCardVerificationResult: result as any,
          residenceCardVerifiedAt: new Date(),
        },
        select: {
          residenceCardVerificationStatus: true,
          residenceCardVerificationResult: true,
          residenceCardVerifiedAt: true,
        },
      });

      // Audit log
      const { actorId, actorName } = await getAdminActorInfo();
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'FlyerDistributor',
        targetId: distributorId,
        afterData: {
          residenceCardVerificationStatus: updated.residenceCardVerificationStatus,
          overallMatch: result.overallMatch,
        },
        ipAddress: getIpAddress(request),
        description: `在留カードAI検証実行: ${result.overallMatch ? '一致' : '不一致'}`,
      });

      return NextResponse.json({
        status: updated.residenceCardVerificationStatus,
        result: updated.residenceCardVerificationResult,
        verifiedAt: updated.residenceCardVerifiedAt,
      });
    } catch (verifyError) {
      // Save ERROR status
      await prisma.flyerDistributor.update({
        where: { id: distributorId },
        data: {
          residenceCardVerificationStatus: 'ERROR',
          residenceCardVerificationResult: {
            error: verifyError instanceof Error ? verifyError.message : String(verifyError),
            processedAt: new Date().toISOString(),
          },
          residenceCardVerifiedAt: new Date(),
        },
      });
      console.error('[VerifyResidenceCard] Verification error:', verifyError);
      return NextResponse.json({
        error: '検証処理中にエラーが発生しました',
        status: 'ERROR',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[VerifyResidenceCard] Error:', error);
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 });
  }
}
