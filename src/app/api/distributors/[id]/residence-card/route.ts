import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { deleteFromS3 } from '@/lib/s3';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// S3 URL / プロキシURLからS3キーを抽出
function extractS3Key(url: string): string | null {
  if (url.startsWith('/api/s3-proxy')) {
    try {
      const u = new URL(url, 'http://localhost');
      return u.searchParams.get('key');
    } catch {
      return null;
    }
  }
  const match = url.match(/amazonaws\.com\/(.+)$/);
  return match ? match[1] : null;
}

// DELETE /api/distributors/[id]/residence-card
// 管理者が在留カード画像を削除
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { side } = body;
    if (side !== 'front' && side !== 'back') {
      return NextResponse.json({ error: 'side パラメータは front または back を指定してください' }, { status: 400 });
    }

    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
      select: {
        id: true, name: true,
        residenceCardFrontUrl: true,
        residenceCardBackUrl: true,
        hasResidenceCard: true,
      },
    });
    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    const currentUrl = side === 'front'
      ? distributor.residenceCardFrontUrl
      : distributor.residenceCardBackUrl;

    if (!currentUrl) {
      return NextResponse.json({ error: '削除対象の画像が登録されていません' }, { status: 404 });
    }

    // S3から削除
    const s3Key = extractS3Key(currentUrl);
    if (s3Key) {
      try {
        await deleteFromS3(s3Key);
      } catch (err) {
        console.error('S3 delete failed (continuing):', err);
      }
    }

    // 削除後、両面ともnullになるか判定
    const otherUrl = side === 'front'
      ? distributor.residenceCardBackUrl
      : distributor.residenceCardFrontUrl;
    const bothDeleted = !otherUrl;

    const updateData = side === 'front'
      ? { residenceCardFrontUrl: null as string | null }
      : { residenceCardBackUrl: null as string | null };

    if (bothDeleted) {
      (updateData as Record<string, unknown>).hasResidenceCard = false;
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = {
      residenceCardFrontUrl: distributor.residenceCardFrontUrl,
      residenceCardBackUrl: distributor.residenceCardBackUrl,
      hasResidenceCard: distributor.hasResidenceCard,
    };

    await prisma.$transaction(async (tx) => {
      await tx.flyerDistributor.update({
        where: { id: distributorId },
        data: updateData,
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'FlyerDistributor',
        targetId: distributorId,
        beforeData,
        afterData: {
          ...beforeData,
          ...(side === 'front' ? { residenceCardFrontUrl: null } : { residenceCardBackUrl: null }),
          ...(bothDeleted ? { hasResidenceCard: false } : {}),
        },
        ipAddress: ip,
        description: `配布員「${distributor.name}」の在留カード画像（${side === 'front' ? '表面' : '裏面'}）を削除`,
        tx,
      });
    });

    return NextResponse.json({
      side,
      hasResidenceCard: bothDeleted ? false : distributor.hasResidenceCard,
      residenceCardFrontUrl: side === 'front' ? null : distributor.residenceCardFrontUrl,
      residenceCardBackUrl: side === 'back' ? null : distributor.residenceCardBackUrl,
    });
  } catch (error) {
    console.error('Residence Card Delete Error:', error);
    return NextResponse.json({ error: '在留カード画像の削除に失敗しました' }, { status: 500 });
  }
}
