import { NextResponse } from 'next/server';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { getSubmitter, createContractSubmission, isDocusealConfigured } from '@/lib/docuseal';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/staff/contract — 配布員自身の契約署名URLを取得
 * DocuSeal submitter の url フィールドに署名用URLが含まれる
 * docusealSubmitterId が未設定の場合は自動で契約書を生成・送信する
 */
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    // 既に署名済みの場合
    if (distributor.hasSignedContract || distributor.contractStatus === 'SIGNED') {
      return NextResponse.json({ status: 'SIGNED' });
    }

    if (!isDocusealConfigured()) {
      return NextResponse.json({ error: 'DocuSealが設定されていません' }, { status: 500 });
    }

    // 契約書が未送信の場合 → 自動で生成・送信
    if (!distributor.docusealSubmitterId) {
      if (!distributor.email) {
        return NextResponse.json({ error: 'メールアドレスが登録されていません。管理者にお問い合わせください。', status: 'NO_EMAIL' }, { status: 400 });
      }

      try {
        const submission = await createContractSubmission({
          email: distributor.email,
          name: distributor.name,
          externalId: String(distributor.id),
          sendEmail: true,
        });

        const submitter = submission.submitters?.[0];
        if (!submitter) {
          return NextResponse.json({ error: '契約書の生成に失敗しました' }, { status: 500 });
        }

        // DB に submitterId を保存
        await prisma.flyerDistributor.update({
          where: { id: distributor.id },
          data: {
            docusealSubmitterId: submitter.id,
            contractStatus: 'PENDING',
          },
        });

        return NextResponse.json({
          status: 'PENDING',
          signingUrl: submitter.url,
        });
      } catch (e) {
        console.error('Auto contract creation error:', e);
        return NextResponse.json({ error: '契約書の自動生成に失敗しました。管理者にお問い合わせください。' }, { status: 500 });
      }
    }

    // DocuSeal から submitter の署名URL を取得
    const submitter = await getSubmitter(distributor.docusealSubmitterId);

    if (submitter.completed_at) {
      // Webhook前にここに来た場合（既に署名済み）
      return NextResponse.json({ status: 'SIGNED' });
    }

    return NextResponse.json({
      status: 'PENDING',
      signingUrl: submitter.url,
    });
  } catch (error) {
    console.error('Staff contract GET error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
