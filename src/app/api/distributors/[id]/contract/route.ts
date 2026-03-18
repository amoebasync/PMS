import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createContractSubmission, isDocusealConfigured } from '@/lib/docuseal';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

/**
 * POST /api/distributors/[id]/contract — 業務委託契約書を送信（DocuSeal）
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const distributorId = parseInt(id, 10);
  const ip = getIpAddress(request);

  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session')?.value;
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    if (!isDocusealConfigured()) {
      return NextResponse.json({ error: 'DocuSealが設定されていません（環境変数を確認してください）' }, { status: 500 });
    }

    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
    });

    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    if (!distributor.email) {
      return NextResponse.json({ error: '配布員のメールアドレスが未設定です' }, { status: 400 });
    }

    if (distributor.contractStatus === 'SIGNED') {
      return NextResponse.json({ error: '既に契約書が署名済みです' }, { status: 400 });
    }

    // DocuSeal submission を作成
    const submission = await createContractSubmission({
      email: distributor.email,
      name: distributor.name,
      externalId: String(distributor.id),
      sendEmail: true,
    });

    const submitter = submission.submitters?.[0];

    // DB更新
    await prisma.flyerDistributor.update({
      where: { id: distributorId },
      data: {
        contractStatus: 'SENT',
        docusealSubmissionId: submission.id,
        docusealSubmitterId: submitter?.id || null,
      },
    });

    const { actorId, actorName } = await getAdminActorInfo();
    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'UPDATE',
      targetModel: 'FlyerDistributor',
      targetId: distributorId,
      description: `業務委託契約書を送信 (DocuSeal submission: ${submission.id})`,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      submitterId: submitter?.id,
    });
  } catch (error: any) {
    console.error('Contract send error:', error);
    return NextResponse.json({ error: error.message || '契約書の送信に失敗しました' }, { status: 500 });
  }
}
